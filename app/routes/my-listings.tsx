import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { Link, useLoaderData } from "react-router";
import { Header } from "~/components/Header";
import { ListingCard } from "~/components/ListingCard";
import { useI18n } from "~/hooks/useI18n";
import { localizeListing, resolveLocaleForRequest } from "~/lib/locale";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "My Listings - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);

  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select(`
      *,
      event:events(id, name, name_i18n, country, country_i18n, event_date),
      author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified)
    `)
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  const localized = (listings || []).map((listing: any) => localizeListing(listing, locale));

  if (user.user_type === "private" && localized.length === 1) {
    return redirect(`/listings/${localized[0].id}`);
  }

  if (user.user_type === "tour_operator") {
    return redirect("/dashboard");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingListings = localized.filter((listing: any) => listing.status === "pending");
  const rejectedListings = localized.filter((listing: any) => listing.status === "rejected");

  const activeListings = localized.filter((listing: any) => {
    const eventDate = new Date(listing.event.event_date);
    return listing.status === "active" && eventDate >= today;
  });

  const endedListings = localized.filter((listing: any) => {
    const eventDate = new Date(listing.event.event_date);
    return (listing.status === "active" || listing.status === "sold" || listing.status === "expired") && eventDate < today;
  });

  return { user, activeListings, endedListings, pendingListings, rejectedListings };
}

export default function MyListings() {
  const { user, activeListings, endedListings, pendingListings, rejectedListings } = useLoaderData<typeof loader>();
  const { t } = useI18n();

  const totalListings = pendingListings.length + rejectedListings.length + activeListings.length + endedListings.length;
  const countLabel = totalListings === 1 ? t("my_listings.listing_singular") : t("my_listings.listing_plural");

  return (
    <div className="min-h-full bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed">
      <div className="min-h-full bg-gray-50/85">
        <Header user={user} />

        <main className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 md:pb-8 lg:px-8">
          <div className="mb-8 flex items-center justify-between rounded-xl bg-white/70 p-6 shadow-md backdrop-blur-sm">
            <div>
              <h1 className="font-display text-3xl font-bold text-gray-900">{t("my_listings.title")}</h1>
              <p className="mt-2 text-gray-600">
                {totalListings === 0 ? t("my_listings.none_created") : `${t("my_listings.you_have")} ${totalListings} ${countLabel}`}
              </p>
            </div>
            {activeListings.length > 0 && (
              <span className="font-display text-xl font-semibold text-gray-900">
                {t("my_listings.active")} ({activeListings.length})
              </span>
            )}
          </div>

          {totalListings > 0 ? (
            <div className="space-y-10">
              {pendingListings.length > 0 && (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-yellow-700">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    {t("my_listings.pending_review")} ({pendingListings.length})
                  </h2>
                  <p className="mb-4 text-sm text-gray-500">{t("my_listings.pending_help")}</p>
                  <div className="grid gap-6 opacity-80 sm:grid-cols-2 lg:grid-cols-3">
                    {pendingListings.map((listing: any) => (
                      <div key={listing.id} className="relative">
                        <ListingCard listing={listing} isUserLoggedIn={true} />
                        <div className="absolute right-3 top-3">
                          <span className="rounded-full border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                            {t("my_listings.pending_badge")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {rejectedListings.length > 0 && (
                <section>
                  <h2 className="mb-4 font-display text-xl font-semibold text-red-700">
                    {t("my_listings.not_approved")} ({rejectedListings.length})
                  </h2>
                  <div className="grid gap-6 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
                    {rejectedListings.map((listing: any) => (
                      <div key={listing.id} className="relative">
                        <ListingCard listing={listing} isUserLoggedIn={true} />
                        <div className="absolute right-3 top-3">
                          <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            {t("my_listings.not_approved_badge")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeListings.length > 0 && (
                <section>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {activeListings.map((listing: any) => (
                      <ListingCard key={listing.id} listing={listing} isUserLoggedIn={true} />
                    ))}
                  </div>
                </section>
              )}

              {endedListings.length > 0 && (
                <section>
                  <h2 className="mb-4 font-display text-xl font-semibold text-gray-500">
                    {t("my_listings.ended")} ({endedListings.length})
                  </h2>
                  <div className="grid gap-6 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
                    {endedListings.map((listing: any) => (
                      <ListingCard key={listing.id} listing={listing} isUserLoggedIn={true} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="card p-12 text-center">
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
