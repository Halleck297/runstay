import { Link, Form, useFetcher } from "react-router";
import { useEffect, useState, useRef } from "react";
import type { Database } from "~/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  unreadCount?: number;
};

interface HeaderProps {
  user: Profile | null;
}

// Polling interval for unread count
const UNREAD_POLL_INTERVAL = 5000;

export function Header({ user }: HeaderProps) {
  const fetcher = useFetcher<{ unreadCount: number }>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isPollingRef = useRef(false);

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

  // Usa il conteggio dal fetcher o dal user (passato dal root loader)
  const unreadCount = fetcher.data?.unreadCount ?? (user as any)?.unreadCount ?? 0;

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        <div className="flex h-20 items-center justify-between">
          
          {/* Logo */}
          <Link to="/" className="flex items-center -ml-6">
           <img
             src="/logo.png"
             alt="Runoot"
             className="h-12 w-auto"
           />
         </Link>


{/* Navigation */}
{user ? (
  <nav className="flex items-center justify-end flex-1">
    <div className="flex items-center gap-6">

      {/* Search button (Browse Listings) */}
      <Link
        to="/listings"
        className="flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 transition-colors"
        title="Browse Listings"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </Link>

      {/* User menu dropdown */}
<div
  className="relative"
  onMouseEnter={() => setIsMenuOpen(true)}
  onMouseLeave={() => setIsMenuOpen(false)}
>
<button
  className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-full bg-white hover:bg-gray-50 text-gray-900 transition-colors"
>
  {/* Pallino rosso notifiche */}
  {unreadCount > 0 && (
    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
  )}
  <span className="text-sm font-bold">{user.full_name || user.email}</span>
  <svg
    className={`h-4 w-4 text-gray-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
</button>



        {/* Dropdown menu */}
        {isMenuOpen && (
          <>
            
            
            {/* Menu */}
            <div className="absolute right-0 top-full w-56 rounded-2xl bg-white shadow-lg border border-gray-200 py-2 z-20">

              {/* Dashboard - solo per Tour Operators */}
{user.user_type === "tour_operator" && (
  <Link
    to="/dashboard"
    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
   
  >
    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
    Dashboard
  </Link>
)}

              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profilo
              </Link>

              {/* My Listings - link condizionale */}
              <Link
                to={user.user_type === "tour_operator" ? "/dashboard" : "/my-listings"}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {user.user_type === "tour_operator" ? "My Listings" : "My Listing"}
              </Link>

              <Link
                to="/messages"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="flex-1">Messages</span>
                {/* Pallino rosso nel dropdown */}
                {unreadCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                to="/saved"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Saved
              </Link>

              {/* Divisore */}
              <div className="my-2 border-t border-gray-100" />

              <Link
                to="/settings"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Link>

              <Form method="post" action="/logout">
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </Form>
            </div>
          </>
        )}
      </div>

      {/* Bottone New Listing */}
      <Link
        to="/listings/new"
        className="btn-primary flex items-center gap-2 px-8 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-accent-500/30"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="hidden sm:inline">New Listing</span>
        <span className="sm:hidden">New</span>
      </Link>
    </div>
  </nav>
) : (
  <nav className="flex items-center gap-4">
    <Link to="/login" className="btn-secondary rounded-full">
      Login
    </Link>
    <Link to="/register" className="btn-primary rounded-full shadow-lg shadow-accent-500/30">
      Sign up
    </Link>
  </nav>
)}



        </div>
      </div>
    </header>
  );
}
