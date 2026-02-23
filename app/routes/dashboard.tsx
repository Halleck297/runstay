import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, redirect, useLoaderData } from "react-router";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { ListingCardCompact } from "~/components/ListingCardCompact";
import { tourOperatorNavItems } from "~/components/panelNav";
import { useI18n } from "~/hooks/useI18n";
import { localizeListing, resolveLocaleForRequest } from "~/lib/locale";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => {
  return [{ title: "Dashboard - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);

  if (user.user_type !== "tour_operator") {
    return redirect("/listings");
  }

  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select(`
      *,
      event:events(id, name, name_i18n, slug, country, country_i18n, event_date, card_image_url),
      author:profiles!listings_author_id_fkey(id, full_name, company_name, user_type, is_verified, avatar_url)
    `)
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  const localizedListings = (listings || []).map((listing: any) => localizeListing(listing, locale));

  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select(`
      *,
      listing:listings(id, title, title_i18n),
      messages(id, content, sender_id, created_at, read_at)
    `)
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order("updated_at", { ascending: false })
    .limit(5);

  const localizedConversations = (conversations || []).map((conv: any) => ({
    ...conv,
    listing: conv.listing ? localizeListing(conv.listing, locale) : conv.listing,
  }));

  let unreadCount = 0;
  localizedConversations.forEach((conv: any) => {
    conv.messages?.forEach((msg: any) => {
      if (msg.sender_id !== user.id && !msg.read_at) unreadCount++;
    });
  });

  return {
    user,
    listings: localizedListings,
    conversations: localizedConversations,
    unreadCount,
  };
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  active: "bg-success-100 text-success-700 border border-success-200",
  sold: "bg-gray-100 text-gray-700 border border-gray-200",
  expired: "bg-alert-100 text-alert-700 border border-alert-200",
  rejected: "bg-red-100 text-red-700 border border-red-200",
};

export default function Dashboard() {
  const { user, listings, conversations, unreadCount } = useLoaderData<typeof loader>();
  const { t } = useI18n();

  const pendingListings = listings.filter((l: any) => l.status === "pending");
  const activeListings = listings.filter((l: any) => l.status === "active");
  const soldListings = listings.filter((l: any) => l.status === "sold");
  const panelNavItems = tourOperatorNavItems.map((item) =>
    item.to === "/messages"
      ? { ...item, badgeCount: unreadCount, badgeTone: "brand" as const, hideBadgeWhenActive: true }
      : item
  );

  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      pending: t("dashboard.status.pending"),
      active: t("dashboard.status.active"),
      sold: t("dashboard.status.sold"),
      expired: t("dashboard.status.expired"),
      rejected: t("dashboard.status.rejected"),
    };
    return map[status] || status;
  };

  const listingCountWord = pendingListings.length === 1 ? t("my_listings.listing_singular") : t("my_listings.listing_plural");

  return (
    <ControlPanelLayout
      panelLabel={t("dashboard.panel_label")}
      mobileTitle={t("dashboard.mobile_title")}
      homeTo="/dashboard"
      user={{
        fullName: user.full_name,
        email: user.email,
        roleLabel: t("dashboard.role_tour_operator"),
        avatarUrl: user.avatar_url,
      }}
      navItems={panelNavItems}
    >
      <div className="min-h-full">
        <main className="px-4 pb-20 pt-6 md:hidden">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="font-display text-lg font-bold text-gray-900">{t("nav.dashboard")}</h1>
            <Link
              to="/listings/new"
              className="flex items-center gap-1.5 rounded-full bg-accent-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm active:bg-accent-600"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("nav.new_listing")}
            </Link>
          </div>

          {pendingListings.length > 0 && (
            <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-yellow-800">
                  {pendingListings.length} {listingCountWord} {t("dashboard.pending_review_suffix")}
                </p>
              </div>
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                  <svg className="h-5 w-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{activeListings.length}</p>
                  <p className="text-xs text-gray-500">{t("dashboard.stat.active")}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-100">
                  <svg className="h-5 w-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{soldListings.length}</p>
                  <p className="text-xs text-gray-500">{t("dashboard.stat.sold")}</p>
                </div>
              </div>
            </div>

            <Link to="/messages" className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm active:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{conversations.length}</p>
                  <p className="text-xs text-gray-500">{t("dashboard.stat.chats")}</p>
                </div>
              </div>
            </Link>

            <Link to="/messages" className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm active:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${unreadCount > 0 ? "bg-accent-100" : "bg-gray-100"}`}>
                  <svg className={`h-5 w-5 ${unreadCount > 0 ? "text-accent-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${unreadCount > 0 ? "text-accent-600" : "text-gray-900"}`}>{unreadCount}</p>
                  <p className="text-xs text-gray-500">{t("dashboard.stat.unread")}</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display font-semibold text-gray-900">{t("my_listings.title")}</h2>
              {listings.length > 3 && (
                <Link to="/my-listings" className="text-sm font-medium text-brand-600">
                  {t("dashboard.see_all")}
                </Link>
              )}
            </div>

            {listings.length > 0 ? (
              <div className="space-y-3">
                {listings.slice(0, 3).map((listing: any) => (
                  <div key={listing.id} className="relative">
                    <ListingCardCompact listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                    <div className="absolute right-3 top-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[listing.status as keyof typeof statusColors]}`}>
                        {translateStatus(listing.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-100 bg-white p-6 text-center">
                <p className="text-sm text-gray-500">{t("my_listings.no_listings")}</p>
                <Link to="/listings/new" className="mt-2 inline-block text-sm font-medium text-brand-600">
                  {t("my_listings.create_first_cta")} →
                </Link>
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display font-semibold text-gray-900">{t("dashboard.recent_messages")}</h2>
              {conversations.length > 0 && (
                <Link to="/messages" className="text-sm font-medium text-brand-600">
                  {t("dashboard.see_all")}
                </Link>
              )}
            </div>

            {conversations.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
                {conversations.slice(0, 3).map((conv: any, index: number) => {
                  const lastMessage = conv.messages?.[conv.messages.length - 1];
                  const hasUnread = conv.messages?.some((m: any) => m.sender_id !== user.id && !m.read_at);

                  return (
                    <Link
                      key={conv.id}
                      to={`/messages?c=${conv.short_id || conv.id}`}
                      className={`flex items-center gap-3 p-4 active:bg-gray-50 ${index > 0 ? "border-t border-gray-100" : ""}`}
                    >
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${hasUnread ? "bg-brand-100" : "bg-gray-100"}`}>
                        <svg className={`h-5 w-5 ${hasUnread ? "text-brand-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm ${hasUnread ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                          {conv.listing?.title || t("dashboard.conversation_fallback")}
                        </p>
                        {lastMessage && <p className="mt-0.5 truncate text-xs text-gray-500">{lastMessage.content}</p>}
                      </div>
                      {hasUnread && <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-brand-500" />}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-100 bg-white p-6 text-center">
                <p className="text-sm text-gray-500">{t("dashboard.no_conversations")}</p>
                <Link to="/listings" className="mt-2 inline-block text-sm font-medium text-brand-600">
                  {t("messages.browse_listings")} →
                </Link>
              </div>
            )}
          </div>
        </main>

        <main className="mx-auto hidden max-w-7xl px-4 py-8 sm:px-6 lg:px-8 md:block">
          <div className="mb-8 rounded-xl bg-white/70 p-6 shadow-md backdrop-blur-sm">
            <h1 className="font-display text-3xl font-bold text-gray-900">
              {t("dashboard.welcome_back")}, {user.full_name || user.email.split("@")[0]}
            </h1>
            <p className="mt-2 text-gray-600">{t("dashboard.manage_desc")}</p>
          </div>

          {pendingListings.length > 0 && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-yellow-200">
                <svg className="h-5 w-5 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-yellow-800">
                  {pendingListings.length} {listingCountWord} {t("dashboard.pending_review_suffix")}
                </p>
                <p className="text-xs text-yellow-600">{t("dashboard.pending_notice")}</p>
              </div>
            </div>
          )}

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-6">
              <p className="text-sm text-gray-500">{t("dashboard.stat.active_listings")}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{activeListings.length}</p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-gray-500">{t("dashboard.stat.sold")}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{soldListings.length}</p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-gray-500">{t("dashboard.stat.conversations")}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{conversations.length}</p>
            </div>
            <div className="card p-6">
              <p className="text-sm text-gray-500">{t("dashboard.stat.unread_messages")}</p>
              <p className="mt-2 text-3xl font-bold text-brand-600">{unreadCount}</p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="card">
              <div className="flex items-center justify-between border-b border-gray-100 p-6">
                <h2 className="font-display text-lg font-semibold text-gray-900">{t("my_listings.title")}</h2>
                <Link to="/listings/new" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  + {t("nav.new_listing")}
                </Link>
              </div>

              {listings.length > 0 ? (
                <div className="space-y-3 p-4">
                  {listings.slice(0, 5).map((listing: any) => (
                    <div key={listing.id} className="relative">
                      <ListingCardCompact listing={listing} isUserLoggedIn={true} currentUserId={(user as any)?.id ?? null} />
                      <div className="absolute right-3 top-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${statusColors[listing.status as keyof typeof statusColors]}`}>
                          {translateStatus(listing.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500">{t("my_listings.no_listings")}</p>
                  <Link to="/listings/new" className="mt-4 inline-block font-medium text-brand-600 hover:text-brand-700">
                    {t("my_listings.create_first_cta")} →
                  </Link>
                </div>
              )}

              {listings.length > 5 && (
                <div className="border-t border-gray-100 p-4">
                  <Link to="/my-listings" className="text-sm text-gray-600 hover:text-gray-900">
                    {t("dashboard.view_all_listings")} {listings.length} {t("my_listings.listing_plural")} →
                  </Link>
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between border-b border-gray-100 p-6">
                <h2 className="font-display text-lg font-semibold text-gray-900">{t("dashboard.recent_messages")}</h2>
                <Link to="/messages" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  {t("dashboard.view_all")}
                </Link>
              </div>

              {conversations.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {conversations.map((conv: any) => {
                    const lastMessage = conv.messages?.[conv.messages.length - 1];
                    const hasUnread = conv.messages?.some((m: any) => m.sender_id !== user.id && !m.read_at);

                    return (
                      <Link
                        key={conv.id}
                        to={`/messages?c=${conv.short_id || conv.id}`}
                        className="block p-4 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className={`truncate font-medium ${hasUnread ? "text-gray-900" : "text-gray-600"}`}>
                              {conv.listing?.title || t("dashboard.conversation_fallback")}
                            </p>
                            {lastMessage && <p className="mt-1 truncate text-sm text-gray-500">{lastMessage.content}</p>}
                          </div>
                          {hasUnread && <span className="ml-4 h-2.5 w-2.5 rounded-full bg-brand-500" />}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500">{t("dashboard.no_conversations")}</p>
                  <p className="mt-1 text-sm text-gray-400">{t("dashboard.start_browsing")}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card mt-8 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || user.email}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">{user.full_name || user.email}</p>
                  <p className="text-gray-500">
                    {user.user_type === "tour_operator" ? user.company_name || t("dashboard.role_tour_operator") : t("profile.avatar.private_runner")}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {user.is_verified ? (
                      <span className="inline-flex items-center gap-1 text-sm text-brand-600">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {t("dashboard.verified")}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">{t("dashboard.not_verified")}</span>
                    )}
                  </div>
                </div>
              </div>
              <Link to="/profile" className="btn-secondary">
                {t("dashboard.edit_profile")}
              </Link>
            </div>
          </div>
        </main>
      </div>
    </ControlPanelLayout>
  );
}
