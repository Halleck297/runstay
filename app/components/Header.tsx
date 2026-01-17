import { Link, Form, useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import type { Database } from "~/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface HeaderProps {
  user: Profile | null;
}

export function Header({ user }: HeaderProps) {
  const fetcher = useFetcher<{ unreadCount: number }>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Carica il conteggio messaggi non letti quando il componente si monta
  useEffect(() => {
    if (user && fetcher.state === "idle" && !fetcher.data) {
      fetcher.load("/api/unread");
    }
  }, [user]);

  const unreadCount = fetcher.data?.unreadCount || 0;

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          
          {/* Logo */}
          <Link to="/" className="flex items-center">
           <img 
             src="/logo.png" 
             alt="Runoot" 
             className="h-16 w-auto"
           />
         </Link>


{/* Navigation */}
{user ? (
  <nav className="flex items-center justify-between flex-1">
    {/* Browse Listings - centrato */}
    <div className="flex-1 flex justify-center">
      <Link
        to="/listings"
        className="text-gray-700 hover:text-gray-900 font-medium text-xl"
      >
        Browse Listings
      </Link>
    </div>

    <div className="flex items-center gap-6">
      

      {/* User menu dropdown */}
<div 
  className="relative"
  onMouseEnter={() => setIsMenuOpen(true)}
  onMouseLeave={() => setIsMenuOpen(false)}
>
<button
  className="flex items-center gap-2 text-gray-900 hover:text-gray-700"
>
  {/* Pallino rosso notifiche */}
  {unreadCount > 0 && (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  )}
  <span className="text-lg font-medium">{user.full_name || user.email}</span>
  <svg
    className={`h-5 w-5 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
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
            <div className="absolute right-0 top-full w-56 rounded-lg bg-white shadow-lg border border-gray-200 py-2 z-20">

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

              {/* My Listings - label condizionale */}
              <Link
                to="/dashboard"
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
        className="btn-primary flex items-center gap-2"
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
    <Link to="/login" className="btn-secondary">
      Login
    </Link>
    <Link to="/register" className="btn-primary">
      Sign up
    </Link>
  </nav>
)}



        </div>
      </div>
    </header>
  );
}
