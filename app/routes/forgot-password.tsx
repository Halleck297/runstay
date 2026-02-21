import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, Link, useActionData } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { supabase } from "~/lib/supabase.server";

type ForgotPasswordActionData = {
  success?: boolean;
  errorKey?: "invalid_email" | "reset_link_not_allowed" | "unable_send";
  redirectTo?: string;
  detail?: string;
};

export const meta: MetaFunction = () => {
  return [{ title: "Forgot Password - Runoot" }];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const rawEmail = (formData.get("email") as string | null) || "";
  const email = rawEmail
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”‘’"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailPattern.test(email)) {
    return data<ForgotPasswordActionData>({ errorKey: "invalid_email" }, { status: 400 });
  }

  const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
  const redirectTo = `${appUrl}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error("forgot-password: resetPasswordForEmail failed", {
      message: error.message,
      code: (error as any).code,
      status: (error as any).status,
      redirectTo,
    });

    const lowerMessage = (error.message || "").toLowerCase();
    if (lowerMessage.includes("redirect") || lowerMessage.includes("not allowed")) {
      return data<ForgotPasswordActionData>({
        errorKey: "reset_link_not_allowed",
        redirectTo,
      }, { status: 400 });
    }

    return data<ForgotPasswordActionData>({
      errorKey: "unable_send",
      detail: error.message,
    }, { status: 400 });
  }

  return data<ForgotPasswordActionData>({ success: true });
}

export default function ForgotPassword() {
  const actionData = useActionData<typeof action>();
  const { t } = useI18n();

  return (
    <div className="flex min-h-full flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center font-display text-3xl font-bold text-gray-900">{t("auth.reset_password_title")}</h1>
        <p className="mt-2 text-center text-sm text-gray-600">{t("auth.reset_password_subtitle")}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 shadow-sm sm:px-10">
          {actionData?.success ? (
            <div className="rounded-lg border border-success-200 bg-success-50 p-4 text-sm text-success-700">
              {t("auth.reset_email_sent")}
            </div>
          ) : (
            <Form method="post" className="space-y-6">
              {actionData?.errorKey && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {actionData.errorKey === "invalid_email" && t("auth.invalid_email")}
                  {actionData.errorKey === "reset_link_not_allowed" && (
                    <>
                      {t("auth.reset_link_not_allowed")} {actionData.redirectTo}
                    </>
                  )}
                  {actionData.errorKey === "unable_send" && (
                    <>
                      {t("auth.unable_send_reset")}
                      {actionData.detail ? ` (${actionData.detail})` : ""}
                    </>
                  )}
                </div>
              )}
              <div>
                <label htmlFor="email" className="label">{t("auth.email")}</label>
                <input id="email" name="email" type="email" autoComplete="email" required className="input" />
              </div>
              <button type="submit" className="btn-primary w-full">
                {t("auth.send_reset_link")}
              </button>
            </Form>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              {t("auth.back_to_login")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
