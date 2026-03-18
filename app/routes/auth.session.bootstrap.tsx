import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { commitUserSessionCookie } from "~/lib/session.server";
import { getSupabaseClient, supabaseAdmin } from "~/lib/supabase.server";
import { needsAdminPhoneVerification } from "~/lib/user-access";

type BootstrapPayload = {
  accessToken?: string;
  refreshToken?: string;
  createSessionIfRequired?: boolean;
};

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") return false;
  const code = String((error as any).code || "");
  const message = String((error as any).message || "").toLowerCase();
  const column = columnName.toLowerCase();
  return (
    code === "PGRST204" ||
    code === "42703" ||
    (message.includes("schema cache") && message.includes(column)) ||
    (message.includes(column) && (message.includes("does not exist") || message.includes("unknown column")))
  );
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  let payload: BootstrapPayload = {};
  try {
    payload = (await request.json()) as BootstrapPayload;
  } catch {
    return data({ error: "Invalid payload" }, { status: 400 });
  }

  const accessToken = String(payload.accessToken || "").trim();
  const refreshToken = String(payload.refreshToken || "").trim();
  const createSessionIfRequired = Boolean(payload.createSessionIfRequired);

  if (!accessToken || !refreshToken) {
    return data({ error: "Missing tokens" }, { status: 400 });
  }

  const tokenClient = getSupabaseClient(accessToken);
  const { data: authData, error } = await tokenClient.auth.getUser();
  if (error || !authData.user?.id) {
    return data({ error: "Invalid access token" }, { status: 401 });
  }

  let { data: profile, error: profileError } = await (supabaseAdmin.from("profiles") as any)
    .select("user_type, created_by_admin, phone_verified_at")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError && isMissingColumnError(profileError, "phone_verified_at")) {
    ({ data: profile, error: profileError } = await (supabaseAdmin.from("profiles") as any)
      .select("user_type, created_by_admin")
      .eq("id", authData.user.id)
      .maybeSingle());
  }
  if (profileError) {
    return data({ error: "Could not load profile" }, { status: 500 });
  }

  const requiresPhoneVerification = needsAdminPhoneVerification(profile);
  if (!requiresPhoneVerification || !createSessionIfRequired) {
    return data({ success: true, requiresPhoneVerification });
  }

  const sessionCookie = await commitUserSessionCookie(authData.user.id, accessToken, refreshToken);
  return data(
    { success: true, requiresPhoneVerification },
    {
      headers: {
        "Set-Cookie": sessionCookie,
      },
    }
  );
}
