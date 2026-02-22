import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import { FooterLight } from "~/components/FooterLight";
import { Header } from "~/components/Header";
import { ListingCard } from "~/components/ListingCard";
import { ListingCardCompact } from "~/components/ListingCardCompact";
import { useI18n } from "~/hooks/useI18n";
import { localizeListing, resolveLocaleForRequest } from "~/lib/locale";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Saved Listings - Runoot" }];
};

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
        author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified),
        event:events(id, name, name_i18n, country, country_i18n, event_date)
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
      .map((s: any) => localizeListing(s.listing, locale)) || [];

  return { user, savedListings: activeListings };
}

export default function SavedListings() {
  const { user, savedListings } = useLoaderData<typeof loader>();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed">
      <div className="flex min-h-screen flex-col bg-gray-50/60 md:bg-gray-50/85">
        <Header user={user} />

        <main className="mx-auto flex w-full max-w-7xl flex-grow px-4 py-8 pb-24 sm:px-6 md:pb-8 lg:px-8">
          <div className="mb-8 rounded-xl bg-white/70 px-3 py-4 text-center shadow-md backdrop-blur-sm sm:p-6 sm:text-left">
            <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">{t("saved.title")}</h1>
            <p className="mt-2 hidden text-gray-600 sm:block">{t("saved.subtitle")}</p>
          </div>

          {savedListings.length === 0 ? (
            <div className="card p-12 text-center shadow-md">
              <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">{t("saved.empty_title")}</h3>
              <p className="mt-2 text-gray-500">{t("saved.empty_help")}</p>
              <Link to="/listings" className="btn-primary mt-6 inline-block rounded-full">
                {t("messages.browse_listings")}
              </Link>
            </div>
          ) : (
            <>
              <div className="hidden gap-6 md:grid md:grid-cols-2 lg:grid-cols-3">
                {savedListings.map((listing: any) => (
                  <ListingCard key={listing.id} listing={listing} isUserLoggedIn={true} isSaved={true} />
                ))}
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {savedListings.map((listing: any) => (
                  <ListingCardCompact key={listing.id} listing={listing} isUserLoggedIn={true} isSaved={true} />
                ))}
              </div>
            </>
          )}
        </main>

        <FooterLight />
      </div>
    </div>
  );
}
