import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { requireUser } from "~/lib/session.server";
import { supabase } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction = () => {
  return [{ title: "Settings - runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const fullName = formData.get("fullName");
  const companyName = formData.get("companyName");
  const phone = formData.get("phone");

  if (typeof fullName !== "string") {
    return json({ error: "Invalid form data" }, { status: 400 });
  }

  const updateData: any = {
    full_name: fullName || null,
    phone: (phone as string) || null,
  };

  if (user.user_type === "tour_operator") {
    updateData.company_name = (companyName as string) || null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData as any)
    .eq("id", user.id);

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json({ success: true, message: "Profile updated successfully!" });
}

export default function Settings() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { error: string }
    | { success: boolean; message: string }
    | undefined;

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gray-900">
            Account Settings
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your profile information
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

            {/* Account Info Section */}
            <div>
              <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
                Account Information
              </h2>
              
              <div className="space-y-4">
                {/* Email (readonly) */}
                <div>
                  <label htmlFor="email" className="label">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={user.email}
                    disabled
                    className="input bg-gray-50 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email cannot be changed
                  </p>
                </div>

                {/* User Type (readonly) */}
                <div>
                  <label className="label">Account type</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {user.user_type === "tour_operator"
                      ? "Tour Operator"
                      : "Private Runner"}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Account type cannot be changed
                  </p>
                </div>
              </div>
            </div>

            {/* Personal Info Section */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
                Personal Information
              </h2>

              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label htmlFor="fullName" className="label">
                    Full name *
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

                {/* Company Name (only for tour operators) */}
                {user.user_type === "tour_operator" && (
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
                )}

                {/* Phone */}
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

                {/* Bio */}
                <div>
                  <label htmlFor="bio" className="label">
                    Bio / Description
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={4}
                    className="input"
                    placeholder={
                      user.user_type === "tour_operator"
                        ? "Tell buyers about your company, experience, and services..."
                        : "Tell others about yourself, your running experience..."
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Brief description that will be visible to other users
                  </p>
                </div>

                {/* Country and City */}
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
                      placeholder="Milan"
                    />
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label htmlFor="website" className="label">
                    Website
                  </label>
                  <input
                    id="website"
                    name="website"
                    type="url"
                    className="input"
                    placeholder="https://www.yourwebsite.com"
                  />
                </div>

                {/* Languages */}
                <div>
                  <label htmlFor="languages" className="label">
                    Languages spoken
                  </label>
                  <input
                    id="languages"
                    name="languages"
                    type="text"
                    className="input"
                    placeholder="Italian, English, Spanish"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Separate with commas
                  </p>
                </div>
              </div>
            </div>

            {/* Experience Section */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
                {user.user_type === "tour_operator" ? "Business Information" : "Running Experience"}
              </h2>

              <div className="space-y-4">
                {user.user_type === "tour_operator" ? (
                  <>
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
                        placeholder="Marathon packages, accommodation booking, group tours..."
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="marathonsCompleted" className="label">
                        Marathons completed
                      </label>
                      <input
                        id="marathonsCompleted"
                        name="marathonsCompleted"
                        type="number"
                        min="0"
                        className="input"
                        placeholder="3"
                      />
                    </div>
                    <div>
                      <label htmlFor="favoriteRaces" className="label">
                        Favorite races
                      </label>
                      <textarea
                        id="favoriteRaces"
                        name="favoriteRaces"
                        rows={2}
                        className="input"
                        placeholder="Berlin Marathon, New York Marathon..."
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Social Media Section */}
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
                      placeholder="username"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="facebook" className="label">
                    Facebook
                  </label>
                  <input
                    id="facebook"
                    name="facebook"
                    type="url"
                    className="input"
                    placeholder="https://facebook.com/yourpage"
                  />
                </div>

                <div>
                  <label htmlFor="linkedin" className="label">
                    LinkedIn
                  </label>
                  <input
                    id="linkedin"
                    name="linkedin"
                    type="url"
                    className="input"
                    placeholder="https://linkedin.com/in/yourprofile"
                  />
                </div>
              </div>
            </div>

            {/* Verified Badge Info */}
            <div className="pt-6 border-t border-gray-200">
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
                        Verified Account
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
                    ? "Your account has been verified. Buyers can trust your listings."
                    : "Complete your profile and contact support to verify your account and gain buyer trust."}
                </p>
              </div>
            </div>

            {/* Submit Button */}
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
