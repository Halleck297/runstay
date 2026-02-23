import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FooterLight } from "~/components/FooterLight";
import { Header } from "~/components/Header";
import { useI18n } from "~/hooks/useI18n";
import { localizeListing, resolveLocaleForRequest } from "~/lib/locale";
import { getListingPublicId } from "~/lib/publicIds";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Saved Listings - Runoot" }];
};

function getEventSlug(event: { name: string; slug?: string | null }): string {
  if (event.slug) return event.slug;
  return event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getDisplayPrice(listing: any): number | null {
  if (listing.listing_type === "bib") {
    return typeof listing.associated_costs === "number" ? listing.associated_costs : null;
  }
  return typeof listing.price === "number" ? listing.price : null;
}

function SavedToolbarDropdown<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="input flex w-full items-center justify-between gap-2 rounded-full text-left"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-30 mt-2 w-full min-w-[220px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.15)]">
          <ul role="listbox" className="py-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      isSelected ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{option.label}</span>
                    {isSelected && (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function SavedListingCard({
  listing,
  locale,
  t,
  currentUserId,
}: {
  listing: any;
  locale: string;
  t: (key: any) => string;
  currentUserId: string | null;
}) {
  const saveFetcher = useFetcher();
  const isSavedOptimistic = saveFetcher.formData
    ? saveFetcher.formData.get("action") === "save"
    : true;
  const canSaveListing = !!currentUserId && listing?.author?.id !== currentUserId;

  const eventDate = listing?.event?.event_date
    ? new Date(listing.event.event_date).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

  const savedOnDate = listing.saved_at
    ? new Date(listing.saved_at).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

  const displayPrice = getDisplayPrice(listing);

  const typeLabel =
    listing.listing_type === "bib"
      ? t("saved.filter_bib")
      : listing.listing_type === "room"
        ? t("saved.filter_hotel")
        : t("saved.filter_package");
  const typeBadgeClass =
    listing.listing_type === "bib"
      ? "bg-purple-100 text-purple-700"
      : listing.listing_type === "room"
        ? "bg-blue-100 text-blue-700"
        : "bg-green-100 text-green-700";

  const eventSlug = getEventSlug(listing.event || { name: "event", slug: null });
  const defaultEventImage = `/events/${eventSlug}.jpg`;
  const primaryEventImage = listing?.event?.card_image_url || defaultEventImage;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white/90 shadow-[0_10px_28px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_14px_34px_rgba(15,23,42,0.24)]">
      <Link to={`/listings/${getListingPublicId(listing)}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
          <img
            src={primaryEventImage}
            alt={listing?.event?.name || "Event"}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const fallbackAbsolute = new URL(defaultEventImage, window.location.origin).href;
              if (!target.dataset.triedFallback && target.src !== fallbackAbsolute) {
                target.dataset.triedFallback = "true";
                target.src = defaultEventImage;
                return;
              }
              target.style.display = "none";
            }}
          />

          <div className="absolute left-3 top-3">
            <span className={`rounded-full px-3 py-1.5 text-sm font-semibold shadow-[0_4px_10px_rgba(0,0,0,0.22)] ${typeBadgeClass}`}>
              {typeLabel}
            </span>
          </div>

          {canSaveListing && (
            <div className="absolute right-3 top-3 z-10">
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
                  className={`rounded-full bg-white/95 p-2 shadow-sm backdrop-blur-sm transition-colors ${
                    isSavedOptimistic ? "text-red-500 hover:text-red-600" : "text-gray-500 hover:text-red-500"
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
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-base font-semibold text-gray-900">{listing.event?.name || "-"}</h3>
            {displayPrice !== null && (
              <p className="whitespace-nowrap text-base font-bold text-gray-900">€{displayPrice}</p>
            )}
          </div>

          <p className="mt-1 line-clamp-1 text-sm text-gray-600">
            {listing.title || listing.hotel_name || t("saved.title")}
          </p>

          <div className="mt-3 space-y-2 text-xs text-gray-500">
            {listing.hotel_name && (
              <div>
                <span className="inline-flex max-w-full rounded-full bg-gray-100 px-2 py-1 line-clamp-1">
                  {listing.hotel_name}
                </span>
              </div>
            )}
            <div>
              <span className="inline-flex rounded-full bg-gray-100 px-2 py-1">
                {t("listings.race_day")}: {eventDate}
              </span>
            </div>
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {t("saved.saved_on")}: {savedOnDate}
          </div>
        </div>
      </Link>
    </article>
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const userId = (user as any).id as string;
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);

  const { data: savedListings, error } = await (supabaseAdmin as any)
    .from("saved_listings")
    .select(`
      id,
      created_at,
      listing:listings(
        id,
        short_id,
        title,
        title_i18n,
        listing_type,
        hotel_name,
        hotel_name_i18n,
        hotel_stars,
        hotel_rating,
        room_count,
        room_type,
        bib_count,
        price,
        currency,
        price_negotiable,
        transfer_type,
        associated_costs,
        check_in,
        check_out,
        status,
        created_at,
        author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified, avatar_url),
        event:events(id, name, name_i18n, slug, country, country_i18n, event_date, card_image_url)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching saved listings:", error);
    return { user, savedListings: [] };
  }

  const activeListings =
    savedListings
      ?.filter((s: any) => s.listing && s.listing.status === "active")
      .map((s: any) => ({
        ...localizeListing(s.listing, locale),
        saved_at: s.created_at,
      })) || [];

  return { user, savedListings: activeListings };
}

export default function SavedListings() {
  const { user, savedListings } = useLoaderData<typeof loader>();
  const { t, locale } = useI18n();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "room" | "bib" | "room_and_bib">("all");
  const [sortBy, setSortBy] = useState<"saved_desc" | "saved_asc" | "event_asc" | "price_asc" | "price_desc">("saved_desc");
  const typeFilterOptions = [
    { value: "all" as const, label: t("saved.filter_all") },
    { value: "room" as const, label: t("saved.filter_hotel") },
    { value: "bib" as const, label: t("saved.filter_bib") },
    { value: "room_and_bib" as const, label: t("saved.filter_package") },
  ];
  const sortOptions = [
    { value: "saved_desc" as const, label: t("saved.sort_saved_newest") },
    { value: "saved_asc" as const, label: t("saved.sort_saved_oldest") },
    { value: "event_asc" as const, label: t("saved.sort_event_soonest") },
    { value: "price_asc" as const, label: t("saved.sort_price_low_high") },
    { value: "price_desc" as const, label: t("saved.sort_price_high_low") },
  ];

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let next = [...(savedListings as any[])];

    if (typeFilter !== "all") {
      next = next.filter((listing: any) => listing.listing_type === typeFilter);
    }

    if (normalizedQuery) {
      next = next.filter((listing: any) => {
        const haystack = [
          listing.title,
          listing.event?.name,
          listing.hotel_name,
          listing.author?.company_name,
          listing.author?.full_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      });
    }

    next.sort((a: any, b: any) => {
      if (sortBy === "saved_asc") {
        return new Date(a.saved_at || 0).getTime() - new Date(b.saved_at || 0).getTime();
      }
      if (sortBy === "event_asc") {
        return new Date(a.event?.event_date || 0).getTime() - new Date(b.event?.event_date || 0).getTime();
      }
      if (sortBy === "price_asc") {
        const aPrice = getDisplayPrice(a);
        const bPrice = getDisplayPrice(b);
        return (aPrice ?? Number.POSITIVE_INFINITY) - (bPrice ?? Number.POSITIVE_INFINITY);
      }
      if (sortBy === "price_desc") {
        const aPrice = getDisplayPrice(a);
        const bPrice = getDisplayPrice(b);
        return (bPrice ?? Number.NEGATIVE_INFINITY) - (aPrice ?? Number.NEGATIVE_INFINITY);
      }

      return new Date(b.saved_at || 0).getTime() - new Date(a.saved_at || 0).getTime();
    });

    return next;
  }, [query, savedListings, sortBy, typeFilter]);

  const hasSavedListings = (savedListings as any[]).length > 0;

  return (
    <div className="min-h-screen bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed">
      <div className="flex min-h-screen flex-col bg-gray-50/60 md:bg-gray-50/85">
        <Header user={user} />

        <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8 lg:px-8">
          <div className="w-full space-y-5 md:space-y-6">
            <section className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/92 px-4 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.18)] ring-1 ring-black/5 backdrop-blur-sm sm:px-6">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 via-brand-500 to-blue-400 opacity-80" />
              <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">{t("saved.title")}</h1>
              <p className="mt-2 text-sm text-gray-600 sm:text-base">{t("saved.subtitle")}</p>
            </section>

            {hasSavedListings && (
              <section className="relative z-10 rounded-2xl border border-gray-300/80 bg-white/94 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.16)] ring-1 ring-black/5 backdrop-blur-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <label className="relative block">
                    <span className="sr-only">{t("saved.search_placeholder")}</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      type="text"
                      placeholder={t("saved.search_placeholder")}
                      className="input w-full rounded-full pr-10"
                    />
                    <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </label>

                  <SavedToolbarDropdown
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={typeFilterOptions}
                    className="md:w-[180px]"
                  />

                  <SavedToolbarDropdown
                    value={sortBy}
                    onChange={setSortBy}
                    options={sortOptions}
                    className="md:w-[230px]"
                  />
                </div>
              </section>
            )}

            {!hasSavedListings ? (
              <section className="rounded-2xl border border-gray-200 bg-white/90 p-10 text-center shadow-sm backdrop-blur-sm sm:p-12">
                <svg className="mx-auto h-14 w-14 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{t("saved.empty_title")}</h3>
                <p className="mt-2 text-gray-500">{t("saved.empty_help")}</p>
                <Link to="/listings" className="btn-primary mt-6 inline-block rounded-full px-5 py-2.5 text-sm">
                  {t("messages.browse_listings")}
                </Link>
              </section>
            ) : filteredListings.length === 0 ? (
              <section className="rounded-2xl border border-gray-200 bg-white/90 p-10 text-center shadow-sm backdrop-blur-sm sm:p-12">
                <svg className="mx-auto h-14 w-14 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{t("saved.no_results_title")}</h3>
                <p className="mt-2 text-gray-500">{t("saved.no_results_help")}</p>
              </section>
            ) : (
              <section className="relative z-0 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredListings.map((listing: any) => (
                  <SavedListingCard key={listing.id} listing={listing} locale={locale} t={t} currentUserId={(user as any)?.id ?? null} />
                ))}
              </section>
            )}
          </div>
        </main>

        <FooterLight />
      </div>
    </div>
  );
}
