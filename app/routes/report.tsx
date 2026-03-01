import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { Header } from "~/components/Header";
import { useI18n } from "~/hooks/useI18n";
import { resolveLocaleForRequest, localizeListing } from "~/lib/locale";
import { applyListingDisplayCurrency, getCurrencyForCountry } from "~/lib/currency";
import type { TranslationKey } from "~/lib/i18n";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Report - Runoot" }];
};

type ReportActionData =
  | { success: true }
  | { errorKey: "select_reason" | "description_min" | "failed_submit" | "login_required" };

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);
  const viewerCurrency = getCurrencyForCountry((user as any)?.country || null);
  const url = new URL(request.url);

  const type = url.searchParams.get("type") || "other";
  const reportedId = url.searchParams.get("id");
  const from = url.searchParams.get("from");

  let reportedUser: { id: string; full_name: string | null; company_name: string | null } | null = null;
  if (type === "user" && reportedId) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, company_name")
      .eq("id", reportedId)
      .single();
    reportedUser = data;
  }

  let reportedListing: { id: string; title: string } | null = null;
  if (type === "listing" && reportedId) {
    const { data } = await supabaseAdmin
      .from("listings")
      .select("id, title, title_i18n")
      .eq("id", reportedId)
      .single();
    reportedListing = data ? applyListingDisplayCurrency(localizeListing(data as any, locale), viewerCurrency) : null;
  }

  return { user, type, reportedUser, reportedListing, from };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getUser(request);
  const formData = await request.formData();

  const reportType = String(formData.get("report_type") || "other");
  const reason = String(formData.get("reason") || "");
  const description = String(formData.get("description") || "");
  const reportedUserId = formData.get("reported_user_id") as string | null;
  const reportedListingId = formData.get("reported_listing_id") as string | null;

  if (!reason.trim()) {
    return data<ReportActionData>({ errorKey: "select_reason" }, { status: 400 });
  }

  if (description.trim().length < 10) {
    return data<ReportActionData>({ errorKey: "description_min" }, { status: 400 });
  }

  if (!user) {
    return data<ReportActionData>({ errorKey: "login_required" }, { status: 401 });
  }

  const { error } = await supabaseAdmin.from("reports").insert({
    reporter_id: (user as any).id,
    report_type: reportType,
    reason,
    description: description.trim(),
    reported_user_id: reportedUserId || null,
    reported_listing_id: reportedListingId || null,
  } as any);

  if (error) {
    console.error("Report error:", error);
    return data<ReportActionData>({ errorKey: "failed_submit" }, { status: 500 });
  }

  return data<ReportActionData>({ success: true });
}

export default function Report() {
  const { user, type, reportedUser, reportedListing, from } = useLoaderData<typeof loader>() as {
    user: any;
    type: string;
    reportedUser: { id: string; full_name: string | null; company_name: string | null } | null;
    reportedListing: { id: string; title: string } | null;
    from: string | null;
  };
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const { t } = useI18n();

  const isSubmitting = navigation.state === "submitting";

  const reasonOptions: Record<string, Array<{ value: string; labelKey: TranslationKey }>> = {
    user: [
      { value: "spam", labelKey: "report.reason.user.spam" },
      { value: "harassment", labelKey: "report.reason.user.harassment" },
      { value: "scam", labelKey: "report.reason.user.scam" },
      { value: "inappropriate", labelKey: "report.reason.user.inappropriate" },
      { value: "other", labelKey: "report.reason.other" },
    ],
    listing: [
      { value: "fake", labelKey: "report.reason.listing.fake" },
      { value: "scam", labelKey: "report.reason.listing.scam" },
      { value: "duplicate", labelKey: "report.reason.listing.duplicate" },
      { value: "inappropriate", labelKey: "report.reason.listing.inappropriate" },
      { value: "other", labelKey: "report.reason.other" },
    ],
    bug: [
      { value: "ui", labelKey: "report.reason.bug.ui" },
      { value: "functionality", labelKey: "report.reason.bug.functionality" },
      { value: "performance", labelKey: "report.reason.bug.performance" },
      { value: "other", labelKey: "report.reason.other" },
    ],
    other: [
      { value: "feedback", labelKey: "report.reason.other.feedback" },
      { value: "feature", labelKey: "report.reason.other.feature" },
      { value: "question", labelKey: "report.reason.other.question" },
      { value: "other", labelKey: "report.reason.other" },
    ],
  };

  const currentReasons = reasonOptions[type] || reasonOptions.other;

  const titleMap: Record<string, TranslationKey> = {
    user: "report.title.user",
    listing: "report.title.listing",
    bug: "report.title.bug",
    other: "report.title.other",
  };

  return (
    <div className="min-h-full bg-[#ECF4FE]">
      <Header user={user} />

      <main className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8 lg:px-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gray-900">{t(titleMap[type] || "report.title.other")}</h1>
          <p className="mt-2 text-gray-600">{t("report.subtitle")}</p>
        </div>

        {actionData && "success" in actionData ? (
          <div className="card p-8 text-center">
            <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">{t("report.success.title")}</h2>
            <p className="mt-2 text-gray-600">{t("report.success.message")}</p>
            {from === "conversation" ? (
              <a href="/messages" className="btn-primary mt-6 inline-block">{t("report.back_messages")}</a>
            ) : (
              <a href="/" className="btn-primary mt-6 inline-block">{t("report.back_home")}</a>
            )}
          </div>
        ) : (
          <div className="card p-6">
            {actionData && "errorKey" in actionData && (
              <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {actionData.errorKey === "select_reason" && t("report.error.select_reason")}
                {actionData.errorKey === "description_min" && t("report.error.description_min")}
                {actionData.errorKey === "failed_submit" && t("report.error.failed_submit")}
                {actionData.errorKey === "login_required" && t("report.error.login_required")}
              </div>
            )}

            {reportedUser && (
              <div className="mb-6 rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">{t("report.reporting_user")}</p>
                <p className="font-medium text-gray-900">{reportedUser.company_name || reportedUser.full_name}</p>
              </div>
            )}

            {reportedListing && (
              <div className="mb-6 rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">{t("report.reporting_listing")}</p>
                <p className="font-medium text-gray-900">{reportedListing.title}</p>
              </div>
            )}

            <Form method="post" className="space-y-6">
              <input type="hidden" name="report_type" value={type} />
              {reportedUser && <input type="hidden" name="reported_user_id" value={reportedUser.id} />}
              {reportedListing && <input type="hidden" name="reported_listing_id" value={reportedListing.id} />}

              {!searchParams.get("type") && (
                <div>
                  <label className="label">{t("report.help_with")}</label>
                  <select name="report_type" className="input">
                    <option value="other">{t("report.type.other")}</option>
                    <option value="bug">{t("report.type.bug")}</option>
                    <option value="user">{t("report.type.user")}</option>
                    <option value="listing">{t("report.type.listing")}</option>
                  </select>
                </div>
              )}

              <div>
                <label className="label">{t("report.reason_label")}</label>
                <select name="reason" className="input" required>
                  <option value="">{t("report.reason_placeholder")}</option>
                  {currentReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {t(reason.labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t("report.description_label")}</label>
                <textarea
                  name="description"
                  rows={5}
                  className="input"
                  placeholder={t("report.description_placeholder")}
                  required
                  minLength={10}
                />
                <p className="mt-1 text-sm text-gray-500">{t("report.description_min")}</p>
              </div>

              {!user && (
                <>
                  <div>
                    <label className="label">{t("report.your_name")}</label>
                    <input type="text" name="name" className="input" required />
                  </div>
                  <div>
                    <label className="label">{t("report.your_email")}</label>
                    <input type="email" name="email" className="input" required />
                  </div>
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-600">
                    {t("report.login_prompt")} <a href="/login" className="font-medium underline">{t("nav.login")}</a>.
                  </p>
                </>
              )}

              <div className="flex gap-4">
                {from === "conversation" ? (
                  <a href="/messages" className="btn-secondary">{t("messages.cancel")}</a>
                ) : (
                  <a href="/" className="btn-secondary">{t("messages.cancel")}</a>
                )}
                <button type="submit" className="btn-primary flex-1" disabled={isSubmitting || !user}>
                  {isSubmitting ? t("report.submitting") : t("report.submit")}
                </button>
              </div>
            </Form>
          </div>
        )}
      </main>
    </div>
  );
}
