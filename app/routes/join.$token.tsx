import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { createCookie, data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "~/hooks/useI18n";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getUser } from "~/lib/session.server";
import { getLocaleLabelsForUi, isSupportedLocale, resolveLocaleForRequest, type SupportedLocale } from "~/lib/locale";
import { getDialingPrefix, getSuggestedLocaleForCountry, getSupportedCountries, resolveSupportedCountry } from "~/lib/supportedCountries";
import { startPhoneVerification, checkPhoneVerificationCode } from "~/lib/twilio-verify.server";
import { translate } from "~/lib/i18n";
import { toTitleCase } from "~/lib/user-display";
import { generateUniqueReferralCode } from "~/lib/referral-code.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { getAppUrl } from "~/lib/app-url.server";
import { CityAutocomplete } from "~/components/CityAutocomplete";

const LEGAL_TERMS_VERSION = "2026-04-08";
const LEGAL_PRIVACY_VERSION = "2026-04-08";

const phoneVerificationCookie = createCookie("runoot_join_phone_verification", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60,
  secrets: [process.env.SESSION_SECRET || "runoot-dev-secret"],
});

function isStrongPassword(value: string): boolean {
  return /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
}

function normalizeToE164(dialingPrefix: string, rawPhone: string): string | null {
  let nationalDigits = String(rawPhone || "").replace(/[^\d]/g, "");
  const dialingDigits = dialingPrefix.replace("+", "");
  if (nationalDigits.startsWith(dialingDigits)) {
    nationalDigits = nationalDigits.slice(dialingDigits.length);
  }
  if (!nationalDigits) return null;
  return `${dialingPrefix}${nationalDigits}`;
}

function normalizeDisplayPhone(dialingPrefix: string, rawPhone: string): string | null {
  let nationalDigits = String(rawPhone || "").replace(/[^\d]/g, "");
  const dialingDigits = dialingPrefix.replace("+", "");
  if (nationalDigits.startsWith(dialingDigits)) {
    nationalDigits = nationalDigits.slice(dialingDigits.length);
  }
  if (!nationalDigits) return null;
  return `${dialingPrefix} ${nationalDigits}`;
}

function getDobBounds() {
  const now = new Date();
  const youngest = new Date(now);
  youngest.setFullYear(youngest.getFullYear() - 18);
  const oldest = new Date(now);
  oldest.setFullYear(oldest.getFullYear() - 75);
  return {
    earliestDob: oldest.toISOString().slice(0, 10),
    latestDob: youngest.toISOString().slice(0, 10),
  };
}

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[""''"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

async function logLegalConsent(args: { userId: string; email: string; locale: SupportedLocale }) {
  const now = new Date().toISOString();
  await (supabaseAdmin.from("legal_consents" as any) as any).insert({
    user_id: args.userId,
    email: args.email,
    source: "join_token",
    locale: args.locale,
    terms_accepted_at: now,
    privacy_accepted_at: now,
    terms_version: LEGAL_TERMS_VERSION,
    privacy_version: LEGAL_PRIVACY_VERSION,
    created_at: now,
  });
}

async function readPhoneCookieState(request: Request): Promise<{ pendingPhoneE164?: string } | undefined> {
  try {
    const parsed = (await phoneVerificationCookie.parse(request.headers.get("Cookie"))) as unknown;
    if (!parsed || typeof parsed !== "object") return undefined;
    const maybe = parsed as Record<string, unknown>;
    return { pendingPhoneE164: typeof maybe.pendingPhoneE164 === "string" ? maybe.pendingPhoneE164 : undefined };
  } catch {
    return undefined;
  }
}

export const meta: MetaFunction<typeof loader> = ({ data: loaderData }) => {
  const d = loaderData as any;
  if (d?.isAdminInvite) {
    return [{ title: "Join Runoot" }];
  }
  if (d?.teamLeader?.full_name) {
    return [{ title: `Join ${d.teamLeader.full_name}'s team - Runoot` }];
  }
  return [{ title: "Join Team - Runoot" }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const token = params.token;
  if (!token) {
    return data({ status: "invalid" as const });
  }

  const locale = resolveLocaleForRequest(request, null);

  const { data: invite } = await (supabaseAdmin.from("referral_invites" as any) as any)
    .select("id, team_leader_id, email, status, token, invite_type, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return data({ status: "invalid" as const, locale });
  }

  const url = new URL(request.url);
  const justRegistered = url.searchParams.get("success") === "1";

  if (invite.status === "accepted" || invite.status === "claimed") {
    if (justRegistered) {
      return data({ status: "success" as const, locale });
    }
    return data({ status: "already_used" as const, locale });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return data({ status: "invalid" as const, locale });
  }

  const { data: teamLeader } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, company_name, avatar_url, is_verified, tl_welcome_message, user_type, platform_role, role")
    .eq("id", invite.team_leader_id)
    .single();

  if (!teamLeader) {
    return data({ status: "invalid" as const, locale });
  }

  const isAdminInvite =
    ["admin_invite", "admin_invite_tl", "admin_invite_to"].includes(invite.invite_type) ||
    (teamLeader as any).role === "admin" ||
    (teamLeader as any).role === "superadmin";

  const currentUser = await getUser(request);
  const isAmbassadorInvite = invite.invite_type === "ambassador_invite";

  return data({
    status: "ready" as const,
    teamLeader,
    invitedEmail: invite.email,
    isAdminInvite,
    isAmbassadorInvite,
    isLoggedIn: !!currentUser,
    currentUserEmail: currentUser?.email || null,
    locale,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const token = params.token;
  if (!token) {
    return data({ errorKey: "join_token.invalid" }, { status: 400 });
  }

  const locale = resolveLocaleForRequest(request, null);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "register");

  // Fetch invite
  const { data: invite } = await (supabaseAdmin.from("referral_invites" as any) as any)
    .select("id, team_leader_id, email, status, invite_type, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return data({ errorKey: "join_token.invalid" }, { status: 400 });
  }
  if (invite.status === "accepted" || invite.status === "claimed") {
    return data({ errorKey: "join_token.already_used" }, { status: 400 });
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return data({ errorKey: "join_token.invalid" }, { status: 400 });
  }

  const isAdminInvite = ["admin_invite", "admin_invite_tl", "admin_invite_to"].includes(invite.invite_type);

  // --- Send phone OTP ---
  if (intent === "send_phone_otp") {
    const country = String(formData.get("country") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const resolvedCountry = resolveSupportedCountry(country, locale);

    if (!resolvedCountry) {
      return data({ errorKey: "join_referral.error.country_unsupported", formValues: { country, phone } }, { status: 400 });
    }

    const dialingPrefix = getDialingPrefix(resolvedCountry.code);
    const phoneE164 = normalizeToE164(dialingPrefix, phone);

    if (!phoneE164) {
      return data({ errorKey: "join_referral.error.phone_required", formValues: { country, phone } }, { status: 400 });
    }

    try {
      await startPhoneVerification(phoneE164);
    } catch (error) {
      console.error("join token: send OTP failed", error);
      return data({ errorKey: "join_referral.error.phone_otp_send_failed", formValues: { country, phone } }, { status: 400 });
    }

    const headers = new Headers();
    headers.append("Set-Cookie", await phoneVerificationCookie.serialize({ pendingPhoneE164: phoneE164 }));
    return data({ infoKey: "phone_otp_sent", formValues: { country, phone } }, { headers });
  }

  // --- Register ---
  if (intent === "register") {
    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const country = String(formData.get("country") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const cityPlaceId = String(formData.get("cityPlaceId") || "").trim();
    const dateOfBirth = String(formData.get("dateOfBirth") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const phoneOtpCode = String(formData.get("phoneOtpCode") || "").trim();
    const preferredLanguageRaw = String(formData.get("language") || "").trim().toLowerCase();
    const acceptTerms = formData.get("acceptTerms") === "on";
    const acceptPrivacy = formData.get("acceptPrivacy") === "on";

    const preferredLanguage: SupportedLocale = isSupportedLocale(preferredLanguageRaw)
      ? preferredLanguageRaw
      : locale;
    const resolvedCountry = resolveSupportedCountry(country, preferredLanguage);

    // Validation
    if (!firstName || !lastName) {
      return data({ errorKey: "join_referral.error.all_fields_required" }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return data({ errorKey: "join_referral.error.password_min" }, { status: 400 });
    }
    if (!isStrongPassword(password)) {
      return data({ errorKey: "join_referral.error.password_requirements" }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return data({ errorKey: "register.error.passwords_no_match" }, { status: 400 });
    }
    if (!resolvedCountry) {
      return data({ errorKey: "join_referral.error.country_unsupported" }, { status: 400 });
    }
    if (!city) {
      return data({ errorKey: "register.error.city_required" }, { status: 400 });
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      return data({ errorKey: "join_referral.error.date_of_birth_invalid" }, { status: 400 });
    }
    if (dateOfBirth) {
      const { earliestDob, latestDob } = getDobBounds();
      if (dateOfBirth > latestDob) {
        return data({ errorKey: "join_referral.error.date_of_birth_too_young" }, { status: 400 });
      }
      if (dateOfBirth < earliestDob) {
        return data({ errorKey: "join_referral.error.date_of_birth_too_old" }, { status: 400 });
      }
    }
    if (!acceptTerms) {
      return data({ errorKey: "join_referral.error.terms_required" }, { status: 400 });
    }
    if (!acceptPrivacy) {
      return data({ errorKey: "join_referral.error.privacy_required" }, { status: 400 });
    }

    // Phone verification
    const dialingPrefix = getDialingPrefix(resolvedCountry.code);
    const phoneE164 = normalizeToE164(dialingPrefix, phone);
    const normalizedPhone = normalizeDisplayPhone(dialingPrefix, phone);

    if (!phoneE164 || !normalizedPhone) {
      return data({ errorKey: "join_referral.error.phone_required" }, { status: 400 });
    }
    if (!phoneOtpCode) {
      return data({ errorKey: "join_referral.error.phone_not_verified" }, { status: 400 });
    }

    const phoneCookie = await readPhoneCookieState(request);
    if (!phoneCookie?.pendingPhoneE164 || phoneCookie.pendingPhoneE164 !== phoneE164) {
      return data({ errorKey: "join_referral.error.phone_otp_send_failed" }, { status: 400 });
    }

    let otpApproved = false;
    try {
      otpApproved = await checkPhoneVerificationCode(phoneE164, phoneOtpCode);
    } catch (error) {
      console.error("join token: verify OTP failed", error);
      return data({ errorKey: "join_referral.error.phone_otp_invalid" }, { status: 400 });
    }
    if (!otpApproved) {
      return data({ errorKey: "join_referral.error.phone_otp_invalid" }, { status: 400 });
    }

    // Create auth user
    const email = normalizeEmail(invite.email);
    const fullName = toTitleCase(`${firstName} ${lastName}`.trim());

    // Resolve user_type and platform_role from invite_type
    const targetUserType = invite.invite_type === "admin_invite_to" ? "agency" : "private";
    const targetPlatformRole = invite.invite_type === "admin_invite_tl" ? "team_leader" : "runner";

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        user_type: targetUserType,
      },
    });

    if (authError || !authData?.user?.id) {
      console.error("Join token: auth user creation failed:", authError);
      if (authError?.message?.includes("already been registered")) {
        return data({ errorKey: "register.error.email_taken" }, { status: 400 });
      }
      return data({ errorKey: "join_referral.error.registration_failed" }, { status: 500 });
    }

    const userId = authData.user.id;
    const now = new Date().toISOString();

    // Create profile
    const profileData: Record<string, unknown> = {
      id: userId,
      full_name: fullName,
      email,
      user_type: targetUserType,
      platform_role: targetUserType === "agency" ? null : targetPlatformRole,
      referred_by_id: targetUserType === "private" ? invite.team_leader_id : null,
      country: resolvedCountry.nameEn,
      city: city || null,
      city_place_id: cityPlaceId || null,
      date_of_birth: dateOfBirth || null,
      phone: normalizedPhone,
      phone_verified_at: now,
      preferred_language: preferredLanguage,
      created_at: now,
      updated_at: now,
    };

    if (isAdminInvite) {
      profileData.created_by_admin = invite.team_leader_id;
    }

    // Generate referral code for Team Leaders
    if (targetPlatformRole === "team_leader") {
      profileData.referral_code = await generateUniqueReferralCode({
        fullName,
        email,
        excludeUserId: userId,
      });
    }

    await (supabaseAdmin.from("profiles") as any).upsert(profileData);

    // Create referral link
    const { data: tl } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("id", invite.team_leader_id)
      .single();

    await (supabaseAdmin.from("referrals" as any) as any).insert({
      referred_user_id: userId,
      team_leader_id: invite.team_leader_id,
      referral_code_used: (tl as any)?.referral_code || "TOKEN_INVITE",
      status: "registered",
      created_at: now,
    });

    // Update invite status
    await (supabaseAdmin.from("referral_invites" as any) as any)
      .update({
        status: "accepted",
        claimed_by: userId,
        claimed_at: now,
        updated_at: now,
      })
      .eq("id", invite.id);

    // Admin managed account tag
    if (isAdminInvite) {
      await (supabaseAdmin as any)
        .from("admin_managed_accounts")
        .upsert(
          {
            user_id: userId,
            access_mode: "external_invite",
            created_by_admin: invite.team_leader_id,
          },
          { onConflict: "user_id" },
        );
    }

    // Log legal consent
    try {
      await logLegalConsent({ userId, email, locale: preferredLanguage });
    } catch (e) {
      console.error("Failed to log legal consent:", e);
    }

    // Send welcome email
    try {
      const appUrl = getAppUrl(request);
      await sendTemplatedEmail({
        to: email,
        templateId: "welcome_user",
        payload: { firstName, profileUrl: `${appUrl}/profile` },
        locale: preferredLanguage,
      });
    } catch (e) {
      console.error("Failed to send welcome email:", e);
    }

    // Registration complete — redirect with success flag to avoid loader/actionData conflict
    const clearPhoneCookie = await phoneVerificationCookie.serialize("");
    const headers = new Headers();
    headers.append("Set-Cookie", clearPhoneCookie);
    return redirect(`/join/${token}?success=1`, { headers });
  }

  return data({ errorKey: "join_token.invalid" }, { status: 400 });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JoinByToken() {
  const { t, locale } = useI18n();
  const loaderData = useLoaderData<typeof loader>() as any;
  const actionData = useActionData<typeof action>() as any;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const { status } = loaderData;

  // Registration success
  if (status === "success") {
    return (
      <div className="flex items-start justify-center px-4 pt-8 pb-24 sm:min-h-screen sm:items-center sm:pt-0 sm:pb-0">
        <div className="max-w-md w-full bg-white rounded-3xl border border-brand-500 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_referral.registration_success_title")}</h1>
          <p className="text-sm text-gray-600 mb-6">{t("join_referral.registration_success_body")}</p>
          <Link to="/login" className="btn-primary mt-2 inline-block w-full py-3">{t("auth.sign_in")}</Link>
        </div>
      </div>
    );
  }

  // Invalid token
  if (status === "invalid") {
    return (
      <div className="flex items-start justify-center px-4 pt-8 pb-24 sm:min-h-screen sm:items-center sm:pt-0 sm:pb-0">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_token.invalid")}</h1>
          <Link to="/" className="btn-primary mt-6 inline-block w-full py-3">Runoot Home</Link>
        </div>
      </div>
    );
  }

  // Already used
  if (status === "already_used") {
    return (
      <div className="flex items-start justify-center px-4 pt-8 pb-24 sm:min-h-screen sm:items-center sm:pt-0 sm:pb-0">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_token.already_used")}</h1>
          <Link to="/login" className="btn-primary mt-6 inline-block w-full py-3">{t("auth.sign_in")}</Link>
        </div>
      </div>
    );
  }

  // Ready — registration form
  return <RegistrationForm loaderData={loaderData} actionData={actionData} isSubmitting={isSubmitting} />;
}

// ---------------------------------------------------------------------------
// Registration form component (extracted for readability)
// ---------------------------------------------------------------------------

function RegistrationForm({
  loaderData,
  actionData,
  isSubmitting,
}: {
  loaderData: any;
  actionData: any;
  isSubmitting: boolean;
}) {
  const { t, locale } = useI18n();
  const tl = loaderData.teamLeader;
  const invitedEmail = loaderData.invitedEmail;
  const isAdminInvite: boolean = loaderData.isAdminInvite;
  const isAmbassadorInvite: boolean = loaderData.isAmbassadorInvite || false;
  const detectedLocale = (loaderData.locale || locale) as SupportedLocale;

  const countries = getSupportedCountries(locale);
  const localeLabels = useMemo(() => getLocaleLabelsForUi(locale), [locale]);
  const { earliestDob, latestDob } = useMemo(() => getDobBounds(), []);

  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [countryValue, setCountryValue] = useState(actionData?.formValues?.country || "");
  const [languageValue, setLanguageValue] = useState<SupportedLocale>(detectedLocale);
  const [languageTouched, setLanguageTouched] = useState(false);
  const [phoneValue, setPhoneValue] = useState(actionData?.formValues?.phone || "");
  const [phoneOtpSent, setPhoneOtpSent] = useState(Boolean(actionData?.infoKey === "phone_otp_sent"));
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);

  // DOB state
  const [dateOfBirthDigits, setDateOfBirthDigits] = useState("");
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const dobCaretModeRef = useRef<"forward" | "backward">("forward");

  const selectedCountry = useMemo(() => resolveSupportedCountry(countryValue, locale), [countryValue, locale]);
  const phonePrefix = selectedCountry ? getDialingPrefix(selectedCountry.code) : "+--";
  const isUsDobFormat = countryValue === "US";
  const dobHint = isUsDobFormat ? t("join_referral.dob_hint_us") : t("join_referral.dob_hint_default");
  const dobMask = "__/__/____";
  const dobDigitSlots = [0, 1, 3, 4, 6, 7, 8, 9];
  const passwordHasNumber = /\d/.test(passwordValue);
  const passwordHasSymbol = /[^A-Za-z0-9]/.test(passwordValue);

  const errorMessage = actionData?.errorKey ? t(actionData.errorKey as any) : null;

  // Mark OTP as sent when action returns success
  useEffect(() => {
    if (actionData?.infoKey === "phone_otp_sent") {
      setPhoneOtpSent(true);
    }
  }, [actionData]);

  // DOB formatting helpers
  const formatDobForDisplay = (isoDate: string) => {
    const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";
    const year = match[1];
    const month = match[2];
    const day = match[3];
    return isUsDobFormat ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
  };

  const formatDobMaskedValue = (digits: string) => {
    const chars = dobMask.split("");
    const limitedDigits = digits.slice(0, 8);
    for (let i = 0; i < limitedDigits.length; i += 1) {
      chars[dobDigitSlots[i]] = limitedDigits[i];
    }
    return chars.join("");
  };

  const parseDobDigitsToIso = (digits: string) => {
    if (digits.length !== 8) return "";
    const first = Number.parseInt(digits.slice(0, 2), 10);
    const second = Number.parseInt(digits.slice(2, 4), 10);
    const year = Number.parseInt(digits.slice(4, 8), 10);
    if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(year)) return "";
    const day = isUsDobFormat ? second : first;
    const month = isUsDobFormat ? first : second;
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const testDate = new Date(Date.UTC(year, month - 1, day));
    const isValid = testDate.getUTCFullYear() === year && testDate.getUTCMonth() === month - 1 && testDate.getUTCDate() === day;
    if (!isValid) return "";
    return iso;
  };

  const getDobCaretPosition = (digitCount: number, mode: "forward" | "backward" = "forward") => {
    const capped = Math.max(0, Math.min(digitCount, 8));
    if (capped >= dobDigitSlots.length) return dobMask.length;
    const nextSlot = dobDigitSlots[capped];
    return mode === "backward" ? nextSlot : nextSlot + 1;
  };

  const dateOfBirthIsoValue = parseDobDigitsToIso(dateOfBirthDigits);

  useEffect(() => {
    const input = dateInputRef.current;
    if (!input || document.activeElement !== input) return;
    const nextPosition = getDobCaretPosition(dateOfBirthDigits.length, dobCaretModeRef.current);
    input.setSelectionRange(nextPosition, nextPosition);
    dobCaretModeRef.current = "forward";
  }, [dateOfBirthDigits, isUsDobFormat]);

  return (
    <div className="flex flex-col justify-start pt-8 pb-24 px-4 sm:min-h-screen sm:justify-center sm:py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* Inviter info card */}
        {isAdminInvite ? (
          <div className="bg-white rounded-3xl border border-brand-500 shadow-sm p-6 mb-6 text-center">
            <img src="/logo225px.png" alt="Runoot" className="mx-auto mb-3 h-14 md:h-20 w-auto" />
            <p className="text-sm text-gray-500">{t("join_token.admin_invited_by")}</p>
          </div>
        ) : isAmbassadorInvite ? (
          <div className="bg-white rounded-3xl border border-yellow-400 shadow-sm p-6 mb-6 text-center">
            <div className="mx-auto mb-3 h-14 w-14 overflow-hidden rounded-full bg-yellow-100">
              {tl?.avatar_url ? (
                <img
                  src={tl.avatar_url}
                  alt={tl?.full_name ? `${tl.full_name} avatar` : "Ambassador avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-yellow-600">
                  {tl?.full_name?.charAt(0)?.toUpperCase() || "A"}
                </div>
              )}
            </div>
            <h1 className="font-display text-lg font-bold text-gray-900">{tl?.full_name}</h1>
            <span className="mt-1 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-yellow-700">
              Ambassador
            </span>
            {tl?.is_verified && (
              <div className="mt-1 flex items-center justify-center gap-1">
                <svg className="h-4 w-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-brand-600 font-medium">{t("dashboard.verified")}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-brand-500 shadow-sm p-6 mb-6 text-center">
            <div className="mx-auto mb-3 h-14 w-14 overflow-hidden rounded-full bg-purple-100">
              {tl?.avatar_url ? (
                <img
                  src={tl.avatar_url}
                  alt={tl?.full_name ? `${tl.full_name} avatar` : "Team Leader avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-purple-600">
                  {tl?.full_name?.charAt(0)?.toUpperCase() || "T"}
                </div>
              )}
            </div>
            <h1 className="font-display text-lg font-bold text-gray-900">{tl?.full_name}</h1>
            {tl?.company_name && <p className="text-sm text-gray-500">{tl.company_name}</p>}
            {tl?.is_verified && (
              <div className="mt-1 flex items-center justify-center gap-1">
                <svg className="h-4 w-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-brand-600 font-medium">{t("dashboard.verified")}</span>
              </div>
            )}
            {tl?.tl_welcome_message && (
              <p className="mt-3 text-sm text-gray-600 italic border-t border-gray-100 pt-3">"{tl.tl_welcome_message}"</p>
            )}
          </div>
        )}

        {/* Registration form */}
        <div className="py-8 px-0 sm:bg-white sm:rounded-3xl sm:border sm:border-brand-500 sm:shadow-sm sm:px-10">
          <div className="mb-8 text-center">
            <h2 className="mb-1 font-display text-[1.7rem] font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">
              {t("join_common.create_account_title")}
            </h2>
            {!isAdminInvite && (
              <p className="text-sm text-gray-500">
                {t("join_token.subtitle")}
              </p>
            )}
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-3xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
          )}
          {actionData?.infoKey === "phone_otp_sent" && (
            <div className="mb-4 rounded-3xl bg-brand-50 border border-brand-200 p-4 text-sm text-brand-700">
              {t("join_referral.phone_otp_sent")}
            </div>
          )}

          <Form method="post" className="flex flex-col gap-5 [&_.input]:border [&_.input]:border-solid [&_.input]:border-accent-500 [&_.input]:shadow-none [&_.input:focus]:border-brand-500 [&_.input:focus]:ring-brand-500/20">

            {/* Email — locked */}
            <div>
              <label htmlFor="email" className="label">{t("join_request.email")}</label>
              <input
                id="email"
                type="email"
                value={invitedEmail || ""}
                disabled
                className="input w-full rounded-full !pl-4 bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-400">{t("join_token.email_locked")}</p>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="label">{t("join_request.first_name")}</label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  defaultValue=""
                  className="input w-full rounded-full !pl-4"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="label">{t("join_request.last_name")}</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  defaultValue=""
                  className="input w-full rounded-full !pl-4"
                />
              </div>
            </div>

            {/* Country & City */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="country" className="label">{t("profile.form.country")}</label>
                <select
                  id="country"
                  name="country"
                  className="input h-11 w-full rounded-full bg-white !pl-4 appearance-none"
                  style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none" }}
                  required
                  value={countryValue}
                  onChange={(event) => {
                    const nextCountryValue = event.target.value;
                    setCountryValue(nextCountryValue);
                    if (!languageTouched) {
                      const resolved = resolveSupportedCountry(nextCountryValue, locale);
                      if (resolved) {
                        setLanguageValue(getSuggestedLocaleForCountry(resolved.code, detectedLocale));
                      }
                    }
                  }}
                >
                  <option value="" disabled>{" "}</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="city" className="label">{t("profile.form.city")}</label>
                <CityAutocomplete
                  name="city"
                  placeIdName="cityPlaceId"
                  required
                  countryCode={countryValue || undefined}
                  className="input w-full rounded-full bg-white !pl-4"
                />
              </div>
            </div>

            {/* DOB & Language */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="dateOfBirth" className="label">{t("register.form.date_of_birth")}</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={dateInputRef}
                    id="dateOfBirth"
                    type="text"
                    inputMode="numeric"
                    autoComplete="bday"
                    required
                    value={formatDobMaskedValue(dateOfBirthDigits)}
                    onChange={(event) => {
                      const nextDigits = event.currentTarget.value.replace(/[^\d]/g, "").slice(0, 8);
                      dobCaretModeRef.current = nextDigits.length < dateOfBirthDigits.length ? "backward" : "forward";
                      setDateOfBirthDigits(nextDigits);
                    }}
                    onKeyDown={(event) => {
                      if (event.metaKey || event.ctrlKey || event.altKey) return;
                      if (/^\d$/.test(event.key)) {
                        event.preventDefault();
                        dobCaretModeRef.current = "forward";
                        setDateOfBirthDigits((current) => (current.length >= 8 ? current : `${current}${event.key}`));
                        return;
                      }
                      if (event.key === "Backspace" || event.key === "Delete") {
                        event.preventDefault();
                        dobCaretModeRef.current = "backward";
                        setDateOfBirthDigits((current) => current.slice(0, -1));
                        return;
                      }
                      if (event.key === "Tab" || event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") return;
                      if (event.key === "/") event.preventDefault();
                    }}
                    onPaste={(event) => {
                      event.preventDefault();
                      const pastedDigits = event.clipboardData.getData("text").replace(/[^\d]/g, "");
                      if (!pastedDigits) return;
                      dobCaretModeRef.current = "forward";
                      setDateOfBirthDigits((current) => `${current}${pastedDigits}`.slice(0, 8));
                    }}
                    onFocus={(event) => {
                      const pos = getDobCaretPosition(dateOfBirthDigits.length, "forward");
                      event.currentTarget.setSelectionRange(pos, pos);
                    }}
                    onClick={(event) => {
                      const pos = getDobCaretPosition(dateOfBirthDigits.length, "forward");
                      event.currentTarget.setSelectionRange(pos, pos);
                    }}
                    placeholder={dobHint}
                    className="input h-11 w-[10rem] rounded-full bg-white !pl-5 !text-[16px] !leading-[1.2]"
                  />
                  <input type="hidden" name="dateOfBirth" value={dateOfBirthIsoValue} readOnly />
                  <div className="relative h-11 w-11">
                    <input
                      ref={datePickerRef}
                      type="date"
                      aria-label={t("join_referral.open_calendar")}
                      min={earliestDob}
                      max={latestDob}
                      value={dateOfBirthIsoValue || latestDob}
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      onChange={(event) => {
                        const isoValue = event.target.value;
                        if (!isoValue) return;
                        setDateOfBirthDigits(formatDobForDisplay(isoValue).replace(/[^\d]/g, "").slice(0, 8));
                      }}
                    />
                    <div className="pointer-events-none flex h-11 w-11 items-center justify-center rounded-full border border-accent-500 bg-white text-gray-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <p className="mt-1 ml-4 text-xs text-gray-500">{dobHint}</p>
              </div>
              <div>
                <label htmlFor="language" className="label">{t("register.form.language")}</label>
                <select
                  id="language"
                  name="language"
                  className="input h-11 w-full rounded-3xl bg-white !pl-4 appearance-none"
                  style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none" }}
                  required
                  value={languageValue}
                  onChange={(event) => {
                    setLanguageTouched(true);
                    const nextValue = event.target.value as SupportedLocale;
                    if (isSupportedLocale(nextValue)) setLanguageValue(nextValue);
                  }}
                >
                  {Object.entries(localeLabels).map(([langCode, label]) => (
                    <option key={langCode} value={langCode}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Phone + OTP verification */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
              <p className="text-sm font-medium text-gray-700">{t("join_referral.phone_verification_title")}</p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="phone" className="label">{t("profile.form.phone_number")}</label>
                  <div className="flex items-stretch">
                    <span className="shrink-0 rounded-r-none rounded-l-full bg-gray-100 px-3 py-2.5 text-sm text-gray-700 flex items-center justify-center border border-accent-500 border-r-0 shadow-none md:px-4 min-w-[72px]">
                      {phonePrefix}
                    </span>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel-national"
                      className="input w-full rounded-l-none rounded-r-full bg-white"
                      value={phoneValue}
                      onChange={(e) => {
                        setPhoneValue(e.target.value);
                        setPhoneOtpSent(false);
                        setPhoneVerified(false);
                        setPhoneOtpCode("");
                      }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  name="intent"
                  value="send_phone_otp"
                  formNoValidate
                  disabled={isSubmitting || !phoneValue || !countryValue}
                  className="btn-secondary rounded-full text-sm px-5 py-2.5 whitespace-nowrap disabled:opacity-50"
                >
                  {phoneOtpSent ? t("join_referral.phone_send_code_sent") : t("join_referral.phone_send_code")}
                </button>
              </div>

              {phoneOtpSent && (
                <div>
                  <label htmlFor="phoneOtpCode" className="label">{t("join_referral.phone_code_label")}</label>
                  <input
                    id="phoneOtpCode"
                    name="phoneOtpCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="input w-full rounded-full !pl-4"
                    maxLength={6}
                    value={phoneOtpCode}
                    onChange={(e) => setPhoneOtpCode(e.target.value)}
                  />
                </div>
              )}

              {/* Hidden fields to preserve phone values for the register intent */}
              <input type="hidden" name="country" value={countryValue} />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  pattern="(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
                  className="input w-full rounded-full !pl-4 !pr-10"
                  value={passwordValue}
                  onChange={(event) => setPasswordValue(event.target.value)}
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
                <li className={`flex items-center gap-2 ${passwordValue.length >= 8 ? "text-green-600" : "text-gray-500"}`}>
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

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="label">{t("auth.confirm_password")}</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                className="input w-full rounded-full !pl-4"
              />
            </div>

            {/* Legal */}
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-gray-600">
                <input type="checkbox" name="acceptTerms" required className="mt-1 rounded border-gray-300" />
                <span>
                  {t("join_referral.legal_accept_terms_prefix")}{" "}
                  <Link to="/terms" target="_blank" className="text-brand-600 hover:underline">{t("legal.terms_of_service")}</Link>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-600">
                <input type="checkbox" name="acceptPrivacy" required className="mt-1 rounded border-gray-300" />
                <span>
                  {t("join_referral.legal_accept_privacy_prefix")}{" "}
                  <Link to="/privacy-policy" target="_blank" className="text-brand-600 hover:underline">{t("legal.privacy_policy")}</Link>
                </span>
              </label>
            </div>

            <button
              type="submit"
              name="intent"
              value="register"
              disabled={isSubmitting}
              className="btn-primary mx-auto mt-4 flex rounded-full px-8 py-3 font-bold disabled:opacity-50"
            >
              {isSubmitting ? "..." : t("join_token.register")}
            </button>

            <p className="text-xs text-gray-500 text-center">
              {t("auth.have_account")}{" "}
              <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">{t("auth.sign_in")}</Link>
            </p>
          </Form>
        </div>
      </div>
    </div>
  );
}
