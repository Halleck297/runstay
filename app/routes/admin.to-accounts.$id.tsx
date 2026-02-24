import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { useState } from "react";
import { applyProfilePublicIdFilter, getProfilePublicId } from "~/lib/publicIds";
import { requireAdmin, logAdminAction } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction<typeof loader> = ({ data: loaderData }) => {
  const name = loaderData?.account?.company_name || loaderData?.account?.email || "TO Account";
  return [{ title: `${name} - TO Account - Admin - Runoot` }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const accountId = params.id;
  if (!accountId) throw new Response("Account not found", { status: 404 });

  const query = supabaseAdmin
    .from("profiles")
    .select("id, short_id, email, full_name, user_type, company_name, phone, website, country, city")
    .eq("user_type", "tour_operator");
  const { data: account } = await applyProfilePublicIdFilter(query as any, accountId).maybeSingle();

  if (!account) throw new Response("TO account not found", { status: 404 });

  return { account };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const accountId = params.id;
  if (!accountId) return data({ error: "Account not found" }, { status: 404 });

  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const companyName = String(formData.get("companyName") || "").trim();
  const representativeName = String(formData.get("representativeName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const website = String(formData.get("website") || "").trim();
  const country = String(formData.get("country") || "").trim();
  const city = String(formData.get("city") || "").trim();

  if (!companyName || !representativeName || !email) {
    return data({ error: "Company name, representative name, and email are required." }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return data({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const targetQuery = supabaseAdmin
    .from("profiles")
    .select("id, short_id")
    .eq("user_type", "tour_operator");
  const { data: target } = await applyProfilePublicIdFilter(targetQuery as any, accountId).maybeSingle();
  if (!target) return data({ error: "TO account not found" }, { status: 404 });

  const updateData: any = {
    email,
    company_name: companyName,
    full_name: representativeName,
    phone: phone || null,
    website: website || null,
    country: country || null,
    city: city || null,
  };

  const { error } = await (supabaseAdmin as any)
    .from("profiles")
    .update(updateData)
    .eq("id", target.id);

  if (error) {
    return data({ error: error.message }, { status: 500 });
  }

  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
    email,
    user_metadata: {
      full_name: representativeName,
      user_type: "tour_operator",
      company_name: companyName,
    },
  });
  if (authUpdateError) {
    return data({ error: `Auth email update failed: ${authUpdateError.message}` }, { status: 500 });
  }

  await logAdminAction((admin as any).id, "to_account_updated", {
    targetUserId: target.id,
    details: updateData,
  });

  return redirect(`/admin/to-accounts/${getProfilePublicId(target as any)}?saved=1`);
}

export default function AdminEditToAccount() {
  const { account } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [emailUnlocked, setEmailUnlocked] = useState(false);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/admin/to-accounts" className="rounded-full p-2 transition-colors hover:bg-gray-200">
          <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 md:text-3xl">Edit TO Account</h1>
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
              <input name="companyName" type="text" defaultValue={account.company_name || ""} className="input w-full" required />
            </div>
            <div>
              <label className="label">Representative full name *</label>
              <input name="representativeName" type="text" defaultValue={account.full_name || ""} className="input w-full" required />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">Email</label>
                <button
                  type="button"
                  onClick={() => setEmailUnlocked((prev) => !prev)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    emailUnlocked
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {emailUnlocked ? "Lock email" : "Unlock email editing"}
                </button>
              </div>
              <input
                name="email"
                type="email"
                defaultValue={account.email}
                className={`input w-full ${emailUnlocked ? "" : "bg-gray-50 text-gray-500"}`}
                readOnly={!emailUnlocked}
                required
              />
              {!emailUnlocked && (
                <p className="mt-1 text-xs text-gray-500">Email is locked to prevent accidental changes.</p>
              )}
            </div>
            <div>
              <label className="label">Phone</label>
              <input name="phone" type="text" defaultValue={account.phone || ""} className="input w-full" />
            </div>
            <div>
              <label className="label">Website</label>
              <input name="website" type="url" defaultValue={account.website || ""} className="input w-full" />
            </div>
            <div>
              <label className="label">Country</label>
              <input name="country" type="text" defaultValue={account.country || ""} className="input w-full" />
            </div>
            <div>
              <label className="label">City</label>
              <input name="city" type="text" defaultValue={account.city || ""} className="input w-full" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary rounded-full px-5 py-2.5 text-sm">
              Save changes
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
