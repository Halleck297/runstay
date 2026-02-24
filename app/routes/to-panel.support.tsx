import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { useState } from "react";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { SubjectDropdown } from "~/components/SubjectDropdown";
import { tourOperatorNavItems } from "~/components/panelNav";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getPublicDisplayName } from "~/lib/user-display";

export const meta: MetaFunction = () => {
  return [{ title: "Support - TO Panel - Runoot" }];
};

const ALLOWED_SUBJECTS = ["general", "bug", "feature", "partnership", "other"] as const;
type AllowedSubject = (typeof ALLOWED_SUBJECTS)[number];

function isAllowedSubject(value: string | null): value is AllowedSubject {
  return !!value && ALLOWED_SUBJECTS.includes(value as AllowedSubject);
}

function extractEmailAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] || trimmed).trim() || null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") return redirect("/listings");

  const userId = (user as any).id as string;
  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select("id, participant_1, participant_2")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
  const conversationIds = (conversations || []).map((c: any) => c.id);
  let unreadCount = 0;
  if (conversationIds.length > 0) {
    const { count } = await (supabaseAdmin as any)
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .neq("sender_id", userId)
      .is("read_at", null);
    unreadCount = count || 0;
  }

  return { user, unreadCount };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") {
    return data({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!isAllowedSubject(subject)) {
    return data({ error: "Please select a valid subject.", field: "subject" }, { status: 400 });
  }

  if (message.length < 10) {
    return data({ error: "Message must be at least 10 characters.", field: "message" }, { status: 400 });
  }

  const userId = (user as any).id as string;
  const userEmail = ((user as any).email as string) || "";
  const userName = ((user as any).full_name as string) || ((user as any).company_name as string) || "Tour Operator";

  const { error } = await supabaseAdmin.from("contact_messages").insert({
    user_id: userId,
    name: userName,
    email: userEmail,
    subject,
    message,
  } as any);

  if (error) {
    console.error("TO support form error:", error);
    return data({ error: "Failed to send message. Please try again." }, { status: 500 });
  }

  const contactInbox = extractEmailAddress(
    process.env.CONTACT_NOTIFICATION_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      null
  );

  if (contactInbox) {
    const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");

    const emailResult = await sendTemplatedEmail({
      to: contactInbox,
      templateId: "platform_notification",
      locale: "en",
      payload: {
        title: `TO support request (${subject})`,
        message: [
          `User: ${userName}`,
          `Email: ${userEmail}`,
          `User ID: ${userId}`,
          `Subject: ${subject}`,
          "",
          "Message:",
          message,
        ].join("\n"),
        ctaLabel: "Open TO support",
        ctaUrl: `${appUrl}/to-panel/support`,
      },
    });

    if (!emailResult.ok) {
      console.error("TO support email notification failed:", emailResult.error);
    }
  }

  return data({ success: true });
}

export default function ToPanelSupport() {
  const { user, unreadCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { error?: string; field?: string; success?: boolean } | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [subject, setSubject] = useState("");
  const publicName = getPublicDisplayName(user);

  const navItems = tourOperatorNavItems.map((item) =>
    item.to === "/messages"
      ? { ...item, badgeCount: unreadCount, badgeTone: "brand" as const, hideBadgeWhenActive: true }
      : item
  );

  return (
    <ControlPanelLayout
      panelLabel="Tour Operator Panel"
      mobileTitle="TO Panel"
      homeTo="/to-panel"
      user={{
        fullName: publicName,
        email: (user as any).email,
        roleLabel: "Tour Operator",
        avatarUrl: (user as any).avatar_url,
      }}
      navItems={navItems}
    >
      <div className="-m-4 min-h-full bg-slate-100 md:-m-8">
        <main className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8 lg:px-8">
          <div className="mb-6 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
            <h1 className="font-display text-2xl font-bold text-gray-900">Support</h1>
            <p className="mt-1 text-gray-600">Contact the Runoot team for account, listing, or platform assistance.</p>
          </div>

          {actionData?.error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {actionData.error}
            </div>
          )}

          {actionData?.success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <h2 className="font-semibold text-emerald-800">Message sent</h2>
              <p className="mt-1 text-sm text-emerald-700">Our team received your request and will reply as soon as possible.</p>
            </div>
          ) : (
            <section className="rounded-3xl border border-brand-200/70 bg-gradient-to-br from-white via-slate-50 to-brand-50/40 p-6 shadow-[0_14px_38px_-18px_rgba(15,23,42,0.35)] backdrop-blur-sm">
              <Form method="post" className="space-y-6">
                <div>
                  <SubjectDropdown
                    value={subject}
                    onChange={setSubject}
                    hasError={actionData?.field === "subject"}
                  />
                </div>

                <div>
                  <label htmlFor="message" className="label mb-2">Message *</label>
                  <textarea
                    id="message"
                    name="message"
                    rows={6}
                    required
                    minLength={10}
                    placeholder="Describe your request in detail..."
                    className="input w-full"
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimum 10 characters.</p>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="btn-primary rounded-full px-5 py-2.5 text-sm" disabled={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Send message"}
                  </button>
                </div>
              </Form>
            </section>
          )}
        </main>
      </div>
    </ControlPanelLayout>
  );
}
