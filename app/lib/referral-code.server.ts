import { getSupportedLocales } from "~/lib/locale";
import { supabaseAdmin } from "~/lib/supabase.server";

const RESERVED_BASE_SLUGS = [
  "admin",
  "api",
  "app",
  "assets",
  "aviso-legal",
  "become-tl",
  "blog",
  "cdn",
  "contact",
  "cookie-policy",
  "dashboard",
  "docs",
  "en",
  "es",
  "events",
  "favicon",
  "favicon.ico",
  "forgot-password",
  "fr",
  "impressum",
  "it",
  "join",
  "join-team",
  "legal",
  "legal-notes",
  "listings",
  "login",
  "logout",
  "mentions-legales",
  "messages",
  "my-listings",
  "nl",
  "note-legali",
  "notifications",
  "ph",
  "privacy-policy",
  "profile",
  "professional-access",
  "profiles",
  "pt",
  "register",
  "report",
  "reset-password",
  "robots.txt",
  "saved",
  "sitemap.xml",
  "support",
  "terms",
  "terms-tour-operator",
  "tl-dashboard",
  "tl-events",
  "to-panel",
  "www",
];

const RESERVED_REFERRAL_SLUGS = new Set<string>([
  ...RESERVED_BASE_SLUGS,
  ...getSupportedLocales(),
]);

const MAX_REFERRAL_CODE_LENGTH = 32;

function slugifyReferralSource(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function buildBaseReferralCode(fullName: string | null | undefined, email: string | null | undefined): string {
  const emailPrefix = String(email || "").split("@")[0] || "";
  const fromName = slugifyReferralSource(String(fullName || ""));
  const fromEmail = slugifyReferralSource(emailPrefix);
  let base = (fromName || fromEmail || "runoottl").slice(0, MAX_REFERRAL_CODE_LENGTH);

  if (!base) base = "runoottl";
  if (!/^[a-z]/.test(base)) {
    base = `r${base}`.slice(0, MAX_REFERRAL_CODE_LENGTH);
  }
  return base;
}

async function isCodeTaken(code: string, excludeUserId?: string): Promise<boolean> {
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("referral_code", code)
    .maybeSingle();

  if (!existing) return false;
  if (excludeUserId && String((existing as any).id || "") === excludeUserId) return false;
  return true;
}

export async function generateUniqueReferralCode(args: {
  fullName?: string | null;
  email?: string | null;
  excludeUserId?: string;
}): Promise<string> {
  const base = buildBaseReferralCode(args.fullName, args.email);
  let suffix = 0;

  while (suffix < 10000) {
    const suffixText = suffix === 0 ? "" : String(suffix);
    const head = base.slice(0, Math.max(1, MAX_REFERRAL_CODE_LENGTH - suffixText.length));
    const candidate = `${head}${suffixText}`;

    if (!RESERVED_REFERRAL_SLUGS.has(candidate) && !(await isCodeTaken(candidate, args.excludeUserId))) {
      return candidate;
    }
    suffix += 1;
  }

  const fallback = `${base.slice(0, Math.max(1, MAX_REFERRAL_CODE_LENGTH - 5))}${Date.now().toString().slice(-5)}`;
  return RESERVED_REFERRAL_SLUGS.has(fallback) ? `r${fallback}`.slice(0, MAX_REFERRAL_CODE_LENGTH) : fallback;
}
