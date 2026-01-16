import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { requireUser } from "~/lib/session.server";
import { supabase } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction = () => {
  return [{ title: "My Profile - runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  
  // Redirect tour operators to their profile page
  if (user.user_type === "tour_operator") {
        return redirect("/profile/agency");

  }
  
  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const fullName = formData.get("fullName");
  const phone = formData.get("phone");
  const bio = formData.get("bio");
  const country = formData.get("country");
  const city = formData.get("city");
  const website = formData.get("website");
  const languages = formData.get("languages");
  const marathonsCompleted = formData.get("marathonsCompleted");
  const favoriteRaces = formData.get("favoriteRaces");
  const instagram = formData.get("instagram");
  const facebook = formData.get("facebook");
  const linkedin = formData.get("linkedin");

  if (typeof fullName !== "string" || !fullName) {
    return json({ error: "Full name is required" }, { status: 400 });
  }

  const updateData = {
    full_name: fullName,
    phone: (phone as string) || null,
    // Questi campi dovranno essere aggiunti al database
    // Per ora li ignoriamo finché non aggiungiamo le colonne
  };

  const { error } = await (supabase
  .from("profiles") as any)
  .update(updateData)
  .eq("id", user.id);


  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json({ success: true, message: "Profile updated successfully!" });
}

export default function RunnerProfile() {
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
            Runner Profile
          </h1>
          <p className="mt-2 text-gray-600">
            Manage your personal information and running experience
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
                    Private Runner
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
                Personal Information
              </h2>

              <div className="space-y-4">
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
                    About me
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={4}
                    className="input"
                    placeholder="Tell others about yourself and your running journey..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Brief description visible to other users
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

            {/* Running Experience */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
                Running Experience
              </h2>

              <div className="space-y-4">
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
                    placeholder="https://facebook.com/yourprofile"
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
