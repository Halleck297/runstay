import { createCookieSessionStorage, redirect } from "react-router";
import { supabase, supabaseAdmin } from "./supabase.server";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "runoot_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
  },
});

export async function createUserSession(
  userId: string,
  accessToken: string,
  refreshToken: string,
  redirectTo: string
) {
  const session = await storage.getSession();
  session.set("userId", userId);
  session.set("accessToken", accessToken);
  session.set("refreshToken", refreshToken);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

export async function getUserSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}

export async function getAccessToken(request: Request) {
  const session = await getUserSession(request);
  return session.get("accessToken") as string | null;
}

/**
 * Get the current user profile.
 * If impersonating, returns the impersonated user's profile.
 */
export async function getUser(request: Request) {
  const session = await getUserSession(request);
  const impersonatingAs = session.get("impersonatingAs") as string | null;

  // If impersonating, return the impersonated user's profile
  if (impersonatingAs) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", impersonatingAs)
      .single();
    return profile;
  }

  const userId = await getUserId(request);
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return profile;
}

/**
 * Get the real admin user ID, even during impersonation.
 * Always returns the actual logged-in admin's ID.
 */
export async function getRealUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}

/**
 * Get the real admin profile, even during impersonation.
 */
export async function getRealUser(request: Request) {
  const realId = await getRealUserId(request);
  if (!realId) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", realId)
    .single();

  return profile;
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function requireUser(request: Request) {
  const userId = await requireUserId(request);

  // During impersonation, getUser returns impersonated profile
  const session = await getUserSession(request);
  const impersonatingAs = session.get("impersonatingAs") as string | null;

  if (impersonatingAs) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", impersonatingAs)
      .single();

    if (!profile) {
      // Impersonated user doesn't exist, stop impersonation
      throw await stopImpersonation(request);
    }
    return profile;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) {
    throw await logout(request);
  }

  return profile;
}

// ============================================
// Admin Guard Functions
// ============================================

/**
 * Requires the real user (not impersonated) to have admin or superadmin role.
 * Always checks the actual logged-in user, not the impersonated user.
 */
export async function requireAdmin(request: Request) {
  const realUserId = await requireUserId(request);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", realUserId)
    .single();

  if (!profile || !["admin", "superadmin"].includes((profile as any).role)) {
    throw redirect("/");
  }

  return profile;
}

/**
 * Requires the real user to have superadmin role.
 */
export async function requireSuperAdmin(request: Request) {
  const realUserId = await requireUserId(request);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", realUserId)
    .single();

  if (!profile || (profile as any).role !== "superadmin") {
    throw redirect("/");
  }

  return profile;
}

// ============================================
// Impersonation Functions
// ============================================

/**
 * Start impersonating a target user. Stores impersonation info in session.
 * Logs the action in admin_audit_log.
 */
export async function startImpersonation(
  request: Request,
  targetUserId: string
) {
  const session = await getUserSession(request);
  const adminId = session.get("userId") as string;

  // Store impersonation data
  session.set("impersonatingAs", targetUserId);
  session.set("originalAdminId", adminId);

  // Log in audit
  await logAdminAction(adminId, "impersonate_start", {
    targetUserId,
    details: { started_at: new Date().toISOString() },
  });

  return redirect("/", {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

/**
 * Stop impersonating. Removes impersonation data from session.
 * Logs the action in admin_audit_log.
 */
export async function stopImpersonation(request: Request) {
  const session = await getUserSession(request);
  const adminId = session.get("userId") as string;
  const targetUserId = session.get("impersonatingAs") as string;

  // Log in audit
  if (adminId && targetUserId) {
    await logAdminAction(adminId, "impersonate_stop", {
      targetUserId,
      details: { stopped_at: new Date().toISOString() },
    });
  }

  // Remove impersonation data
  session.unset("impersonatingAs");
  session.unset("originalAdminId");

  return redirect("/admin", {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

/**
 * Get impersonation context for the current request.
 * Returns null if not impersonating.
 */
export async function getImpersonationContext(request: Request) {
  const session = await getUserSession(request);
  const impersonatingAs = session.get("impersonatingAs") as string | null;
  const originalAdminId = session.get("originalAdminId") as string | null;

  if (!impersonatingAs || !originalAdminId) {
    return null;
  }

  // Fetch the impersonated user's profile
  const { data: targetUser } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, user_type, company_name")
    .eq("id", impersonatingAs)
    .single();

  return {
    isImpersonating: true,
    originalAdminId,
    targetUser,
  };
}

// ============================================
// Audit Log Helper
// ============================================

/**
 * Log an admin action in the audit log.
 * Uses raw SQL-style insert to avoid TypeScript issues with the new table.
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  options?: {
    targetUserId?: string;
    targetListingId?: string;
    details?: Record<string, unknown>;
  }
) {
  await (supabaseAdmin as any).from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    target_user_id: options?.targetUserId || null,
    target_listing_id: options?.targetListingId || null,
    details: options?.details || null,
  });
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}
