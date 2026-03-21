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

/**
 * Generate a random invite token (12 chars, alphanumeric, no ambiguous chars).
 */
export function generateInviteToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Generate a unique referral slug from a full name, ensuring no collisions.
 * Used for lazy one-time migration of TLs who have referral_code but no referral_slug.
 */
async function isSlugTaken(slug: string, excludeUserId?: string): Promise<boolean> {
  const { data: existing } = await (supabaseAdmin.from("profiles") as any)
    .select("id")
    .ilike("referral_slug", slug)
    .maybeSingle();

  if (!existing) return false;
  if (excludeUserId && String(existing.id || "") === excludeUserId) return false;
  return true;
}

function buildSlugBase(fullName: string): string {
  const slugified = fullName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_REFERRAL_CODE_LENGTH);

  return slugified || "team";
}

export async function generateUniqueReferralSlug(
  _supabaseAdmin: typeof supabaseAdmin,
  fullName: string,
  excludeUserId?: string
): Promise<string> {
  const base = buildSlugBase(fullName);
  let suffix = 0;

  while (suffix < 10000) {
    const suffixText = suffix === 0 ? "" : `-${suffix}`;
    const head = base.slice(0, Math.max(1, MAX_REFERRAL_CODE_LENGTH - suffixText.length));
    const candidate = `${head}${suffixText}`;

    if (!RESERVED_REFERRAL_SLUGS.has(candidate) && !(await isSlugTaken(candidate, excludeUserId))) {
      return candidate;
    }
    suffix += 1;
  }

  const fallback = `${base.slice(0, Math.max(1, MAX_REFERRAL_CODE_LENGTH - 5))}-${Date.now().toString().slice(-5)}`;
  return RESERVED_REFERRAL_SLUGS.has(fallback) ? `r${fallback}`.slice(0, MAX_REFERRAL_CODE_LENGTH) : fallback;
}
