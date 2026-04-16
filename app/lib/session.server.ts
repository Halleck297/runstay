import { createCookieSessionStorage, redirect } from "react-router";
import { getSupabaseClient, supabase, supabaseAdmin } from "./supabase.server";
import { isAdmin, isSuperAdmin } from "./user-access";
import { resolveLocaleForRequest } from "./locale";
import type { Profile } from "./database.types";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const isExplicitSecure = process.env.SESSION_COOKIE_SECURE === "true";
const isExplicitInsecure = process.env.SESSION_COOKIE_SECURE === "false";
const isHttpsOrigin = process.env.APP_ORIGIN?.startsWith("https://") ?? false;
const isProduction = process.env.NODE_ENV === "production";
const defaultSecureInEnv = isProduction ? isHttpsOrigin : false;
const cookieSecure = isExplicitSecure || (!isExplicitInsecure && defaultSecureInEnv);

const storage = createCookieSessionStorage({
  cookie: {
    name: "runoot_session",
    secure: cookieSecure,
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
  redirectTo: string,
  options?: { additionalSetCookies?: string[] }
) {
  const sessionCookie = await commitUserSessionCookie(userId, accessToken, refreshToken);
  const setCookies = [sessionCookie, ...(options?.additionalSetCookies || [])];
  const headers = new Headers();
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }

  return redirect(redirectTo, {
    headers,
  });
}

export async function commitUserSessionCookie(
  userId: string,
  accessToken: string,
  refreshToken: string
) {
  const session = await storage.getSession();
  session.set("userId", userId);
  session.set("accessToken", accessToken);
  session.set("refreshToken", refreshToken);
  return storage.commitSession(session);
}

export async function destroyUserSessionCookie(request: Request) {
  const session = await getUserSession(request);
  return storage.destroySession(session);
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

function decodeJwtExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string, leewaySeconds = 60): boolean {
  const exp = decodeJwtExpiry(token);
  if (!exp) return true;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowInSeconds + leewaySeconds;
}

export async function getAccessTokenWithRefresh(request: Request): Promise<{
  accessToken: string | null;
  setCookie?: string;
}> {
  const session = await getUserSession(request);
  const accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");

  if (!accessToken || typeof accessToken !== "string") {
    return { accessToken: null };
  }

  if (!isTokenExpiringSoon(accessToken)) {
    return { accessToken };
  }

  if (!refreshToken || typeof refreshToken !== "string") {
    return { accessToken: null };
  }

  const { data: refreshed, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  const nextAccessToken = refreshed.session?.access_token;
  const nextRefreshToken = refreshed.session?.refresh_token;

  if (error || !nextAccessToken || !nextRefreshToken) {
    session.unset("accessToken");
    session.unset("refreshToken");
    return {
      accessToken: null,
      setCookie: await storage.commitSession(session),
    };
  }

  session.set("accessToken", nextAccessToken);
  session.set("refreshToken", nextRefreshToken);

  return {
    accessToken: nextAccessToken,
    setCookie: await storage.commitSession(session),
  };
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

export async function requireUser(request: Request): Promise<Profile> {
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

  // Keep profile verification aligned with Supabase auth email verification status.
  // This mirrors common auth flows where verification flips after email confirm.
  if (!(profile as any).is_verified) {
    const accessToken = await getAccessToken(request);
    if (accessToken) {
      const tokenClient = getSupabaseClient(accessToken);
      const { data: authUserData } = await tokenClient.auth.getUser();
      const emailConfirmedAt = authUserData.user?.email_confirmed_at;

      if (emailConfirmedAt) {
        await (supabaseAdmin.from("profiles") as any)
          .update({ is_verified: true })
          .eq("id", userId);
        (profile as any).is_verified = true;
      }
    }
  }

  // Runner referral activity lifecycle:
  // if no login for 15+ days, mark referral as inactive and force re-login.
  if ((profile as any).user_type === "private") {
    const lastLoginAt = (profile as any).last_login_at || (profile as any).created_at;
    if (lastLoginAt) {
      const lastLoginTs = new Date(lastLoginAt).getTime();
      const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
      if (!Number.isNaN(lastLoginTs) && Date.now() - lastLoginTs > FIFTEEN_DAYS_MS) {
        await (supabaseAdmin.from("referrals") as any)
          .update({ status: "inactive" })
          .eq("referred_user_id", userId)
          .eq("status", "active");
        throw await logout(request);
      }
    }
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

  if (!profile || !isAdmin(profile)) {
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

  if (!profile || !isSuperAdmin(profile)) {
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

/** Returns true if the current request is an active impersonation session (no DB query). */
export async function isImpersonatingSession(request: Request): Promise<boolean> {
  const session = await getUserSession(request);
  return Boolean(session.get("impersonatingAs"));
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
  const locale = resolveLocaleForRequest(request, null);
  return redirect(`/${locale}`, {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}
