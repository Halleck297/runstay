import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, Link, useActionData } from "react-router";
import { supabase } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Forgot Password - Runoot" }];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = (formData.get("email") as string | null)?.trim() || "";

  if (!email || !email.includes("@")) {
    return data({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const redirectTo = `${origin}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return data({ error: "Unable to send reset email right now. Please try again." }, { status: 400 });
  }

  return data({
    success: true,
    message: "If an account exists for this email, you'll receive a password reset link shortly.",
  });
}

export default function ForgotPassword() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center font-display text-3xl font-bold text-gray-900">
          Reset your password
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10 border border-gray-200">
          {actionData && "success" in actionData && actionData.success ? (
            <div className="rounded-lg bg-success-50 border border-success-200 p-4 text-sm text-success-700">
              {actionData.message}
            </div>
          ) : (
            <Form method="post" className="space-y-6">
              {actionData && "error" in actionData && actionData.error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                  {actionData.error}
                </div>
              )}
              <div>
                <label htmlFor="email" className="label">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input"
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Send reset link
              </button>
            </Form>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
