// app/routes/admin.users.new.tsx - Create User from Admin
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useActionData, Form, Link, useSearchParams } from "react-router";
import { useState } from "react";
import { requireAdmin, logAdminAction } from "~/lib/session.server";
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

function getActionLinkFromLinkResponse(linkData: any): string | null {
  return (
    linkData?.properties?.action_link ||
    linkData?.action_link ||
    linkData?.data?.properties?.action_link ||
    linkData?.data?.action_link ||
    null
  );
}

async function createUserWithInviteEmail(args: {
  email: string;
  fullName: string;
  userType: "private";
  companyName?: string | null;
  appUrl: string;
}) {
  const tempPassword = randomTempPassword();

  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: args.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: args.fullName,
      user_type: args.userType,
      company_name: args.companyName || null,
    },
  });

  if (createError || !createData?.user?.id) {
    return { error: createError?.message || "Failed to create user", userId: null as string | null };
  }

  const redirectTo = `${args.appUrl}/reset-password`;
  const { data: linkData, error: linkError } = await (supabaseAdmin.auth.admin as any).generateLink({
    type: "recovery",
    email: args.email,
    options: { redirectTo },
  });

  const actionLink = getActionLinkFromLinkResponse(linkData);
  if (linkError || !actionLink) {
    return {
      error: linkError?.message || "Could not generate password setup link",
      userId: createData.user.id,
    };
  }

  const emailResult = await sendTemplatedEmail({
    to: args.email,
    templateId: "account_setup",
    locale: null,
    payload: { setupLink: actionLink },
  });

  if (!emailResult.ok) {
    return {
      error: emailResult.error || "Could not send password setup email",
      userId: createData.user.id,
    };
  }

  return { error: null as string | null, userId: createData.user.id };
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "createRealInvite");
  const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");

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
    } else {
      email = String(formData.get("email") || "").trim().toLowerCase();
      fullName = String(formData.get("fullName") || "").trim();
      companyName = "";
      userType = "private";
      managedAccessMode = "external_invite";

      if (!email || !fullName) {
        return data({ error: "Email and full name are required" }, { status: 400 });
      }

      const inviteResult = await createUserWithInviteEmail({
        email,
        fullName,
        userType,
        companyName: null,
        appUrl,
      });
      if (inviteResult.error || !inviteResult.userId) {
        return data({ error: inviteResult.error || "Could not create invited user" }, { status: 400 });
      }
      targetUserId = inviteResult.userId;
    }

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
        mock_profile_only: isMockMode,
      },
    });

    if (isMockMode) {
      if (managedAccessMode === "internal_only") {
        return data({ success: true, message: `Mock internal user created: ${fullName}` });
      }
      return data({ success: true, message: `Mock external user created: ${fullName}` });
    }

    if (isRealInviteMode) return data({ success: true, message: `Invite sent to ${email}. Password setup email delivered.` });
    return data({ success: true, message: "User created." });
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

  const isMockMode = createMode === "mock";

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
        <Form method="post" noValidate className="space-y-5">
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
                <label htmlFor="fullName" className="label">Full Name *</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  className="input w-full"
                  placeholder="John Doe"
                />
              </div>
              <p className="text-xs text-gray-500">
                Real users are invite-only. They will receive an email to set their password.
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
