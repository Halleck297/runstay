// app/routes/admin.users.new.tsx - Create User from Admin
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
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
  userType: "private" | "tour_operator";
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
  const actionType = String(formData.get("_action") || "createManual");
  const accessMode = String(formData.get("accessMode") || "password");
  const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");

  const mockPayload = actionType === "createMock" ? buildMockPayload() : null;
  const mockFullName = String(formData.get("mockFullName") || "").trim();

  const isAgencyMode = actionType === "createAgencyInvite";

  const email = (mockPayload?.email || String(formData.get("email") || "")).trim().toLowerCase();
  const fullName = (
    actionType === "createMock"
      ? (mockFullName || mockPayload?.fullName || "")
      : isAgencyMode
        ? String(formData.get("agencyCompanyName") || "")
        : String(formData.get("fullName") || "")
  ).trim();

  const companyName = (
    isAgencyMode ? String(formData.get("agencyCompanyName") || "") : mockPayload?.companyName || ""
  ).trim();

  const userType = (isAgencyMode ? "tour_operator" : (mockPayload?.userType || String(formData.get("userType") || ""))) as "private" | "tour_operator";

  const password = String(formData.get("password") || "");
  const skipConfirmation = formData.get("skipConfirmation") === "on";

  if (!email || !fullName || !userType) {
    return data({ error: "Email, name, and user type are required" }, { status: 400 });
  }

  if (isAgencyMode && !companyName) {
    return data({ error: "Agency company name is required" }, { status: 400 });
  }

  const needsPassword = actionType === "createManual" && accessMode === "password";
  if (needsPassword && password.length < 6) {
    return data({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  if (!["private", "tour_operator"].includes(userType)) {
    return data({ error: "Invalid user type" }, { status: 400 });
  }

  try {
    let targetUserId: string | null = null;

    if (actionType === "createMock") {
      targetUserId = crypto.randomUUID();
    } else if (actionType === "createAgencyInvite" || (actionType === "createManual" && accessMode === "invite")) {
      const inviteResult = await createUserWithInviteEmail({
        email,
        fullName,
        userType,
        companyName: companyName || null,
        appUrl,
      });

      if (inviteResult.error || !inviteResult.userId) {
        return data({ error: inviteResult.error || "Could not create invited user" }, { status: 400 });
      }

      targetUserId = inviteResult.userId;
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: skipConfirmation,
        user_metadata: {
          full_name: fullName,
          user_type: userType,
          company_name: null,
        },
      });

      if (authError || !authData?.user?.id) {
        return data({ error: authError?.message || "Failed to create user" }, { status: 400 });
      }

      targetUserId = authData.user.id;
    }

    const profileData: any = {
      id: targetUserId,
      email,
      full_name: fullName,
      user_type: userType,
      company_name: companyName || null,
      created_by_admin: (admin as any).id,
    };

    const { error: profileError } = await (supabaseAdmin as any)
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (profileError) {
      return data({ error: `Profile creation failed: ${profileError.message}` }, { status: 500 });
    }

    if (actionType === "createMock") {
      const { error: mockError } = await (supabaseAdmin as any)
        .from("mock_accounts")
        .upsert(
          {
            user_id: targetUserId,
            created_by_admin: (admin as any).id,
          },
          { onConflict: "user_id" },
        );

      if (mockError) {
        return data({ error: `Mock profile tagging failed: ${mockError.message}` }, { status: 500 });
      }
    }

    await logAdminAction((admin as any).id, "user_created", {
      targetUserId,
      details: {
        email,
        user_type: userType,
        mode: actionType,
        access_mode: isAgencyMode ? "invite" : accessMode,
        mock_profile_only: actionType === "createMock",
      },
    });

    if (actionType === "createMock") {
      return data({ success: true, message: `Mock user created: ${fullName}` });
    }

    if (actionType === "createAgencyInvite") {
      return data({ success: true, message: `Agency invited: ${companyName}. Password setup email sent to ${email}.` });
    }

    if (accessMode === "invite") {
      return data({ success: true, message: `Invite sent to ${email}. Password setup email delivered.` });
    }

    return redirect("/admin/users");
  } catch (err: any) {
    return data({ error: err.message || "An unexpected error occurred" }, { status: 500 });
  }
}

export default function AdminCreateUser() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "agency" ? "agency" : "user";
  const [createMode, setCreateMode] = useState<"user" | "mock" | "agency">(initialMode);
  const [accessMode, setAccessMode] = useState<"password" | "invite">("password");
  const [previewEmail, setPreviewEmail] = useState("");
  const [previewName, setPreviewName] = useState("");

  const isMockMode = createMode === "mock";
  const isAgencyMode = createMode === "agency";
  const isInviteFlow = isAgencyMode || (!isMockMode && accessMode === "invite");

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
          <p className="text-gray-500 mt-1">Add a new user to the platform</p>
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
                User
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
              <button
                type="button"
                onClick={() => setCreateMode("agency")}
                className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                  createMode === "agency" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                }`}
              >
                Agency
              </button>
            </div>
          </div>

          <input
            type="hidden"
            name="_action"
            value={isAgencyMode ? "createAgencyInvite" : (isMockMode ? "createMock" : "createManual")}
          />
          <input type="hidden" name="accessMode" value={isAgencyMode ? "invite" : accessMode} />

          {isMockMode && (
            <>
              <p className="text-xs text-gray-500">
                Mock users are for initial traffic simulation and superadmin impersonation.
              </p>
              <div>
                <label htmlFor="mockFullName" className="label">Mock Username</label>
                <input
                  type="text"
                  id="mockFullName"
                  name="mockFullName"
                  className="input w-full"
                  placeholder="e.g. Runner Luca Test"
                />
                <p className="text-xs text-gray-500 mt-1">Optional. Leave empty to auto-generate.</p>
              </div>
            </>
          )}

          {!isMockMode && !isAgencyMode && (
            <>
              <div>
                <label className="label">Access Setup</label>
                <div className="flex items-center gap-2 rounded-full bg-gray-100 p-1 w-fit">
                  <button
                    type="button"
                    onClick={() => setAccessMode("password")}
                    className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                      accessMode === "password" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                    }`}
                  >
                    Set Password Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessMode("invite")}
                    className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                      accessMode === "invite" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                    }`}
                  >
                    Invite via Email
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {accessMode === "invite"
                    ? "A password setup email will be sent using Runoot template."
                    : "Set credentials now for direct access."}
                </p>
              </div>

              <div>
                <label htmlFor="email" className="label">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="input w-full"
                  placeholder="user@example.com"
                  onChange={(e) => setPreviewEmail(e.target.value)}
                />
              </div>

              {accessMode === "password" && (
                <div>
                  <label htmlFor="password" className="label">Password *</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className="input w-full"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              )}

              <div>
                <label htmlFor="fullName" className="label">Full Name *</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  className="input w-full"
                  placeholder="John Doe"
                  onChange={(e) => setPreviewName(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="userType" className="label">User Type *</label>
                <select id="userType" name="userType" defaultValue="private" className="input w-full">
                  <option value="private">Private Runner</option>
                  <option value="tour_operator">Tour Operator</option>
                </select>
              </div>

              {accessMode === "password" && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="skipConfirmation"
                    name="skipConfirmation"
                    defaultChecked
                    className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor="skipConfirmation" className="text-sm text-gray-700">
                    Skip email confirmation (user can login immediately)
                  </label>
                </div>
              )}
            </>
          )}

          {isAgencyMode && (
            <>
              <p className="text-xs text-gray-500">
                Agency accounts are created by superadmin and always invited by email for password setup.
              </p>
              <div>
                <label htmlFor="email" className="label">Agency Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="input w-full"
                  placeholder="agency@example.com"
                  onChange={(e) => setPreviewEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="agencyCompanyName" className="label">Company Name *</label>
                <input
                  type="text"
                  id="agencyCompanyName"
                  name="agencyCompanyName"
                  className="input w-full"
                  placeholder="Agency Company Name"
                  onChange={(e) => setPreviewName(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This value is stored as display name and company name.
                </p>
              </div>
            </>
          )}

          {isInviteFlow && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Email Preview</p>
              <p className="text-sm text-gray-700"><span className="font-medium">To:</span> {previewEmail || "recipient@example.com"}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Subject:</span> Your Runoot account is ready</p>
              <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                <p>A Runoot admin created your account{previewName ? ` for ${previewName}` : ""}.</p>
                <p className="mt-2 text-xs text-gray-500">Button CTA: Set your password</p>
                <p className="mt-1 text-xs text-gray-500">The setup link is generated automatically on submit.</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <button type="submit" className="btn-primary rounded-full">
              {isMockMode ? "Create Mock User" : isAgencyMode ? "Create Agency & Send Invite" : "Create User"}
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
