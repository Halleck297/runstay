import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MetaFunction } from "react-router";
import { Link, useNavigate } from "react-router";
import { useI18n } from "~/hooks/useI18n";
import { getSupabaseBrowserClient } from "~/lib/supabase.client";

export const meta: MetaFunction = () => {
  return [{ title: "Set New Password - Runoot" }];
};

type ResetState = "checking" | "ready" | "invalid" | "saving" | "success" | "error";

function isStrongEnoughPassword(value: string): boolean {
  return /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const supabase = useMemo(() => (typeof window !== "undefined" ? getSupabaseBrowserClient() : null), []);
  const initDoneRef = useRef(false);

  const [state, setState] = useState<ResetState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordHasNumber = /\d/.test(password);
  const passwordHasSymbol = /[^A-Za-z0-9]/.test(password);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase || typeof window === "undefined") return;
    if (initDoneRef.current) return;
    initDoneRef.current = true;
    const client = supabase;

    let mounted = true;

    async function init() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        let shouldCleanUrl = false;

        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error && mounted) {
            setState("invalid");
            setMessage(t("auth.reset_link_invalid"));
            return;
          }
          url.searchParams.delete("code");
          url.searchParams.delete("type");
          shouldCleanUrl = true;
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
          shouldCleanUrl = true;
        }

        if (shouldCleanUrl) {
          // Tokens are one-time sensitive values; remove them from URL after bootstrap.
          window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;

    if (password.length < 8) {
      setState("error");
      setMessage(t("auth.password_too_short"));
      return;
    }
    if (!isStrongEnoughPassword(password)) {
      setState("error");
      setMessage(t("join_referral.error.password_requirements"));
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

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token || !session?.refresh_token) {
      setState("error");
      setMessage(t("auth.failed_update_password"));
      return;
    }

    const bootstrapResponse = await fetch("/auth/session/bootstrap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        createSessionIfRequired: true,
      }),
    });

    if (!bootstrapResponse.ok) {
      setState("error");
      setMessage(t("auth.failed_update_password"));
      return;
    }
    const bootstrapPayload = (await bootstrapResponse.json().catch(() => ({}))) as {
      requiresPhoneVerification?: boolean;
    };
    if (bootstrapPayload.requiresPhoneVerification) {
      navigate("/verify-phone");
      return;
    }

    await supabase.auth.signOut();
    setState("success");
    setMessage(t("auth.password_updated_success"));
  }

  return (
    <div className="flex min-h-full flex-col justify-center bg-[#ECF4FE] py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-brand-500 bg-white px-4 py-8 shadow-sm sm:px-10">
          <Link to="/" className="mb-5 flex justify-center" aria-label={t("register.go_home_aria")}>
            <img src="/logo225px.png" alt="Runoot" className="h-[4.5rem] w-auto sm:h-[5.5rem]" />
          </Link>
          <h1 className="mb-8 text-center font-display text-2xl font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">
            {t("auth.set_new_password")}
          </h1>

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
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    minLength={8}
                    pattern="(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
                    className="input w-full rounded-full !pl-4 !pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M21 21l-3.122-3.122" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-600 font-medium">{t("join_referral.password_rules_title")}</p>
                <ul className="mt-1 space-y-1 text-xs">
                  <li className={`flex items-center gap-2 ${password.length >= 8 ? "text-green-600" : "text-gray-500"}`}>
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.18 7.18a1 1 0 01-1.414 0L3.296 9.07a1 1 0 011.414-1.414l4.107 4.108 6.473-6.474a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>{t("join_referral.password_rule_length")}</span>
                  </li>
                  <li className={`flex items-center gap-2 ${passwordHasNumber ? "text-green-600" : "text-gray-500"}`}>
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.18 7.18a1 1 0 01-1.414 0L3.296 9.07a1 1 0 011.414-1.414l4.107 4.108 6.473-6.474a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>{t("join_referral.password_rule_number")}</span>
                  </li>
                  <li className={`flex items-center gap-2 ${passwordHasSymbol ? "text-green-600" : "text-gray-500"}`}>
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.18 7.18a1 1 0 01-1.414 0L3.296 9.07a1 1 0 011.414-1.414l4.107 4.108 6.473-6.474a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>{t("join_referral.password_rule_symbol")}</span>
                  </li>
                </ul>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">{t("auth.confirm_password")}</label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  minLength={8}
                  className="input w-full rounded-full !pl-4"
                />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={state === "saving"}>
                {state === "saving" ? t("auth.updating") : t("auth.update_password")}
              </button>
            </form>
          )}

          {state === "success" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-success-200 bg-success-50 p-4 text-sm text-success-700">{message}</div>
              <div className="flex justify-center">
                <Link to="/login" className="btn-primary inline-flex rounded-full px-8 py-2.5">
                  {t("auth.back_to_login")}
                </Link>
              </div>
            </div>
          )}

          {state !== "success" && (
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                {t("auth.back_to_login")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
