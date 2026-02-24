import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { data, Form, Link, redirect, useActionData } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";

export const meta: MetaFunction = () => {
  return [{ title: "Create TO Account - Admin - Runoot" }];
};

function getActionLinkFromLinkResponse(linkData: any): string | null {
  return (
    linkData?.properties?.action_link ||
    linkData?.action_link ||
    linkData?.data?.properties?.action_link ||
    linkData?.data?.action_link ||
    null
  );
}

function randomTempPassword() {
  return `Runoot!${Math.random().toString(36).slice(2, 10)}A1`;
}

async function createUserWithInviteEmail(args: {
  email: string;
  representativeName: string;
  companyName: string;
  appUrl: string;
}) {
  const tempPassword = randomTempPassword();

  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: args.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: args.representativeName,
      user_type: "tour_operator",
      company_name: args.companyName,
    },
  });

  if (createError || !createData?.user?.id) {
    return { error: createError?.message || "Failed to create TO user", userId: null as string | null };
  }

  const redirectTo = `${args.appUrl}/reset-password`;
  const { data: linkData, error: linkError } = await (supabaseAdmin.auth.admin as any).generateLink({
    type: "recovery",
    email: args.email,
    options: { redirectTo },
  });

  const actionLink = getActionLinkFromLinkResponse(linkData);
  if (linkError || !actionLink) {
    return { error: linkError?.message || "Could not generate setup link", userId: createData.user.id };
  }

  const emailResult = await sendTemplatedEmail({
    to: args.email,
    templateId: "account_setup",
    locale: null,
    payload: { setupLink: actionLink },
  });

  if (!emailResult.ok) {
    return { error: emailResult.error || "Could not send setup email", userId: createData.user.id };
  }

  return { error: null as string | null, userId: createData.user.id };
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const companyName = String(formData.get("companyName") || "").trim();
  const representativeName = String(formData.get("representativeName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const website = String(formData.get("website") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const city = String(formData.get("city") || "").trim();

  if (!email || !companyName || !representativeName || !phone || !website || !country || !city) {
    return data(
      { error: "All fields are required: company name, representative name, email, phone, website, country, and city." },
      { status: 400 }
    );
  }

  const inviteResult = await createUserWithInviteEmail({
    email,
    representativeName,
    companyName,
    appUrl,
  });

  if (inviteResult.error || !inviteResult.userId) {
    return data({ error: inviteResult.error || "Could not create TO account." }, { status: 400 });
  }

  const profileData: any = {
    id: inviteResult.userId,
    email,
    full_name: representativeName,
    user_type: "tour_operator",
    company_name: companyName,
    phone: phone || null,
    website: website || null,
    country: country || null,
    city: city || null,
    preferred_language: "en",
    created_by_admin: (admin as any).id,
  };

  const { error: profileError } = await (supabaseAdmin as any)
    .from("profiles")
    .upsert(profileData, { onConflict: "id" });

  if (profileError) {
    return data({ error: `Profile creation failed: ${profileError.message}` }, { status: 500 });
  }

  await logAdminAction((admin as any).id, "to_account_created", {
    targetUserId: inviteResult.userId,
    details: { email, companyName, representativeName },
  });

  return redirect("/admin/to-accounts");
}

export default function AdminCreateToAccount() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/admin/to-accounts" className="rounded-full p-2 transition-colors hover:bg-gray-200">
          <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 md:text-3xl">Create TO Account</h1>
          <p className="mt-1 text-gray-500">Add verified tour operator data and send password setup email.</p>
        </div>
      </div>

      {actionData && "error" in actionData && actionData.error && (
        <div className="mb-6 rounded-lg border border-alert-200 bg-alert-50 p-4 text-sm text-alert-700">
          {actionData.error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <Form method="post" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label">Company name *</label>
              <input name="companyName" type="text" className="input w-full" required />
            </div>
            <div>
              <label className="label">Representative full name *</label>
              <input name="representativeName" type="text" className="input w-full" required />
            </div>
            <div>
              <label className="label">Email *</label>
              <input name="email" type="email" className="input w-full" required />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input name="phone" type="text" className="input w-full" required />
            </div>
            <div>
              <label className="label">Website *</label>
              <input name="website" type="url" className="input w-full" placeholder="https://example.com" required />
            </div>
            <div>
              <label className="label">Country *</label>
              <input name="country" type="text" className="input w-full" required />
            </div>
            <div>
              <label className="label">City *</label>
              <input name="city" type="text" className="input w-full" required />
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
            After creation, the TO user will receive an email with the link to set password.
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary rounded-full px-5 py-2.5 text-sm">
              Create TO Account
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
