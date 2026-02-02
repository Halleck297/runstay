import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { data } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabase } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction = () => {
  return [{ title: "Company Profile - runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  
  // Redirect private runners to their profile page
  if ((user.user_type as string) === "private") {
    return redirect("/profile/runner");
  }
  
  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const fullName = formData.get("fullName");
  const companyName = formData.get("companyName");
  const phone = formData.get("phone");
  const bio = formData.get("bio");
  const country = formData.get("country");
  const city = formData.get("city");
  const website = formData.get("website");
  const languages = formData.get("languages");
  const yearsExperience = formData.get("yearsExperience");
  const specialties = formData.get("specialties");
  const instagram = formData.get("instagram");
  const facebook = formData.get("facebook");
  const linkedin = formData.get("linkedin");

  if (typeof fullName !== "string" || !fullName) {
    return data({ error: "Full name is required" }, { status: 400 });
  }

  if (typeof companyName !== "string" || !companyName) {
    return data({ error: "Company name is required" }, { status: 400 });
  }

  const updateData: any = {
    full_name: fullName,
    company_name: companyName,
    phone: (phone as string) || null,
    bio: (bio as string) || null,
    country: (country as string) || null,
    city: (city as string) || null,
    website: (website as string) || null,
    languages: (languages as string) || null,
    years_experience: yearsExperience ? parseInt(yearsExperience as string) : null,
    specialties: (specialties as string) || null,
    instagram: (instagram as string) || null,
    facebook: (facebook as string) || null,
    linkedin: (linkedin as string) || null,
  };

  const { error } = await (supabase
  .from("profiles") as any)
  .update(updateData)
  .eq("id", user.id);


  if (error) {
    return data({ error: error.message }, { status: 400 });
  }

  return data({ success: true, message: "Profile updated successfully!" });
}

export default function OperatorProfile() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error: string }
    | { success: boolean; message: string }
    | undefined;

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-3xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8">
        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gray-900">
            Company Profile
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your business information and build trust with buyers
          </p>
        </div>

        <div className="card p-6">
          <Form method="post" className="space-y-6">
            {actionData && "success" in actionData && actionData.success && (
              <div className="rounded-lg bg-success-50 p-4 text-sm text-success-700">
                {"message" in actionData ? actionData.message : ""}
              </div>
            )}

            {actionData && "error" in actionData && actionData.error && (
              <div className="rounded-lg bg-alert-50 p-4 text-sm text-alert-700">
                {actionData.error}
              </div>
            )}

            {/* Account Info */}
            <div>
              <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
                Account Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="label">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={user.email}
                    disabled
                    className="input bg-gray-50 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <label className="label">Account type</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    Tour Operator
                  </div>
                </div>

                {/* Verified Badge */}
                <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
                  <div className="flex items-center gap-2">
                    {user.is_verified ? (
                      <>
                        <svg
                          className="h-5 w-5 text-brand-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm font-medium text-gray-900">
                          Verified Company
                        </span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <span className="text-sm font-medium text-gray-900">
                          Not Verified
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    {user.is_verified
                      ? "Your company has been verified. Buyers can trust your listings."
                      : "Complete your profile and contact support to verify your company and gain buyer trust."}
                  </p>
                </div>
              </div>
            </div>

            {/* Company Info */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
                Company Information
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="companyName" className="label">
                    Company name *
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    defaultValue={user.company_name || ""}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="fullName" className="label">
                    Contact person *
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    defaultValue={user.full_name || ""}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="label">
                    Phone number
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={user.phone || ""}
                    className="input"
                    placeholder="+39 123 456 7890"
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="label">
                    Company description
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={4}
                    className="input"
                    defaultValue={user.bio || ""}
                    placeholder="Tell buyers about your company, experience, and services..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Brief description visible to potential buyers
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="country" className="label">
                      Country
                    </label>
                    <input
                      id="country"
                      name="country"
                      type="text"
                      className="input"
                      defaultValue={user.country || ""}
                      placeholder="Italy"
                    />
                  </div>
                  <div>
                    <label htmlFor="city" className="label">
                      City
                    </label>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      className="input"
                      defaultValue={user.city || ""}
                      placeholder="Milan"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="website" className="label">
                    Company website
                  </label>
                  <input
                    id="website"
                    name="website"
                    type="url"
                    className="input"
                    defaultValue={user.website || ""}
                    placeholder="https://www.yourcompany.com"
                  />
                </div>

                <div>
                  <label htmlFor="languages" className="label">
                    Languages spoken
                  </label>
                  <input
                    id="languages"
                    name="languages"
                    type="text"
                    className="input"
                    defaultValue={user.languages || ""}
                    placeholder="Italian, English, Spanish"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Separate with commas
                  </p>
                </div>
              </div>
            </div>

            {/* Business Details */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
                Business Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="yearsExperience" className="label">
                    Years in business
                  </label>
                  <input
                    id="yearsExperience"
                    name="yearsExperience"
                    type="number"
                    min="0"
                    className="input"
                    defaultValue={user.years_experience || ""}
                    placeholder="5"
                  />
                </div>

                <div>
                  <label htmlFor="specialties" className="label">
                    Specialties / Services
                  </label>
                  <textarea
                    id="specialties"
                    name="specialties"
                    rows={3}
                    className="input"
                    defaultValue={user.specialties || ""}
                    placeholder="Marathon packages, accommodation booking, group tours, race registration assistance..."
                  />
                </div>
              </div>
            </div>

            {/* Social Media */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
                Social Media
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="instagram" className="label">
                    Instagram
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                      @
                    </span>
                    <input
                      id="instagram"
                      name="instagram"
                      type="text"
                      className="input pl-8"
                      defaultValue={user.instagram || ""}
                      placeholder="companyname"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="facebook" className="label">
                    Facebook Page
                  </label>
                  <input
                    id="facebook"
                    name="facebook"
                    type="url"
                    className="input"
                    defaultValue={user.facebook || ""}
                    placeholder="https://facebook.com/yourcompany"
                  />
                </div>

                <div>
                  <label htmlFor="linkedin" className="label">
                    LinkedIn Company Page
                  </label>
                  <input
                    id="linkedin"
                    name="linkedin"
                    type="url"
                    className="input"
                    defaultValue={user.linkedin || ""}
                    placeholder="https://linkedin.com/company/yourcompany"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button type="submit" className="btn-primary">
                Save Changes
              </button>
              <a href="/dashboard" className="btn-secondary">
                Cancel
              </a>
            </div>
          </Form>
        </div>
      </main>
    </div>
  );
}
