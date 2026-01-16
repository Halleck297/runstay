import { Link } from "@remix-run/react";

interface ListingCardCompactProps {
  listing: {
    id: string;
    listing_type: "room" | "bib" | "room_and_bib";
    hotel_name: string | null;
    room_count: number | null;
    room_type: "single" | "twin" | "double" | "double_shared" | "double_single_use" | "triple" | "quadruple" | null;
    bib_count: number | null;
    price: number | null;
    price_negotiable: boolean;
    transfer_type: "official_process" | "package" | "contact" | null;
    associated_costs: number | null;
    author: {
      id: string;
      full_name: string | null;
      company_name: string | null;
      user_type: "tour_operator" | "private";
      is_verified: boolean;
    };
    event: {
      id: string;
      name: string;
      location: string;
      event_date: string;
    };
  };
  isUserLoggedIn?: boolean;
}

// Helper: calcola se è Last Minute (≤ 21 giorni)
function isLastMinute(eventDate: string): boolean {
  const today = new Date();
  const event = new Date(eventDate);
  const diffTime = event.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 21 && diffDays >= 0;
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

export function ListingCardCompact({ listing, isUserLoggedIn = true }: ListingCardCompactProps) {
  const eventDateShort = new Date(listing.event.event_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  const isLM = isLastMinute(listing.event.event_date);
  const isTourOperator = listing.author.user_type === "tour_operator";

  // Sottotitolo compatto
  let subtitle = "";
  if (listing.listing_type === "bib") {
    subtitle = listing.bib_count && listing.bib_count > 1
      ? `${listing.bib_count} Bibs`
      : "Bib";
  } else if (listing.listing_type === "room") {
    const roomTypeText = listing.room_type ? formatRoomTypeShort(listing.room_type) : "Room";
    subtitle = listing.room_count && listing.room_count > 1
      ? `${listing.room_count} ${roomTypeText}s`
      : roomTypeText;
  } else {
    subtitle = "Room + Bib";
  }

  // Badge colore
  let badgeColor = "";
  if (listing.listing_type === "bib") {
    badgeColor = "bg-purple-100 text-purple-700";
  } else if (listing.listing_type === "room") {
    badgeColor = "bg-blue-100 text-blue-700";
  } else {
    badgeColor = "bg-green-100 text-green-700";
  }

  // Border per TO
  const cardClass = isTourOperator
    ? "block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-brand-300 transition-all border-l-4 border-l-brand-500"
    : "block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-brand-300 transition-all";

  // Nome venditore
  const sellerName = listing.author.company_name || listing.author.full_name || "Seller";
  const sellerNameShort = sellerName.split(' ')[0];

  return (
    <Link
      to={isUserLoggedIn ? `/listings/${listing.id}` : "/login"}
      className={cardClass}
    >
      {/* Header row: Badges + Data */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badgeColor}`}>
            {listing.listing_type === "bib" ? "Bib" : listing.listing_type === "room" ? "Hotel" : "Package"}
          </span>
          {isLM && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-100 text-accent-700">
              LM
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-gray-600">
          🗓 {eventDateShort}
        </span>
      </div>

      {/* Titolo evento */}
      <h3 className="font-display text-base font-bold text-gray-900 leading-tight mb-0.5 line-clamp-1">
        {listing.event.name}
      </h3>

      {/* Sottotitolo: cosa offre */}
      <p className="text-sm font-medium text-brand-600 mb-2">
        {subtitle}
        {listing.hotel_name && ` • ${listing.hotel_name}`}
      </p>

      {/* Footer: Location + Seller + Prezzo */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
        {isUserLoggedIn ? (
          <>
            {/* Left: Location + Seller */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs text-gray-600 truncate">
                📍 {listing.event.location}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-xs font-medium text-gray-700 truncate">
                  {sellerNameShort}
                </span>
                {listing.author.user_type === "tour_operator" && (
                  <span className="text-xs text-gray-500">(TO)</span>
                )}
                {listing.author.is_verified && (
                  <svg className="h-3 w-3 text-brand-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Right: Prezzo */}
            <div className="text-right flex-shrink-0">
              {listing.listing_type === "bib" && listing.associated_costs ? (
                <p className="text-base font-bold text-gray-900">
                  €{listing.associated_costs.toLocaleString()}
                </p>
              ) : listing.price ? (
                <p className="text-base font-bold text-gray-900">
                  €{listing.price.toLocaleString()}
                </p>
              ) : (
                <p className="text-xs font-medium text-gray-600">Contact</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500 italic w-full text-center">
            Login to view details
          </p>
        )}
      </div>
    </Link>
  );
}
