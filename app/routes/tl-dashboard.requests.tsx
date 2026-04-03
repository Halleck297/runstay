import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, redirect } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { generateInviteToken } from "~/lib/referral-code.server";
import { useI18n } from "~/hooks/useI18n";
import { isTeamLeader } from "~/lib/user-access";
import { formatDateStable } from "~/lib/format-date";

export const meta: MetaFunction = () => [{ title: "Requests - Team Leader - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) return redirect("/to-panel");

  const { data: requests } = await (supabaseAdmin.from("team_join_requests") as any)
    .select("id, tl_id, first_name, last_name, email, notes, status, created_at, updated_at")
    .eq("tl_id", (user as any).id)
    .order("created_at", { ascending: false });

  // Sort: pending first, then accepted/rejected by updated_at desc
  const allRequests = (requests || []) as any[];
  const pending = allRequests.filter((r: any) => r.status === "pending");
  const resolved = allRequests.filter((r: any) => r.status !== "pending");
  const sortedRequests = [...pending, ...resolved];

  return { user, requests: sortedRequests };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (!isTeamLeader(user)) return data({ errorKey: "not_team_leader" as const }, { status: 403 });

  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "");
  const requestId = String(formData.get("requestId") || "").trim();

  if (!requestId) {
    return data({ errorKey: "missing_request_id" as const }, { status: 400 });
  }

  // Fetch the request and verify ownership
  const { data: joinRequest } = await (supabaseAdmin.from("team_join_requests") as any)
    .select("id, tl_id, first_name, last_name, email, notes, status")
    .eq("id", requestId)
    .eq("tl_id", (user as any).id)
    .maybeSingle();

  if (!joinRequest) {
    return data({ errorKey: "request_not_found" as const }, { status: 404 });
  }

  if (joinRequest.status !== "pending") {
    return data({ errorKey: "request_already_handled" as const }, { status: 400 });
  }

  const now = new Date().toISOString();
  const locale = (user as any).preferred_language || null;

  switch (actionType) {
    case "accept": {
      // Generate invite token and create referral invite
      const token = generateInviteToken();
      const appUrl = (process.env.APP_URL || "https://runoot.com").replace(/\/$/, "");
      const referralLink = `${appUrl}/join/${token}`;

      // Insert into referral_invites
      const { error: inviteError } = await (supabaseAdmin.from("referral_invites") as any).insert({
        team_leader_id: (user as any).id,
        email: joinRequest.email,
        status: "pending",
        token,
        created_at: now,
        updated_at: now,
      });

      if (inviteError) {
        return data({ errorKey: "invite_creation_failed" as const }, { status: 500 });
      }

      // Send invite email
      await sendTemplatedEmail({
        to: joinRequest.email,
        templateId: "referral_invite",
        locale,
        payload: {
          inviterName: (user as any).full_name || "Your Team Leader",
          referralLink,
          welcomeMessage: (user as any).tl_welcome_message,
        },
      });

      // Update request status
      await (supabaseAdmin.from("team_join_requests") as any)
        .update({ status: "accepted", updated_at: now })
        .eq("id", requestId);

      return data({ success: true, messageKey: "tl_requests.accepted_success" as const });
    }

    case "reject": {
      // Send rejection email
      await sendTemplatedEmail({
        to: joinRequest.email,
        templateId: "join_request_rejected",
        locale,
        payload: {
          teamLeaderName: (user as any).full_name || "Team Leader",
        },
      });

      // Update request status
      await (supabaseAdmin.from("team_join_requests") as any)
        .update({ status: "rejected", updated_at: now })
        .eq("id", requestId);

      return data({ success: true, messageKey: "tl_requests.rejected_success" as const });
    }

    default:
      return data({ errorKey: "unknown_action" as const }, { status: 400 });
  }
}

export default function TLRequestsPage() {
  const { t, locale } = useI18n();
  const { requests } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>() as
    | { success?: boolean; messageKey?: string; errorKey?: never }
    | { errorKey?: string; success?: never; messageKey?: never }
    | undefined;

  const actionError = actionData?.errorKey
    ? t(`tl_requests.${actionData.errorKey}` as any) || actionData.errorKey
    : undefined;
  const actionMessage = actionData?.messageKey
    ? t(actionData.messageKey as any)
    : undefined;

  const formatDate = (value: string) =>
    formatDateStable(value, locale, { day: "numeric", month: "short", year: "numeric" });

  const pendingRequests = (requests || []).filter((r: any) => r.status === "pending");
  const resolvedRequests = (requests || []).filter((r: any) => r.status !== "pending");

  return (
    <div className="min-h-full px-0 pt-0 pb-2 md:mx-auto md:max-w-7xl md:px-8 md:py-8 md:pb-8">
      <div className="mt-3 mb-4 rounded-3xl border border-brand-500 bg-white px-4 py-4 md:mx-auto md:mt-0 md:mb-6 md:w-[58%] md:border-2 md:p-6 lg:w-[52%]">
        <h1 className="text-center font-display text-2xl font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">
          {t("tl_requests.title")}
        </h1>
      </div>

      {/* Action feedback */}
      {actionError && (
        <div className="mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm md:mx-auto md:w-[78%] lg:w-[72%]">
          {actionError}
        </div>
      )}
      {actionData?.success && actionMessage && (
        <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm md:mx-auto md:w-[78%] lg:w-[72%]">
          {actionMessage}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="border-y border-brand-300 bg-white p-6 text-center text-sm text-gray-500 md:mx-auto md:w-[78%] md:rounded-3xl md:border md:shadow-sm lg:w-[72%]">
          {t("tl_requests.empty")}
        </div>
      ) : (
        <>
          {/* Pending requests */}
          {pendingRequests.length > 0 && (
            <div className="mb-4 overflow-hidden border-y border-brand-300 bg-white md:mx-auto md:w-[78%] md:rounded-3xl md:border md:shadow-sm lg:w-[72%]">
              <div className="border-b border-brand-300 px-4 py-3 md:px-6">
                <h2 className="font-display font-semibold text-gray-900 underline decoration-accent-500 underline-offset-4">
                  {t("tl_requests.pending")}
                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
                    {pendingRequests.length}
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {pendingRequests.map((req: any) => {
                  const isSubmitting =
                    navigation.state === "submitting" &&
                    navigation.formData?.get("requestId") === req.id;

                  return (
                    <div key={req.id} className="p-4 md:px-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{req.first_name} {req.last_name}</p>
                          <p className="mt-0.5 text-sm text-gray-600">{req.email}</p>
                          {req.notes && (
                            <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                              <p className="text-xs font-medium text-gray-500">{t("tl_requests.notes_label")}</p>
                              <p className="mt-0.5 text-sm text-gray-700">{req.notes}</p>
                            </div>
                          )}
                          <p className="mt-2 text-xs text-gray-400" suppressHydrationWarning>
                            {t("tl_requests.date")}: {formatDate(req.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Form method="post">
                            <input type="hidden" name="_action" value="accept" />
                            <input type="hidden" name="requestId" value={req.id} />
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                            >
                              {isSubmitting && navigation.formData?.get("_action") === "accept"
                                ? "..."
                                : t("tl_requests.accept")}
                            </button>
                          </Form>
                          <Form method="post">
                            <input type="hidden" name="_action" value="reject" />
                            <input type="hidden" name="requestId" value={req.id} />
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-red-50 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                            >
                              {isSubmitting && navigation.formData?.get("_action") === "reject"
                                ? "..."
                                : t("tl_requests.reject")}
                            </button>
                          </Form>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resolved requests */}
          {resolvedRequests.length > 0 && (
            <div className="mb-4 overflow-hidden border-y border-brand-300 bg-white md:mx-auto md:w-[78%] md:rounded-3xl md:border md:shadow-sm lg:w-[72%]">
              <div className="border-b border-brand-300 px-4 py-3 md:px-6">
                <h2 className="font-display font-semibold text-gray-500">
                  {t("tl_requests.title")}
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {resolvedRequests.map((req: any) => (
                  <div key={req.id} className="p-4 md:px-6 opacity-60">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700">{req.first_name} {req.last_name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{req.email}</p>
                        {req.notes && (
                          <p className="mt-1 text-xs text-gray-400 italic">{req.notes}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400" suppressHydrationWarning>
                          {t("tl_requests.date")}: {formatDate(req.created_at)}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            req.status === "accepted"
                              ? "bg-success-100 text-success-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {req.status === "accepted"
                            ? t("tl_requests.accepted")
                            : t("tl_requests.rejected")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
