import { Link } from "react-router";
import { useI18n } from "~/hooks/useI18n";

export type ToProfileSidebarItem = {
  label: string;
  href: string;
  icon: "user" | "running" | "share" | "settings";
};

type ToProfileSidebarProps = {
  user: {
    avatar_url?: string | null;
    email?: string | null;
  };
  publicName: string;
  items: ToProfileSidebarItem[];
  locationPathname: string;
  onAvatarClick?: () => void;
};

export function ToProfileSidebar({ user, publicName, items, locationPathname, onAvatarClick }: ToProfileSidebarProps) {
  const { t } = useI18n();
  const initial = publicName.trim().charAt(0).toUpperCase() || "?";

  return (
    <aside className="flex-shrink-0 lg:w-64">
      <div className="rounded-3xl border border-gray-200/80 bg-white/95 p-4 shadow-[0_10px_35px_-18px_rgba(15,23,42,0.35)] backdrop-blur-sm md:p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          {onAvatarClick ? (
            <button
              type="button"
              onClick={onAvatarClick}
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-bold text-white ring-offset-2 transition-all hover:scale-[1.03] hover:ring-2 hover:ring-brand-300 md:h-24 md:w-24 md:text-3xl"
              aria-label="Choose avatar"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={publicName} className="h-20 w-20 rounded-full object-cover md:h-24 md:w-24" />
              ) : (
                initial
              )}
            </button>
          ) : (
            <Link
              to="/to-panel/profile"
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-bold text-white ring-offset-2 transition-all hover:scale-[1.03] hover:ring-2 hover:ring-brand-300 md:h-24 md:w-24 md:text-3xl"
              aria-label="Go to company info"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={publicName} className="h-20 w-20 rounded-full object-cover md:h-24 md:w-24" />
              ) : (
                initial
              )}
            </Link>
          )}
          <p className="-mt-1 mb-3 text-xs font-medium text-gray-500">{t("profile.avatar.click_to_change")}</p>
          <h2 className="font-display text-lg font-semibold text-gray-900">{publicName}</h2>
          <p className="mt-1 text-sm text-gray-500">{user.email || ""}</p>
          <span className="mt-2 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {t("common.tour_operator")}
          </span>
        </div>

        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = locationPathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-brand-100 text-brand-800 shadow-sm ring-1 ring-brand-200"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.icon === "user" && (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
                {item.icon === "running" && (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                {item.icon === "share" && (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
                {item.icon === "settings" && (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
