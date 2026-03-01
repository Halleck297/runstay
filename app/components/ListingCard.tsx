import { useFetcher, useNavigate } from "react-router";
import { getListingPublicId } from "~/lib/publicIds";
import { useI18n } from "~/hooks/useI18n";
import { getPublicDisplayName, getPublicInitial } from "~/lib/user-display";


interface ListingCardProps {
  listing: {
    id: string;
    short_id?: string | null;
    title: string;
    listing_type: "room" | "bib" | "room_and_bib";
    hotel_name: string | null;
    hotel_stars: number | null;
    hotel_rating?: number | null;
    room_count: number | null;
    room_type: "single" | "twin" | "double" | "double_shared" | "double_single_use" | "triple" | "quadruple" | null;
    bib_count: number | null;
    price: number | null;
    price_negotiable: boolean;
    transfer_type: "official_process" | "package" | "contact" | null;
    associated_costs: number | null;
    currency?: string | null;
    cost_notes?: string | null;
    check_in: string | null;
    check_out: string | null;
    created_at: string;
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
      card_image_url?: string | null;
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

// Helper: formatta room type
function formatRoomType(roomType: string | null): string {
  if (!roomType) return "";

  const labels: Record<string, string> = {
    single: "Single Room",
    double: "Double Room",
    double_single_use: "Double Single Use",
    twin: "Twin Room",
    twin_shared: "Twin Shared",
    triple: "Triple Room",
    quadruple: "Quadruple"
  };

  return labels[roomType] || roomType;
}

type ToListingMeta = {
  room_types?: string[];
  room_type_prices?: Record<string, number>;
  room_type_prices_converted?: Record<string, Record<string, number>>;
  flexible_dates?: boolean;
  extra_night?: { enabled?: boolean };
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

export function ListingCard({
  listing,
  isUserLoggedIn = true,
  isSaved = false,
  currentUserId = null,
  className = "",
}: ListingCardProps) {
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

  const eventDate = formatDateStable(listing.event.event_date, "en-GB", {
    day: "numeric",
    month: "long",
  });

  const mainTitle = listing.event.name;
  const isLM = isLastMinute(listing.event.event_date, listing.listing_type);
  const isTourOperator = listing.author.user_type === "tour_operator";
  const needsNameChange = listing.transfer_type === "official_process";
  const bibCount = listing.bib_count || 1;
  const bibLabel = bibCount > 1 ? t("common.bibs") : t("common.bib");
  const eventSlug = getEventSlug(listing.event);
  const defaultEventImage = `/events/${eventSlug}.jpg`;
  const primaryEventImage = listing.event.card_image_url || defaultEventImage;

  // Sottotitolo dinamico basato sul tipo
let subtitle = "";
if (listing.listing_type === "bib") {
    subtitle = listing.bib_count && listing.bib_count > 1
    ? `${listing.bib_count} ${t("common.bibs")}`
    : t("common.bib");
} else if (listing.listing_type === "room") {
  const roomTypeText = listing.room_type ? formatRoomType(listing.room_type) : "Room";
  subtitle = listing.room_count && listing.room_count > 1
    ? `${listing.room_count} ${roomTypeText}s Available`
    : `${roomTypeText} Available`;
} else {
  subtitle = t("edit_listing.room_plus_bib");
}

  // Determina badge e colore
  let badgeText = "";
  let badgeColor = "";
  
  if (listing.listing_type === "bib") {
    badgeText = t("common.bib");
    badgeColor = "bg-brand-500 text-white";
  } else if (listing.listing_type === "room") {
    badgeText = "Hotel";
    badgeColor = "bg-brand-500 text-white";
  } else {
    badgeText = "Package";
    badgeColor = "bg-brand-500 text-white";
  }

  // Border per TO (gold border)
  const cardClass = isTourOperator
  ? "card overflow-hidden transition-all border-2 border-amber-400 h-full w-full md:w-[380px] md:h-[630px] md:mx-auto md:rounded-[32px] flex flex-col [box-shadow:0_4px_15px_rgba(0,0,0,0.25)]"
  : "card overflow-hidden transition-all h-full w-full md:w-[380px] md:h-[630px] md:mx-auto md:rounded-[32px] flex flex-col [box-shadow:0_4px_15px_rgba(0,0,0,0.25)]";


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
      className={`${cardClass} ${className} cursor-pointer`}
    >
      {/* Sezione Immagine */}
      <div className="md:flex md:justify-center md:pt-5">
        <div className="relative md:h-[260px] md:w-[350px]">
          <img
            src={primaryEventImage}
            alt={listing.event.name}
            className="w-full aspect-video object-cover rounded-2xl md:h-full md:w-full md:aspect-auto md:rounded-[24px]"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const fallbackAbsolute = new URL(defaultEventImage, window.location.origin).href;
              if (!target.dataset.triedFallback && target.src !== fallbackAbsolute) {
                target.dataset.triedFallback = "true";
                target.src = defaultEventImage;
                return;
              }
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div className="w-full aspect-video bg-gradient-to-br from-brand-100 to-brand-200 items-center justify-center rounded-2xl md:h-full md:w-full md:aspect-auto md:rounded-[24px]" style={{ display: 'none' }}>
            <svg className="h-12 w-12 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          {/* Badge sovrapposti all'immagine */}
          <div className="absolute top-3 left-3 flex gap-2">
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold uppercase shadow-[0_4px_10px_rgba(0,0,0,0.22)] ${badgeColor}`}>
              {badgeText}
            </span>
            {isLM && (
              <span className="px-3 py-1.5 rounded-full text-sm font-semibold uppercase bg-accent-500 text-white shadow-[0_4px_10px_rgba(0,0,0,0.22)]">Last Minute</span>
            )}
          </div>

          {/* Save button sovrapposto all'immagine */}
          {canSaveListing && (
            <saveFetcher.Form
              method="post"
              action="/api/saved"
              onClick={(e) => e.stopPropagation()}
              className="absolute top-3 right-3"
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
                className={`p-2 rounded-full bg-white/95 ring-1 ring-gray-300 shadow-sm transition-colors ${
                  isSavedOptimistic
                    ? "text-red-500 hover:text-red-600"
                    : "text-accent-500 hover:text-accent-600"
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
          )}
        </div>
      </div>

      {/* Contenuto con padding */}
      <div className="p-5 flex flex-col">
        {/* Titolo - altezza minima per 2 righe */}
        <h3 className="font-display text-lg font-bold text-gray-900 mb-0 text-left min-h-[2.4rem] flex items-start justify-start">
          <span>{mainTitle}</span>
        </h3>

      {/* Race Day */}
      <div className="flex items-center justify-start gap-1.5 text-sm text-gray-900 mb-3">
        <svg className="h-4 w-4 text-[#0C78F3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="font-medium">{t("listings.race_day")}: {eventDate}</span>
      </div>
      {listing.listing_type !== "bib" && listing.hotel_name && (
        <div className="mb-3 flex items-center justify-start gap-1.5 text-sm text-gray-900">
          <svg className="h-4 w-4 text-[#0C78F3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.243-4.243a8 8 0 1111.313 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-medium truncate">{listing.hotel_name}</span>
        </div>
      )}
      {listing.listing_type === "room_and_bib" && (
        <div className="mb-3 flex items-center justify-start gap-1.5 text-sm text-gray-900">
          <svg className="h-4 w-4 text-[#0C78F3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          <span className="font-medium truncate">
            {bibCount} {bibLabel} Available{needsNameChange ? " / Name change required" : ""}
          </span>
        </div>
      )}
      {listing.listing_type === "room" && <div className="mb-3 h-5" />}
      {listing.listing_type === "bib" && (
        <>
          <div className="mb-3 h-5" />
          <div className="mb-3 h-5" />
        </>
      )}

      {/* Content section - flex-grow to fill available space */}
      <div className="flex flex-col">
        {/* Layout differenziato per tipo */}
        {listing.listing_type === "bib" ? (
          /* BIB ONLY - Layout centrato e più prominente */
          <div className="flex flex-col items-center justify-start text-center">
            <div className="w-full md:w-[350px] md:h-[65px] rounded-2xl bg-[#ECF4FE] px-4 py-3 flex items-center justify-center overflow-hidden">
              <div className="w-full text-center">
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 text-[#0C78F3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  <p className="text-[17px] font-semibold text-gray-900">
                    {bibCount} {bibLabel} Available
                  </p>
                </div>
                {needsNameChange && (
                  <p className="text-xs text-orange-700 mt-1">Name change required</p>
                )}
              </div>
            </div>
          </div>
        ) : listing.listing_type === "room" ? (
          /* ROOM ONLY - Layout con hotel info prominente e centrato */
          <div className="flex flex-col items-center justify-start text-center">
            <div className="w-full md:w-[350px] md:h-[65px] rounded-2xl bg-[#ECF4FE] px-4 py-3 flex items-center justify-center overflow-hidden">
              <div className="w-full text-center">
                <p className="text-[17px] font-semibold text-gray-900">
                  {listing.room_type ? formatRoomType(listing.room_type) : "Room"}
                </p>
                {listing.check_in && listing.check_out && (
                  <div className="mt-1 flex items-center justify-center gap-0.5 text-base text-gray-700">
                    <span>{formatDateStable(listing.check_in, "en-GB", { day: "numeric", month: "short" })}</span>
                    <svg className="h-4 w-12 flex-shrink-0 text-[#0C78F3]" fill="none" viewBox="0 0 32 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2 12h24m-6-6l6 6-6 6" />
                    </svg>
                    <span>{formatDateStable(listing.check_out, "en-GB", { day: "numeric", month: "short" })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* PACKAGE (room_and_bib) - Layout centrato con contenuto in basso */
          <div className="flex flex-col items-center justify-start text-center">
            <div className="w-full md:w-[350px] md:h-[65px] rounded-2xl bg-[#ECF4FE] px-4 py-3 flex items-center justify-center overflow-hidden">
              <div className="w-full text-center">
                <p className="text-[17px] font-semibold text-gray-900">
                  {listing.room_type ? formatRoomType(listing.room_type) : "Room"}
                </p>
                {listing.check_in && listing.check_out && (
                  <div className="mt-1 flex items-center justify-center gap-0.5 text-base text-gray-700">
                    <span>{formatDateStable(listing.check_in, "en-GB", { day: "numeric", month: "short" })}</span>
                    <svg className="h-4 w-12 flex-shrink-0 text-[#0C78F3]" fill="none" viewBox="0 0 32 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2 12h24m-6-6l6 6-6 6" />
                    </svg>
                    <span>{formatDateStable(listing.check_out, "en-GB", { day: "numeric", month: "short" })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Footer - mt-auto to push to bottom */}
      <div className="mt-2 pt-3 flex items-center justify-between">
        {isUserLoggedIn ? (
          <>
            {/* Author */}
            <div className="flex items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
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
              <div>
               <div className="flex items-center gap-1">
  <p className="text-base font-semibold text-gray-900 truncate">
    {getPublicDisplayName(listing.author)}
  </p>
  {listing.author.is_verified && (
      <svg className="h-4 w-4 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
  )}
</div>
<p className="text-sm text-gray-900">
  {listing.author.user_type === "tour_operator" ? "Tour Operator" : "Runner"}
  {listing.author.is_verified && " • Verified"}
</p>

              </div>
            </div>

            {/* Price */}
            <div className="text-right">
              {listing.listing_type === "bib" && listing.associated_costs ? (
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrencyAmount(listing.associated_costs, listing.currency)}
                </p>
              ) : listing.listing_type === "room" && minRoomTypePrice ? (
                <p className="text-xl font-bold text-gray-900">
                  From {formatCurrencyAmount(minRoomTypePrice, listing.currency)}
                </p>
              ) : listing.price ? (
                <>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrencyAmount(listing.price, listing.currency)}
                  </p>
                  {listing.price_negotiable && (
                    <p className="text-xs text-gray-500">Negotiable</p>
                  )}
                </>
              ) : (
                <p className="text-sm font-bold text-gray-900">Contact</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 italic w-full text-center">
            Login to view seller details and pricing
          </p>
        )}
      </div>
      {/* CTA button - dopo il footer */}
{isUserLoggedIn && (
  <div className="mt-3">
    <button className="w-full btn-primary text-sm uppercase py-2 rounded-full">
      View Details
    </button>
  </div>
)}
      </div>{/* Fine div p-5 contenuto */}
    </div>
  );
}
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
