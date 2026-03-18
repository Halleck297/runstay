import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { createCookie, data, redirect } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { NotFoundPage } from "~/components/NotFoundPage";
import { useI18n } from "~/hooks/useI18n";
import { supabase, supabaseAdmin } from "~/lib/supabase.server";
import { createUserSession, getUserId } from "~/lib/session.server";
import { buildLocaleCookie, getLocaleLabelsForUi, isSupportedLocale, resolveLocaleForRequest, type SupportedLocale } from "~/lib/locale";
import { getDialingPrefix, getSuggestedLocaleForCountry, getSupportedCountries, resolveSupportedCountry } from "~/lib/supportedCountries";
import { checkPhoneVerificationCode, startPhoneVerification } from "~/lib/twilio-verify.server";

function normalizeEmail(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”‘’\"'`]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function getSinglePathSegment(pathname: string): string | null {
  const cleaned = pathname.replace(/^\/+|\/+$/g, "");
  if (!cleaned) return null;
  if (cleaned.includes("/")) return null;
  return decodeURIComponent(cleaned);
}

function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getDobBounds() {
  const now = new Date();
  const max = new Date(now);
  max.setFullYear(max.getFullYear() - 18);
  const min = new Date(now);
  min.setFullYear(min.getFullYear() - 75);
  return {
    minDob: toIsoDateOnly(min),
    maxDob: toIsoDateOnly(max),
  };
}

function parseDateOfBirthInput(rawValue: string, countryCode?: string): string | null {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;

  const ensureValidIso = (iso: string): string | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [year, month, day] = iso.split("-").map((part) => Number.parseInt(part, 10));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const testDate = new Date(Date.UTC(year, month - 1, day));
    const valid =
      testDate.getUTCFullYear() === year &&
      testDate.getUTCMonth() === month - 1 &&
      testDate.getUTCDate() === day;
    return valid ? iso : null;
  };

  const directIso = ensureValidIso(raw);
  if (directIso) return directIso;

  const slashMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!slashMatch) return null;

  const first = Number.parseInt(slashMatch[1], 10);
  const second = Number.parseInt(slashMatch[2], 10);
  const year = Number.parseInt(slashMatch[3], 10);
  const isUsFormat = countryCode === "US";
  const day = isUsFormat ? second : first;
  const month = isUsFormat ? first : second;

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;

  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return ensureValidIso(iso);
}

function isStrongEnoughPassword(value: string): boolean {
  return /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
}

const LEGAL_TERMS_VERSION = "2026-03-15";
const LEGAL_PRIVACY_VERSION = "2026-03-15";

async function logLegalConsent(args: {
  userId: string;
  email: string;
  locale: SupportedLocale;
  source: "join_referral";
}) {
  const now = new Date().toISOString();
  await (supabaseAdmin.from("legal_consents" as any) as any).insert({
    user_id: args.userId,
    email: args.email,
    source: args.source,
    locale: args.locale,
    terms_accepted_at: now,
    privacy_accepted_at: now,
    terms_version: LEGAL_TERMS_VERSION,
    privacy_version: LEGAL_PRIVACY_VERSION,
    created_at: now,
  });
}

type PhoneVerificationState = {
  referralCode: string;
  pendingPhoneE164?: string;
  verifiedPhoneE164?: string;
};

const phoneVerificationCookie = createCookie("runoot_phone_verification", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60,
  secrets: [process.env.SESSION_SECRET || "runoot-dev-secret"],
});

function normalizeToE164(dialingPrefix: string, rawPhone: string): string | null {
  let nationalDigits = String(rawPhone || "").replace(/[^\d]/g, "");
  const dialingDigits = dialingPrefix.replace("+", "");
  if (nationalDigits.startsWith(dialingDigits)) {
    nationalDigits = nationalDigits.slice(dialingDigits.length);
  }
  if (!nationalDigits) return null;
  return `${dialingPrefix}${nationalDigits}`;
}

async function readPhoneVerificationState(request: Request): Promise<PhoneVerificationState | undefined> {
  try {
    const parsed = (await phoneVerificationCookie.parse(request.headers.get("Cookie"))) as unknown;
    if (!parsed || typeof parsed !== "object") return undefined;
    const maybe = parsed as Record<string, unknown>;
    if (typeof maybe.referralCode !== "string") return undefined;
    return {
      referralCode: maybe.referralCode,
      pendingPhoneE164: typeof maybe.pendingPhoneE164 === "string" ? maybe.pendingPhoneE164 : undefined,
      verifiedPhoneE164: typeof maybe.verifiedPhoneE164 === "string" ? maybe.verifiedPhoneE164 : undefined,
    };
  } catch {
    return undefined;
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if ((data as any)?.mode === "referral" && (data as any)?.teamLeader) {
    const tlName = (data as any).teamLeader?.full_name || "a Team Leader";
    return [{ title: `Join Runoot - Invited by ${tlName}` }];
  }
  return [{ title: "Page Not Found - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = getSinglePathSegment(url.pathname);
  if (!code) {
    return data({ mode: "not_found", pathname: url.pathname }, { status: 404 });
  }
  const canonicalCode = code.toLowerCase();

  const detectedLocale = resolveLocaleForRequest(request, null);
  const userId = await getUserId(request);
  const phoneVerificationSession = await readPhoneVerificationState(request);
  const isPhoneVerified =
    phoneVerificationSession?.referralCode === canonicalCode &&
    typeof phoneVerificationSession.verifiedPhoneE164 === "string" &&
    phoneVerificationSession.verifiedPhoneE164.length > 0;

  const { data: teamLeader } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, company_name, user_type, avatar_url, is_verified, referral_code, tl_welcome_message")
    .ilike("referral_code", code)
    .eq("user_type", "team_leader")
    .maybeSingle();

  if (!teamLeader) {
    return data({ mode: "not_found", pathname: url.pathname }, { status: 404 });
  }

  if (userId) {
    const { data: currentUserProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, user_type")
      .eq("id", userId)
      .maybeSingle();

    const nextPath = (currentUserProfile as any)?.user_type === "tour_operator" ? "/to-panel" : "/listings";
    const showRegistrationSuccess = url.searchParams.get("registered") === "1";

    if (showRegistrationSuccess) {
      return {
        mode: "referral" as const,
        status: "registration_success" as const,
        teamLeader,
        alreadyLoggedIn: true,
        code: (teamLeader as any).referral_code,
        nextPath,
        detectedLocale,
        isPhoneVerified,
      };
    }

    const { data: existingRef } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("referred_user_id", userId)
      .single();

    if (existingRef) {
      return {
        mode: "referral" as const,
        status: "already_referred" as const,
        teamLeader,
        alreadyLoggedIn: true,
        code: (teamLeader as any).referral_code,
        nextPath,
        detectedLocale,
        isPhoneVerified,
      };
    }

    return {
      mode: "referral" as const,
      status: "needs_new_registration" as const,
      teamLeader,
      alreadyLoggedIn: true,
      code: (teamLeader as any).referral_code,
      nextPath,
      detectedLocale,
      isPhoneVerified,
    };
  }

  return {
    mode: "referral" as const,
    status: "valid" as const,
    teamLeader,
    alreadyLoggedIn: false,
    code: (teamLeader as any).referral_code,
    nextPath: "/listings",
    detectedLocale,
    isPhoneVerified,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const code = getSinglePathSegment(url.pathname);

  if (!code) {
    return data({ errorKey: "invalid_referral_code" as const }, { status: 400 });
  }
  const canonicalCode = code.toLowerCase();

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "create_account");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const country = String(formData.get("country") || "");
  const city = String(formData.get("city") || "");
  const phone = String(formData.get("phone") || "");
  const preferredLanguageRaw = String(formData.get("preferredLanguage") || "").trim().toLowerCase();
  const preferredLanguage = isSupportedLocale(preferredLanguageRaw)
    ? preferredLanguageRaw
    : resolveLocaleForRequest(request, null);
  const resolvedCountry = resolveSupportedCountry(country, preferredLanguage);
  const dateOfBirthRaw = String(formData.get("dateOfBirth") || "").trim();
  const phoneOtpCode = String(formData.get("phoneOtpCode") || "").trim();
  const termsAccepted = String(formData.get("termsAccepted") || "") === "on";
  const privacyAccepted = String(formData.get("privacyAccepted") || "") === "on";
  const currentPhoneVerification = await readPhoneVerificationState(request);
  const echoedFormValues = {
    firstName,
    lastName,
    country,
    city,
    phone: String(phone || ""),
    preferredLanguage,
    dateOfBirth: dateOfBirthRaw,
    email: String(email || ""),
    phoneOtpCode,
  };

  const updatePhoneVerificationState = async (nextState: PhoneVerificationState) =>
    phoneVerificationCookie.serialize(nextState);

  if (intent === "send_phone_otp") {
    if (!resolvedCountry) {
      return data({ errorKey: "country_unsupported" as const, formValues: echoedFormValues }, { status: 400 });
    }
    const dialingPrefix = getDialingPrefix(resolvedCountry.code);
    const phoneE164 = normalizeToE164(dialingPrefix, phone);
    if (!phoneE164) {
      return data({ errorKey: "phone_required" as const, formValues: echoedFormValues }, { status: 400 });
    }
    try {
      await startPhoneVerification(phoneE164);
    } catch (error) {
      console.error("Twilio verify start error:", error);
      return data({ errorKey: "phone_otp_send_failed" as const, formValues: echoedFormValues }, { status: 400 });
    }

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      await updatePhoneVerificationState({
        referralCode: canonicalCode,
        pendingPhoneE164: phoneE164,
      })
    );

    return data({ infoKey: "phone_otp_sent" as const, phoneOtpPending: true, phoneOtpVerified: false, formValues: echoedFormValues }, { headers });
  }

  if (intent === "verify_phone_otp") {
    if (!phoneOtpCode) {
      return data({ errorKey: "phone_otp_required" as const, formValues: echoedFormValues }, { status: 400 });
    }
    if (!resolvedCountry) {
      return data({ errorKey: "country_unsupported" as const, formValues: echoedFormValues }, { status: 400 });
    }
    const dialingPrefix = getDialingPrefix(resolvedCountry.code);
    const currentPhoneE164 = normalizeToE164(dialingPrefix, phone);
    if (!currentPhoneE164) {
      return data({ errorKey: "phone_required" as const, formValues: echoedFormValues }, { status: 400 });
    }

    const pendingPhoneE164 =
      currentPhoneVerification?.referralCode === canonicalCode ? currentPhoneVerification?.pendingPhoneE164 : undefined;
    if (!pendingPhoneE164 || pendingPhoneE164 !== currentPhoneE164) {
      return data({ errorKey: "phone_otp_send_failed" as const, formValues: echoedFormValues }, { status: 400 });
    }

    let approved = false;
    try {
      approved = await checkPhoneVerificationCode(pendingPhoneE164, phoneOtpCode);
    } catch (error) {
      console.error("Twilio verify check error:", error);
      return data({ errorKey: "phone_otp_invalid" as const, formValues: echoedFormValues }, { status: 400 });
    }

    if (!approved) {
      return data({ errorKey: "phone_otp_invalid" as const, formValues: echoedFormValues }, { status: 400 });
    }

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      await updatePhoneVerificationState({
        referralCode: canonicalCode,
        pendingPhoneE164,
        verifiedPhoneE164: pendingPhoneE164,
      })
    );

    return data({ infoKey: "phone_otp_verified" as const, phoneOtpVerified: true, formValues: echoedFormValues }, { headers });
  }

  if (!email || !password || !firstName || !lastName || !country || !city || !dateOfBirthRaw) {
    return data({ errorKey: "all_fields_required" as const }, { status: 400 });
  }
  if (!resolvedCountry) {
    return data({ errorKey: "country_unsupported" as const }, { status: 400 });
  }
  if (password.length < 8) {
    return data({ errorKey: "password_min" as const }, { status: 400 });
  }
  if (!isStrongEnoughPassword(password)) {
    return data({ errorKey: "password_requirements" as const }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return data({ errorKey: "passwords_no_match" as const }, { status: 400 });
  }
  if (!termsAccepted) {
    return data({ errorKey: "terms_required" as const }, { status: 400 });
  }
  if (!privacyAccepted) {
    return data({ errorKey: "privacy_required" as const }, { status: 400 });
  }
  const parsedDateOfBirth = parseDateOfBirthInput(dateOfBirthRaw, resolvedCountry.code);
  if (!parsedDateOfBirth) {
    return data({ errorKey: "date_of_birth_invalid" as const }, { status: 400 });
  }
  const { minDob, maxDob } = getDobBounds();
  if (parsedDateOfBirth > maxDob) {
    return data({ errorKey: "date_of_birth_too_young" as const }, { status: 400 });
  }
  if (parsedDateOfBirth < minDob) {
    return data({ errorKey: "date_of_birth_too_old" as const }, { status: 400 });
  }

  const dialingPrefix = getDialingPrefix(resolvedCountry.code);
  let normalizedNationalPhone = String(phone || "").replace(/[^\d]/g, "");
  const dialingDigits = dialingPrefix.replace("+", "");
  if (normalizedNationalPhone.startsWith(dialingDigits)) {
    normalizedNationalPhone = normalizedNationalPhone.slice(dialingDigits.length);
  }
  const phoneE164 = normalizeToE164(dialingPrefix, phone);
  if (!phoneE164) {
    return data({ errorKey: "phone_required" as const }, { status: 400 });
  }
  const normalizedPhone = normalizedNationalPhone ? `${dialingPrefix} ${normalizedNationalPhone}` : null;
  const verifiedPhoneE164 =
    currentPhoneVerification?.referralCode === canonicalCode ? currentPhoneVerification?.verifiedPhoneE164 : undefined;
  if (!verifiedPhoneE164 || verifiedPhoneE164 !== phoneE164) {
    return data({ errorKey: "phone_not_verified" as const }, { status: 400 });
  }

  const { data: teamLeader } = await supabaseAdmin
    .from("profiles")
    .select("id, referral_code")
    .ilike("referral_code", code)
    .eq("user_type", "team_leader")
    .maybeSingle();

  if (!teamLeader) {
    return data({ errorKey: "invalid_referral_code" as const }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);
  const { data: emailInvite } = await (supabaseAdmin.from("referral_invites") as any)
    .select("id, team_leader_id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  const attributedTeamLeaderId = emailInvite?.team_leader_id || (teamLeader as any).id;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        user_type: "private",
        company_name: null,
      },
    },
  });

  if (authError) {
    return data({ error: authError.message }, { status: 400 });
  }
  if (!authData.user) {
    return data({ errorKey: "registration_failed" as const }, { status: 400 });
  }

  if (!authData.session) {
    return data({
      success: true,
      emailConfirmationRequired: true,
      messageKey: "join_referral.check_email_body" as const,
    });
  }

  const now = new Date().toISOString();
  const { error: profileError } = await (supabaseAdmin.from("profiles") as any).insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    user_type: "private",
    company_name: null,
    country: resolvedCountry.nameEn,
    city: city.trim(),
    phone: normalizedPhone,
    preferred_language: preferredLanguage,
    date_of_birth: parsedDateOfBirth,
    is_verified: false,
    last_login_at: now,
  });

  if (profileError) {
    console.error("Profile creation error:", profileError);
  }

  await (supabaseAdmin.from("referrals") as any).insert({
    team_leader_id: attributedTeamLeaderId,
    referred_user_id: authData.user.id,
    referral_code_used: emailInvite ? "EMAIL_INVITE" : String((teamLeader as any).referral_code || code),
    status: "registered",
  });

  if (emailInvite) {
    await (supabaseAdmin.from("referral_invites") as any)
      .update({
        status: "accepted",
        claimed_by: authData.user.id,
        claimed_at: now,
        updated_at: now,
      })
      .eq("id", emailInvite.id);
  }

  await (supabaseAdmin.from("notifications") as any).insert({
    user_id: attributedTeamLeaderId,
    type: "referral_signup",
    title: "New referral!",
    message: `${fullName || email} joined via your referral link.`,
    data: {
      referred_user_id: authData.user.id,
      referral_code: emailInvite ? "EMAIL_INVITE" : String((teamLeader as any).referral_code || code),
    },
  });

  await logLegalConsent({
    userId: authData.user.id,
    email,
    locale: preferredLanguage,
    source: "join_referral",
  });

  const canonicalReferralCode = String((teamLeader as any).referral_code || code).toLowerCase();
  const postSignupRedirect = `/${encodeURIComponent(canonicalReferralCode)}?registered=1`;

  return createUserSession(
    authData.user.id,
    authData.session.access_token,
    authData.session.refresh_token,
    postSignupRedirect,
    {
      additionalSetCookies: [buildLocaleCookie(preferredLanguage as any), await phoneVerificationCookie.serialize("")],
    }
  );
}

export default function CatchAllRoute() {
  const { t } = useI18n();
  const loaderData = useLoaderData<typeof loader>() as any;

  if (loaderData.mode !== "referral") {
    return <NotFoundPage />;
  }

  const { status, teamLeader, nextPath, detectedLocale, isPhoneVerified: isPhoneVerifiedFromLoader } = loaderData;
  const countries = getSupportedCountries(detectedLocale);
  const [countryValue, setCountryValue] = useState("");
  const [preferredLanguageValue, setPreferredLanguageValue] = useState<SupportedLocale>(detectedLocale);
  const [preferredLanguageTouched, setPreferredLanguageTouched] = useState(false);
  const localeLabels = useMemo(() => getLocaleLabelsForUi(detectedLocale), [detectedLocale]);
  const selectedCountry = useMemo(
    () => resolveSupportedCountry(countryValue, detectedLocale),
    [countryValue, detectedLocale]
  );
  const { minDob, maxDob } = useMemo(() => getDobBounds(), []);
  const phonePrefix = selectedCountry ? getDialingPrefix(selectedCountry.code) : "+--";
  const actionData = useActionData<typeof action>() as
    | { error: string; errorKey?: never }
    | {
        errorKey:
          | "invalid_referral_code"
          | "all_fields_required"
          | "password_min"
          | "passwords_no_match"
          | "password_requirements"
          | "terms_required"
          | "privacy_required"
          | "registration_failed"
          | "country_unsupported"
          | "date_of_birth_invalid"
          | "date_of_birth_too_young"
          | "date_of_birth_too_old"
          | "phone_required"
          | "phone_not_verified"
          | "phone_otp_required"
          | "phone_otp_send_failed"
          | "phone_otp_invalid";
        error?: never;
      }
    | {
        infoKey: "phone_otp_sent" | "phone_otp_verified";
        phoneOtpPending?: boolean;
        phoneOtpVerified?: boolean;
        formValues?: {
          firstName?: string;
          lastName?: string;
          country?: string;
          city?: string;
          phone?: string;
          preferredLanguage?: SupportedLocale;
          dateOfBirth?: string;
          email?: string;
          phoneOtpCode?: string;
        };
        error?: never;
        errorKey?: never;
      }
    | {
        errorKey:
          | "invalid_referral_code"
          | "all_fields_required"
          | "password_min"
          | "passwords_no_match"
          | "password_requirements"
          | "terms_required"
          | "privacy_required"
          | "registration_failed"
          | "country_unsupported"
          | "date_of_birth_invalid"
          | "date_of_birth_too_young"
          | "date_of_birth_too_old"
          | "phone_required"
          | "phone_not_verified"
          | "phone_otp_required"
          | "phone_otp_send_failed"
          | "phone_otp_invalid";
        formValues?: {
          firstName?: string;
          lastName?: string;
          country?: string;
          city?: string;
          phone?: string;
          preferredLanguage?: SupportedLocale;
          dateOfBirth?: string;
          email?: string;
          phoneOtpCode?: string;
        };
        error?: never;
      }
    | { success: boolean; emailConfirmationRequired: boolean; message: string; messageKey?: never }
    | { success: boolean; emailConfirmationRequired: boolean; messageKey: "join_referral.check_email_body"; message?: never }
    | undefined;

  const errorMessage =
    actionData && "errorKey" in actionData
      ? actionData.errorKey === "passwords_no_match"
        ? t("auth.passwords_no_match")
        : t(`join_referral.error.${actionData.errorKey}` as any)
      : actionData && "error" in actionData
      ? actionData.error
      : null;
  const infoMessage =
    actionData && "infoKey" in actionData ? t(`join_referral.${actionData.infoKey}` as any) : null;
  const echoedFormValues = actionData && "formValues" in actionData ? actionData.formValues : undefined;
  const isPhoneVerified =
    actionData && "phoneOtpVerified" in actionData
      ? Boolean(actionData.phoneOtpVerified)
      : Boolean(isPhoneVerifiedFromLoader);
  const isPhoneOtpSent = Boolean(actionData && "infoKey" in actionData && actionData.infoKey === "phone_otp_sent");
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const dobCaretModeRef = useRef<"forward" | "backward">("forward");
  const [passwordValue, setPasswordValue] = useState("");
  const [dateOfBirthDigits, setDateOfBirthDigits] = useState(() =>
    String(echoedFormValues?.dateOfBirth || "").replace(/[^\d]/g, "").slice(0, 8),
  );
  const isUsDobFormat = countryValue === "US";
  const dobHint = isUsDobFormat ? t("join_referral.dob_hint_us") : t("join_referral.dob_hint_default");
  const dobMask = "__/__/____";
  const dobDigitSlots = [0, 1, 3, 4, 6, 7, 8, 9];

  const formatDobForDisplay = (isoDate: string) => {
    const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return isoDate;
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
  const validateDobDigits = (digits: string) => {
    if (!digits) return { iso: "", error: "" as "" | "invalid" | "too_young" | "too_old" };
    if (digits.length < 8) return { iso: "", error: "invalid" as const };
    const first = Number.parseInt(digits.slice(0, 2), 10);
    const second = Number.parseInt(digits.slice(2, 4), 10);
    const year = Number.parseInt(digits.slice(4, 8), 10);
    if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(year)) {
      return { iso: "", error: "invalid" as const };
    }
    const day = isUsDobFormat ? second : first;
    const month = isUsDobFormat ? first : second;
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const testDate = new Date(Date.UTC(year, month - 1, day));
    const isValid =
      testDate.getUTCFullYear() === year &&
      testDate.getUTCMonth() === month - 1 &&
      testDate.getUTCDate() === day;
    if (!isValid) return { iso: "", error: "invalid" as const };
    if (iso > maxDob) return { iso: "", error: "too_young" as const };
    if (iso < minDob) return { iso: "", error: "too_old" as const };
    return { iso, error: "" as const };
  };
  const clampIsoDob = (isoValue: string) => {
    if (!isoValue) return "";
    if (isoValue < minDob) return minDob;
    if (isoValue > maxDob) return maxDob;
    return isoValue;
  };
  const getDobCaretPosition = (digitCount: number, mode: "forward" | "backward" = "forward") => {
    const capped = Math.max(0, Math.min(digitCount, 8));
    if (capped >= dobDigitSlots.length) return dobMask.length;
    const nextSlot = dobDigitSlots[capped];
    return mode === "backward" ? nextSlot : nextSlot + 1;
  };

  useEffect(() => {
    if (echoedFormValues?.country) {
      setCountryValue(echoedFormValues.country);
    }
    if (echoedFormValues?.preferredLanguage && isSupportedLocale(echoedFormValues.preferredLanguage)) {
      setPreferredLanguageValue(echoedFormValues.preferredLanguage);
      setPreferredLanguageTouched(true);
    }
    if (typeof echoedFormValues?.dateOfBirth === "string") {
      setDateOfBirthDigits(echoedFormValues.dateOfBirth.replace(/[^\d]/g, "").slice(0, 8));
    }
  }, [echoedFormValues?.country, echoedFormValues?.preferredLanguage, echoedFormValues?.dateOfBirth]);

  useEffect(() => {
    const input = dateInputRef.current;
    if (!input || document.activeElement !== input) return;
    const mode = dobCaretModeRef.current;
    const nextPosition = getDobCaretPosition(dateOfBirthDigits.length, mode);
    input.setSelectionRange(nextPosition, nextPosition);
    dobCaretModeRef.current = "forward";
  }, [dateOfBirthDigits, isUsDobFormat]);
  const dobValidation = validateDobDigits(dateOfBirthDigits);
  const dateOfBirthIsoValue = dobValidation.iso;
  const dobInlineError =
    dobValidation.error === "too_young"
      ? t("join_referral.error.date_of_birth_too_young")
      : dobValidation.error === "too_old"
      ? t("join_referral.error.date_of_birth_too_old")
      : dobValidation.error === "invalid"
      ? t("join_referral.error.date_of_birth_invalid")
      : "";
  const passwordHasMinLength = passwordValue.length >= 8;
  const passwordHasNumber = /\d/.test(passwordValue);
  const passwordHasSymbol = /[^A-Za-z0-9]/.test(passwordValue);
  const showPasswordCriteriaState = passwordValue.length > 0;
  const passwordCriteriaClass = (isMet: boolean) =>
    showPasswordCriteriaState ? (isMet ? "text-green-600" : "text-red-600") : "text-gray-500";

  if (status === "already_referred") {
    return (
      <div className="min-h-screen bg-[#ECF4FE] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_referral.already_connected_title")}</h1>
          <p className="text-gray-500 mb-6">{t("join_referral.already_connected_body")}</p>
          <Link to={nextPath} className="btn-primary inline-block w-full py-3">
            {nextPath === "/to-panel" ? t("join_referral.go_dashboard") : t("join_referral.browse_listings")}
          </Link>
        </div>
      </div>
    );
  }

  if (status === "registration_success") {
    return (
      <div className="min-h-screen bg-[#ECF4FE] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_referral.registration_success_title")}</h1>
          <p className="text-gray-500 mb-6">{t("join_referral.registration_success_body")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link to="/listings" className="btn-primary inline-block w-full py-3">
              {t("join_referral.browse_listings")}
            </Link>
            <Link to="/profile" className="btn-secondary inline-block w-full py-3">
              {t("nav.profile")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === "needs_new_registration") {
    return (
      <div className="min-h-screen bg-[#ECF4FE] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t("join_referral.new_runner_title")}</h1>
          <p className="text-gray-500 mb-6">{t("join_referral.new_runner_body")}</p>
          <Form method="post" action="/logout" className="mb-2">
            <button type="submit" className="btn-primary inline-block w-full py-3">{t("join_referral.logout_continue")}</button>
          </Form>
          <Link to={nextPath} className="btn-secondary inline-block w-full py-3">{t("listings.back")}</Link>
          <p className="text-xs text-gray-400 mt-4">{t("join_referral.runner_only_note")}</p>
        </div>
      </div>
    );
  }

  const tl = teamLeader as any;

  return (
    <div className="min-h-screen bg-[#ECF4FE] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white rounded-3xl border border-brand-500 shadow-sm p-6 mb-6 text-center">
          <div className="mx-auto mb-3 h-14 w-14 overflow-hidden rounded-full bg-purple-100">
            {tl?.avatar_url ? (
              <img
                src={tl.avatar_url}
                alt={tl?.full_name ? `${tl.full_name} avatar` : "Team Leader avatar"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-xl font-bold text-purple-700">{tl?.full_name?.charAt(0) || "T"}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-1">{t("join_referral.invited_by")}</p>
          <h2 className="font-display text-xl font-bold text-gray-900">{tl?.full_name || t("team_invite.team_leader")}</h2>
          {tl?.company_name && <p className="text-sm text-gray-500">{tl.company_name}</p>}
          {tl?.is_verified && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <svg className="w-4 h-4 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-brand-600 font-medium">{t("dashboard.verified")}</span>
            </div>
          )}
          {tl?.tl_welcome_message && <p className="mt-3 text-sm text-gray-600 italic border-t border-gray-100 pt-3">"{tl.tl_welcome_message}"</p>}
        </div>

        <div className="py-8 px-0 sm:bg-white sm:rounded-3xl sm:border sm:border-brand-500 sm:shadow-sm sm:px-10">
          <div className="mb-6 rounded-2xl bg-white px-4 py-3 text-center">
            <h2 className="mb-1 text-center font-display text-[1.7rem] font-bold text-gray-900 underline decoration-accent-500 underline-offset-4">{t("join_referral.join_title")}</h2>
            <p className="text-center text-sm text-gray-500">{t("join_referral.join_subtitle")}</p>
          </div>
          <div className="mb-6 mx-auto flex w-fit max-w-full flex-col gap-2 text-center">
            <p className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">{t("join_referral.runner_account_note")}</p>
            <p className="text-xs font-medium text-red-700">
              {t("join_referral.pro_access_prompt")}{" "}
              <Link to="/professional-access" className="underline underline-offset-2 text-red-700 hover:text-red-800">
                {t("join_referral.pro_access_cta")}
              </Link>
            </p>
          </div>

          {actionData && "emailConfirmationRequired" in actionData && (actionData as any).emailConfirmationRequired ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t("auth.check_email")}</h3>
              <p className="text-sm text-gray-600 mb-6">
                {"messageKey" in (actionData as any) ? t((actionData as any).messageKey) : (actionData as any).message}
              </p>
              <Link to="/login" className="btn-primary inline-block">{t("auth.go_to_login")}</Link>
            </div>
          ) : (
            <Form method="post" className="flex flex-col gap-5 [&_.input]:border [&_.input]:border-solid [&_.input]:border-accent-500 [&_.input]:shadow-none [&_.input:focus]:border-brand-500 [&_.input:focus]:ring-brand-500/20">
              {errorMessage && <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>}
              {infoMessage && <div className="rounded-3xl bg-green-50 p-4 text-sm text-green-700">{infoMessage}</div>}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="label">{t("register.form.first_name")}</label>
                  <input id="firstName" name="firstName" type="text" autoComplete="given-name" required defaultValue={echoedFormValues?.firstName || ""} className="input w-full rounded-full !pl-4" />
                </div>
                <div>
                  <label htmlFor="lastName" className="label">{t("register.form.last_name")}</label>
                  <input id="lastName" name="lastName" type="text" autoComplete="family-name" required defaultValue={echoedFormValues?.lastName || ""} className="input w-full rounded-full !pl-4" />
                </div>
                <div>
                  <label htmlFor="country" className="label">{t("profile.form.country")}</label>
                  <div className="relative">
                    <select
                      id="country"
                      name="country"
                      className="input h-11 w-full appearance-none !rounded-full !pl-10"
                      style={{ textIndent: "0.45rem" }}
                      required
                      value={countryValue}
                      onChange={(event) => {
                        const nextCountryValue = event.target.value;
                        setCountryValue(nextCountryValue);
                        if (!preferredLanguageTouched) {
                          const resolved = resolveSupportedCountry(nextCountryValue, detectedLocale);
                          if (resolved) {
                            setPreferredLanguageValue(getSuggestedLocaleForCountry(resolved.code, detectedLocale));
                          }
                        }
                      }}
                    >
                      <option value="" disabled>
                        {" "}
                      </option>
                      {countries.map((countryOption) => (
                        <option key={countryOption.code} value={countryOption.code}>
                          {countryOption.name}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <label htmlFor="city" className="label">{t("profile.form.city")}</label>
                  <input id="city" name="city" type="text" className="input w-full rounded-full !pl-4" required defaultValue={echoedFormValues?.city || ""} />
                </div>
              </div>

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
                      aria-invalid={Boolean(dobInlineError)}
                      onKeyDown={(event) => {
                        if (event.metaKey || event.ctrlKey || event.altKey) return;
                        if (/^\d$/.test(event.key)) {
                          event.preventDefault();
                          dobCaretModeRef.current = "forward";
                          setDateOfBirthDigits((current) => (current.length >= 8 ? current : `${current}${event.key}`));
                          return;
                        }
                        if (event.key === "Backspace") {
                          event.preventDefault();
                          dobCaretModeRef.current = "backward";
                          setDateOfBirthDigits((current) => current.slice(0, -1));
                          return;
                        }
                        if (event.key === "Delete") {
                          event.preventDefault();
                          dobCaretModeRef.current = "backward";
                          setDateOfBirthDigits((current) => current.slice(0, -1));
                          return;
                        }
                        if (event.key === "Tab" || event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
                          return;
                        }
                        if (event.key === "/") {
                          event.preventDefault();
                          return;
                        }
                      }}
                      onPaste={(event) => {
                        event.preventDefault();
                        const pasted = event.clipboardData.getData("text");
                        const pastedDigits = pasted.replace(/[^\d]/g, "");
                        if (!pastedDigits) return;
                        dobCaretModeRef.current = "forward";
                        setDateOfBirthDigits((current) => `${current}${pastedDigits}`.slice(0, 8));
                      }}
                      onFocus={(event) => {
                        const nextPosition = getDobCaretPosition(dateOfBirthDigits.length, "forward");
                        event.currentTarget.setSelectionRange(nextPosition, nextPosition);
                      }}
                      onClick={(event) => {
                        const nextPosition = getDobCaretPosition(dateOfBirthDigits.length, "forward");
                        event.currentTarget.setSelectionRange(nextPosition, nextPosition);
                      }}
                      placeholder={dobHint}
                      className="input h-11 w-[10rem] rounded-full !pl-5 !text-[16px] !leading-[1.2]"
                    />
                    <input
                      name="dateOfBirth"
                      type="date"
                      required
                      value={dateOfBirthIsoValue}
                      min={minDob}
                      max={maxDob}
                      className="sr-only"
                      readOnly
                      aria-hidden="true"
                    />
                    <div className="relative h-11 w-11">
                      <input
                        ref={datePickerRef}
                        type="date"
                        aria-label={t("join_referral.open_calendar")}
                        min={minDob}
                        max={maxDob}
                        value={dateOfBirthIsoValue || maxDob}
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                        onChange={(event) => {
                          const isoValue = clampIsoDob(event.target.value);
                          if (!isoValue) return;
                          if (isoValue !== event.target.value) {
                            event.currentTarget.value = isoValue;
                          }
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
                  {dobInlineError && <p className="mt-1 ml-4 text-xs text-red-600">{dobInlineError}</p>}
                </div>
                <div>
                <label htmlFor="preferredLanguage" className="label">{t("register.form.language")}</label>
                <div className="relative">
                  <select
                    id="preferredLanguage"
                    name="preferredLanguage"
                    className="input h-11 w-full appearance-none !rounded-full bg-white pr-10 !pl-10"
                    style={{ textIndent: "0.45rem" }}
                    required
                    value={preferredLanguageValue}
                    onChange={(event) => {
                      setPreferredLanguageTouched(true);
                      const nextValue = event.target.value as SupportedLocale;
                      if (isSupportedLocale(nextValue)) setPreferredLanguageValue(nextValue);
                    }}
                  >
                    {Object.entries(localeLabels).map(([langCode, label]) => (
                      <option key={langCode} value={langCode}>{label}</option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                </div>
              </div>

              <div className="mt-6 sm:w-3/5 sm:mr-auto">
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
                      defaultValue={echoedFormValues?.phone || ""}
                      className="input w-full rounded-l-none rounded-r-full bg-white"
                      required
                    />
                  </div>
                  <p className={`mt-2 ml-4 text-xs font-semibold ${isPhoneVerified ? "text-green-600" : "text-red-600"}`}>
                    {isPhoneVerified ? t("join_referral.phone_verified_badge") : t("join_referral.phone_verification_title")}
                  </p>
                  <div className="mt-2 ml-2">
                    <button
                      type="submit"
                      name="intent"
                      value="send_phone_otp"
                      formNoValidate
                      className={`btn rounded-full px-5 py-2.5 text-sm font-semibold text-white !shadow-none ${
                        isPhoneOtpSent ? "bg-green-600 hover:bg-green-700 focus:ring-green-500" : "bg-accent-500 hover:bg-accent-600 focus:ring-accent-500"
                      }`}
                    >
                      {isPhoneOtpSent ? t("join_referral.phone_send_code_sent") : t("join_referral.phone_send_code")}
                    </button>
                  </div>
                  <div className="mt-3">
                    <label htmlFor="phoneOtpCode" className="label">{t("join_referral.phone_code_label")}</label>
                    <input id="phoneOtpCode" name="phoneOtpCode" type="text" inputMode="numeric" autoComplete="one-time-code" defaultValue={echoedFormValues?.phoneOtpCode || ""} className="input w-full rounded-full !pl-4" />
                    <div className="mt-2 ml-2">
                      <button
                        type="submit"
                        name="intent"
                        value="verify_phone_otp"
                        formNoValidate
                        className={`btn rounded-full px-5 py-2.5 text-sm font-semibold text-white !shadow-none ${
                          isPhoneVerified ? "bg-green-600 hover:bg-green-700 focus:ring-green-500" : "bg-accent-500 hover:bg-accent-600 focus:ring-accent-500"
                        }`}
                      >
                        {isPhoneVerified ? t("join_referral.phone_verified_badge") : t("join_referral.phone_verify_code")}
                      </button>
                    </div>
                  </div>
                </div>

              <div className="mt-6 sm:w-3/5 sm:mr-auto">
                <label htmlFor="email" className="label">{t("auth.email")}</label>
                <input id="email" name="email" type="email" autoComplete="email" required defaultValue={echoedFormValues?.email || ""} className="input w-full rounded-full !pl-4" />
              </div>

              <div className="sm:w-3/5 sm:mr-auto">
                <label htmlFor="password" className="label">{t("auth.password")}</label>
                <input
                  id="password"
                  name="password"
                  type="text"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  minLength={8}
                  pattern="(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
                  title={t("join_referral.password_requirements_title")}
                  value={passwordValue}
                  onChange={(event) => setPasswordValue(event.target.value)}
                  className="input w-full rounded-full !pl-4"
                />
                <div className="mt-1 ml-4 space-y-0.5 text-xs">
                  <p className={passwordCriteriaClass(passwordHasMinLength)}>{t("auth.password_min")}</p>
                  <p className={passwordCriteriaClass(passwordHasNumber)}>{t("join_referral.password_rule_number")}</p>
                  <p className={passwordCriteriaClass(passwordHasSymbol)}>{t("join_referral.password_rule_symbol")}</p>
                </div>
              </div>

              <div className="sm:w-3/5 sm:mr-auto">
                <label htmlFor="confirmPassword" className="label">{t("auth.confirm_password")}</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="text"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  minLength={8}
                  pattern="(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
                  title={t("join_referral.password_requirements_title")}
                  className="input w-full rounded-full !pl-4"
                />
              </div>
              <input type="hidden" name="userType" value="private" />

              <div className="sm:w-3/5 sm:mr-auto ml-2 space-y-2">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="termsAccepted" required className="mt-0.5 h-[1.05rem] w-[1.05rem] rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span>
                    {t("join_referral.legal_accept_terms_prefix")}{" "}
                    <Link to="/terms" className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700">
                      {t("legal.terms_of_service")}
                    </Link>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="privacyAccepted" required className="mt-0.5 h-[1.05rem] w-[1.05rem] rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span>
                    {t("join_referral.legal_accept_privacy_prefix")}{" "}
                    <Link to="/privacy-policy" className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700">
                      {t("legal.privacy_policy")}
                    </Link>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                name="intent"
                value="create_account"
                className="btn-primary mx-auto mt-8 flex rounded-full px-8 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isPhoneVerified}
              >
                {t("join_referral.create_account")}
              </button>

              <p className="text-xs text-gray-500 text-center">
                {t("auth.have_account")}{" "}
                <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">{t("auth.sign_in")}</Link>
              </p>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
