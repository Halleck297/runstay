import { useFetcher, useNavigate } from "react-router";
import { getListingPublicId } from "~/lib/publicIds";
import { useI18n } from "~/hooks/useI18n";
import { getPublicDisplayName, getPublicInitial } from "~/lib/user-display";

const PRICE_FORMATTER = new Intl.NumberFormat("en-US");

function formatCurrencyAmount(value: number, currency: string | null | undefined): string {
  const safeCurrency = (currency || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${safeCurrency} ${PRICE_FORMATTER.format(value)}`;
  }
}


interface ListingCardCompactProps {
  listing: {
    id: string;
    short_id?: string | null;
    listing_type: "room" | "bib" | "room_and_bib";
    hotel_name: string | null;
    room_count: number | null;
    room_type: "single" | "twin" | "double" | "double_shared" | "double_single_use" | "triple" | "quadruple" | null;
    bib_count: number | null;
    check_in: string | null;
    check_out: string | null;
    price: number | null;
    price_negotiable: boolean;
    transfer_type: "official_process" | "package" | "contact" | null;
    associated_costs: number | null;
    currency?: string | null;
    cost_notes?: string | null;
    author: {
      id: string;
      full_name: string | null;
      company_name: string | null;
      user_type: "tour_operator" | "private";
      is_verified: boolean;
      avatar_url?: string | null;
    };
    event: {
      id: string;
      name: string;
      slug: string | null;
      country: string;
      event_date: string;
    };
  };
  isUserLoggedIn?: boolean;
  isSaved?: boolean;
  currentUserId?: string | null;
  className?: string;
}

function getLastMinuteThreshold(listingType: "room" | "bib" | "room_and_bib"): number {
  if (listingType === "room") return 15;
  return 21;
}

function parseDateStable(rawDate: string): Date {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate || "");
  if (dateOnlyMatch) {
    const yyyy = Number(dateOnlyMatch[1]);
    const mm = Number(dateOnlyMatch[2]) - 1;
    const dd = Number(dateOnlyMatch[3]);
    return new Date(Date.UTC(yyyy, mm, dd));
  }
  return new Date(rawDate);
}

function formatDateStable(
  rawDate: string,
  locale: string | string[],
  options: Intl.DateTimeFormatOptions
): string {
  const parsed = parseDateStable(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate;
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(parsed);
}

// Helper: calcola se è Last Minute (soglia variabile per tipo)
function isLastMinute(eventDate: string, listingType: "room" | "bib" | "room_and_bib"): boolean {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const event = parseDateStable(eventDate);
  const eventUtc = Date.UTC(event.getUTCFullYear(), event.getUTCMonth(), event.getUTCDate());
  const diffDays = Math.floor((eventUtc - todayUtc) / (1000 * 60 * 60 * 24));
  const thresholdDays = getLastMinuteThreshold(listingType);
  return diffDays <= thresholdDays && diffDays >= 0;
}

// Helper: formatta room type (versione breve)
function formatRoomTypeShort(roomType: string | null): string {
  if (!roomType) return "Room";

  const labels: Record<string, string> = {
    single: "Single",
    double: "Double",
    double_single_use: "Double SU",
    twin: "Twin",
    twin_shared: "Twin Shared",
    triple: "Triple",
    quadruple: "Quad"
  };

  return labels[roomType] || roomType;
}

type ToListingMeta = {
  room_type_prices?: Record<string, number>;
  room_type_prices_converted?: Record<string, Record<string, number>>;
};

function parseToMeta(raw: string | null | undefined): ToListingMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { to_meta?: unknown };
    if (parsed?.to_meta && typeof parsed.to_meta === "object" && !Array.isArray(parsed.to_meta)) {
      return parsed.to_meta as ToListingMeta;
    }
  } catch {
    // legacy plain text
  }
  return null;
}

// Helper: genera slug dal nome evento (fallback se slug è null)
function getEventSlug(event: { name: string; slug: string | null }): string {
  if (event.slug) return event.slug;
  return event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ListingCardCompact({
  listing,
  isUserLoggedIn = true,
  isSaved = false,
  currentUserId = null,
  className = "",
}: ListingCardCompactProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const saveFetcher = useFetcher();
  const isSavedOptimistic = saveFetcher.formData
    ? saveFetcher.formData.get("action") === "save"
    : isSaved;
  const canSaveListing = isUserLoggedIn && !!currentUserId && listing.author.id !== currentUserId;
  const toMeta = parseToMeta(listing.cost_notes);
  const roomTypePrices =
    (toMeta?.room_type_prices_converted &&
      listing.currency &&
      toMeta.room_type_prices_converted[String(listing.currency).toUpperCase()]) ||
    toMeta?.room_type_prices ||
    {};
  const roomTypePriceValues = Object.values(roomTypePrices).filter((v): v is number => typeof v === "number" && v > 0);
  const minRoomTypePrice = roomTypePriceValues.length > 0 ? Math.min(...roomTypePriceValues) : null;

  const eventDateShort = formatDateStable(listing.event.event_date, "en-GB", {
    day: "numeric",
    month: "short",
  });

  const isLM = isLastMinute(listing.event.event_date, listing.listing_type);
  const isTourOperator = listing.author.user_type === "tour_operator";

  // Sottotitolo compatto
  let subtitle = "";
  if (listing.listing_type === "bib") {
    subtitle = "";
  } else if (listing.listing_type === "room") {
    const roomTypeText = listing.room_type ? formatRoomTypeShort(listing.room_type) : "Room";
    subtitle = listing.room_count && listing.room_count > 1
      ? `${listing.room_count} ${roomTypeText}s`
      : roomTypeText;
  } else {
    subtitle = "";
  }

  // Badge colore
  const badgeColor = "bg-brand-500 text-white";

  // Border per TO
  const cardClass = isTourOperator
    ? "block bg-white border border-gray-200 rounded-3xl p-4 hover:shadow-md hover:border-brand-300 transition-all border-l-4 border-l-brand-500"
    : "block bg-white border border-gray-200 rounded-3xl p-4 hover:shadow-md hover:border-brand-300 transition-all";

  // Nome venditore
  const sellerName = getPublicDisplayName(listing.author);
  const sellerNameShort = sellerName.split(' ')[0];

  // Event logo path
  const eventSlug = getEventSlug(listing.event);
  const logoPath = `/logos/${eventSlug}.png`;

  const listingHref = isUserLoggedIn ? `/listings/${getListingPublicId(listing)}` : "/login";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(listingHref)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(listingHref);
        }
      }}
      className={`${cardClass} relative ${className} cursor-pointer`}
    >
      {/* Save button - absolute top right */}
      {canSaveListing && (
        <div className="absolute top-3 right-3 z-10">
          <saveFetcher.Form
            method="post"
            action="/api/saved"
            onClick={(e) => e.stopPropagation()}
          >
            <input type="hidden" name="listingId" value={listing.id} />
            <input type="hidden" name="action" value={isSavedOptimistic ? "unsave" : "save"} />
            <button
              type="submit"
              onClick={(e) => e.preventDefault()}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                saveFetcher.submit(
                  { listingId: listing.id, action: isSavedOptimistic ? "unsave" : "save" },
                  { method: "post", action: "/api/saved" }
                );
              }}
              className={`p-1 rounded-full transition-colors ${
                isSavedOptimistic
                  ? "text-red-500"
                  : "text-gray-400 hover:text-red-500"
              }`}
              title={isSavedOptimistic ? "Remove from saved" : "Save listing"}
            >
              <svg
                className="h-5 w-5"
                fill={isSavedOptimistic ? "currentColor" : "none"}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>
          </saveFetcher.Form>
        </div>
      )}

      {/* Main content wrapper with logo on right */}
      <div className="flex gap-3">
        {/* Left content */}
        <div className="flex-1 min-w-0">
          {/* Header row: Badges */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${badgeColor}`}>
              {listing.listing_type === "bib" ? t("common.bib") : listing.listing_type === "room" ? "Hotel" : "Package"}
            </span>
            {isLM && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-accent-500 text-white">Last Minute</span>
            )}
          </div>

          {/* Titolo evento */}
          <h3 className="font-display text-base font-bold text-gray-900 leading-tight mb-0.5 line-clamp-1">
            {listing.event.name}
          </h3>

          {/* Race Day */}
          <div className="flex items-center gap-1.5 text-xs text-gray-900 mb-2">
            <svg className="h-3.5 w-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium">{t("listings.race_day")}: {eventDateShort}</span>
          </div>

          {/* Sottotitolo: cosa offre */}
          {subtitle && (
            <p className="text-sm font-medium text-brand-600">
              {subtitle}
            </p>
          )}
          {listing.hotel_name && (
            <>
              <p className="text-sm text-gray-600 truncate">
                {listing.hotel_name}
              </p>
              {listing.check_in && listing.check_out && (
                <>
                  <p className={listing.listing_type === "room" || listing.listing_type === "room_and_bib" ? "text-sm font-medium text-gray-900" : "text-xs text-gray-500"}>
                    {formatDateStable(listing.check_in, "en-GB", { day: "numeric", month: "short" })} -&gt;{" "}
                    {formatDateStable(listing.check_out, "en-GB", { day: "numeric", month: "short" })}
                  </p>
                  {listing.listing_type === "room_and_bib" && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-2">BIB AVAILABLE</p>
                  )}
                </>
              )}
              {(!listing.check_in || !listing.check_out) && <div className="mb-2" />}
            </>
          )}
          {!listing.hotel_name && <div className="mb-2" />}

          {listing.listing_type === "bib" && !isTourOperator && (
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-2">NAME CHANGE REQUIRED</p>
          )}
        </div>

        {/* Right: Event logo */}
        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center self-center">
          <img
            src={logoPath}
            alt={`${listing.event.name} logo`}
            className="w-full h-full object-contain p-1"
            onError={(e) => {
              // Hide if logo doesn't exist
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      </div>

      {/* Footer: Seller + View Details + Prezzo */}
      <div className="flex items-center pt-2 border-t border-gray-100">
        {isUserLoggedIn ? (
          <>
            {/* Left: Seller con avatar */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-600 text-sm font-medium flex-shrink-0">
                {listing.author.avatar_url ? (
                  <img
                    src={listing.author.avatar_url}
                    alt={getPublicDisplayName(listing.author)}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  getPublicInitial(listing.author)
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {sellerNameShort}
                  </span>
                  {listing.author.is_verified && (
                    <svg className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {listing.author.user_type === "tour_operator" ? "Tour Operator" : "Runner"}
                </p>
              </div>
            </div>

            {/* Center: View Details button */}
            <div className="flex-1 flex justify-center">
              <span className="bg-accent-500 text-white text-xs font-medium uppercase tracking-wide px-4 py-1.5 rounded-full">
                View
              </span>
            </div>

            {/* Right: Prezzo */}
            <div className="text-right flex-1 flex justify-end">
              {listing.listing_type === "bib" && listing.associated_costs ? (
                <p className="text-base font-bold text-gray-900">
                  {formatCurrencyAmount(listing.associated_costs, listing.currency)}
                </p>
              ) : listing.listing_type === "room" && minRoomTypePrice ? (
                <p className="text-base font-bold text-gray-900">
                  From {formatCurrencyAmount(minRoomTypePrice, listing.currency)}
                </p>
              ) : listing.price ? (
                <p className="text-base font-bold text-gray-900">
                  {formatCurrencyAmount(listing.price, listing.currency)}
                </p>
              ) : (
                <p className="text-sm font-bold text-gray-900">Contact</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500 italic w-full text-center">
            Login to view details
          </p>
        )}
      </div>
    </div>
  );
}
