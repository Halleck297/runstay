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
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="font-display text-xl font-bold text-gray-900">
              RunStay
            </span>
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
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
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
