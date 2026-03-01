import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { MetaFunction } from "react-router";
import { Link, useNavigate } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { getSupabaseBrowserClient } from "~/lib/supabase.client";

export const meta: MetaFunction = () => {
  return [{ title: "Set New Password - Runoot" }];
};

type ResetState = "checking" | "ready" | "invalid" | "saving" | "success" | "error";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
            setMessage(t("auth.reset_link_invalid"));
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
            setMessage(t("auth.reset_link_invalid"));
            return;
          }
        }

        const { data } = await client.auth.getSession();
        if (mounted) {
          if (data.session) {
            setState("ready");
          } else {
            setState("invalid");
            setMessage(t("auth.reset_link_invalid"));
          }
        }
      } catch {
        if (mounted) {
          setState("invalid");
          setMessage(t("auth.unable_validate_reset_link"));
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [supabase, t]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;

    if (password.length < 8) {
      setState("error");
      setMessage(t("auth.password_too_short"));
      return;
    }

    if (password !== confirmPassword) {
      setState("error");
      setMessage(t("auth.passwords_no_match"));
      return;
    }

    setState("saving");
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setState("error");
      setMessage(error.message || t("auth.failed_update_password"));
      return;
    }

    await supabase.auth.signOut();
    setState("success");
    setMessage(t("auth.password_updated_success"));

    setTimeout(() => {
      navigate("/login");
    }, 1000);
  }

  return (
    <div className="flex min-h-full flex-col justify-center bg-[#ECF4FE] py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center font-display text-3xl font-bold text-gray-900">{t("auth.set_new_password")}</h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 shadow-sm sm:px-10">
          {state === "checking" && <p className="text-sm text-gray-600">{t("auth.validating_reset_link")}</p>}

          {state === "invalid" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
          )}

          {(state === "ready" || state === "saving" || state === "error") && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {message && state === "error" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
              )}

              <div>
                <label htmlFor="password" className="label">{t("auth.new_password")}</label>
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
                <label htmlFor="confirmPassword" className="label">{t("auth.confirm_password")}</label>
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
                {state === "saving" ? t("auth.updating") : t("auth.update_password")}
              </button>
            </form>
          )}

          {state === "success" && (
            <div className="rounded-lg border border-success-200 bg-success-50 p-4 text-sm text-success-700">{message}</div>
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
