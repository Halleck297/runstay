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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isAutoExpiredByEventDate = (eventDateString: string): boolean => {
    const eventDate = new Date(eventDateString);
    eventDate.setHours(0, 0, 0, 0);
    const expiryThreshold = new Date(eventDate);
    expiryThreshold.setDate(expiryThreshold.getDate() - 1);
    return today >= expiryThreshold;
  };

  const pendingListings = localized.filter((listing: any) => listing.status === "pending");
  const rejectedListings = localized.filter((listing: any) => listing.status === "rejected");

  const activeListings = localized.filter((listing: any) => {
    return listing.status === "active" && !isAutoExpiredByEventDate(listing.event.event_date);
  });

  const endedListings = localized.filter((listing: any) => {
    return (listing.status === "active" || listing.status === "sold" || listing.status === "expired") && isAutoExpiredByEventDate(listing.event.event_date);
  });

  return { user, activeListings, endedListings, pendingListings, rejectedListings };
}

export default function MyListings() {
  const { user, activeListings, endedListings, pendingListings, rejectedListings } = useLoaderData<typeof loader>();
  const { t } = useI18n();

  const mergedPendingListings = [...pendingListings, ...rejectedListings];
  const totalListings = mergedPendingListings.length + activeListings.length + endedListings.length;
  const countLabel = totalListings === 1 ? t("my_listings.listing_singular") : t("my_listings.listing_plural");
  const statusSummary = [
    { label: "Approved", href: "#approved-section", count: activeListings.length, activeClass: "bg-blue-100 text-blue-700 ring-blue-200" },
    { label: "Pending", href: "#pending-section", count: pendingListings.length, activeClass: "bg-yellow-100 text-yellow-700 ring-yellow-200" },
    { label: "Rejected", href: "#rejected-section", count: rejectedListings.length, activeClass: "bg-red-100 text-red-700 ring-red-200" },
    { label: "Expired", href: "#expired-section", count: endedListings.length, activeClass: "bg-gray-200 text-gray-700 ring-gray-300" },
  ];

  return (
    <div className="min-h-screen bg-[#ECF4FE]">
      <div className="min-h-screen">
        <Header user={user} />

        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8 lg:px-8">
          <div className="mb-6 text-center">
            <h1 className="font-display text-3xl font-bold text-gray-900">{t("my_listings.title")}</h1>
            <p className="mt-2 text-gray-600">
              {totalListings === 0 ? t("my_listings.none_created") : `${t("my_listings.you_have")} ${totalListings} ${countLabel}`}
            </p>
          </div>

          {totalListings > 0 && (
            <div className="mb-8 rounded-2xl border border-gray-300/80 bg-white/94 p-3 sm:p-4 shadow-[0_12px_30px_rgba(15,23,42,0.16)] ring-1 ring-black/5 backdrop-blur-sm">
              <div className="flex flex-wrap gap-2">
                {statusSummary.map((status) => {
                  const isActive = status.count > 0;
                  return (
                    isActive ? (
                      <a
                        key={status.label}
                        href={status.href}
                        className={`inline-flex items-center rounded-full px-3.5 py-2 text-xs font-semibold ring-1 transition-colors hover:opacity-90 sm:text-sm ${status.activeClass}`}
                      >
                        {status.label}
                      </a>
                    ) : (
                      <span
                        key={status.label}
                        className="inline-flex items-center rounded-full px-3.5 py-2 text-xs font-semibold ring-1 bg-gray-100 text-gray-400 ring-gray-200 sm:text-sm"
                      >
                        {status.label}
                      </span>
                    )
                  );
                })}
              </div>
            </div>
          )}

          {totalListings > 0 ? (
            <div className="space-y-1">
              {activeListings.length > 0 && (
                <section id="approved-section" className="scroll-mt-28">
                  <h2 className="mb-4 font-display text-xl font-semibold text-blue-700">
                    Approved ({activeListings.length})
                  </h2>
                  <div className="hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                    {activeListings.map((listing: any) => (
                      <ListingCard key={listing.id} listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 md:hidden">
                    {activeListings.map((listing: any) => (
                      <ListingCardCompact key={listing.id} listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                    ))}
                  </div>
                </section>
              )}

              {pendingListings.length > 0 && (
                <>
                  <div className="my-8 h-0.5 w-full bg-black/90" />
                  <section id="pending-section" className="scroll-mt-28">
                    <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-yellow-700">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      Pending ({pendingListings.length})
                    </h2>
                    <p className="mb-4 max-w-3xl text-sm text-gray-500">{t("my_listings.pending_help")}</p>
                    <div className="hidden gap-5 opacity-85 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                      {pendingListings.map((listing: any) => (
                        <div key={listing.id} className="relative">
                          <ListingCard listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                          <div className="absolute right-3 top-3">
                            <span
                              className={`rounded-full border px-3 py-1.5 text-sm font-semibold shadow-[0_4px_10px_rgba(0,0,0,0.22)] ${
                                listing.status === "rejected"
                                  ? "border-red-200 bg-red-100 text-red-700"
                                  : "border-yellow-200 bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {listing.status === "rejected" ? t("my_listings.not_approved_badge") : t("my_listings.pending_badge")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-3 opacity-90 md:hidden">
                      {pendingListings.map((listing: any) => (
                        <div key={listing.id} className="relative">
                          <ListingCardCompact listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                          <div className="absolute right-3 top-3">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold shadow-[0_4px_10px_rgba(0,0,0,0.22)] ${
                                listing.status === "rejected"
                                  ? "border-red-200 bg-red-100 text-red-700"
                                  : "border-yellow-200 bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {listing.status === "rejected" ? t("my_listings.not_approved_badge") : t("my_listings.pending_badge")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {rejectedListings.length > 0 && (
                <>
                  <div className="my-8 h-0.5 w-full bg-black/90" />
                  <section id="rejected-section" className="scroll-mt-28">
                    <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-red-700">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Rejected ({rejectedListings.length})
                    </h2>
                    <div className="hidden gap-5 opacity-85 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                      {rejectedListings.map((listing: any) => (
                        <div key={listing.id} className="relative">
                          <ListingCard listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                          <div className="absolute right-3 top-3">
                            <span className="rounded-full border border-red-200 bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700 shadow-[0_4px_10px_rgba(0,0,0,0.22)]">
                              {t("my_listings.not_approved_badge")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-3 opacity-90 md:hidden">
                      {rejectedListings.map((listing: any) => (
                        <div key={listing.id} className="relative">
                          <ListingCardCompact listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                          <div className="absolute right-3 top-3">
                            <span className="rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 shadow-[0_4px_10px_rgba(0,0,0,0.22)]">
                              {t("my_listings.not_approved_badge")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {endedListings.length > 0 && (
                <>
                  <div className="my-8 h-0.5 w-full bg-black/90" />
                  <section id="expired-section" className="scroll-mt-28">
                    <h2 className="mb-4 font-display text-xl font-semibold text-gray-700">
                      Expired ({endedListings.length})
                    </h2>
                    <div className="hidden gap-5 opacity-75 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                      {endedListings.map((listing: any) => (
                        <ListingCard key={listing.id} listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                      ))}
                    </div>
                    <div className="flex flex-col gap-3 opacity-80 md:hidden">
                      {endedListings.map((listing: any) => (
                        <ListingCardCompact key={listing.id} listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                      ))}
                    </div>
                  </section>
                </>
              )}
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
