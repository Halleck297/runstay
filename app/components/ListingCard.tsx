import { Link } from "@remix-run/react";

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    listing_type: "room" | "bib" | "room_and_bib";
    hotel_name: string | null;
    hotel_stars: number | null;
    room_count: number | null;
    room_type: "single" | "twin" | "double" | "double_shared" | "double_single_use" | null;
    bib_count: number | null;
    price: number | null;
    price_negotiable: boolean;
    transfer_type: "official_process" | "package" | "direct" | null;
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
    single: "Single",
    twin: "Twin",
    double: "Double",
    double_shared: "Double Shared",
    double_single_use: "Double Single Use"
  };
  
  return labels[roomType] || roomType;
}

export function ListingCard({ listing, isUserLoggedIn = true }: ListingCardProps) {
  const eventDate = new Date(listing.event.event_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const title = generateTitle(listing);
  const isLM = isLastMinute(listing.event.event_date);
  const isTourOperator = listing.author.user_type === "tour_operator";
  const needsNameChange = listing.transfer_type === "official_process";

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
    ? "card p-6 hover:shadow-md transition-shadow border-l-4 border-blue-500"
    : "card p-6 hover:shadow-md transition-shadow";

  return (
    <Link 
      to={isUserLoggedIn ? `/listings/${listing.id}` : "/login"} 
      className={cardClass}
    >
      {/* Badges */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
          {badgeText}
        </span>
        {isLM && (
          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            Last Minute
          </span>
        )}
      </div>

      {/* Titolo */}
      <h3 className="font-display text-lg font-semibold text-gray-900 line-clamp-2 mb-3">
        {title}
      </h3>

      {/* Location & Date */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
        <span>📍</span>
        <span>{listing.event.location} · {eventDate}</span>
      </div>

      {/* Hotel info se presente */}
      {listing.hotel_name && (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <span>🏨</span>
          <span>
            {listing.hotel_name}
            {listing.hotel_stars && (
              <span className="ml-1 text-yellow-500">
                {" · "}{"★".repeat(listing.hotel_stars)}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Includes section */}
      {isUserLoggedIn && (
        <div className="mt-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Includes:</p>
          <ul className="text-sm text-gray-700 space-y-1">
            {(listing.listing_type === "room" || listing.listing_type === "room_and_bib") && listing.room_count && (
              <li>
                • {listing.room_count} hotel room{listing.room_count > 1 ? "s" : ""}
                {listing.room_type && ` (${formatRoomType(listing.room_type)})`}
              </li>
            )}
            {(listing.listing_type === "bib" || listing.listing_type === "room_and_bib") && listing.bib_count && (
              <li>
                • {listing.bib_count} bib{listing.bib_count > 1 ? "s" : ""}
                {needsNameChange && " (name change required)"}
              </li>
            )}
          </ul>
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
                <p className="text-xs text-gray-600">
                  {" "}
                  <span className="font-medium text-gray-900">
                    {listing.author.company_name || listing.author.full_name}
                  </span>
                  {listing.author.is_verified && (
                    <svg
                      className="ml-1 inline h-3 w-3 text-brand-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  ({listing.author.user_type === "tour_operator" ? "Tour Operator" : "Private"})
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
    </Link>
  );
}
