import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData, useLocation, useNavigation } from "react-router";
import { ToProfileSidebar, type ToProfileSidebarItem } from "~/components/ToProfileSidebar";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getPublicDisplayName } from "~/lib/user-display";

export const meta: MetaFunction = () => {
  return [{ title: "Business details - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") return redirect("/listings");
  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") return data({ error: "Unauthorized" }, { status: 403 });

  const formData = await request.formData();
  const bio = String(formData.get("bio") || "").trim();
  const languagesSpoken = String(formData.get("languages_spoken") || "").trim();
  const yearsExperience = String(formData.get("yearsExperience") || "").trim();
  const instagram = String(formData.get("instagram") || "").trim().replace(/^@+/, "");
  const facebook = String(formData.get("facebook") || "").trim();
  const linkedin = String(formData.get("linkedin") || "").trim();

  if (languagesSpoken.length > 200) {
    return data({ error: "Languages cannot exceed 200 characters." }, { status: 400 });
  }

  if (bio.length > 600) {
    return data({ error: "About us cannot exceed 600 characters." }, { status: 400 });
  }

  if (instagram.length > 30) {
    return data({ error: "Instagram username cannot exceed 30 characters." }, { status: 400 });
  }

  if (instagram && !/^[a-zA-Z0-9._]+$/.test(instagram)) {
    return data({ error: "Instagram username contains invalid characters." }, { status: 400 });
  }

  let yearsExperienceValue: number | null = null;
  if (yearsExperience) {
    yearsExperienceValue = Number.parseInt(yearsExperience, 10);
    if (!Number.isFinite(yearsExperienceValue) || Number.isNaN(yearsExperienceValue) || yearsExperienceValue < 0 || yearsExperienceValue > 200) {
      return data({ error: "Years in business must be a number between 0 and 200." }, { status: 400 });
    }
  }

  const normalizeUrl = (value: string, fieldLabel: string) => {
    if (!value) return null;
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const parsed = new URL(withScheme);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
      return parsed.toString();
    } catch {
      throw new Error(`${fieldLabel} must be a valid URL (http/https).`);
    }
  };

  let facebookUrl: string | null = null;
  let linkedinUrl: string | null = null;
  try {
    facebookUrl = normalizeUrl(facebook, "Facebook URL");
    linkedinUrl = normalizeUrl(linkedin, "LinkedIn URL");
  } catch (error) {
    return data({ error: error instanceof Error ? error.message : "Invalid URL value." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      bio: bio || null,
      languages_spoken: languagesSpoken || null,
      years_experience: yearsExperienceValue,
      instagram: instagram || null,
      facebook: facebookUrl,
      linkedin: linkedinUrl,
    })
    .eq("id", user.id);

  if (error) return data({ error: error.message }, { status: 400 });
  return data({ success: true });
}

const sidebarNavItems: ToProfileSidebarItem[] = [
  { label: "Company info", href: "/to-panel/profile", icon: "user" },
  { label: "Business details", href: "/to-panel/profile/experience", icon: "running" },
] as const;

export default function ToProfileBusiness() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { error?: string; success?: boolean } | undefined;
  const location = useLocation();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting" && navigation.formMethod?.toLowerCase() === "post";
  const publicName = getPublicDisplayName(user);
  const stripUrlProtocol = (value: string | null | undefined) => (value ? value.replace(/^https?:\/\//i, "") : "");

  return (
    <div className="min-h-screen bg-slate-50 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.14)_1px,transparent_0)] bg-[size:18px_18px]">
      <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 md:py-8 md:pb-8 lg:px-8">
        <div className="flex flex-col gap-6 md:gap-8 lg:flex-row">
          <ToProfileSidebar
            user={user}
            publicName={publicName}
            items={sidebarNavItems}
            locationPathname={location.pathname}
          />

          <main className="min-w-0 flex-1">
            <div className="mb-6 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
              <h1 className="font-display text-2xl font-bold text-gray-900">Business details</h1>
              <p className="mt-1 text-gray-600">Update your business information.</p>
            </div>

            {actionData?.success && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-success-50 p-4 text-sm text-success-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Business details updated.
              </div>
            )}
            {actionData?.error && (
              <div className="mb-6 flex items-center gap-2 rounded-xl bg-alert-50 p-4 text-sm text-alert-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {actionData.error}
              </div>
            )}

            <Form method="post" className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">Languages spoken</label>
                  <input name="languages_spoken" type="text" defaultValue={(user as any).languages_spoken || ""} className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0" placeholder="English, Italian" />
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">Years in business</label>
                  <input name="yearsExperience" type="number" min="0" defaultValue={(user as any).years_experience || ""} className="mt-1 block w-full border-0 bg-transparent p-0 font-medium text-gray-900 focus:outline-none focus:ring-0" placeholder="5" />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">Instagram</label>
                  <div className="mt-1 flex items-center">
                    <span className="mr-1 text-gray-400">@</span>
                    <input name="instagram" type="text" defaultValue={(user as any).instagram || ""} className="block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0" placeholder="yourhandle" />
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:p-5">
                  <label className="text-sm font-medium text-gray-500">Facebook</label>
                  <input name="facebook" type="text" defaultValue={stripUrlProtocol((user as any).facebook)} className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0" placeholder="facebook.com/yourcompany" />
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus-within:border-brand-300 focus-within:shadow-md md:col-span-2 md:p-5">
                  <label className="text-sm font-medium text-gray-500">LinkedIn</label>
                  <input name="linkedin" type="text" defaultValue={stripUrlProtocol((user as any).linkedin)} className="mt-1 block w-full border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0" placeholder="linkedin.com/company/yourcompany" />
                </div>
                <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm focus-within:border-brand-300 focus-within:shadow-md md:col-span-2 md:p-5">
                  <label className="text-sm font-medium text-gray-500">About us</label>
                  <textarea
                    name="bio"
                    rows={3}
                    defaultValue={(user as any).bio || ""}
                    className="mt-1 block w-full resize-none border-0 bg-transparent p-0 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-0"
                    placeholder=""
                  />
                  <p className="mt-2 text-xs text-gray-400">Brief description visible to other users.</p>
                </div>
              </div>

              <div className="hidden md:block">
                <button type="submit" className="btn-primary rounded-full px-8 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting}>
                  {isSubmitting ? "Save changes..." : "Save changes"}
                </button>
              </div>

              <div className="fixed inset-x-0 bottom-20 z-30 border-t border-gray-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
                <button type="submit" className="btn-primary w-full rounded-full disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting}>
                  {isSubmitting ? "Save changes..." : "Save changes"}
                </button>
              </div>
            </Form>
          </main>
        </div>
      </div>
    </div>
  );
}
