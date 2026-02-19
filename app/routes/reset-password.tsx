import type { MetaFunction } from "react-router";
import { Link, useNavigate } from "react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "~/lib/supabase.client";

export const meta: MetaFunction = () => {
  return [{ title: "Set New Password - Runoot" }];
};

type ResetState = "checking" | "ready" | "invalid" | "saving" | "success" | "error";

export default function ResetPassword() {
  const navigate = useNavigate();
  const supabase = useMemo(() => (typeof window !== "undefined" ? getSupabaseBrowserClient() : null), []);

  const [state, setState] = useState<ResetState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase || typeof window === "undefined") return;
    const client = supabase;

    let mounted = true;

    async function init() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(window.location.href);
          if (error && mounted) {
            setState("invalid");
            setMessage("This reset link is invalid or has expired.");
            return;
          }
        }

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error && mounted) {
            setState("invalid");
            setMessage("This reset link is invalid or has expired.");
            return;
          }
        }

        const { data } = await client.auth.getSession();
        if (mounted) {
          if (data.session) {
            setState("ready");
          } else {
            setState("invalid");
            setMessage("This reset link is invalid or has expired.");
          }
        }
      } catch {
        if (mounted) {
          setState("invalid");
          setMessage("Unable to validate reset link.");
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;

    if (password.length < 8) {
      setState("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setState("error");
      setMessage("Passwords do not match.");
      return;
    }

    setState("saving");
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setState("error");
      setMessage(error.message || "Failed to update password.");
      return;
    }

    await supabase.auth.signOut();
    setState("success");
    setMessage("Password updated successfully. Please sign in again.");

    setTimeout(() => {
      navigate("/login");
    }, 1000);
  }

  return (
    <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center font-display text-3xl font-bold text-gray-900">
          Set new password
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10 border border-gray-200">
          {state === "checking" && (
            <p className="text-sm text-gray-600">Validating reset link...</p>
          )}

          {state === "invalid" && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {message}
            </div>
          )}

          {(state === "ready" || state === "saving" || state === "error") && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {message && state === "error" && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                  {message}
                </div>
              )}

              <div>
                <label htmlFor="password" className="label">New password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="input"
                />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={state === "saving"}>
                {state === "saving" ? "Updating..." : "Update password"}
              </button>
            </form>
          )}

          {state === "success" && (
            <div className="rounded-lg bg-success-50 border border-success-200 p-4 text-sm text-success-700">
              {message}
            </div>
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
