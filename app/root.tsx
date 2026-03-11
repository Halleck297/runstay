import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, Form, useRouteError, isRouteErrorResponse, redirect, data, useRouteLoaderData, useLocation } from "react-router";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { useEffect, useState } from "react";
import { getUser, getAccessTokenWithRefresh, getImpersonationContext } from "~/lib/session.server";
import { NotFoundPage } from "~/components/NotFoundPage";
import { ServerErrorPage } from "~/components/ServerErrorPage";
import {
  buildLocaleCookie,
  getLocaleFromCookie,
  LOCALE_COOKIE_NAME,
  resolveLocaleForRequest,
} from "~/lib/locale";
import CookieBanner from "~/components/CookieBanner";
import { MobileNav } from "~/components/MobileNav";
import { identifyUser, resetAnalytics, trackPage } from "~/lib/analytics/client";
import "./styles/tailwind.css";

export const links: LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "apple-touch-icon-precomposed", href: "/apple-touch-icon-precomposed.png" },
  {
    rel: "preload",
    href: "/fonts/dm-sans-400.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    href: "/fonts/dm-sans-700.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    href: "/fonts/sora-v17-700.woff2",
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    href: "/hero-mobile.webp",
    as: "image",
    type: "image/webp",
    media: "(max-width: 767px)",
  },
  {
    rel: "preload",
    href: "/hero.webp",
    as: "image",
    type: "image/webp",
    media: "(min-width: 768px)",
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
      status: 307,
      headers: {
        "Set-Cookie": buildLocaleCookie(locale),
      },
    });
  }

  const accessTokenResult = await getAccessTokenWithRefresh(request);
  const accessToken = accessTokenResult.accessToken;

  // Check if admin is impersonating someone
  let impersonation = null;
  try {
    impersonation = await getImpersonationContext(request);
  } catch (e) {
    console.error("Impersonation context error:", e);
  }

  const responseHeaders = new Headers();
  if (shouldSetLocaleCookie) {
    responseHeaders.append("Set-Cookie", buildLocaleCookie(locale));
  }
  if (accessTokenResult.setCookie) {
    responseHeaders.append("Set-Cookie", accessTokenResult.setCookie);
  }
  if (user) {
    responseHeaders.set("Cache-Control", "private, no-store");
  } else if (responseHeaders.has("Set-Cookie")) {
    responseHeaders.set("Cache-Control", "private, no-store");
  } else {
    responseHeaders.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  }

  return data(
    {
      user: user ? { ...user, unreadCount: 0, unreadNotifications: 0 } : null,
      impersonation,
      locale,
      localeCookieName: LOCALE_COOKIE_NAME,
      ENV: {
        SUPABASE_URL: process.env.SUPABASE_URL!,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
        ACCESS_TOKEN: accessToken,
        ANALYTICS_PROVIDER:
          process.env.ANALYTICS_PROVIDER ||
          (process.env.ANALYTICS_WRITE_KEY || process.env.VITE_PUBLIC_POSTHOG_KEY ? "posthog" : "none"),
        ANALYTICS_WRITE_KEY:
          process.env.ANALYTICS_WRITE_KEY ||
          process.env.VITE_PUBLIC_POSTHOG_KEY ||
          "",
        ANALYTICS_HOST:
          process.env.ANALYTICS_HOST ||
          process.env.VITE_PUBLIC_POSTHOG_HOST ||
          (process.env.ANALYTICS_PROVIDER === "posthog" || process.env.ANALYTICS_WRITE_KEY || process.env.VITE_PUBLIC_POSTHOG_KEY ? "/ph" : ""),
        ANALYTICS_UI_HOST:
          process.env.ANALYTICS_UI_HOST ||
          process.env.VITE_PUBLIC_POSTHOG_UI_HOST ||
          (process.env.ANALYTICS_HOST?.includes("eu") || process.env.VITE_PUBLIC_POSTHOG_HOST?.includes("eu")
            ? "https://eu.posthog.com"
            : "https://us.posthog.com"),
        ANALYTICS_DEBUG: process.env.ANALYTICS_DEBUG || "false",
        ANALYTICS_PLAUSIBLE_DOMAIN: process.env.ANALYTICS_PLAUSIBLE_DOMAIN || "",
        ANALYTICS_GA_MEASUREMENT_ID: process.env.ANALYTICS_GA_MEASUREMENT_ID || "",
        ANALYTICS_COOKIELESS_MODE: process.env.ANALYTICS_COOKIELESS_MODE || "",
      },
    },
    {
      headers: responseHeaders,
    }
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const rootData = useRouteLoaderData("root") as { locale?: string } | undefined;
  const htmlLang = rootData?.locale ?? "en";

  return (
    <html lang={htmlLang} className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="format-detection" content="telephone=no, email=no, address=no, date=no" />
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

  if (isNotFound) {
    return <NotFoundPage />;
  }

  return <ServerErrorPage statusCode={statusCode} />;
}

export default function App() {
  const { user, impersonation, ENV, locale, localeCookieName } = useLoaderData<typeof loader>();
  const location = useLocation();
  const [hydrated, setHydrated] = useState(false);
  const hideMobileNav =
    /(^|\/)(login|register)(\/|$)/.test(location.pathname) ||
    location.pathname.includes("/join/") ||
    location.pathname.includes("/join-team/");

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("mobile-nav-hidden", hideMobileNav);
    return () => document.body.classList.remove("mobile-nav-hidden");
  }, [hideMobileNav]);

  useEffect(() => {
    trackPage(`${location.pathname}${location.search}`, {
      locale,
      has_user: !!user,
    });
  }, [location.pathname, location.search, locale, user]);

  useEffect(() => {
    if (user?.id) {
      identifyUser(user.id, {
        user_type: (user as any)?.user_type || null,
        preferred_language: (user as any)?.preferred_language || null,
        country: (user as any)?.country || null,
        verified: !!(user as any)?.is_verified,
      });
      return;
    }
    resetAnalytics();
  }, [user]);

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
