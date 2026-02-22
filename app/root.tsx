import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, Form, useRouteError, isRouteErrorResponse, Link, redirect, data, useRouteLoaderData } from "react-router";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { useEffect, useState } from "react";
import { getUser, getAccessToken, getImpersonationContext } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import {
  buildLocaleCookie,
  getLocaleFromCookie,
  LOCALE_COOKIE_NAME,
  resolveLocaleForRequest,
} from "~/lib/locale";
import CookieBanner from "~/components/CookieBanner";
import { MobileNav } from "~/components/MobileNav";
import "./styles/tailwind.css";

export const links: LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "apple-touch-icon-precomposed", href: "/apple-touch-icon-precomposed.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@400;500;600;700&display=swap",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const user = await getUser(request);
  const locale = resolveLocaleForRequest(request, (user as any)?.preferred_language);
  const currentCookieLocale = getLocaleFromCookie(request.headers.get("Cookie"));
  const shouldSetLocaleCookie = currentCookieLocale !== locale;

  if (url.pathname === "/") {
    return redirect(`/${locale}${url.search}`, {
      headers: {
        "Set-Cookie": buildLocaleCookie(locale),
      },
    });
  }

  const accessToken = await getAccessToken(request);

  // Se l'utente è loggato, conta i messaggi non letti + notifiche
  let unreadCount = 0;
  let unreadNotifications = 0;
  if (user) {
    const [convResult, notifResult] = await Promise.all([
      supabaseAdmin
        .from("conversations")
        .select(`
          id,
          messages(id, sender_id, read_at)
        `)
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`),
      supabaseAdmin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);

    if (convResult.data) {
      convResult.data.forEach((conv: any) => {
        conv.messages?.forEach((msg: any) => {
          if (msg.sender_id !== user.id && !msg.read_at) {
            unreadCount++;
          }
        });
      });
    }

    unreadNotifications = notifResult.count || 0;
  }

  // Check if admin is impersonating someone
  let impersonation = null;
  try {
    impersonation = await getImpersonationContext(request);
  } catch (e) {
    console.error("Impersonation context error:", e);
  }

  return data(
    {
      user: user ? { ...user, unreadCount, unreadNotifications } : null,
      impersonation,
      locale,
      localeCookieName: LOCALE_COOKIE_NAME,
      ENV: {
        SUPABASE_URL: process.env.SUPABASE_URL!,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
        ACCESS_TOKEN: accessToken,
      },
    },
    shouldSetLocaleCookie
      ? {
          headers: {
            "Set-Cookie": buildLocaleCookie(locale),
          },
        }
      : undefined
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const rootData = useRouteLoaderData("root") as { locale?: string } | undefined;
  const htmlLang = rootData?.locale ?? "en";

  return (
    <html lang={htmlLang} className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-gray-50 font-sans text-gray-900 antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const statusCode = isRouteErrorResponse(error) ? error.status : 500;
  const title = isNotFound ? "Page not found" : "Something went wrong";
  const message = isNotFound
    ? "The page you requested could not be found."
    : "An unexpected error occurred. Please try again.";
  const isAdminPath = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  const primaryLink = isAdminPath ? "/admin" : "/";
  const primaryLabel = isAdminPath ? "Back to admin" : "Go to home";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-alert-600">{statusCode}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-3 text-gray-600">{message}</p>

        {isRouteErrorResponse(error) && error.statusText && (
          <p className="mt-2 text-sm text-gray-500">{error.statusText}</p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to={primaryLink} className="btn-primary w-full sm:w-auto">
            {primaryLabel}
          </Link>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="btn-secondary w-full sm:w-auto"
          >
            Reload page
          </button>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const { user, impersonation, ENV, locale, localeCookieName } = useLoaderData<typeof loader>();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.ENV = ${JSON.stringify(ENV)};window.__LOCALE__=${JSON.stringify(locale)};window.__LOCALE_COOKIE__=${JSON.stringify(localeCookieName)};`,
        }}
      />
      {/* Impersonation Banner */}
      {hydrated && impersonation?.isImpersonating && impersonation.targetUser && (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-alert-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-lg">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Viewing as <strong>{(impersonation.targetUser as any).full_name || (impersonation.targetUser as any).email}</strong>
            {(impersonation.targetUser as any).company_name && (
              <span className="opacity-80">({(impersonation.targetUser as any).company_name})</span>
            )}
          </span>
          <Form method="post" action="/admin/impersonate/stop" className="inline">
            <button
              type="submit"
              className="ml-2 bg-white text-alert-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-alert-50 transition-colors"
            >
              Exit Impersonation
            </button>
          </Form>
        </div>
      )}
      <Outlet />
      <CookieBanner />
      <MobileNav user={user} />
    </>
  );
}
