import { Link, Form } from "@remix-run/react";
import type { Database } from "~/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface HeaderProps {
  user: Profile | null;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
         <Link to="/" className="flex items-center gap-4 py-2">
  <img 
    src="/logo.png" 
    alt="Runoot"
    className="h-16 w-auto  object-contain self-center"
  />
</Link>




          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/listings"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Browse
            </Link>
            {user && (
              <Link
                to="/listings/new"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Create Listing
              </Link>
            )}
          </nav>

          {/* User menu */}
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/messages"
                  className="relative text-gray-600 hover:text-gray-900"
                >
                <svg
  className="h-6 w-6"
  fill="none"
  viewBox="0 0 24 24"
  stroke="currentColor"
>
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
  />
</svg>
                </Link>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-medium text-sm">
                    {user.full_name?.charAt(0) ||
                      user.email.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block font-medium">
                    {user.full_name || user.email.split("@")[0]}
                  </span>
                </Link>
                <Form action="/logout" method="post">
                  <button
                    type="submit"
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    Logout
                  </button>
                </Form>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  Login
                </Link>
                <Link to="/register" className="btn-primary">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
