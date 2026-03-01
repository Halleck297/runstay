import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, Outlet, useLoaderData, useLocation, redirect } from "react-router";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { ListingCard } from "~/components/ListingCard";
import { tourOperatorNavItems } from "~/components/panelNav";
import { localizeListing } from "~/lib/locale";
import { applyListingDisplayCurrency, getCurrencyForCountry } from "~/lib/currency";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getPublicDisplayName } from "~/lib/user-display";

export const meta: MetaFunction = () => {
  return [{ title: "My Listings - TO Panel - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") return redirect("/my-listings");
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

  const localizedListings = (listings || []).map((listing: any) =>
    applyListingDisplayCurrency(localizeListing(listing, "en"), viewerCurrency)
  );

  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select("id, participant_1, participant_2")
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);
  const conversationIds = (conversations || []).map((c: any) => c.id);

  let unreadCount = 0;
  if (conversationIds.length > 0) {
    const { count } = await (supabaseAdmin as any)
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .neq("sender_id", user.id)
      .is("read_at", null);
    unreadCount = count || 0;
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

  const pendingListings = localizedListings.filter((listing: any) => listing.status === "pending");
  const rejectedListings = localizedListings.filter((listing: any) => listing.status === "rejected");
  const activeListings = localizedListings.filter((listing: any) => listing.status === "active" && !isAutoExpiredByEventDate(listing.event.event_date));
  const endedListings = localizedListings.filter(
    (listing: any) =>
      (listing.status === "active" || listing.status === "sold" || listing.status === "expired") &&
      isAutoExpiredByEventDate(listing.event.event_date)
  );

  return {
    user,
    unreadCount,
    activeListings,
    endedListings,
    pendingListings,
    rejectedListings,
  };
}

export default function ToPanelListings() {
  const { user, unreadCount, activeListings, endedListings, pendingListings, rejectedListings } = useLoaderData<typeof loader>();
  const location = useLocation();

  if (location.pathname !== "/to-panel/listings" && location.pathname !== "/to-panel/listings/") {
    return <Outlet />;
  }

  const mergedPendingListings = [...pendingListings, ...rejectedListings];
  const totalListings = mergedPendingListings.length + activeListings.length + endedListings.length;
  const publicName = getPublicDisplayName(user);

  const navItems = tourOperatorNavItems.map((item) =>
    item.to === "/messages"
      ? { ...item, badgeCount: unreadCount, badgeTone: "brand" as const, hideBadgeWhenActive: true }
      : item
  );

  return (
    <ControlPanelLayout
      panelLabel="Tour Operator Panel"
      mobileTitle="TO Panel"
      homeTo="/to-panel"
      user={{
        fullName: publicName,
        email: user.email,
        roleLabel: "Tour Operator",
        avatarUrl: user.avatar_url,
      }}
      navItems={navItems}
    >
      <div className="-m-4 min-h-full bg-[#ECF4FE] md:-m-8">
        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8 lg:px-8">
          <div className="mb-6 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
            <h1 className="font-display text-2xl font-bold text-gray-900">My listings</h1>
            <p className="mt-1 text-gray-600">
              {totalListings === 0 ? "No listings yet." : `You have ${totalListings} listings.`}
            </p>
          </div>

          {activeListings.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 font-display text-xl font-semibold text-blue-700">Active ({activeListings.length})</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {activeListings.map((listing: any) => (
                  <ListingCard key={listing.id} listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                ))}
              </div>
            </section>
          )}

          {mergedPendingListings.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 font-display text-xl font-semibold text-yellow-700">Pending ({mergedPendingListings.length})</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {mergedPendingListings.map((listing: any) => (
                  <ListingCard key={listing.id} listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                ))}
              </div>
            </section>
          )}

          {endedListings.length > 0 && (
            <section className="mb-4">
              <h2 className="mb-4 font-display text-xl font-semibold text-gray-700">Ended ({endedListings.length})</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {endedListings.map((listing: any) => (
                  <ListingCard key={listing.id} listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                ))}
              </div>
            </section>
          )}

          {totalListings === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <p className="text-gray-600">Create your first listing to start receiving requests.</p>
              <Link to="/to-panel/listings/new" className="btn-primary mt-4 inline-flex rounded-full px-5 py-2.5 text-sm">
                Create listing
              </Link>
            </div>
          )}
        </main>
      </div>
    </ControlPanelLayout>
  );
}
