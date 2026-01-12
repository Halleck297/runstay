import { Link } from "@remix-run/react";

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    listing_type: "room" | "bib" | "room_and_bib";
    hotel_name: string | null;
    room_count: number | null;
    bib_count: number | null;
    price: number | null;
    price_negotiable: boolean;
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
}

const typeLabels = {
  room: "Room Only",
  bib: "Bib Only",
  room_and_bib: "Room + Bib",
};

const typeColors = {
  room: "bg-blue-100 text-blue-700",
  bib: "bg-purple-100 text-purple-700",
  room_and_bib: "bg-brand-100 text-brand-700",
};

export function ListingCard({ listing }: ListingCardProps) {
  const eventDate = new Date(listing.event.event_date).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );

  return (
    <Link to={`/listings/${listing.id}`} className="card p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span
            className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
              typeColors[listing.listing_type]
            }`}
          >
            {typeLabels[listing.listing_type]}
          </span>
          <h3 className="mt-3 font-display text-lg font-semibold text-gray-900 line-clamp-2">
            {listing.title}
          </h3>
        </div>
      </div>

      {/* Event */}
      <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
        <svg
          className="h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span className="font-medium">{listing.event.name}</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {listing.event.location} · {eventDate}
      </p>

      {/* Details */}
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-600">
        {listing.room_count && (
          <span className="flex items-center gap-1">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            {listing.room_count} room{listing.room_count > 1 ? "s" : ""}
          </span>
        )}
        {listing.bib_count && (
          <span className="flex items-center gap-1">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
            {listing.bib_count} bib{listing.bib_count > 1 ? "s" : ""}
          </span>
        )}
        {listing.hotel_name && (
          <span className="text-gray-500">{listing.hotel_name}</span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
            {listing.author.company_name?.charAt(0) ||
              listing.author.full_name?.charAt(0) ||
              "?"}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {listing.author.company_name || listing.author.full_name}
              {listing.author.is_verified && (
                <svg
                  className="ml-1 inline h-4 w-4 text-brand-500"
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
              {listing.author.user_type === "tour_operator"
                ? "Tour Operator"
                : "Private"}
            </p>
          </div>
        </div>
        <div className="text-right">
          {listing.price ? (
            <>
              <p className="text-lg font-bold text-gray-900">
                €{listing.price.toLocaleString()}
              </p>
              {listing.price_negotiable && (
                <p className="text-xs text-gray-500">Negotiable</p>
              )}
            </>
          ) : (
            <p className="text-sm font-medium text-gray-600">Contact for price</p>
          )}
        </div>
      </div>
    </Link>
  );
}
