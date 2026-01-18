import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useSearchParams, useNavigation } from "@remix-run/react";
import { requireUser, getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";

export const meta: MetaFunction = () => {
  return [{ title: "Contact Us - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const url = new URL(request.url);
  
  // Get prefilled data from URL params
  const type = url.searchParams.get("type") || "other";
  const reportedId = url.searchParams.get("id");
  const from = url.searchParams.get("from");

  // If reporting a user, get their info
    let reportedUser: { id: string; full_name: string | null; company_name: string | null } | null = null;

  if (type === "user" && reportedId) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, company_name")
      .eq("id", reportedId)
      .single();
    reportedUser = data;
  }

  // If reporting a listing, get its info
    let reportedListing: { id: string; title: string } | null = null;

  if (type === "listing" && reportedId) {
    const { data } = await supabaseAdmin
      .from("listings")
      .select("id, title")
      .eq("id", reportedId)
      .single();
    reportedListing = data;
  }

  return { user, type, reportedUser, reportedListing, from };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getUser(request);
  
  const formData = await request.formData();
  const reportType = formData.get("report_type") as string;
  const reason = formData.get("reason") as string;
  const description = formData.get("description") as string;
  const reportedUserId = formData.get("reported_user_id") as string | null;
  const reportedListingId = formData.get("reported_listing_id") as string | null;
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;

  // Validation
  if (!reason || reason.trim() === "") {
    return json({ error: "Please select a reason" }, { status: 400 });
  }

  if (!description || description.trim().length < 10) {
    return json({ error: "Please provide a description (at least 10 characters)" }, { status: 400 });
  }

  // If user is logged in, use their ID; otherwise store email/name in description
  if (user) {
    const { error } = await supabaseAdmin.from("reports").insert({
      reporter_id: (user as any).id,
      report_type: reportType || "other",
      reason: reason,
      description: description.trim(),
      reported_user_id: reportedUserId || null,
      reported_listing_id: reportedListingId || null,
    } as any);

    if (error) {
      console.error("Report error:", error);
      return json({ error: "Failed to submit report. Please try again." }, { status: 500 });
    }
  } else {
    // For non-logged-in users, we still need a reporter_id
    // In a real app, you might want to handle this differently
    // For now, we'll require login
    return json({ error: "Please log in to submit a report" }, { status: 401 });
  }

  return json({ success: true });
}

export default function Contact() {
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
  
  const isSubmitting = navigation.state === "submitting";

  const reasonOptions = {
    user: [
      { value: "spam", label: "Spam or fake account" },
      { value: "harassment", label: "Harassment or bullying" },
      { value: "scam", label: "Scam or fraud" },
      { value: "inappropriate", label: "Inappropriate content" },
      { value: "other", label: "Other" },
    ],
    listing: [
      { value: "fake", label: "Fake or misleading listing" },
      { value: "scam", label: "Scam or fraud" },
      { value: "duplicate", label: "Duplicate listing" },
      { value: "inappropriate", label: "Inappropriate content" },
      { value: "other", label: "Other" },
    ],
    bug: [
      { value: "ui", label: "UI/Display issue" },
      { value: "functionality", label: "Feature not working" },
      { value: "performance", label: "Slow performance" },
      { value: "other", label: "Other" },
    ],
    other: [
      { value: "feedback", label: "General feedback" },
      { value: "feature", label: "Feature request" },
      { value: "question", label: "Question" },
      { value: "other", label: "Other" },
    ],
  };

  const currentReasons = reasonOptions[type as keyof typeof reasonOptions] || reasonOptions.other;

  return (
    <div className="min-h-full bg-gray-50">
      <Header user={user} />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gray-900">
            Contact Us
          </h1>
          <p className="mt-2 text-gray-600">
            {type === "user" && "Report a user"}
            {type === "listing" && "Report a listing"}
            {type === "bug" && "Report a bug"}
            {type === "other" && "Send us a message"}
          </p>
        </div>

        {actionData && "success" in actionData ? (
          <div className="card p-8 text-center">
            <svg
              className="mx-auto h-16 w-16 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              Thank you!
            </h2>
            <p className="mt-2 text-gray-600">
              Your message has been received. We'll review it and get back to you if needed.
            </p>
            {from === "conversation" ? (
              <a href="/messages" className="mt-6 btn-primary inline-block">
                Back to Messages
              </a>
            ) : (
              <a href="/" className="mt-6 btn-primary inline-block">
                Back to Home
              </a>
            )}
          </div>
        ) : (
          <div className="card p-6">
            {actionData && "error" in actionData && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                {actionData.error}
              </div>
            )}

            {/* Reported entity info */}
            {reportedUser && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Reporting user:</p>
                <p className="font-medium text-gray-900">
                  {reportedUser.company_name || reportedUser.full_name}
                </p>
              </div>
            )}

            {reportedListing && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Reporting listing:</p>
                <p className="font-medium text-gray-900">{reportedListing.title}</p>
              </div>
            )}

            <Form method="post" className="space-y-6">
              <input type="hidden" name="report_type" value={type} />
              {reportedUser && (
                <input type="hidden" name="reported_user_id" value={reportedUser.id} />
              )}
              {reportedListing && (
                <input type="hidden" name="reported_listing_id" value={reportedListing.id} />
              )}

              {/* Report Type Selector (if coming from general contact) */}
              {!searchParams.get("type") && (
                <div>
                  <label className="label">What can we help you with?</label>
                  <select name="report_type" className="input">
                    <option value="other">General inquiry</option>
                    <option value="bug">Report a bug</option>
                    <option value="user">Report a user</option>
                    <option value="listing">Report a listing</option>
                  </select>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="label">Reason *</label>
                <select name="reason" className="input" required>
                  <option value="">Select a reason...</option>
                  {currentReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="label">Description *</label>
                <textarea
                  name="description"
                  rows={5}
                  className="input"
                  placeholder="Please provide details..."
                  required
                  minLength={10}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Minimum 10 characters
                </p>
              </div>

              {/* Contact info for non-logged-in users */}
              {!user && (
                <>
                  <div>
                    <label className="label">Your name *</label>
                    <input
                      type="text"
                      name="name"
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Your email *</label>
                    <input
                      type="email"
                      name="email"
                      className="input"
                      required
                    />
                  </div>
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                    Please <a href="/login" className="underline font-medium">log in</a> to submit a report.
                  </p>
                </>
              )}

              {/* Submit */}
              <div className="flex gap-4">
                {from === "conversation" ? (
                  <a href="/messages" className="btn-secondary">
                    Cancel
                  </a>
                ) : (
                  <a href="/" className="btn-secondary">
                    Cancel
                  </a>
                )}
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={isSubmitting || !user}
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </Form>
          </div>
        )}
      </main>
    </div>
  );
}
