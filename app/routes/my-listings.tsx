import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { Link, useLoaderData } from "react-router";
import { Header } from "~/components/Header";
import { ListingCard } from "~/components/ListingCard";
import { ListingCardCompact } from "~/components/ListingCardCompact";
import { useI18n } from "~/hooks/useI18n";
import { localizeListing, resolveLocaleForRequest } from "~/lib/locale";
import { applyListingDisplayCurrency, getCurrencyForCountry } from "~/lib/currency";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { isEventExpired } from "~/lib/listing-status";

export const meta: MetaFunction = () => {
  return [{ title: "My Listings - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);
  const viewerCurrency = getCurrencyForCountry((user as any)?.country || null);

  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select(`
      *,
      event:events(id, name, name_i18n, slug, country, country_i18n, event_date, card_image_url),
      author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified, avatar_url)
    `)
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  const localized = (listings || []).map((listing: any) =>
    applyListingDisplayCurrency(localizeListing(listing, locale), viewerCurrency)
  );

  if (user.user_type === "tour_operator") {
    return redirect("/to-panel/listings");
  }

  const pendingListings = localized.filter((listing: any) => listing.status === "pending");
  const rejectedListings = localized.filter((listing: any) => listing.status === "rejected");

  const activeListings = localized.filter((listing: any) => {
    return listing.status === "active" && !isEventExpired(listing.event.event_date);
  });

  const endedListings = localized.filter((listing: any) => {
    return (listing.status === "active" || listing.status === "sold" || listing.status === "expired") && isEventExpired(listing.event.event_date);
  });

  return { user, activeListings, endedListings, pendingListings, rejectedListings };
}

export default function MyListings() {
  const { user, activeListings, endedListings, pendingListings, rejectedListings } = useLoaderData<typeof loader>();
  const { t } = useI18n();

  const mergedPendingListings = [...pendingListings, ...rejectedListings];
  const totalListings = mergedPendingListings.length + activeListings.length + endedListings.length;
  const countLabel = totalListings === 1 ? t("my_listings.listing_singular") : t("my_listings.listing_plural");
  const orderedListings = [...activeListings, ...pendingListings, ...rejectedListings, ...endedListings];
  const getStatusBadge = (listing: any, mobile = false) => {
    if (listing.status === "pending") {
      return (
        <span
          className={`rounded-full border border-yellow-200 bg-yellow-100 text-yellow-700 shadow-[0_4px_10px_rgba(0,0,0,0.22)] ${
            mobile ? "px-2.5 py-1 text-xs font-semibold" : "px-3 py-1.5 text-sm font-semibold"
          }`}
        >
          {t("my_listings.pending_badge")}
        </span>
      );
    }

    if (listing.status === "rejected") {
      return (
        <span
          className={`rounded-full border border-red-200 bg-red-100 text-red-700 shadow-[0_4px_10px_rgba(0,0,0,0.22)] ${
            mobile ? "px-2.5 py-1 text-xs font-semibold" : "px-3 py-1.5 text-sm font-semibold"
          }`}
        >
          {t("my_listings.not_approved_badge")}
        </span>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#ECF4FE]">
      <div className="min-h-screen">
        <Header user={user} />

        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8 lg:px-8">
          <div className="mb-6 rounded-3xl border-2 border-brand-300 bg-white p-4 text-center md:mx-auto md:w-[78%] md:p-6 lg:w-[72%]">
            <h1 className="inline-block border-b-2 border-accent-500 pb-0.5 font-display text-3xl font-bold text-gray-900">{t("my_listings.title")}</h1>
            <p className="mt-2 text-gray-600">
              {totalListings === 0 ? t("my_listings.none_created") : `${t("my_listings.you_have")} ${totalListings} ${countLabel}`}
            </p>
          </div>

          {totalListings > 0 ? (
            <div className="space-y-0">
              <div className="hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                {orderedListings.map((listing: any) => (
                  <div key={listing.id} className="relative">
                    <ListingCard listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                    {getStatusBadge(listing) && <div className="absolute right-3 top-3">{getStatusBadge(listing)}</div>}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 md:hidden">
                {orderedListings.map((listing: any) => (
                  <div key={listing.id} className="relative">
                    <ListingCardCompact listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                    {getStatusBadge(listing, true) && <div className="absolute right-3 top-3">{getStatusBadge(listing, true)}</div>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white/90 p-10 text-center shadow-[0_12px_30px_rgba(15,23,42,0.16)] backdrop-blur-sm sm:p-12">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{t("my_listings.no_listings")}</h3>
              <p className="mb-6 text-gray-500">{t("my_listings.create_first_help")}</p>
              <Link to="/listings/new" className="btn-primary rounded-full">
                {t("my_listings.create_first_cta")}
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
