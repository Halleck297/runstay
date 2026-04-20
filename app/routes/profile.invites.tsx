import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { useI18n } from "~/hooks/useI18n";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { isAmbassador } from "~/lib/user-access";
import { isValidEmail } from "~/lib/validation";
import { generateInviteToken } from "~/lib/referral-code.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { getAppUrl } from "~/lib/app-url.server";
import { translate } from "~/lib/i18n";
import type { SupportedLocale } from "~/lib/locale";
import { resolveLocaleForRequest } from "~/lib/locale";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const locale = ((data as any)?.locale as SupportedLocale | undefined) || "en";
  return [{ title: translate(locale, "ambassador.invites.meta_title") }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isAmbassador(user)) return redirect("/profile");

  const { data: invites } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id, email, status, created_at, claimed_at")
    .eq("team_leader_id", user.id)
    .eq("invite_type", "ambassador_invite")
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    user,
    invites: invites || [],
    locale: resolveLocaleForRequest(request, user.id),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (!isAmbassador(user)) return data({ error: "Unauthorized" }, { status: 403 });

  const formData = await request.formData();
  const rawEmail = String(formData.get("inviteEmail") || "").trim().toLowerCase();

  if (!rawEmail || !isValidEmail(rawEmail)) {
    return data({ inviteError: "invalid_email" }, { status: 400 });
  }

  const existing = await (supabaseAdmin.from("referral_invites") as any)
    .select("id")
    .eq("team_leader_id", user.id)
    .eq("invite_type", "ambassador_invite")
    .ilike("email", rawEmail)
    .maybeSingle();

  if (existing.data) {
    return data({ inviteError: "already_invited" }, { status: 400 });
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await (supabaseAdmin.from("referral_invites") as any).insert({
    team_leader_id: user.id,
    email: rawEmail,
    invite_type: "ambassador_invite",
    status: "pending",
    token,
    expires_at: expiresAt,
  });

  const appUrl = getAppUrl(request);
  await sendTemplatedEmail({
    to: rawEmail,
    templateId: "ambassador_invite",
    locale: null,
    payload: {
      inviterName: user.full_name || "Ambassador",
      referralLink: `${appUrl}/join/${token}`,
    },
  });

  return data({ inviteSuccess: true });
}

export default function AmbassadorInvites() {
  const { user, invites } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { inviteError: string }
    | { inviteSuccess: true }
    | undefined;
  const navigation = useNavigation();
  const { t } = useI18n();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-white md:bg-[#ECF4FE] md:bg-[radial-gradient(circle_at_1px_1px,rgba(12,120,243,0.08)_1px,transparent_0)] md:bg-[size:18px_18px] flex flex-col">
      <Header user={user} />

      <div className="mx-auto w-full max-w-2xl px-4 pt-16 pb-28 sm:px-6 md:pt-20 md:pb-12 flex-1">
        <div className="md:rounded-3xl md:border md:border-brand-300 md:bg-white md:p-8">

          <div className="mb-8 text-center">
            <h1 className="inline-block border-b-2 border-accent-500 pb-0.5 font-display text-2xl font-bold text-gray-900">
              {t("ambassador.invites.title")}
            </h1>
            <p className="mt-2 text-sm text-gray-500">{t("ambassador.invites.description")}</p>
          </div>

          {actionData && "inviteSuccess" in actionData && (
            <div className="mb-6 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t("ambassador.invites.success")}
            </div>
          )}

          {actionData && "inviteError" in actionData && (
            <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {actionData.inviteError === "already_invited"
                ? t("ambassador.invites.error.already_invited")
                : t("ambassador.invites.error.invalid_email")}
            </div>
          )}

          <Form method="post" className="mb-8 flex gap-2">
            <input
              name="inviteEmail"
              type="email"
              placeholder={t("ambassador.invites.form.placeholder")}
              className="flex-1 rounded-xl border border-brand-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              required
              disabled={isSubmitting}
              key={actionData && "inviteSuccess" in actionData ? "reset" : "active"}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm whitespace-nowrap"
            >
              {t("ambassador.invites.form.send")}
            </button>
          </Form>

          {invites.length === 0 ? (
            <p className="text-center text-sm text-slate-400 italic py-8">{t("ambassador.invites.empty")}</p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-2xl border border-brand-200 overflow-hidden">
              {(invites as any[]).map((invite) => (
                <div key={invite.id} className="flex items-center justify-between px-4 py-3 text-sm bg-white">
                  <span className="text-slate-800 font-medium truncate mr-3">{invite.email}</span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      invite.status === "accepted"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {invite.status === "accepted"
                      ? t("ambassador.invites.status.accepted")
                      : t("ambassador.invites.status.pending")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <FooterLight />
    </div>
  );
}
