import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { useState } from "react";
import { getUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { Header } from "~/components/Header";
import { FooterLight } from "~/components/FooterLight";
import { SubjectDropdown } from "~/components/SubjectDropdown";

export const meta: MetaFunction = () => {
  return [{ title: "Contact Us - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  return { user };
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function action({ request }: ActionFunctionArgs) {
  const user = await getUser(request);
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const subject = (formData.get("subject") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  // Validation for non-logged-in users
  if (!user) {
    if (!name || name.length < 2) {
      return data({ error: "Please provide your name (at least 2 characters)" }, { status: 400 });
    }

    if (!email) {
      return data({ error: "Please provide your email" }, { status: 400 });
    }

    // Validate email format with regex
    if (!emailRegex.test(email)) {
      return data({ error: "Please provide a valid email address" }, { status: 400 });
    }
  }

  // Validate subject
  if (!subject) {
    return data({ error: "Please select a subject" }, { status: 400 });
  }

  // Validate message
  if (!message || message.length < 10) {
    return data({ error: "Please provide a message (at least 10 characters)" }, { status: 400 });
  }

  // Save to database
  const { error } = await supabaseAdmin.from("contact_messages").insert({
    user_id: user ? (user as any).id : null,
    name: user ? (user as any).full_name : name,
    email: user ? (user as any).email : email,
    subject: subject,
    message: message,
  } as any);

  if (error) {
    console.error("Contact form error:", error);
    return data({ error: "Failed to send message. Please try again." }, { status: 500 });
  }

  return data({ success: true });
}

export default function Contact() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [subject, setSubject] = useState("");

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed">
      <div className="min-h-screen bg-gray-50/85">
        <Header user={user} />

        <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-md p-6">
            <h1 className="font-display text-3xl font-bold text-gray-900">
              Contact Us
            </h1>
            <p className="mt-2 text-gray-600">
              Send us a message and we'll get back to you
            </p>
          </div>

          {actionData && "success" in actionData ? (
            <div className="card p-8 text-center shadow-md bg-white/70 backdrop-blur-sm">
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
                Your message has been received. We'll get back to you soon.
              </p>
              <a href="/" className="mt-6 btn-primary rounded-full inline-block">
                Back to Home
              </a>
            </div>
          ) : (
            <div className="card p-6 shadow-md bg-white/70 backdrop-blur-sm">
              {actionData && "error" in actionData && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                  {actionData.error}
                </div>
              )}

              <Form method="post" className="space-y-6">
                {/* Name - only for non-logged-in users */}
                {!user && (
                  <div>
                    <label className="label">Name *</label>
                    <input
                      type="text"
                      name="name"
                      className="input shadow-sm"
                      placeholder="Your name"
                      required
                      minLength={2}
                    />
                  </div>
                )}

                {/* Email - only for non-logged-in users */}
                {!user && (
                  <div>
                    <label className="label">Email *</label>
                    <input
                      type="email"
                      name="email"
                      className="input shadow-sm"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                )}

                {/* Subject - always shown */}
                <SubjectDropdown
                  value={subject}
                  onChange={setSubject}
                  hasError={actionData && "error" in actionData && actionData.error?.includes("subject")}
                />

                {/* Message - always shown */}
                <div>
                  <label className="label text-base mb-6">Message *</label>
                  <textarea
                    name="message"
                    rows={5}
                    className="input shadow-md"
                    placeholder="How can we help you?"
                    required
                    minLength={10}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Minimum 10 characters
                  </p>
                </div>

                {/* Submit */}
                <div>
                  <button
                    type="submit"
                    className="btn-primary rounded-full w-full shadow-lg shadow-accent-500/30"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </Form>
            </div>
          )}
        </main>

        <FooterLight />
      </div>
    </div>
  );
}
