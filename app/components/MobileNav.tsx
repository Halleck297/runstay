import { Link, useLocation, useFetcher, Form } from "react-router";
import { useEffect, useRef, useState } from "react";
import type { Database } from "~/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface MobileNavProps {
  user: Profile | null;
}

// Polling interval for unread count
const UNREAD_POLL_INTERVAL = 5000;

export function MobileNav({ user }: MobileNavProps) {
  const location = useLocation();
  const fetcher = useFetcher<{ unreadCount: number }>();
  const isPollingRef = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Polling per il conteggio messaggi non letti
  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    // Initial load
    if (fetcher.state === "idle" && !fetcher.data) {
      fetcher.load("/api/unread");
    }

    const poll = () => {
      if (isPollingRef.current) return;
      if (fetcher.state !== "idle") return;

      isPollingRef.current = true;
      fetcher.load("/api/unread");
      isPollingRef.current = false;
    };

    const intervalId = setInterval(poll, UNREAD_POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, fetcher]);

  const unreadCount = fetcher.data?.unreadCount ?? 0;

  // Don't show on login/register pages
  if (location.pathname === "/login" || location.pathname === "/register") {
    return null;
  }

  // Check if current path matches
  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  // My Listing path depends on user type
  const myListingPath = user?.user_type === "tour_operator" ? "/dashboard" : "/my-listings";

  // Close sidebar when route changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Get first name for display
  const firstName = user?.full_name?.split(' ')[0] || 'Menu';

  return (
    <>
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer (now opens from top) */}
      <div
        className={`md:hidden fixed top-16 right-2 w-56 bg-white rounded-2xl shadow-xl z-50 transform transition-all duration-200 ease-out ${
          isSidebarOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 p-3 border-b border-gray-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-semibold text-sm">
            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-sm truncate">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-gray-500">{user?.user_type === 'tour_operator' ? 'Tour Operator' : 'Private'}</p>
          </div>
        </div>

        {/* Sidebar Menu */}
        <div className="py-1">
          {/* Dashboard - solo per Tour Operators */}
          {user?.user_type === "tour_operator" && (
            <Link
              to="/dashboard"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
          )}

          <Link
            to="/profile"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Profile
          </Link>

          <Link
            to={myListingPath}
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {user?.user_type === "tour_operator" ? "My Listings" : "My Listing"}
          </Link>

          <Link
            to="/saved"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Saved
          </Link>

          <div className="my-1 border-t border-gray-100" />

          <Link
            to="/settings"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>

          <Form method="post" action="/logout">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </Form>
        </div>
      </div>

      {/* Top Navigation (inverted from bottom) */}
      <nav className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40 safe-area-top">
      <div className="flex items-center justify-around h-16 px-2">
        {/* Home */}
        <Link
          to="/"
          className={`flex flex-col items-center justify-center flex-1 py-2 ${
            isActive("/") && !isActive("/listings") && !isActive("/messages") && !isActive("/profile") && !isActive("/my-listings") && !isActive("/dashboard")
              ? "text-brand-600"
              : "text-gray-500"
          }`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive("/") && !isActive("/listings") ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] mt-0.5 font-medium">Home</span>
        </Link>

        {/* Listings/Search */}
        <Link
          to="/listings"
          className={`flex flex-col items-center justify-center flex-1 py-2 ${
            isActive("/listings") && !location.pathname.includes("/new")
              ? "text-brand-600"
              : "text-gray-500"
          }`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive("/listings") && !location.pathname.includes("/new") ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-[10px] mt-0.5 font-medium">Search</span>
        </Link>

        {/* New Listing */}
        <Link
          to={user ? "/listings/new" : "/login"}
          className={`flex flex-col items-center justify-center flex-1 py-2 ${
            location.pathname === "/listings/new"
              ? "text-accent-600"
              : "text-gray-500"
          }`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={location.pathname === "/listings/new" ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-[10px] mt-0.5 font-medium">New</span>
        </Link>

        {/* Messages */}
        {user ? (
          <Link
            to="/messages"
            className={`flex flex-col items-center justify-center flex-1 py-2 relative ${
              isActive("/messages")
                ? "text-brand-600"
                : "text-gray-500"
            }`}
          >
            <div className="relative">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive("/messages") ? 2.5 : 2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {/* Badge notifiche */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Messages</span>
          </Link>
        ) : (
          <Link
            to="/login"
            className="flex flex-col items-center justify-center flex-1 py-2 text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">Messages</span>
          </Link>
        )}

        {/* Profile / Menu */}
        {user ? (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 py-2 ${
              isActive("/profile") || isActive("/settings") || isActive("/saved") || isActive(myListingPath)
                ? "text-brand-600"
                : "text-gray-500"
            }`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive("/profile") || isActive("/settings") || isActive("/saved") ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">Profile</span>
          </button>
        ) : (
          <Link
            to="/login"
            className="flex flex-col items-center justify-center flex-1 py-2 text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">Login</span>
          </Link>
        )}
      </div>
    </nav>
    </>
  );
}
