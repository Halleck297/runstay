import { Link, useFetcher } from "@remix-run/react";


interface ListingCardProps {
  listing: {
    id: string;
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
    check_in: string | null;
    check_out: string | null;
    created_at: string;
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
  isSaved?: boolean;
}

// Helper: genera titolo automatico
function generateTitle(listing: ListingCardProps['listing']): string {
  const eventName = listing.event.name;
  
  if (listing.listing_type === "bib") {
    return `${eventName} – Bib Available`;
  } else if (listing.listing_type === "room") {
    return `${eventName} – Room Available`;
  } else {
    return `${eventName} – Package`;
  }
}

// Helper: calcola se è Last Minute (≤ 21 giorni)
function isLastMinute(eventDate: string): boolean {
  const today = new Date();
  const event = new Date(eventDate);
  const diffTime = event.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 21 && diffDays >= 0;
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

export function ListingCard({ listing, isUserLoggedIn = true, isSaved = false }: ListingCardProps) {
    const saveFetcher = useFetcher();
  const isSavedOptimistic = saveFetcher.formData
    ? saveFetcher.formData.get("action") === "save"
    : isSaved;

  const eventDate = new Date(listing.event.event_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const mainTitle = listing.event.name;
  const isLM = isLastMinute(listing.event.event_date);
  const isTourOperator = listing.author.user_type === "tour_operator";
  const needsNameChange = listing.transfer_type === "official_process";

  // Sottotitolo dinamico basato sul tipo
let subtitle = "";
if (listing.listing_type === "bib") {
  subtitle = listing.bib_count && listing.bib_count > 1
    ? `${listing.bib_count} Bibs Available`
    : "Bib Available";
} else if (listing.listing_type === "room") {
  const roomTypeText = listing.room_type ? formatRoomType(listing.room_type) : "Room";
  subtitle = listing.room_count && listing.room_count > 1
    ? `${listing.room_count} ${roomTypeText}s Available`
    : `${roomTypeText} Available`;
} else {
  subtitle = "Package Available (Room + Bib)";
}

  // Determina badge e colore
  let badgeText = "";
  let badgeColor = "";
  
  if (listing.listing_type === "bib") {
    badgeText = "Bib";
    badgeColor = "bg-purple-100 text-purple-700";
  } else if (listing.listing_type === "room") {
    badgeText = "Hotel";
    badgeColor = "bg-blue-100 text-blue-700";
  } else {
    badgeText = "Package";
    badgeColor = "bg-green-100 text-green-700";
  }

  // Border per TO
  const cardClass = isTourOperator 
  ? "card p-5 hover:shadow-lg transition-all border-l-4 border-brand-500"
  : "card p-5 hover:shadow-lg transition-all";


  return (
    <Link 
      to={isUserLoggedIn ? `/listings/${listing.id}` : "/login"} 
      className={cardClass}
    >
            {/* Badges + Save button */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
          {badgeText}
        </span>
        {isLM && (
          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            Last Minute
          </span>
        )}
        
        {isUserLoggedIn && (
          <saveFetcher.Form 
            method="post" 
            action="/api/saved"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto"
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
              className={`p-1.5 rounded-full transition-colors ${
                isSavedOptimistic
                  ? "text-red-500 hover:text-red-600"
                  : "text-gray-400 hover:text-red-500"
              }`}
              title={isSavedOptimistic ? "Remove from saved" : "Save listing"}
            >
              <svg
                className="h-7 w-7"
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


      {/* Titolo */}
      <h3 className="font-display text-xl font-bold text-gray-900 mb-1">
  {mainTitle}
</h3>
<p className="text-sm font-medium text-brand-600 mb-3">
  {subtitle}
</p>

      {/* Location & Date */}
      <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
  <div className="flex items-center gap-1.5">
  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
      <span className="font-medium">{listing.event.location}</span>
  </div>
  <span className="text-xs font-medium text-gray-500">
    🗓 Race Day: {eventDate}
  </span>
</div>

      {/* Hotel info se presente */}
      {listing.hotel_name && (
  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
    <div className="flex items-start gap-2">
      <svg className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm leading-tight">
          {listing.hotel_name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {listing.hotel_stars && (
            <span className="text-yellow-500 text-sm">
              {"★".repeat(listing.hotel_stars)}
            </span>
          )}
          {listing.hotel_rating && (
            <span className="text-xs text-gray-600">
              ⭐ {listing.hotel_rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
)}

      {/* Includes section */}
      {isUserLoggedIn && (
  <div className="space-y-2 mb-4">
    {(listing.listing_type === "room" || listing.listing_type === "room_and_bib") && listing.room_count && (
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span className="font-medium">Room:</span>
        <span>
          {listing.room_type ? formatRoomType(listing.room_type) : "Room"}
          {listing.room_count > 1 && ` × ${listing.room_count}`}
        </span>
      </div>
    )}
    {(listing.listing_type === "room" || listing.listing_type === "room_and_bib") && listing.check_in && listing.check_out && (
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span className="font-medium">Check-in:</span>
        <span>{new Date(listing.check_in).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        <span className="text-gray-400">→</span>
        <span>{new Date(listing.check_out).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
      </div>
    )}
    {(listing.listing_type === "bib" || listing.listing_type === "room_and_bib") && listing.bib_count && (
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span className="font-medium">Bibs:</span>
        <span>
          {listing.bib_count}
          {needsNameChange && <span className="text-xs text-orange-600 ml-1">(name change required)</span>}
        </span>
      </div>
    )}
  </div>
)}


      {/* Footer */}
      <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-100">
        {isUserLoggedIn ? (
          <>
            {/* Author */}
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                {listing.author.company_name?.charAt(0) ||
                  listing.author.full_name?.charAt(0) ||
                  "?"}
              </div>
              <div>
               <div className="flex items-center gap-1">
  <p className="text-sm font-semibold text-gray-900 truncate">
    {listing.author.company_name || listing.author.full_name}
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
<p className="text-xs text-gray-500">
  {listing.author.user_type === "tour_operator" ? "Tour Operator" : "Private seller"}
  {listing.author.is_verified && " • Verified"}
</p>

              </div>
            </div>

            {/* Price */}
            <div className="text-right">
              {listing.listing_type === "bib" && listing.associated_costs ? (
                <p className="text-lg font-bold text-gray-900">
                  €{listing.associated_costs.toLocaleString()}
                </p>
              ) : listing.price ? (
                <>
                  <p className="text-lg font-bold text-gray-900">
                    €{listing.price.toLocaleString()}
                  </p>
                  {listing.price_negotiable && (
                    <p className="text-xs text-gray-500">Negotiable</p>
                  )}
                </>
              ) : (
                <p className="text-sm font-medium text-gray-600">Contact for details</p>
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
  <div className="mt-4 pt-4 border-t border-gray-100">
    <button
      className="w-full btn-primary text-sm py-2.5 flex items-center justify-center gap-2"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      Contact {(listing.author.company_name || listing.author.full_name || "Seller").split(' ')[0]}
    </button>
  </div>
)}

    </Link>
  );
}
