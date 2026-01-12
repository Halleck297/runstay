import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData } from "@remix-run/react";
import { supabase } from "~/lib/supabase.server";
import { createUserSession, getUserId } from "~/lib/session.server";

export const meta: MetaFunction = () => {
  return [{ title: "Sign Up - RunStay Exchange" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) return redirect("/dashboard");
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const fullName = formData.get("fullName");
  const userType = formData.get("userType");
  const companyName = formData.get("companyName");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof fullName !== "string" ||
    typeof userType !== "string"
  ) {
    return json({ error: "Invalid form submission" }, { status: 400 });
  }

  if (!email || !password || !fullName || !userType) {
    return json({ error: "All fields are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    return json({ error: authError.message }, { status: 400 });
  }

  if (!authData.user || !authData.session) {
    return json(
      { error: "Registration failed. Please try again." },
      { status: 400 }
    );
  }

  // Create profile
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    user_type: userType as "tour_operator" | "private",
    company_name: userType === "tour_operator" ? (companyName as string) : null,
    is_verified: false,
  });

  if (profileError) {
    console.error("Profile creation error:", profileError);
    // Auth user created but profile failed - still log them in
  }

  return createUserSession(
    authData.user.id,
    authData.session.access_token,
    authData.session.refresh_token,
    "/dashboard"
  );
}

export default function Register() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <svg
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
        </Link>
        <h2 className="mt-6 text-center font-display text-3xl font-bold tracking-tight text-gray-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-500"
          >
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10 border border-gray-200">
          <Form method="post" className="space-y-6">
            {actionData?.error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {actionData.error}
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="label">
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                className="input"
              />
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="input"
              />
              <p className="mt-1 text-xs text-gray-500">
                At least 8 characters
              </p>
            </div>

            <div>
              <label className="label">I am a</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500">
                  <input
                    type="radio"
                    name="userType"
                    value="tour_operator"
                    className="sr-only"
                    defaultChecked
                  />
                  <span className="flex flex-1">
                    <span className="flex flex-col">
                      <span className="block text-sm font-medium text-gray-900">
                        Tour Operator
                      </span>
                      <span className="mt-1 text-xs text-gray-500">
                        I sell marathon packages
                      </span>
                    </span>
                  </span>
                </label>
                <label className="relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500">
                  <input
                    type="radio"
                    name="userType"
                    value="private"
                    className="sr-only"
                  />
                  <span className="flex flex-1">
                    <span className="flex flex-col">
                      <span className="block text-sm font-medium text-gray-900">
                        Private Runner
                      </span>
                      <span className="mt-1 text-xs text-gray-500">
                        I'm an individual runner
                      </span>
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div id="companyField">
              <label htmlFor="companyName" className="label">
                Company name{" "}
                <span className="text-gray-400">(Tour Operators)</span>
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                className="input"
              />
            </div>

            <div>
              <button type="submit" className="btn-primary w-full">
                Create account
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              By signing up, you agree to our Terms of Service and Privacy
              Policy.
            </p>
          </Form>
        </div>
      </div>
    </div>
  );
}
