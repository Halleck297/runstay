// app/routes/admin.users.new.tsx - Create User from Admin
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useActionData, Form, Link, useSearchParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import { requireAdmin, logAdminAction } from "~/lib/session.server";
import { getAppUrl } from "~/lib/app-url.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";

export const meta: MetaFunction = () => {
  return [{ title: "Create User - Admin - Runoot" }];
};

function buildMockPayload() {
  const now = Date.now();
  const suffix = Math.random().toString(36).slice(2, 7);
  return {
    email: `mock+${now}.${suffix}@mock.runoot.local`,
    fullName: `Mock User ${suffix.toUpperCase()}`,
    userType: "private",
    companyName: "",
  };
}

function randomTempPassword() {
  return `Runoot!${Math.random().toString(36).slice(2, 10)}A1`;
}

async function createAuthUserWithPassword(args: {
  email: string;
  password: string;
  fullName: string;
  userType: "private";
  companyName?: string | null;
}) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: args.email,
    password: args.password,
    email_confirm: true,
    user_metadata: {
      full_name: args.fullName,
      user_type: args.userType,
      company_name: args.companyName || null,
    },
  });

  if (authError || !authData?.user?.id) {
    return { error: authError?.message || "Failed to create user", userId: null as string | null };
  }

  return { error: null as string | null, userId: authData.user.id };
}

function generateInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "createRealInvite");
  const appUrl = getAppUrl(request);

  const mockPayload = buildMockPayload();
  const mockFullName = String(formData.get("mockFullName") || "").trim();
  const isMockMode = actionType === "createMock";
  const isRealInviteMode = actionType === "createRealInvite";
  const mockAccessMode = String(formData.get("mockAccessMode") || "internal_only") as
    | "internal_only"
    | "external_password";

  if (!["createMock", "createRealInvite"].includes(actionType)) {
    return data({ error: "Invalid action type" }, { status: 400 });
  }
  if (!["internal_only", "external_password"].includes(mockAccessMode)) {
    return data({ error: "Invalid mock access mode" }, { status: 400 });
  }

  try {
    let targetUserId: string | null = null;
    let email = "";
    let fullName = "";
    let companyName = "";
    let userType: "private" = "private";
    let managedAccessMode: "internal_only" | "external_password" | "external_invite";
    let isVerified = false;

    if (isMockMode) {
      fullName = mockFullName;
      userType = "private";
      companyName = "";
      isVerified = true;

      if (!fullName) {
        return data({ error: "Mock full name is required" }, { status: 400 });
      }

      if (mockAccessMode === "internal_only") {
        targetUserId = crypto.randomUUID();
        email = mockPayload.email;
        managedAccessMode = "internal_only";
      } else {
        email = String(formData.get("mockEmail") || "").trim().toLowerCase();
        const mockPassword = String(formData.get("mockPassword") || "");

        if (!email || !fullName) {
          return data({ error: "Mock email and name are required" }, { status: 400 });
        }
        if (mockPassword.length < 6) {
          return data({ error: "Mock password must be at least 6 characters" }, { status: 400 });
        }

        const createResult = await createAuthUserWithPassword({
          email,
          password: mockPassword,
          fullName,
          userType,
          companyName: null,
        });
        if (createResult.error || !createResult.userId) {
          return data({ error: createResult.error || "Failed to create mock auth account" }, { status: 400 });
        }
        targetUserId = createResult.userId;
        managedAccessMode = "external_password";
      }

      // --- Mock profile + managed account ---
      const profileData: any = {
        id: targetUserId,
        email,
        full_name: fullName,
        user_type: userType,
        company_name: companyName || null,
        is_verified: isVerified,
        created_by_admin: (admin as any).id,
      };

      const { error: profileError } = await (supabaseAdmin as any)
        .from("profiles")
        .upsert(profileData, { onConflict: "id" });

      if (profileError) {
        return data({ error: `Profile creation failed: ${profileError.message}` }, { status: 500 });
      }

      const { error: managedError } = await (supabaseAdmin as any)
        .from("admin_managed_accounts")
        .upsert(
          {
            user_id: targetUserId,
            access_mode: managedAccessMode,
            created_by_admin: (admin as any).id,
          },
          { onConflict: "user_id" },
        );
      if (managedError) {
        return data({ error: `Managed account tagging failed: ${managedError.message}` }, { status: 500 });
      }

      await logAdminAction((admin as any).id, "user_created", {
        targetUserId,
        details: {
          email,
          user_type: userType,
          mode: actionType,
          access_mode: managedAccessMode,
          mock_profile_only: true,
        },
      });

      if (managedAccessMode === "internal_only") {
        return data({ success: true, message: `Mock internal user created: ${fullName}` });
      }
      return data({ success: true, message: `Mock external user created: ${fullName}` });
    }

    // --- Real invite mode: create referral_invites record + send email ---
    if (isRealInviteMode) {
      email = String(formData.get("email") || "").trim().toLowerCase();
      const targetRole = String(formData.get("targetRole") || "private");

      if (!email) {
        return data({ error: "Email is required" }, { status: 400 });
      }

      const inviteTypeMap: Record<string, string> = {
        private: "admin_invite",
        team_leader: "admin_invite_tl",
        tour_operator: "admin_invite_to",
      };
      const inviteType = inviteTypeMap[targetRole] || "admin_invite";

      // Check if email already has an account
      const { data: existingProfile } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existingProfile) {
        return data({ error: `An account already exists for ${email}` }, { status: 400 });
      }

      // Delete any existing pending invite for this email (allows re-invite)
      await (supabaseAdmin.from("referral_invites" as any) as any)
        .delete()
        .eq("email", email)
        .eq("status", "pending");

      const token = generateInviteToken();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: inviteError } = await (supabaseAdmin.from("referral_invites" as any) as any)
        .insert({
          team_leader_id: (admin as any).id,
          email,
          token,
          status: "pending",
          invite_type: inviteType,
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
        });

      if (inviteError) {
        return data({ error: `Failed to create invite: ${inviteError.message}` }, { status: 500 });
      }

      const referralLink = `${appUrl}/join/${token}`;
      const emailResult = await sendTemplatedEmail({
        to: email,
        templateId: "referral_invite",
        locale: "en",
        payload: {
          inviterName: "Admin",
          referralLink,
        },
      });

      if (!emailResult.ok) {
        return data({ error: emailResult.error || "Could not send invite email" }, { status: 500 });
      }

      await logAdminAction((admin as any).id, "user_invited", {
        details: {
          email,
          token,
          invite_type: inviteType,
          mode: "referral_invite",
        },
      });

      const roleLabel = targetRole === "team_leader" ? " (Team Leader)" : targetRole === "tour_operator" ? " (Tour Operator)" : "";
      return data({ success: true, message: `Invite sent to ${email}${roleLabel}.` });
    }

    return data({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return data({ error: err.message || "An unexpected error occurred" }, { status: 500 });
  }
}

export default function AdminCreateUser() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "mock" ? "mock" : "user";
  const [createMode, setCreateMode] = useState<"user" | "mock">(initialMode);
  const [mockAccessMode, setMockAccessMode] = useState<"internal_only" | "external_password">("internal_only");
  const formRef = useRef<HTMLFormElement>(null);

  const isMockMode = createMode === "mock";

  useEffect(() => {
    if (!actionData || !("success" in actionData) || !actionData.success) return;
    formRef.current?.reset();
    setCreateMode("user");
    setMockAccessMode("internal_only");
  }, [actionData]);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/users" className="p-2 rounded-full hover:bg-gray-200 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Create User</h1>
          <p className="text-gray-500 mt-1">Invite real users or create mock users</p>
        </div>
      </div>

      {actionData && "error" in actionData && (
        <div className="mb-6 p-4 rounded-lg bg-alert-50 border border-alert-200 text-alert-700 text-sm">
          {actionData.error}
        </div>
      )}

      {actionData && "success" in actionData && actionData.success && (
        <div className="mb-6 p-4 rounded-lg bg-success-50 border border-success-200 text-success-700 text-sm">
          <p>{(actionData as any).message || "User created successfully."}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <Form ref={formRef} method="post" noValidate className="space-y-5">
          <div>
            <label className="label">Mode</label>
            <div className="flex items-center gap-2 rounded-full bg-gray-100 p-1 w-fit">
              <button
                type="button"
                onClick={() => setCreateMode("user")}
                className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                  createMode === "user" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                }`}
              >
                External User Invite
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("mock")}
                className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                  createMode === "mock" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                }`}
              >
                Mock User
              </button>
            </div>
          </div>

          <input
            type="hidden"
            name="_action"
            value={isMockMode ? "createMock" : "createRealInvite"}
          />
          <input type="hidden" name="mockAccessMode" value={mockAccessMode} />

          {isMockMode && (
            <>
              <p className="text-xs text-gray-500">
                Mock users can be internal-only (no credentials) or external (email and password).
              </p>
              <div>
                <label className="label">Mock Access</label>
                <div className="flex items-center gap-2 rounded-full bg-gray-100 p-1 w-fit">
                  <button
                    type="button"
                    onClick={() => setMockAccessMode("internal_only")}
                    className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                      mockAccessMode === "internal_only" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                    }`}
                  >
                    Internal Only (No Login)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMockAccessMode("external_password")}
                    className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                      mockAccessMode === "external_password" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                    }`}
                  >
                    External Login
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="mockFullName" className="label">Mock Full Name *</label>
                <input
                  type="text"
                  id="mockFullName"
                  name="mockFullName"
                  className="input w-full"
                  placeholder="e.g. Runner Luca Test"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Displayed as runner profile name in app/admin lists.</p>
              </div>
              {mockAccessMode === "external_password" && (
                <>
                  <div>
                    <label htmlFor="mockEmail" className="label">Mock Email *</label>
                    <input
                      type="email"
                      id="mockEmail"
                      name="mockEmail"
                      className="input w-full"
                      placeholder="mock.user@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="mockPassword" className="label">Mock Password *</label>
                    <input
                      type="password"
                      id="mockPassword"
                      name="mockPassword"
                      className="input w-full"
                      placeholder="Minimum 6 characters"
                      minLength={6}
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-gray-500">
                      Email confirmation is skipped automatically for mock external accounts.
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {!isMockMode && (
            <>
              <div>
                <label htmlFor="email" className="label">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="input w-full"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label htmlFor="targetRole" className="label">Account type</label>
                <select
                  id="targetRole"
                  name="targetRole"
                  className="input w-full"
                  defaultValue="private"
                >
                  <option value="private">User (Private)</option>
                  <option value="team_leader">Team Leader</option>
                  <option value="tour_operator">Tour Operator</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">The account will be created with this role after the user completes registration.</p>
              </div>

              <p className="text-xs text-gray-500">
                The user will receive an invite email with a link to complete their registration.
              </p>
            </>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button type="submit" className="btn-primary rounded-full">
              {isMockMode ? "Create Mock User" : "Send User Invite"}
            </button>
            <button type="reset" className="btn-secondary rounded-full">
              Reset
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
