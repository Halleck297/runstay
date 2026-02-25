import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, Outlet, redirect, useLoaderData, useLocation } from "react-router";
import { ControlPanelLayout } from "~/components/ControlPanelLayout";
import { tourOperatorNavItems } from "~/components/panelNav";
import { localizeListing } from "~/lib/locale";
import { applyListingDisplayCurrency, getCurrencyForCountry } from "~/lib/currency";
import { requireUser } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getPublicDisplayName } from "~/lib/user-display";

const EN_TEXT: Record<string, string> = {
  "nav.dashboard": "Dashboard",
  "nav.new_listing": "New Listing",
  "dashboard.panel_label": "Tour Operator Panel",
  "dashboard.mobile_title": "TO Panel",
  "dashboard.role_tour_operator": "Tour Operator",
  "dashboard.welcome_back": "Welcome back",
  "dashboard.action_hub": "Action Hub",
  "dashboard.action_hub_desc": "Your daily priorities in one place.",
  "dashboard.needs_action": "Needs action",
  "dashboard.new_leads": "New leads",
  "dashboard.quick_actions": "Quick actions",
  "dashboard.snapshot": "Snapshot",
  "dashboard.pending": "Pending review",
  "dashboard.rejected": "Rejected",
  "dashboard.expiring": "Expiring soon",
  "dashboard.all_clear": "All clear. No urgent actions right now.",
  "dashboard.open_messages": "Open messages",
  "dashboard.view_all": "View all",
  "dashboard.no_conversations": "No conversations yet",
  "dashboard.review_listings": "Review listings",
  "dashboard.manage_listings": "Manage listings",
  "dashboard.edit_profile": "Edit profile",
  "dashboard.support": "Support",
  "dashboard.stat.active": "Active",
  "dashboard.stat.pending": "Pending",
  "dashboard.stat.unread": "Unread",
  "dashboard.stat.chats": "Chats",
  "dashboard.item_listings": "listings",
  "dashboard.item_conversations": "conversations",
  "dashboard.item_messages": "messages",
};

export const meta: MetaFunction = () => {
  return [{ title: "TO Panel - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const locale = "en";
  const viewerCurrency = getCurrencyForCountry((user as any)?.country || null);

  if (user.user_type !== "tour_operator") {
    return redirect("/listings");
  }

  const { data: listings } = await supabaseAdmin
    .from("listings")
    .select(`
      *,
      event:events(id, name, name_i18n, slug, country, country_i18n, event_date, card_image_url)
    `)
    .eq("author_id", user.id)
    .order("created_at", { ascending: false });

  const localizedListings = (listings || []).map((listing: any) =>
    applyListingDisplayCurrency(localizeListing(listing, locale), viewerCurrency)
  );

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
    listing: conv.listing ? applyListingDisplayCurrency(localizeListing(conv.listing, locale), viewerCurrency) : conv.listing,
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

export default function ToPanel() {
  const { user, listings, conversations, unreadCount } = useLoaderData<typeof loader>();
  const location = useLocation();
  const t = (key: string) => EN_TEXT[key] || key;

  if (location.pathname !== "/to-panel" && location.pathname !== "/to-panel/") {
    return <Outlet />;
  }

  const publicName = getPublicDisplayName(user);

  const pendingListings = listings.filter((l: any) => l.status === "pending");
  const rejectedListings = listings.filter((l: any) => l.status === "rejected");
  const activeListings = listings.filter((l: any) => l.status === "active");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiringSoonListings = activeListings.filter((listing: any) => {
    const eventDate = new Date(listing.event?.event_date || "");
    if (Number.isNaN(eventDate.getTime())) return false;
    eventDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 14;
  });

  const panelNavItems = tourOperatorNavItems.map((item) =>
    item.to === "/messages"
      ? { ...item, badgeCount: unreadCount, badgeTone: "brand" as const, hideBadgeWhenActive: true }
      : item
  );

  const actionCards = [
    {
      label: t("dashboard.rejected"),
      count: rejectedListings.length,
      tone: "red" as const,
      to: "/to-panel/listings",
    },
    {
      label: t("dashboard.pending"),
      count: pendingListings.length,
      tone: "yellow" as const,
      to: "/to-panel/listings",
    },
    {
      label: t("dashboard.expiring"),
      count: expiringSoonListings.length,
      tone: "blue" as const,
      to: "/to-panel/listings",
    },
  ].filter((card) => card.count > 0);

  const toneClasses: Record<"yellow" | "red" | "blue", string> = {
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <ControlPanelLayout
      panelLabel={t("dashboard.panel_label")}
      mobileTitle={t("dashboard.mobile_title")}
      homeTo="/to-panel"
      user={{
        fullName: publicName,
        email: user.email,
        roleLabel: t("dashboard.role_tour_operator"),
        avatarUrl: user.avatar_url,
      }}
      navItems={panelNavItems}
    >
      <div className="-m-4 min-h-full bg-slate-100 md:-m-8">
        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:py-8 md:pb-8 lg:px-8">
          <div className="mb-6 rounded-3xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-white to-orange-50 p-6 shadow-sm">
            <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
              {t("dashboard.welcome_back")}, {publicName}
            </h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">{t("dashboard.action_hub_desc")}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-gray-900">{t("dashboard.needs_action")}</h2>
                  <Link to="/to-panel/listings" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    {t("dashboard.view_all")}
                  </Link>
                </div>

                {actionCards.length > 0 ? (
                  <div className="space-y-3">
                    {actionCards.map((card) => (
                      <Link
                        key={card.label}
                        to={card.to}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors hover:brightness-95 ${toneClasses[card.tone]}`}
                      >
                        <span className="text-sm font-medium">{card.label}</span>
                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-sm font-semibold">{card.count}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                    {t("dashboard.all_clear")}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-gray-900">{t("dashboard.new_leads")}</h2>
                  <Link to="/messages" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    {t("dashboard.open_messages")}
                  </Link>
                </div>

                {conversations.length > 0 ? (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/60">
                    {conversations.slice(0, 3).map((conv: any) => {
                      const sortedMessages = [...(conv.messages || [])].sort(
                        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      );
                      const lastMessage = sortedMessages[0];
                      const hasUnread = conv.messages?.some((m: any) => m.sender_id !== user.id && !m.read_at);

                      return (
                        <Link
                          key={conv.id}
                          to={`/messages?c=${conv.short_id || conv.id}`}
                          className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-white"
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm ${hasUnread ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                              {conv.listing?.title || "Conversation"}
                            </p>
                            {lastMessage && (
                              <p className="mt-0.5 truncate text-xs text-gray-500">{lastMessage.content}</p>
                            )}
                          </div>
                          {hasUnread && <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-brand-500" />}
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-gray-500">
                    {t("dashboard.no_conversations")}
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 font-display text-lg font-semibold text-gray-900">{t("dashboard.quick_actions")}</h2>
                <div className="space-y-2.5">
                  <Link to="/to-panel/listings/new" className="btn-primary block w-full rounded-full px-4 py-2.5 text-center text-sm">
                    + {t("nav.new_listing")}
                  </Link>
                  <Link to="/messages" className="block w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {t("dashboard.open_messages")}
                  </Link>
                  <Link to="/to-panel/listings" className="block w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {t("dashboard.manage_listings")}
                  </Link>
                  <Link to="/to-panel/profile" className="block w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {t("dashboard.edit_profile")}
                  </Link>
                  <Link to="/to-panel/support" className="block w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {t("dashboard.support")}
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 font-display text-lg font-semibold text-gray-900">{t("dashboard.snapshot")}</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t("dashboard.stat.active")}</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{activeListings.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t("dashboard.stat.pending")}</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{pendingListings.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t("dashboard.stat.chats")}</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{conversations.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t("dashboard.stat.unread")}</p>
                    <p className="mt-1 text-xl font-bold text-brand-600">{unreadCount}</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </ControlPanelLayout>
  );
}
