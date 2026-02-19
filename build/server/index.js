import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, createCookieSessionStorage, redirect, useLocation, useFetcher, Link, Form, UNSAFE_withErrorBoundaryProps, useRouteError, isRouteErrorResponse, UNSAFE_withComponentProps, useLoaderData, Outlet, Meta, Links, ScrollRestoration, Scripts, useActionData, useNavigation, data, useNavigate, useSearchParams, useParams } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
const streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders
    });
  }
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");
    let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
    let timeoutId = setTimeout(
      () => abort(),
      streamTimeout + 1e3
    );
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId);
              timeoutId = void 0;
              callback();
            }
          });
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          pipe(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}
const storage = createCookieSessionStorage({
  cookie: {
    name: "runoot_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    // 30 days
    httpOnly: true
  }
});
async function createUserSession(userId, accessToken, refreshToken, redirectTo) {
  const session = await storage.getSession();
  session.set("userId", userId);
  session.set("accessToken", accessToken);
  session.set("refreshToken", refreshToken);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session)
    }
  });
}
async function getUserSession(request) {
  return storage.getSession(request.headers.get("Cookie"));
}
async function getUserId(request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}
async function getAccessToken(request) {
  const session = await getUserSession(request);
  return session.get("accessToken");
}
async function getUser(request) {
  const session = await getUserSession(request);
  const impersonatingAs = session.get("impersonatingAs");
  if (impersonatingAs) {
    const { data: profile2 } = await supabaseAdmin.from("profiles").select("*").eq("id", impersonatingAs).single();
    return profile2;
  }
  const userId = await getUserId(request);
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return profile;
}
async function getRealUserId(request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}
async function requireUserId(request, redirectTo = new URL(request.url).pathname) {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}
async function requireUser(request) {
  const userId = await requireUserId(request);
  const session = await getUserSession(request);
  const impersonatingAs = session.get("impersonatingAs");
  if (impersonatingAs) {
    const { data: profile2 } = await supabaseAdmin.from("profiles").select("*").eq("id", impersonatingAs).single();
    if (!profile2) {
      throw await stopImpersonation(request);
    }
    return profile2;
  }
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!profile) {
    throw await logout(request);
  }
  return profile;
}
async function requireAdmin(request) {
  const realUserId = await requireUserId(request);
  const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("id", realUserId).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    throw redirect("/");
  }
  return profile;
}
async function startImpersonation(request, targetUserId) {
  const session = await getUserSession(request);
  const adminId = session.get("userId");
  session.set("impersonatingAs", targetUserId);
  session.set("originalAdminId", adminId);
  await logAdminAction(adminId, "impersonate_start", {
    targetUserId,
    details: { started_at: (/* @__PURE__ */ new Date()).toISOString() }
  });
  return redirect("/", {
    headers: {
      "Set-Cookie": await storage.commitSession(session)
    }
  });
}
async function stopImpersonation(request) {
  const session = await getUserSession(request);
  const adminId = session.get("userId");
  const targetUserId = session.get("impersonatingAs");
  if (adminId && targetUserId) {
    await logAdminAction(adminId, "impersonate_stop", {
      targetUserId,
      details: { stopped_at: (/* @__PURE__ */ new Date()).toISOString() }
    });
  }
  session.unset("impersonatingAs");
  session.unset("originalAdminId");
  return redirect("/admin", {
    headers: {
      "Set-Cookie": await storage.commitSession(session)
    }
  });
}
async function getImpersonationContext(request) {
  const session = await getUserSession(request);
  const impersonatingAs = session.get("impersonatingAs");
  const originalAdminId = session.get("originalAdminId");
  if (!impersonatingAs || !originalAdminId) {
    return null;
  }
  const { data: targetUser } = await supabaseAdmin.from("profiles").select("id, full_name, email, user_type, company_name").eq("id", impersonatingAs).single();
  return {
    isImpersonating: true,
    originalAdminId,
    targetUser
  };
}
async function logAdminAction(adminId, action2, options) {
  await supabaseAdmin.from("admin_audit_log").insert({
    admin_id: adminId,
    action: action2,
    target_user_id: (options == null ? void 0 : options.targetUserId) || null,
    target_listing_id: (options == null ? void 0 : options.targetListingId) || null,
    details: (options == null ? void 0 : options.details) || null
  });
}
async function logout(request) {
  const session = await getUserSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await storage.destroySession(session)
    }
  });
}
function CookieBanner({
  onAcceptAll,
  onRejectAll,
  onSavePreferences
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    // Always enabled
    analytics: true,
    // Pre-selected, user can deselect
    marketing: true
    // Pre-selected, user can deselect
  });
  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);
  const saveConsent = (type) => {
    const consentData = {
      type,
      preferences: type === "all" ? { necessary: true, analytics: true, marketing: true } : type === "necessary" ? { necessary: true, analytics: false, marketing: false } : preferences,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      version: "1.0"
    };
    localStorage.setItem("cookie_consent", JSON.stringify(consentData));
    const expires = /* @__PURE__ */ new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `cookie_consent=${type};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    setIsVisible(false);
  };
  const handleAcceptAll = () => {
    saveConsent("all");
    onAcceptAll == null ? void 0 : onAcceptAll();
  };
  const handleRejectAll = () => {
    saveConsent("necessary");
    onRejectAll == null ? void 0 : onRejectAll();
  };
  const handleSavePreferences = () => {
    saveConsent("custom");
    onSavePreferences == null ? void 0 : onSavePreferences(preferences);
  };
  if (!isVisible) return null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-black/50 z-40", "aria-hidden": "true" }),
    /* @__PURE__ */ jsx(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "cookie-banner-title",
        className: "fixed bottom-0 left-0 right-0 z-50 bg-white shadow-2xl border-t border-gray-200",
        children: /* @__PURE__ */ jsx("div", { className: "max-w-6xl mx-auto p-4 sm:p-6", children: !showDetails ? (
          /* Simple View */
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col lg:flex-row lg:items-center gap-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
              /* @__PURE__ */ jsx("h2", { id: "cookie-banner-title", className: "text-lg font-semibold text-gray-900", children: "We use cookies" }),
              /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-gray-600", children: [
                "We use essential cookies to make our site work. With your consent, we may also use analytics cookies to improve your experience. You can accept all cookies or customize your preferences.",
                " ",
                /* @__PURE__ */ jsx("a", { href: "/cookie-policy", className: "text-brand-600 hover:underline", children: "Learn more" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setShowDetails(true),
                  className: "px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors",
                  children: "Customize"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: handleAcceptAll,
                  className: "px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors",
                  children: "Accept All"
                }
              )
            ] })
          ] })
        ) : (
          /* Detailed View */
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
              /* @__PURE__ */ jsx("h2", { id: "cookie-banner-title", className: "text-lg font-semibold text-gray-900", children: "Cookie Preferences" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setShowDetails(false),
                  className: "text-gray-400 hover:text-gray-600",
                  "aria-label": "Close details",
                  children: /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
                }
              )
            ] }),
            /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-600", children: "Select which cookie categories you want to enable. Essential cookies cannot be disabled as they are required for the site to function properly." }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-4 bg-gray-50 rounded-lg", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx("h3", { className: "font-medium text-gray-900", children: "Essential Cookies" }),
                    /* @__PURE__ */ jsx("span", { className: "px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full", children: "Always active" })
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-600 mt-1", children: "Required for basic site functionality, including authentication and session management." })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "ml-4", children: /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: true,
                    disabled: true,
                    className: "w-5 h-5 rounded border-gray-300 text-brand-600 cursor-not-allowed",
                    "aria-label": "Essential cookies (always active)"
                  }
                ) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-4 bg-gray-50 rounded-lg", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                  /* @__PURE__ */ jsx("h3", { className: "font-medium text-gray-900", children: "Analytics Cookies" }),
                  /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-600 mt-1", children: "Help us understand how visitors interact with the site by collecting anonymous and aggregated information." })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "ml-4", children: /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: preferences.analytics,
                    onChange: (e) => setPreferences({ ...preferences, analytics: e.target.checked }),
                    className: "w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer",
                    "aria-label": "Enable analytics cookies"
                  }
                ) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-4 bg-gray-50 rounded-lg", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                  /* @__PURE__ */ jsx("h3", { className: "font-medium text-gray-900", children: "Marketing Cookies" }),
                  /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-600 mt-1", children: "Used to show you relevant ads and measure the effectiveness of advertising campaigns." })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "ml-4", children: /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: preferences.marketing,
                    onChange: (e) => setPreferences({ ...preferences, marketing: e.target.checked }),
                    className: "w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer",
                    "aria-label": "Enable marketing cookies"
                  }
                ) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2", children: [
              /* @__PURE__ */ jsx(
                "a",
                {
                  href: "/cookie-policy",
                  className: "px-4 py-2 text-sm font-medium text-gray-700 hover:text-brand-600 text-center",
                  children: "Read full Cookie Policy"
                }
              ),
              /* @__PURE__ */ jsx("div", { className: "flex-1" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: handleRejectAll,
                  className: "px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors",
                  children: "Only Essential"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: handleSavePreferences,
                  className: "px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors",
                  children: "Save Preferences"
                }
              )
            ] })
          ] })
        ) })
      }
    )
  ] });
}
const UNREAD_POLL_INTERVAL$1 = 5e3;
function MobileNav({ user }) {
  var _a, _b, _c, _d;
  const location = useLocation();
  const fetcher = useFetcher();
  const isPollingRef = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
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
    const intervalId = setInterval(poll, UNREAD_POLL_INTERVAL$1);
    return () => {
      clearInterval(intervalId);
    };
  }, [user, fetcher]);
  const unreadCount = ((_a = fetcher.data) == null ? void 0 : _a.unreadCount) ?? 0;
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);
  if (location.pathname === "/login" || location.pathname === "/register" || location.pathname.startsWith("/join/")) {
    return null;
  }
  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };
  const myListingPath = (user == null ? void 0 : user.user_type) === "tour_operator" ? "/dashboard" : "/my-listings";
  ((_b = user == null ? void 0 : user.full_name) == null ? void 0 : _b.split(" ")[0]) || "Menu";
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    isSidebarOpen && /* @__PURE__ */ jsx(
      "div",
      {
        className: "md:hidden fixed inset-0 bg-black/50 z-50",
        onClick: () => setIsSidebarOpen(false)
      }
    ),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: `md:hidden fixed top-16 right-2 w-56 bg-white rounded-2xl shadow-xl z-50 transform transition-all duration-200 ease-out ${isSidebarOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}`,
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-3 border-b border-gray-100", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-semibold text-sm", children: ((_c = user == null ? void 0 : user.full_name) == null ? void 0 : _c.charAt(0)) || ((_d = user == null ? void 0 : user.email) == null ? void 0 : _d.charAt(0)) || "?" }),
            /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsx("p", { className: "font-semibold text-gray-900 text-sm truncate", children: (user == null ? void 0 : user.full_name) || "User" }),
              /* @__PURE__ */ jsx("p", { className: "text-[10px] text-gray-500", children: (user == null ? void 0 : user.user_type) === "tour_operator" ? "Tour Operator" : "Private" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "py-1", children: [
            (user == null ? void 0 : user.user_type) === "tour_operator" && /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/dashboard",
                onClick: () => setIsSidebarOpen(false),
                className: "flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50",
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" }) }),
                  "Dashboard"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/profile",
                onClick: () => setIsSidebarOpen(false),
                className: "flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50",
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
                  "Profile"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: myListingPath,
                onClick: () => setIsSidebarOpen(false),
                className: "flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50",
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" }) }),
                  (user == null ? void 0 : user.user_type) === "tour_operator" ? "My Listings" : "My Listing"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/saved",
                onClick: () => setIsSidebarOpen(false),
                className: "flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50",
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" }) }),
                  "Saved"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/notifications",
                onClick: () => setIsSidebarOpen(false),
                className: "flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50",
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" }) }),
                  /* @__PURE__ */ jsx("span", { className: "flex-1", children: "Notifications" }),
                  (user == null ? void 0 : user.unreadNotifications) > 0 && /* @__PURE__ */ jsx("span", { className: "flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[9px] font-bold text-white", children: user.unreadNotifications > 9 ? "9+" : user.unreadNotifications })
                ]
              }
            ),
            (user == null ? void 0 : user.is_team_leader) && /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/tl-dashboard",
                onClick: () => setIsSidebarOpen(false),
                className: "flex items-center gap-2.5 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50",
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-purple-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" }) }),
                  "TL Dashboard"
                ]
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "my-1 border-t border-gray-100" }),
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/settings",
                onClick: () => setIsSidebarOpen(false),
                className: "flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50",
                children: [
                  /* @__PURE__ */ jsxs("svg", { className: "h-4 w-4 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: [
                    /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }),
                    /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
                  ] }),
                  "Settings"
                ]
              }
            ),
            /* @__PURE__ */ jsx(Form, { method: "post", action: "/logout", children: /* @__PURE__ */ jsxs(
              "button",
              {
                type: "submit",
                className: "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50",
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-red-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" }) }),
                  "Logout"
                ]
              }
            ) })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx("nav", { className: "md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40 safe-area-top", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-around h-16 px-2", children: [
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: "/",
          className: `flex flex-col items-center justify-center flex-1 py-2 ${isActive("/") && !isActive("/listings") && !isActive("/messages") && !isActive("/profile") && !isActive("/my-listings") && !isActive("/dashboard") ? "text-brand-600" : "text-gray-500"}`,
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: isActive("/") && !isActive("/listings") ? 2.5 : 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] mt-0.5 font-medium", children: "Home" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: "/listings",
          className: `flex flex-col items-center justify-center flex-1 py-2 ${isActive("/listings") && !location.pathname.includes("/new") ? "text-brand-600" : "text-gray-500"}`,
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: isActive("/listings") && !location.pathname.includes("/new") ? 2.5 : 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] mt-0.5 font-medium", children: "Search" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: user ? "/listings/new" : "/login",
          className: `flex flex-col items-center justify-center flex-1 py-2 ${location.pathname === "/listings/new" ? "text-accent-600" : "text-gray-500"}`,
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: location.pathname === "/listings/new" ? 2.5 : 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 4v16m8-8H4" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] mt-0.5 font-medium", children: "New" })
          ]
        }
      ),
      user ? /* @__PURE__ */ jsxs(
        Link,
        {
          to: "/messages",
          className: `flex flex-col items-center justify-center flex-1 py-2 relative ${isActive("/messages") ? "text-brand-600" : "text-gray-500"}`,
          children: [
            /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: isActive("/messages") ? 2.5 : 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" }) }),
              unreadCount > 0 && /* @__PURE__ */ jsx("span", { className: "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white", children: unreadCount > 9 ? "9+" : unreadCount })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] mt-0.5 font-medium", children: "Messages" })
          ]
        }
      ) : /* @__PURE__ */ jsxs(
        Link,
        {
          to: "/login",
          className: "flex flex-col items-center justify-center flex-1 py-2 text-gray-500",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] mt-0.5 font-medium", children: "Messages" })
          ]
        }
      ),
      user ? /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setIsSidebarOpen(true),
          className: `flex flex-col items-center justify-center flex-1 py-2 ${isActive("/profile") || isActive("/settings") || isActive("/saved") || isActive(myListingPath) ? "text-brand-600" : "text-gray-500"}`,
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: isActive("/profile") || isActive("/settings") || isActive("/saved") ? 2.5 : 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] mt-0.5 font-medium", children: "Profile" })
          ]
        }
      ) : /* @__PURE__ */ jsxs(
        Link,
        {
          to: "/login",
          className: "flex flex-col items-center justify-center flex-1 py-2 text-gray-500",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] mt-0.5 font-medium", children: "Login" })
          ]
        }
      )
    ] }) })
  ] });
}
const links = () => [{
  rel: "preconnect",
  href: "https://fonts.googleapis.com"
}, {
  rel: "preconnect",
  href: "https://fonts.gstatic.com",
  crossOrigin: "anonymous"
}, {
  rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@400;500;600;700&display=swap"
}];
async function loader$D({
  request
}) {
  const user = await getUser(request);
  const accessToken = await getAccessToken(request);
  let unreadCount = 0;
  let unreadNotifications = 0;
  if (user) {
    const [convResult, notifResult] = await Promise.all([supabaseAdmin.from("conversations").select(`
          id,
          messages(id, sender_id, read_at)
        `).or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`), supabaseAdmin.from("notifications").select("*", {
      count: "exact",
      head: true
    }).eq("user_id", user.id).is("read_at", null)]);
    if (convResult.data) {
      convResult.data.forEach((conv) => {
        var _a;
        (_a = conv.messages) == null ? void 0 : _a.forEach((msg) => {
          if (msg.sender_id !== user.id && !msg.read_at) {
            unreadCount++;
          }
        });
      });
    }
    unreadNotifications = notifResult.count || 0;
  }
  let impersonation = null;
  try {
    impersonation = await getImpersonationContext(request);
  } catch (e) {
    console.error("Impersonation context error:", e);
  }
  return {
    user: user ? {
      ...user,
      unreadCount,
      unreadNotifications
    } : null,
    impersonation,
    ENV: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      ACCESS_TOKEN: accessToken
    }
  };
}
function Layout({
  children
}) {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    className: "h-full",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      className: "h-full bg-gray-50 font-sans text-gray-900 antialiased",
      children: [children, /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
}
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2() {
  const error = useRouteError();
  return /* @__PURE__ */ jsxs("div", {
    style: {
      padding: "2rem",
      fontFamily: "monospace"
    },
    children: [/* @__PURE__ */ jsx("h1", {
      style: {
        color: "red",
        fontSize: "1.5rem"
      },
      children: "Something went wrong"
    }), isRouteErrorResponse(error) ? /* @__PURE__ */ jsxs("div", {
      children: [/* @__PURE__ */ jsxs("p", {
        children: [/* @__PURE__ */ jsx("strong", {
          children: "Status:"
        }), " ", error.status, " ", error.statusText]
      }), /* @__PURE__ */ jsx("pre", {
        style: {
          background: "#f5f5f5",
          padding: "1rem",
          overflow: "auto"
        },
        children: typeof error.data === "string" ? error.data : JSON.stringify(error.data, null, 2)
      })]
    }) : error instanceof Error ? /* @__PURE__ */ jsxs("div", {
      children: [/* @__PURE__ */ jsxs("p", {
        children: [/* @__PURE__ */ jsx("strong", {
          children: "Error:"
        }), " ", error.message]
      }), /* @__PURE__ */ jsx("pre", {
        style: {
          background: "#f5f5f5",
          padding: "1rem",
          overflow: "auto",
          fontSize: "0.8rem"
        },
        children: error.stack
      })]
    }) : /* @__PURE__ */ jsx("pre", {
      style: {
        background: "#f5f5f5",
        padding: "1rem"
      },
      children: JSON.stringify(error, null, 2)
    })]
  });
});
const root = UNSAFE_withComponentProps(function App() {
  const {
    user,
    impersonation,
    ENV
  } = useLoaderData();
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("script", {
      dangerouslySetInnerHTML: {
        __html: `window.ENV = ${JSON.stringify(ENV)}`
      }
    }), (impersonation == null ? void 0 : impersonation.isImpersonating) && impersonation.targetUser && /* @__PURE__ */ jsxs("div", {
      className: "fixed top-0 left-0 right-0 z-[9999] bg-alert-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-lg",
      children: [/* @__PURE__ */ jsxs("span", {
        className: "flex items-center gap-2",
        children: [/* @__PURE__ */ jsxs("svg", {
          className: "w-4 h-4",
          fill: "none",
          stroke: "currentColor",
          viewBox: "0 0 24 24",
          children: [/* @__PURE__ */ jsx("path", {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 2,
            d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          }), /* @__PURE__ */ jsx("path", {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 2,
            d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          })]
        }), "Viewing as ", /* @__PURE__ */ jsx("strong", {
          children: impersonation.targetUser.full_name || impersonation.targetUser.email
        }), impersonation.targetUser.company_name && /* @__PURE__ */ jsxs("span", {
          className: "opacity-80",
          children: ["(", impersonation.targetUser.company_name, ")"]
        })]
      }), /* @__PURE__ */ jsx(Form, {
        method: "post",
        action: "/admin/impersonate/stop",
        className: "inline",
        children: /* @__PURE__ */ jsx("button", {
          type: "submit",
          className: "ml-2 bg-white text-alert-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-alert-50 transition-colors",
          children: "Exit Impersonation"
        })
      })]
    }), /* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(CookieBanner, {}), /* @__PURE__ */ jsx(MobileNav, {
      user
    })]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  Layout,
  default: root,
  links,
  loader: loader$D
}, Symbol.toStringTag, { value: "Module" }));
const meta$z = ({
  data: data2
}) => {
  var _a, _b;
  return [{
    title: `Contact Seller - ${((_b = (_a = data2 == null ? void 0 : data2.listing) == null ? void 0 : _a.event) == null ? void 0 : _b.name) || "Runoot"}`
  }];
};
async function loader$C({
  request,
  params
}) {
  const user = await requireUser(request);
  const userId = user.id;
  const {
    id
  } = params;
  const {
    data: listing,
    error
  } = await supabase.from("listings").select(`
      *,
      author:profiles(id, full_name, company_name, user_type, is_verified),
      event:events(id, name, slug, country, event_date)
    `).eq("id", id).single();
  if (error || !listing) {
    throw new Response("Listing not found", {
      status: 404
    });
  }
  const listingData = listing;
  if (listingData.author_id === userId) {
    return redirect(`/listings/${id}`);
  }
  const url = new URL(request.url);
  const sent = url.searchParams.get("sent");
  if (!sent) {
    const {
      data: existingConversation
    } = await supabaseAdmin.from("conversations").select("id").eq("listing_id", id).or(`and(participant_1.eq.${userId},participant_2.eq.${listingData.author_id}),and(participant_1.eq.${listingData.author_id},participant_2.eq.${userId})`).single();
    if (existingConversation) {
      return redirect(`/messages/${existingConversation.id}`);
    }
  }
  const {
    data: userProfile
  } = await supabase.from("profiles").select("full_name, company_name").eq("id", userId).single();
  return {
    user,
    listing: listingData,
    userProfile,
    sent: !!sent
  };
}
async function action$u({
  request,
  params
}) {
  const user = await requireUser(request);
  const userId = user.id;
  const {
    id
  } = params;
  const formData = await request.formData();
  const message = formData.get("message");
  if (typeof message !== "string" || !message.trim()) {
    return data({
      error: "Message cannot be empty"
    }, {
      status: 400
    });
  }
  const {
    data: listing
  } = await supabaseAdmin.from("listings").select("author_id").eq("id", id).single();
  if (!listing) {
    return data({
      error: "Listing not found"
    }, {
      status: 404
    });
  }
  if (listing.author_id === userId) {
    return data({
      error: "You cannot message yourself"
    }, {
      status: 400
    });
  }
  const {
    data: existingConversation
  } = await supabaseAdmin.from("conversations").select("id").eq("listing_id", id).or(`and(participant_1.eq.${userId},participant_2.eq.${listing.author_id}),and(participant_1.eq.${listing.author_id},participant_2.eq.${userId})`).single();
  if (existingConversation) {
    await supabaseAdmin.from("messages").insert({
      conversation_id: existingConversation.id,
      sender_id: userId,
      content: message.trim(),
      message_type: "user"
    });
    await supabaseAdmin.from("conversations").update({
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", existingConversation.id);
    return redirect(`/listings/${id}/contact?sent=true`);
  }
  const {
    data: newConversation,
    error: convError
  } = await supabaseAdmin.from("conversations").insert({
    listing_id: id,
    participant_1: userId,
    participant_2: listing.author_id
  }).select().single();
  if (convError || !newConversation) {
    return data({
      error: "Failed to start conversation"
    }, {
      status: 500
    });
  }
  const {
    error: msgError
  } = await supabaseAdmin.from("messages").insert({
    conversation_id: newConversation.id,
    sender_id: userId,
    content: message.trim(),
    message_type: "user"
  });
  if (msgError) {
    return data({
      error: "Failed to send message"
    }, {
      status: 500
    });
  }
  return redirect(`/listings/${id}/contact?sent=true`);
}
const listings_$id__contact = UNSAFE_withComponentProps(function ContactSeller() {
  var _a, _b, _c;
  const {
    listing,
    userProfile,
    sent
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const textareaRef = useRef(null);
  const isSubmitting = navigation.state === "submitting";
  const showSuccess = sent;
  const sellerName = listing.author.company_name || ((_a = listing.author.full_name) == null ? void 0 : _a.split(" ")[0]) || "there";
  const eventName = listing.event.name;
  const defaultMessage = `Hello ${sellerName}, I'm writing to you about the listing for ${eventName}. `;
  const handleTextareaChange = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  };
  useEffect(() => {
    if (textareaRef.current && !showSuccess) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [showSuccess]);
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-screen bg-gray-50",
    children: [showSuccess && /* @__PURE__ */ jsx("div", {
      className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4",
      children: /* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-2xl max-w-sm w-full p-6 text-center",
        children: [/* @__PURE__ */ jsx("div", {
          className: "mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4",
          children: /* @__PURE__ */ jsx("svg", {
            className: "w-8 h-8 text-green-600",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M5 13l4 4L19 7"
            })
          })
        }), /* @__PURE__ */ jsx("h3", {
          className: "text-xl font-semibold text-gray-900 mb-2",
          children: "Message Sent!"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-gray-600 mb-6",
          children: "The seller will be notified and can reply to your message."
        }), /* @__PURE__ */ jsx(Link, {
          to: "/listings",
          className: "btn-primary w-full py-3 text-base font-semibold rounded-full block text-center",
          children: "Back to Listings"
        })]
      })
    }), /* @__PURE__ */ jsx("div", {
      className: "bg-white border-b border-gray-200 sticky top-0 z-10",
      children: /* @__PURE__ */ jsxs("div", {
        className: "max-w-2xl mx-auto px-4 py-4 flex items-center gap-4",
        children: [/* @__PURE__ */ jsx(Link, {
          to: `/listings/${listing.id}`,
          className: "text-gray-400 hover:text-gray-600",
          children: /* @__PURE__ */ jsx("svg", {
            className: "h-6 w-6",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M15 19l-7-7 7-7"
            })
          })
        }), /* @__PURE__ */ jsx("h1", {
          className: "font-display text-lg font-semibold text-gray-900",
          children: "New Message"
        })]
      })
    }), /* @__PURE__ */ jsxs("div", {
      className: "max-w-2xl mx-auto px-4 py-6",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-3",
          children: [/* @__PURE__ */ jsx("div", {
            className: "flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold flex-shrink-0",
            children: ((_b = listing.author.company_name) == null ? void 0 : _b.charAt(0)) || ((_c = listing.author.full_name) == null ? void 0 : _c.charAt(0)) || "?"
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex-1 min-w-0",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-1.5",
              children: [/* @__PURE__ */ jsx("p", {
                className: "font-semibold text-gray-900 truncate",
                children: listing.author.company_name || listing.author.full_name
              }), listing.author.is_verified && /* @__PURE__ */ jsx("svg", {
                className: "h-4 w-4 text-brand-500 flex-shrink-0",
                fill: "currentColor",
                viewBox: "0 0 20 20",
                children: /* @__PURE__ */ jsx("path", {
                  fillRule: "evenodd",
                  d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                  clipRule: "evenodd"
                })
              })]
            }), /* @__PURE__ */ jsx("p", {
              className: "text-sm text-gray-500",
              children: listing.author.user_type === "tour_operator" ? "Tour Operator" : "Private Seller"
            })]
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "mt-3 pt-3 border-t border-gray-100",
          children: /* @__PURE__ */ jsxs("p", {
            className: "text-sm text-gray-500",
            children: ["Regarding: ", /* @__PURE__ */ jsx("span", {
              className: "text-gray-700 font-medium",
              children: listing.event.name
            })]
          })
        })]
      }), /* @__PURE__ */ jsxs(Form, {
        method: "post",
        children: [/* @__PURE__ */ jsx("div", {
          className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden",
          children: /* @__PURE__ */ jsx("textarea", {
            ref: textareaRef,
            name: "message",
            defaultValue: defaultMessage,
            placeholder: "Write your message...",
            required: true,
            rows: 4,
            className: "w-full px-4 py-4 text-gray-900 placeholder-gray-400 resize-none focus:outline-none min-h-[120px]",
            disabled: isSubmitting || showSuccess,
            onChange: handleTextareaChange
          })
        }), actionData && "error" in actionData && actionData.error && /* @__PURE__ */ jsx("div", {
          className: "mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700",
          children: actionData.error
        }), /* @__PURE__ */ jsx("div", {
          className: "mt-4",
          children: /* @__PURE__ */ jsx("button", {
            type: "submit",
            disabled: isSubmitting || showSuccess,
            className: "btn-primary w-full py-3.5 text-base font-semibold rounded-full shadow-lg shadow-brand-500/25 disabled:opacity-50",
            children: isSubmitting ? /* @__PURE__ */ jsxs("span", {
              className: "flex items-center justify-center gap-2",
              children: [/* @__PURE__ */ jsxs("svg", {
                className: "animate-spin h-5 w-5",
                fill: "none",
                viewBox: "0 0 24 24",
                children: [/* @__PURE__ */ jsx("circle", {
                  className: "opacity-25",
                  cx: "12",
                  cy: "12",
                  r: "10",
                  stroke: "currentColor",
                  strokeWidth: "4"
                }), /* @__PURE__ */ jsx("path", {
                  className: "opacity-75",
                  fill: "currentColor",
                  d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                })]
              }), "Sending..."]
            }) : "Send Message"
          })
        })]
      }), /* @__PURE__ */ jsx("p", {
        className: "mt-4 text-center text-xs text-gray-500",
        children: "Be clear about what you're looking for. Include any questions about availability or details."
      })]
    })]
  });
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$u,
  default: listings_$id__contact,
  loader: loader$C,
  meta: meta$z
}, Symbol.toStringTag, { value: "Module" }));
const UNREAD_POLL_INTERVAL = 5e3;
function Header({ user }) {
  var _a;
  const fetcher = useFetcher();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isPollingRef = useRef(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isMenuOpen]);
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
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
  const unreadCount = ((_a = fetcher.data) == null ? void 0 : _a.unreadCount) ?? (user == null ? void 0 : user.unreadCount) ?? 0;
  const unreadNotifications = (user == null ? void 0 : user.unreadNotifications) ?? 0;
  const hasAnyUnread = unreadCount > 0 || unreadNotifications > 0;
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx("header", { className: "hidden md:block sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-7xl px-4 md:px-0", children: /* @__PURE__ */ jsxs("div", { className: "hidden md:flex h-20 items-center justify-between", children: [
    /* @__PURE__ */ jsx(Link, { to: "/", className: "flex items-center mt-2", children: /* @__PURE__ */ jsx(
      "img",
      {
        src: "/logo.svg",
        alt: "Runoot",
        className: "h-32 w-auto"
      }
    ) }),
    /* @__PURE__ */ jsxs("nav", { className: "flex items-center gap-10 flex-1 justify-center", children: [
      /* @__PURE__ */ jsx(
        Link,
        {
          to: "/listings",
          className: "text-base font-bold text-gray-700 hover:text-accent-500 hover:underline transition-colors",
          children: "Listings"
        }
      ),
      /* @__PURE__ */ jsx(
        Link,
        {
          to: "/contact",
          className: "text-base font-bold text-gray-700 hover:text-accent-500 hover:underline transition-colors",
          children: "Contact"
        }
      )
    ] }),
    user ? /* @__PURE__ */ jsx("nav", { className: "flex items-center", children: /* @__PURE__ */ jsxs("div", { className: "hidden md:flex items-center gap-6", children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          ref: menuRef,
          className: "relative",
          onMouseEnter: () => setIsMenuOpen(true),
          onMouseLeave: () => setIsMenuOpen(false),
          children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setIsMenuOpen(!isMenuOpen),
                className: "flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-full bg-white hover:bg-gray-50 text-gray-900 transition-colors",
                children: [
                  hasAnyUnread && /* @__PURE__ */ jsx("span", { className: "h-2.5 w-2.5 rounded-full bg-red-500" }),
                  /* @__PURE__ */ jsx("span", { className: "text-sm font-bold max-w-[150px] truncate", children: user.full_name || user.email }),
                  /* @__PURE__ */ jsx(
                    "svg",
                    {
                      className: `h-4 w-4 text-gray-500 transition-transform flex-shrink-0 ${isMenuOpen ? "rotate-180" : ""}`,
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
                    }
                  )
                ]
              }
            ),
            isMenuOpen && /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("div", { className: "absolute right-0 top-full w-48 sm:w-56 rounded-2xl bg-white shadow-lg border border-gray-200 py-2 z-20", children: [
              user.user_type === "tour_operator" && /* @__PURE__ */ jsxs(
                Link,
                {
                  to: "/dashboard",
                  className: "flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" }) }),
                    "Dashboard"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                Link,
                {
                  to: "/profile",
                  className: "flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }),
                    "Profile"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                Link,
                {
                  to: user.user_type === "tour_operator" ? "/dashboard" : "/my-listings",
                  className: "flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" }) }),
                    user.user_type === "tour_operator" ? "My Listings" : "My Listing"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                Link,
                {
                  to: "/messages",
                  className: "flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" }) }),
                    /* @__PURE__ */ jsx("span", { className: "flex-1", children: "Messages" }),
                    unreadCount > 0 && /* @__PURE__ */ jsx("span", { className: "flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white", children: unreadCount > 9 ? "9+" : unreadCount })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                Link,
                {
                  to: "/saved",
                  className: "flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" }) }),
                    "Saved"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                Link,
                {
                  to: "/notifications",
                  className: "flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" }) }),
                    /* @__PURE__ */ jsx("span", { className: "flex-1", children: "Notifications" }),
                    unreadNotifications > 0 && /* @__PURE__ */ jsx("span", { className: "flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white", children: unreadNotifications > 9 ? "9+" : unreadNotifications })
                  ]
                }
              ),
              user.is_team_leader && /* @__PURE__ */ jsxs(
                Link,
                {
                  to: "/tl-dashboard",
                  className: "flex items-center gap-3 px-4 py-2.5 text-sm text-purple-700 hover:bg-purple-50",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-purple-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" }) }),
                    "TL Dashboard"
                  ]
                }
              ),
              /* @__PURE__ */ jsx("div", { className: "my-2 border-t border-gray-100" }),
              /* @__PURE__ */ jsxs(
                Link,
                {
                  to: "/settings",
                  className: "flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50",
                  children: [
                    /* @__PURE__ */ jsxs("svg", { className: "h-5 w-5 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: [
                      /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }),
                      /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })
                    ] }),
                    "Settings"
                  ]
                }
              ),
              /* @__PURE__ */ jsx(Form, { method: "post", action: "/logout", children: /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "submit",
                  className: "flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50",
                  children: [
                    /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-red-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" }) }),
                    "Logout"
                  ]
                }
              ) })
            ] }) })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: "/listings/new",
          className: "btn-primary flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-accent-500/30 mr-6",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }),
            /* @__PURE__ */ jsx("span", { children: "New Listing" })
          ]
        }
      )
    ] }) }) : /* @__PURE__ */ jsxs("nav", { className: "flex items-center gap-4", children: [
      /* @__PURE__ */ jsx(Link, { to: "/login", className: "btn-secondary rounded-full", children: "Login" }),
      /* @__PURE__ */ jsx(Link, { to: "/register", className: "btn-primary rounded-full shadow-lg shadow-accent-500/30", children: "Sign up" })
    ] })
  ] }) }) }) });
}
function EventPicker({ events, onSelectEvent, defaultEventId, hasError }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(() => {
    if (defaultEventId) {
      return events.find((e) => e.id === defaultEventId) || null;
    }
    return null;
  });
  const filteredEvents = events.filter(
    (event) => event.name.toLowerCase().includes(searchQuery.toLowerCase()) || event.country.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setIsOpen(false);
    onSelectEvent(event.id);
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "eventId", value: (selectedEvent == null ? void 0 : selectedEvent.id) || "" }),
    !selectedEvent ? /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => setIsOpen(true),
        className: `input text-left text-gray-500 hover:border-brand-500 ${hasError ? "border-red-500 ring-1 ring-red-500" : ""}`,
        children: "Choose your event..."
      }
    ) : /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-lg border border-green-500 bg-green-50 p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-green-600", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("p", { className: "text-sm font-medium text-gray-900", children: [
            "Event: ",
            selectedEvent.name
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-600", children: [
            selectedEvent.country,
            " • ",
            new Date(selectedEvent.event_date).getFullYear()
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => setIsOpen(true),
          className: "text-sm text-brand-600 hover:text-brand-700 font-medium",
          children: "Change"
        }
      )
    ] }),
    isOpen && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 overflow-y-auto", children: /* @__PURE__ */ jsxs("div", { className: "flex min-h-screen items-center justify-center p-4", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "fixed inset-0 bg-black bg-opacity-30 transition-opacity",
          onClick: () => setIsOpen(false)
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "relative w-full max-w-2xl rounded-lg bg-white shadow-xl", children: [
        /* @__PURE__ */ jsxs("div", { className: "border-b border-gray-200 px-6 py-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold text-gray-900", children: "Choose your event" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setIsOpen(false),
                className: "text-gray-400 hover:text-gray-600",
                children: /* @__PURE__ */ jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              placeholder: "Search by event name or country...",
              value: searchQuery,
              onChange: (e) => setSearchQuery(e.target.value),
              className: "input",
              autoFocus: true
            }
          ) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "max-h-96 overflow-y-auto px-6 py-4", children: filteredEvents.length > 0 ? /* @__PURE__ */ jsx("div", { className: "space-y-2", children: filteredEvents.map((event) => /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => handleSelectEvent(event),
            className: "w-full rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50",
            children: [
              /* @__PURE__ */ jsx("p", { className: "font-medium text-gray-900", children: event.name }),
              /* @__PURE__ */ jsxs("p", { className: "text-sm text-gray-600", children: [
                event.country,
                " • ",
                new Date(event.event_date).getFullYear()
              ] })
            ]
          },
          event.id
        )) }) : (
          /* Empty State */
          /* @__PURE__ */ jsxs("div", { className: "py-12 text-center", children: [
            /* @__PURE__ */ jsx(
              "svg",
              {
                className: "mx-auto h-12 w-12 text-gray-400",
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ jsx(
                  "path",
                  {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm font-medium text-gray-900", children: "Can't find your event?" }),
            /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-gray-600", children: "Contact us and we'll add it for you" }),
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: "/contact",
                className: "mt-4 inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent-500/30 hover:bg-accent-600 transition-colors",
                children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" }) }),
                  "Contact Us"
                ]
              }
            )
          ] })
        ) })
      ] })
    ] }) })
  ] });
}
function HotelAutocomplete({ onSelectHotel, apiKey, eventCity, eventCountry, defaultHotelName, hasError }) {
  const [selectedHotel, setSelectedHotel] = useState(() => {
    if (defaultHotelName) {
      return {
        placeId: "",
        name: defaultHotelName,
        city: "",
        country: "",
        formattedAddress: ""
      };
    }
    return null;
  });
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const sessionTokenRef = useRef(generateSessionToken());
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const fetchSuggestions = useCallback(async (query) => {
    if (!apiKey || !query.trim()) {
      setSuggestions([]);
      return;
    }
    setIsLoading(true);
    try {
      const requestBody = {
        input: query,
        includedPrimaryTypes: ["lodging"],
        sessionToken: sessionTokenRef.current
      };
      if (eventCity && eventCountry) {
        requestBody.includedRegionCodes = [getCountryCode(eventCountry)].filter(Boolean);
      } else if (eventCountry) {
        requestBody.includedRegionCodes = [getCountryCode(eventCountry)].filter(Boolean);
      }
      const response = await fetch(
        `https://places.googleapis.com/v1/places:autocomplete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey
          },
          body: JSON.stringify(requestBody)
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }
      const data2 = await response.json();
      if (data2.suggestions) {
        const mappedSuggestions = data2.suggestions.filter((s) => s.placePrediction).map((s) => {
          var _a, _b, _c, _d, _e, _f;
          return {
            placeId: s.placePrediction.placeId,
            mainText: ((_b = (_a = s.placePrediction.structuredFormat) == null ? void 0 : _a.mainText) == null ? void 0 : _b.text) || ((_c = s.placePrediction.text) == null ? void 0 : _c.text) || "",
            secondaryText: ((_e = (_d = s.placePrediction.structuredFormat) == null ? void 0 : _d.secondaryText) == null ? void 0 : _e.text) || "",
            fullText: ((_f = s.placePrediction.text) == null ? void 0 : _f.text) || ""
          };
        });
        const sortedSuggestions = [...mappedSuggestions].sort((a, b) => {
          if (eventCity) {
            const aInCity = a.secondaryText.toLowerCase().includes(eventCity.toLowerCase());
            const bInCity = b.secondaryText.toLowerCase().includes(eventCity.toLowerCase());
            if (aInCity && !bInCity) return -1;
            if (!aInCity && bInCity) return 1;
          }
          return 0;
        });
        setSuggestions(sortedSuggestions);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, eventCity, eventCountry]);
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setIsOpen(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };
  const handleSelectSuggestion = async (suggestion) => {
    var _a, _b, _c, _d;
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${suggestion.placeId}?fields=id,displayName,formattedAddress,addressComponents,location,rating,websiteUri&sessionToken=${sessionTokenRef.current}`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey
          }
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch place details");
      }
      const place = await response.json();
      let city = "";
      let country = "";
      (_a = place.addressComponents) == null ? void 0 : _a.forEach((component) => {
        var _a2, _b2;
        if ((_a2 = component.types) == null ? void 0 : _a2.includes("locality")) {
          city = component.longText || "";
        }
        if ((_b2 = component.types) == null ? void 0 : _b2.includes("country")) {
          country = component.longText || "";
        }
      });
      const hotel = {
        placeId: place.id || suggestion.placeId,
        name: ((_b = place.displayName) == null ? void 0 : _b.text) || suggestion.mainText,
        city,
        country,
        formattedAddress: place.formattedAddress || "",
        lat: (_c = place.location) == null ? void 0 : _c.latitude,
        lng: (_d = place.location) == null ? void 0 : _d.longitude,
        rating: place.rating,
        website: place.websiteUri
      };
      setSelectedHotel(hotel);
      onSelectHotel(hotel);
      setInputValue("");
      setSuggestions([]);
      setIsOpen(false);
      sessionTokenRef.current = generateSessionToken();
    } catch (error) {
      console.error("Error fetching place details:", error);
      const hotel = {
        placeId: suggestion.placeId,
        name: suggestion.mainText,
        city: "",
        country: "",
        formattedAddress: suggestion.fullText
      };
      setSelectedHotel(hotel);
      onSelectHotel(hotel);
      setInputValue("");
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };
  const handleChange = () => {
    setSelectedHotel(null);
    onSelectHotel(null);
    setInputValue("");
    setSuggestions([]);
  };
  const isInEventCity = (suggestion) => {
    if (!eventCity) return false;
    return suggestion.secondaryText.toLowerCase().includes(eventCity.toLowerCase());
  };
  return /* @__PURE__ */ jsx("div", { children: !selectedHotel ? /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelPlaceId", value: "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelName", value: "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelCity", value: "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelCountry", value: "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelLat", value: "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelLng", value: "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelRating", value: "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelWebsite", value: "" }),
    /* @__PURE__ */ jsxs("div", { ref: dropdownRef, className: "relative", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsx(
          "svg",
          {
            className: "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" })
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            ref: inputRef,
            type: "text",
            value: inputValue,
            onChange: handleInputChange,
            onFocus: () => inputValue && setIsOpen(true),
            placeholder: eventCity ? `Search hotels in ${eventCity}...` : "Search hotel name or city...",
            className: `w-full pl-10 pr-4 py-3 border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors ${hasError ? "border-red-500 ring-1 ring-red-500" : "border-gray-300"}`,
            autoComplete: "off"
          }
        ),
        isLoading && /* @__PURE__ */ jsx("div", { className: "absolute right-3 top-1/2 -translate-y-1/2", children: /* @__PURE__ */ jsxs("svg", { className: "animate-spin h-5 w-5 text-gray-400", fill: "none", viewBox: "0 0 24 24", children: [
          /* @__PURE__ */ jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
          /* @__PURE__ */ jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })
        ] }) })
      ] }),
      isOpen && suggestions.length > 0 && /* @__PURE__ */ jsxs("div", { className: "absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-[60vh] md:max-h-80 overflow-y-auto", children: [
        eventCity && suggestions.some((s) => isInEventCity(s)) && /* @__PURE__ */ jsx("div", { className: "px-3 py-2 bg-brand-50 border-b border-brand-100", children: /* @__PURE__ */ jsxs("p", { className: "text-xs font-medium text-brand-700", children: [
          "Hotels in ",
          eventCity
        ] }) }),
        suggestions.map((suggestion, index) => {
          const inCity = isInEventCity(suggestion);
          const showSeparator = eventCity && index > 0 && isInEventCity(suggestions[index - 1]) && !inCity;
          return /* @__PURE__ */ jsxs("div", { children: [
            showSeparator && /* @__PURE__ */ jsx("div", { className: "px-3 py-2 bg-gray-50 border-t border-b border-gray-100", children: /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-gray-500", children: "Other locations" }) }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => handleSelectSuggestion(suggestion),
                className: `w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${inCity ? "bg-brand-50/50" : ""}`,
                children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
                  /* @__PURE__ */ jsx(
                    "svg",
                    {
                      className: `h-5 w-5 mt-0.5 flex-shrink-0 ${inCity ? "text-brand-500" : "text-gray-400"}`,
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" })
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                    /* @__PURE__ */ jsx("p", { className: `font-medium truncate ${inCity ? "text-brand-900" : "text-gray-900"}`, children: suggestion.mainText }),
                    /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 truncate", children: suggestion.secondaryText })
                  ] }),
                  inCity && /* @__PURE__ */ jsx("span", { className: "flex-shrink-0 px-2 py-0.5 bg-brand-100 text-brand-700 text-xs font-medium rounded-full", children: "Event city" })
                ] })
              }
            )
          ] }, suggestion.placeId);
        })
      ] }),
      isOpen && inputValue && suggestions.length === 0 && !isLoading && /* @__PURE__ */ jsx("div", { className: "absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-4", children: /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 text-center", children: "No hotels found. Try a different search or add manually." }) })
    ] }),
    /* @__PURE__ */ jsxs(
      "a",
      {
        href: "/contact",
        className: "inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors",
        children: [
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }),
          "Can't find your hotel? Contact us"
        ]
      }
    )
  ] }) : /* @__PURE__ */ jsxs("div", { className: "flex items-start sm:items-center justify-between gap-3 rounded-xl border border-green-500 bg-green-50 p-4", children: [
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelPlaceId", value: (selectedHotel == null ? void 0 : selectedHotel.placeId) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelName", value: (selectedHotel == null ? void 0 : selectedHotel.name) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelCity", value: (selectedHotel == null ? void 0 : selectedHotel.city) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelCountry", value: (selectedHotel == null ? void 0 : selectedHotel.country) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelLat", value: (selectedHotel == null ? void 0 : selectedHotel.lat) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelLng", value: (selectedHotel == null ? void 0 : selectedHotel.lng) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelRating", value: (selectedHotel == null ? void 0 : selectedHotel.rating) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelWebsite", value: (selectedHotel == null ? void 0 : selectedHotel.website) || "" }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 min-w-0", children: [
      /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-green-600 flex-shrink-0 mt-0.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-gray-900 break-words", children: selectedHotel.name }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-600 mt-0.5", children: [
          selectedHotel.city,
          selectedHotel.country ? `, ${selectedHotel.country}` : "",
          selectedHotel.rating && ` • ⭐ ${selectedHotel.rating}`
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: handleChange,
        className: "text-sm text-brand-600 hover:text-brand-700 font-medium flex-shrink-0",
        children: "Change"
      }
    )
  ] }) });
}
function generateSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
function getCountryCode(countryName) {
  const countryMap = {
    "Italy": "it",
    "Germany": "de",
    "USA": "us",
    "United States": "us",
    "UK": "gb",
    "United Kingdom": "gb",
    "France": "fr",
    "Spain": "es",
    "Japan": "jp",
    "Netherlands": "nl",
    "Greece": "gr",
    "Portugal": "pt",
    "Austria": "at",
    "Switzerland": "ch",
    "Belgium": "be",
    "Poland": "pl",
    "Czech Republic": "cz",
    "Sweden": "se",
    "Norway": "no",
    "Denmark": "dk",
    "Finland": "fi",
    "Ireland": "ie",
    "Australia": "au",
    "Canada": "ca",
    "Brazil": "br",
    "Argentina": "ar",
    "Mexico": "mx",
    "South Africa": "za",
    "Kenya": "ke",
    "Morocco": "ma",
    "Egypt": "eg",
    "China": "cn",
    "South Korea": "kr",
    "Singapore": "sg",
    "Thailand": "th",
    "Malaysia": "my",
    "Indonesia": "id",
    "Vietnam": "vn",
    "India": "in",
    "United Arab Emirates": "ae",
    "Israel": "il",
    "Turkey": "tr",
    "Russia": "ru",
    "New Zealand": "nz"
  };
  return countryMap[countryName] || "";
}
function DatePicker({
  name,
  id,
  placeholder = "dd/mm/yyyy",
  minDate,
  maxDate,
  defaultValue,
  onChange
}) {
  const [selectedDate, setSelectedDate] = useState(() => {
    if (defaultValue) {
      return new Date(defaultValue);
    }
    return null;
  });
  const [ReactDatePicker, setReactDatePicker] = useState(null);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
    import("react-datepicker").then((mod) => {
      setReactDatePicker(() => mod.default);
    });
    Promise.resolve({                            });
  }, []);
  const handleChange = (date) => {
    setSelectedDate(date);
    onChange == null ? void 0 : onChange(date);
  };
  const formattedDate = selectedDate ? selectedDate.toISOString().split("T")[0] : "";
  const displayValue = selectedDate ? `${String(selectedDate.getDate()).padStart(2, "0")}/${String(selectedDate.getMonth() + 1).padStart(2, "0")}/${selectedDate.getFullYear()}` : "";
  const CustomInput = forwardRef(({ onClick, placeholder: inputPlaceholder }, ref) => {
    return /* @__PURE__ */ jsxs("div", { className: "relative w-40", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          className: "input w-full pr-10 cursor-pointer",
          value: displayValue,
          onClick,
          readOnly: true,
          placeholder: inputPlaceholder,
          ref
        }
      ),
      /* @__PURE__ */ jsx(
        "svg",
        {
          className: "absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none",
          fill: "none",
          viewBox: "0 0 24 24",
          stroke: "currentColor",
          children: /* @__PURE__ */ jsx(
            "path",
            {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            }
          )
        }
      )
    ] });
  });
  CustomInput.displayName = "CustomInput";
  if (!isClient || !ReactDatePicker) {
    return /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsx("input", { type: "hidden", name, value: formattedDate }),
      /* @__PURE__ */ jsxs("div", { className: "relative w-40", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            className: "input w-full pr-10 cursor-pointer",
            value: displayValue,
            readOnly: true,
            placeholder
          }
        ),
        /* @__PURE__ */ jsx(
          "svg",
          {
            className: "absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx(
              "path",
              {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              }
            )
          }
        )
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "relative", children: [
    /* @__PURE__ */ jsx("input", { type: "hidden", name, value: formattedDate }),
    /* @__PURE__ */ jsx(
      ReactDatePicker,
      {
        id,
        selected: selectedDate,
        onChange: handleChange,
        minDate,
        maxDate,
        dateFormat: "dd/MM/yyyy",
        placeholderText: placeholder,
        customInput: /* @__PURE__ */ jsx(CustomInput, {}),
        calendarClassName: "custom-datepicker",
        popperClassName: "datepicker-popper",
        showPopperArrow: false,
        closeOnScroll: true
      }
    )
  ] });
}
const ROOM_TYPES = [
  { value: "single", label: "Single" },
  { value: "double", label: "Double" },
  { value: "twin", label: "Twin" },
  { value: "twin_shared", label: "Twin Shared" },
  { value: "double_single_use", label: "Double Single Use" },
  { value: "triple", label: "Triple" },
  { value: "quadruple", label: "Quadruple" },
  { value: "other", label: "Other * (specify)" }
];
function RoomTypeDropdown({ value, onChange, hasError }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const selectedOption = ROOM_TYPES.find((opt) => opt.value === value);
  return /* @__PURE__ */ jsxs("div", { ref: dropdownRef, className: "relative", children: [
    /* @__PURE__ */ jsx("label", { className: "label mb-3", children: "Room type" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "roomType", value }),
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => setIsOpen(!isOpen),
        className: `input w-fit min-w-[180px] text-left flex items-center justify-between gap-3 ${hasError ? "ring-1 ring-red-500" : ""} ${!value ? "text-gray-400" : "text-gray-900"}`,
        children: [
          /* @__PURE__ */ jsx("span", { children: (selectedOption == null ? void 0 : selectedOption.label) || "Select type" }),
          /* @__PURE__ */ jsx(
            "svg",
            {
              className: `h-5 w-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`,
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
            }
          )
        ]
      }
    ),
    isOpen && /* @__PURE__ */ jsx("div", { className: "absolute z-50 mt-1 w-fit min-w-[180px] rounded-lg bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-gray-100 py-1 max-h-60 overflow-auto", children: ROOM_TYPES.map((option) => /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => {
          onChange(option.value);
          setIsOpen(false);
        },
        className: `w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${value === option.value ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700"}`,
        children: option.label
      },
      option.value
    )) })
  ] });
}
const CURRENCIES = [
  { value: "EUR", symbol: "€", label: "Euro" },
  { value: "USD", symbol: "$", label: "US Dollar" },
  { value: "GBP", symbol: "£", label: "British Pound" },
  { value: "JPY", symbol: "¥", label: "Japanese Yen" }
];
function CurrencyPicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const selectedCurrency = CURRENCIES.find((c) => c.value === value) || CURRENCIES[0];
  return /* @__PURE__ */ jsxs("div", { ref: dropdownRef, className: "relative", children: [
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "currency", value }),
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => setIsOpen(!isOpen),
        className: "input w-fit flex items-center gap-2 text-gray-900",
        children: [
          /* @__PURE__ */ jsx("span", { className: "font-medium", children: selectedCurrency.symbol }),
          /* @__PURE__ */ jsx("span", { children: selectedCurrency.value }),
          /* @__PURE__ */ jsx(
            "svg",
            {
              className: `h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`,
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
            }
          )
        ]
      }
    ),
    isOpen && /* @__PURE__ */ jsx("div", { className: "absolute right-0 z-50 mt-1 w-full rounded-lg bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-gray-100 py-1", children: CURRENCIES.map((currency) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => {
          onChange(currency.value);
          setIsOpen(false);
        },
        className: `w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 ${value === currency.value ? "text-gray-900 font-medium" : "text-gray-700"}`,
        children: [
          /* @__PURE__ */ jsx("span", { className: "w-4 font-medium", children: currency.symbol }),
          /* @__PURE__ */ jsx("span", { children: currency.value })
        ]
      },
      currency.value
    )) })
  ] });
}
const LISTING_RULES = {
  private: {
    maxRooms: 1,
    maxBibs: 1,
    allowedTransferMethods: ["official_process"],
    description: "Exchange platform for individual runners"
  },
  tour_operator: {
    maxRooms: null,
    // unlimited
    maxBibs: null,
    // unlimited
    allowedTransferMethods: ["official_process", "package"],
    description: "Business platform for tour operators"
  }
};
function canUseTransferMethod(userType, method) {
  return LISTING_RULES[userType].allowedTransferMethods.includes(method);
}
function getMaxLimit(userType, resourceType) {
  return resourceType === "rooms" ? LISTING_RULES[userType].maxRooms : LISTING_RULES[userType].maxBibs;
}
function getTransferMethodOptions(userType) {
  const methods = LISTING_RULES[userType].allowedTransferMethods;
  const labels = {
    official_process: "Official organizer name change",
    package: "Included in travel package",
    contact: "Contact for details"
  };
  return methods.map((method) => ({
    value: method,
    label: labels[method]
  }));
}
function getVisibleFieldsForTransferMethod(userType, transferMethod, listingType) {
  if (!transferMethod) {
    return {
      showAssociatedCosts: false,
      showCostNotes: false,
      showPackageInfo: false
    };
  }
  if (transferMethod === "official_process") {
    const shouldShow = listingType === "bib" && userType === "private";
    return {
      showAssociatedCosts: shouldShow,
      showCostNotes: false,
      // Rimosso per privati
      showPackageInfo: false
    };
  }
  if (transferMethod === "package") {
    return {
      showAssociatedCosts: false,
      showCostNotes: false,
      showPackageInfo: true
    };
  }
  return {
    showAssociatedCosts: false,
    showCostNotes: false,
    showPackageInfo: false
  };
}
function validateListingLimits(userType, roomCount, bibCount, transferMethod) {
  const rules = LISTING_RULES[userType];
  if (roomCount && rules.maxRooms !== null && roomCount > rules.maxRooms) {
    return {
      valid: false,
      error: `${userType === "private" ? "Private users" : "Your account type"} can list maximum ${rules.maxRooms} room${rules.maxRooms > 1 ? "s" : ""}`
    };
  }
  if (bibCount && rules.maxBibs !== null && bibCount > rules.maxBibs) {
    return {
      valid: false,
      error: `${userType === "private" ? "Private users" : "Your account type"} can exchange maximum ${rules.maxBibs} bib${rules.maxBibs > 1 ? "s" : ""}`
    };
  }
  if (transferMethod && !canUseTransferMethod(userType, transferMethod)) {
    return {
      valid: false,
      error: `Transfer method "${transferMethod}" is not available for your account type`
    };
  }
  return { valid: true };
}
const meta$y = () => {
  return [{
    title: "Edit Listing - Runoot"
  }];
};
async function loader$B({
  request,
  params
}) {
  const user = await requireUser(request);
  const {
    id
  } = params;
  const {
    data: listing,
    error
  } = await supabase.from("listings").select(`
      *,
      event:events(id, name, country, event_date)
    `).eq("id", id).single();
  if (error || !listing) {
    throw new Response("Listing not found", {
      status: 404
    });
  }
  if (listing.author_id !== user.id) {
    throw new Response("Unauthorized", {
      status: 403
    });
  }
  const {
    data: events
  } = await supabase.from("events").select("*").order("event_date", {
    ascending: true
  });
  return {
    user,
    listing,
    events: events || [],
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || ""
  };
}
async function action$t({
  request,
  params
}) {
  const user = await requireUser(request);
  const {
    id
  } = params;
  const {
    data: existingListing
  } = await supabase.from("listings").select("author_id").eq("id", id).single();
  if (!existingListing || existingListing.author_id !== user.id) {
    return data({
      error: "Unauthorized"
    }, {
      status: 403
    });
  }
  const formData = await request.formData();
  const listingType = formData.get("listingType");
  const description = formData.get("description");
  const eventId = formData.get("eventId");
  const newEventName = formData.get("newEventName");
  const newEventCountry = formData.get("newEventCountry");
  const newEventDate = formData.get("newEventDate");
  const hotelPlaceId = formData.get("hotelPlaceId");
  const hotelName = formData.get("hotelName");
  const hotelWebsite = formData.get("hotelWebsite");
  const hotelCity = formData.get("hotelCity");
  const hotelCountry = formData.get("hotelCountry");
  const hotelLat = formData.get("hotelLat");
  const hotelLng = formData.get("hotelLng");
  const hotelRating = formData.get("hotelRating");
  const roomCount = formData.get("roomCount");
  const roomType = formData.get("roomType");
  const checkIn = formData.get("checkIn");
  const checkOut = formData.get("checkOut");
  const bibCount = formData.get("bibCount");
  const transferType = formData.get("transferType");
  const associatedCosts = formData.get("associatedCosts");
  const costNotes = formData.get("costNotes");
  const price = formData.get("price");
  const priceNegotiable = formData.get("priceNegotiable") === "true";
  if (!listingType) {
    return data({
      error: "Please select a listing type"
    }, {
      status: 400
    });
  }
  const validation = validateListingLimits(user.user_type, roomCount ? parseInt(roomCount) : null, bibCount ? parseInt(bibCount) : null, transferType);
  if (!validation.valid) {
    return data({
      error: validation.error
    }, {
      status: 400
    });
  }
  let finalEventId = eventId;
  if (!eventId && newEventName && newEventDate) {
    const {
      data: newEvent,
      error: eventError
    } = await supabase.from("events").insert({
      name: newEventName,
      country: newEventCountry || "",
      event_date: newEventDate,
      created_by: user.id
    }).select().single();
    if (eventError) {
      return data({
        error: "Failed to create event"
      }, {
        status: 400
      });
    }
    finalEventId = newEvent.id;
  }
  if (!finalEventId) {
    return data({
      error: "Please select or create an event"
    }, {
      status: 400
    });
  }
  const {
    data: eventData
  } = await supabase.from("events").select("name, event_date").eq("id", finalEventId).single();
  if ((listingType === "room" || listingType === "room_and_bib") && checkIn && checkOut) {
    const eventDate = new Date(eventData.event_date);
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const minDate = new Date(eventDate);
    minDate.setDate(minDate.getDate() - 10);
    const maxDate = new Date(eventDate);
    maxDate.setDate(maxDate.getDate() + 10);
    if (checkInDate < minDate || checkInDate > maxDate) {
      return data({
        error: "Check-in date must be within 10 days before or after the event date"
      }, {
        status: 400
      });
    }
    if (checkOutDate < minDate || checkOutDate > maxDate) {
      return data({
        error: "Check-out date must be within 10 days before or after the event date"
      }, {
        status: 400
      });
    }
    if (checkOutDate <= checkInDate) {
      return data({
        error: "Check-out date must be after check-in date"
      }, {
        status: 400
      });
    }
  }
  const listingTypeText = listingType === "room" ? "Rooms" : listingType === "bib" ? "Bibs" : "Rooms + Bibs";
  const autoTitle = `${listingTypeText} for ${(eventData == null ? void 0 : eventData.name) || "Marathon"}`;
  let finalHotelId = null;
  if (listingType === "room" || listingType === "room_and_bib") {
    if (hotelPlaceId) {
      const {
        data: existingHotel
      } = await supabaseAdmin.from("hotels").select("id").eq("place_id", hotelPlaceId).maybeSingle();
      if (existingHotel) {
        finalHotelId = existingHotel.id;
      } else {
        const {
          data: newHotel,
          error: hotelError
        } = await supabaseAdmin.from("hotels").insert({
          place_id: hotelPlaceId,
          name: hotelName,
          city: hotelCity,
          country: hotelCountry,
          website: hotelWebsite,
          lat: hotelLat ? parseFloat(hotelLat) : null,
          lng: hotelLng ? parseFloat(hotelLng) : null,
          rating: hotelRating ? parseFloat(hotelRating) : null
        }).select().single();
        if (hotelError || !newHotel) {
          console.error("Hotel creation error:", hotelError);
          return data({
            error: "Failed to create hotel"
          }, {
            status: 400
          });
        }
        finalHotelId = newHotel.id;
      }
    }
  }
  const {
    error
  } = await supabaseAdmin.from("listings").update({
    event_id: finalEventId,
    listing_type: listingType,
    title: autoTitle,
    description: description || null,
    // Hotel fields
    hotel_name: hotelName || null,
    hotel_website: hotelWebsite || null,
    hotel_place_id: hotelPlaceId || null,
    hotel_id: finalHotelId,
    hotel_stars: null,
    hotel_lat: hotelLat ? parseFloat(hotelLat) : null,
    hotel_lng: hotelLng ? parseFloat(hotelLng) : null,
    hotel_rating: hotelRating ? parseFloat(hotelRating) : null,
    // Room fields
    room_count: roomCount ? parseInt(roomCount) : null,
    room_type: roomType || null,
    check_in: checkIn || null,
    check_out: checkOut || null,
    bib_count: bibCount ? parseInt(bibCount) : null,
    // Price
    price: price ? parseFloat(price) : null,
    price_negotiable: priceNegotiable,
    // Bib transfer
    transfer_type: transferType || null,
    associated_costs: associatedCosts ? parseFloat(associatedCosts) : null,
    cost_notes: costNotes || null
  }).eq("id", id);
  if (error) {
    console.error("Listing update error:", error);
    return data({
      error: "Failed to update listing"
    }, {
      status: 400
    });
  }
  return redirect(`/listings/${id}`);
}
const listings_$id__edit = UNSAFE_withComponentProps(function EditListing() {
  var _a, _b;
  const {
    user,
    listing,
    events,
    googlePlacesApiKey
  } = useLoaderData();
  const actionData = useActionData();
  useNavigate();
  const listingData = listing;
  const [listingType, setListingType] = useState(listingData.listing_type);
  const [roomType, setRoomType] = useState(listingData.room_type || "");
  const [selectedEvent, setSelectedEvent] = useState(listingData.event);
  const [transferMethod, setTransferMethod] = useState(listingData.transfer_type);
  const [checkInDate, setCheckInDate] = useState(listingData.check_in ? new Date(listingData.check_in) : null);
  const [currency, setCurrency] = useState(listingData.currency || "EUR");
  const [priceValue, setPriceValue] = useState(((_a = listingData.price) == null ? void 0 : _a.toString()) || "");
  const [priceNegotiable, setPriceNegotiable] = useState(listingData.price_negotiable === true ? true : listingData.price_negotiable === false ? false : null);
  useEffect(() => {
    const textarea = document.getElementById("description");
    if (textarea && roomType === "other") {
      textarea.setCustomValidity(textarea.value ? "" : "Required");
      const handleInput = () => {
        textarea.setCustomValidity(textarea.value ? "" : "Required");
      };
      textarea.addEventListener("input", handleInput);
      return () => textarea.removeEventListener("input", handleInput);
    }
  }, [roomType]);
  const getDateConstraints = () => {
    if (!(selectedEvent == null ? void 0 : selectedEvent.event_date)) return {
      min: void 0,
      max: void 0
    };
    const eventDate = new Date(selectedEvent.event_date);
    const minDate = new Date(eventDate);
    minDate.setDate(minDate.getDate() - 7);
    const maxDate = new Date(eventDate);
    maxDate.setDate(maxDate.getDate() + 7);
    return {
      min: minDate.toISOString().split("T")[0],
      max: maxDate.toISOString().split("T")[0]
    };
  };
  const dateConstraints = getDateConstraints();
  const maxRooms = getMaxLimit(user.user_type, "rooms");
  const maxBibs = getMaxLimit(user.user_type, "bibs");
  const transferMethodOptions = getTransferMethodOptions(user.user_type);
  const visibleFields = getVisibleFieldsForTransferMethod(user.user_type, transferMethod, listingType);
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsx("div", {
      className: "min-h-screen bg-cover bg-center bg-no-repeat bg-fixed",
      style: {
        backgroundImage: "url('/new-listing.jpg')"
      },
      children: /* @__PURE__ */ jsxs("main", {
        className: "mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "mb-8 rounded-xl bg-white/70 backdrop-blur-sm p-4 shadow-[0_2px_8px_rgba(0,0,0,0.15)]",
          children: [/* @__PURE__ */ jsxs(Link, {
            to: `/listings/${listingData.id}`,
            className: "inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 underline",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-4 w-4",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M15 19l-7-7 7-7"
              })
            }), "Back to listing"]
          }), /* @__PURE__ */ jsx("h1", {
            className: "font-display text-3xl font-bold text-gray-900",
            children: "Edit Listing"
          }), /* @__PURE__ */ jsx("p", {
            className: "mt-2 text-gray-600",
            children: "Update your listing details"
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "rounded-2xl bg-white/90 backdrop-blur-sm p-6 sm:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.15)]",
          children: /* @__PURE__ */ jsxs(Form, {
            method: "post",
            className: "space-y-8",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "label",
                children: "What are you offering?"
              }), /* @__PURE__ */ jsxs("div", {
                className: "mt-2 grid grid-cols-3 gap-3",
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-blue-300 has-[:checked]:bg-blue-100 has-[:checked]:ring-2 has-[:checked]:ring-blue-500",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "radio",
                    name: "listingType",
                    value: "room",
                    className: "sr-only",
                    defaultChecked: listingType === "room",
                    onChange: (e) => setListingType(e.target.value)
                  }), /* @__PURE__ */ jsxs("span", {
                    className: "flex flex-1 flex-col items-center text-center",
                    children: [/* @__PURE__ */ jsx("svg", {
                      className: "h-6 w-6 text-gray-600",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      })
                    }), /* @__PURE__ */ jsx("span", {
                      className: "mt-2 text-sm font-medium text-gray-900",
                      children: "Room Only"
                    })]
                  })]
                }), /* @__PURE__ */ jsxs("label", {
                  className: "relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-purple-300 has-[:checked]:bg-purple-100 has-[:checked]:ring-2 has-[:checked]:ring-purple-500",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "radio",
                    name: "listingType",
                    value: "bib",
                    className: "sr-only",
                    defaultChecked: listingType === "bib",
                    onChange: (e) => setListingType(e.target.value)
                  }), /* @__PURE__ */ jsxs("span", {
                    className: "flex flex-1 flex-col items-center text-center",
                    children: [/* @__PURE__ */ jsx("svg", {
                      className: "h-6 w-6 text-gray-600",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                      })
                    }), /* @__PURE__ */ jsx("span", {
                      className: "mt-2 text-sm font-medium text-gray-900",
                      children: "Bib Only"
                    })]
                  })]
                }), /* @__PURE__ */ jsxs("label", {
                  className: "relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-green-300 has-[:checked]:bg-green-100 has-[:checked]:ring-2 has-[:checked]:ring-green-500",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "radio",
                    name: "listingType",
                    value: "room_and_bib",
                    className: "sr-only",
                    defaultChecked: listingType === "room_and_bib",
                    onChange: (e) => setListingType(e.target.value)
                  }), /* @__PURE__ */ jsxs("span", {
                    className: "flex flex-1 flex-col items-center text-center",
                    children: [/* @__PURE__ */ jsx("svg", {
                      className: "h-6 w-6 text-gray-600",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      })
                    }), /* @__PURE__ */ jsx("span", {
                      className: "mt-2 text-sm font-medium text-gray-900",
                      children: "Room + Bib"
                    })]
                  })]
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "label",
                children: "Running Event"
              }), /* @__PURE__ */ jsx(EventPicker, {
                events,
                defaultEventId: (_b = listingData.event) == null ? void 0 : _b.id,
                onSelectEvent: (eventId) => {
                  const event = events.find((e) => e.id === eventId);
                  setSelectedEvent(event);
                }
              })]
            }), (listingType === "room" || listingType === "room_and_bib") && /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              id: "roomFields",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-medium text-gray-900 border-b pb-2",
                children: "Room Details"
              }), /* @__PURE__ */ jsxs("div", {
                className: "grid gap-4 sm:grid-cols-2",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "sm:col-span-2",
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "label",
                    children: "Hotel"
                  }), /* @__PURE__ */ jsx(HotelAutocomplete, {
                    apiKey: googlePlacesApiKey,
                    eventCity: selectedEvent == null ? void 0 : selectedEvent.country,
                    eventCountry: selectedEvent == null ? void 0 : selectedEvent.country,
                    defaultHotelName: listingData.hotel_name,
                    onSelectHotel: (hotel) => {
                    }
                  })]
                }), /* @__PURE__ */ jsx("div", {}), /* @__PURE__ */ jsx("div", {}), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsxs("label", {
                    htmlFor: "roomCount",
                    className: "label",
                    children: ["Number of rooms", maxRooms !== null && user.user_type === "tour_operator" && /* @__PURE__ */ jsxs("span", {
                      className: "text-xs text-gray-500 ml-2",
                      children: ["(max ", maxRooms, " for your account)"]
                    })]
                  }), user.user_type === "private" ? /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsxs("div", {
                      className: "flex items-center gap-3 mt-2",
                      children: [/* @__PURE__ */ jsx("div", {
                        className: `flex h-12 w-12 items-center justify-center rounded-lg font-bold text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${listingType === "room" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`,
                        children: "1"
                      }), /* @__PURE__ */ jsxs("span", {
                        className: "text-sm text-gray-600",
                        children: ["Private users can list", /* @__PURE__ */ jsx("br", {}), "1 room only"]
                      })]
                    }), /* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "roomCount",
                      value: "1"
                    })]
                  }) : /* @__PURE__ */ jsx("input", {
                    type: "number",
                    id: "roomCount",
                    name: "roomCount",
                    min: "1",
                    max: maxRooms || void 0,
                    defaultValue: listingData.room_count || "",
                    placeholder: "e.g. 2",
                    className: "input"
                  })]
                }), /* @__PURE__ */ jsx(RoomTypeDropdown, {
                  value: roomType,
                  onChange: setRoomType,
                  hasError: (actionData == null ? void 0 : actionData.field) === "roomType"
                }), /* @__PURE__ */ jsxs("div", {
                  className: "mt-4",
                  children: [/* @__PURE__ */ jsx("label", {
                    htmlFor: "checkIn",
                    className: "label mb-3",
                    children: "Check-in"
                  }), /* @__PURE__ */ jsx(DatePicker, {
                    id: "checkIn",
                    name: "checkIn",
                    placeholder: "dd/mm/yyyy",
                    defaultValue: listingData.check_in || void 0,
                    minDate: dateConstraints.min ? new Date(dateConstraints.min) : void 0,
                    maxDate: dateConstraints.max ? new Date(dateConstraints.max) : void 0,
                    onChange: (date) => setCheckInDate(date)
                  }), selectedEvent && /* @__PURE__ */ jsxs("p", {
                    className: "mt-1 text-xs text-gray-500",
                    children: ["Event date: ", new Date(selectedEvent.event_date).toLocaleDateString(), " (±7 days)"]
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "mt-4",
                  children: [/* @__PURE__ */ jsx("label", {
                    htmlFor: "checkOut",
                    className: "label mb-3",
                    children: "Check-out"
                  }), /* @__PURE__ */ jsx(DatePicker, {
                    id: "checkOut",
                    name: "checkOut",
                    placeholder: "dd/mm/yyyy",
                    defaultValue: listingData.check_out || void 0,
                    minDate: checkInDate || (dateConstraints.min ? new Date(dateConstraints.min) : void 0),
                    maxDate: dateConstraints.max ? new Date(dateConstraints.max) : void 0
                  })]
                })]
              })]
            }), (listingType === "bib" || listingType === "room_and_bib") && /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              id: "bibFields",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-medium text-gray-900 border-b pb-2",
                children: "Bib Transfer Details"
              }), user.user_type === "private" && /* @__PURE__ */ jsx("div", {
                className: `rounded-lg p-4 ${listingType === "bib" ? "bg-purple-50 border border-purple-200" : "bg-green-50 border border-green-200"}`,
                children: /* @__PURE__ */ jsxs("p", {
                  className: `text-sm ${listingType === "bib" ? "text-purple-800" : "text-green-800"}`,
                  children: [/* @__PURE__ */ jsx("strong", {
                    children: "Important:"
                  }), " runoot facilitates connections for legitimate bib transfers only. Direct sale of bibs may violate event regulations."]
                })
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsxs("label", {
                  htmlFor: "bibCount",
                  className: "label",
                  children: ["Number of bibs", maxBibs !== null && user.user_type === "tour_operator" && /* @__PURE__ */ jsxs("span", {
                    className: "text-xs text-gray-500 ml-2",
                    children: ["(max ", maxBibs, " for your account)"]
                  })]
                }), user.user_type === "private" ? /* @__PURE__ */ jsxs(Fragment, {
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "flex items-center gap-3 mt-2",
                    children: [/* @__PURE__ */ jsx("div", {
                      className: `flex h-12 w-12 items-center justify-center rounded-lg font-bold text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${listingType === "bib" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`,
                      children: "1"
                    }), /* @__PURE__ */ jsx("span", {
                      className: "text-sm text-gray-600",
                      children: "Private users can list 1 bib only"
                    })]
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "bibCount",
                    value: "1"
                  })]
                }) : /* @__PURE__ */ jsx("input", {
                  type: "number",
                  id: "bibCount",
                  name: "bibCount",
                  min: "1",
                  max: maxBibs || void 0,
                  defaultValue: listingData.bib_count || "",
                  placeholder: "e.g. 1",
                  className: "input w-full sm:w-48"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsxs("label", {
                  htmlFor: "transferType",
                  className: "label",
                  children: ["Transfer Method ", /* @__PURE__ */ jsx("span", {
                    className: "text-red-500",
                    children: "*"
                  })]
                }), user.user_type === "private" ? /* @__PURE__ */ jsxs(Fragment, {
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "mt-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700",
                    children: "Official Organizer Name Change"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "transferType",
                    value: "official_process"
                  }), /* @__PURE__ */ jsx("p", {
                    className: "mt-1 text-xs text-gray-500",
                    children: "How the bib will be transferred to the new participant"
                  })]
                }) : /* @__PURE__ */ jsxs(Fragment, {
                  children: [/* @__PURE__ */ jsxs("select", {
                    id: "transferType",
                    name: "transferType",
                    className: "input",
                    defaultValue: listingData.transfer_type || "",
                    onChange: (e) => setTransferMethod(e.target.value),
                    children: [/* @__PURE__ */ jsx("option", {
                      value: "",
                      children: "Select transfer method"
                    }), transferMethodOptions.map((option) => /* @__PURE__ */ jsx("option", {
                      value: option.value,
                      children: option.label
                    }, option.value))]
                  }), /* @__PURE__ */ jsx("p", {
                    className: "mt-1 text-xs text-gray-500",
                    children: "How the bib will be transferred to the new participant"
                  })]
                })]
              }), visibleFields.showPackageInfo && /* @__PURE__ */ jsx("div", {
                className: "bg-green-50 border border-green-200 rounded-lg p-4",
                children: /* @__PURE__ */ jsxs("p", {
                  className: "text-sm text-green-800",
                  children: [/* @__PURE__ */ jsx("strong", {
                    children: "Package Transfer:"
                  }), " The bib is included in your travel package. All costs are included in the package price."]
                })
              })]
            }), !(user.user_type === "private" && listingType === "bib") && /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-medium text-gray-900 border-b pb-2",
                children: "Price"
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "price",
                  className: "label mb-3",
                  children: "Amount"
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex gap-2",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "number",
                    id: "price",
                    name: "price",
                    min: "0",
                    step: "0.01",
                    placeholder: "Empty = Contact for price",
                    className: "input w-[205px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-sm placeholder:font-sans",
                    value: priceValue,
                    onChange: (e) => {
                      setPriceValue(e.target.value);
                      if (!e.target.value) {
                        setPriceNegotiable(null);
                      }
                    }
                  }), /* @__PURE__ */ jsx(CurrencyPicker, {
                    value: currency,
                    onChange: setCurrency
                  })]
                })]
              }), priceValue && (listingType === "room" || listingType === "room_and_bib") && /* @__PURE__ */ jsxs("div", {
                className: "mt-4",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "priceNegotiable",
                  value: priceNegotiable === true ? "true" : "false"
                }), /* @__PURE__ */ jsx("span", {
                  className: "text-sm text-gray-700",
                  children: "Is the price negotiable?"
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex gap-2 mt-2",
                  children: [/* @__PURE__ */ jsx("button", {
                    type: "button",
                    onClick: () => setPriceNegotiable(priceNegotiable === true ? null : true),
                    className: `px-4 py-2 rounded-lg text-sm font-medium transition-all ${priceNegotiable === true ? "bg-green-100 text-green-700 ring-2 ring-green-500 shadow-[0_2px_8px_rgba(0,0,0,0.15)]" : "bg-white text-gray-700 shadow-sm hover:ring-2 hover:ring-green-300"}`,
                    children: "Yes"
                  }), /* @__PURE__ */ jsx("button", {
                    type: "button",
                    onClick: () => setPriceNegotiable(priceNegotiable === false ? null : false),
                    className: `px-4 py-2 rounded-lg text-sm font-medium transition-all ${priceNegotiable === false ? "bg-green-100 text-green-700 ring-2 ring-green-500 shadow-[0_2px_8px_rgba(0,0,0,0.15)]" : "bg-white text-gray-700 shadow-sm hover:ring-2 hover:ring-green-300"}`,
                    children: "No"
                  })]
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsxs("label", {
                htmlFor: "description",
                className: "label",
                children: [user.user_type === "private" && listingType === "bib" ? "Notes" : "Additional details", " ", /* @__PURE__ */ jsx("span", {
                  className: roomType === "other" ? "text-red-500" : "text-gray-400",
                  children: roomType === "other" ? "(required)" : "(optional)"
                })]
              }), /* @__PURE__ */ jsx("textarea", {
                id: "description",
                name: "description",
                rows: 4,
                defaultValue: listingData.description || "",
                placeholder: "Any other information runners should know...",
                className: `input ${roomType === "other" ? "required:border-red-500 invalid:border-red-500 focus:invalid:ring-red-500" : ""}`,
                required: roomType === "other"
              })]
            }), (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsxs("div", {
              className: "rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2",
              children: [/* @__PURE__ */ jsx("svg", {
                className: "h-5 w-5 text-red-500 flex-shrink-0",
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ jsx("path", {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                })
              }), actionData.error]
            }), /* @__PURE__ */ jsx("div", {
              className: "pt-4",
              children: /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "btn-primary w-full rounded-full",
                children: "Save Changes"
              })
            })]
          })
        })]
      })
    })]
  });
});
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$t,
  default: listings_$id__edit,
  loader: loader$B,
  meta: meta$y
}, Symbol.toStringTag, { value: "Module" }));
const meta$x = () => {
  return [{
    title: "Running Experience - runoot"
  }];
};
async function loader$A({
  request
}) {
  const user = await requireUser(request);
  if (user.user_type === "tour_operator") {
    return redirect("/profile/agency");
  }
  return {
    user
  };
}
async function action$s({
  request
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const marathonsCompleted = formData.get("marathonsCompleted");
  const marathonPB = formData.get("marathonPB");
  const marathonPBLocation = formData.get("marathonPBLocation");
  const halfMarathonsCompleted = formData.get("halfMarathonsCompleted");
  const halfMarathonPB = formData.get("halfMarathonPB");
  const halfMarathonPBLocation = formData.get("halfMarathonPBLocation");
  const favoriteRaces = formData.get("favoriteRaces");
  const runningGoals = formData.get("runningGoals");
  const updateData = {
    marathons_completed: marathonsCompleted ? parseInt(marathonsCompleted) : null,
    marathon_pb: marathonPB || null,
    marathon_pb_location: marathonPBLocation || null,
    half_marathons_completed: halfMarathonsCompleted ? parseInt(halfMarathonsCompleted) : null,
    half_marathon_pb: halfMarathonPB || null,
    half_marathon_pb_location: halfMarathonPBLocation || null,
    favorite_races: favoriteRaces || null,
    running_goals: runningGoals || null
  };
  const {
    error
  } = await supabaseAdmin.from("profiles").update(updateData).eq("id", user.id);
  if (error) {
    return data({
      error: error.message
    }, {
      status: 400
    });
  }
  return data({
    success: true,
    message: "Running experience updated successfully!"
  });
}
const sidebarNavItems$3 = [{
  name: "Personal information",
  href: "/profile",
  icon: "user"
}, {
  name: "Running Experience",
  href: "/profile/experience",
  icon: "running"
}, {
  name: "Social Media",
  href: "/profile/social",
  icon: "share"
}, {
  name: "Settings",
  href: "/profile/settings",
  icon: "settings"
}];
const profile_experience = UNSAFE_withComponentProps(function RunningExperience() {
  const {
    user
  } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-screen bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsx("div", {
      className: "mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8",
      children: /* @__PURE__ */ jsxs("div", {
        className: "flex flex-col lg:flex-row gap-8",
        children: [/* @__PURE__ */ jsx("aside", {
          className: "lg:w-64 flex-shrink-0",
          children: /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-2xl border border-gray-200 p-6",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex flex-col items-center text-center mb-6",
              children: [/* @__PURE__ */ jsx("div", {
                className: "h-20 w-20 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-bold mb-4",
                children: user.avatar_url ? /* @__PURE__ */ jsx("img", {
                  src: user.avatar_url,
                  alt: user.full_name || "User",
                  className: "h-20 w-20 rounded-full object-cover"
                }) : getInitials(user.full_name)
              }), /* @__PURE__ */ jsx("h2", {
                className: "font-display font-semibold text-gray-900 text-lg",
                children: user.full_name || "Your Name"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-500 mt-1",
                children: user.email
              }), /* @__PURE__ */ jsx("span", {
                className: "mt-2 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700",
                children: "Private Runner"
              })]
            }), /* @__PURE__ */ jsx("nav", {
              className: "space-y-1",
              children: sidebarNavItems$3.map((item) => {
                const isActive = location.pathname === item.href;
                return /* @__PURE__ */ jsxs(Link, {
                  to: item.href,
                  className: `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`,
                  children: [item.icon === "user" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    })
                  }), item.icon === "running" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M13 10V3L4 14h7v7l9-11h-7z"
                    })
                  }), item.icon === "share" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    })
                  }), item.icon === "settings" && /* @__PURE__ */ jsxs("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: [/* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    }), /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    })]
                  }), item.name]
                }, item.name);
              })
            })]
          })
        }), /* @__PURE__ */ jsxs("main", {
          className: "flex-1 min-w-0",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "mb-6",
            children: [/* @__PURE__ */ jsx("h1", {
              className: "font-display text-2xl font-bold text-gray-900",
              children: "Running Experience"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-1 text-gray-500",
              children: "Share your running journey and achievements with the community"
            })]
          }), actionData && "success" in actionData && actionData.success && /* @__PURE__ */ jsxs("div", {
            className: "mb-6 rounded-xl bg-success-50 p-4 text-sm text-success-700 flex items-center gap-2",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-5 w-5",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M5 13l4 4L19 7"
              })
            }), "message" in actionData ? actionData.message : ""]
          }), actionData && "error" in actionData && actionData.error && /* @__PURE__ */ jsxs("div", {
            className: "mb-6 rounded-xl bg-alert-50 p-4 text-sm text-alert-700 flex items-center gap-2",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-5 w-5",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              })
            }), actionData.error]
          }), /* @__PURE__ */ jsxs(Form, {
            method: "post",
            children: [/* @__PURE__ */ jsx("h3", {
              className: "font-display font-semibold text-gray-900 text-lg mb-3",
              children: "Marathons"
            }), /* @__PURE__ */ jsxs("div", {
              className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "Completed"
                }), /* @__PURE__ */ jsx("input", {
                  name: "marathonsCompleted",
                  type: "number",
                  min: "0",
                  defaultValue: user.marathons_completed || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                  placeholder: "0"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "Personal best"
                }), /* @__PURE__ */ jsx("input", {
                  name: "marathonPB",
                  type: "text",
                  defaultValue: user.marathon_pb || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "3:45:00"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "PB Location"
                }), /* @__PURE__ */ jsx("input", {
                  name: "marathonPBLocation",
                  type: "text",
                  defaultValue: user.marathon_pb_location || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "Berlin 2023"
                })]
              })]
            }), /* @__PURE__ */ jsx("h3", {
              className: "font-display font-semibold text-gray-900 text-lg mb-3",
              children: "Half Marathons"
            }), /* @__PURE__ */ jsxs("div", {
              className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "Completed"
                }), /* @__PURE__ */ jsx("input", {
                  name: "halfMarathonsCompleted",
                  type: "number",
                  min: "0",
                  defaultValue: user.half_marathons_completed || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                  placeholder: "0"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "Personal best"
                }), /* @__PURE__ */ jsx("input", {
                  name: "halfMarathonPB",
                  type: "text",
                  defaultValue: user.half_marathon_pb || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "1:45:00"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "PB Location"
                }), /* @__PURE__ */ jsx("input", {
                  name: "halfMarathonPBLocation",
                  type: "text",
                  defaultValue: user.half_marathon_pb_location || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "Valencia 2024"
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "grid grid-cols-1 md:grid-cols-2 gap-4",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors md:col-span-2",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "Favorite races"
                }), /* @__PURE__ */ jsx("textarea", {
                  name: "favoriteRaces",
                  rows: 3,
                  defaultValue: user.favorite_races || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none resize-none",
                  placeholder: "Berlin Marathon, New York Marathon, Tokyo Marathon..."
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-2 text-xs text-gray-400",
                  children: "List the races you've enjoyed the most"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors md:col-span-2",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "Running goals"
                }), /* @__PURE__ */ jsx("textarea", {
                  name: "runningGoals",
                  rows: 3,
                  defaultValue: user.running_goals || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none resize-none",
                  placeholder: "Complete all 6 World Marathon Majors, qualify for Boston..."
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-2 text-xs text-gray-400",
                  children: "What are you training for?"
                })]
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "mt-6",
              children: /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "btn-primary px-8",
                children: "Save Changes"
              })
            })]
          })]
        })]
      })
    })]
  });
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$s,
  default: profile_experience,
  loader: loader$A,
  meta: meta$x
}, Symbol.toStringTag, { value: "Module" }));
async function loader$z({
  request
}) {
  const user = await requireUser(request);
  const userId = user.id;
  const {
    data: allConversations,
    error
  } = await supabaseAdmin.from("conversations").select(`
      *,
      listing:listings(id, title, listing_type, author_id),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type),
      messages(id, content, sender_id, created_at, read_at, message_type, detected_language, translated_content, translated_to)
    `).or(`participant_1.eq.${userId},participant_2.eq.${userId}`).order("updated_at", {
    ascending: false
  });
  if (error) {
    console.error("Error fetching conversations:", error);
    return data({
      conversations: []
    }, {
      status: 500
    });
  }
  const conversations = (allConversations || []).filter((conv) => {
    var _a;
    if (conv.activated) return true;
    return ((_a = conv.listing) == null ? void 0 : _a.author_id) === userId;
  });
  return data({
    conversations: conversations || []
  });
}
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$z
}, Symbol.toStringTag, { value: "Module" }));
async function loader$y({
  request
}) {
  const userId = await getUserId(request);
  if (!userId) {
    return data({
      unreadNotifications: 0
    });
  }
  const {
    count
  } = await supabaseAdmin.from("notifications").select("*", {
    count: "exact",
    head: true
  }).eq("user_id", userId).is("read_at", null);
  return data({
    unreadNotifications: count || 0
  });
}
async function action$r({
  request
}) {
  const userId = await getUserId(request);
  if (!userId) {
    return data({
      error: "Not authenticated"
    }, {
      status: 401
    });
  }
  const formData = await request.formData();
  const actionType = formData.get("_action");
  switch (actionType) {
    case "markRead": {
      const notificationId = formData.get("notificationId");
      await supabaseAdmin.from("notifications").update({
        read_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", notificationId).eq("user_id", userId);
      return data({
        success: true
      });
    }
    case "markAllRead": {
      await supabaseAdmin.from("notifications").update({
        read_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("user_id", userId).is("read_at", null);
      return data({
        success: true
      });
    }
    default:
      return data({
        error: "Unknown action"
      }, {
        status: 400
      });
  }
}
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$r,
  loader: loader$y
}, Symbol.toStringTag, { value: "Module" }));
async function loader$x({
  request,
  params
}) {
  const user = await requireUser(request);
  const userId = user.id;
  const conversationId = params.id;
  if (!conversationId) {
    return data({
      messages: []
    }, {
      status: 400
    });
  }
  const {
    data: conversation
  } = await supabaseAdmin.from("conversations").select("participant_1, participant_2").eq("id", conversationId).single();
  if (!conversation || conversation.participant_1 !== userId && conversation.participant_2 !== userId) {
    return data({
      messages: []
    }, {
      status: 403
    });
  }
  const {
    data: messages2,
    error
  } = await supabaseAdmin.from("messages").select("id, conversation_id, sender_id, content, created_at, read_at, message_type").eq("conversation_id", conversationId).order("created_at", {
    ascending: true
  });
  if (error) {
    console.error("Error fetching messages:", error);
    return data({
      messages: []
    }, {
      status: 500
    });
  }
  const unreadIds = (messages2 == null ? void 0 : messages2.filter((m) => m.sender_id !== userId && !m.read_at).map((m) => m.id)) || [];
  if (unreadIds.length > 0) {
    await supabaseAdmin.from("messages").update({
      read_at: (/* @__PURE__ */ new Date()).toISOString()
    }).in("id", unreadIds);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    messages2 == null ? void 0 : messages2.forEach((m) => {
      if (unreadIds.includes(m.id)) {
        m.read_at = now;
      }
    });
  }
  return data({
    messages: messages2 || []
  });
}
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$x
}, Symbol.toStringTag, { value: "Module" }));
const meta$w = () => {
  return [{
    title: "Become a Team Leader - Runoot"
  }];
};
async function loader$w({
  request,
  params
}) {
  const user = await requireUser(request);
  const token = params.token;
  if (!token) {
    throw redirect("/");
  }
  if (user.is_team_leader) {
    return {
      status: "already_tl",
      user,
      token: null
    };
  }
  const {
    data: tokenData
  } = await supabaseAdmin.from("tl_invite_tokens").select("*").eq("token", token).single();
  if (!tokenData) {
    return {
      status: "invalid",
      user,
      token: null
    };
  }
  if (tokenData.used_by) {
    return {
      status: "used",
      user,
      token: null
    };
  }
  if (tokenData.expires_at && new Date(tokenData.expires_at) < /* @__PURE__ */ new Date()) {
    return {
      status: "expired",
      user,
      token: null
    };
  }
  return {
    status: "valid",
    user,
    token: tokenData
  };
}
async function action$q({
  request,
  params
}) {
  const user = await requireUser(request);
  const tokenValue = params.token;
  if (!tokenValue) {
    return data({
      error: "No token provided"
    }, {
      status: 400
    });
  }
  if (user.is_team_leader) {
    return data({
      error: "You are already a Team Leader"
    }, {
      status: 400
    });
  }
  const {
    data: tokenData
  } = await supabaseAdmin.from("tl_invite_tokens").select("*").eq("token", tokenValue).single();
  if (!tokenData) {
    return data({
      error: "Invalid token"
    }, {
      status: 400
    });
  }
  if (tokenData.used_by) {
    return data({
      error: "This token has already been used"
    }, {
      status: 400
    });
  }
  if (tokenData.expires_at && new Date(tokenData.expires_at) < /* @__PURE__ */ new Date()) {
    return data({
      error: "This token has expired"
    }, {
      status: 400
    });
  }
  const baseName = user.full_name || user.email.split("@")[0] || "TL";
  let code = baseName.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8) + (/* @__PURE__ */ new Date()).getFullYear();
  const {
    data: existing
  } = await supabaseAdmin.from("profiles").select("id").eq("referral_code", code).single();
  if (existing) {
    code = code + Math.floor(Math.random() * 100);
  }
  await supabaseAdmin.from("profiles").update({
    is_team_leader: true,
    referral_code: code
  }).eq("id", user.id);
  await supabaseAdmin.from("tl_invite_tokens").update({
    used_by: user.id,
    used_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("token", tokenValue);
  await supabaseAdmin.from("notifications").insert({
    user_id: user.id,
    type: "tl_promoted",
    title: "Welcome, Team Leader!",
    message: `You've accepted the invite and are now a Team Leader! Your referral code is ${code}. Visit your TL Dashboard to customize it.`,
    data: {
      referral_code: code
    }
  });
  return redirect("/tl-dashboard");
}
const becomeTl_$token = UNSAFE_withComponentProps(function BecomeTL() {
  const {
    status,
    user
  } = useLoaderData();
  const actionData = useActionData();
  return /* @__PURE__ */ jsx("div", {
    className: "min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12",
    children: /* @__PURE__ */ jsx("div", {
      className: "max-w-md w-full",
      children: /* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center",
        children: [status === "valid" && /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-8 h-8 text-purple-600",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              })
            })
          }), /* @__PURE__ */ jsx("h1", {
            className: "font-display text-2xl font-bold text-gray-900 mb-2",
            children: "Become a Team Leader"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-500 mb-6",
            children: "You've been invited to become a Team Leader on Runoot! As a TL, you'll get a personal referral link to invite runners and track your community."
          }), actionData && "error" in actionData && /* @__PURE__ */ jsx("div", {
            className: "mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm",
            children: actionData.error
          }), /* @__PURE__ */ jsx(Form, {
            method: "post",
            children: /* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "btn-primary w-full text-base py-3",
              children: "Accept Invite"
            })
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-xs text-gray-400 mt-4",
            children: ["Logged in as ", user.full_name || user.email]
          })]
        }), status === "already_tl" && /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-8 h-8 text-brand-600",
              fill: "currentColor",
              viewBox: "0 0 20 20",
              children: /* @__PURE__ */ jsx("path", {
                fillRule: "evenodd",
                d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                clipRule: "evenodd"
              })
            })
          }), /* @__PURE__ */ jsx("h1", {
            className: "font-display text-2xl font-bold text-gray-900 mb-2",
            children: "You're Already a Team Leader!"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-500 mb-6",
            children: "You already have Team Leader status. Head to your dashboard to manage your community."
          }), /* @__PURE__ */ jsx(Link, {
            to: "/tl-dashboard",
            className: "btn-primary inline-block w-full py-3",
            children: "Go to TL Dashboard"
          })]
        }), status === "invalid" && /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-8 h-8 text-red-500",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M6 18L18 6M6 6l12 12"
              })
            })
          }), /* @__PURE__ */ jsx("h1", {
            className: "font-display text-2xl font-bold text-gray-900 mb-2",
            children: "Invalid Token"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-500 mb-6",
            children: "This invite link is not valid. Please contact the admin for a new one."
          }), /* @__PURE__ */ jsx(Link, {
            to: "/",
            className: "btn-secondary inline-block w-full py-3",
            children: "Go Home"
          })]
        }), status === "used" && /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-8 h-8 text-amber-500",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              })
            })
          }), /* @__PURE__ */ jsx("h1", {
            className: "font-display text-2xl font-bold text-gray-900 mb-2",
            children: "Token Already Used"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-500 mb-6",
            children: "This invite link has already been used by someone else. Please contact the admin for a new one."
          }), /* @__PURE__ */ jsx(Link, {
            to: "/",
            className: "btn-secondary inline-block w-full py-3",
            children: "Go Home"
          })]
        }), status === "expired" && /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-8 h-8 text-gray-400",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              })
            })
          }), /* @__PURE__ */ jsx("h1", {
            className: "font-display text-2xl font-bold text-gray-900 mb-2",
            children: "Token Expired"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-500 mb-6",
            children: "This invite link has expired. Please contact the admin for a new one."
          }), /* @__PURE__ */ jsx(Link, {
            to: "/",
            className: "btn-secondary inline-block w-full py-3",
            children: "Go Home"
          })]
        })]
      })
    })
  });
});
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$q,
  default: becomeTl_$token,
  loader: loader$w,
  meta: meta$w
}, Symbol.toStringTag, { value: "Module" }));
const meta$v = () => {
  return [{
    title: "Settings - runoot"
  }];
};
async function loader$v({
  request
}) {
  const user = await requireUser(request);
  if (user.user_type === "tour_operator") {
    return redirect("/profile/agency");
  }
  const userId = user.id;
  const {
    data: blockedUsers
  } = await supabaseAdmin.from("blocked_users").select(`
      id,
      blocked_id,
      created_at,
      blocked:profiles!blocked_users_blocked_id_fkey(id, full_name, company_name, email)
    `).eq("blocker_id", userId).order("created_at", {
    ascending: false
  });
  return {
    user,
    blockedUsers: blockedUsers || []
  };
}
async function action$p({
  request
}) {
  const user = await requireUser(request);
  const userId = user.id;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const blockedId = formData.get("blocked_id");
  if (intent === "unblock" && typeof blockedId === "string") {
    await supabaseAdmin.from("blocked_users").delete().eq("blocker_id", userId).eq("blocked_id", blockedId);
    return data({
      success: true,
      action: "unblocked"
    });
  }
  return data({
    error: "Invalid action"
  }, {
    status: 400
  });
}
const sidebarNavItems$2 = [{
  name: "Personal information",
  href: "/profile",
  icon: "user"
}, {
  name: "Running Experience",
  href: "/profile/experience",
  icon: "running"
}, {
  name: "Social Media",
  href: "/profile/social",
  icon: "share"
}, {
  name: "Settings",
  href: "/profile/settings",
  icon: "settings"
}];
const profile_settings = UNSAFE_withComponentProps(function Settings() {
  const {
    user,
    blockedUsers
  } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-screen bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsx("div", {
      className: "mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8",
      children: /* @__PURE__ */ jsxs("div", {
        className: "flex flex-col lg:flex-row gap-8",
        children: [/* @__PURE__ */ jsx("aside", {
          className: "lg:w-64 flex-shrink-0",
          children: /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-2xl border border-gray-200 p-6",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex flex-col items-center text-center mb-6",
              children: [/* @__PURE__ */ jsx("div", {
                className: "h-20 w-20 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-bold mb-4",
                children: user.avatar_url ? /* @__PURE__ */ jsx("img", {
                  src: user.avatar_url,
                  alt: user.full_name || "User",
                  className: "h-20 w-20 rounded-full object-cover"
                }) : getInitials(user.full_name)
              }), /* @__PURE__ */ jsx("h2", {
                className: "font-display font-semibold text-gray-900 text-lg",
                children: user.full_name || "Your Name"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-500 mt-1",
                children: user.email
              }), /* @__PURE__ */ jsx("span", {
                className: "mt-2 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700",
                children: "Private Runner"
              })]
            }), /* @__PURE__ */ jsx("nav", {
              className: "space-y-1",
              children: sidebarNavItems$2.map((item) => {
                const isActive = location.pathname === item.href;
                return /* @__PURE__ */ jsxs(Link, {
                  to: item.href,
                  className: `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`,
                  children: [item.icon === "user" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    })
                  }), item.icon === "running" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M13 10V3L4 14h7v7l9-11h-7z"
                    })
                  }), item.icon === "share" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    })
                  }), item.icon === "settings" && /* @__PURE__ */ jsxs("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: [/* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    }), /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    })]
                  }), item.name]
                }, item.name);
              })
            })]
          })
        }), /* @__PURE__ */ jsxs("main", {
          className: "flex-1 min-w-0",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "mb-6",
            children: [/* @__PURE__ */ jsx("h1", {
              className: "font-display text-2xl font-bold text-gray-900",
              children: "Settings"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-1 text-gray-500",
              children: "Manage your account preferences and privacy"
            })]
          }), actionData && "success" in actionData && actionData.success && /* @__PURE__ */ jsxs("div", {
            className: "mb-6 rounded-xl bg-success-50 p-4 text-sm text-success-700 flex items-center gap-2",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-5 w-5",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M5 13l4 4L19 7"
              })
            }), "User has been unblocked successfully."]
          }), /* @__PURE__ */ jsx("h3", {
            className: "font-display font-semibold text-gray-900 text-lg mb-3",
            children: "Account"
          }), /* @__PURE__ */ jsxs("div", {
            className: "grid grid-cols-1 gap-4 mb-6",
            children: [/* @__PURE__ */ jsx("div", {
              className: "bg-white rounded-2xl border border-gray-200 p-5",
              children: /* @__PURE__ */ jsxs("div", {
                className: "flex items-center justify-between",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "text-sm font-medium text-gray-500",
                    children: "Email"
                  }), /* @__PURE__ */ jsx("p", {
                    className: "mt-1 text-gray-900 font-medium",
                    children: user.email
                  })]
                }), /* @__PURE__ */ jsx("svg", {
                  className: "h-5 w-5 text-gray-300",
                  fill: "none",
                  viewBox: "0 0 24 24",
                  stroke: "currentColor",
                  children: /* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  })
                })]
              })
            }), /* @__PURE__ */ jsx("div", {
              className: "bg-white rounded-2xl border border-gray-200 p-5",
              children: /* @__PURE__ */ jsxs("div", {
                className: "flex items-center justify-between",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "text-sm font-medium text-gray-900",
                    children: "Change password"
                  }), /* @__PURE__ */ jsx("p", {
                    className: "text-sm text-gray-500 mt-1",
                    children: "Update your account password"
                  })]
                }), /* @__PURE__ */ jsx("span", {
                  className: "text-sm text-gray-400",
                  children: "Coming soon"
                })]
              })
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "font-display font-semibold text-gray-900 text-lg mb-3",
            children: "Blocked Users"
          }), /* @__PURE__ */ jsx("div", {
            className: "bg-white rounded-2xl border border-gray-200 p-5 mb-6",
            children: blockedUsers.length > 0 ? /* @__PURE__ */ jsx("div", {
              className: "divide-y divide-gray-100",
              children: blockedUsers.map((block) => {
                var _a, _b, _c, _d, _e, _f;
                return /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center justify-between py-3 first:pt-0 last:pb-0",
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "flex items-center gap-3",
                    children: [/* @__PURE__ */ jsx("div", {
                      className: "flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 font-semibold",
                      children: ((_b = (_a = block.blocked) == null ? void 0 : _a.company_name) == null ? void 0 : _b.charAt(0)) || ((_d = (_c = block.blocked) == null ? void 0 : _c.full_name) == null ? void 0 : _d.charAt(0)) || "?"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: ((_e = block.blocked) == null ? void 0 : _e.company_name) || ((_f = block.blocked) == null ? void 0 : _f.full_name) || "Unknown user"
                      }), /* @__PURE__ */ jsxs("p", {
                        className: "text-sm text-gray-500",
                        children: ["Blocked on ", new Date(block.created_at).toLocaleDateString()]
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs(Form, {
                    method: "post",
                    children: [/* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "intent",
                      value: "unblock"
                    }), /* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "blocked_id",
                      value: block.blocked_id
                    }), /* @__PURE__ */ jsx("button", {
                      type: "submit",
                      className: "text-sm text-brand-600 hover:text-brand-700 font-medium",
                      children: "Unblock"
                    })]
                  })]
                }, block.id);
              })
            }) : /* @__PURE__ */ jsx("p", {
              className: "text-gray-500 text-sm",
              children: "You haven't blocked any users."
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "font-display font-semibold text-gray-900 text-lg mb-3",
            children: "Notifications"
          }), /* @__PURE__ */ jsx("div", {
            className: "grid grid-cols-1 gap-4 mb-6",
            children: /* @__PURE__ */ jsx("div", {
              className: "bg-white rounded-2xl border border-gray-200 p-5",
              children: /* @__PURE__ */ jsxs("div", {
                className: "flex items-center justify-between",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "text-sm font-medium text-gray-900",
                    children: "Email notifications"
                  }), /* @__PURE__ */ jsx("p", {
                    className: "text-sm text-gray-500 mt-1",
                    children: "Receive emails for new messages"
                  })]
                }), /* @__PURE__ */ jsx("span", {
                  className: "text-sm text-gray-400",
                  children: "Coming soon"
                })]
              })
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "font-display font-semibold text-gray-900 text-lg mb-3",
            children: "Support"
          }), /* @__PURE__ */ jsxs("div", {
            className: "grid grid-cols-1 gap-4 mb-6",
            children: [/* @__PURE__ */ jsx("div", {
              className: "bg-white rounded-2xl border border-gray-200 p-5",
              children: /* @__PURE__ */ jsxs("div", {
                className: "flex items-center justify-between",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "text-sm font-medium text-gray-900",
                    children: "Contact us"
                  }), /* @__PURE__ */ jsx("p", {
                    className: "text-sm text-gray-500 mt-1",
                    children: "Report a problem or send feedback"
                  })]
                }), /* @__PURE__ */ jsx(Link, {
                  to: "/contact",
                  className: "text-sm text-brand-600 hover:text-brand-700 font-medium",
                  children: "Contact"
                })]
              })
            }), /* @__PURE__ */ jsx("div", {
              className: "bg-white rounded-2xl border border-gray-200 p-5",
              children: /* @__PURE__ */ jsxs("div", {
                className: "flex items-center justify-between",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "text-sm font-medium text-gray-900",
                    children: "Terms & Privacy"
                  }), /* @__PURE__ */ jsx("p", {
                    className: "text-sm text-gray-500 mt-1",
                    children: "Read our terms and privacy policy"
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex gap-3",
                  children: [/* @__PURE__ */ jsx(Link, {
                    to: "/terms",
                    className: "text-sm text-brand-600 hover:text-brand-700 font-medium",
                    children: "Terms"
                  }), /* @__PURE__ */ jsx(Link, {
                    to: "/privacy-policy",
                    className: "text-sm text-brand-600 hover:text-brand-700 font-medium",
                    children: "Privacy"
                  })]
                })]
              })
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "font-display font-semibold text-alert-600 text-lg mb-3",
            children: "Danger Zone"
          }), /* @__PURE__ */ jsx("div", {
            className: "grid grid-cols-1 gap-4",
            children: /* @__PURE__ */ jsx("div", {
              className: "bg-white rounded-2xl border border-alert-200 p-5",
              children: /* @__PURE__ */ jsxs("div", {
                className: "flex items-center justify-between",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "text-sm font-medium text-gray-900",
                    children: "Delete account"
                  }), /* @__PURE__ */ jsx("p", {
                    className: "text-sm text-gray-500 mt-1",
                    children: "Permanently delete your account and all data"
                  })]
                }), /* @__PURE__ */ jsx("span", {
                  className: "text-sm text-gray-400",
                  children: "Coming soon"
                })]
              })
            })
          })]
        })]
      })
    })]
  });
});
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$p,
  default: profile_settings,
  loader: loader$v,
  meta: meta$v
}, Symbol.toStringTag, { value: "Module" }));
function FooterLight() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("footer", { className: "md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
      /* @__PURE__ */ jsx(Link, { to: "/", className: "flex items-center -my-1", children: /* @__PURE__ */ jsx(
        "img",
        {
          src: "/logo.svg",
          alt: "Runoot",
          className: "h-14 w-auto"
        }
      ) }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 text-[10px] text-gray-400 -mt-1 pb-1", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          "© ",
          (/* @__PURE__ */ new Date()).getFullYear()
        ] }),
        /* @__PURE__ */ jsx("span", { children: "·" }),
        /* @__PURE__ */ jsx(Link, { to: "/privacy-policy", className: "hover:text-gray-600 transition-colors", children: "Privacy" }),
        /* @__PURE__ */ jsx("span", { children: "·" }),
        /* @__PURE__ */ jsx(Link, { to: "/cookie-policy", className: "hover:text-gray-600 transition-colors", children: "Cookies" }),
        /* @__PURE__ */ jsx("span", { children: "·" }),
        /* @__PURE__ */ jsx(Link, { to: "/terms", className: "hover:text-gray-600 transition-colors", children: "Terms" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("footer", { className: "hidden md:block bg-white border-t border-gray-200", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-gray-500", children: [
      /* @__PURE__ */ jsxs("span", { className: "text-sm", children: [
        "© ",
        (/* @__PURE__ */ new Date()).getFullYear(),
        " Runoot Exchange. All rights reserved."
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 text-sm", children: [
        /* @__PURE__ */ jsx(Link, { to: "/privacy-policy", className: "hover:text-gray-700 transition-colors", children: "Privacy Policy" }),
        /* @__PURE__ */ jsx("span", { className: "text-gray-300", children: "|" }),
        /* @__PURE__ */ jsx(Link, { to: "/cookie-policy", className: "hover:text-gray-700 transition-colors", children: "Cookie Policy" }),
        /* @__PURE__ */ jsx("span", { className: "text-gray-300", children: "|" }),
        /* @__PURE__ */ jsx(Link, { to: "/terms", className: "hover:text-gray-700 transition-colors", children: "Terms & Conditions" })
      ] })
    ] }) }) })
  ] });
}
function isLastMinute$1(eventDate) {
  const today = /* @__PURE__ */ new Date();
  const event = new Date(eventDate);
  const diffTime = event.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
  return diffDays <= 21 && diffDays >= 0;
}
function formatRoomType$1(roomType) {
  if (!roomType) return "";
  const labels = {
    single: "Single Room",
    double: "Double Room",
    double_single_use: "Double Single Use",
    twin: "Twin Room",
    twin_shared: "Twin Shared",
    triple: "Triple Room",
    quadruple: "Quadruple"
  };
  return labels[roomType] || roomType;
}
function getEventSlug$3(event) {
  if (event.slug) return event.slug;
  return event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function ListingCard({ listing, isUserLoggedIn = true, isSaved = false }) {
  var _a, _b;
  const saveFetcher = useFetcher();
  const isSavedOptimistic = saveFetcher.formData ? saveFetcher.formData.get("action") === "save" : isSaved;
  const eventDate = new Date(listing.event.event_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long"
  });
  const mainTitle = listing.event.name;
  const isLM = isLastMinute$1(listing.event.event_date);
  const isTourOperator = listing.author.user_type === "tour_operator";
  const needsNameChange = listing.transfer_type === "official_process";
  if (listing.listing_type === "bib") {
    listing.bib_count && listing.bib_count > 1 ? `${listing.bib_count} Bibs Available` : "Bib Available";
  } else if (listing.listing_type === "room") {
    const roomTypeText = listing.room_type ? formatRoomType$1(listing.room_type) : "Room";
    listing.room_count && listing.room_count > 1 ? `${listing.room_count} ${roomTypeText}s Available` : `${roomTypeText} Available`;
  } else ;
  let badgeText = "";
  let badgeColor = "";
  if (listing.listing_type === "bib") {
    badgeText = "Bib";
    badgeColor = "bg-purple-100 text-purple-700";
  } else if (listing.listing_type === "room") {
    badgeText = "Hotel";
    badgeColor = "bg-blue-100 text-blue-700";
  } else {
    badgeText = "Package";
    badgeColor = "bg-green-100 text-green-700";
  }
  const cardClass = isTourOperator ? "card overflow-hidden transition-all border-2 border-amber-400 h-full flex flex-col [box-shadow:0_8px_30px_rgba(0,0,0,0.5)]" : "card overflow-hidden transition-all h-full flex flex-col [box-shadow:0_8px_30px_rgba(0,0,0,0.5)]";
  return /* @__PURE__ */ jsxs(
    Link,
    {
      to: isUserLoggedIn ? `/listings/${listing.id}` : "/login",
      className: cardClass,
      children: [
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx(
            "img",
            {
              src: `/events/${getEventSlug$3(listing.event)}.jpg`,
              alt: listing.event.name,
              className: "w-full aspect-video object-cover",
              onError: (e) => {
                const target = e.target;
                target.style.display = "none";
                const fallback = target.nextElementSibling;
                if (fallback) fallback.style.display = "flex";
              }
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "w-full aspect-video bg-gradient-to-br from-brand-100 to-brand-200 items-center justify-center", style: { display: "none" }, children: /* @__PURE__ */ jsx("svg", { className: "h-12 w-12 text-brand-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }) }),
          /* @__PURE__ */ jsxs("div", { className: "absolute top-3 left-3 flex gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: `px-2.5 py-1 rounded-full text-xs font-medium shadow-sm ${badgeColor}`, children: badgeText }),
            isLM && /* @__PURE__ */ jsx("span", { className: "px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 shadow-sm", children: "Last Minute" })
          ] }),
          isUserLoggedIn && /* @__PURE__ */ jsxs(
            saveFetcher.Form,
            {
              method: "post",
              action: "/api/saved",
              onClick: (e) => e.stopPropagation(),
              className: "absolute top-3 right-3",
              children: [
                /* @__PURE__ */ jsx("input", { type: "hidden", name: "listingId", value: listing.id }),
                /* @__PURE__ */ jsx("input", { type: "hidden", name: "action", value: isSavedOptimistic ? "unsave" : "save" }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "submit",
                    onClick: (e) => e.preventDefault(),
                    onMouseDown: (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      saveFetcher.submit(
                        { listingId: listing.id, action: isSavedOptimistic ? "unsave" : "save" },
                        { method: "post", action: "/api/saved" }
                      );
                    },
                    className: `p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-colors ${isSavedOptimistic ? "text-red-500 hover:text-red-600" : "text-gray-500 hover:text-red-500"}`,
                    title: isSavedOptimistic ? "Remove from saved" : "Save listing",
                    children: /* @__PURE__ */ jsx(
                      "svg",
                      {
                        className: "h-5 w-5",
                        fill: isSavedOptimistic ? "currentColor" : "none",
                        viewBox: "0 0 24 24",
                        stroke: "currentColor",
                        strokeWidth: 2,
                        children: /* @__PURE__ */ jsx(
                          "path",
                          {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          }
                        )
                      }
                    )
                  }
                )
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-5 flex-grow flex flex-col", children: [
          /* @__PURE__ */ jsx("h3", { className: "font-display text-lg font-bold text-gray-900 mb-1.5 text-center min-h-[3.5rem] flex items-start justify-center", children: /* @__PURE__ */ jsx("span", { children: mainTitle }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center gap-1.5 text-sm text-gray-600 mb-3", children: [
            /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }) }),
            /* @__PURE__ */ jsxs("span", { className: "font-medium", children: [
              "Race Day: ",
              eventDate
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex-grow flex flex-col", children: listing.listing_type === "bib" ? (
            /* BIB ONLY - Layout centrato e più prominente */
            /* @__PURE__ */ jsxs("div", { className: "flex-grow flex flex-col items-center justify-center text-center py-4 min-h-[10rem]", children: [
              /* @__PURE__ */ jsx("div", { className: "w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3", children: /* @__PURE__ */ jsx("svg", { className: "h-8 w-8 text-purple-600", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" }) }) }),
              /* @__PURE__ */ jsx("p", { className: "text-3xl font-bold text-gray-900 mb-1", children: listing.bib_count || 1 }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-600 mb-2", children: listing.bib_count && listing.bib_count > 1 ? "Bibs Available" : "Bib Available" }),
              needsNameChange && /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full", children: [
                /* @__PURE__ */ jsx("svg", { className: "h-3 w-3", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }),
                "Name change required"
              ] })
            ] })
          ) : listing.listing_type === "room" ? (
            /* ROOM ONLY - Layout con hotel info prominente e centrato */
            /* @__PURE__ */ jsxs("div", { className: "flex-grow flex flex-col items-center justify-center text-center min-h-[10rem]", children: [
              listing.hotel_name && /* @__PURE__ */ jsx("div", { className: "mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100 w-full", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
                /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-1.5", children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-blue-600", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" }) }) }),
                /* @__PURE__ */ jsx("p", { className: "font-semibold text-gray-900 leading-tight text-sm truncate w-full", children: listing.hotel_name }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mt-0.5", children: [
                  listing.hotel_stars && /* @__PURE__ */ jsx("span", { className: "text-yellow-500 text-xs", children: "★".repeat(listing.hotel_stars) }),
                  listing.hotel_rating && /* @__PURE__ */ jsxs("span", { className: "text-xs text-gray-600", children: [
                    "⭐ ",
                    listing.hotel_rating.toFixed(1)
                  ] })
                ] })
              ] }) }),
              isUserLoggedIn && /* @__PURE__ */ jsxs("div", { className: "p-3 bg-gray-50 rounded-lg w-full space-y-2", children: [
                listing.room_count && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center gap-2 text-sm text-gray-700", children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" }) }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    listing.room_type ? formatRoomType$1(listing.room_type) : "Room",
                    listing.room_count > 1 && ` × ${listing.room_count}`
                  ] })
                ] }),
                listing.check_in && listing.check_out && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center gap-2 text-sm text-gray-700", children: [
                  /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }) }),
                  /* @__PURE__ */ jsx("span", { children: new Date(listing.check_in).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }),
                  /* @__PURE__ */ jsx("span", { className: "text-gray-400", children: "→" }),
                  /* @__PURE__ */ jsx("span", { children: new Date(listing.check_out).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) })
                ] })
              ] })
            ] })
          ) : (
            /* PACKAGE (room_and_bib) - Layout centrato con contenuto in basso */
            /* @__PURE__ */ jsxs("div", { className: "flex-grow flex flex-col items-center justify-end text-center pb-3 min-h-[10rem]", children: [
              listing.hotel_name && /* @__PURE__ */ jsx("div", { className: "mb-2 p-3 bg-green-50 rounded-lg border border-green-100 w-full", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
                /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center mb-1.5", children: /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-green-600", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" }) }) }),
                /* @__PURE__ */ jsx("p", { className: "font-semibold text-gray-900 leading-tight text-sm truncate w-full", children: listing.hotel_name }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mt-0.5", children: [
                  listing.hotel_stars && /* @__PURE__ */ jsx("span", { className: "text-yellow-500 text-xs", children: "★".repeat(listing.hotel_stars) }),
                  listing.hotel_rating && /* @__PURE__ */ jsxs("span", { className: "text-xs text-gray-600", children: [
                    "⭐ ",
                    listing.hotel_rating.toFixed(1)
                  ] })
                ] })
              ] }) }),
              isUserLoggedIn && /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3 w-full", children: [
                /* @__PURE__ */ jsxs("div", { className: "p-2 bg-gray-50 rounded-lg text-center", children: [
                  /* @__PURE__ */ jsxs("p", { className: "text-sm font-semibold text-gray-900", children: [
                    listing.room_type ? formatRoomType$1(listing.room_type) : "Room",
                    listing.room_count && listing.room_count > 1 && ` × ${listing.room_count}`
                  ] }),
                  listing.check_in && listing.check_out && /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-500 mt-1", children: [
                    new Date(listing.check_in).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
                    " → ",
                    new Date(listing.check_out).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "p-2 bg-gray-50 rounded-lg text-center", children: [
                  /* @__PURE__ */ jsxs("p", { className: "text-sm font-semibold text-gray-900", children: [
                    listing.bib_count || 1,
                    " ",
                    listing.bib_count && listing.bib_count > 1 ? "Bibs" : "Bib"
                  ] }),
                  needsNameChange && /* @__PURE__ */ jsx("p", { className: "text-xs text-orange-600 mt-1", children: "Name change req." })
                ] })
              ] })
            ] })
          ) }),
          /* @__PURE__ */ jsx("div", { className: "mt-auto pt-3 flex items-center justify-between border-t border-gray-300", children: isUserLoggedIn ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("div", { className: "flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-medium", children: ((_a = listing.author.company_name) == null ? void 0 : _a.charAt(0)) || ((_b = listing.author.full_name) == null ? void 0 : _b.charAt(0)) || "?" }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-gray-900 truncate", children: listing.author.company_name || listing.author.full_name }),
                  listing.author.is_verified && /* @__PURE__ */ jsx("svg", { className: "h-4 w-4 text-brand-500 flex-shrink-0", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx(
                    "path",
                    {
                      fillRule: "evenodd",
                      d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                      clipRule: "evenodd"
                    }
                  ) })
                ] }),
                /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-500", children: [
                  listing.author.user_type === "tour_operator" ? "Tour Operator" : "Private user",
                  listing.author.is_verified && " • Verified"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "text-right", children: listing.listing_type === "bib" && listing.associated_costs ? /* @__PURE__ */ jsxs("p", { className: "text-lg font-bold text-gray-900", children: [
              "€",
              listing.associated_costs.toLocaleString()
            ] }) : listing.price ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs("p", { className: "text-lg font-bold text-gray-900", children: [
                "€",
                listing.price.toLocaleString()
              ] }),
              listing.price_negotiable && /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500", children: "Negotiable" })
            ] }) : /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-gray-600", children: "Contact" }) })
          ] }) : /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 italic w-full text-center", children: "Login to view seller details and pricing" }) }),
          isUserLoggedIn && /* @__PURE__ */ jsx("div", { className: "mt-3", children: /* @__PURE__ */ jsx("button", { className: "w-full btn-primary text-sm py-2 rounded-full", children: "View Details" }) })
        ] })
      ]
    }
  );
}
function isLastMinute(eventDate) {
  const today = /* @__PURE__ */ new Date();
  const event = new Date(eventDate);
  const diffTime = event.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
  return diffDays <= 21 && diffDays >= 0;
}
function formatRoomTypeShort(roomType) {
  if (!roomType) return "Room";
  const labels = {
    single: "Single",
    double: "Double",
    double_single_use: "Double SU",
    twin: "Twin",
    twin_shared: "Twin Shared",
    triple: "Triple",
    quadruple: "Quad"
  };
  return labels[roomType] || roomType;
}
function getEventSlug$2(event) {
  if (event.slug) return event.slug;
  return event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function ListingCardCompact({ listing, isUserLoggedIn = true, isSaved = false }) {
  var _a, _b;
  const saveFetcher = useFetcher();
  const isSavedOptimistic = saveFetcher.formData ? saveFetcher.formData.get("action") === "save" : isSaved;
  const eventDateShort = new Date(listing.event.event_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short"
  });
  const isLM = isLastMinute(listing.event.event_date);
  const isTourOperator = listing.author.user_type === "tour_operator";
  let subtitle = "";
  if (listing.listing_type === "bib") {
    subtitle = listing.bib_count && listing.bib_count > 1 ? `${listing.bib_count} Bibs` : "Bib";
  } else if (listing.listing_type === "room") {
    const roomTypeText = listing.room_type ? formatRoomTypeShort(listing.room_type) : "Room";
    subtitle = listing.room_count && listing.room_count > 1 ? `${listing.room_count} ${roomTypeText}s` : roomTypeText;
  } else {
    subtitle = "Room + Bib";
  }
  let badgeColor = "";
  if (listing.listing_type === "bib") {
    badgeColor = "bg-purple-100 text-purple-700";
  } else if (listing.listing_type === "room") {
    badgeColor = "bg-blue-100 text-blue-700";
  } else {
    badgeColor = "bg-green-100 text-green-700";
  }
  const cardClass = isTourOperator ? "block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-brand-300 transition-all border-l-4 border-l-brand-500" : "block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-brand-300 transition-all";
  const sellerName = listing.author.company_name || listing.author.full_name || "Seller";
  const sellerNameShort = sellerName.split(" ")[0];
  const eventSlug = getEventSlug$2(listing.event);
  const logoPath = `/logos/${eventSlug}.png`;
  return /* @__PURE__ */ jsxs(
    Link,
    {
      to: isUserLoggedIn ? `/listings/${listing.id}` : "/login",
      className: `${cardClass} relative`,
      children: [
        isUserLoggedIn && /* @__PURE__ */ jsx("div", { className: "absolute top-3 right-3 z-10", children: /* @__PURE__ */ jsxs(
          saveFetcher.Form,
          {
            method: "post",
            action: "/api/saved",
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsx("input", { type: "hidden", name: "listingId", value: listing.id }),
              /* @__PURE__ */ jsx("input", { type: "hidden", name: "action", value: isSavedOptimistic ? "unsave" : "save" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "submit",
                  onClick: (e) => e.preventDefault(),
                  onMouseDown: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    saveFetcher.submit(
                      { listingId: listing.id, action: isSavedOptimistic ? "unsave" : "save" },
                      { method: "post", action: "/api/saved" }
                    );
                  },
                  className: `p-1 rounded-full transition-colors ${isSavedOptimistic ? "text-red-500" : "text-gray-400 hover:text-red-500"}`,
                  title: isSavedOptimistic ? "Remove from saved" : "Save listing",
                  children: /* @__PURE__ */ jsx(
                    "svg",
                    {
                      className: "h-5 w-5",
                      fill: isSavedOptimistic ? "currentColor" : "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      strokeWidth: 2,
                      children: /* @__PURE__ */ jsx(
                        "path",
                        {
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        }
                      )
                    }
                  )
                }
              )
            ]
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mb-2", children: [
              /* @__PURE__ */ jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badgeColor}`, children: listing.listing_type === "bib" ? "Bib" : listing.listing_type === "room" ? "Hotel" : "Package" }),
              isLM && /* @__PURE__ */ jsx("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-100 text-accent-700", children: "LM" })
            ] }),
            /* @__PURE__ */ jsx("h3", { className: "font-display text-base font-bold text-gray-900 leading-tight mb-0.5 line-clamp-1", children: listing.event.name }),
            /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-brand-600", children: subtitle }),
            listing.hotel_name && /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-600 mb-2 truncate", children: listing.hotel_name }),
            !listing.hotel_name && /* @__PURE__ */ jsx("div", { className: "mb-2" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 text-xs text-gray-600 mb-2", children: [
              /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5 text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }) }),
              /* @__PURE__ */ jsxs("span", { className: "font-medium", children: [
                "Race Day: ",
                eventDateShort
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center self-center", children: /* @__PURE__ */ jsx(
            "img",
            {
              src: logoPath,
              alt: `${listing.event.name} logo`,
              className: "w-full h-full object-contain p-1",
              onError: (e) => {
                const target = e.target;
                target.style.display = "none";
              }
            }
          ) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex items-center pt-2 border-t border-gray-100", children: isUserLoggedIn ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 min-w-0 flex-1", children: [
            /* @__PURE__ */ jsx("div", { className: "flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex-shrink-0", children: ((_a = listing.author.company_name) == null ? void 0 : _a.charAt(0)) || ((_b = listing.author.full_name) == null ? void 0 : _b.charAt(0)) || "?" }),
            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold text-gray-900 truncate", children: sellerNameShort }),
                listing.author.is_verified && /* @__PURE__ */ jsx("svg", { className: "h-3.5 w-3.5 text-brand-500 flex-shrink-0", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx(
                  "path",
                  {
                    fillRule: "evenodd",
                    d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                    clipRule: "evenodd"
                  }
                ) })
              ] }),
              /* @__PURE__ */ jsx("p", { className: "text-[10px] text-gray-500", children: listing.author.user_type === "tour_operator" ? "Tour Operator" : "Private" })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex-1 flex justify-center", children: /* @__PURE__ */ jsx("span", { className: "bg-accent-500 text-white text-xs font-medium px-4 py-1.5 rounded-full", children: "View" }) }),
          /* @__PURE__ */ jsx("div", { className: "text-right flex-1 flex justify-end", children: listing.listing_type === "bib" && listing.associated_costs ? /* @__PURE__ */ jsxs("p", { className: "text-base font-bold text-gray-900", children: [
            "€",
            listing.associated_costs.toLocaleString()
          ] }) : listing.price ? /* @__PURE__ */ jsxs("p", { className: "text-base font-bold text-gray-900", children: [
            "€",
            listing.price.toLocaleString()
          ] }) : /* @__PURE__ */ jsx("p", { className: "text-xs font-medium text-gray-600", children: "Contact" }) })
        ] }) : /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500 italic w-full text-center", children: "Login to view details" }) })
      ]
    }
  );
}
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "first_posted", label: "First posted" },
  { value: "event_soonest", label: "Event date (soonest)" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "contact_price", label: "Contact for price" }
];
function SortDropdown({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  SORT_OPTIONS.find((opt) => opt.value === value) || SORT_OPTIONS[0];
  return /* @__PURE__ */ jsxs("div", { ref: dropdownRef, className: "relative", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => setIsOpen(!isOpen),
        className: "flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white text-gray-700 font-medium rounded-full border border-gray-300 hover:bg-gray-50 transition-colors",
        children: [
          /* @__PURE__ */ jsx(
            "svg",
            {
              className: "h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx(
                "path",
                {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            "svg",
            {
              className: `h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`,
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
            }
          )
        ]
      }
    ),
    isOpen && /* @__PURE__ */ jsx("div", { className: "absolute right-0 z-[100] mt-1 w-48 rounded-lg bg-white shadow-xl border border-gray-200 py-1 overflow-hidden", children: SORT_OPTIONS.map((option) => /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => {
          onChange(option.value);
          setIsOpen(false);
        },
        className: `w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors ${value === option.value ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700"}`,
        children: option.label
      },
      option.value
    )) })
  ] });
}
const meta$u = () => {
  return [{
    title: "Browse Listings - Runoot"
  }];
};
async function loader$u({
  request
}) {
  const user = await getUser(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const search = url.searchParams.get("search");
  let query = supabase.from("listings").select(`
      *,
      author:profiles(id, full_name, company_name, user_type, is_verified),
      event:events(id, name, slug, country, event_date)
    `).eq("status", "active").order("created_at", {
    ascending: false
  });
  if (type && type !== "all") {
    query = query.eq("listing_type", type);
  }
  const {
    data: listings,
    error
  } = await query;
  if (error) {
    console.error("Error loading listings:", error);
    return {
      user,
      listings: []
    };
  }
  let filteredListings = listings || [];
  if (search) {
    const searchLower = search.toLowerCase();
    filteredListings = filteredListings.filter((l) => {
      var _a, _b, _c, _d, _e;
      return ((_b = (_a = l.event) == null ? void 0 : _a.name) == null ? void 0 : _b.toLowerCase().includes(searchLower)) || ((_d = (_c = l.event) == null ? void 0 : _c.country) == null ? void 0 : _d.toLowerCase().includes(searchLower)) || ((_e = l.title) == null ? void 0 : _e.toLowerCase().includes(searchLower));
    });
  }
  let savedListingIds = [];
  if (user) {
    const {
      data: savedListings
    } = await supabaseAdmin.from("saved_listings").select("listing_id").eq("user_id", user.id);
    savedListingIds = (savedListings == null ? void 0 : savedListings.map((s) => s.listing_id)) || [];
  }
  const {
    data: events
  } = await supabase.from("events").select("id, name, country, event_date").order("event_date", {
    ascending: true
  });
  return {
    user,
    listings: filteredListings,
    savedListingIds,
    events: events || []
  };
}
const listings__index = UNSAFE_withComponentProps(function Listings() {
  const {
    user,
    listings,
    savedListingIds,
    events
  } = useLoaderData();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const currentType = searchParams.get("type") || "all";
  const currentSearch = searchParams.get("search") || "";
  const currentSort = searchParams.get("sort") || "newest";
  const [searchQuery, setSearchQuery] = useState(currentSearch);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState(currentSort);
  const ITEMS_PER_PAGE2 = 12;
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE2);
  }, [currentType, currentSearch, sortBy]);
  const sortedListings = [...listings].sort((a, b) => {
    var _a, _b;
    switch (sortBy) {
      case "newest":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "first_posted":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "event_soonest":
        const dateA = ((_a = a.event) == null ? void 0 : _a.event_date) ? new Date(a.event.event_date).getTime() : Infinity;
        const dateB = ((_b = b.event) == null ? void 0 : _b.event_date) ? new Date(b.event.event_date).getTime() : Infinity;
        return dateA - dateB;
      case "price_low":
        const priceA = a.price != null ? a.price : Infinity;
        const priceB = b.price != null ? b.price : Infinity;
        return priceA - priceB;
      case "price_high":
        const priceHighA = a.price != null ? a.price : -Infinity;
        const priceHighB = b.price != null ? b.price : -Infinity;
        return priceHighB - priceHighA;
      case "contact_price":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });
  const filteredBySort = sortBy === "contact_price" ? sortedListings.filter((l) => l.price == null) : sortedListings;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE2);
  const visibleListings = filteredBySort.slice(0, visibleCount);
  const hasMore = visibleCount < filteredBySort.length;
  const filteredEvents = searchQuery.length >= 2 ? events.filter((event) => event.name.toLowerCase().includes(searchQuery.toLowerCase()) || event.country.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5) : [];
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleSuggestionClick = (eventName) => {
    setSearchQuery(eventName);
    setShowSuggestions(false);
    const params = new URLSearchParams();
    if (currentType !== "all") params.set("type", currentType);
    params.set("search", eventName);
    navigate(`/listings?${params.toString()}`);
  };
  return /* @__PURE__ */ jsx("div", {
    className: "min-h-screen bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed",
    children: /* @__PURE__ */ jsxs("div", {
      className: "min-h-screen bg-gray-50/60 md:bg-gray-50/85 flex flex-col",
      children: [/* @__PURE__ */ jsx(Header, {
        user
      }), /* @__PURE__ */ jsxs("main", {
        className: "mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8 flex-grow w-full",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "relative z-10 mb-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-md px-3 py-4 sm:p-6",
          children: [/* @__PURE__ */ jsx("h1", {
            className: "font-display text-2xl sm:text-3xl font-bold text-gray-900 text-center sm:text-left",
            children: "Browse Listings"
          }), /* @__PURE__ */ jsx("p", {
            className: "hidden sm:block mt-2 text-gray-600 mb-8",
            children: "Find available rooms and bibs for upcoming marathons"
          }), /* @__PURE__ */ jsx("div", {
            className: "sm:hidden mb-6"
          }), /* @__PURE__ */ jsxs(Form, {
            method: "get",
            name: "listing-search",
            className: "mb-6",
            children: [/* @__PURE__ */ jsx("input", {
              type: "hidden",
              name: "type",
              value: currentType
            }), /* @__PURE__ */ jsxs("div", {
              className: "relative max-w-xl",
              ref: searchRef,
              children: [/* @__PURE__ */ jsx("svg", {
                className: "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10",
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ jsx("path", {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                })
              }), /* @__PURE__ */ jsx("input", {
                type: "search",
                id: "listing-search",
                name: "search",
                autoComplete: "off",
                placeholder: "Search event name...",
                value: searchQuery,
                onChange: (e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                },
                onFocus: () => setShowSuggestions(true),
                className: "block w-full rounded-full border-0 pl-12 pr-20 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors shadow-md ring-1 ring-gray-200"
              }), /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "absolute right-1.5 top-1/2 -translate-y-1/2 px-5 py-2 bg-accent-500 text-white text-sm font-medium rounded-full hover:bg-accent-600 transition-all",
                children: "Search"
              }), showSuggestions && filteredEvents.length > 0 && /* @__PURE__ */ jsx("div", {
                className: "absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden",
                children: filteredEvents.map((event) => /* @__PURE__ */ jsxs("button", {
                  type: "button",
                  onClick: () => handleSuggestionClick(event.name),
                  className: "w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors",
                  children: [/* @__PURE__ */ jsx("p", {
                    className: "font-medium text-gray-900",
                    children: event.name
                  }), /* @__PURE__ */ jsxs("p", {
                    className: "text-sm text-gray-500",
                    children: [event.country, " • ", new Date(event.event_date).toLocaleDateString()]
                  })]
                }, event.id))
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex flex-wrap items-center gap-2",
            children: [[{
              value: "all",
              label: "All"
            }, {
              value: "room",
              label: "Hotel"
            }, {
              value: "bib",
              label: "Bibs"
            }, {
              value: "room_and_bib",
              label: "Package"
            }].map((category) => /* @__PURE__ */ jsx("a", {
              href: category.value === "all" ? `/listings${currentSearch ? `?search=${currentSearch}` : ""}` : `/listings?type=${category.value}${currentSearch ? `&search=${currentSearch}` : ""}`,
              className: `px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${currentType === category.value ? "bg-brand-500 text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`,
              children: category.label
            }, category.value)), /* @__PURE__ */ jsx(SortDropdown, {
              value: sortBy,
              onChange: setSortBy
            })]
          })]
        }), filteredBySort.length > 0 ? /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("div", {
            className: "hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr relative z-0",
            children: visibleListings.map((listing) => /* @__PURE__ */ jsx(ListingCard, {
              listing,
              isUserLoggedIn: !!user,
              isSaved: (savedListingIds || []).includes(listing.id)
            }, listing.id))
          }), /* @__PURE__ */ jsx("div", {
            className: "flex flex-col gap-3 md:hidden relative z-0",
            children: visibleListings.map((listing) => /* @__PURE__ */ jsx(ListingCardCompact, {
              listing,
              isUserLoggedIn: !!user,
              isSaved: (savedListingIds || []).includes(listing.id)
            }, listing.id))
          }), hasMore && /* @__PURE__ */ jsx("div", {
            className: "mt-8 text-center",
            children: /* @__PURE__ */ jsxs("button", {
              onClick: () => setVisibleCount((prev) => prev + ITEMS_PER_PAGE2),
              className: "px-8 py-3 bg-white text-gray-700 font-medium rounded-full border border-gray-300 hover:bg-gray-50 transition-colors shadow-md",
              children: ["Load More (", filteredBySort.length - visibleCount, " remaining)"]
            })
          })]
        }) : /* @__PURE__ */ jsxs("div", {
          className: "text-center py-12",
          children: [/* @__PURE__ */ jsx("svg", {
            className: "mx-auto h-12 w-12 text-gray-400",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 1.5,
              d: "M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "mt-4 text-lg font-medium text-gray-900",
            children: "No listings found"
          }), /* @__PURE__ */ jsx("p", {
            className: "mt-2 text-gray-600",
            children: currentSearch || currentType !== "all" ? "Try adjusting your filters" : "Be the first to create a listing!"
          })]
        })]
      }), /* @__PURE__ */ jsx(FooterLight, {})]
    })
  });
});
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: listings__index,
  loader: loader$u,
  meta: meta$u
}, Symbol.toStringTag, { value: "Module" }));
const meta$t = () => {
  return [{
    title: "Privacy Policy | Runoot"
  }, {
    name: "description",
    content: "Informativa sulla privacy di Runoot - Scopri come raccogliamo, utilizziamo e proteggiamo i tuoi dati personali."
  }];
};
const privacyPolicy = UNSAFE_withComponentProps(function PrivacyPolicy() {
  const lastUpdated = "29 Gennaio 2025";
  const companyEmail = "privacy@runoot.com";
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-screen bg-gray-50",
    children: [/* @__PURE__ */ jsx("header", {
      className: "bg-white shadow-sm",
      children: /* @__PURE__ */ jsxs("div", {
        className: "max-w-4xl mx-auto px-4 py-6",
        children: [/* @__PURE__ */ jsx("a", {
          href: "/",
          className: "text-brand-600 hover:text-brand-700 text-sm",
          children: "← Torna alla Home"
        }), /* @__PURE__ */ jsx("h1", {
          className: "text-3xl font-bold text-gray-900 mt-4",
          children: "Privacy Policy"
        }), /* @__PURE__ */ jsxs("p", {
          className: "text-gray-500 mt-2",
          children: ["Ultimo aggiornamento: ", lastUpdated]
        })]
      })
    }), /* @__PURE__ */ jsxs("main", {
      className: "max-w-4xl mx-auto px-4 py-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-lg shadow-sm p-8 space-y-8",
        children: [/* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "1. Introduzione"
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed",
            children: [`La presente Privacy Policy descrive le modalità di raccolta, utilizzo e protezione dei dati personali degli utenti che accedono e utilizzano la piattaforma Runoot (di seguito "Piattaforma" o "Servizio"), accessibile all'indirizzo`, " ", /* @__PURE__ */ jsx("a", {
              href: "https://runoot.com",
              className: "text-brand-600 hover:underline",
              children: "runoot.com"
            }), "."]
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: "Runoot è un marketplace che consente a tour operator e runner privati di scambiare stanze d'hotel e pettorali (bibs) per eventi podistici. La Piattaforma funge esclusivamente da intermediario tecnologico e non partecipa in alcun modo alle transazioni tra utenti."
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: "Utilizzando la Piattaforma, l'utente dichiara di aver letto, compreso e accettato integralmente la presente Privacy Policy."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "2. Titolare del Trattamento"
          }), /* @__PURE__ */ jsx("div", {
            className: "bg-gray-50 rounded-lg p-4",
            children: /* @__PURE__ */ jsxs("p", {
              className: "text-gray-700",
              children: [/* @__PURE__ */ jsx("strong", {
                children: "Denominazione:"
              }), " [INSERIRE RAGIONE SOCIALE / NOME]", /* @__PURE__ */ jsx("br", {}), /* @__PURE__ */ jsx("strong", {
                children: "Sede legale:"
              }), " [INSERIRE INDIRIZZO COMPLETO]", /* @__PURE__ */ jsx("br", {}), /* @__PURE__ */ jsx("strong", {
                children: "P.IVA / C.F.:"
              }), " [INSERIRE P.IVA O CODICE FISCALE]", /* @__PURE__ */ jsx("br", {}), /* @__PURE__ */ jsx("strong", {
                children: "Email di contatto:"
              }), " ", /* @__PURE__ */ jsx("a", {
                href: `mailto:${companyEmail}`,
                className: "text-brand-600 hover:underline",
                children: companyEmail
              })]
            })
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "3. Dati Personali Raccolti"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-4",
            children: "La Piattaforma raccoglie i seguenti dati personali:"
          }), /* @__PURE__ */ jsxs("div", {
            className: "space-y-6",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h3", {
                className: "text-lg font-medium text-gray-900 mb-2",
                children: "3.1 Dati forniti volontariamente dall'utente"
              }), /* @__PURE__ */ jsxs("ul", {
                className: "space-y-2 text-gray-700",
                children: [/* @__PURE__ */ jsxs("li", {
                  className: "flex items-start",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-brand-600 mr-2",
                    children: "•"
                  }), "Nome completo"]
                }), /* @__PURE__ */ jsxs("li", {
                  className: "flex items-start",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-brand-600 mr-2",
                    children: "•"
                  }), "Indirizzo email"]
                }), /* @__PURE__ */ jsxs("li", {
                  className: "flex items-start",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-brand-600 mr-2",
                    children: "•"
                  }), "Password (conservata in forma crittografata)"]
                }), /* @__PURE__ */ jsxs("li", {
                  className: "flex items-start",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-brand-600 mr-2",
                    children: "•"
                  }), "Tipologia di utente (Tour Operator o Private Runner)"]
                }), /* @__PURE__ */ jsxs("li", {
                  className: "flex items-start",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-brand-600 mr-2",
                    children: "•"
                  }), "Nome azienda (solo per Tour Operator)"]
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h3", {
                className: "text-lg font-medium text-gray-900 mb-2",
                children: "3.2 Dati raccolti automaticamente"
              }), /* @__PURE__ */ jsxs("ul", {
                className: "space-y-2 text-gray-700",
                children: [/* @__PURE__ */ jsxs("li", {
                  className: "flex items-start",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-brand-600 mr-2",
                    children: "•"
                  }), "Indirizzo IP"]
                }), /* @__PURE__ */ jsxs("li", {
                  className: "flex items-start",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-brand-600 mr-2",
                    children: "•"
                  }), "Tipo di browser e dispositivo"]
                }), /* @__PURE__ */ jsxs("li", {
                  className: "flex items-start",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-brand-600 mr-2",
                    children: "•"
                  }), "Dati di navigazione e interazione con la Piattaforma"]
                }), /* @__PURE__ */ jsxs("li", {
                  className: "flex items-start",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-brand-600 mr-2",
                    children: "•"
                  }), "Data e ora di accesso"]
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h3", {
                className: "text-lg font-medium text-gray-900 mb-2",
                children: "3.3 Dati da servizi di terze parti"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-700 leading-relaxed",
                children: "In caso di registrazione tramite Google OAuth, la Piattaforma riceve: nome, indirizzo email e immagine del profilo associati all'account Google dell'utente."
              })]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "4. Finalità del Trattamento"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-4",
            children: "I dati personali sono trattati per le seguenti finalità:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-3 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-medium",
                children: "a)"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Erogazione del Servizio:"
                }), " creazione e gestione dell'account utente, pubblicazione e visualizzazione degli annunci, facilitazione del contatto tra utenti."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-medium",
                children: "b)"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Comunicazioni di servizio:"
                }), " invio di notifiche tecniche, aggiornamenti sulla Piattaforma, comunicazioni relative all'account."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-medium",
                children: "c)"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Sicurezza:"
                }), " prevenzione di frodi, abusi e attività illecite."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-medium",
                children: "d)"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Adempimenti legali:"
                }), " ottemperanza a obblighi di legge o richieste delle autorità competenti."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-medium",
                children: "e)"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Analisi statistica:"
                }), " miglioramento della Piattaforma attraverso analisi aggregate e anonimizzate."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-medium",
                children: "f)"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Marketing (previo consenso):"
                }), " invio di newsletter e comunicazioni promozionali, solo se l'utente ha espresso il proprio consenso esplicito."]
              })]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "5. Base Giuridica del Trattamento"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-4",
            children: "Il trattamento dei dati personali si fonda sulle seguenti basi giuridiche ai sensi dell'art. 6 del GDPR:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Esecuzione del contratto:"
                }), " il trattamento è necessario per fornire il Servizio richiesto dall'utente."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Consenso:"
                }), " per l'invio di comunicazioni di marketing e l'utilizzo di cookie non essenziali."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Obbligo legale:"
                }), " per adempiere a obblighi previsti dalla normativa vigente."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Legittimo interesse:"
                }), " per garantire la sicurezza della Piattaforma e prevenire frodi."]
              })]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "6. Cookie e Tecnologie di Tracciamento"
          }), /* @__PURE__ */ jsxs("div", {
            className: "space-y-4",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h3", {
                className: "text-lg font-medium text-gray-900 mb-2",
                children: "6.1 Cookie tecnici (essenziali)"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-700 leading-relaxed",
                children: "La Piattaforma utilizza cookie tecnici strettamente necessari per il funzionamento del Servizio. Questi cookie non richiedono il consenso dell'utente e includono: cookie di sessione, cookie di autenticazione, cookie per le preferenze di navigazione (es. lingua, tema)."
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h3", {
                className: "text-lg font-medium text-gray-900 mb-2",
                children: "6.2 Cookie analitici (previo consenso)"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-700 leading-relaxed",
                children: "La Piattaforma potrà utilizzare Google Analytics per analizzare l'utilizzo del Servizio in forma aggregata. Tali cookie saranno installati solo previo consenso esplicito dell'utente tramite il banner cookie. L'utente può modificare le proprie preferenze in qualsiasi momento."
              }), /* @__PURE__ */ jsxs("p", {
                className: "text-gray-700 leading-relaxed mt-2",
                children: ["Per maggiori informazioni su Google Analytics, si rimanda alla", " ", /* @__PURE__ */ jsx("a", {
                  href: "https://policies.google.com/privacy",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "text-brand-600 hover:underline",
                  children: "privacy policy di Google"
                }), "."]
              })]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "7. Condivisione dei Dati con Terze Parti"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-4",
            children: "I dati personali possono essere comunicati a:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-3 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Supabase Inc.:"
                }), " fornitore dei servizi di database e autenticazione. I server possono essere ubicati negli Stati Uniti. Supabase aderisce ai meccanismi di trasferimento dati previsti dal GDPR."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Vercel Inc.:"
                }), " fornitore dei servizi di hosting. I server possono essere ubicati negli Stati Uniti e in altre giurisdizioni. Vercel aderisce ai meccanismi di trasferimento dati previsti dal GDPR."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Google LLC:"
                }), " per il servizio di autenticazione OAuth e, previo consenso, per Google Analytics."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Autorità competenti:"
                }), " quando richiesto dalla legge o per tutelare i diritti del Titolare."]
              })]
            })]
          }), /* @__PURE__ */ jsx("div", {
            className: "mt-4 p-4 bg-brand-50 rounded-lg border border-brand-200",
            children: /* @__PURE__ */ jsx("p", {
              className: "text-gray-700 font-medium",
              children: "I dati personali non saranno mai venduti a terzi."
            })
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "8. Trasferimento dei Dati Extra-UE"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-4",
            children: "Alcuni dei fornitori di servizi indicati al punto 7 hanno sede al di fuori dell'Unione Europea, in particolare negli Stati Uniti. Il trasferimento dei dati avviene in conformità al GDPR mediante:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Decisioni di adeguatezza della Commissione Europea (es. EU-US Data Privacy Framework)"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Clausole Contrattuali Standard (SCC) approvate dalla Commissione Europea"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Altre garanzie appropriate previste dall'art. 46 del GDPR"]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "9. Periodo di Conservazione dei Dati"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-4",
            children: "I dati personali sono conservati per il tempo strettamente necessario al perseguimento delle finalità indicate:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Dati dell'account:"
                }), " fino alla cancellazione dell'account da parte dell'utente o fino a 2 anni di inattività."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Dati di navigazione:"
                }), " massimo 12 mesi."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Dati per obblighi legali:"
                }), " per il periodo previsto dalla normativa applicabile."]
              })]
            })]
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mt-4",
            children: "Al termine del periodo di conservazione, i dati saranno cancellati o resi anonimi in modo irreversibile."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "10. Diritti dell'Interessato"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-4",
            children: "Ai sensi degli artt. 15-22 del GDPR, l'utente ha il diritto di:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Accesso:"
                }), " ottenere conferma dell'esistenza di un trattamento e accedere ai propri dati."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Rettifica:"
                }), " ottenere la correzione di dati inesatti o l'integrazione di dati incompleti."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Cancellazione:"
                }), " ottenere la cancellazione dei propri dati nei casi previsti dalla legge."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Limitazione:"
                }), " ottenere la limitazione del trattamento nei casi previsti dalla legge."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Portabilità:"
                }), " ricevere i propri dati in un formato strutturato e trasferirli a un altro titolare."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Opposizione:"
                }), " opporsi al trattamento per motivi legittimi."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Revoca del consenso:"
                }), " revocare in qualsiasi momento il consenso prestato, senza pregiudicare la liceità del trattamento effettuato prima della revoca."]
              })]
            })]
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mt-4",
            children: "Per esercitare tali diritti, l'utente può contattare il Titolare all'indirizzo email indicato al punto 2."
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: ["L'utente ha inoltre il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali:", " ", /* @__PURE__ */ jsx("a", {
              href: "https://www.garanteprivacy.it",
              target: "_blank",
              rel: "noopener noreferrer",
              className: "text-brand-600 hover:underline",
              children: "www.garanteprivacy.it"
            }), "."]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "11. Età Minima"
          }), /* @__PURE__ */ jsxs("div", {
            className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4",
            children: [/* @__PURE__ */ jsxs("p", {
              className: "text-gray-700 leading-relaxed",
              children: [/* @__PURE__ */ jsx("strong", {
                children: "La Piattaforma è destinata esclusivamente a utenti che abbiano compiuto 18 anni di età."
              }), " ", "Registrandosi, l'utente dichiara e garantisce di avere almeno 18 anni."]
            }), /* @__PURE__ */ jsx("p", {
              className: "text-gray-700 leading-relaxed mt-3",
              children: "Il Titolare non raccoglie consapevolmente dati personali di minori. Qualora venisse a conoscenza di una registrazione effettuata da un minore, il Titolare provvederà tempestivamente alla cancellazione dei relativi dati."
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "12. Ruolo della Piattaforma e Limitazione di Responsabilità"
          }), /* @__PURE__ */ jsx("div", {
            className: "bg-red-50 border border-red-200 rounded-lg p-4 mb-4",
            children: /* @__PURE__ */ jsx("p", {
              className: "text-gray-700 leading-relaxed font-medium",
              children: "IMPORTANTE: Runoot opera esclusivamente come piattaforma tecnologica di intermediazione che consente agli utenti di pubblicare annunci e mettersi in contatto tra loro."
            })
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-4 font-medium",
            children: "La Piattaforma NON:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700 mb-6",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Partecipa, media o garantisce le transazioni tra utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Gestisce pagamenti o trasferimenti di denaro tra utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Verifica l'identità, l'affidabilità o la solvibilità degli utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Garantisce la disponibilità, qualità o legittimità degli annunci pubblicati"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Verifica la conformità del trasferimento di pettorali ai regolamenti delle singole gare"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Fornisce servizi di prenotazione alberghiera o organizzazione di viaggi"]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "bg-gray-50 rounded-lg p-4",
            children: [/* @__PURE__ */ jsxs("p", {
              className: "text-gray-700 leading-relaxed",
              children: [/* @__PURE__ */ jsx("strong", {
                children: "Le transazioni avvengono direttamente tra utenti, con metodi di pagamento scelti autonomamente dalle parti coinvolte."
              }), " Il Titolare declina ogni responsabilità per:"]
            }), /* @__PURE__ */ jsxs("ul", {
              className: "space-y-2 text-gray-700 mt-4",
              children: [/* @__PURE__ */ jsxs("li", {
                className: "flex items-start",
                children: [/* @__PURE__ */ jsx("span", {
                  className: "text-gray-400 mr-2",
                  children: "•"
                }), "Eventuali controversie, inadempimenti o danni derivanti dalle transazioni tra utenti"]
              }), /* @__PURE__ */ jsxs("li", {
                className: "flex items-start",
                children: [/* @__PURE__ */ jsx("span", {
                  className: "text-gray-400 mr-2",
                  children: "•"
                }), "La veridicità, completezza o accuratezza delle informazioni fornite dagli utenti"]
              }), /* @__PURE__ */ jsxs("li", {
                className: "flex items-start",
                children: [/* @__PURE__ */ jsx("span", {
                  className: "text-gray-400 mr-2",
                  children: "•"
                }), "Perdite economiche derivanti da transazioni non andate a buon fine"]
              }), /* @__PURE__ */ jsxs("li", {
                className: "flex items-start",
                children: [/* @__PURE__ */ jsx("span", {
                  className: "text-gray-400 mr-2",
                  children: "•"
                }), "Violazioni dei regolamenti delle gare podistiche da parte degli utenti"]
              }), /* @__PURE__ */ jsxs("li", {
                className: "flex items-start",
                children: [/* @__PURE__ */ jsx("span", {
                  className: "text-gray-400 mr-2",
                  children: "•"
                }), "Eventuali frodi, truffe o comportamenti illeciti perpetrati da utenti della Piattaforma"]
              })]
            }), /* @__PURE__ */ jsx("p", {
              className: "text-gray-700 leading-relaxed mt-4 italic",
              children: "Gli utenti riconoscono e accettano che ogni transazione effettuata attraverso contatti ottenuti tramite la Piattaforma è di loro esclusiva responsabilità. Si raccomanda agli utenti di adottare tutte le precauzioni necessarie prima di effettuare pagamenti o scambi."
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "13. Newsletter e Comunicazioni di Marketing"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "L'utente può acconsentire a ricevere comunicazioni di marketing e newsletter da parte del Titolare. Tale consenso è facoltativo e può essere revocato in qualsiasi momento tramite:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700 mt-4",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Il link di disiscrizione presente in ogni comunicazione"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Le impostazioni del proprio account"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Contattando il Titolare all'indirizzo email indicato al punto 2"]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "14. Misure di Sicurezza"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-4",
            children: "Il Titolare adotta misure tecniche e organizzative appropriate per proteggere i dati personali da accessi non autorizzati, perdita, distruzione o alterazione, tra cui:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Crittografia delle password"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Connessioni HTTPS protette"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Controlli di accesso ai sistemi"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Backup periodici dei dati"]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "15. Modifiche alla Privacy Policy"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Il Titolare si riserva il diritto di modificare la presente Privacy Policy in qualsiasi momento. Le modifiche saranno comunicate agli utenti tramite pubblicazione sulla Piattaforma e, per modifiche sostanziali, tramite email."
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: "L'uso continuato della Piattaforma dopo la pubblicazione delle modifiche costituisce accettazione delle stesse."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "16. Contatti"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Per qualsiasi domanda, richiesta o comunicazione relativa alla presente Privacy Policy o al trattamento dei dati personali, l'utente può contattare il Titolare all'indirizzo email:"
          }), /* @__PURE__ */ jsx("div", {
            className: "mt-4 bg-brand-50 rounded-lg p-4 border border-brand-200",
            children: /* @__PURE__ */ jsxs("p", {
              className: "text-gray-700",
              children: ["Email: ", /* @__PURE__ */ jsx("a", {
                href: `mailto:${companyEmail}`,
                className: "text-brand-600 hover:underline font-medium",
                children: companyEmail
              })]
            })
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "17. Legge Applicabile e Foro Competente"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "La presente Privacy Policy è regolata dalla legge italiana e dal Regolamento (UE) 2016/679 (GDPR). Per qualsiasi controversia sarà competente il Foro di [INSERIRE CITTÀ], salvo diversa disposizione inderogabile di legge."
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "pt-6 border-t border-gray-200",
          children: /* @__PURE__ */ jsx("p", {
            className: "text-gray-500 text-sm italic text-center",
            children: "Documento redatto in conformità al Regolamento (UE) 2016/679 (GDPR)"
          })
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "mt-8 text-center text-sm text-gray-500",
        children: [/* @__PURE__ */ jsx("a", {
          href: "/cookie-policy",
          className: "hover:text-brand-600",
          children: "Cookie Policy"
        }), /* @__PURE__ */ jsx("span", {
          className: "mx-2",
          children: "•"
        }), /* @__PURE__ */ jsx("a", {
          href: "/terms",
          className: "hover:text-brand-600",
          children: "Termini di Servizio"
        }), /* @__PURE__ */ jsx("span", {
          className: "mx-2",
          children: "•"
        }), /* @__PURE__ */ jsx("a", {
          href: "/",
          className: "hover:text-brand-600",
          children: "Torna alla Home"
        })]
      })]
    })]
  });
});
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: privacyPolicy,
  meta: meta$t
}, Symbol.toStringTag, { value: "Module" }));
const meta$s = () => {
  return [{
    title: "My Profile - runoot"
  }];
};
async function loader$t({
  request
}) {
  const user = await requireUser(request);
  if (user.user_type === "tour_operator") {
    return redirect("/profile/agency");
  }
  return {
    user
  };
}
async function action$o({
  request
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const fullName = formData.get("fullName");
  const country = formData.get("country");
  const city = formData.get("city");
  const bio = formData.get("bio");
  if (typeof fullName !== "string" || !fullName) {
    return data({
      error: "Full name is required"
    }, {
      status: 400
    });
  }
  const updateData = {
    full_name: fullName,
    country: country || null,
    city: city || null,
    bio: bio || null
  };
  const {
    error
  } = await supabaseAdmin.from("profiles").update(updateData).eq("id", user.id);
  if (error) {
    return data({
      error: error.message
    }, {
      status: 400
    });
  }
  return data({
    success: true,
    message: "Profile updated successfully!"
  });
}
const sidebarNavItems$1 = [{
  name: "Personal information",
  href: "/profile",
  icon: "user"
}, {
  name: "Running Experience",
  href: "/profile/experience",
  icon: "running"
}, {
  name: "Social Media",
  href: "/profile/social",
  icon: "share"
}, {
  name: "Settings",
  href: "/profile/settings",
  icon: "settings"
}];
const profile__index = UNSAFE_withComponentProps(function ProfileIndex() {
  const {
    user
  } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-screen bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsx("div", {
      className: "mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8",
      children: /* @__PURE__ */ jsxs("div", {
        className: "flex flex-col lg:flex-row gap-8",
        children: [/* @__PURE__ */ jsx("aside", {
          className: "lg:w-64 flex-shrink-0",
          children: /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-2xl border border-gray-200 p-6",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex flex-col items-center text-center mb-6",
              children: [/* @__PURE__ */ jsx("div", {
                className: "h-20 w-20 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-bold mb-4",
                children: user.avatar_url ? /* @__PURE__ */ jsx("img", {
                  src: user.avatar_url,
                  alt: user.full_name || "User",
                  className: "h-20 w-20 rounded-full object-cover"
                }) : getInitials(user.full_name)
              }), /* @__PURE__ */ jsx("h2", {
                className: "font-display font-semibold text-gray-900 text-lg",
                children: user.full_name || "Your Name"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-500 mt-1",
                children: user.email
              }), /* @__PURE__ */ jsx("span", {
                className: "mt-2 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700",
                children: "Private Runner"
              })]
            }), /* @__PURE__ */ jsx("nav", {
              className: "space-y-1",
              children: sidebarNavItems$1.map((item) => {
                const isActive = location.pathname === item.href;
                return /* @__PURE__ */ jsxs(Link, {
                  to: item.href,
                  className: `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`,
                  children: [item.icon === "user" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    })
                  }), item.icon === "running" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M13 10V3L4 14h7v7l9-11h-7z"
                    })
                  }), item.icon === "share" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    })
                  }), item.icon === "settings" && /* @__PURE__ */ jsxs("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: [/* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    }), /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    })]
                  }), item.name]
                }, item.name);
              })
            })]
          })
        }), /* @__PURE__ */ jsxs("main", {
          className: "flex-1 min-w-0",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "mb-6",
            children: [/* @__PURE__ */ jsx("h1", {
              className: "font-display text-2xl font-bold text-gray-900",
              children: "Personal information"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-1 text-gray-500",
              children: "Manage your personal details and how others see you on runoot"
            })]
          }), actionData && "success" in actionData && actionData.success && /* @__PURE__ */ jsxs("div", {
            className: "mb-6 rounded-xl bg-success-50 p-4 text-sm text-success-700 flex items-center gap-2",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-5 w-5",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M5 13l4 4L19 7"
              })
            }), "message" in actionData ? actionData.message : ""]
          }), actionData && "error" in actionData && actionData.error && /* @__PURE__ */ jsxs("div", {
            className: "mb-6 rounded-xl bg-alert-50 p-4 text-sm text-alert-700 flex items-center gap-2",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-5 w-5",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              })
            }), actionData.error]
          }), /* @__PURE__ */ jsxs(Form, {
            method: "post",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "grid grid-cols-1 md:grid-cols-2 gap-4",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "Full name"
                }), /* @__PURE__ */ jsx("input", {
                  name: "fullName",
                  type: "text",
                  defaultValue: user.full_name || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "Enter your name",
                  required: true
                })]
              }), /* @__PURE__ */ jsx("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5",
                children: /* @__PURE__ */ jsxs("div", {
                  className: "flex items-start justify-between",
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "flex-1",
                    children: [/* @__PURE__ */ jsx("label", {
                      className: "text-sm font-medium text-gray-500",
                      children: "Email address"
                    }), /* @__PURE__ */ jsx("p", {
                      className: "mt-1 text-gray-900 font-medium",
                      children: user.email
                    })]
                  }), /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5 text-gray-300",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    })
                  })]
                })
              }), /* @__PURE__ */ jsx("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5",
                children: /* @__PURE__ */ jsxs("div", {
                  className: "flex items-start justify-between",
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "flex-1",
                    children: [/* @__PURE__ */ jsxs("label", {
                      className: "text-sm font-medium text-gray-500",
                      children: ["Phone number ", /* @__PURE__ */ jsx("span", {
                        className: "text-gray-400",
                        children: "(not visible)"
                      })]
                    }), /* @__PURE__ */ jsx("p", {
                      className: "mt-1 text-gray-900 font-medium",
                      children: user.phone || "Not set"
                    })]
                  }), /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5 text-gray-300",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    })
                  })]
                })
              }), /* @__PURE__ */ jsx("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5",
                children: /* @__PURE__ */ jsxs("div", {
                  className: "flex items-start justify-between",
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "flex-1",
                    children: [/* @__PURE__ */ jsx("label", {
                      className: "text-sm font-medium text-gray-500",
                      children: "Account type"
                    }), /* @__PURE__ */ jsx("p", {
                      className: "mt-1 text-gray-900 font-medium",
                      children: "Private Runner"
                    })]
                  }), /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5 text-gray-300",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    })
                  })]
                })
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "Country"
                }), /* @__PURE__ */ jsx("input", {
                  name: "country",
                  type: "text",
                  defaultValue: user.country || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "Italy"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "City"
                }), /* @__PURE__ */ jsx("input", {
                  name: "city",
                  type: "text",
                  defaultValue: user.city || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "Milan"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors md:col-span-2",
                children: [/* @__PURE__ */ jsx("label", {
                  className: "text-sm font-medium text-gray-500",
                  children: "About me"
                }), /* @__PURE__ */ jsx("textarea", {
                  name: "bio",
                  rows: 3,
                  defaultValue: user.bio || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none resize-none",
                  placeholder: "Tell others about yourself and your running journey..."
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-2 text-xs text-gray-400",
                  children: "Brief description visible to other users"
                })]
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "mt-6",
              children: /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "btn-primary px-8",
                children: "Save Changes"
              })
            })]
          })]
        })]
      })
    })]
  });
});
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$o,
  default: profile__index,
  loader: loader$t,
  meta: meta$s
}, Symbol.toStringTag, { value: "Module" }));
const meta$r = () => {
  return [{
    title: "Company Profile - runoot"
  }];
};
async function loader$s({
  request
}) {
  const user = await requireUser(request);
  if (user.user_type === "private") {
    return redirect("/profile/runner");
  }
  return {
    user
  };
}
async function action$n({
  request
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const fullName = formData.get("fullName");
  const companyName = formData.get("companyName");
  const phone = formData.get("phone");
  const bio = formData.get("bio");
  const country = formData.get("country");
  const city = formData.get("city");
  const website = formData.get("website");
  const languages = formData.get("languages");
  const yearsExperience = formData.get("yearsExperience");
  const specialties = formData.get("specialties");
  const instagram = formData.get("instagram");
  const facebook = formData.get("facebook");
  const linkedin = formData.get("linkedin");
  if (typeof fullName !== "string" || !fullName) {
    return data({
      error: "Full name is required"
    }, {
      status: 400
    });
  }
  if (typeof companyName !== "string" || !companyName) {
    return data({
      error: "Company name is required"
    }, {
      status: 400
    });
  }
  const updateData = {
    full_name: fullName,
    company_name: companyName,
    phone: phone || null,
    bio: bio || null,
    country: country || null,
    city: city || null,
    website: website || null,
    languages: languages || null,
    years_experience: yearsExperience ? parseInt(yearsExperience) : null,
    specialties: specialties || null,
    instagram: instagram || null,
    facebook: facebook || null,
    linkedin: linkedin || null
  };
  const {
    error
  } = await supabase.from("profiles").update(updateData).eq("id", user.id);
  if (error) {
    return data({
      error: error.message
    }, {
      status: 400
    });
  }
  return data({
    success: true,
    message: "Profile updated successfully!"
  });
}
const profile_agency = UNSAFE_withComponentProps(function OperatorProfile() {
  const {
    user
  } = useLoaderData();
  const actionData = useActionData();
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-3xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs("button", {
        onClick: () => window.history.back(),
        className: "mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors",
        children: [/* @__PURE__ */ jsx("svg", {
          className: "w-5 h-5",
          fill: "none",
          stroke: "currentColor",
          viewBox: "0 0 24 24",
          children: /* @__PURE__ */ jsx("path", {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 2,
            d: "M15 19l-7-7 7-7"
          })
        }), /* @__PURE__ */ jsx("span", {
          className: "text-sm font-medium",
          children: "Back"
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "mb-8",
        children: [/* @__PURE__ */ jsx("h1", {
          className: "font-display text-3xl font-bold text-gray-900",
          children: "Company Profile"
        }), /* @__PURE__ */ jsx("p", {
          className: "mt-2 text-gray-600",
          children: "Manage your business information and build trust with buyers"
        })]
      }), /* @__PURE__ */ jsx("div", {
        className: "card p-6",
        children: /* @__PURE__ */ jsxs(Form, {
          method: "post",
          className: "space-y-6",
          children: [actionData && "success" in actionData && actionData.success && /* @__PURE__ */ jsx("div", {
            className: "rounded-lg bg-success-50 p-4 text-sm text-success-700",
            children: "message" in actionData ? actionData.message : ""
          }), actionData && "error" in actionData && actionData.error && /* @__PURE__ */ jsx("div", {
            className: "rounded-lg bg-alert-50 p-4 text-sm text-alert-700",
            children: actionData.error
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("h2", {
              className: "font-display text-lg font-semibold text-gray-900 mb-4",
              children: "Account Information"
            }), /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "email",
                  className: "label",
                  children: "Email address"
                }), /* @__PURE__ */ jsx("input", {
                  id: "email",
                  type: "email",
                  value: user.email,
                  disabled: true,
                  className: "input bg-gray-50 cursor-not-allowed"
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-1 text-xs text-gray-500",
                  children: "Email cannot be changed"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  className: "label",
                  children: "Account type"
                }), /* @__PURE__ */ jsx("div", {
                  className: "input bg-gray-50 cursor-not-allowed",
                  children: "Tour Operator"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "rounded-lg bg-gray-50 p-4 border border-gray-200",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "flex items-center gap-2",
                  children: user.is_verified ? /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsx("svg", {
                      className: "h-5 w-5 text-brand-500",
                      fill: "currentColor",
                      viewBox: "0 0 20 20",
                      children: /* @__PURE__ */ jsx("path", {
                        fillRule: "evenodd",
                        d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                        clipRule: "evenodd"
                      })
                    }), /* @__PURE__ */ jsx("span", {
                      className: "text-sm font-medium text-gray-900",
                      children: "Verified Company"
                    })]
                  }) : /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsx("svg", {
                      className: "h-5 w-5 text-gray-400",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      })
                    }), /* @__PURE__ */ jsx("span", {
                      className: "text-sm font-medium text-gray-900",
                      children: "Not Verified"
                    })]
                  })
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-2 text-xs text-gray-600",
                  children: user.is_verified ? "Your company has been verified. Buyers can trust your listings." : "Complete your profile and contact support to verify your company and gain buyer trust."
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "pt-6 border-t border-gray-200",
            children: [/* @__PURE__ */ jsx("h2", {
              className: "font-display text-lg font-semibold text-gray-900 mb-4",
              children: "Company Information"
            }), /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "companyName",
                  className: "label",
                  children: "Company name *"
                }), /* @__PURE__ */ jsx("input", {
                  id: "companyName",
                  name: "companyName",
                  type: "text",
                  defaultValue: user.company_name || "",
                  className: "input",
                  required: true
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "fullName",
                  className: "label",
                  children: "Contact person *"
                }), /* @__PURE__ */ jsx("input", {
                  id: "fullName",
                  name: "fullName",
                  type: "text",
                  defaultValue: user.full_name || "",
                  className: "input",
                  required: true
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "phone",
                  className: "label",
                  children: "Phone number"
                }), /* @__PURE__ */ jsx("input", {
                  id: "phone",
                  name: "phone",
                  type: "tel",
                  defaultValue: user.phone || "",
                  className: "input",
                  placeholder: "+39 123 456 7890"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "bio",
                  className: "label",
                  children: "Company description"
                }), /* @__PURE__ */ jsx("textarea", {
                  id: "bio",
                  name: "bio",
                  rows: 4,
                  className: "input",
                  defaultValue: user.bio || "",
                  placeholder: "Tell buyers about your company, experience, and services..."
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-1 text-xs text-gray-500",
                  children: "Brief description visible to potential buyers"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    htmlFor: "country",
                    className: "label",
                    children: "Country"
                  }), /* @__PURE__ */ jsx("input", {
                    id: "country",
                    name: "country",
                    type: "text",
                    className: "input",
                    defaultValue: user.country || "",
                    placeholder: "Italy"
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    htmlFor: "city",
                    className: "label",
                    children: "City"
                  }), /* @__PURE__ */ jsx("input", {
                    id: "city",
                    name: "city",
                    type: "text",
                    className: "input",
                    defaultValue: user.city || "",
                    placeholder: "Milan"
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "website",
                  className: "label",
                  children: "Company website"
                }), /* @__PURE__ */ jsx("input", {
                  id: "website",
                  name: "website",
                  type: "url",
                  className: "input",
                  defaultValue: user.website || "",
                  placeholder: "https://www.yourcompany.com"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "languages",
                  className: "label",
                  children: "Languages spoken"
                }), /* @__PURE__ */ jsx("input", {
                  id: "languages",
                  name: "languages",
                  type: "text",
                  className: "input",
                  defaultValue: user.languages || "",
                  placeholder: "Italian, English, Spanish"
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-1 text-xs text-gray-500",
                  children: "Separate with commas"
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "pt-6 border-t border-gray-200",
            children: [/* @__PURE__ */ jsx("h2", {
              className: "font-display text-lg font-semibold text-gray-900 mb-4",
              children: "Business Details"
            }), /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "yearsExperience",
                  className: "label",
                  children: "Years in business"
                }), /* @__PURE__ */ jsx("input", {
                  id: "yearsExperience",
                  name: "yearsExperience",
                  type: "number",
                  min: "0",
                  className: "input",
                  defaultValue: user.years_experience || "",
                  placeholder: "5"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "specialties",
                  className: "label",
                  children: "Specialties / Services"
                }), /* @__PURE__ */ jsx("textarea", {
                  id: "specialties",
                  name: "specialties",
                  rows: 3,
                  className: "input",
                  defaultValue: user.specialties || "",
                  placeholder: "Marathon packages, accommodation booking, group tours, race registration assistance..."
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "pt-6 border-t border-gray-200",
            children: [/* @__PURE__ */ jsx("h2", {
              className: "font-display text-lg font-semibold text-gray-900 mb-4",
              children: "Social Media"
            }), /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "instagram",
                  className: "label",
                  children: "Instagram"
                }), /* @__PURE__ */ jsxs("div", {
                  className: "relative",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500",
                    children: "@"
                  }), /* @__PURE__ */ jsx("input", {
                    id: "instagram",
                    name: "instagram",
                    type: "text",
                    className: "input pl-8",
                    defaultValue: user.instagram || "",
                    placeholder: "companyname"
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "facebook",
                  className: "label",
                  children: "Facebook Page"
                }), /* @__PURE__ */ jsx("input", {
                  id: "facebook",
                  name: "facebook",
                  type: "url",
                  className: "input",
                  defaultValue: user.facebook || "",
                  placeholder: "https://facebook.com/yourcompany"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "linkedin",
                  className: "label",
                  children: "LinkedIn Company Page"
                }), /* @__PURE__ */ jsx("input", {
                  id: "linkedin",
                  name: "linkedin",
                  type: "url",
                  className: "input",
                  defaultValue: user.linkedin || "",
                  placeholder: "https://linkedin.com/company/yourcompany"
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex gap-4 pt-4 border-t border-gray-200",
            children: [/* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "btn-primary",
              children: "Save Changes"
            }), /* @__PURE__ */ jsx("a", {
              href: "/dashboard",
              className: "btn-secondary",
              children: "Cancel"
            })]
          })]
        })
      })]
    })]
  });
});
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$n,
  default: profile_agency,
  loader: loader$s,
  meta: meta$r
}, Symbol.toStringTag, { value: "Module" }));
const meta$q = () => {
  return [{
    title: "Social Media - runoot"
  }];
};
async function loader$r({
  request
}) {
  const user = await requireUser(request);
  if (user.user_type === "tour_operator") {
    return redirect("/profile/agency");
  }
  return {
    user
  };
}
async function action$m({
  request
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const instagram = formData.get("instagram");
  const strava = formData.get("strava");
  const facebook = formData.get("facebook");
  const linkedin = formData.get("linkedin");
  const website = formData.get("website");
  const updateData = {
    instagram: instagram || null,
    strava: strava || null,
    facebook: facebook || null,
    linkedin: linkedin || null,
    website: website || null
  };
  const {
    error
  } = await supabaseAdmin.from("profiles").update(updateData).eq("id", user.id);
  if (error) {
    return data({
      error: error.message
    }, {
      status: 400
    });
  }
  return data({
    success: true,
    message: "Social media links updated successfully!"
  });
}
const sidebarNavItems = [{
  name: "Personal information",
  href: "/profile",
  icon: "user"
}, {
  name: "Running Experience",
  href: "/profile/experience",
  icon: "running"
}, {
  name: "Social Media",
  href: "/profile/social",
  icon: "share"
}, {
  name: "Settings",
  href: "/profile/settings",
  icon: "settings"
}];
const profile_social = UNSAFE_withComponentProps(function SocialMedia() {
  const {
    user
  } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-screen bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsx("div", {
      className: "mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8",
      children: /* @__PURE__ */ jsxs("div", {
        className: "flex flex-col lg:flex-row gap-8",
        children: [/* @__PURE__ */ jsx("aside", {
          className: "lg:w-64 flex-shrink-0",
          children: /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-2xl border border-gray-200 p-6",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex flex-col items-center text-center mb-6",
              children: [/* @__PURE__ */ jsx("div", {
                className: "h-20 w-20 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-2xl font-bold mb-4",
                children: user.avatar_url ? /* @__PURE__ */ jsx("img", {
                  src: user.avatar_url,
                  alt: user.full_name || "User",
                  className: "h-20 w-20 rounded-full object-cover"
                }) : getInitials(user.full_name)
              }), /* @__PURE__ */ jsx("h2", {
                className: "font-display font-semibold text-gray-900 text-lg",
                children: user.full_name || "Your Name"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-500 mt-1",
                children: user.email
              }), /* @__PURE__ */ jsx("span", {
                className: "mt-2 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700",
                children: "Private Runner"
              })]
            }), /* @__PURE__ */ jsx("nav", {
              className: "space-y-1",
              children: sidebarNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                return /* @__PURE__ */ jsxs(Link, {
                  to: item.href,
                  className: `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`,
                  children: [item.icon === "user" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    })
                  }), item.icon === "running" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M13 10V3L4 14h7v7l9-11h-7z"
                    })
                  }), item.icon === "share" && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    })
                  }), item.icon === "settings" && /* @__PURE__ */ jsxs("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: [/* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    }), /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    })]
                  }), item.name]
                }, item.name);
              })
            })]
          })
        }), /* @__PURE__ */ jsxs("main", {
          className: "flex-1 min-w-0",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "mb-6",
            children: [/* @__PURE__ */ jsx("h1", {
              className: "font-display text-2xl font-bold text-gray-900",
              children: "Social Media"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-1 text-gray-500",
              children: "Connect your social profiles to help others find you"
            })]
          }), actionData && "success" in actionData && actionData.success && /* @__PURE__ */ jsxs("div", {
            className: "mb-6 rounded-xl bg-success-50 p-4 text-sm text-success-700 flex items-center gap-2",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-5 w-5",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M5 13l4 4L19 7"
              })
            }), "message" in actionData ? actionData.message : ""]
          }), actionData && "error" in actionData && actionData.error && /* @__PURE__ */ jsxs("div", {
            className: "mb-6 rounded-xl bg-alert-50 p-4 text-sm text-alert-700 flex items-center gap-2",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-5 w-5",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              })
            }), actionData.error]
          }), /* @__PURE__ */ jsxs(Form, {
            method: "post",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "grid grid-cols-1 md:grid-cols-2 gap-4",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "text-sm font-medium text-gray-500 flex items-center gap-2",
                  children: [/* @__PURE__ */ jsx("svg", {
                    className: "h-4 w-4",
                    viewBox: "0 0 24 24",
                    fill: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
                    })
                  }), "Instagram"]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "mt-1 flex items-center",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-gray-400 mr-1",
                    children: "@"
                  }), /* @__PURE__ */ jsx("input", {
                    name: "instagram",
                    type: "text",
                    defaultValue: user.instagram || "",
                    className: "block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                    placeholder: "username"
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "text-sm font-medium text-gray-500 flex items-center gap-2",
                  children: [/* @__PURE__ */ jsx("svg", {
                    className: "h-4 w-4",
                    viewBox: "0 0 24 24",
                    fill: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      d: "M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"
                    })
                  }), "Strava"]
                }), /* @__PURE__ */ jsx("input", {
                  name: "strava",
                  type: "url",
                  defaultValue: user.strava || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "https://strava.com/athletes/..."
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "text-sm font-medium text-gray-500 flex items-center gap-2",
                  children: [/* @__PURE__ */ jsx("svg", {
                    className: "h-4 w-4",
                    viewBox: "0 0 24 24",
                    fill: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                    })
                  }), "Facebook"]
                }), /* @__PURE__ */ jsx("input", {
                  name: "facebook",
                  type: "url",
                  defaultValue: user.facebook || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "https://facebook.com/yourprofile"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors",
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "text-sm font-medium text-gray-500 flex items-center gap-2",
                  children: [/* @__PURE__ */ jsx("svg", {
                    className: "h-4 w-4",
                    viewBox: "0 0 24 24",
                    fill: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
                    })
                  }), "LinkedIn"]
                }), /* @__PURE__ */ jsx("input", {
                  name: "linkedin",
                  type: "url",
                  defaultValue: user.linkedin || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "https://linkedin.com/in/yourprofile"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors md:col-span-2",
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "text-sm font-medium text-gray-500 flex items-center gap-2",
                  children: [/* @__PURE__ */ jsx("svg", {
                    className: "h-4 w-4",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    })
                  }), "Personal website"]
                }), /* @__PURE__ */ jsx("input", {
                  name: "website",
                  type: "url",
                  defaultValue: user.website || "",
                  className: "mt-1 block w-full text-gray-900 font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none",
                  placeholder: "https://yourwebsite.com"
                })]
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "mt-6",
              children: /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "btn-primary px-8",
                children: "Save Changes"
              })
            })]
          })]
        })]
      })
    })]
  });
});
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$m,
  default: profile_social,
  loader: loader$r,
  meta: meta$q
}, Symbol.toStringTag, { value: "Module" }));
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const TRANSLATE_API_URL = "https://translation.googleapis.com/language/translate/v2";
async function translateText(text, targetLanguage, sourceLanguage) {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    console.error("GOOGLE_TRANSLATE_API_KEY not configured");
    return null;
  }
  if (!text || text.trim().length < 2) {
    return null;
  }
  try {
    const params = new URLSearchParams({
      key: GOOGLE_TRANSLATE_API_KEY,
      q: text,
      target: targetLanguage,
      format: "text"
    });
    if (sourceLanguage) ;
    const response = await fetch(`${TRANSLATE_API_URL}?${params}`, {
      method: "POST"
    });
    if (!response.ok) {
      const error = await response.json();
      console.error("Google Translate API error:", error);
      return null;
    }
    const data2 = await response.json();
    const translation = data2.data.translations[0];
    return {
      translatedText: translation.translatedText,
      detectedSourceLanguage: translation.detectedSourceLanguage || sourceLanguage || "unknown"
    };
  } catch (error) {
    console.error("Translation error:", error);
    return null;
  }
}
function normalizeLanguageCode(browserLanguage) {
  return browserLanguage.split("-")[0].toLowerCase();
}
function isSameLanguage(lang1, lang2) {
  if (!lang1 || !lang2) return false;
  return normalizeLanguageCode(lang1) === normalizeLanguageCode(lang2);
}
async function action$l({
  request
}) {
  const user = await getUser(request);
  if (!user) {
    return data({
      error: "Unauthorized"
    }, {
      status: 401
    });
  }
  if (request.method !== "POST") {
    return data({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  try {
    const body = await request.json();
    const {
      messageId,
      targetLanguage
    } = body;
    if (!messageId || !targetLanguage) {
      return data({
        error: "Missing messageId or targetLanguage"
      }, {
        status: 400
      });
    }
    const {
      data: message,
      error: fetchError
    } = await supabaseAdmin.from("messages").select("id, content, detected_language, translated_content, translated_to, conversation_id").eq("id", messageId).single();
    if (fetchError || !message) {
      return data({
        error: "Message not found"
      }, {
        status: 404
      });
    }
    const {
      data: conversation
    } = await supabaseAdmin.from("conversations").select("participant_1, participant_2").eq("id", message.conversation_id).single();
    if (!conversation || conversation.participant_1 !== user.id && conversation.participant_2 !== user.id) {
      return data({
        error: "Unauthorized"
      }, {
        status: 403
      });
    }
    if (message.translated_content && message.translated_to === targetLanguage) {
      return data({
        translatedContent: message.translated_content,
        detectedLanguage: message.detected_language,
        cached: true
      });
    }
    const translation = await translateText(message.content, targetLanguage);
    if (!translation) {
      return data({
        error: "Translation failed"
      }, {
        status: 500
      });
    }
    if (isSameLanguage(translation.detectedSourceLanguage, targetLanguage)) {
      await supabaseAdmin.from("messages").update({
        detected_language: translation.detectedSourceLanguage
      }).eq("id", messageId);
      return data({
        translatedContent: null,
        detectedLanguage: translation.detectedSourceLanguage,
        sameLanguage: true
      });
    }
    const {
      error: updateError
    } = await supabaseAdmin.from("messages").update({
      detected_language: translation.detectedSourceLanguage,
      translated_content: translation.translatedText,
      translated_to: targetLanguage
    }).eq("id", messageId);
    if (updateError) {
      console.error("Error saving translation:", updateError);
    }
    return data({
      translatedContent: translation.translatedText,
      detectedLanguage: translation.detectedSourceLanguage,
      cached: false
    });
  } catch (error) {
    console.error("Translation API error:", error);
    return data({
      error: "Internal server error"
    }, {
      status: 500
    });
  }
}
const route14 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$l
}, Symbol.toStringTag, { value: "Module" }));
const meta$p = () => {
  return [{
    title: "Cookie Policy | Runoot"
  }, {
    name: "description",
    content: "Informativa sui cookie di Runoot - Scopri come utilizziamo i cookie e come gestire le tue preferenze."
  }];
};
const cookiePolicy = UNSAFE_withComponentProps(function CookiePolicy() {
  const lastUpdated = "29 Gennaio 2025";
  const websiteUrl = "https://runstay.vercel.app";
  const companyEmail = "privacy@runoot.com";
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-screen bg-gray-50",
    children: [/* @__PURE__ */ jsx("header", {
      className: "bg-white shadow-sm",
      children: /* @__PURE__ */ jsxs("div", {
        className: "max-w-4xl mx-auto px-4 py-6",
        children: [/* @__PURE__ */ jsx("a", {
          href: "/",
          className: "text-brand-600 hover:text-brand-700 text-sm",
          children: "← Torna alla Home"
        }), /* @__PURE__ */ jsx("h1", {
          className: "text-3xl font-bold text-gray-900 mt-4",
          children: "Cookie Policy"
        }), /* @__PURE__ */ jsxs("p", {
          className: "text-gray-500 mt-2",
          children: ["Ultimo aggiornamento: ", lastUpdated]
        })]
      })
    }), /* @__PURE__ */ jsxs("main", {
      className: "max-w-4xl mx-auto px-4 py-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-lg shadow-sm p-8 space-y-8",
        children: [/* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "1. Introduzione"
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed",
            children: ["La presente Cookie Policy descrive come ", /* @__PURE__ */ jsx("strong", {
              children: "Runoot"
            }), ` (di seguito "noi", "nostro" o "Sito") utilizza i cookie e tecnologie simili quando visiti il nostro sito web disponibile all'indirizzo`, " ", /* @__PURE__ */ jsx("a", {
              href: websiteUrl,
              className: "text-brand-600 hover:underline",
              children: websiteUrl
            }), "."]
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: "Questa policy è conforme al Regolamento (UE) 2016/679 (GDPR), alla Direttiva ePrivacy 2002/58/CE e successive modifiche, nonché alle Linee Guida del Garante Privacy italiano sui cookie."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "2. Cosa sono i Cookie"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "I cookie sono piccoli file di testo che vengono memorizzati sul tuo dispositivo (computer, tablet o smartphone) quando visiti un sito web. I cookie permettono al sito di riconoscerti e ricordare le tue preferenze (come la lingua, le dimensioni dei caratteri e altre impostazioni di visualizzazione) per un determinato periodo di tempo."
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: 'I cookie possono essere "di sessione" (temporanei, eliminati alla chiusura del browser) o "persistenti" (rimangono sul dispositivo per un periodo definito o fino alla loro cancellazione manuale).'
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "3. Tipologie di Cookie Utilizzati"
          }), /* @__PURE__ */ jsxs("div", {
            className: "mt-6",
            children: [/* @__PURE__ */ jsx("h3", {
              className: "text-lg font-medium text-gray-900 mb-3",
              children: "3.1 Cookie Tecnici Necessari"
            }), /* @__PURE__ */ jsx("p", {
              className: "text-gray-700 leading-relaxed mb-4",
              children: "Questi cookie sono essenziali per il funzionamento del Sito e non possono essere disattivati. Vengono impostati in risposta ad azioni da te effettuate, come l'impostazione delle preferenze sulla privacy, l'accesso o la compilazione di moduli."
            }), /* @__PURE__ */ jsx("div", {
              className: "overflow-x-auto",
              children: /* @__PURE__ */ jsxs("table", {
                className: "w-full border-collapse border border-gray-200 text-sm",
                children: [/* @__PURE__ */ jsx("thead", {
                  className: "bg-gray-50",
                  children: /* @__PURE__ */ jsxs("tr", {
                    children: [/* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Nome Cookie"
                    }), /* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Fornitore"
                    }), /* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Scopo"
                    }), /* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Durata"
                    })]
                  })
                }), /* @__PURE__ */ jsxs("tbody", {
                  children: [/* @__PURE__ */ jsxs("tr", {
                    children: [/* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "sb-*-auth-token"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Supabase"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Gestione dell'autenticazione e della sessione utente. Necessario per mantenere l'utente connesso e garantire la sicurezza dell'account."
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Sessione / 1 anno"
                    })]
                  }), /* @__PURE__ */ jsxs("tr", {
                    className: "bg-gray-50",
                    children: [/* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "sb-*-auth-token-code-verifier"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Supabase"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Verifica del codice durante il flusso di autenticazione OAuth (PKCE)."
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Sessione"
                    })]
                  }), /* @__PURE__ */ jsxs("tr", {
                    children: [/* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "__session"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Runoot"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Cookie di sessione per memorizzare le informazioni dell'utente durante la navigazione."
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Sessione"
                    })]
                  }), /* @__PURE__ */ jsxs("tr", {
                    className: "bg-gray-50",
                    children: [/* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "cookie_consent"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Runoot"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Memorizza le tue preferenze sui cookie per non mostrare nuovamente il banner."
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "12 mesi"
                    })]
                  })]
                })]
              })
            }), /* @__PURE__ */ jsx("p", {
              className: "text-gray-600 text-sm mt-3 italic",
              children: "Base giuridica: Art. 6(1)(f) GDPR - Legittimo interesse per il funzionamento del servizio."
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "mt-8",
            children: [/* @__PURE__ */ jsx("h3", {
              className: "text-lg font-medium text-gray-900 mb-3",
              children: "3.2 Cookie di Terze Parti per l'Autenticazione"
            }), /* @__PURE__ */ jsx("p", {
              className: "text-gray-700 leading-relaxed mb-4",
              children: "Se scegli di accedere tramite Google, verranno utilizzati cookie di terze parti necessari per completare il processo di autenticazione OAuth."
            }), /* @__PURE__ */ jsx("div", {
              className: "overflow-x-auto",
              children: /* @__PURE__ */ jsxs("table", {
                className: "w-full border-collapse border border-gray-200 text-sm",
                children: [/* @__PURE__ */ jsx("thead", {
                  className: "bg-gray-50",
                  children: /* @__PURE__ */ jsxs("tr", {
                    children: [/* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Nome Cookie"
                    }), /* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Fornitore"
                    }), /* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Scopo"
                    }), /* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Privacy Policy"
                    })]
                  })
                }), /* @__PURE__ */ jsx("tbody", {
                  children: /* @__PURE__ */ jsxs("tr", {
                    children: [/* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Vari cookie Google"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Google Ireland Ltd"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Autenticazione tramite Google OAuth 2.0. Utilizzati solo se scegli di accedere con Google."
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3",
                      children: /* @__PURE__ */ jsx("a", {
                        href: "https://policies.google.com/privacy",
                        target: "_blank",
                        rel: "noopener noreferrer",
                        className: "text-brand-600 hover:underline",
                        children: "Privacy Policy Google"
                      })
                    })]
                  })
                })]
              })
            }), /* @__PURE__ */ jsx("p", {
              className: "text-gray-600 text-sm mt-3 italic",
              children: "Base giuridica: Art. 6(1)(a) GDPR - Consenso esplicito (attivato dalla scelta dell'utente di accedere con Google)."
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "mt-8",
            children: [/* @__PURE__ */ jsx("h3", {
              className: "text-lg font-medium text-gray-900 mb-3",
              children: "3.3 Cookie Analitici (Opzionali)"
            }), /* @__PURE__ */ jsx("p", {
              className: "text-gray-700 leading-relaxed mb-4",
              children: "Potremmo utilizzare cookie analitici per comprendere come i visitatori interagiscono con il Sito. Questi cookie raccolgono informazioni in forma aggregata e anonima."
            }), /* @__PURE__ */ jsx("div", {
              className: "overflow-x-auto",
              children: /* @__PURE__ */ jsxs("table", {
                className: "w-full border-collapse border border-gray-200 text-sm",
                children: [/* @__PURE__ */ jsx("thead", {
                  className: "bg-gray-50",
                  children: /* @__PURE__ */ jsxs("tr", {
                    children: [/* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Nome Cookie"
                    }), /* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Fornitore"
                    }), /* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Scopo"
                    }), /* @__PURE__ */ jsx("th", {
                      className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                      children: "Durata"
                    })]
                  })
                }), /* @__PURE__ */ jsx("tbody", {
                  children: /* @__PURE__ */ jsxs("tr", {
                    children: [/* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "_vercel_*"
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Vercel Inc."
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Analytics di base per monitorare le prestazioni del sito (se Vercel Analytics è attivo)."
                    }), /* @__PURE__ */ jsx("td", {
                      className: "border border-gray-200 px-4 py-3 text-gray-700",
                      children: "Sessione"
                    })]
                  })
                })]
              })
            }), /* @__PURE__ */ jsx("p", {
              className: "text-gray-600 text-sm mt-3 italic",
              children: "Base giuridica: Art. 6(1)(a) GDPR - Consenso. Questi cookie vengono installati solo previo tuo consenso."
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "4. Come Gestire i Cookie"
          }), /* @__PURE__ */ jsxs("div", {
            className: "space-y-4",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h3", {
                className: "text-lg font-medium text-gray-900 mb-2",
                children: "4.1 Banner dei Cookie"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-700 leading-relaxed",
                children: 'Al primo accesso al Sito, ti verrà mostrato un banner che ti permette di accettare o rifiutare i cookie non necessari. Puoi modificare le tue preferenze in qualsiasi momento cliccando sul link "Gestisci Cookie" presente nel footer del sito.'
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("h3", {
                className: "text-lg font-medium text-gray-900 mb-2",
                children: "4.2 Impostazioni del Browser"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-700 leading-relaxed",
                children: "Puoi anche gestire i cookie attraverso le impostazioni del tuo browser. Di seguito i link alle istruzioni dei principali browser:"
              }), /* @__PURE__ */ jsxs("ul", {
                className: "mt-3 space-y-2",
                children: [/* @__PURE__ */ jsx("li", {
                  children: /* @__PURE__ */ jsx("a", {
                    href: "https://support.google.com/chrome/answer/95647",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "text-brand-600 hover:underline",
                    children: "→ Google Chrome"
                  })
                }), /* @__PURE__ */ jsx("li", {
                  children: /* @__PURE__ */ jsx("a", {
                    href: "https://support.mozilla.org/it/kb/protezione-antitracciamento-avanzata-firefox-desktop",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "text-brand-600 hover:underline",
                    children: "→ Mozilla Firefox"
                  })
                }), /* @__PURE__ */ jsx("li", {
                  children: /* @__PURE__ */ jsx("a", {
                    href: "https://support.apple.com/it-it/guide/safari/sfri11471/mac",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "text-brand-600 hover:underline",
                    children: "→ Safari"
                  })
                }), /* @__PURE__ */ jsx("li", {
                  children: /* @__PURE__ */ jsx("a", {
                    href: "https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "text-brand-600 hover:underline",
                    children: "→ Microsoft Edge"
                  })
                })]
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-600 text-sm mt-4 italic",
                children: "Nota: La disabilitazione dei cookie tecnici necessari potrebbe compromettere il funzionamento di alcune parti del Sito."
              })]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "5. Trasferimento dei Dati"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Alcuni dei nostri fornitori di servizi potrebbero essere situati al di fuori dell'Unione Europea. In tali casi, ci assicuriamo che il trasferimento dei dati avvenga in conformità con il GDPR, attraverso:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "mt-3 space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Clausole contrattuali standard approvate dalla Commissione Europea"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Decisioni di adeguatezza della Commissione Europea"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "EU-US Data Privacy Framework (per fornitori statunitensi certificati)"]
            })]
          }), /* @__PURE__ */ jsx("div", {
            className: "mt-4 overflow-x-auto",
            children: /* @__PURE__ */ jsxs("table", {
              className: "w-full border-collapse border border-gray-200 text-sm",
              children: [/* @__PURE__ */ jsx("thead", {
                className: "bg-gray-50",
                children: /* @__PURE__ */ jsxs("tr", {
                  children: [/* @__PURE__ */ jsx("th", {
                    className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                    children: "Fornitore"
                  }), /* @__PURE__ */ jsx("th", {
                    className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                    children: "Sede"
                  }), /* @__PURE__ */ jsx("th", {
                    className: "border border-gray-200 px-4 py-3 text-left font-medium text-gray-900",
                    children: "Meccanismo di Trasferimento"
                  })]
                })
              }), /* @__PURE__ */ jsxs("tbody", {
                children: [/* @__PURE__ */ jsxs("tr", {
                  children: [/* @__PURE__ */ jsx("td", {
                    className: "border border-gray-200 px-4 py-3 text-gray-700",
                    children: "Supabase Inc."
                  }), /* @__PURE__ */ jsx("td", {
                    className: "border border-gray-200 px-4 py-3 text-gray-700",
                    children: "USA"
                  }), /* @__PURE__ */ jsx("td", {
                    className: "border border-gray-200 px-4 py-3 text-gray-700",
                    children: "EU-US Data Privacy Framework / SCCs"
                  })]
                }), /* @__PURE__ */ jsxs("tr", {
                  className: "bg-gray-50",
                  children: [/* @__PURE__ */ jsx("td", {
                    className: "border border-gray-200 px-4 py-3 text-gray-700",
                    children: "Vercel Inc."
                  }), /* @__PURE__ */ jsx("td", {
                    className: "border border-gray-200 px-4 py-3 text-gray-700",
                    children: "USA"
                  }), /* @__PURE__ */ jsx("td", {
                    className: "border border-gray-200 px-4 py-3 text-gray-700",
                    children: "EU-US Data Privacy Framework / SCCs"
                  })]
                }), /* @__PURE__ */ jsxs("tr", {
                  children: [/* @__PURE__ */ jsx("td", {
                    className: "border border-gray-200 px-4 py-3 text-gray-700",
                    children: "Google Ireland Ltd"
                  }), /* @__PURE__ */ jsx("td", {
                    className: "border border-gray-200 px-4 py-3 text-gray-700",
                    children: "Irlanda (UE)"
                  }), /* @__PURE__ */ jsx("td", {
                    className: "border border-gray-200 px-4 py-3 text-gray-700",
                    children: "N/A (all'interno dell'UE)"
                  })]
                })]
              })]
            })
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "6. I Tuoi Diritti"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "In conformità con il GDPR, hai il diritto di:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "mt-3 space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsx("strong", {
                children: "Accesso:"
              }), " ottenere informazioni sui dati che trattiamo"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsx("strong", {
                children: "Rettifica:"
              }), " correggere dati inesatti o incompleti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsx("strong", {
                children: "Cancellazione:"
              }), " richiedere la cancellazione dei tuoi dati"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsx("strong", {
                children: "Limitazione:"
              }), " limitare il trattamento dei tuoi dati"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsx("strong", {
                children: "Portabilità:"
              }), " ricevere i tuoi dati in formato strutturato"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsx("strong", {
                children: "Opposizione:"
              }), " opporti al trattamento basato sul legittimo interesse"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsx("strong", {
                children: "Revoca del consenso:"
              }), " ritirare il consenso in qualsiasi momento"]
            })]
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed mt-4",
            children: ["Per esercitare questi diritti, contattaci all'indirizzo:", " ", /* @__PURE__ */ jsx("a", {
              href: `mailto:${companyEmail}`,
              className: "text-brand-600 hover:underline",
              children: companyEmail
            })]
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: ["Hai inoltre il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali:", " ", /* @__PURE__ */ jsx("a", {
              href: "https://www.garanteprivacy.it",
              target: "_blank",
              rel: "noopener noreferrer",
              className: "text-brand-600 hover:underline",
              children: "www.garanteprivacy.it"
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "7. Titolare del Trattamento"
          }), /* @__PURE__ */ jsx("div", {
            className: "bg-gray-50 rounded-lg p-4",
            children: /* @__PURE__ */ jsxs("p", {
              className: "text-gray-700",
              children: [/* @__PURE__ */ jsx("strong", {
                children: "Runoot"
              }), /* @__PURE__ */ jsx("br", {}), "[Inserire Ragione Sociale]", /* @__PURE__ */ jsx("br", {}), "[Inserire Indirizzo]", /* @__PURE__ */ jsx("br", {}), "[Inserire Partita IVA / Codice Fiscale]", /* @__PURE__ */ jsx("br", {}), "Email: ", /* @__PURE__ */ jsx("a", {
                href: `mailto:${companyEmail}`,
                className: "text-brand-600 hover:underline",
                children: companyEmail
              })]
            })
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "8. Modifiche alla Cookie Policy"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Ci riserviamo il diritto di modificare questa Cookie Policy in qualsiasi momento. Eventuali modifiche saranno pubblicate su questa pagina con indicazione della data di ultimo aggiornamento. Ti invitiamo a consultare periodicamente questa pagina per rimanere informato sulle nostre pratiche relative ai cookie."
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: "In caso di modifiche sostanziali, ti informeremo tramite un avviso ben visibile sul nostro Sito o, ove possibile, via email."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "9. Contatti"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Per qualsiasi domanda relativa a questa Cookie Policy o al trattamento dei tuoi dati personali, puoi contattarci a:"
          }), /* @__PURE__ */ jsx("div", {
            className: "mt-4 bg-brand-50 rounded-lg p-4 border border-brand-200",
            children: /* @__PURE__ */ jsxs("p", {
              className: "text-gray-700",
              children: ["📧 Email: ", /* @__PURE__ */ jsx("a", {
                href: `mailto:${companyEmail}`,
                className: "text-brand-600 hover:underline font-medium",
                children: companyEmail
              })]
            })
          })]
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "mt-8 text-center text-sm text-gray-500",
        children: [/* @__PURE__ */ jsx("a", {
          href: "/privacy-policy",
          className: "hover:text-brand-600",
          children: "Privacy Policy"
        }), /* @__PURE__ */ jsx("span", {
          className: "mx-2",
          children: "•"
        }), /* @__PURE__ */ jsx("a", {
          href: "/terms",
          className: "hover:text-brand-600",
          children: "Termini di Servizio"
        }), /* @__PURE__ */ jsx("span", {
          className: "mx-2",
          children: "•"
        }), /* @__PURE__ */ jsx("a", {
          href: "/",
          className: "hover:text-brand-600",
          children: "Torna alla Home"
        })]
      })]
    })]
  });
});
const route15 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: cookiePolicy,
  meta: meta$p
}, Symbol.toStringTag, { value: "Module" }));
const meta$o = () => {
  return [{
    title: "Notifications - Runoot"
  }];
};
async function loader$q({
  request
}) {
  const user = await requireUser(request);
  const {
    data: notifications2
  } = await supabaseAdmin.from("notifications").select("*").eq("user_id", user.id).order("created_at", {
    ascending: false
  }).limit(50);
  return {
    user,
    notifications: notifications2 || []
  };
}
async function action$k({
  request
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");
  switch (actionType) {
    case "markRead": {
      const notificationId = formData.get("notificationId");
      await supabaseAdmin.from("notifications").update({
        read_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", notificationId).eq("user_id", user.id);
      return data({
        success: true
      });
    }
    case "markAllRead": {
      await supabaseAdmin.from("notifications").update({
        read_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("user_id", user.id).is("read_at", null);
      return data({
        success: true
      });
    }
    default:
      return data({
        error: "Unknown action"
      }, {
        status: 400
      });
  }
}
const typeIcons = {
  referral_signup: {
    bg: "bg-brand-100",
    color: "text-brand-600",
    icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
  },
  referral_active: {
    bg: "bg-success-100",
    color: "text-success-600",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
  },
  tl_promoted: {
    bg: "bg-purple-100",
    color: "text-purple-600",
    icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
  },
  system: {
    bg: "bg-gray-100",
    color: "text-gray-600",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
  },
  listing_approved: {
    bg: "bg-success-100",
    color: "text-success-600",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
  },
  listing_rejected: {
    bg: "bg-alert-100",
    color: "text-alert-600",
    icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
  }
};
function timeAgo(dateStr) {
  const now = /* @__PURE__ */ new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1e3);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
const notifications = UNSAFE_withComponentProps(function Notifications() {
  const {
    notifications: notifications2
  } = useLoaderData();
  const unreadCount = notifications2.filter((n) => !n.read_at).length;
  return /* @__PURE__ */ jsxs("div", {
    className: "max-w-2xl mx-auto px-4 py-8",
    children: [/* @__PURE__ */ jsxs("div", {
      className: "flex items-center justify-between mb-6",
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h1", {
          className: "font-display text-2xl md:text-3xl font-bold text-gray-900",
          children: "Notifications"
        }), unreadCount > 0 && /* @__PURE__ */ jsxs("p", {
          className: "text-sm text-gray-500 mt-1",
          children: [unreadCount, " unread"]
        })]
      }), unreadCount > 0 && /* @__PURE__ */ jsxs(Form, {
        method: "post",
        children: [/* @__PURE__ */ jsx("input", {
          type: "hidden",
          name: "_action",
          value: "markAllRead"
        }), /* @__PURE__ */ jsx("button", {
          type: "submit",
          className: "text-sm text-brand-600 hover:text-brand-700 font-medium",
          children: "Mark all read"
        })]
      })]
    }), /* @__PURE__ */ jsx("div", {
      className: "bg-white rounded-xl border border-gray-200 overflow-hidden",
      children: /* @__PURE__ */ jsx("div", {
        className: "divide-y divide-gray-100",
        children: notifications2.length > 0 ? notifications2.map((notif) => {
          var _a;
          const typeStyle = typeIcons[notif.type] || typeIcons.system;
          const isUnread = !notif.read_at;
          return /* @__PURE__ */ jsxs("div", {
            className: `p-4 flex items-start gap-3 ${isUnread ? "bg-brand-50/30" : ""}`,
            children: [/* @__PURE__ */ jsx("div", {
              className: `w-9 h-9 rounded-full ${typeStyle.bg} flex items-center justify-center flex-shrink-0`,
              children: /* @__PURE__ */ jsx("svg", {
                className: `w-4.5 h-4.5 ${typeStyle.color}`,
                fill: "none",
                stroke: "currentColor",
                viewBox: "0 0 24 24",
                children: /* @__PURE__ */ jsx("path", {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: typeStyle.icon
                })
              })
            }), /* @__PURE__ */ jsxs("div", {
              className: "min-w-0 flex-1",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "flex items-start justify-between gap-2",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("p", {
                    className: `text-sm ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`,
                    children: notif.title
                  }), /* @__PURE__ */ jsx("p", {
                    className: "text-sm text-gray-500 mt-0.5",
                    children: notif.message
                  }), ((_a = notif.data) == null ? void 0 : _a.listing_id) && /* @__PURE__ */ jsx(Link, {
                    to: `/listings/${notif.data.listing_id}`,
                    className: "text-xs text-brand-600 hover:text-brand-700 font-medium mt-1 inline-block",
                    children: "View listing →"
                  })]
                }), isUnread && /* @__PURE__ */ jsxs(Form, {
                  method: "post",
                  className: "flex-shrink-0",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "_action",
                    value: "markRead"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "notificationId",
                    value: notif.id
                  }), /* @__PURE__ */ jsx("button", {
                    type: "submit",
                    className: "w-2.5 h-2.5 rounded-full bg-brand-500 hover:bg-brand-600 transition-colors",
                    title: "Mark as read"
                  })]
                })]
              }), /* @__PURE__ */ jsx("p", {
                className: "text-xs text-gray-400 mt-1",
                children: timeAgo(notif.created_at)
              })]
            })]
          }, notif.id);
        }) : /* @__PURE__ */ jsxs("div", {
          className: "p-8 text-center",
          children: [/* @__PURE__ */ jsx("svg", {
            className: "w-12 h-12 text-gray-300 mx-auto mb-3",
            fill: "none",
            stroke: "currentColor",
            viewBox: "0 0 24 24",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 1.5,
              d: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            })
          }), /* @__PURE__ */ jsx("p", {
            className: "text-sm text-gray-500",
            children: "No notifications yet"
          })]
        })
      })
    })]
  });
});
const route16 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$k,
  default: notifications,
  loader: loader$q,
  meta: meta$o
}, Symbol.toStringTag, { value: "Module" }));
const meta$n = ({
  data: data2
}) => {
  var _a;
  return [{
    title: ((_a = data2 == null ? void 0 : data2.listing) == null ? void 0 : _a.title) || "Listing - Runoot"
  }];
};
async function loader$p({
  request,
  params
}) {
  const user = await getUser(request);
  const {
    id
  } = params;
  const {
    data: listing,
    error
  } = await supabase.from("listings").select(`
      *,
      author:profiles(id, full_name, company_name, user_type, is_verified, email),
      event:events(id, name, slug, country, event_date)
    `).eq("id", id).single();
  if (error || !listing) {
    throw new Response("Listing not found", {
      status: 404
    });
  }
  let isSaved = false;
  if (user) {
    const userId = user.id;
    const {
      data: savedListing
    } = await supabase.from("saved_listings").select("id").eq("user_id", userId).eq("listing_id", id).single();
    isSaved = !!savedListing;
  }
  return {
    user,
    listing,
    isSaved
  };
}
async function action$j({
  request,
  params
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/login?redirectTo=/listings/${params.id}`);
  }
  const userId = user.id;
  const {
    id
  } = params;
  const formData = await request.formData();
  const actionType = formData.get("_action");
  const {
    data: listing
  } = await supabaseAdmin.from("listings").select("author_id").eq("id", id).single();
  if (!listing) {
    return data({
      error: "Listing not found"
    }, {
      status: 404
    });
  }
  if (actionType === "delete") {
    if (listing.author_id !== userId) {
      return data({
        error: "Unauthorized"
      }, {
        status: 403
      });
    }
    const {
      data: userProfile
    } = await supabaseAdmin.from("profiles").select("user_type").eq("id", userId).single();
    const {
      error
    } = await supabaseAdmin.from("listings").delete().eq("id", id);
    if (error) {
      return data({
        error: "Failed to delete listing"
      }, {
        status: 500
      });
    }
    const redirectPath = (userProfile == null ? void 0 : userProfile.user_type) === "tour_operator" ? "/dashboard" : "/my-listings";
    return redirect(redirectPath);
  }
  return data({
    error: "Invalid action"
  }, {
    status: 400
  });
}
function formatRoomType(roomType) {
  if (!roomType) return "Room";
  const labels = {
    single: "Single",
    double: "Double",
    double_single_use: "Double Single Use",
    twin: "Twin",
    twin_shared: "Twin Shared",
    triple: "Triple",
    quadruple: "Quadruple"
  };
  return labels[roomType] || roomType;
}
function getDaysUntilEvent(eventDate) {
  const today = /* @__PURE__ */ new Date();
  const event = new Date(eventDate);
  const diffTime = event.getTime() - today.getTime();
  return Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
}
function getEventSlug$1(event) {
  if (event.slug) return event.slug;
  return event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
const listings_$id = UNSAFE_withComponentProps(function ListingDetail() {
  var _a, _b, _c, _d;
  const {
    user,
    listing,
    isSaved
  } = useLoaderData();
  const actionData = useActionData();
  const [showSafety, setShowSafety] = useState(false);
  const saveFetcher = useFetcher();
  const isSavedOptimistic = saveFetcher.formData ? saveFetcher.formData.get("action") === "save" : isSaved;
  const listingData = listing;
  const userData = user;
  const eventDate = new Date(listingData.event.event_date);
  eventDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  const eventDateShort = eventDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const isOwner = (userData == null ? void 0 : userData.id) === listingData.author_id;
  getDaysUntilEvent(listingData.event.event_date);
  if (listingData.listing_type === "room") {
    const nights = listingData.check_in && listingData.check_out ? Math.ceil((new Date(listingData.check_out).getTime() - new Date(listingData.check_in).getTime()) / (1e3 * 60 * 60 * 24)) : 0;
    `${formatRoomType(listingData.room_type)} · ${nights > 0 ? `${nights} nights` : "Race weekend"}`;
  } else if (listingData.listing_type === "bib") {
    `${listingData.bib_count || 1} bib${(listingData.bib_count || 1) > 1 ? "s" : ""} available`;
  } else ;
  const priceAnchor = listingData.hotel_stars ? `Comparable ${listingData.hotel_stars}-star hotels from €${Math.round(listingData.hotel_stars * 80 + 100)}` : "Comparable hotels from €200+";
  return /* @__PURE__ */ jsx("div", {
    className: "min-h-screen bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed",
    children: /* @__PURE__ */ jsxs("div", {
      className: "min-h-screen bg-gray-50/85",
      children: [/* @__PURE__ */ jsx(Header, {
        user
      }), /* @__PURE__ */ jsxs("main", {
        className: "mx-auto max-w-7xl px-4 py-6 pb-36 md:pb-6 sm:px-6 lg:px-8",
        children: [/* @__PURE__ */ jsx("div", {
          className: "mb-4",
          children: /* @__PURE__ */ jsxs(Link, {
            to: "/listings",
            className: "inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 underline",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-4 w-4",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M15 19l-7-7 7-7"
              })
            }), "Back to listings"]
          })
        }), /* @__PURE__ */ jsxs("div", {
          className: "rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.15)] mb-6",
          children: [/* @__PURE__ */ jsx("img", {
            src: `/banners/${getEventSlug$1(listingData.event)}.jpg`,
            alt: listingData.event.name,
            className: "w-full aspect-[3/1] object-cover",
            onError: (e) => {
              const target = e.target;
              if (!target.dataset.triedFallback) {
                target.dataset.triedFallback = "true";
                target.src = `/events/${getEventSlug$1(listingData.event)}.jpg`;
              } else {
                target.style.display = "none";
                const fallback = target.nextElementSibling;
                if (fallback) fallback.style.display = "flex";
              }
            }
          }), /* @__PURE__ */ jsx("div", {
            className: "w-full aspect-[3/1] bg-gradient-to-br from-brand-100 to-brand-200 items-center justify-center",
            style: {
              display: "none"
            },
            children: /* @__PURE__ */ jsx("svg", {
              className: "h-16 w-16 text-brand-400",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 1.5,
                d: "M13 10V3L4 14h7v7l9-11h-7z"
              })
            })
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "grid gap-6 lg:grid-cols-3",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "lg:col-span-2 space-y-6",
            children: [(listingData.listing_type === "room" || listingData.listing_type === "room_and_bib") && /* @__PURE__ */ jsxs("div", {
              className: "bg-white/90 backdrop-blur-sm rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-6",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-display text-lg font-semibold text-gray-900 pb-3 mb-6 border-b border-gray-200",
                children: "Hotel & Location"
              }), /* @__PURE__ */ jsxs("div", {
                className: "space-y-5",
                children: [listingData.hotel_name && /* @__PURE__ */ jsx("div", {
                  children: /* @__PURE__ */ jsxs("div", {
                    className: "flex items-center gap-3",
                    children: [/* @__PURE__ */ jsx("div", {
                      className: "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 flex-shrink-0",
                      children: /* @__PURE__ */ jsx("svg", {
                        className: "h-5 w-5",
                        fill: "none",
                        viewBox: "0 0 24 24",
                        stroke: "currentColor",
                        children: /* @__PURE__ */ jsx("path", {
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          strokeWidth: 2,
                          d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        })
                      })
                    }), /* @__PURE__ */ jsxs("div", {
                      className: "flex-1",
                      children: [/* @__PURE__ */ jsxs("p", {
                        className: "font-semibold text-gray-900",
                        children: [listingData.hotel_website ? /* @__PURE__ */ jsxs("a", {
                          href: listingData.hotel_website,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          className: "text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1",
                          children: [listingData.hotel_name, /* @__PURE__ */ jsx("svg", {
                            className: "h-4 w-4",
                            fill: "none",
                            viewBox: "0 0 24 24",
                            stroke: "currentColor",
                            children: /* @__PURE__ */ jsx("path", {
                              strokeLinecap: "round",
                              strokeLinejoin: "round",
                              strokeWidth: 2,
                              d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            })
                          })]
                        }) : listingData.hotel_name, listingData.hotel_rating && /* @__PURE__ */ jsxs("span", {
                          className: "text-sm text-gray-500 font-normal ml-2",
                          children: ["⭐ ", listingData.hotel_rating.toFixed(1)]
                        })]
                      }), (listingData.hotel_city || listingData.hotel_country) && /* @__PURE__ */ jsxs("p", {
                        className: "text-sm text-gray-600 mt-0.5",
                        children: ["📍 ", listingData.hotel_city || "", listingData.hotel_city && listingData.hotel_country ? ", " : "", listingData.hotel_country || ""]
                      })]
                    })]
                  })
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-3",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 flex-shrink-0",
                    children: /* @__PURE__ */ jsx("svg", {
                      className: "h-5 w-5",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M4 19h16M4 15h16M4 15V9a2 2 0 012-2h2a2 2 0 012 2v0M4 15V9m8-2h6a2 2 0 012 2v6M4 9h4m0 0a2 2 0 012 2v4"
                      })
                    })
                  }), /* @__PURE__ */ jsx("div", {
                    className: "flex-1",
                    children: /* @__PURE__ */ jsxs("p", {
                      className: "font-semibold text-gray-900",
                      children: [listingData.room_count || 1, " ", formatRoomType(listingData.room_type), " room", (listingData.room_count || 1) > 1 ? "s" : ""]
                    })
                  })]
                }), listingData.check_in && listingData.check_out && (() => {
                  const checkIn = new Date(listingData.check_in);
                  const checkOut = new Date(listingData.check_out);
                  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1e3 * 60 * 60 * 24));
                  return /* @__PURE__ */ jsxs("div", {
                    className: "flex items-center gap-3",
                    children: [/* @__PURE__ */ jsx("div", {
                      className: "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 flex-shrink-0",
                      children: /* @__PURE__ */ jsx("svg", {
                        className: "h-5 w-5",
                        fill: "none",
                        viewBox: "0 0 24 24",
                        stroke: "currentColor",
                        children: /* @__PURE__ */ jsx("path", {
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          strokeWidth: 2,
                          d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        })
                      })
                    }), /* @__PURE__ */ jsx("div", {
                      className: "flex-1",
                      children: /* @__PURE__ */ jsxs("p", {
                        className: "font-semibold text-gray-900",
                        children: [checkIn.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short"
                        }), " → ", checkOut.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        }), /* @__PURE__ */ jsxs("span", {
                          className: "text-sm text-gray-500 font-normal ml-2",
                          children: ["(", nights, " night", nights > 1 ? "s" : "", ")"]
                        })]
                      })
                    })]
                  });
                })()]
              })]
            }), listingData.distance_to_finish && /* @__PURE__ */ jsxs("div", {
              className: "bg-white/90 backdrop-blur-sm rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-6",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-display text-lg font-semibold text-gray-900 mb-4",
                children: "Distance to Finish Line"
              }), /* @__PURE__ */ jsxs("div", {
                className: "space-y-3",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-3",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 flex-shrink-0",
                    children: /* @__PURE__ */ jsxs("svg", {
                      className: "h-5 w-5",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: [/* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      }), /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      })]
                    })
                  }), /* @__PURE__ */ jsxs("div", {
                    className: "flex-1",
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "font-semibold text-gray-900",
                      children: listingData.distance_to_finish < 1e3 ? `${listingData.distance_to_finish}m` : `${(listingData.distance_to_finish / 1e3).toFixed(1)}km`
                    }), /* @__PURE__ */ jsx("p", {
                      className: "text-sm text-gray-500",
                      children: "Straight-line distance"
                    })]
                  })]
                }), listingData.walking_duration && /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-3",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 flex-shrink-0",
                    children: /* @__PURE__ */ jsxs("svg", {
                      className: "h-5 w-5",
                      viewBox: "0 0 24 24",
                      fill: "currentColor",
                      children: [/* @__PURE__ */ jsx("circle", {
                        cx: "12",
                        cy: "4.5",
                        r: "2.5"
                      }), /* @__PURE__ */ jsx("path", {
                        d: "M10.5 8.5L7 11l1.5 1.5 2.5-2v4l-3 5.5 1.5 1 3-5 3 5 1.5-1-3-5.5v-4l2.5 2L17 11l-3.5-2.5h-3z"
                      })]
                    })
                  }), /* @__PURE__ */ jsxs("div", {
                    className: "flex-1",
                    children: [/* @__PURE__ */ jsxs("p", {
                      className: "font-semibold text-gray-900",
                      children: [listingData.walking_duration, " min"]
                    }), /* @__PURE__ */ jsx("p", {
                      className: "text-sm text-gray-500",
                      children: "Walking"
                    })]
                  })]
                }), listingData.transit_duration && listingData.distance_to_finish > 1e3 && /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-3",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 flex-shrink-0",
                    children: /* @__PURE__ */ jsxs("svg", {
                      className: "h-5 w-5",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: [/* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M8 7v10M16 7v10M6 17h12M6 7h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2z"
                      }), /* @__PURE__ */ jsx("circle", {
                        cx: "8",
                        cy: "19",
                        r: "1.5",
                        fill: "currentColor"
                      }), /* @__PURE__ */ jsx("circle", {
                        cx: "16",
                        cy: "19",
                        r: "1.5",
                        fill: "currentColor"
                      })]
                    })
                  }), /* @__PURE__ */ jsxs("div", {
                    className: "flex-1",
                    children: [/* @__PURE__ */ jsxs("p", {
                      className: "font-semibold text-gray-900",
                      children: [listingData.transit_duration, " min"]
                    }), /* @__PURE__ */ jsx("p", {
                      className: "text-sm text-gray-500",
                      children: "Public transit"
                    })]
                  })]
                })]
              })]
            }), (listingData.listing_type === "bib" || listingData.listing_type === "room_and_bib") && /* @__PURE__ */ jsxs("div", {
              className: "bg-white/90 backdrop-blur-sm rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-6",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-display text-lg font-semibold text-gray-900 mb-4",
                children: "Bib Transfer Details"
              }), /* @__PURE__ */ jsxs("div", {
                className: "space-y-4",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "flex items-start gap-3",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 flex-shrink-0",
                    children: /* @__PURE__ */ jsx("svg", {
                      className: "h-5 w-5",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                      })
                    })
                  }), /* @__PURE__ */ jsxs("div", {
                    className: "flex-1",
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-sm text-gray-500 mb-1",
                      children: "Available bibs"
                    }), /* @__PURE__ */ jsxs("p", {
                      className: "font-semibold text-gray-900",
                      children: [listingData.bib_count || 1, " bib", (listingData.bib_count || 1) > 1 ? "s" : ""]
                    })]
                  })]
                }), listingData.transfer_type && /* @__PURE__ */ jsxs("div", {
                  className: "bg-blue-50 border border-blue-200 rounded-lg p-4",
                  children: [/* @__PURE__ */ jsx("p", {
                    className: "text-sm font-medium text-blue-900 mb-1",
                    children: "Transfer method"
                  }), /* @__PURE__ */ jsxs("p", {
                    className: "text-sm text-blue-800",
                    children: [listingData.transfer_type === "official_process" && "✓ Official organizer name change process", listingData.transfer_type === "package" && "✓ Included in complete race package", listingData.transfer_type === "contact" && "Contact seller for transfer details"]
                  })]
                })]
              })]
            }), listingData.description && /* @__PURE__ */ jsxs("div", {
              className: "bg-white/90 backdrop-blur-sm rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-6",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-display text-lg font-semibold text-gray-900 mb-3",
                children: "Additional Information"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-700 whitespace-pre-wrap leading-relaxed",
                children: listingData.description
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "bg-white/90 backdrop-blur-sm rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] p-6",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-display text-lg font-semibold text-gray-900 mb-4",
                children: "How to Complete This Transaction"
              }), listingData.listing_type === "room" && /* @__PURE__ */ jsxs("div", {
                className: "space-y-4",
                children: [/* @__PURE__ */ jsx("p", {
                  className: "text-gray-600",
                  children: "Follow these steps after agreeing with the seller:"
                }), /* @__PURE__ */ jsxs("ol", {
                  className: "space-y-3",
                  children: [/* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex-shrink-0",
                      children: "1"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Confirm booking details"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "Verify check-in/out dates, room type, and hotel name with the seller."
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex-shrink-0",
                      children: "2"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Arrange name change"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "The seller will contact the hotel to transfer the reservation to your name. Some hotels may charge a fee."
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex-shrink-0",
                      children: "3"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Get written confirmation"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "Request the updated booking confirmation directly from the hotel with your name."
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex-shrink-0",
                      children: "4"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Complete payment"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "Pay the seller only after receiving the hotel confirmation. Use PayPal or bank transfer for safety."
                      })]
                    })]
                  })]
                })]
              }), listingData.listing_type === "bib" && /* @__PURE__ */ jsxs("div", {
                className: "space-y-4",
                children: [/* @__PURE__ */ jsx("p", {
                  className: "text-gray-600",
                  children: "Follow these steps after agreeing with the seller:"
                }), /* @__PURE__ */ jsxs("ol", {
                  className: "space-y-3",
                  children: [/* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex-shrink-0",
                      children: "1"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Check race transfer policy"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "Visit the official race website to verify if bib transfers are allowed and the deadline."
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex-shrink-0",
                      children: "2"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Initiate official transfer"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "The seller must start the name change process through the race organizer's system. You may need to provide your details."
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex-shrink-0",
                      children: "3"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Receive confirmation"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "Wait for official confirmation from the race organizer that the bib is now registered in your name."
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-semibold flex-shrink-0",
                      children: "4"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Complete payment"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "Pay the seller only after the transfer is confirmed. Use PayPal or bank transfer for safety."
                      })]
                    })]
                  })]
                }), /* @__PURE__ */ jsx("div", {
                  className: "mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg",
                  children: /* @__PURE__ */ jsxs("p", {
                    className: "text-sm text-amber-800",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "font-medium",
                      children: "Important:"
                    }), " Never run with someone else's bib without an official transfer. This violates race rules and insurance coverage."]
                  })
                })]
              }), listingData.listing_type === "room_and_bib" && /* @__PURE__ */ jsxs("div", {
                className: "space-y-4",
                children: [/* @__PURE__ */ jsx("p", {
                  className: "text-gray-600",
                  children: "This is a complete package. Follow these steps after agreeing with the seller:"
                }), /* @__PURE__ */ jsxs("ol", {
                  className: "space-y-3",
                  children: [/* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0",
                      children: "1"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Verify package contents"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "Confirm exactly what's included: hotel dates, room type, race bib, and any extras."
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0",
                      children: "2"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Start bib transfer first"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "The race bib transfer often has strict deadlines. The seller should initiate this through the official organizer."
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0",
                      children: "3"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Transfer hotel booking"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "The seller contacts the hotel to change the reservation name. Request confirmation directly from the hotel."
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0",
                      children: "4"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Get all confirmations"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "Collect written confirmation for both the race entry and hotel booking in your name."
                      })]
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex gap-3",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-semibold flex-shrink-0",
                      children: "5"
                    }), /* @__PURE__ */ jsxs("div", {
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-medium text-gray-900",
                        children: "Complete payment"
                      }), /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-600",
                        children: "Pay only after receiving all confirmations. Use PayPal or bank transfer for safety."
                      })]
                    })]
                  })]
                }), /* @__PURE__ */ jsx("div", {
                  className: "mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg",
                  children: /* @__PURE__ */ jsxs("p", {
                    className: "text-sm text-blue-800",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "font-medium",
                      children: "Tip:"
                    }), " For packages, consider splitting the payment — partial after bib confirmation, remainder after hotel confirmation."]
                  })
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "space-y-6 lg:sticky lg:top-6",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "bg-white/90 backdrop-blur-sm rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] overflow-hidden",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "px-5 py-5 border-b border-gray-100",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "flex items-center justify-between mb-4",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: `px-3 py-1 rounded-full text-xs font-semibold ${listingData.listing_type === "room" ? "bg-blue-100 text-blue-700" : listingData.listing_type === "bib" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`,
                    children: listingData.listing_type === "room" ? "Room Only" : listingData.listing_type === "bib" ? "Bib Only" : "Room + Bib"
                  }), user && !isOwner && listingData.status === "active" && /* @__PURE__ */ jsxs(saveFetcher.Form, {
                    method: "post",
                    action: "/api/saved",
                    children: [/* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "listingId",
                      value: listingData.id
                    }), /* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "action",
                      value: isSavedOptimistic ? "unsave" : "save"
                    }), /* @__PURE__ */ jsx("button", {
                      type: "submit",
                      className: `p-2 rounded-full transition-colors ${isSavedOptimistic ? "text-red-500 bg-red-50 hover:bg-red-100" : "text-gray-400 bg-gray-100 hover:bg-gray-200 hover:text-gray-600"}`,
                      title: isSavedOptimistic ? "Remove from saved" : "Save listing",
                      children: /* @__PURE__ */ jsx("svg", {
                        className: "h-5 w-5",
                        fill: isSavedOptimistic ? "currentColor" : "none",
                        viewBox: "0 0 24 24",
                        stroke: "currentColor",
                        strokeWidth: 2,
                        children: /* @__PURE__ */ jsx("path", {
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        })
                      })
                    })]
                  })]
                }), /* @__PURE__ */ jsx("h1", {
                  className: "font-display text-xl font-bold text-gray-900 leading-tight",
                  children: listingData.event.name
                }), /* @__PURE__ */ jsxs("div", {
                  className: "mt-3 flex items-center gap-2 text-sm text-gray-600",
                  children: [/* @__PURE__ */ jsx("svg", {
                    className: "h-4 w-4 text-gray-400 flex-shrink-0",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    })
                  }), /* @__PURE__ */ jsx("span", {
                    children: eventDateShort
                  })]
                }), /* @__PURE__ */ jsx("div", {
                  className: "mt-4",
                  children: listingData.status === "active" ? /* @__PURE__ */ jsxs("span", {
                    className: "inline-flex items-center gap-1.5 text-sm font-medium text-green-700",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "h-2 w-2 rounded-full bg-green-500"
                    }), "Active listing"]
                  }) : listingData.status === "pending" ? isOwner ? /* @__PURE__ */ jsxs("div", {
                    className: "rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3",
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-sm font-semibold text-yellow-800",
                      children: "Pending review"
                    }), /* @__PURE__ */ jsx("p", {
                      className: "text-xs text-yellow-700 mt-0.5",
                      children: "Your listing is being reviewed by our team. We'll notify you once it's approved."
                    })]
                  }) : /* @__PURE__ */ jsx("span", {
                    className: "px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600",
                    children: "Listing unavailable"
                  }) : listingData.status === "rejected" ? isOwner ? /* @__PURE__ */ jsxs("div", {
                    className: "rounded-lg bg-red-50 border border-red-200 px-4 py-3",
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-sm font-semibold text-red-800",
                      children: "Listing not approved"
                    }), listingData.admin_note && /* @__PURE__ */ jsx("p", {
                      className: "text-xs text-red-700 mt-0.5",
                      children: listingData.admin_note
                    }), /* @__PURE__ */ jsx("p", {
                      className: "text-xs text-red-600 mt-1",
                      children: "Please contact us if you have questions."
                    })]
                  }) : /* @__PURE__ */ jsx("span", {
                    className: "px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600",
                    children: "Listing unavailable"
                  }) : /* @__PURE__ */ jsx("span", {
                    className: "px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600",
                    children: listingData.status === "sold" ? "Sold" : "Expired"
                  })
                })]
              }), /* @__PURE__ */ jsx("div", {
                className: "px-5 py-4 border-b border-gray-100",
                children: /* @__PURE__ */ jsxs("div", {
                  className: "flex items-start gap-3",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold flex-shrink-0",
                    children: ((_a = listingData.author.company_name) == null ? void 0 : _a.charAt(0)) || ((_b = listingData.author.full_name) == null ? void 0 : _b.charAt(0)) || "?"
                  }), /* @__PURE__ */ jsxs("div", {
                    className: "flex-1 min-w-0",
                    children: [/* @__PURE__ */ jsxs("div", {
                      className: "flex items-center gap-1.5",
                      children: [/* @__PURE__ */ jsx("p", {
                        className: "font-semibold text-gray-900 truncate text-sm",
                        children: listingData.author.company_name || listingData.author.full_name
                      }), listingData.author.is_verified && /* @__PURE__ */ jsx("svg", {
                        className: "h-4 w-4 text-brand-500 flex-shrink-0",
                        fill: "currentColor",
                        viewBox: "0 0 20 20",
                        children: /* @__PURE__ */ jsx("path", {
                          fillRule: "evenodd",
                          d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                          clipRule: "evenodd"
                        })
                      })]
                    }), /* @__PURE__ */ jsxs("p", {
                      className: "text-xs text-gray-500",
                      children: [listingData.author.user_type === "tour_operator" ? "Tour Operator" : "Private Seller", listingData.author.is_verified && " · Verified"]
                    })]
                  })]
                })
              }), /* @__PURE__ */ jsxs("div", {
                className: "p-5",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "text-center",
                  children: listingData.listing_type === "bib" || listingData.listing_type === "room_and_bib" ? listingData.associated_costs ? /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-sm text-gray-500 mb-1",
                      children: "Associated costs"
                    }), /* @__PURE__ */ jsxs("p", {
                      className: "text-3xl font-bold text-gray-900",
                      children: ["€", listingData.associated_costs.toLocaleString()]
                    }), listingData.cost_notes && /* @__PURE__ */ jsx("p", {
                      className: "mt-2 text-sm text-gray-600",
                      children: listingData.cost_notes
                    })]
                  }) : /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-xl font-semibold text-gray-600 mb-1",
                      children: "Contact for price"
                    }), /* @__PURE__ */ jsx("p", {
                      className: "text-xs text-gray-500",
                      children: "Price details available from seller"
                    })]
                  }) : listingData.price ? /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsxs("p", {
                      className: "text-3xl font-bold text-gray-900",
                      children: ["€", listingData.price.toLocaleString()]
                    }), listingData.price_negotiable && /* @__PURE__ */ jsx("p", {
                      className: "mt-1 text-sm text-green-600 font-medium",
                      children: "Price negotiable"
                    })]
                  }) : /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-xl font-semibold text-gray-600 mb-1",
                      children: "Contact for price"
                    }), /* @__PURE__ */ jsx("p", {
                      className: "text-xs text-gray-500",
                      children: priceAnchor
                    })]
                  })
                }), (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx("div", {
                  className: "rounded-lg bg-red-50 p-3 text-sm text-red-700 mb-4",
                  children: actionData.error
                }), listingData.status === "active" && !isOwner && /* @__PURE__ */ jsxs(Link, {
                  to: `/listings/${listingData.id}/contact`,
                  className: "btn-primary w-full text-base py-3.5 font-semibold rounded-full shadow-lg shadow-brand-500/25 hidden md:block text-center",
                  children: ["Contact ", listingData.author.company_name || ((_c = listingData.author.full_name) == null ? void 0 : _c.split(" ")[0]) || "Seller"]
                }), isOwner && /* @__PURE__ */ jsxs("div", {
                  className: "space-y-3",
                  children: [/* @__PURE__ */ jsx(Link, {
                    to: `/listings/${listingData.id}/edit`,
                    className: "btn-secondary w-full block text-center",
                    children: "Edit Listing"
                  }), /* @__PURE__ */ jsxs(Form, {
                    method: "post",
                    onSubmit: (e) => {
                      if (!confirm("Are you sure you want to delete this listing? This action cannot be undone.")) {
                        e.preventDefault();
                      }
                    },
                    children: [/* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "_action",
                      value: "delete"
                    }), /* @__PURE__ */ jsx("button", {
                      type: "submit",
                      className: "w-full px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors",
                      children: "Delete Listing"
                    })]
                  })]
                }), !user && listingData.status === "active" && /* @__PURE__ */ jsx(Link, {
                  to: `/login?redirectTo=/listings/${listingData.id}`,
                  className: "btn-primary w-full block text-center py-3.5 font-semibold shadow-lg shadow-brand-500/25",
                  children: "Login to Contact"
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "bg-white/90 backdrop-blur-sm rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] overflow-hidden",
              children: [/* @__PURE__ */ jsxs("button", {
                onClick: () => setShowSafety(!showSafety),
                className: "w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-2",
                  children: [/* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5 text-gray-600",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    })
                  }), /* @__PURE__ */ jsx("span", {
                    className: "font-medium text-gray-900",
                    children: "Safety & Payments"
                  })]
                }), /* @__PURE__ */ jsx("svg", {
                  className: `h-5 w-5 text-gray-400 transition-transform ${showSafety ? "rotate-180" : ""}`,
                  fill: "none",
                  viewBox: "0 0 24 24",
                  stroke: "currentColor",
                  children: /* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M19 9l-7 7-7-7"
                  })
                })]
              }), showSafety && /* @__PURE__ */ jsxs("div", {
                className: "px-4 pb-4",
                children: [/* @__PURE__ */ jsxs("ul", {
                  className: "text-sm text-gray-700 space-y-2 mt-3",
                  children: [/* @__PURE__ */ jsxs("li", {
                    className: "flex items-start gap-2",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "text-brand-500 flex-shrink-0",
                      children: "•"
                    }), /* @__PURE__ */ jsx("span", {
                      children: "Always verify seller identity before payment"
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex items-start gap-2",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "text-brand-500 flex-shrink-0",
                      children: "•"
                    }), /* @__PURE__ */ jsx("span", {
                      children: "Use secure payment methods (PayPal, bank transfer)"
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex items-start gap-2",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "text-brand-500 flex-shrink-0",
                      children: "•"
                    }), /* @__PURE__ */ jsx("span", {
                      children: "Get written confirmation of all details"
                    })]
                  }), /* @__PURE__ */ jsxs("li", {
                    className: "flex items-start gap-2",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "text-brand-500 flex-shrink-0",
                      children: "•"
                    }), /* @__PURE__ */ jsx("span", {
                      children: "Report suspicious activity immediately"
                    })]
                  })]
                }), /* @__PURE__ */ jsx(Link, {
                  to: "/safety",
                  className: "mt-3 inline-block text-sm text-brand-600 hover:text-brand-700 font-medium",
                  children: "Read full safety guidelines →"
                })]
              })]
            })]
          })]
        }), listingData.status === "active" && !isOwner && /* @__PURE__ */ jsx("div", {
          className: "fixed bottom-16 left-0 right-0 px-8 py-2.5 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] md:hidden z-30",
          children: /* @__PURE__ */ jsxs(Link, {
            to: `/listings/${listingData.id}/contact`,
            className: "btn-primary w-full text-sm py-2.5 font-semibold rounded-full shadow-lg shadow-brand-500/25 block text-center",
            children: ["Contact ", listingData.author.company_name || ((_d = listingData.author.full_name) == null ? void 0 : _d.split(" ")[0]) || "Seller"]
          })
        })]
      }), /* @__PURE__ */ jsx(FooterLight, {})]
    })
  });
});
const route17 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$j,
  default: listings_$id,
  loader: loader$p,
  meta: meta$n
}, Symbol.toStringTag, { value: "Module" }));
const meta$m = ({
  data: data2
}) => {
  var _a;
  return [{
    title: ((_a = data2 == null ? void 0 : data2.listing) == null ? void 0 : _a.title) || "Listing - Runoot"
  }];
};
async function loader$o({
  request,
  params
}) {
  const user = await getUser(request);
  const {
    id
  } = params;
  if (process.env.DISABLE_AUTH === "true") {
    const mockListings = {
      "1": {
        id: "1",
        title: "2 Hotel Rooms + 2 Bibs - Berlin Marathon 2025",
        description: "Premium hotel near start line, includes breakfast. Perfect location for marathon weekend. Rooms are spacious and comfortable.",
        listing_type: "room_and_bib",
        price: 450,
        price_negotiable: true,
        transfer_type: "package",
        associated_costs: 450,
        cost_notes: "Includes hotel + bibs as complete package",
        status: "active",
        hotel_name: "Hotel Berlin Central",
        hotel_stars: 4,
        room_count: 2,
        bib_count: 2,
        check_in: "2025-09-26",
        check_out: "2025-09-29",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString(),
        author_id: "demo-1",
        author: {
          id: "demo-1",
          full_name: "Marco Rossi",
          company_name: "Run Tours Italia",
          user_type: "tour_operator",
          is_verified: true,
          email: "marco@runtours.it"
        },
        event: {
          id: "event-1",
          name: "Berlin Marathon 2025",
          location: "Berlin",
          country: "Germany",
          event_date: "2025-09-28"
        }
      },
      "2": {
        id: "2",
        title: "1 Marathon Bib - London Marathon 2025",
        description: "Can't run anymore due to injury, looking to sell my bib. Already paid for and confirmed.",
        listing_type: "bib",
        transfer_type: "official_process",
        associated_costs: 80,
        cost_notes: "Includes official name change fee",
        status: "active",
        bib_count: 1,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString(),
        author_id: "demo-2",
        author: {
          id: "demo-2",
          full_name: "Sarah Johnson",
          company_name: null,
          user_type: "private",
          is_verified: false,
          email: "sarah.j@example.com"
        },
        event: {
          id: "event-2",
          name: "London Marathon 2025",
          location: "London",
          country: "UK",
          event_date: "2025-04-27"
        }
      },
      "3": {
        id: "3",
        title: "3 Hotel Rooms - New York Marathon 2025",
        description: "Excellent location in Manhattan, walking distance to Central Park. Modern hotel with great amenities and breakfast included.",
        listing_type: "room",
        price: 600,
        price_negotiable: true,
        status: "active",
        hotel_name: "Manhattan Runner's Hotel",
        hotel_stars: 5,
        room_count: 3,
        check_in: "2025-11-01",
        check_out: "2025-11-04",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString(),
        author_id: "demo-3",
        author: {
          id: "demo-3",
          full_name: "John Smith",
          company_name: "NYC Marathon Tours",
          user_type: "tour_operator",
          is_verified: true,
          email: "john@nycmarathontours.com"
        },
        event: {
          id: "event-3",
          name: "New York City Marathon 2025",
          location: "New York",
          country: "USA",
          event_date: "2025-11-02"
        }
      }
    };
    const listing2 = mockListings[id];
    if (!listing2) {
      throw new Response("Listing not found", {
        status: 404
      });
    }
    return {
      user,
      listing: listing2
    };
  }
  const {
    data: listing,
    error
  } = await supabase.from("listings").select(`
      *,
      author:profiles(id, full_name, company_name, user_type, is_verified, email),
      event:events(id, name, location, country, event_date)
    `).eq("id", id).single();
  if (error || !listing) {
    throw new Response("Listing not found", {
      status: 404
    });
  }
  return {
    user,
    listing
  };
}
async function action$i({
  request,
  params
}) {
  const user = await getUser(request);
  if (!user) {
    return redirect(`/login?redirectTo=/listings/${params.id}`);
  }
  const {
    id
  } = params;
  const {
    data: listing
  } = await supabaseAdmin.from("listings").select("author_id").eq("id", id).single();
  if (!listing) {
    return data({
      error: "Listing not found"
    }, {
      status: 404
    });
  }
  if (listing.author_id === user.id) {
    return data({
      error: "You cannot message yourself"
    }, {
      status: 400
    });
  }
  const {
    data: existingConversation
  } = await supabaseAdmin.from("conversations").select("id").eq("listing_id", id).or(`and(participant_1.eq.${user.id},participant_2.eq.${listing.author_id}),and(participant_1.eq.${listing.author_id},participant_2.eq.${user.id})`).single();
  if (existingConversation) {
    return redirect(`/messages/${existingConversation.id}`);
  }
  const {
    data: newConversation,
    error
  } = await supabaseAdmin.from("conversations").insert({
    listing_id: id,
    participant_1: user.id,
    participant_2: listing.author_id
  }).select().single();
  if (error) {
    return data({
      error: "Failed to start conversation"
    }, {
      status: 500
    });
  }
  return redirect(`/messages/${newConversation.id}`);
}
const typeLabels = {
  room: "Room Only",
  bib: "Bib Only",
  room_and_bib: "Room + Bib"
};
const typeColors = {
  room: "bg-blue-100 text-blue-700",
  bib: "bg-purple-100 text-purple-700",
  room_and_bib: "bg-brand-100 text-brand-700"
};
const listings_$id_backup = UNSAFE_withComponentProps(function ListingDetail2() {
  var _a, _b;
  const {
    user,
    listing
  } = useLoaderData();
  const actionData = useActionData();
  const eventDate = new Date(listing.event.event_date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const isOwner = (user == null ? void 0 : user.id) === listing.author_id;
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs(Link, {
        to: "/listings",
        className: "inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6",
        children: [/* @__PURE__ */ jsx("svg", {
          className: "h-4 w-4",
          fill: "none",
          viewBox: "0 0 24 24",
          stroke: "currentColor",
          children: /* @__PURE__ */ jsx("path", {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 2,
            d: "M15 19l-7-7 7-7"
          })
        }), "Back to listings"]
      }), /* @__PURE__ */ jsxs("div", {
        className: "grid gap-8 lg:grid-cols-3",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "lg:col-span-2 space-y-6",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "card p-6",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex items-start justify-between gap-4",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("span", {
                  className: `inline-block px-3 py-1 rounded-full text-sm font-medium ${typeColors[listing.listing_type]}`,
                  children: typeLabels[listing.listing_type]
                }), /* @__PURE__ */ jsx("h1", {
                  className: "mt-4 font-display text-2xl font-bold text-gray-900 sm:text-3xl",
                  children: listing.title
                })]
              }), listing.status !== "active" && /* @__PURE__ */ jsx("span", {
                className: "px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600",
                children: listing.status === "sold" ? "Sold" : "Expired"
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "mt-6 flex items-center gap-3 p-4 bg-gray-50 rounded-lg",
              children: [/* @__PURE__ */ jsx("div", {
                className: "flex h-12 w-12 items-center justify-center rounded-lg bg-brand-100 text-brand-600",
                children: /* @__PURE__ */ jsxs("svg", {
                  className: "h-6 w-6",
                  fill: "none",
                  viewBox: "0 0 24 24",
                  stroke: "currentColor",
                  children: [/* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  }), /* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  })]
                })
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("p", {
                  className: "font-semibold text-gray-900",
                  children: listing.event.name
                }), /* @__PURE__ */ jsxs("p", {
                  className: "text-sm text-gray-600",
                  children: [listing.event.location, ", ", listing.event.country, " ·", " ", eventDate]
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "card p-6",
            children: [/* @__PURE__ */ jsx("h2", {
              className: "font-display text-lg font-semibold text-gray-900 mb-4",
              children: "Details"
            }), /* @__PURE__ */ jsxs("div", {
              className: "grid gap-4 sm:grid-cols-2",
              children: [(listing.listing_type === "room" || listing.listing_type === "room_and_bib") && /* @__PURE__ */ jsxs(Fragment, {
                children: [listing.hotel_name && /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-3",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600",
                    children: /* @__PURE__ */ jsx("svg", {
                      className: "h-5 w-5",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      })
                    })
                  }), /* @__PURE__ */ jsxs("div", {
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-sm text-gray-500",
                      children: "Hotel"
                    }), /* @__PURE__ */ jsxs("p", {
                      className: "font-medium text-gray-900",
                      children: [listing.hotel_website ? /* @__PURE__ */ jsxs("a", {
                        href: listing.hotel_website,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        className: "text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1",
                        children: [listing.hotel_name, /* @__PURE__ */ jsx("svg", {
                          className: "h-4 w-4",
                          fill: "none",
                          viewBox: "0 0 24 24",
                          stroke: "currentColor",
                          children: /* @__PURE__ */ jsx("path", {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            strokeWidth: 2,
                            d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          })
                        })]
                      }) : listing.hotel_name, listing.hotel_rating && /* @__PURE__ */ jsxs("span", {
                        className: "ml-2 text-sm text-gray-600",
                        children: ["⭐ ", listing.hotel_rating.toFixed(1)]
                      }), listing.hotel_stars && /* @__PURE__ */ jsx("span", {
                        className: "ml-1 text-yellow-500",
                        children: "★".repeat(listing.hotel_stars)
                      })]
                    }), listing.hotel_city && /* @__PURE__ */ jsxs("p", {
                      className: "text-xs text-gray-500",
                      children: [listing.hotel_city, listing.hotel_country ? `, ${listing.hotel_country}` : ""]
                    })]
                  })]
                }), listing.room_count && /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-3",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600",
                    children: /* @__PURE__ */ jsx("svg", {
                      className: "h-5 w-5",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      })
                    })
                  }), /* @__PURE__ */ jsxs("div", {
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-sm text-gray-500",
                      children: "Rooms"
                    }), /* @__PURE__ */ jsxs("p", {
                      className: "font-medium text-gray-900",
                      children: [listing.room_count, " ", listing.room_type ? /* @__PURE__ */ jsxs(Fragment, {
                        children: [listing.room_type.replace(/_/g, " "), listing.room_count > 1 && "s"]
                      }) : `room${listing.room_count > 1 ? "s" : ""}`]
                    })]
                  })]
                }), listing.check_in && listing.check_out && /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-3 sm:col-span-2",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600",
                    children: /* @__PURE__ */ jsx("svg", {
                      className: "h-5 w-5",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      })
                    })
                  }), /* @__PURE__ */ jsxs("div", {
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-sm text-gray-500",
                      children: "Dates"
                    }), /* @__PURE__ */ jsxs("p", {
                      className: "font-medium text-gray-900",
                      children: [new Date(listing.check_in).toLocaleDateString(), " →", " ", new Date(listing.check_out).toLocaleDateString()]
                    })]
                  })]
                })]
              }), (listing.listing_type === "bib" || listing.listing_type === "room_and_bib") && listing.bib_count && /* @__PURE__ */ jsxs("div", {
                className: "flex items-center gap-3",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600",
                  children: /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                    })
                  })
                }), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("p", {
                    className: "text-sm text-gray-500",
                    children: "Bibs"
                  }), /* @__PURE__ */ jsxs("p", {
                    className: "font-medium text-gray-900",
                    children: [listing.bib_count, " bib", listing.bib_count > 1 ? "s" : ""]
                  })]
                })]
              })]
            }), listing.description && /* @__PURE__ */ jsxs("div", {
              className: "mt-6 pt-6 border-t border-gray-100",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-medium text-gray-900 mb-2",
                children: "Additional Information"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-600 whitespace-pre-wrap",
                children: listing.description
              })]
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "space-y-6",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "card p-6",
            children: [/* @__PURE__ */ jsx("div", {
              className: "text-center",
              children: listing.listing_type === "bib" || listing.listing_type === "room_and_bib" ? listing.associated_costs ? /* @__PURE__ */ jsxs(Fragment, {
                children: [/* @__PURE__ */ jsx("p", {
                  className: "text-sm text-gray-500 mb-2",
                  children: "Associated costs"
                }), /* @__PURE__ */ jsxs("p", {
                  className: "text-3xl font-bold text-gray-900",
                  children: ["€", listing.associated_costs.toLocaleString()]
                }), listing.cost_notes && /* @__PURE__ */ jsx("p", {
                  className: "mt-2 text-sm text-gray-600",
                  children: listing.cost_notes
                }), listing.transfer_type && /* @__PURE__ */ jsxs("div", {
                  className: "mt-3 pt-3 border-t border-gray-100",
                  children: [/* @__PURE__ */ jsx("p", {
                    className: "text-xs text-gray-500",
                    children: "Transfer method:"
                  }), /* @__PURE__ */ jsxs("p", {
                    className: "text-sm text-gray-700 font-medium",
                    children: [listing.transfer_type === "official_process" && "Official organizer process", listing.transfer_type === "package" && "Included in package", listing.transfer_type === "contact" && "Contact for details"]
                  })]
                })]
              }) : /* @__PURE__ */ jsx("p", {
                className: "text-xl font-medium text-gray-600",
                children: "Contact for details"
              }) : listing.price ? /* @__PURE__ */ jsxs(Fragment, {
                children: [/* @__PURE__ */ jsxs("p", {
                  className: "text-3xl font-bold text-gray-900",
                  children: ["€", listing.price.toLocaleString()]
                }), listing.price_negotiable && /* @__PURE__ */ jsx("p", {
                  className: "mt-1 text-sm text-gray-500",
                  children: "Price negotiable"
                })]
              }) : /* @__PURE__ */ jsx("p", {
                className: "text-xl font-medium text-gray-600",
                children: "Contact for price"
              })
            }), (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx("div", {
              className: "mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700",
              children: actionData.error
            }), listing.status === "active" && !isOwner && /* @__PURE__ */ jsx(Form, {
              method: "post",
              className: "mt-6",
              children: /* @__PURE__ */ jsxs("button", {
                type: "submit",
                className: "btn-primary w-full",
                children: [/* @__PURE__ */ jsx("svg", {
                  className: "h-5 w-5 mr-2",
                  fill: "none",
                  viewBox: "0 0 24 24",
                  stroke: "currentColor",
                  children: /* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  })
                }), "Contact Seller"]
              })
            }), isOwner && /* @__PURE__ */ jsx("div", {
              className: "mt-6 space-y-3",
              children: /* @__PURE__ */ jsx(Link, {
                to: `/listings/${listing.id}/edit`,
                className: "btn-secondary w-full",
                children: "Edit Listing"
              })
            }), !user && listing.status === "active" && /* @__PURE__ */ jsx("div", {
              className: "mt-6",
              children: /* @__PURE__ */ jsx(Link, {
                to: `/login?redirectTo=/listings/${listing.id}`,
                className: "btn-primary w-full",
                children: "Login to Contact"
              })
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "card p-6",
            children: [/* @__PURE__ */ jsx("h3", {
              className: "font-medium text-gray-900 mb-4",
              children: "Seller"
            }), /* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-3",
              children: [/* @__PURE__ */ jsx("div", {
                className: "flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold text-lg",
                children: ((_a = listing.author.company_name) == null ? void 0 : _a.charAt(0)) || ((_b = listing.author.full_name) == null ? void 0 : _b.charAt(0)) || "?"
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsxs("p", {
                  className: "font-medium text-gray-900 flex items-center gap-1",
                  children: [listing.author.company_name || listing.author.full_name, listing.author.is_verified && /* @__PURE__ */ jsx("svg", {
                    className: "h-5 w-5 text-brand-500",
                    fill: "currentColor",
                    viewBox: "0 0 20 20",
                    children: /* @__PURE__ */ jsx("path", {
                      fillRule: "evenodd",
                      d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                      clipRule: "evenodd"
                    })
                  })]
                }), /* @__PURE__ */ jsx("p", {
                  className: "text-sm text-gray-500",
                  children: listing.author.user_type === "tour_operator" ? "Tour Operator" : "Private Seller"
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "card p-6 bg-amber-50 border-amber-200",
            children: [/* @__PURE__ */ jsx("h3", {
              className: "font-medium text-amber-900 mb-2",
              children: "Safety Tips"
            }), /* @__PURE__ */ jsxs("ul", {
              className: "text-sm text-amber-800 space-y-1",
              children: [/* @__PURE__ */ jsx("li", {
                children: "• Verify the seller's identity before payment"
              }), /* @__PURE__ */ jsx("li", {
                children: "• Use secure payment methods (PayPal, bank transfer)"
              }), /* @__PURE__ */ jsx("li", {
                children: "• Get written confirmation of the transaction"
              }), /* @__PURE__ */ jsx("li", {
                children: "• Report suspicious activity"
              })]
            })]
          })]
        })]
      })]
    })]
  });
});
const route18 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$i,
  default: listings_$id_backup,
  loader: loader$o,
  meta: meta$m
}, Symbol.toStringTag, { value: "Module" }));
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
function toRad(deg) {
  return deg * (Math.PI / 180);
}
const GOOGLE_DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";
const GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";
async function getWalkingDuration(fromLat, fromLng, toLat, toLng) {
  var _a, _b, _c, _d, _e, _f;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_PLACES_API_KEY not set, skipping walking duration calculation");
    return null;
  }
  console.log("Calling Google Distance Matrix API (walking)...");
  try {
    const url = `${GOOGLE_DISTANCE_MATRIX_URL}?origins=${fromLat},${fromLng}&destinations=${toLat},${toLng}&mode=walking&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Distance Matrix API error:", response.status, errorText);
      return null;
    }
    const data2 = await response.json();
    console.log("Google Distance Matrix walking response:", JSON.stringify(data2));
    if (data2.status === "OK" && ((_d = (_c = (_b = (_a = data2.rows) == null ? void 0 : _a[0]) == null ? void 0 : _b.elements) == null ? void 0 : _c[0]) == null ? void 0 : _d.status) === "OK") {
      const element = data2.rows[0].elements[0];
      return {
        duration: Math.round((((_e = element.duration) == null ? void 0 : _e.value) || 0) / 60),
        // Convert seconds to minutes
        distance: ((_f = element.distance) == null ? void 0 : _f.value) || 0
      };
    }
    console.error("Google Distance Matrix API returned non-OK status:", data2.status);
    return null;
  } catch (error) {
    console.error("Google Distance Matrix API error:", error);
    return null;
  }
}
async function getTransitDuration(fromLat, fromLng, toLat, toLng) {
  var _a, _b, _c, _d, _e;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_PLACES_API_KEY not set, skipping transit duration calculation");
    return null;
  }
  console.log("Calling Google Directions API (transit)...");
  try {
    const now = /* @__PURE__ */ new Date();
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
    const nextSunday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilSunday,
      9,
      0,
      0
      // 9:00 UTC
    ));
    const departureTime = Math.floor(nextSunday.getTime() / 1e3);
    console.log(`Using departure time: ${nextSunday.toISOString()} (timestamp: ${departureTime})`);
    const url = `${GOOGLE_DIRECTIONS_URL}?origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&mode=transit&departure_time=${departureTime}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Directions API error:", response.status, errorText);
      return null;
    }
    const data2 = await response.json();
    console.log("Google Directions transit response:", JSON.stringify(data2));
    if (data2.status === "OK" && ((_c = (_b = (_a = data2.routes) == null ? void 0 : _a[0]) == null ? void 0 : _b.legs) == null ? void 0 : _c[0])) {
      const leg = data2.routes[0].legs[0];
      return {
        duration: Math.round((((_d = leg.duration) == null ? void 0 : _d.value) || 0) / 60),
        // Convert seconds to minutes
        distance: ((_e = leg.distance) == null ? void 0 : _e.value) || 0
      };
    }
    console.warn("Google Directions transit not available or returned non-OK status:", data2.status);
    return null;
  } catch (error) {
    console.error("Google Directions API error:", error);
    return null;
  }
}
async function calculateDistanceData(hotelLat, hotelLng, finishLat, finishLng, eventDate) {
  if (!hotelLat || !hotelLng || !finishLat || !finishLng) {
    return {
      distance_to_finish: null,
      walking_duration: null,
      transit_duration: null
    };
  }
  const distance = calculateHaversineDistance(hotelLat, hotelLng, finishLat, finishLng);
  const walkingResult = await getWalkingDuration(hotelLat, hotelLng, finishLat, finishLng);
  let transitDuration = null;
  if (distance > 1e3) {
    const transitResult = await getTransitDuration(hotelLat, hotelLng, finishLat, finishLng);
    transitDuration = (transitResult == null ? void 0 : transitResult.duration) ?? null;
  }
  return {
    distance_to_finish: distance,
    walking_duration: (walkingResult == null ? void 0 : walkingResult.duration) ?? null,
    transit_duration: transitDuration
  };
}
const meta$l = () => {
  return [{
    title: "Create Listing - RunStay Exchange"
  }];
};
async function loader$n({
  request
}) {
  const user = await requireUser(request);
  const {
    data: events
  } = await supabase.from("events").select("*").order("event_date", {
    ascending: true
  });
  return {
    user,
    events: events || [],
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || ""
  };
}
async function action$h({
  request
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const listingType = formData.get("listingType");
  const description = formData.get("description");
  const eventId = formData.get("eventId");
  formData.get("newEventName");
  formData.get("newEventCountry");
  formData.get("newEventDate");
  const hotelPlaceId = formData.get("hotelPlaceId");
  const hotelName = formData.get("hotelName");
  const hotelWebsite = formData.get("hotelWebsite");
  const hotelCity = formData.get("hotelCity");
  const hotelCountry = formData.get("hotelCountry");
  const hotelLat = formData.get("hotelLat");
  const hotelLng = formData.get("hotelLng");
  const hotelRating = formData.get("hotelRating");
  const roomCount = formData.get("roomCount");
  const roomType = formData.get("roomType");
  const checkIn = formData.get("checkIn");
  const checkOut = formData.get("checkOut");
  const bibCount = formData.get("bibCount");
  const transferType = formData.get("transferType");
  const associatedCosts = formData.get("associatedCosts");
  const costNotes = formData.get("costNotes");
  const price = formData.get("price");
  const currency = formData.get("currency") || "EUR";
  const priceNegotiable = formData.get("priceNegotiable") === "true";
  if (!listingType) {
    return data({
      error: "Please select a listing type"
    }, {
      status: 400
    });
  }
  const validation = validateListingLimits(user.user_type, roomCount ? parseInt(roomCount) : null, bibCount ? parseInt(bibCount) : null, transferType);
  if (!validation.valid) {
    return data({
      error: validation.error
    }, {
      status: 400
    });
  }
  if (!eventId) {
    return data({
      error: "Please select an event",
      field: "event"
    }, {
      status: 400
    });
  }
  const finalEventId = eventId;
  const {
    data: eventData
  } = await supabase.from("events").select("name, event_date, finish_lat, finish_lng").eq("id", finalEventId).single();
  if ((listingType === "room" || listingType === "room_and_bib") && !hotelName) {
    return data({
      error: "Please select or add a hotel",
      field: "hotel"
    }, {
      status: 400
    });
  }
  if ((listingType === "room" || listingType === "room_and_bib") && !roomType) {
    return data({
      error: "Please select a room type",
      field: "roomType"
    }, {
      status: 400
    });
  }
  if ((listingType === "room" || listingType === "room_and_bib") && checkIn && checkOut) {
    const eventDate = new Date(eventData.event_date);
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const minDate = new Date(eventDate);
    minDate.setDate(minDate.getDate() - 10);
    const maxDate = new Date(eventDate);
    maxDate.setDate(maxDate.getDate() + 10);
    if (checkInDate < minDate || checkInDate > maxDate) {
      return data({
        error: "Check-in date must be within 10 days before or after the event date"
      }, {
        status: 400
      });
    }
    if (checkOutDate < minDate || checkOutDate > maxDate) {
      return data({
        error: "Check-out date must be within 10 days before or after the event date"
      }, {
        status: 400
      });
    }
    if (checkOutDate <= checkInDate) {
      return data({
        error: "Check-out date must be after check-in date"
      }, {
        status: 400
      });
    }
  }
  const listingTypeText = listingType === "room" ? "Rooms" : listingType === "bib" ? "Bibs" : "Rooms + Bibs";
  const autoTitle = `${listingTypeText} for ${(eventData == null ? void 0 : eventData.name) || "Marathon"}`;
  let finalHotelId = null;
  if (listingType === "room" || listingType === "room_and_bib") {
    if (hotelPlaceId) {
      const {
        data: existingHotel
      } = await supabaseAdmin.from("hotels").select("id").eq("place_id", hotelPlaceId).maybeSingle();
      if (existingHotel) {
        finalHotelId = existingHotel.id;
      } else {
        const {
          data: newHotel,
          error: hotelError
        } = await supabaseAdmin.from("hotels").insert({
          place_id: hotelPlaceId,
          name: hotelName,
          city: hotelCity,
          country: hotelCountry,
          website: hotelWebsite,
          lat: hotelLat ? parseFloat(hotelLat) : null,
          lng: hotelLng ? parseFloat(hotelLng) : null,
          rating: hotelRating ? parseFloat(hotelRating) : null
        }).select().single();
        if (hotelError || !newHotel) {
          console.error("Hotel creation error:", hotelError);
          return data({
            error: "Failed to create hotel"
          }, {
            status: 400
          });
        }
        finalHotelId = newHotel.id;
      }
    }
  }
  const distanceData = await calculateDistanceData(
    hotelLat ? parseFloat(hotelLat) : null,
    hotelLng ? parseFloat(hotelLng) : null,
    (eventData == null ? void 0 : eventData.finish_lat) ?? null,
    (eventData == null ? void 0 : eventData.finish_lng) ?? null,
    eventData == null ? void 0 : eventData.event_date
    // Pass event date for transit departure time (2pm on event day)
  );
  const {
    data: listing,
    error
  } = await supabaseAdmin.from("listings").insert({
    author_id: user.id,
    event_id: finalEventId,
    listing_type: listingType,
    title: autoTitle,
    description: description || null,
    // Campi hotel
    hotel_name: hotelName || null,
    hotel_website: hotelWebsite || null,
    hotel_place_id: hotelPlaceId || null,
    hotel_id: finalHotelId,
    hotel_stars: null,
    hotel_lat: hotelLat ? parseFloat(hotelLat) : null,
    hotel_lng: hotelLng ? parseFloat(hotelLng) : null,
    hotel_rating: hotelRating ? parseFloat(hotelRating) : null,
    // Campi room
    room_count: roomCount ? parseInt(roomCount) : null,
    room_type: roomType || null,
    check_in: checkIn || null,
    check_out: checkOut || null,
    bib_count: bibCount ? parseInt(bibCount) : null,
    // Price fields
    price: price ? parseFloat(price) : null,
    currency,
    price_negotiable: priceNegotiable,
    // Transfer fields
    transfer_type: transferType || null,
    associated_costs: associatedCosts ? parseFloat(associatedCosts) : null,
    cost_notes: costNotes || null,
    // Distance to finish line
    distance_to_finish: distanceData.distance_to_finish,
    walking_duration: distanceData.walking_duration,
    transit_duration: distanceData.transit_duration,
    status: "pending"
  }).select().single();
  if (error) {
    console.error("Listing creation error:", error);
    return data({
      error: "Failed to create listing"
    }, {
      status: 400
    });
  }
  return data({
    success: true,
    listingId: listing.id
  });
}
const listings_new = UNSAFE_withComponentProps(function NewListing() {
  const {
    user,
    events,
    googlePlacesApiKey
  } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const [listingType, setListingType] = useState("room");
  const [roomType, setRoomType] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [transferMethod, setTransferMethod] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdListingId, setCreatedListingId] = useState(null);
  const [checkInDate, setCheckInDate] = useState(null);
  const [currency, setCurrency] = useState("EUR");
  const [priceValue, setPriceValue] = useState("");
  const [priceNegotiable, setPriceNegotiable] = useState(null);
  useEffect(() => {
    if ((actionData == null ? void 0 : actionData.success) && (actionData == null ? void 0 : actionData.listingId)) {
      setCreatedListingId(actionData.listingId);
      setShowSuccessModal(true);
    }
  }, [actionData]);
  useEffect(() => {
    const textarea = document.getElementById("description");
    if (textarea && roomType === "other") {
      textarea.setCustomValidity(textarea.value ? "" : "Required");
      const handleInput = () => {
        textarea.setCustomValidity(textarea.value ? "" : "Required");
      };
      textarea.addEventListener("input", handleInput);
      return () => textarea.removeEventListener("input", handleInput);
    }
  }, [roomType]);
  const getDateConstraints = () => {
    if (!(selectedEvent == null ? void 0 : selectedEvent.event_date)) return {
      min: void 0,
      max: void 0
    };
    const eventDate = new Date(selectedEvent.event_date);
    const minDate = new Date(eventDate);
    minDate.setDate(minDate.getDate() - 7);
    const maxDate = new Date(eventDate);
    maxDate.setDate(maxDate.getDate() + 7);
    return {
      min: minDate.toISOString().split("T")[0],
      max: maxDate.toISOString().split("T")[0]
    };
  };
  const dateConstraints = getDateConstraints();
  const maxRooms = getMaxLimit(user.user_type, "rooms");
  const maxBibs = getMaxLimit(user.user_type, "bibs");
  const transferMethodOptions = getTransferMethodOptions(user.user_type);
  const visibleFields = getVisibleFieldsForTransferMethod(user.user_type, transferMethod, listingType);
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsx("div", {
      className: "min-h-screen bg-cover bg-center bg-no-repeat bg-fixed",
      style: {
        backgroundImage: "url('/new-listing.jpg')"
      },
      children: /* @__PURE__ */ jsxs("main", {
        className: "mx-auto max-w-2xl px-4 py-8 pb-8 md:pb-8 sm:px-6 lg:px-8",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "mb-6 md:mb-8 rounded-xl bg-white/70 backdrop-blur-sm p-3 md:p-4 inline-block shadow-[0_2px_8px_rgba(0,0,0,0.15)]",
          children: [/* @__PURE__ */ jsx("h1", {
            className: "font-display text-xl md:text-3xl font-bold text-gray-900",
            children: "Create a Listing"
          }), /* @__PURE__ */ jsx("p", {
            className: "mt-1 md:mt-2 text-sm md:text-base text-gray-600",
            children: "Share your available rooms or bibs with the community"
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "rounded-2xl bg-white/90 backdrop-blur-sm p-6 sm:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.15)]",
          children: /* @__PURE__ */ jsxs(Form, {
            method: "post",
            className: "space-y-8",
            onSubmit: () => setFormSubmitted(true),
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "label",
                children: "What are you offering?"
              }), /* @__PURE__ */ jsxs("div", {
                className: "mt-2 grid grid-cols-3 gap-3",
                children: [/* @__PURE__ */ jsxs("label", {
                  className: "relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-blue-300 has-[:checked]:bg-blue-100 has-[:checked]:ring-2 has-[:checked]:ring-blue-500",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "radio",
                    name: "listingType",
                    value: "room",
                    className: "sr-only",
                    defaultChecked: true,
                    onChange: (e) => setListingType(e.target.value)
                  }), /* @__PURE__ */ jsxs("span", {
                    className: "flex flex-1 flex-col items-center text-center",
                    children: [/* @__PURE__ */ jsx("svg", {
                      className: "h-6 w-6 text-gray-600",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      })
                    }), /* @__PURE__ */ jsx("span", {
                      className: "mt-2 text-sm font-medium text-gray-900",
                      children: "Room Only"
                    })]
                  })]
                }), /* @__PURE__ */ jsxs("label", {
                  className: "relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-purple-300 has-[:checked]:bg-purple-100 has-[:checked]:ring-2 has-[:checked]:ring-purple-500",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "radio",
                    name: "listingType",
                    value: "bib",
                    className: "sr-only",
                    onChange: (e) => setListingType(e.target.value)
                  }), /* @__PURE__ */ jsxs("span", {
                    className: "flex flex-1 flex-col items-center text-center",
                    children: [/* @__PURE__ */ jsx("svg", {
                      className: "h-6 w-6 text-gray-600",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                      })
                    }), /* @__PURE__ */ jsx("span", {
                      className: "mt-2 text-sm font-medium text-gray-900",
                      children: "Bib Only"
                    })]
                  })]
                }), /* @__PURE__ */ jsxs("label", {
                  className: "relative flex cursor-pointer rounded-lg bg-white p-4 shadow-sm focus:outline-none transition-all hover:ring-2 hover:ring-green-300 has-[:checked]:bg-green-100 has-[:checked]:ring-2 has-[:checked]:ring-green-500",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "radio",
                    name: "listingType",
                    value: "room_and_bib",
                    className: "sr-only",
                    onChange: (e) => setListingType(e.target.value)
                  }), /* @__PURE__ */ jsxs("span", {
                    className: "flex flex-1 flex-col items-center text-center",
                    children: [/* @__PURE__ */ jsx("svg", {
                      className: "h-6 w-6 text-gray-600",
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        strokeWidth: 2,
                        d: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      })
                    }), /* @__PURE__ */ jsx("span", {
                      className: "mt-2 text-sm font-medium text-gray-900",
                      children: "Room + Bib"
                    })]
                  })]
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-medium text-gray-900 border-b pb-2",
                children: "Running Event"
              }), /* @__PURE__ */ jsx(EventPicker, {
                events,
                onSelectEvent: (eventId) => {
                  const event = events.find((e) => e.id === eventId);
                  setSelectedEvent(event);
                },
                hasError: (actionData == null ? void 0 : actionData.field) === "event"
              })]
            }), (listingType === "room" || listingType === "room_and_bib") && /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              id: "roomFields",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-medium text-gray-900 border-b pb-2",
                children: "Room Details"
              }), /* @__PURE__ */ jsxs("div", {
                className: "grid gap-4 sm:grid-cols-2",
                children: [/* @__PURE__ */ jsxs("div", {
                  className: "sm:col-span-2",
                  children: [/* @__PURE__ */ jsx("label", {
                    className: "label",
                    children: "Hotel"
                  }), /* @__PURE__ */ jsx(HotelAutocomplete, {
                    apiKey: googlePlacesApiKey,
                    eventCity: selectedEvent == null ? void 0 : selectedEvent.country,
                    eventCountry: selectedEvent == null ? void 0 : selectedEvent.country,
                    onSelectHotel: (hotel) => {
                    },
                    hasError: (actionData == null ? void 0 : actionData.field) === "hotel"
                  })]
                }), /* @__PURE__ */ jsx("div", {
                  children: " "
                }), /* @__PURE__ */ jsx("div", {
                  children: " "
                }), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsxs("label", {
                    htmlFor: "roomCount",
                    className: "label mb-3",
                    children: ["Number of rooms", maxRooms !== null && user.user_type === "tour_operator" && /* @__PURE__ */ jsxs("span", {
                      className: "text-xs text-gray-500 ml-2",
                      children: ["(max ", maxRooms, " for your account)"]
                    })]
                  }), user.user_type === "private" ? /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsxs("div", {
                      className: "flex items-center gap-3 mt-2",
                      children: [/* @__PURE__ */ jsx("div", {
                        className: `flex h-12 w-12 items-center justify-center rounded-lg font-bold text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${listingType === "room" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`,
                        children: "1"
                      }), /* @__PURE__ */ jsxs("span", {
                        className: "text-sm text-gray-600",
                        children: ["Private users can list", /* @__PURE__ */ jsx("br", {}), "1 room only"]
                      })]
                    }), /* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "roomCount",
                      value: "1"
                    })]
                  }) : /* @__PURE__ */ jsx("input", {
                    type: "number",
                    id: "roomCount",
                    name: "roomCount",
                    min: "1",
                    max: maxRooms || void 0,
                    placeholder: "e.g. 2",
                    className: "input"
                  })]
                }), /* @__PURE__ */ jsx(RoomTypeDropdown, {
                  value: roomType,
                  onChange: setRoomType,
                  hasError: (actionData == null ? void 0 : actionData.field) === "roomType"
                }), /* @__PURE__ */ jsxs("div", {
                  className: "mt-4",
                  children: [/* @__PURE__ */ jsx("label", {
                    htmlFor: "checkIn",
                    className: "label mb-3",
                    children: "Check-in"
                  }), /* @__PURE__ */ jsx(DatePicker, {
                    id: "checkIn",
                    name: "checkIn",
                    placeholder: "dd/mm/yyyy",
                    minDate: dateConstraints.min ? new Date(dateConstraints.min) : void 0,
                    maxDate: dateConstraints.max ? new Date(dateConstraints.max) : void 0,
                    onChange: (date) => setCheckInDate(date)
                  }), selectedEvent && /* @__PURE__ */ jsxs("p", {
                    className: "mt-1 text-xs text-gray-500",
                    children: ["Event date: ", new Date(selectedEvent.event_date).toLocaleDateString(), " (±7 days)"]
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "mt-4",
                  children: [/* @__PURE__ */ jsx("label", {
                    htmlFor: "checkOut",
                    className: "label mb-3",
                    children: "Check-out"
                  }), /* @__PURE__ */ jsx(DatePicker, {
                    id: "checkOut",
                    name: "checkOut",
                    placeholder: "dd/mm/yyyy",
                    minDate: checkInDate || (dateConstraints.min ? new Date(dateConstraints.min) : void 0),
                    maxDate: dateConstraints.max ? new Date(dateConstraints.max) : void 0
                  })]
                })]
              })]
            }), (listingType === "bib" || listingType === "room_and_bib") && /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              id: "bibFields",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-medium text-gray-900 border-b pb-2",
                children: "Bib Transfer Details"
              }), user.user_type === "private" && /* @__PURE__ */ jsx("div", {
                className: `rounded-lg p-4 ${listingType === "bib" ? "bg-purple-50 border border-purple-200" : "bg-green-50 border border-green-200"}`,
                children: /* @__PURE__ */ jsxs("p", {
                  className: `text-sm ${listingType === "bib" ? "text-purple-800" : "text-green-800"}`,
                  children: [/* @__PURE__ */ jsx("strong", {
                    children: "Important:"
                  }), " runoot facilitates connections for legitimate bib transfers only. Direct sale of bibs may violate event regulations."]
                })
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsxs("label", {
                  htmlFor: "bibCount",
                  className: "label",
                  children: ["Number of bibs", maxBibs !== null && user.user_type === "tour_operator" && /* @__PURE__ */ jsxs("span", {
                    className: "text-xs text-gray-500 ml-2",
                    children: ["(max ", maxBibs, " for your account)"]
                  })]
                }), user.user_type === "private" ? /* @__PURE__ */ jsxs(Fragment, {
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: "flex items-center gap-3 mt-2",
                    children: [/* @__PURE__ */ jsx("div", {
                      className: `flex h-12 w-12 items-center justify-center rounded-lg font-bold text-2xl shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${listingType === "bib" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`,
                      children: "1"
                    }), /* @__PURE__ */ jsx("span", {
                      className: "text-sm text-gray-600",
                      children: "Private users can list 1 bib only"
                    })]
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "bibCount",
                    value: "1"
                  })]
                }) : /* @__PURE__ */ jsx("input", {
                  type: "number",
                  id: "bibCount",
                  name: "bibCount",
                  min: "1",
                  max: maxBibs || void 0,
                  placeholder: "e.g. 1",
                  className: "input w-full sm:w-48"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsxs("label", {
                  htmlFor: "transferType",
                  className: "label",
                  children: ["Transfer Method ", /* @__PURE__ */ jsx("span", {
                    className: "text-red-500",
                    children: "*"
                  })]
                }), user.user_type === "private" ? /* @__PURE__ */ jsxs(Fragment, {
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "mt-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700",
                    children: "Official Organizer Name Change"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "transferType",
                    value: "official_process"
                  }), /* @__PURE__ */ jsx("p", {
                    className: "mt-1 text-xs text-gray-500",
                    children: "How the bib will be transferred to the new participant"
                  })]
                }) : /* @__PURE__ */ jsxs(Fragment, {
                  children: [/* @__PURE__ */ jsxs("select", {
                    id: "transferType",
                    name: "transferType",
                    className: "input",
                    onChange: (e) => setTransferMethod(e.target.value),
                    children: [/* @__PURE__ */ jsx("option", {
                      value: "",
                      children: "Select transfer method"
                    }), transferMethodOptions.map((option) => /* @__PURE__ */ jsx("option", {
                      value: option.value,
                      children: option.label
                    }, option.value))]
                  }), /* @__PURE__ */ jsx("p", {
                    className: "mt-1 text-xs text-gray-500",
                    children: "How the bib will be transferred to the new participant"
                  })]
                })]
              }), visibleFields.showAssociatedCosts && /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsxs("label", {
                  htmlFor: "associatedCosts",
                  className: "label",
                  children: ["Associated Costs (€) ", /* @__PURE__ */ jsx("span", {
                    className: "text-gray-400",
                    children: "(optional)"
                  })]
                }), /* @__PURE__ */ jsx("input", {
                  type: "number",
                  id: "associatedCosts",
                  name: "associatedCosts",
                  min: "0",
                  step: "0.01",
                  placeholder: "e.g. 50",
                  className: "input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-1 text-xs text-gray-500",
                  children: "Official name change fee from the event organizer (if applicable)"
                })]
              }), visibleFields.showPackageInfo && /* @__PURE__ */ jsx("div", {
                className: "bg-green-50 border border-green-200 rounded-lg p-4",
                children: /* @__PURE__ */ jsxs("p", {
                  className: "text-sm text-green-800",
                  children: [/* @__PURE__ */ jsx("strong", {
                    children: "Package Transfer:"
                  }), " The bib is included in your travel package. All costs are included in the package price."]
                })
              })]
            }), !(user.user_type === "private" && listingType === "bib") && /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              children: [/* @__PURE__ */ jsx("h3", {
                className: "font-medium text-gray-900 border-b pb-2",
                children: "Price"
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "price",
                  className: "label mb-3",
                  children: "Amount"
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex gap-2",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "number",
                    id: "price",
                    name: "price",
                    min: "0",
                    step: "0.01",
                    placeholder: "",
                    className: "input w-32 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                    value: priceValue,
                    onChange: (e) => {
                      setPriceValue(e.target.value);
                      if (!e.target.value) {
                        setPriceNegotiable(null);
                      }
                    }
                  }), /* @__PURE__ */ jsx(CurrencyPicker, {
                    value: currency,
                    onChange: setCurrency
                  })]
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-1.5 text-sm text-gray-500",
                  children: "Leave empty = Contact for price"
                })]
              }), priceValue && (listingType === "room" || listingType === "room_and_bib") && /* @__PURE__ */ jsxs("div", {
                className: "mt-4",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "priceNegotiable",
                  value: priceNegotiable === true ? "true" : "false"
                }), /* @__PURE__ */ jsx("span", {
                  className: "text-sm text-gray-700",
                  children: "Is the price negotiable?"
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex gap-2 mt-2",
                  children: [/* @__PURE__ */ jsx("button", {
                    type: "button",
                    onClick: () => setPriceNegotiable(priceNegotiable === true ? null : true),
                    className: `px-4 py-2 rounded-lg text-sm font-medium transition-all ${priceNegotiable === true ? "bg-green-100 text-green-700 ring-2 ring-green-500 shadow-[0_2px_8px_rgba(0,0,0,0.15)]" : "bg-white text-gray-700 shadow-sm hover:ring-2 hover:ring-green-300"}`,
                    children: "Yes"
                  }), /* @__PURE__ */ jsx("button", {
                    type: "button",
                    onClick: () => setPriceNegotiable(priceNegotiable === false ? null : false),
                    className: `px-4 py-2 rounded-lg text-sm font-medium transition-all ${priceNegotiable === false ? "bg-green-100 text-green-700 ring-2 ring-green-500 shadow-[0_2px_8px_rgba(0,0,0,0.15)]" : "bg-white text-gray-700 shadow-sm hover:ring-2 hover:ring-green-300"}`,
                    children: "No"
                  })]
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsxs("label", {
                htmlFor: "description",
                className: "label",
                children: [user.user_type === "private" && listingType === "bib" ? "Notes" : "Additional details", " ", /* @__PURE__ */ jsx("span", {
                  className: roomType === "other" ? "text-red-500" : "text-gray-400",
                  children: roomType === "other" ? "(required)" : "(optional)"
                })]
              }), /* @__PURE__ */ jsx("textarea", {
                id: "description",
                name: "description",
                rows: 4,
                placeholder: "Any other information runners should know...",
                className: `input ${roomType === "other" ? "required:border-red-500 invalid:border-red-500 focus:invalid:ring-red-500" : ""}`,
                required: roomType === "other"
              })]
            }), (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsxs("div", {
              className: "rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2",
              children: [/* @__PURE__ */ jsx("svg", {
                className: "h-5 w-5 text-red-500 flex-shrink-0",
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ jsx("path", {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                })
              }), actionData.error]
            }), /* @__PURE__ */ jsx("div", {
              className: "flex gap-4 pt-4",
              children: /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "btn-primary flex-1 rounded-full",
                children: "Create Listing"
              })
            })]
          })
        })]
      })
    }), showSuccessModal && /* @__PURE__ */ jsx("div", {
      className: "fixed inset-0 z-50 overflow-y-auto",
      children: /* @__PURE__ */ jsxs("div", {
        className: "flex min-h-screen items-center justify-center p-4",
        children: [/* @__PURE__ */ jsx("div", {
          className: "fixed inset-0 bg-black/50 backdrop-blur-sm"
        }), /* @__PURE__ */ jsxs("div", {
          className: "relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center",
          style: {
            animation: "fade-in-up 0.3s ease-out"
          },
          children: [/* @__PURE__ */ jsx("div", {
            className: `mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full ${listingType === "room" ? "bg-blue-100" : listingType === "bib" ? "bg-purple-100" : "bg-green-100"}`,
            style: {
              animation: "scale-in 0.4s ease-out"
            },
            children: /* @__PURE__ */ jsx("svg", {
              className: `h-12 w-12 ${listingType === "room" ? "text-blue-600" : listingType === "bib" ? "text-purple-600" : "text-green-600"}`,
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              strokeWidth: 2.5,
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                d: "M5 13l4 4L19 7"
              })
            })
          }), /* @__PURE__ */ jsx("h2", {
            className: "font-display text-2xl font-bold text-gray-900 mb-2",
            children: "Listing Submitted!"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-600 mb-8",
            children: "Your listing has been submitted and is pending review. We'll notify you once it's approved and visible to other users."
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex flex-col gap-3",
            children: [/* @__PURE__ */ jsx("button", {
              onClick: () => navigate(`/listings/${createdListingId}`),
              className: "btn-primary w-full py-3 rounded-full",
              children: "View Your Listing"
            }), user.user_type === "tour_operator" && /* @__PURE__ */ jsx("button", {
              onClick: () => {
                setShowSuccessModal(false);
                navigate("/dashboard");
              },
              className: "btn bg-gray-100 text-gray-700 hover:bg-gray-200 w-full py-3 rounded-full",
              children: "Go to Dashboard"
            })]
          })]
        })]
      })
    })]
  });
});
const route19 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$h,
  default: listings_new,
  loader: loader$n,
  meta: meta$l
}, Symbol.toStringTag, { value: "Module" }));
const meta$k = () => {
  return [{
    title: "Team Leader Dashboard - Runoot"
  }];
};
async function loader$m({
  request
}) {
  const user = await requireUser(request);
  if (!user.is_team_leader) {
    throw redirect("/dashboard");
  }
  const {
    data: referrals
  } = await supabaseAdmin.from("referrals").select("id, referral_code_used, status, created_at, referred_user_id").eq("team_leader_id", user.id).order("created_at", {
    ascending: false
  });
  const referralIds = (referrals || []).map((r) => r.referred_user_id);
  let referredUsers = {};
  if (referralIds.length > 0) {
    const {
      data: profiles
    } = await supabaseAdmin.from("profiles").select("id, full_name, email, user_type, is_verified, created_at").in("id", referralIds);
    if (profiles) {
      for (const p of profiles) {
        referredUsers[p.id] = p;
      }
    }
  }
  const totalReferrals = (referrals == null ? void 0 : referrals.length) || 0;
  const activeReferrals = (referrals == null ? void 0 : referrals.filter((r) => r.status === "active").length) || 0;
  const weeklyData = [];
  for (let i = 3; i >= 0; i--) {
    const weekStart = /* @__PURE__ */ new Date();
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
    const weekEnd = /* @__PURE__ */ new Date();
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const count = (referrals || []).filter((r) => {
      const d = new Date(r.created_at);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeklyData.push({
      label: i === 0 ? "This week" : `${i}w ago`,
      value: count
    });
  }
  return {
    user,
    referrals: referrals || [],
    referredUsers,
    stats: {
      totalReferrals,
      activeReferrals
    },
    weeklyData
  };
}
async function action$g({
  request
}) {
  const user = await requireUser(request);
  if (!user.is_team_leader) {
    return data({
      error: "Not a team leader"
    }, {
      status: 403
    });
  }
  const formData = await request.formData();
  const actionType = formData.get("_action");
  switch (actionType) {
    case "updateCode": {
      const newCode = (formData.get("referralCode") || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (newCode.length < 3 || newCode.length > 20) {
        return data({
          error: "Code must be between 3 and 20 characters (letters and numbers only)"
        }, {
          status: 400
        });
      }
      const {
        data: existing
      } = await supabaseAdmin.from("profiles").select("id").eq("referral_code", newCode).neq("id", user.id).single();
      if (existing) {
        return data({
          error: "This code is already taken. Try a different one."
        }, {
          status: 400
        });
      }
      await supabaseAdmin.from("profiles").update({
        referral_code: newCode
      }).eq("id", user.id);
      return data({
        success: true,
        message: "Referral code updated!"
      });
    }
    case "updateWelcome": {
      const welcomeMessage = (formData.get("welcomeMessage") || "").trim();
      if (welcomeMessage.length > 500) {
        return data({
          error: "Welcome message must be under 500 characters"
        }, {
          status: 400
        });
      }
      await supabaseAdmin.from("profiles").update({
        tl_welcome_message: welcomeMessage || null
      }).eq("id", user.id);
      return data({
        success: true,
        message: "Welcome message updated!"
      });
    }
    default:
      return data({
        error: "Unknown action"
      }, {
        status: 400
      });
  }
}
const userTypeLabels$2 = {
  tour_operator: "Tour Operator",
  private: "Runner"
};
const tlDashboard = UNSAFE_withComponentProps(function TLDashboard() {
  const {
    user,
    referrals,
    referredUsers,
    stats,
    weeklyData
  } = useLoaderData();
  const actionData = useActionData();
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = `${baseUrl}/join/${user.referral_code}`;
  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  const maxWeekly = Math.max(...weeklyData.map((w) => w.value), 1);
  return /* @__PURE__ */ jsxs("div", {
    className: "max-w-4xl mx-auto px-4 py-8",
    children: [/* @__PURE__ */ jsx("div", {
      className: "mb-8",
      children: /* @__PURE__ */ jsxs("div", {
        className: "flex items-center gap-3 mb-2",
        children: [/* @__PURE__ */ jsx("div", {
          className: "w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center",
          children: /* @__PURE__ */ jsx("svg", {
            className: "w-5 h-5 text-purple-600",
            fill: "none",
            stroke: "currentColor",
            viewBox: "0 0 24 24",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            })
          })
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("h1", {
            className: "font-display text-2xl md:text-3xl font-bold text-gray-900",
            children: "Team Leader Dashboard"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-500",
            children: "Manage your referral community"
          })]
        })]
      })
    }), actionData && "error" in actionData && /* @__PURE__ */ jsx("div", {
      className: "mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm",
      children: actionData.error
    }), actionData && "message" in actionData && /* @__PURE__ */ jsx("div", {
      className: "mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm",
      children: actionData.message
    }), /* @__PURE__ */ jsxs("div", {
      className: "grid grid-cols-2 gap-4 mb-6",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl p-5 border border-gray-200 shadow-sm",
        children: [/* @__PURE__ */ jsx("p", {
          className: "text-xs text-gray-500 uppercase tracking-wide",
          children: "Total Referrals"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-3xl font-bold text-gray-900 mt-1",
          children: stats.totalReferrals
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl p-5 border border-gray-200 shadow-sm",
        children: [/* @__PURE__ */ jsx("p", {
          className: "text-xs text-gray-500 uppercase tracking-wide",
          children: "Active"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-3xl font-bold text-brand-600 mt-1",
          children: stats.activeReferrals
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6",
      children: [/* @__PURE__ */ jsx("h2", {
        className: "font-display font-semibold text-gray-900 mb-4",
        children: "Weekly Signups"
      }), /* @__PURE__ */ jsx("div", {
        className: "flex items-end gap-3 h-32",
        children: weeklyData.map((week, i) => /* @__PURE__ */ jsxs("div", {
          className: "flex-1 flex flex-col items-center gap-1",
          children: [/* @__PURE__ */ jsx("span", {
            className: "text-xs font-semibold text-gray-900",
            children: week.value
          }), /* @__PURE__ */ jsx("div", {
            className: "w-full bg-brand-500 rounded-t-md transition-all duration-500",
            style: {
              height: `${Math.max(week.value / maxWeekly * 100, 4)}%`,
              minHeight: "4px"
            }
          }), /* @__PURE__ */ jsx("span", {
            className: "text-xs text-gray-500 mt-1",
            children: week.label
          })]
        }, i))
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6",
      children: [/* @__PURE__ */ jsx("h2", {
        className: "font-display font-semibold text-gray-900 mb-2",
        children: "Your Referral Link"
      }), /* @__PURE__ */ jsx("p", {
        className: "text-sm text-gray-500 mb-4",
        children: "Share this link with people you want to invite to Runoot."
      }), /* @__PURE__ */ jsxs("div", {
        className: "flex items-center gap-2 mb-4",
        children: [/* @__PURE__ */ jsx("div", {
          className: "flex-1 bg-gray-50 rounded-lg px-4 py-2.5 font-mono text-sm text-gray-700 border border-gray-200 truncate",
          children: referralLink
        }), /* @__PURE__ */ jsx("button", {
          onClick: copyLink,
          className: "btn-primary text-sm px-4 py-2.5 flex-shrink-0",
          children: copied ? "Copied!" : "Copy"
        })]
      }), /* @__PURE__ */ jsxs(Form, {
        method: "post",
        className: "flex items-end gap-3",
        children: [/* @__PURE__ */ jsx("input", {
          type: "hidden",
          name: "_action",
          value: "updateCode"
        }), /* @__PURE__ */ jsxs("div", {
          className: "flex-1",
          children: [/* @__PURE__ */ jsx("label", {
            htmlFor: "referralCode",
            className: "label",
            children: "Custom Code"
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex items-center",
            children: [/* @__PURE__ */ jsx("span", {
              className: "text-sm text-gray-400 mr-1",
              children: "/join/"
            }), /* @__PURE__ */ jsx("input", {
              type: "text",
              id: "referralCode",
              name: "referralCode",
              defaultValue: user.referral_code || "",
              placeholder: "MYCODE2026",
              className: "input flex-1 uppercase",
              maxLength: 20
            })]
          })]
        }), /* @__PURE__ */ jsx("button", {
          type: "submit",
          className: "btn-secondary text-sm px-4 py-2",
          children: "Save Code"
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6",
      children: [/* @__PURE__ */ jsx("h2", {
        className: "font-display font-semibold text-gray-900 mb-2",
        children: "Welcome Message"
      }), /* @__PURE__ */ jsx("p", {
        className: "text-sm text-gray-500 mb-4",
        children: "This message will appear on your referral page when someone opens your link."
      }), /* @__PURE__ */ jsxs(Form, {
        method: "post",
        children: [/* @__PURE__ */ jsx("input", {
          type: "hidden",
          name: "_action",
          value: "updateWelcome"
        }), /* @__PURE__ */ jsx("textarea", {
          name: "welcomeMessage",
          rows: 3,
          defaultValue: user.tl_welcome_message || "",
          placeholder: "Welcome to our running community! I'm excited to have you join us on Runoot...",
          className: "input w-full mb-3",
          maxLength: 500
        }), /* @__PURE__ */ jsx("button", {
          type: "submit",
          className: "btn-secondary text-sm",
          children: "Save Message"
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden",
      children: [/* @__PURE__ */ jsx("div", {
        className: "px-6 py-4 border-b border-gray-100",
        children: /* @__PURE__ */ jsx("h2", {
          className: "font-display font-semibold text-gray-900",
          children: "Your Referrals"
        })
      }), /* @__PURE__ */ jsx("div", {
        className: "divide-y divide-gray-100",
        children: referrals.length > 0 ? referrals.map((ref) => {
          var _a, _b, _c;
          const refUser = referredUsers[ref.referred_user_id];
          return /* @__PURE__ */ jsxs("div", {
            className: "p-4 flex items-center justify-between",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-3 min-w-0 flex-1",
              children: [/* @__PURE__ */ jsx("div", {
                className: "w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold flex-shrink-0 text-sm",
                children: ((_a = refUser == null ? void 0 : refUser.full_name) == null ? void 0 : _a.charAt(0)) || ((_c = (_b = refUser == null ? void 0 : refUser.email) == null ? void 0 : _b.charAt(0)) == null ? void 0 : _c.toUpperCase()) || "?"
              }), /* @__PURE__ */ jsxs("div", {
                className: "min-w-0",
                children: [/* @__PURE__ */ jsx("p", {
                  className: "text-sm font-medium text-gray-900 truncate",
                  children: (refUser == null ? void 0 : refUser.full_name) || (refUser == null ? void 0 : refUser.email) || "Unknown user"
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-2 mt-0.5",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-xs text-gray-500",
                    children: refUser ? userTypeLabels$2[refUser.user_type] || refUser.user_type : ""
                  }), /* @__PURE__ */ jsx("span", {
                    className: "text-xs text-gray-300",
                    children: "·"
                  }), /* @__PURE__ */ jsx("span", {
                    className: "text-xs text-gray-500",
                    children: new Date(ref.created_at).toLocaleDateString()
                  })]
                })]
              })]
            }), /* @__PURE__ */ jsx("span", {
              className: `px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${ref.status === "active" ? "bg-success-100 text-success-700" : "bg-gray-100 text-gray-600"}`,
              children: ref.status
            })]
          }, ref.id);
        }) : /* @__PURE__ */ jsxs("div", {
          className: "p-8 text-center",
          children: [/* @__PURE__ */ jsx("svg", {
            className: "w-12 h-12 text-gray-300 mx-auto mb-3",
            fill: "none",
            stroke: "currentColor",
            viewBox: "0 0 24 24",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 1.5,
              d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            })
          }), /* @__PURE__ */ jsx("p", {
            className: "text-sm text-gray-500 mb-1",
            children: "No referrals yet"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-xs text-gray-400",
            children: "Share your referral link to start growing your community!"
          })]
        })
      })]
    })]
  });
});
const route20 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$g,
  default: tlDashboard,
  loader: loader$m,
  meta: meta$k
}, Symbol.toStringTag, { value: "Module" }));
const meta$j = () => {
  return [{
    title: "My Listings - Runoot"
  }];
};
async function loader$l({
  request
}) {
  const user = await requireUser(request);
  const {
    data: listings
  } = await supabaseAdmin.from("listings").select(`
      *,
      event:events(id, name, country, event_date),
      author:profiles(id, full_name, company_name, user_type, is_verified)
    `).eq("author_id", user.id).order("created_at", {
    ascending: false
  });
  const userListings = listings || [];
  if (user.user_type === "private" && userListings.length === 1) {
    return redirect(`/listings/${userListings[0].id}`);
  }
  if (user.user_type === "tour_operator") {
    return redirect("/dashboard");
  }
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const pendingListings = userListings.filter((listing) => listing.status === "pending");
  const rejectedListings = userListings.filter((listing) => listing.status === "rejected");
  const activeListings = userListings.filter((listing) => {
    const eventDate = new Date(listing.event.event_date);
    return listing.status === "active" && eventDate >= today;
  });
  const endedListings = userListings.filter((listing) => {
    const eventDate = new Date(listing.event.event_date);
    return (listing.status === "active" || listing.status === "sold" || listing.status === "expired") && eventDate < today;
  });
  return {
    user,
    activeListings,
    endedListings,
    pendingListings,
    rejectedListings
  };
}
const myListings = UNSAFE_withComponentProps(function MyListings() {
  const {
    user,
    activeListings,
    endedListings,
    pendingListings,
    rejectedListings
  } = useLoaderData();
  const totalListings = pendingListings.length + rejectedListings.length + activeListings.length + endedListings.length;
  return /* @__PURE__ */ jsx("div", {
    className: "min-h-full bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed",
    children: /* @__PURE__ */ jsxs("div", {
      className: "min-h-full bg-gray-50/85",
      children: [/* @__PURE__ */ jsx(Header, {
        user
      }), /* @__PURE__ */ jsxs("main", {
        className: "mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "mb-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-md p-6 flex items-center justify-between",
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("h1", {
              className: "font-display text-3xl font-bold text-gray-900",
              children: "My Listings"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-2 text-gray-600",
              children: totalListings === 0 ? "You haven't created any listings yet" : `You have ${totalListings} listing${totalListings > 1 ? "s" : ""}`
            })]
          }), activeListings.length > 0 && /* @__PURE__ */ jsxs("span", {
            className: "font-display text-xl font-semibold text-gray-900",
            children: ["Active (", activeListings.length, ")"]
          })]
        }), totalListings > 0 ? /* @__PURE__ */ jsxs("div", {
          className: "space-y-10",
          children: [pendingListings.length > 0 && /* @__PURE__ */ jsxs("section", {
            children: [/* @__PURE__ */ jsxs("h2", {
              className: "font-display text-xl font-semibold text-yellow-700 mb-4 flex items-center gap-2",
              children: [/* @__PURE__ */ jsx("span", {
                className: "h-2 w-2 rounded-full bg-yellow-500"
              }), "Pending Review (", pendingListings.length, ")"]
            }), /* @__PURE__ */ jsx("p", {
              className: "text-sm text-gray-500 mb-4",
              children: "These listings are awaiting admin approval before going live."
            }), /* @__PURE__ */ jsx("div", {
              className: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 opacity-80",
              children: pendingListings.map((listing) => /* @__PURE__ */ jsxs("div", {
                className: "relative",
                children: [/* @__PURE__ */ jsx(ListingCard, {
                  listing,
                  isUserLoggedIn: true
                }), /* @__PURE__ */ jsx("div", {
                  className: "absolute top-3 right-3",
                  children: /* @__PURE__ */ jsx("span", {
                    className: "px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200",
                    children: "Pending"
                  })
                })]
              }, listing.id))
            })]
          }), rejectedListings.length > 0 && /* @__PURE__ */ jsxs("section", {
            children: [/* @__PURE__ */ jsxs("h2", {
              className: "font-display text-xl font-semibold text-red-700 mb-4",
              children: ["Not Approved (", rejectedListings.length, ")"]
            }), /* @__PURE__ */ jsx("div", {
              className: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 opacity-60",
              children: rejectedListings.map((listing) => /* @__PURE__ */ jsxs("div", {
                className: "relative",
                children: [/* @__PURE__ */ jsx(ListingCard, {
                  listing,
                  isUserLoggedIn: true
                }), /* @__PURE__ */ jsx("div", {
                  className: "absolute top-3 right-3",
                  children: /* @__PURE__ */ jsx("span", {
                    className: "px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200",
                    children: "Not approved"
                  })
                })]
              }, listing.id))
            })]
          }), activeListings.length > 0 && /* @__PURE__ */ jsx("section", {
            children: /* @__PURE__ */ jsx("div", {
              className: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3",
              children: activeListings.map((listing) => /* @__PURE__ */ jsx(ListingCard, {
                listing,
                isUserLoggedIn: true
              }, listing.id))
            })
          }), endedListings.length > 0 && /* @__PURE__ */ jsxs("section", {
            children: [/* @__PURE__ */ jsxs("h2", {
              className: "font-display text-xl font-semibold text-gray-500 mb-4",
              children: ["Ended (", endedListings.length, ")"]
            }), /* @__PURE__ */ jsx("div", {
              className: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 opacity-60",
              children: endedListings.map((listing) => /* @__PURE__ */ jsx(ListingCard, {
                listing,
                isUserLoggedIn: true
              }, listing.id))
            })]
          })]
        }) : /* @__PURE__ */ jsxs("div", {
          className: "card p-12 text-center",
          children: [/* @__PURE__ */ jsx("div", {
            className: "mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4",
            children: /* @__PURE__ */ jsx("svg", {
              className: "h-8 w-8 text-gray-400",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              })
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-semibold text-gray-900 mb-2",
            children: "No listings yet"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-500 mb-6",
            children: "Create your first listing to start exchanging rooms or bibs with other runners."
          }), /* @__PURE__ */ jsx(Link, {
            to: "/listings/new",
            className: "btn-primary rounded-full",
            children: "Create your first listing"
          })]
        })]
      })]
    })
  });
});
const route21 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: myListings,
  loader: loader$l,
  meta: meta$j
}, Symbol.toStringTag, { value: "Module" }));
async function loader$k({
  request
}) {
  const user = await getUser(request);
  if (!user) {
    return data({
      unreadCount: 0
    });
  }
  const userId = user.id;
  const {
    data: conversations
  } = await supabaseAdmin.from("conversations").select(`
      id,
      messages(id, sender_id, read_at)
    `).or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
  let unreadCount = 0;
  conversations == null ? void 0 : conversations.forEach((conv) => {
    var _a;
    (_a = conv.messages) == null ? void 0 : _a.forEach((msg) => {
      if (msg.sender_id !== userId && !msg.read_at) {
        unreadCount++;
      }
    });
  });
  return data({
    unreadCount
  });
}
const route22 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$k
}, Symbol.toStringTag, { value: "Module" }));
const meta$i = ({
  data: data2
}) => {
  var _a;
  const tlName = ((_a = data2 == null ? void 0 : data2.teamLeader) == null ? void 0 : _a.full_name) || "a Team Leader";
  return [{
    title: `Join Runoot - Invited by ${tlName}`
  }];
};
async function loader$j({
  request,
  params
}) {
  const code = params.code;
  if (!code) {
    throw redirect("/register");
  }
  const userId = await getUserId(request);
  const {
    data: teamLeader
  } = await supabaseAdmin.from("profiles").select("id, full_name, company_name, user_type, avatar_url, is_verified, referral_code, tl_welcome_message").eq("referral_code", code).eq("is_team_leader", true).single();
  if (!teamLeader) {
    return {
      status: "invalid",
      teamLeader: null,
      alreadyLoggedIn: false,
      code
    };
  }
  if (userId) {
    const {
      data: existingRef
    } = await supabaseAdmin.from("referrals").select("id").eq("referred_user_id", userId).single();
    if (existingRef) {
      return {
        status: "already_referred",
        teamLeader,
        alreadyLoggedIn: true,
        code
      };
    }
    await supabaseAdmin.from("referrals").insert({
      team_leader_id: teamLeader.id,
      referred_user_id: userId,
      referral_code_used: code,
      status: "active"
    });
    const {
      data: referredUser
    } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", userId).single();
    await supabaseAdmin.from("notifications").insert({
      user_id: teamLeader.id,
      type: "referral_signup",
      title: "New referral!",
      message: `${(referredUser == null ? void 0 : referredUser.full_name) || (referredUser == null ? void 0 : referredUser.email) || "Someone"} joined via your referral link.`,
      data: {
        referred_user_id: userId,
        referral_code: code
      }
    });
    return {
      status: "linked",
      teamLeader,
      alreadyLoggedIn: true,
      code
    };
  }
  return {
    status: "valid",
    teamLeader,
    alreadyLoggedIn: false,
    code
  };
}
async function action$f({
  request,
  params
}) {
  const code = params.code;
  if (!code) {
    return data({
      error: "Invalid referral code"
    }, {
      status: 400
    });
  }
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const fullName = formData.get("fullName");
  const userType = formData.get("userType");
  const companyName = formData.get("companyName");
  if (!email || !password || !fullName || !userType) {
    return data({
      error: "All fields are required"
    }, {
      status: 400
    });
  }
  if (password.length < 8) {
    return data({
      error: "Password must be at least 8 characters"
    }, {
      status: 400
    });
  }
  const {
    data: teamLeader
  } = await supabaseAdmin.from("profiles").select("id, referral_code").eq("referral_code", code).eq("is_team_leader", true).single();
  if (!teamLeader) {
    return data({
      error: "Invalid referral code"
    }, {
      status: 400
    });
  }
  const {
    data: authData,
    error: authError
  } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        user_type: userType,
        company_name: userType === "tour_operator" ? companyName : null
      }
    }
  });
  if (authError) {
    return data({
      error: authError.message
    }, {
      status: 400
    });
  }
  if (!authData.user) {
    return data({
      error: "Registration failed. Please try again."
    }, {
      status: 400
    });
  }
  if (!authData.session) {
    return data({
      success: true,
      emailConfirmationRequired: true,
      message: "Please check your email to confirm your account before logging in."
    });
  }
  const {
    error: profileError
  } = await supabaseAdmin.from("profiles").insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    user_type: userType,
    company_name: userType === "tour_operator" && companyName ? companyName : null,
    is_verified: false
  });
  if (profileError) {
    console.error("Profile creation error:", profileError);
  }
  await supabaseAdmin.from("referrals").insert({
    team_leader_id: teamLeader.id,
    referred_user_id: authData.user.id,
    referral_code_used: code,
    status: "registered"
  });
  await supabaseAdmin.from("notifications").insert({
    user_id: teamLeader.id,
    type: "referral_signup",
    title: "New referral!",
    message: `${fullName || email} joined via your referral link.`,
    data: {
      referred_user_id: authData.user.id,
      referral_code: code
    }
  });
  return createUserSession(authData.user.id, authData.session.access_token, authData.session.refresh_token, "/dashboard");
}
const join_$code = UNSAFE_withComponentProps(function JoinReferral() {
  var _a;
  const {
    status,
    teamLeader,
    code
  } = useLoaderData();
  const actionData = useActionData();
  if (status === "invalid") {
    return /* @__PURE__ */ jsx("div", {
      className: "min-h-screen bg-gray-50 flex items-center justify-center px-4",
      children: /* @__PURE__ */ jsxs("div", {
        className: "max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center",
        children: [/* @__PURE__ */ jsx("div", {
          className: "w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4",
          children: /* @__PURE__ */ jsx("svg", {
            className: "w-8 h-8 text-red-500",
            fill: "none",
            stroke: "currentColor",
            viewBox: "0 0 24 24",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M6 18L18 6M6 6l12 12"
            })
          })
        }), /* @__PURE__ */ jsx("h1", {
          className: "font-display text-2xl font-bold text-gray-900 mb-2",
          children: "Invalid Referral Link"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-gray-500 mb-6",
          children: "This referral link is not valid or the Team Leader no longer exists."
        }), /* @__PURE__ */ jsx(Link, {
          to: "/register",
          className: "btn-primary inline-block w-full py-3",
          children: "Sign Up Normally"
        })]
      })
    });
  }
  if (status === "already_referred") {
    return /* @__PURE__ */ jsx("div", {
      className: "min-h-screen bg-gray-50 flex items-center justify-center px-4",
      children: /* @__PURE__ */ jsxs("div", {
        className: "max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center",
        children: [/* @__PURE__ */ jsx("div", {
          className: "w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4",
          children: /* @__PURE__ */ jsx("svg", {
            className: "w-8 h-8 text-brand-600",
            fill: "currentColor",
            viewBox: "0 0 20 20",
            children: /* @__PURE__ */ jsx("path", {
              fillRule: "evenodd",
              d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
              clipRule: "evenodd"
            })
          })
        }), /* @__PURE__ */ jsx("h1", {
          className: "font-display text-2xl font-bold text-gray-900 mb-2",
          children: "Already Connected"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-gray-500 mb-6",
          children: "You're already connected to a Team Leader. Head to your dashboard!"
        }), /* @__PURE__ */ jsx(Link, {
          to: "/dashboard",
          className: "btn-primary inline-block w-full py-3",
          children: "Go to Dashboard"
        })]
      })
    });
  }
  if (status === "linked") {
    return /* @__PURE__ */ jsx("div", {
      className: "min-h-screen bg-gray-50 flex items-center justify-center px-4",
      children: /* @__PURE__ */ jsxs("div", {
        className: "max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center",
        children: [/* @__PURE__ */ jsx("div", {
          className: "w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4",
          children: /* @__PURE__ */ jsx("svg", {
            className: "w-8 h-8 text-success-600",
            fill: "currentColor",
            viewBox: "0 0 20 20",
            children: /* @__PURE__ */ jsx("path", {
              fillRule: "evenodd",
              d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
              clipRule: "evenodd"
            })
          })
        }), /* @__PURE__ */ jsx("h1", {
          className: "font-display text-2xl font-bold text-gray-900 mb-2",
          children: "Welcome!"
        }), /* @__PURE__ */ jsxs("p", {
          className: "text-gray-500 mb-6",
          children: ["You've been connected to ", (teamLeader == null ? void 0 : teamLeader.full_name) || "your Team Leader", "'s community."]
        }), /* @__PURE__ */ jsx(Link, {
          to: "/dashboard",
          className: "btn-primary inline-block w-full py-3",
          children: "Go to Dashboard"
        })]
      })
    });
  }
  const tl = teamLeader;
  return /* @__PURE__ */ jsx("div", {
    className: "min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8",
    children: /* @__PURE__ */ jsxs("div", {
      className: "sm:mx-auto sm:w-full sm:max-w-md",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 text-center",
        children: [/* @__PURE__ */ jsx("div", {
          className: "w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3",
          children: /* @__PURE__ */ jsx("span", {
            className: "text-xl font-bold text-purple-700",
            children: ((_a = tl == null ? void 0 : tl.full_name) == null ? void 0 : _a.charAt(0)) || "T"
          })
        }), /* @__PURE__ */ jsx("p", {
          className: "text-sm text-gray-500 mb-1",
          children: "You've been invited by"
        }), /* @__PURE__ */ jsx("h2", {
          className: "font-display text-xl font-bold text-gray-900",
          children: (tl == null ? void 0 : tl.full_name) || "Team Leader"
        }), (tl == null ? void 0 : tl.company_name) && /* @__PURE__ */ jsx("p", {
          className: "text-sm text-gray-500",
          children: tl.company_name
        }), (tl == null ? void 0 : tl.is_verified) && /* @__PURE__ */ jsxs("div", {
          className: "flex items-center justify-center gap-1 mt-1",
          children: [/* @__PURE__ */ jsx("svg", {
            className: "w-4 h-4 text-brand-500",
            fill: "currentColor",
            viewBox: "0 0 20 20",
            children: /* @__PURE__ */ jsx("path", {
              fillRule: "evenodd",
              d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
              clipRule: "evenodd"
            })
          }), /* @__PURE__ */ jsx("span", {
            className: "text-xs text-brand-600 font-medium",
            children: "Verified"
          })]
        }), (tl == null ? void 0 : tl.tl_welcome_message) && /* @__PURE__ */ jsxs("p", {
          className: "mt-3 text-sm text-gray-600 italic border-t border-gray-100 pt-3",
          children: ['"', tl.tl_welcome_message, '"']
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-2xl border border-gray-200 shadow-sm py-8 px-4 sm:px-10",
        children: [/* @__PURE__ */ jsx("h2", {
          className: "font-display text-2xl font-bold text-gray-900 text-center mb-2",
          children: "Join Runoot"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-center text-sm text-gray-500 mb-6",
          children: "Create your free account to get started"
        }), actionData && "emailConfirmationRequired" in actionData && actionData.emailConfirmationRequired ? /* @__PURE__ */ jsxs("div", {
          className: "text-center",
          children: [/* @__PURE__ */ jsx("div", {
            className: "mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4",
            children: /* @__PURE__ */ jsx("svg", {
              className: "h-6 w-6 text-green-600",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              })
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-2",
            children: "Check your email"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-sm text-gray-600 mb-6",
            children: actionData.message
          }), /* @__PURE__ */ jsx(Link, {
            to: "/login",
            className: "btn-primary inline-block",
            children: "Go to login"
          })]
        }) : /* @__PURE__ */ jsxs(Form, {
          method: "post",
          className: "space-y-5",
          children: [actionData && "error" in actionData && /* @__PURE__ */ jsx("div", {
            className: "rounded-lg bg-red-50 p-4 text-sm text-red-700",
            children: actionData.error
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "fullName",
              className: "label",
              children: "Full name"
            }), /* @__PURE__ */ jsx("input", {
              id: "fullName",
              name: "fullName",
              type: "text",
              autoComplete: "name",
              required: true,
              className: "input w-full"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "email",
              className: "label",
              children: "Email address"
            }), /* @__PURE__ */ jsx("input", {
              id: "email",
              name: "email",
              type: "email",
              autoComplete: "email",
              required: true,
              className: "input w-full"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "password",
              className: "label",
              children: "Password"
            }), /* @__PURE__ */ jsx("input", {
              id: "password",
              name: "password",
              type: "password",
              autoComplete: "new-password",
              required: true,
              minLength: 8,
              className: "input w-full"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-1 text-xs text-gray-500",
              children: "At least 8 characters"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              className: "label",
              children: "I am a"
            }), /* @__PURE__ */ jsxs("div", {
              className: "mt-2 grid grid-cols-2 gap-3",
              children: [/* @__PURE__ */ jsxs("label", {
                className: "relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "radio",
                  name: "userType",
                  value: "private",
                  className: "sr-only",
                  defaultChecked: true
                }), /* @__PURE__ */ jsx("span", {
                  className: "flex flex-1",
                  children: /* @__PURE__ */ jsxs("span", {
                    className: "flex flex-col",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "block text-sm font-medium text-gray-900",
                      children: "Runner"
                    }), /* @__PURE__ */ jsx("span", {
                      className: "mt-1 text-xs text-gray-500",
                      children: "Individual runner"
                    })]
                  })
                })]
              }), /* @__PURE__ */ jsxs("label", {
                className: "relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "radio",
                  name: "userType",
                  value: "tour_operator",
                  className: "sr-only"
                }), /* @__PURE__ */ jsx("span", {
                  className: "flex flex-1",
                  children: /* @__PURE__ */ jsxs("span", {
                    className: "flex flex-col",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "block text-sm font-medium text-gray-900",
                      children: "Tour Operator"
                    }), /* @__PURE__ */ jsx("span", {
                      className: "mt-1 text-xs text-gray-500",
                      children: "I sell packages"
                    })]
                  })
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsxs("label", {
              htmlFor: "companyName",
              className: "label",
              children: ["Company name ", /* @__PURE__ */ jsx("span", {
                className: "text-gray-400",
                children: "(Tour Operators)"
              })]
            }), /* @__PURE__ */ jsx("input", {
              id: "companyName",
              name: "companyName",
              type: "text",
              className: "input w-full"
            })]
          }), /* @__PURE__ */ jsx("button", {
            type: "submit",
            className: "btn-primary w-full py-3",
            children: "Create account"
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-xs text-gray-500 text-center",
            children: ["Already have an account?", " ", /* @__PURE__ */ jsx(Link, {
              to: "/login",
              className: "font-medium text-brand-600 hover:text-brand-500",
              children: "Sign in"
            })]
          })]
        })]
      })]
    })
  });
});
const route23 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$f,
  default: join_$code,
  loader: loader$j,
  meta: meta$i
}, Symbol.toStringTag, { value: "Module" }));
async function action$e({
  request
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const listingId = formData.get("listingId");
  const actionType = formData.get("action");
  if (!listingId) {
    return data({
      error: "Missing listing ID"
    }, {
      status: 400
    });
  }
  const userId = user.id;
  if (actionType === "save") {
    const {
      error
    } = await supabaseAdmin.from("saved_listings").insert({
      user_id: userId,
      listing_id: listingId
    });
    if (error && error.code !== "23505") {
      return data({
        error: "Failed to save listing"
      }, {
        status: 500
      });
    }
    const {
      data: listing
    } = await supabaseAdmin.from("listings").select("author_id, title").eq("id", listingId).single();
    if (listing && listing.author_id !== userId) {
      const {
        data: existingConv
      } = await supabaseAdmin.from("conversations").select("id").eq("listing_id", listingId).or(`and(participant_1.eq.${userId},participant_2.eq.${listing.author_id}),and(participant_1.eq.${listing.author_id},participant_2.eq.${userId})`).single();
      if (!existingConv) {
        const {
          data: newConv,
          error: convError
        } = await supabaseAdmin.from("conversations").insert({
          listing_id: listingId,
          participant_1: userId,
          // The person who saved
          participant_2: listing.author_id,
          // The listing owner
          activated: false
          // Hidden from participant_1 until owner replies
        }).select().single();
        if (newConv && !convError) {
          await supabaseAdmin.from("messages").insert({
            conversation_id: newConv.id,
            sender_id: userId,
            // The person who saved
            content: "HEART_NOTIFICATION",
            message_type: "heart"
          });
        }
      }
    }
    return data({
      saved: true
    });
  }
  if (actionType === "unsave") {
    const {
      error
    } = await supabaseAdmin.from("saved_listings").delete().eq("user_id", userId).eq("listing_id", listingId);
    if (error) {
      return data({
        error: "Failed to unsave listing"
      }, {
        status: 500
      });
    }
    return data({
      saved: false
    });
  }
  return data({
    error: "Invalid action"
  }, {
    status: 400
  });
}
const route24 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$e
}, Symbol.toStringTag, { value: "Module" }));
const meta$h = () => {
  return [{
    title: "Dashboard - Runoot"
  }];
};
async function loader$i({
  request
}) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") {
    return redirect("/listings");
  }
  const {
    data: listings
  } = await supabaseAdmin.from("listings").select(`
      *,
      event:events(id, name, slug, country, event_date),
      author:profiles(id, full_name, company_name, user_type, is_verified)
    `).eq("author_id", user.id).order("created_at", {
    ascending: false
  });
  const {
    data: conversations
  } = await supabaseAdmin.from("conversations").select(`
      *,
      listing:listings(id, title),
      messages(id, content, sender_id, created_at, read_at)
    `).or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`).order("updated_at", {
    ascending: false
  }).limit(5);
  let unreadCount = 0;
  conversations == null ? void 0 : conversations.forEach((conv) => {
    var _a;
    (_a = conv.messages) == null ? void 0 : _a.forEach((msg) => {
      if (msg.sender_id !== user.id && !msg.read_at) {
        unreadCount++;
      }
    });
  });
  return {
    user,
    listings: listings || [],
    conversations: conversations || [],
    unreadCount
  };
}
const statusColors$2 = {
  pending: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  active: "bg-success-100 text-success-700 border border-success-200",
  sold: "bg-gray-100 text-gray-700 border border-gray-200",
  expired: "bg-alert-100 text-alert-700 border border-alert-200",
  rejected: "bg-red-100 text-red-700 border border-red-200"
};
const dashboard = UNSAFE_withComponentProps(function Dashboard() {
  var _a;
  const {
    user,
    listings,
    conversations,
    unreadCount
  } = useLoaderData();
  const pendingListings = listings.filter((l) => l.status === "pending");
  const activeListings = listings.filter((l) => l.status === "active");
  const soldListings = listings.filter((l) => l.status === "sold");
  return /* @__PURE__ */ jsx("div", {
    className: "min-h-screen bg-gray-100 md:bg-[url('/savedBG.png')] md:bg-cover md:bg-center md:bg-fixed",
    children: /* @__PURE__ */ jsxs("div", {
      className: "min-h-screen md:bg-gray-50/85",
      children: [/* @__PURE__ */ jsx(Header, {
        user
      }), /* @__PURE__ */ jsxs("main", {
        className: "md:hidden px-4 pt-6 pb-20",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "flex items-center justify-between mb-5",
          children: [/* @__PURE__ */ jsx("h1", {
            className: "font-display text-lg font-bold text-gray-900",
            children: "Dashboard"
          }), /* @__PURE__ */ jsxs(Link, {
            to: "/listings/new",
            className: "bg-accent-500 text-white rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium shadow-sm active:bg-accent-600",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "w-3.5 h-3.5",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 4v16m8-8H4"
              })
            }), "New Listing"]
          })]
        }), pendingListings.length > 0 && /* @__PURE__ */ jsx("div", {
          className: "mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3",
          children: /* @__PURE__ */ jsxs("div", {
            className: "flex items-center gap-2",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "w-4 h-4 text-yellow-600 flex-shrink-0",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              })
            }), /* @__PURE__ */ jsxs("p", {
              className: "text-sm font-medium text-yellow-800",
              children: [pendingListings.length, " listing", pendingListings.length > 1 ? "s" : "", " pending review"]
            })]
          })
        }), /* @__PURE__ */ jsxs("div", {
          className: "grid grid-cols-2 gap-3 mb-6",
          children: [/* @__PURE__ */ jsx("div", {
            className: "bg-white rounded-xl p-4 shadow-sm border border-gray-100",
            children: /* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-3",
              children: [/* @__PURE__ */ jsx("div", {
                className: "w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center",
                children: /* @__PURE__ */ jsx("svg", {
                  className: "w-5 h-5 text-brand-600",
                  fill: "none",
                  stroke: "currentColor",
                  viewBox: "0 0 24 24",
                  children: /* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  })
                })
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("p", {
                  className: "text-2xl font-bold text-gray-900",
                  children: activeListings.length
                }), /* @__PURE__ */ jsx("p", {
                  className: "text-xs text-gray-500",
                  children: "Active"
                })]
              })]
            })
          }), /* @__PURE__ */ jsx("div", {
            className: "bg-white rounded-xl p-4 shadow-sm border border-gray-100",
            children: /* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-3",
              children: [/* @__PURE__ */ jsx("div", {
                className: "w-10 h-10 rounded-full bg-success-100 flex items-center justify-center",
                children: /* @__PURE__ */ jsx("svg", {
                  className: "w-5 h-5 text-success-600",
                  fill: "none",
                  stroke: "currentColor",
                  viewBox: "0 0 24 24",
                  children: /* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M5 13l4 4L19 7"
                  })
                })
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("p", {
                  className: "text-2xl font-bold text-gray-900",
                  children: soldListings.length
                }), /* @__PURE__ */ jsx("p", {
                  className: "text-xs text-gray-500",
                  children: "Sold"
                })]
              })]
            })
          }), /* @__PURE__ */ jsx(Link, {
            to: "/messages",
            className: "bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:bg-gray-50",
            children: /* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-3",
              children: [/* @__PURE__ */ jsx("div", {
                className: "w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center",
                children: /* @__PURE__ */ jsx("svg", {
                  className: "w-5 h-5 text-blue-600",
                  fill: "none",
                  stroke: "currentColor",
                  viewBox: "0 0 24 24",
                  children: /* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  })
                })
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("p", {
                  className: "text-2xl font-bold text-gray-900",
                  children: conversations.length
                }), /* @__PURE__ */ jsx("p", {
                  className: "text-xs text-gray-500",
                  children: "Chats"
                })]
              })]
            })
          }), /* @__PURE__ */ jsx(Link, {
            to: "/messages",
            className: "bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:bg-gray-50",
            children: /* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-3",
              children: [/* @__PURE__ */ jsx("div", {
                className: `w-10 h-10 rounded-full flex items-center justify-center ${unreadCount > 0 ? "bg-accent-100" : "bg-gray-100"}`,
                children: /* @__PURE__ */ jsx("svg", {
                  className: `w-5 h-5 ${unreadCount > 0 ? "text-accent-600" : "text-gray-400"}`,
                  fill: "none",
                  stroke: "currentColor",
                  viewBox: "0 0 24 24",
                  children: /* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  })
                })
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("p", {
                  className: `text-2xl font-bold ${unreadCount > 0 ? "text-accent-600" : "text-gray-900"}`,
                  children: unreadCount
                }), /* @__PURE__ */ jsx("p", {
                  className: "text-xs text-gray-500",
                  children: "Unread"
                })]
              })]
            })
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "mb-6",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "flex items-center justify-between mb-3",
            children: [/* @__PURE__ */ jsx("h2", {
              className: "font-display font-semibold text-gray-900",
              children: "My Listings"
            }), listings.length > 3 && /* @__PURE__ */ jsx(Link, {
              to: "/my-listings",
              className: "text-sm text-brand-600 font-medium",
              children: "See all"
            })]
          }), listings.length > 0 ? /* @__PURE__ */ jsx("div", {
            className: "space-y-3",
            children: listings.slice(0, 3).map((listing) => /* @__PURE__ */ jsxs("div", {
              className: "relative",
              children: [/* @__PURE__ */ jsx(ListingCardCompact, {
                listing,
                isUserLoggedIn: true
              }), /* @__PURE__ */ jsx("div", {
                className: "absolute top-3 right-3",
                children: /* @__PURE__ */ jsx("span", {
                  className: `px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors$2[listing.status]}`,
                  children: listing.status
                })
              })]
            }, listing.id))
          }) : /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-xl p-6 text-center border border-gray-100",
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-gray-500 text-sm",
              children: "No listings yet"
            }), /* @__PURE__ */ jsx(Link, {
              to: "/listings/new",
              className: "text-brand-600 text-sm font-medium mt-2 inline-block",
              children: "Create your first listing →"
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsxs("div", {
            className: "flex items-center justify-between mb-3",
            children: [/* @__PURE__ */ jsx("h2", {
              className: "font-display font-semibold text-gray-900",
              children: "Recent Messages"
            }), conversations.length > 0 && /* @__PURE__ */ jsx(Link, {
              to: "/messages",
              className: "text-sm text-brand-600 font-medium",
              children: "See all"
            })]
          }), conversations.length > 0 ? /* @__PURE__ */ jsx("div", {
            className: "bg-white rounded-xl overflow-hidden border border-gray-100",
            children: conversations.slice(0, 3).map((conv, index) => {
              var _a2, _b, _c;
              const lastMessage = (_a2 = conv.messages) == null ? void 0 : _a2[conv.messages.length - 1];
              const hasUnread = (_b = conv.messages) == null ? void 0 : _b.some((m) => m.sender_id !== user.id && !m.read_at);
              return /* @__PURE__ */ jsxs(Link, {
                to: `/messages/${conv.id}`,
                className: `flex items-center gap-3 p-4 active:bg-gray-50 ${index > 0 ? "border-t border-gray-100" : ""}`,
                children: [/* @__PURE__ */ jsx("div", {
                  className: `w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${hasUnread ? "bg-brand-100" : "bg-gray-100"}`,
                  children: /* @__PURE__ */ jsx("svg", {
                    className: `w-5 h-5 ${hasUnread ? "text-brand-600" : "text-gray-400"}`,
                    fill: "none",
                    stroke: "currentColor",
                    viewBox: "0 0 24 24",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    })
                  })
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex-1 min-w-0",
                  children: [/* @__PURE__ */ jsx("p", {
                    className: `text-sm truncate ${hasUnread ? "font-semibold text-gray-900" : "text-gray-700"}`,
                    children: ((_c = conv.listing) == null ? void 0 : _c.title) || "Conversation"
                  }), lastMessage && /* @__PURE__ */ jsx("p", {
                    className: "text-xs text-gray-500 truncate mt-0.5",
                    children: lastMessage.content
                  })]
                }), hasUnread && /* @__PURE__ */ jsx("span", {
                  className: "w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0"
                })]
              }, conv.id);
            })
          }) : /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-xl p-6 text-center border border-gray-100",
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-gray-500 text-sm",
              children: "No conversations yet"
            }), /* @__PURE__ */ jsx(Link, {
              to: "/listings",
              className: "text-brand-600 text-sm font-medium mt-2 inline-block",
              children: "Browse listings →"
            })]
          })]
        })]
      }), /* @__PURE__ */ jsxs("main", {
        className: "hidden md:block mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "mb-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-md p-6",
          children: [/* @__PURE__ */ jsxs("h1", {
            className: "font-display text-3xl font-bold text-gray-900",
            children: ["Welcome back, ", user.full_name || user.email.split("@")[0]]
          }), /* @__PURE__ */ jsx("p", {
            className: "mt-2 text-gray-600",
            children: "Manage your listings and conversations"
          })]
        }), pendingListings.length > 0 && /* @__PURE__ */ jsxs("div", {
          className: "mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3",
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center flex-shrink-0",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-5 h-5 text-yellow-700",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              })
            })
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsxs("p", {
              className: "font-semibold text-yellow-800",
              children: [pendingListings.length, " listing", pendingListings.length > 1 ? "s" : "", " pending review"]
            }), /* @__PURE__ */ jsx("p", {
              className: "text-xs text-yellow-600",
              children: "We'll notify you once they're approved"
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "card p-6",
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-sm text-gray-500",
              children: "Active Listings"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-2 text-3xl font-bold text-gray-900",
              children: activeListings.length
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "card p-6",
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-sm text-gray-500",
              children: "Sold"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-2 text-3xl font-bold text-gray-900",
              children: soldListings.length
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "card p-6",
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-sm text-gray-500",
              children: "Conversations"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-2 text-3xl font-bold text-gray-900",
              children: conversations.length
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "card p-6",
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-sm text-gray-500",
              children: "Unread Messages"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-2 text-3xl font-bold text-brand-600",
              children: unreadCount
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "grid gap-8 lg:grid-cols-2",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "card",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "p-6 border-b border-gray-100 flex items-center justify-between",
              children: [/* @__PURE__ */ jsx("h2", {
                className: "font-display text-lg font-semibold text-gray-900",
                children: "My Listings"
              }), /* @__PURE__ */ jsx(Link, {
                to: "/listings/new",
                className: "text-sm font-medium text-brand-600 hover:text-brand-700",
                children: "+ New Listing"
              })]
            }), listings.length > 0 ? /* @__PURE__ */ jsx("div", {
              className: "p-4 space-y-3",
              children: listings.slice(0, 5).map((listing) => /* @__PURE__ */ jsxs("div", {
                className: "relative",
                children: [/* @__PURE__ */ jsx(ListingCardCompact, {
                  listing,
                  isUserLoggedIn: true
                }), /* @__PURE__ */ jsx("div", {
                  className: "absolute top-3 right-3",
                  children: /* @__PURE__ */ jsx("span", {
                    className: `px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ${statusColors$2[listing.status]}`,
                    children: listing.status
                  })
                })]
              }, listing.id))
            }) : /* @__PURE__ */ jsxs("div", {
              className: "p-8 text-center",
              children: [/* @__PURE__ */ jsx("p", {
                className: "text-gray-500",
                children: "No listings yet"
              }), /* @__PURE__ */ jsx(Link, {
                to: "/listings/new",
                className: "mt-4 inline-block text-brand-600 hover:text-brand-700 font-medium",
                children: "Create your first listing →"
              })]
            }), listings.length > 5 && /* @__PURE__ */ jsx("div", {
              className: "p-4 border-t border-gray-100",
              children: /* @__PURE__ */ jsxs(Link, {
                to: "/my-listings",
                className: "text-sm text-gray-600 hover:text-gray-900",
                children: ["View all ", listings.length, " listings →"]
              })
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "card",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "p-6 border-b border-gray-100 flex items-center justify-between",
              children: [/* @__PURE__ */ jsx("h2", {
                className: "font-display text-lg font-semibold text-gray-900",
                children: "Recent Messages"
              }), /* @__PURE__ */ jsx(Link, {
                to: "/messages",
                className: "text-sm font-medium text-brand-600 hover:text-brand-700",
                children: "View All"
              })]
            }), conversations.length > 0 ? /* @__PURE__ */ jsx("div", {
              className: "divide-y divide-gray-100",
              children: conversations.map((conv) => {
                var _a2, _b, _c;
                const lastMessage = (_a2 = conv.messages) == null ? void 0 : _a2[conv.messages.length - 1];
                const hasUnread = (_b = conv.messages) == null ? void 0 : _b.some((m) => m.sender_id !== user.id && !m.read_at);
                return /* @__PURE__ */ jsx(Link, {
                  to: `/messages/${conv.id}`,
                  className: "block p-4 hover:bg-gray-50 transition-colors",
                  children: /* @__PURE__ */ jsxs("div", {
                    className: "flex items-center justify-between",
                    children: [/* @__PURE__ */ jsxs("div", {
                      className: "min-w-0 flex-1",
                      children: [/* @__PURE__ */ jsx("p", {
                        className: `font-medium truncate ${hasUnread ? "text-gray-900" : "text-gray-600"}`,
                        children: ((_c = conv.listing) == null ? void 0 : _c.title) || "Conversation"
                      }), lastMessage && /* @__PURE__ */ jsx("p", {
                        className: "text-sm text-gray-500 mt-1 truncate",
                        children: lastMessage.content
                      })]
                    }), hasUnread && /* @__PURE__ */ jsx("span", {
                      className: "ml-4 h-2.5 w-2.5 rounded-full bg-brand-500"
                    })]
                  })
                }, conv.id);
              })
            }) : /* @__PURE__ */ jsxs("div", {
              className: "p-8 text-center",
              children: [/* @__PURE__ */ jsx("p", {
                className: "text-gray-500",
                children: "No conversations yet"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-400 mt-1",
                children: "Start by browsing listings"
              })]
            })]
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "mt-8 card p-6",
          children: /* @__PURE__ */ jsxs("div", {
            className: "flex items-center justify-between",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-4",
              children: [/* @__PURE__ */ jsx("div", {
                className: "flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-2xl",
                children: ((_a = user.full_name) == null ? void 0 : _a.charAt(0)) || user.email.charAt(0).toUpperCase()
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("p", {
                  className: "font-semibold text-gray-900 text-lg",
                  children: user.full_name || user.email
                }), /* @__PURE__ */ jsx("p", {
                  className: "text-gray-500",
                  children: user.user_type === "tour_operator" ? user.company_name || "Tour Operator" : "Private Runner"
                }), /* @__PURE__ */ jsx("div", {
                  className: "flex items-center gap-2 mt-1",
                  children: user.is_verified ? /* @__PURE__ */ jsxs("span", {
                    className: "inline-flex items-center gap-1 text-sm text-brand-600",
                    children: [/* @__PURE__ */ jsx("svg", {
                      className: "h-4 w-4",
                      fill: "currentColor",
                      viewBox: "0 0 20 20",
                      children: /* @__PURE__ */ jsx("path", {
                        fillRule: "evenodd",
                        d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                        clipRule: "evenodd"
                      })
                    }), "Verified"]
                  }) : /* @__PURE__ */ jsx("span", {
                    className: "text-sm text-gray-400",
                    children: "Not verified"
                  })
                })]
              })]
            }), /* @__PURE__ */ jsx(Link, {
              to: "/profile",
              className: "btn-secondary",
              children: "Edit Profile"
            })]
          })
        })]
      })]
    })
  });
});
const route25 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: dashboard,
  loader: loader$i,
  meta: meta$h
}, Symbol.toStringTag, { value: "Module" }));
const POLL_INTERVAL$1 = 5e3;
function useRealtimeConversations({
  userId,
  initialConversations
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const fetcher = useFetcher();
  const isPollingRef = useRef(false);
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);
  useEffect(() => {
    var _a;
    if (((_a = fetcher.data) == null ? void 0 : _a.conversations) && fetcher.state === "idle") {
      setConversations(fetcher.data.conversations);
    }
  }, [fetcher.data, fetcher.state]);
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const poll = () => {
      if (isPollingRef.current) return;
      if (fetcher.state !== "idle") return;
      isPollingRef.current = true;
      fetcher.load("/api/conversations");
      isPollingRef.current = false;
    };
    const intervalId = setInterval(poll, POLL_INTERVAL$1);
    return () => {
      clearInterval(intervalId);
    };
  }, [userId, fetcher]);
  return { conversations, setConversations };
}
const AVATAR_COLORS = [
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700" }
];
const TOUR_OPERATOR_COLOR = { bg: "bg-accent-500", text: "text-white" };
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
function getAvatarColor(userId, userType) {
  if (userType === "tour_operator") {
    return TOUR_OPERATOR_COLOR;
  }
  const index = hashString(userId) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
function getAvatarClasses(userId, userType) {
  const colors = getAvatarColor(userId, userType);
  return `${colors.bg} ${colors.text}`;
}
async function loader$h({
  request
}) {
  const user = await requireUser(request);
  const userId = user.id;
  const url = new URL(request.url);
  const {
    data: allConversations
  } = await supabaseAdmin.from("conversations").select(`
      *,
      listing:listings(id, title, listing_type, author_id),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type),
      messages(id, content, sender_id, created_at, read_at, message_type, detected_language, translated_content, translated_to)
    `).or(`participant_1.eq.${userId},participant_2.eq.${userId}`).order("updated_at", {
    ascending: false
  });
  const conversations = (allConversations || []).filter((conv) => {
    var _a;
    if (conv.activated) return true;
    return ((_a = conv.listing) == null ? void 0 : _a.author_id) === userId;
  });
  const userAgent = request.headers.get("user-agent") || "";
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  if (url.pathname === "/messages" && conversations && conversations.length > 0 && !isMobile) {
    return redirect(`/messages/${conversations[0].id}`);
  }
  return {
    user,
    conversations: conversations || []
  };
}
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = /* @__PURE__ */ new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 6e4);
  const diffHours = Math.floor(diffMs / 36e5);
  const diffDays = Math.floor(diffMs / 864e5);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}
const messages = UNSAFE_withComponentProps(function MessagesLayout() {
  const {
    user,
    conversations: initialConversations
  } = useLoaderData();
  const params = useParams();
  const activeConversationId = params.id;
  const {
    conversations
  } = useRealtimeConversations({
    userId: user.id,
    initialConversations
  });
  return /* @__PURE__ */ jsxs("div", {
    className: "messages-page h-[calc(100dvh-4rem)] md:h-screen flex flex-col bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsx("div", {
      className: "flex-1 overflow-hidden bg-cover bg-center bg-no-repeat bg-fixed",
      style: {
        backgroundImage: "url('/messages.webp')"
      },
      children: /* @__PURE__ */ jsx("div", {
        className: "h-full bg-gray-50/70",
        children: /* @__PURE__ */ jsx("div", {
          className: "mx-auto max-w-7xl h-full px-0 md:px-4 lg:px-8 py-0 md:py-8",
          children: /* @__PURE__ */ jsxs("div", {
            className: "flex h-full md:rounded-lg shadow-xl overflow-hidden",
            children: [/* @__PURE__ */ jsxs("aside", {
              className: `w-full md:w-80 lg:w-96 bg-white/95 backdrop-blur-sm md:rounded-l-lg flex flex-col overflow-hidden border-r border-gray-200 ${activeConversationId ? "hidden md:flex" : "flex"}`,
              children: [/* @__PURE__ */ jsx("div", {
                className: "p-4 border-b border-gray-200 flex items-center h-[72px]",
                children: /* @__PURE__ */ jsx("h1", {
                  className: "font-display text-xl font-bold text-gray-900",
                  children: "Chat"
                })
              }), /* @__PURE__ */ jsx("div", {
                className: "flex-1 overflow-y-auto",
                children: conversations.length > 0 ? /* @__PURE__ */ jsx("div", {
                  className: "divide-y divide-gray-200",
                  children: conversations.map((conv) => {
                    var _a, _b, _c, _d;
                    const otherUser = conv.participant_1 === user.id ? conv.participant2 : conv.participant1;
                    const sortedMessages = [...conv.messages || []].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    const lastMessage = sortedMessages[0];
                    const unreadCount = (_a = conv.messages) == null ? void 0 : _a.filter((m) => m.sender_id !== user.id && !m.read_at).length;
                    const isActive = conv.id === activeConversationId;
                    return /* @__PURE__ */ jsxs(Link, {
                      to: `/messages/${conv.id}`,
                      className: `flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors ${isActive ? "bg-gray-100" : ""}`,
                      children: [/* @__PURE__ */ jsx("div", {
                        className: `flex h-12 w-12 items-center justify-center rounded-full font-semibold flex-shrink-0 ${isActive ? "bg-brand-500 text-white" : getAvatarClasses((otherUser == null ? void 0 : otherUser.id) || "", otherUser == null ? void 0 : otherUser.user_type)}`,
                        children: ((_b = otherUser == null ? void 0 : otherUser.company_name) == null ? void 0 : _b.charAt(0)) || ((_c = otherUser == null ? void 0 : otherUser.full_name) == null ? void 0 : _c.charAt(0)) || "?"
                      }), /* @__PURE__ */ jsxs("div", {
                        className: "min-w-0 flex-1",
                        children: [/* @__PURE__ */ jsxs("div", {
                          className: "flex items-center justify-between gap-2",
                          children: [/* @__PURE__ */ jsx("p", {
                            className: `font-medium truncate text-sm ${unreadCount > 0 ? "text-gray-900" : "text-gray-600"}`,
                            children: (otherUser == null ? void 0 : otherUser.company_name) || (otherUser == null ? void 0 : otherUser.full_name) || "User"
                          }), lastMessage && /* @__PURE__ */ jsx("span", {
                            className: "text-xs text-gray-400 flex-shrink-0",
                            children: formatTimeAgo(lastMessage.created_at)
                          })]
                        }), /* @__PURE__ */ jsx("p", {
                          className: "text-xs text-gray-500 truncate",
                          children: ((_d = conv.listing) == null ? void 0 : _d.title) || "Listing"
                        }), lastMessage && /* @__PURE__ */ jsx("p", {
                          className: `text-sm truncate mt-0.5 ${unreadCount > 0 ? "text-gray-900 font-medium" : "text-gray-500"}`,
                          children: lastMessage.sender_id === user.id ? /* @__PURE__ */ jsxs(Fragment, {
                            children: [/* @__PURE__ */ jsx("span", {
                              className: "text-gray-400",
                              children: "You: "
                            }), lastMessage.message_type === "heart" ? "Listing saved" : lastMessage.content]
                          }) : lastMessage.message_type === "heart" ? "Listing saved" : lastMessage.translated_content || "New message"
                        })]
                      }), unreadCount > 0 && !isActive && /* @__PURE__ */ jsx("div", {
                        className: "h-3 w-3 rounded-full bg-red-500 flex-shrink-0"
                      })]
                    }, conv.id);
                  })
                }) : /* @__PURE__ */ jsxs("div", {
                  className: "p-8 text-center",
                  children: [/* @__PURE__ */ jsx("svg", {
                    className: "mx-auto h-12 w-12 text-gray-300",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 1.5,
                      d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    })
                  }), /* @__PURE__ */ jsx("p", {
                    className: "mt-4 text-sm text-gray-500",
                    children: "No messages yet"
                  }), /* @__PURE__ */ jsx(Link, {
                    to: "/listings",
                    className: "mt-4 btn-primary inline-block text-sm",
                    children: "Browse Listings"
                  })]
                })
              }), /* @__PURE__ */ jsx("div", {
                className: "md:hidden",
                children: /* @__PURE__ */ jsx(FooterLight, {})
              })]
            }), /* @__PURE__ */ jsx("main", {
              className: `flex-1 flex flex-col min-w-0 overflow-hidden ${activeConversationId ? "flex" : "hidden md:flex"}`,
              children: /* @__PURE__ */ jsx(Outlet, {
                context: {
                  user,
                  conversations
                }
              })
            })]
          })
        })
      })
    })]
  });
});
const route26 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: messages,
  loader: loader$h
}, Symbol.toStringTag, { value: "Module" }));
const meta$g = () => {
  return [{
    title: "Messages - Runoot"
  }];
};
const messages__index = UNSAFE_withComponentProps(function MessagesIndex() {
  return /* @__PURE__ */ jsx("div", {
    className: "hidden md:flex flex-1 items-center justify-center bg-white/95 backdrop-blur-sm rounded-r-lg",
    children: /* @__PURE__ */ jsxs("div", {
      className: "text-center p-8",
      children: [/* @__PURE__ */ jsx("svg", {
        className: "mx-auto h-16 w-16 text-gray-300",
        fill: "none",
        viewBox: "0 0 24 24",
        stroke: "currentColor",
        children: /* @__PURE__ */ jsx("path", {
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeWidth: 1,
          d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        })
      }), /* @__PURE__ */ jsx("h2", {
        className: "mt-4 text-lg font-medium text-gray-900",
        children: "Select a conversation"
      }), /* @__PURE__ */ jsx("p", {
        className: "mt-2 text-sm text-gray-500",
        children: "Choose a conversation from the list to start messaging"
      })]
    })
  });
});
const route27 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: messages__index,
  meta: meta$g
}, Symbol.toStringTag, { value: "Module" }));
const POLL_INTERVAL = 3e3;
function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio("/ding-sound.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {
    });
  } catch {
  }
}
function useRealtimeMessages({
  conversationId,
  initialMessages,
  currentUserId,
  onNewMessage
}) {
  const [messages2, setMessages] = useState(initialMessages);
  const fetcher = useFetcher();
  const isPollingRef = useRef(false);
  const previousMessageCountRef = useRef(initialMessages.length);
  useEffect(() => {
    setMessages(initialMessages);
    previousMessageCountRef.current = initialMessages.length;
  }, [conversationId]);
  useEffect(() => {
    var _a;
    if (((_a = fetcher.data) == null ? void 0 : _a.messages) && fetcher.state === "idle") {
      const serverMessages = fetcher.data.messages;
      setMessages((currentMessages) => {
        const tempMessages = currentMessages.filter((m) => m.id.startsWith("temp-"));
        const unconfirmedTempMessages = tempMessages.filter((tempMsg) => {
          const isConfirmed = serverMessages.some(
            (serverMsg) => serverMsg.sender_id === tempMsg.sender_id && serverMsg.content === tempMsg.content
          );
          return !isConfirmed;
        });
        if (previousMessageCountRef.current < serverMessages.length) {
          const newServerMessages = serverMessages.slice(previousMessageCountRef.current);
          let hasNewMessageFromOther = false;
          newServerMessages.forEach((msg) => {
            if (msg.sender_id !== currentUserId) {
              onNewMessage == null ? void 0 : onNewMessage(msg);
              hasNewMessageFromOther = true;
            }
          });
          if (hasNewMessageFromOther) {
            playNotificationSound();
          }
        }
        previousMessageCountRef.current = serverMessages.length;
        if (unconfirmedTempMessages.length > 0) {
          return [...serverMessages, ...unconfirmedTempMessages].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        }
        return serverMessages;
      });
    }
  }, [fetcher.data, fetcher.state, currentUserId, onNewMessage]);
  useEffect(() => {
    if (!conversationId || typeof window === "undefined") return;
    const poll = () => {
      if (isPollingRef.current) return;
      if (fetcher.state !== "idle") return;
      isPollingRef.current = true;
      fetcher.load(`/api/messages/${conversationId}`);
      isPollingRef.current = false;
    };
    const intervalId = setInterval(poll, POLL_INTERVAL);
    return () => {
      clearInterval(intervalId);
    };
  }, [conversationId, fetcher]);
  return {
    messages: messages2,
    isConnected: true,
    setMessages
  };
}
function useTranslation({ userId, messages: messages2, enabled = true }) {
  const [translations, setTranslations] = useState({});
  const [browserLanguage, setBrowserLanguage] = useState("en");
  const pendingTranslations = useRef(/* @__PURE__ */ new Set());
  useEffect(() => {
    var _a;
    const lang = ((_a = navigator.language) == null ? void 0 : _a.split("-")[0]) || "en";
    setBrowserLanguage(lang);
  }, []);
  const translateMessage = useCallback(
    async (message) => {
      const messageId = message.id;
      if (messageId.startsWith("temp-")) return;
      if (message.sender_id === userId) return;
      if (pendingTranslations.current.has(messageId)) return;
      if (message.translated_content && message.translated_to === browserLanguage) {
        setTranslations((prev) => ({
          ...prev,
          [messageId]: {
            translatedContent: message.translated_content,
            detectedLanguage: message.detected_language || null,
            isLoading: false,
            error: null,
            showOriginal: false
          }
        }));
        return;
      }
      if (message.detected_language === browserLanguage) {
        setTranslations((prev) => ({
          ...prev,
          [messageId]: {
            translatedContent: null,
            detectedLanguage: message.detected_language,
            isLoading: false,
            error: null,
            showOriginal: false
          }
        }));
        return;
      }
      pendingTranslations.current.add(messageId);
      setTranslations((prev) => ({
        ...prev,
        [messageId]: {
          translatedContent: null,
          detectedLanguage: null,
          isLoading: true,
          error: null,
          showOriginal: false
        }
      }));
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            targetLanguage: browserLanguage
          })
        });
        const data2 = await response.json();
        if (!response.ok) {
          throw new Error(data2.error || "Translation failed");
        }
        setTranslations((prev) => ({
          ...prev,
          [messageId]: {
            translatedContent: data2.translatedContent,
            detectedLanguage: data2.detectedLanguage,
            isLoading: false,
            error: null,
            showOriginal: false
          }
        }));
      } catch (error) {
        console.error("Translation error:", error);
        setTranslations((prev) => ({
          ...prev,
          [messageId]: {
            translatedContent: null,
            detectedLanguage: null,
            isLoading: false,
            error: error instanceof Error ? error.message : "Translation failed",
            showOriginal: false
          }
        }));
      } finally {
        pendingTranslations.current.delete(messageId);
      }
    },
    [userId, browserLanguage]
  );
  useEffect(() => {
    if (!enabled) return;
    messages2.forEach((message) => {
      var _a, _b;
      if (((_a = translations[message.id]) == null ? void 0 : _a.translatedContent) !== void 0) return;
      if ((_b = translations[message.id]) == null ? void 0 : _b.isLoading) return;
      translateMessage(message);
    });
  }, [messages2, enabled, translateMessage, translations]);
  const toggleShowOriginal = useCallback((messageId) => {
    setTranslations((prev) => {
      var _a;
      return {
        ...prev,
        [messageId]: {
          ...prev[messageId],
          showOriginal: !((_a = prev[messageId]) == null ? void 0 : _a.showOriginal)
        }
      };
    });
  }, []);
  const getDisplayContent = useCallback(
    (message) => {
      const state = translations[message.id];
      if (message.sender_id === userId) {
        return {
          content: message.content,
          isTranslated: false,
          isLoading: false,
          showOriginal: false,
          canToggle: false
        };
      }
      if (!state) {
        return {
          content: message.content,
          isTranslated: false,
          isLoading: false,
          showOriginal: false,
          canToggle: false
        };
      }
      if (state.isLoading) {
        return {
          content: message.content,
          isTranslated: false,
          isLoading: true,
          showOriginal: false,
          canToggle: false
        };
      }
      if (!state.translatedContent) {
        return {
          content: message.content,
          isTranslated: false,
          isLoading: false,
          showOriginal: false,
          canToggle: false
        };
      }
      if (state.showOriginal) {
        return {
          content: message.content,
          isTranslated: false,
          isLoading: false,
          showOriginal: true,
          canToggle: true,
          originalContent: message.content,
          translatedContent: state.translatedContent
        };
      }
      return {
        content: state.translatedContent,
        isTranslated: true,
        isLoading: false,
        showOriginal: false,
        canToggle: true,
        originalContent: message.content,
        translatedContent: state.translatedContent
      };
    },
    [translations, userId]
  );
  return {
    translations,
    browserLanguage,
    translateMessage,
    toggleShowOriginal,
    getDisplayContent
  };
}
const meta$f = () => {
  return [{
    title: "Conversation - Runoot"
  }];
};
function getEventSlug(event) {
  if (!event) return "";
  if (event.slug) return event.slug;
  return event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
async function loader$g({
  request,
  params
}) {
  var _a;
  const user = await requireUser(request);
  const userId = user.id;
  const {
    id
  } = params;
  const {
    data: conversation,
    error
  } = await supabaseAdmin.from("conversations").select(`
      *,
      listing:listings(id, title, listing_type, status, event:events(id, name, slug)),
      participant1:profiles!conversations_participant_1_fkey(id, full_name, company_name, user_type, is_verified),
      participant2:profiles!conversations_participant_2_fkey(id, full_name, company_name, user_type, is_verified),
      messages(id, content, sender_id, created_at, read_at, message_type, detected_language, translated_content, translated_to)
    `).eq("id", id).single();
  if (error || !conversation) {
    throw new Response("Conversation not found", {
      status: 404
    });
  }
  if (conversation.participant_1 !== userId && conversation.participant_2 !== userId) {
    throw new Response("Unauthorized", {
      status: 403
    });
  }
  const otherUserId = conversation.participant_1 === userId ? conversation.participant_2 : conversation.participant_1;
  const {
    data: blockData
  } = await supabaseAdmin.from("blocked_users").select("id").eq("blocker_id", userId).eq("blocked_id", otherUserId).single();
  const isBlocked = !!blockData;
  const unreadMessageIds = (_a = conversation.messages) == null ? void 0 : _a.filter((m) => m.sender_id !== userId && !m.read_at).map((m) => m.id);
  if ((unreadMessageIds == null ? void 0 : unreadMessageIds.length) > 0) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    conversation.messages = conversation.messages.map((m) => {
      if (unreadMessageIds.includes(m.id)) {
        return {
          ...m,
          read_at: now
        };
      }
      return m;
    });
    supabaseAdmin.from("messages").update({
      read_at: now
    }).in("id", unreadMessageIds).then(() => {
    });
  }
  const sortedMessages = [...conversation.messages || []].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return {
    user,
    conversation: {
      ...conversation,
      messages: sortedMessages
    },
    isBlocked
  };
}
async function action$d({
  request,
  params
}) {
  var _a;
  const user = await requireUser(request);
  const userId = user.id;
  const {
    id
  } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const {
    data: conversation
  } = await supabaseAdmin.from("conversations").select("participant_1, participant_2, activated, listing:listings(author_id)").eq("id", id).single();
  if (!conversation || conversation.participant_1 !== userId && conversation.participant_2 !== userId) {
    return data({
      error: "Unauthorized"
    }, {
      status: 403
    });
  }
  const otherUserId = conversation.participant_1 === userId ? conversation.participant_2 : conversation.participant_1;
  const isListingOwner = ((_a = conversation.listing) == null ? void 0 : _a.author_id) === userId;
  if (intent === "block") {
    const {
      error: error2
    } = await supabaseAdmin.from("blocked_users").insert({
      blocker_id: userId,
      blocked_id: otherUserId
    });
    if (error2 && !error2.message.includes("duplicate")) {
      return data({
        error: "Failed to block user"
      }, {
        status: 500
      });
    }
    return data({
      success: true,
      action: "blocked"
    });
  }
  if (intent === "unblock") {
    await supabaseAdmin.from("blocked_users").delete().eq("blocker_id", userId).eq("blocked_id", otherUserId);
    return data({
      success: true,
      action: "unblocked"
    });
  }
  if (intent === "delete") {
    const isParticipant1 = conversation.participant_1 === userId;
    await supabaseAdmin.from("conversations").update(isParticipant1 ? {
      deleted_by_1: true
    } : {
      deleted_by_2: true
    }).eq("id", id);
    return redirect("/messages");
  }
  const content = formData.get("content");
  if (typeof content !== "string" || !content.trim()) {
    return data({
      error: "Message cannot be empty"
    }, {
      status: 400
    });
  }
  const {
    error
  } = await supabaseAdmin.from("messages").insert({
    conversation_id: id,
    sender_id: userId,
    content: content.trim(),
    message_type: "user"
  });
  if (error) {
    return data({
      error: "Failed to send message"
    }, {
      status: 500
    });
  }
  if (isListingOwner && !conversation.activated) {
    await supabaseAdmin.from("conversations").update({
      activated: true,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id);
  } else {
    await supabaseAdmin.from("conversations").update({
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id);
  }
  return data({
    success: true
  });
}
const messages_$id = UNSAFE_withComponentProps(function Conversation() {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const {
    user,
    conversation,
    isBlocked
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  useNavigate();
  const formRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef(null);
  const isSubmitting = navigation.state === "submitting";
  const userId = user.id;
  const otherUser = conversation.participant_1 === userId ? conversation.participant2 : conversation.participant1;
  const eventSlug = getEventSlug((_a = conversation.listing) == null ? void 0 : _a.event);
  const [logoFormat, setLogoFormat] = useState("png");
  const logoPath = logoFormat ? `/logos/${eventSlug}.${logoFormat}` : null;
  const {
    messages: realtimeMessages,
    setMessages
  } = useRealtimeMessages({
    conversationId: conversation.id,
    initialMessages: conversation.messages || [],
    currentUserId: userId
  });
  const {
    getDisplayContent,
    toggleShowOriginal
  } = useTranslation({
    userId,
    messages: realtimeMessages,
    enabled: true
  });
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const addOptimisticMessage = (content) => {
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      sender_id: userId,
      content,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      read_at: null
    };
    setMessages((prev) => [...prev, optimisticMessage]);
  };
  useEffect(() => {
    var _a2;
    if (navigation.state === "idle" && actionData && "success" in actionData && actionData.success) {
      (_a2 = formRef.current) == null ? void 0 : _a2.reset();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      setIsMenuOpen(false);
    }
  }, [navigation.state, actionData]);
  useEffect(() => {
    var _a2;
    (_a2 = messagesEndRef.current) == null ? void 0 : _a2.scrollIntoView({
      behavior: "smooth"
    });
  }, [realtimeMessages]);
  const handleTextareaChange = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
  };
  return /* @__PURE__ */ jsxs("div", {
    className: "flex-1 flex flex-col bg-white/95 backdrop-blur-sm md:rounded-r-lg overflow-hidden",
    children: [/* @__PURE__ */ jsxs("div", {
      className: "flex items-center gap-4 p-4 border-b border-gray-200 h-[72px]",
      children: [/* @__PURE__ */ jsx(Link, {
        to: "/messages",
        className: "md:hidden text-gray-400 hover:text-gray-600 flex-shrink-0",
        children: /* @__PURE__ */ jsx("svg", {
          className: "h-6 w-6",
          fill: "none",
          viewBox: "0 0 24 24",
          stroke: "currentColor",
          children: /* @__PURE__ */ jsx("path", {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 2,
            d: "M15 19l-7-7 7-7"
          })
        })
      }), /* @__PURE__ */ jsx("div", {
        className: "flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center",
        children: logoPath ? /* @__PURE__ */ jsx("img", {
          src: logoPath,
          alt: `${((_c = (_b = conversation.listing) == null ? void 0 : _b.event) == null ? void 0 : _c.name) || "Event"} logo`,
          className: "w-full h-full object-contain p-0.5",
          onError: () => {
            if (logoFormat === "png") setLogoFormat("jpg");
            else if (logoFormat === "jpg") setLogoFormat("webp");
            else setLogoFormat(null);
          }
        }) : /* @__PURE__ */ jsx("span", {
          className: "text-xs font-semibold text-gray-400",
          children: ((_f = (_e = (_d = conversation.listing) == null ? void 0 : _d.event) == null ? void 0 : _e.name) == null ? void 0 : _f.substring(0, 2).toUpperCase()) || "?"
        })
      }), /* @__PURE__ */ jsxs("div", {
        className: "min-w-0 flex-1",
        children: [/* @__PURE__ */ jsxs("p", {
          className: "font-medium text-gray-900 truncate flex items-center gap-1",
          children: [(otherUser == null ? void 0 : otherUser.company_name) || (otherUser == null ? void 0 : otherUser.full_name) || "User", (otherUser == null ? void 0 : otherUser.is_verified) && /* @__PURE__ */ jsx("svg", {
            className: "h-4 w-4 text-brand-500",
            fill: "currentColor",
            viewBox: "0 0 20 20",
            children: /* @__PURE__ */ jsx("path", {
              fillRule: "evenodd",
              d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
              clipRule: "evenodd"
            })
          }), isBlocked && /* @__PURE__ */ jsx("span", {
            className: "text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-2",
            children: "Blocked"
          })]
        }), /* @__PURE__ */ jsx(Link, {
          to: `/listings/${(_g = conversation.listing) == null ? void 0 : _g.id}`,
          className: "text-sm text-brand-600 hover:text-brand-700 truncate block",
          children: (_h = conversation.listing) == null ? void 0 : _h.title
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "relative",
        ref: menuRef,
        children: [/* @__PURE__ */ jsx("button", {
          type: "button",
          onClick: () => setIsMenuOpen(!isMenuOpen),
          className: "p-3 -m-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center",
          children: /* @__PURE__ */ jsx("svg", {
            className: "h-5 w-5",
            fill: "currentColor",
            viewBox: "0 0 20 20",
            children: /* @__PURE__ */ jsx("path", {
              d: "M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
            })
          })
        }), isMenuOpen && /* @__PURE__ */ jsxs("div", {
          className: "absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50",
          children: [/* @__PURE__ */ jsxs(Form, {
            method: "post",
            children: [/* @__PURE__ */ jsx("input", {
              type: "hidden",
              name: "intent",
              value: isBlocked ? "unblock" : "block"
            }), /* @__PURE__ */ jsxs("button", {
              type: "submit",
              className: "w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50",
              children: [/* @__PURE__ */ jsx("svg", {
                className: "h-4 w-4 text-gray-400",
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ jsx("path", {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                })
              }), isBlocked ? "Unblock user" : "Block user"]
            })]
          }), /* @__PURE__ */ jsxs(Link, {
            to: `/report?type=user&id=${otherUser == null ? void 0 : otherUser.id}&from=conversation`,
            className: "w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50",
            onClick: () => setIsMenuOpen(false),
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-4 w-4 text-gray-400",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              })
            }), "Report"]
          }), /* @__PURE__ */ jsx("div", {
            className: "border-t border-gray-100 my-1"
          }), /* @__PURE__ */ jsxs("button", {
            type: "button",
            onClick: () => {
              setIsMenuOpen(false);
              setShowDeleteConfirm(true);
            },
            className: "w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "h-4 w-4 text-red-500",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              })
            }), "Delete conversation"]
          })]
        })]
      })]
    }), showDeleteConfirm && /* @__PURE__ */ jsx("div", {
      className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4",
      children: /* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl max-w-sm w-full p-6",
        children: [/* @__PURE__ */ jsx("h3", {
          className: "text-lg font-semibold text-gray-900",
          children: "Delete conversation?"
        }), /* @__PURE__ */ jsx("p", {
          className: "mt-2 text-sm text-gray-600",
          children: "This conversation will be removed from your inbox. The other user will still be able to see it."
        }), /* @__PURE__ */ jsxs("div", {
          className: "mt-4 flex gap-3 justify-end",
          children: [/* @__PURE__ */ jsx("button", {
            type: "button",
            onClick: () => setShowDeleteConfirm(false),
            className: "btn-secondary",
            children: "Cancel"
          }), /* @__PURE__ */ jsxs(Form, {
            method: "post",
            children: [/* @__PURE__ */ jsx("input", {
              type: "hidden",
              name: "intent",
              value: "delete"
            }), /* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "btn-primary bg-red-600 hover:bg-red-700",
              children: "Delete"
            })]
          })]
        })]
      })
    }), /* @__PURE__ */ jsx("div", {
      className: "flex-1 overflow-y-auto px-4 md:px-8 pb-4",
      children: /* @__PURE__ */ jsxs("div", {
        className: "space-y-3",
        children: [realtimeMessages == null ? void 0 : realtimeMessages.map((message, index) => {
          const isOwnMessage = message.sender_id === userId;
          const messageDate = new Date(message.created_at);
          const prevMessage = realtimeMessages[index - 1];
          const prevDate = prevMessage ? new Date(prevMessage.created_at) : null;
          const isHeartMessage = message.message_type === "heart";
          const showDateSeparator = !prevDate || messageDate.toDateString() !== prevDate.toDateString();
          const prevMessageFromSameSender = (prevMessage == null ? void 0 : prevMessage.sender_id) === message.sender_id;
          const timeDiffMinutes = prevDate ? (messageDate.getTime() - prevDate.getTime()) / 6e4 : Infinity;
          const showTimestamp = !prevMessageFromSameSender || timeDiffMinutes > 5 || showDateSeparator;
          const currentDisplayContent = getDisplayContent(message);
          const prevDisplayContent = prevMessage ? getDisplayContent(prevMessage) : null;
          const prevWasTranslatedFromSameSender = prevMessageFromSameSender && (prevDisplayContent == null ? void 0 : prevDisplayContent.canToggle) && !showTimestamp;
          const showTranslationIndicator = currentDisplayContent.canToggle && !prevWasTranslatedFromSameSender;
          return /* @__PURE__ */ jsxs("div", {
            children: [showDateSeparator && /* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-4 my-6",
              children: [/* @__PURE__ */ jsx("div", {
                className: "flex-1 h-px bg-gray-200"
              }), /* @__PURE__ */ jsx("span", {
                className: "text-xs text-gray-400 font-medium",
                children: messageDate.toLocaleDateString([], {
                  weekday: "short",
                  day: "numeric",
                  month: "short"
                })
              }), /* @__PURE__ */ jsx("div", {
                className: "flex-1 h-px bg-gray-200"
              })]
            }), isHeartMessage ? /* @__PURE__ */ jsx("div", {
              className: "flex justify-center my-6",
              children: /* @__PURE__ */ jsxs("div", {
                className: "border border-gray-200 bg-white rounded-2xl px-6 py-4 text-center max-w-sm shadow-sm",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "flex justify-center mb-2",
                  children: /* @__PURE__ */ jsx("svg", {
                    className: "h-8 w-8 text-red-500",
                    fill: "currentColor",
                    viewBox: "0 0 24 24",
                    children: /* @__PURE__ */ jsx("path", {
                      d: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                    })
                  })
                }), /* @__PURE__ */ jsx("p", {
                  className: "text-gray-800 font-medium",
                  children: "Your listing caught someone's eye"
                }), /* @__PURE__ */ jsx("p", {
                  className: "text-gray-500 text-sm mt-1",
                  children: "This user saved your listing. Start a conversation."
                })]
              })
            }) : (() => {
              var _a2, _b2;
              return /* @__PURE__ */ jsxs("div", {
                className: `flex ${isOwnMessage ? "justify-end" : "justify-start"}`,
                children: [!isOwnMessage && /* @__PURE__ */ jsx("div", {
                  className: `flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold mr-2 ${getAvatarClasses((otherUser == null ? void 0 : otherUser.id) || "", otherUser == null ? void 0 : otherUser.user_type)}`,
                  children: ((_a2 = otherUser == null ? void 0 : otherUser.company_name) == null ? void 0 : _a2.charAt(0)) || ((_b2 = otherUser == null ? void 0 : otherUser.full_name) == null ? void 0 : _b2.charAt(0)) || "?"
                }), /* @__PURE__ */ jsxs("div", {
                  className: `flex flex-col ${isOwnMessage ? "items-end" : "items-start"} max-w-[85%] md:max-w-[70%]`,
                  children: [/* @__PURE__ */ jsxs("div", {
                    className: `rounded-2xl px-4 py-2.5 ${isOwnMessage ? "bg-accent-100 text-gray-900 rounded-br-md" : "bg-gray-200 text-gray-900 rounded-bl-md"}`,
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "whitespace-pre-wrap break-words",
                      children: currentDisplayContent.content
                    }), currentDisplayContent.isLoading && /* @__PURE__ */ jsxs("div", {
                      className: "flex items-center gap-1.5 mt-1.5 text-xs text-gray-400",
                      children: [/* @__PURE__ */ jsxs("svg", {
                        className: "animate-spin h-3 w-3",
                        fill: "none",
                        viewBox: "0 0 24 24",
                        children: [/* @__PURE__ */ jsx("circle", {
                          className: "opacity-25",
                          cx: "12",
                          cy: "12",
                          r: "10",
                          stroke: "currentColor",
                          strokeWidth: "4"
                        }), /* @__PURE__ */ jsx("path", {
                          className: "opacity-75",
                          fill: "currentColor",
                          d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        })]
                      }), /* @__PURE__ */ jsx("span", {
                        children: "Translating..."
                      })]
                    })]
                  }), (showTimestamp || isOwnMessage || showTranslationIndicator) && /* @__PURE__ */ jsxs("div", {
                    className: `flex items-center gap-2 text-xs mt-1 px-1 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`,
                    children: [showTimestamp && /* @__PURE__ */ jsx("span", {
                      className: isOwnMessage ? "text-accent-600" : "text-gray-500",
                      children: messageDate.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                    }), isOwnMessage && /* @__PURE__ */ jsx("span", {
                      className: "flex items-center",
                      children: message.read_at ? /* @__PURE__ */ jsx("svg", {
                        className: "w-4 h-4 text-blue-500",
                        fill: "currentColor",
                        viewBox: "0 0 24 24",
                        children: /* @__PURE__ */ jsx("path", {
                          d: "M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"
                        })
                      }) : /* @__PURE__ */ jsx("svg", {
                        className: "w-4 h-4 text-gray-400",
                        fill: "currentColor",
                        viewBox: "0 0 24 24",
                        children: /* @__PURE__ */ jsx("path", {
                          d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
                        })
                      })
                    }), showTranslationIndicator && /* @__PURE__ */ jsxs("button", {
                      type: "button",
                      onClick: () => toggleShowOriginal(message.id),
                      className: "flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors",
                      children: [/* @__PURE__ */ jsx("svg", {
                        className: "h-3 w-3",
                        fill: "none",
                        viewBox: "0 0 24 24",
                        stroke: "currentColor",
                        children: /* @__PURE__ */ jsx("path", {
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          strokeWidth: 2,
                          d: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                        })
                      }), /* @__PURE__ */ jsx("span", {
                        children: currentDisplayContent.showOriginal ? "Show translation" : "Auto-translated • Show original"
                      })]
                    })]
                  })]
                })]
              });
            })()]
          }, message.id);
        }), /* @__PURE__ */ jsx("div", {
          ref: messagesEndRef
        })]
      })
    }), /* @__PURE__ */ jsxs("div", {
      className: "border-t border-gray-200 px-2 pt-4 pb-3 md:p-4 bg-white",
      children: [actionData && "error" in actionData && /* @__PURE__ */ jsx("p", {
        className: "text-sm text-red-600 mb-2",
        children: actionData.error
      }), isBlocked ? /* @__PURE__ */ jsx("p", {
        className: "text-sm text-gray-500 text-center py-2",
        children: "You have blocked this user. Unblock to send messages."
      }) : /* @__PURE__ */ jsxs(Form, {
        ref: formRef,
        method: "post",
        className: "flex gap-2 md:gap-3 items-end",
        onSubmit: () => {
          var _a2;
          const content = (_a2 = textareaRef.current) == null ? void 0 : _a2.value;
          if (content == null ? void 0 : content.trim()) {
            addOptimisticMessage(content.trim());
          }
        },
        children: [/* @__PURE__ */ jsx("textarea", {
          ref: textareaRef,
          name: "content",
          placeholder: "Write a message...",
          autoComplete: "off",
          required: true,
          rows: 1,
          className: "input flex-1 resize-none py-2 md:py-3 px-3 md:px-4 min-h-[40px] md:min-h-[48px] max-h-[150px] overflow-hidden rounded-2xl",
          disabled: isSubmitting,
          onChange: handleTextareaChange
        }), /* @__PURE__ */ jsx("button", {
          type: "submit",
          disabled: isSubmitting,
          className: "btn-primary px-2 md:px-4 h-10 md:h-12 flex items-center justify-center rounded-2xl",
          children: isSubmitting ? /* @__PURE__ */ jsxs("svg", {
            className: "animate-spin h-5 w-5",
            fill: "none",
            viewBox: "0 0 24 24",
            children: [/* @__PURE__ */ jsx("circle", {
              className: "opacity-25",
              cx: "12",
              cy: "12",
              r: "10",
              stroke: "currentColor",
              strokeWidth: "4"
            }), /* @__PURE__ */ jsx("path", {
              className: "opacity-75",
              fill: "currentColor",
              d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            })]
          }) : /* @__PURE__ */ jsx("svg", {
            className: "h-5 w-5",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M14 5l7 7m0 0l-7 7m7-7H3"
            })
          })
        })]
      })]
    })]
  });
});
const route28 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$d,
  default: messages_$id,
  loader: loader$g,
  meta: meta$f
}, Symbol.toStringTag, { value: "Module" }));
const meta$e = () => {
  return [{
    title: "Sign Up - Runoot"
  }];
};
async function loader$f({
  request
}) {
  const userId = await getUserId(request);
  if (userId) return redirect("/dashboard");
  return {};
}
async function action$c({
  request
}) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const fullName = formData.get("fullName");
  const userType = formData.get("userType");
  const companyName = formData.get("companyName");
  if (typeof email !== "string" || typeof password !== "string" || typeof fullName !== "string" || typeof userType !== "string") {
    return data({
      error: "Invalid form submission"
    }, {
      status: 400
    });
  }
  if (!email || !password || !fullName || !userType) {
    return data({
      error: "All fields are required"
    }, {
      status: 400
    });
  }
  if (password.length < 8) {
    return data({
      error: "Password must be at least 8 characters"
    }, {
      status: 400
    });
  }
  const {
    data: authData,
    error: authError
  } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        user_type: userType,
        company_name: userType === "tour_operator" ? companyName : null
      }
    }
  });
  if (authError) {
    return data({
      error: authError.message
    }, {
      status: 400
    });
  }
  if (!authData.user) {
    return data({
      error: "Registration failed. Please try again."
    }, {
      status: 400
    });
  }
  if (!authData.session) {
    return data({
      success: true,
      emailConfirmationRequired: true,
      message: "Please check your email to confirm your account before logging in."
    });
  }
  ({
    id: authData.user.id
  });
  const {
    error: profileError
  } = await supabase.from("profiles").insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    user_type: userType,
    company_name: userType === "tour_operator" && companyName ? companyName : null,
    is_verified: false
  });
  if (profileError) {
    console.error("Profile creation error:", profileError);
  }
  return createUserSession(authData.user.id, authData.session.access_token, authData.session.refresh_token, "/dashboard");
}
const register = UNSAFE_withComponentProps(function Register() {
  const actionData = useActionData();
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50",
    children: [/* @__PURE__ */ jsxs("div", {
      className: "sm:mx-auto sm:w-full sm:max-w-md",
      children: [/* @__PURE__ */ jsx(Link, {
        to: "/",
        className: "flex justify-center",
        children: /* @__PURE__ */ jsx("div", {
          className: "flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600",
          children: /* @__PURE__ */ jsx("svg", {
            className: "h-7 w-7 text-white",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M13 10V3L4 14h7v7l9-11h-7z"
            })
          })
        })
      }), /* @__PURE__ */ jsx("h2", {
        className: "mt-6 text-center font-display text-3xl font-bold tracking-tight text-gray-900",
        children: "Create your account"
      }), /* @__PURE__ */ jsxs("p", {
        className: "mt-2 text-center text-sm text-gray-600",
        children: ["Already have an account?", " ", /* @__PURE__ */ jsx(Link, {
          to: "/login",
          className: "font-medium text-brand-600 hover:text-brand-500",
          children: "Sign in"
        })]
      })]
    }), /* @__PURE__ */ jsx("div", {
      className: "mt-8 sm:mx-auto sm:w-full sm:max-w-md",
      children: /* @__PURE__ */ jsx("div", {
        className: "bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10 border border-gray-200",
        children: actionData && "emailConfirmationRequired" in actionData && actionData.emailConfirmationRequired ? /* @__PURE__ */ jsxs("div", {
          className: "text-center",
          children: [/* @__PURE__ */ jsx("div", {
            className: "mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4",
            children: /* @__PURE__ */ jsx("svg", {
              className: "h-6 w-6 text-green-600",
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              })
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-2",
            children: "Check your email"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-sm text-gray-600 mb-6",
            children: "message" in actionData ? actionData.message : "Please check your email to confirm your account."
          }), /* @__PURE__ */ jsx(Link, {
            to: "/login",
            className: "btn-primary inline-block",
            children: "Go to login"
          })]
        }) : /* @__PURE__ */ jsxs(Form, {
          method: "post",
          className: "space-y-6",
          children: [actionData && "error" in actionData && actionData.error && /* @__PURE__ */ jsx("div", {
            className: "rounded-lg bg-red-50 p-4 text-sm text-red-700",
            children: "error" in actionData ? actionData.error : ""
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "fullName",
              className: "label",
              children: "Full name"
            }), /* @__PURE__ */ jsx("input", {
              id: "fullName",
              name: "fullName",
              type: "text",
              autoComplete: "name",
              required: true,
              className: "input"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "email",
              className: "label",
              children: "Email address"
            }), /* @__PURE__ */ jsx("input", {
              id: "email",
              name: "email",
              type: "email",
              autoComplete: "email",
              required: true,
              className: "input"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "password",
              className: "label",
              children: "Password"
            }), /* @__PURE__ */ jsx("input", {
              id: "password",
              name: "password",
              type: "password",
              autoComplete: "new-password",
              required: true,
              minLength: 8,
              className: "input"
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-1 text-xs text-gray-500",
              children: "At least 8 characters"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              className: "label",
              children: "I am a"
            }), /* @__PURE__ */ jsxs("div", {
              className: "mt-2 grid grid-cols-2 gap-3",
              children: [/* @__PURE__ */ jsxs("label", {
                className: "relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "radio",
                  name: "userType",
                  value: "tour_operator",
                  className: "sr-only",
                  defaultChecked: true
                }), /* @__PURE__ */ jsx("span", {
                  className: "flex flex-1",
                  children: /* @__PURE__ */ jsxs("span", {
                    className: "flex flex-col",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "block text-sm font-medium text-gray-900",
                      children: "Tour Operator"
                    }), /* @__PURE__ */ jsx("span", {
                      className: "mt-1 text-xs text-gray-500",
                      children: "I sell marathon packages"
                    })]
                  })
                })]
              }), /* @__PURE__ */ jsxs("label", {
                className: "relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "radio",
                  name: "userType",
                  value: "private",
                  className: "sr-only"
                }), /* @__PURE__ */ jsx("span", {
                  className: "flex flex-1",
                  children: /* @__PURE__ */ jsxs("span", {
                    className: "flex flex-col",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "block text-sm font-medium text-gray-900",
                      children: "Private Runner"
                    }), /* @__PURE__ */ jsx("span", {
                      className: "mt-1 text-xs text-gray-500",
                      children: "I'm an individual runner"
                    })]
                  })
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            id: "companyField",
            children: [/* @__PURE__ */ jsxs("label", {
              htmlFor: "companyName",
              className: "label",
              children: ["Company name", " ", /* @__PURE__ */ jsx("span", {
                className: "text-gray-400",
                children: "(Tour Operators)"
              })]
            }), /* @__PURE__ */ jsx("input", {
              id: "companyName",
              name: "companyName",
              type: "text",
              className: "input"
            })]
          }), /* @__PURE__ */ jsx("div", {
            children: /* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "btn-primary w-full",
              children: "Create account"
            })
          }), /* @__PURE__ */ jsx("p", {
            className: "text-xs text-gray-500 text-center",
            children: "By signing up, you agree to our Terms of Service and Privacy Policy."
          })]
        })
      })
    })]
  });
});
const route29 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$c,
  default: register,
  loader: loader$f,
  meta: meta$e
}, Symbol.toStringTag, { value: "Module" }));
const meta$d = () => {
  return [{
    title: "Settings - Runoot"
  }];
};
async function loader$e({
  request
}) {
  const user = await requireUser(request);
  const userId = user.id;
  const {
    data: blockedUsers
  } = await supabaseAdmin.from("blocked_users").select(`
      id,
      blocked_id,
      created_at,
      blocked:profiles!blocked_users_blocked_id_fkey(id, full_name, company_name, email)
    `).eq("blocker_id", userId).order("created_at", {
    ascending: false
  });
  return {
    user,
    blockedUsers: blockedUsers || []
  };
}
async function action$b({
  request
}) {
  const user = await requireUser(request);
  const userId = user.id;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const blockedId = formData.get("blocked_id");
  if (intent === "unblock" && typeof blockedId === "string") {
    await supabaseAdmin.from("blocked_users").delete().eq("blocker_id", userId).eq("blocked_id", blockedId);
    return data({
      success: true,
      action: "unblocked"
    });
  }
  return data({
    error: "Invalid action"
  }, {
    status: 400
  });
}
const settings = UNSAFE_withComponentProps(function Settings2() {
  const {
    user,
    blockedUsers
  } = useLoaderData();
  const actionData = useActionData();
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-3xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsx("h1", {
        className: "font-display text-3xl font-bold text-gray-900 mb-8",
        children: "Settings"
      }), /* @__PURE__ */ jsxs("section", {
        className: "card p-6 mb-6",
        children: [/* @__PURE__ */ jsx("h2", {
          className: "text-lg font-semibold text-gray-900 mb-4",
          children: "Account"
        }), /* @__PURE__ */ jsxs("div", {
          className: "space-y-4",
          children: [/* @__PURE__ */ jsx("div", {
            className: "flex items-center justify-between py-3 border-b border-gray-100",
            children: /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("p", {
                className: "font-medium text-gray-900",
                children: "Email"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-500",
                children: user.email
              })]
            })
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex items-center justify-between py-3 border-b border-gray-100",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("p", {
                className: "font-medium text-gray-900",
                children: "Profile"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-500",
                children: "Edit your profile information"
              })]
            }), /* @__PURE__ */ jsx(Link, {
              to: "/profile",
              className: "btn-secondary text-sm",
              children: "Edit"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex items-center justify-between py-3",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("p", {
                className: "font-medium text-gray-900",
                children: "Password"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-500",
                children: "Change your password"
              })]
            }), /* @__PURE__ */ jsx("button", {
              className: "btn-secondary text-sm",
              disabled: true,
              children: "Coming soon"
            })]
          })]
        })]
      }), /* @__PURE__ */ jsxs("section", {
        className: "card p-6 mb-6",
        children: [/* @__PURE__ */ jsx("h2", {
          className: "text-lg font-semibold text-gray-900 mb-4",
          children: "Blocked Users"
        }), actionData && "success" in actionData && /* @__PURE__ */ jsx("div", {
          className: "mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg",
          children: "User has been unblocked successfully."
        }), blockedUsers.length > 0 ? /* @__PURE__ */ jsx("div", {
          className: "divide-y divide-gray-100",
          children: blockedUsers.map((block) => {
            var _a, _b, _c, _d, _e, _f;
            return /* @__PURE__ */ jsxs("div", {
              className: "flex items-center justify-between py-3",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "flex items-center gap-3",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 font-semibold",
                  children: ((_b = (_a = block.blocked) == null ? void 0 : _a.company_name) == null ? void 0 : _b.charAt(0)) || ((_d = (_c = block.blocked) == null ? void 0 : _c.full_name) == null ? void 0 : _d.charAt(0)) || "?"
                }), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("p", {
                    className: "font-medium text-gray-900",
                    children: ((_e = block.blocked) == null ? void 0 : _e.company_name) || ((_f = block.blocked) == null ? void 0 : _f.full_name) || "Unknown user"
                  }), /* @__PURE__ */ jsxs("p", {
                    className: "text-sm text-gray-500",
                    children: ["Blocked on ", new Date(block.created_at).toLocaleDateString()]
                  })]
                })]
              }), /* @__PURE__ */ jsxs(Form, {
                method: "post",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "intent",
                  value: "unblock"
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "blocked_id",
                  value: block.blocked_id
                }), /* @__PURE__ */ jsx("button", {
                  type: "submit",
                  className: "text-sm text-brand-600 hover:text-brand-700 font-medium",
                  children: "Unblock"
                })]
              })]
            }, block.id);
          })
        }) : /* @__PURE__ */ jsx("p", {
          className: "text-gray-500 text-sm",
          children: "You haven't blocked any users."
        })]
      }), /* @__PURE__ */ jsxs("section", {
        className: "card p-6 mb-6",
        children: [/* @__PURE__ */ jsx("h2", {
          className: "text-lg font-semibold text-gray-900 mb-4",
          children: "Notifications"
        }), /* @__PURE__ */ jsx("div", {
          className: "space-y-4",
          children: /* @__PURE__ */ jsxs("div", {
            className: "flex items-center justify-between py-3 border-b border-gray-100",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("p", {
                className: "font-medium text-gray-900",
                children: "Email notifications"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-500",
                children: "Receive email for new messages"
              })]
            }), /* @__PURE__ */ jsx("button", {
              className: "btn-secondary text-sm",
              disabled: true,
              children: "Coming soon"
            })]
          })
        })]
      }), /* @__PURE__ */ jsxs("section", {
        className: "card p-6 mb-6",
        children: [/* @__PURE__ */ jsx("h2", {
          className: "text-lg font-semibold text-gray-900 mb-4",
          children: "Support"
        }), /* @__PURE__ */ jsxs("div", {
          className: "space-y-4",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "flex items-center justify-between py-3 border-b border-gray-100",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("p", {
                className: "font-medium text-gray-900",
                children: "Contact us"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-500",
                children: "Report a problem or send feedback"
              })]
            }), /* @__PURE__ */ jsx(Link, {
              to: "/contact",
              className: "btn-secondary text-sm",
              children: "Contact"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex items-center justify-between py-3",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("p", {
                className: "font-medium text-gray-900",
                children: "Terms & Privacy"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-sm text-gray-500",
                children: "Read our terms and privacy policy"
              })]
            }), /* @__PURE__ */ jsx("button", {
              className: "btn-secondary text-sm",
              disabled: true,
              children: "Coming soon"
            })]
          })]
        })]
      }), /* @__PURE__ */ jsxs("section", {
        className: "card p-6 border-red-200",
        children: [/* @__PURE__ */ jsx("h2", {
          className: "text-lg font-semibold text-red-600 mb-4",
          children: "Danger Zone"
        }), /* @__PURE__ */ jsxs("div", {
          className: "flex items-center justify-between py-3",
          children: [/* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("p", {
              className: "font-medium text-gray-900",
              children: "Delete account"
            }), /* @__PURE__ */ jsx("p", {
              className: "text-sm text-gray-500",
              children: "Permanently delete your account and all data"
            })]
          }), /* @__PURE__ */ jsx("button", {
            className: "btn-secondary text-sm text-red-600 border-red-300 hover:bg-red-50",
            disabled: true,
            children: "Coming soon"
          })]
        })]
      })]
    })]
  });
});
const route30 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$b,
  default: settings,
  loader: loader$e,
  meta: meta$d
}, Symbol.toStringTag, { value: "Module" }));
const SUBJECT_OPTIONS = [
  { value: "general", label: "General inquiry" },
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "partnership", label: "Partnership / Business" },
  { value: "other", label: "Other" }
];
function SubjectDropdown({ value, onChange, hasError }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const selectedOption = SUBJECT_OPTIONS.find((opt) => opt.value === value);
  return /* @__PURE__ */ jsxs("div", { ref: dropdownRef, className: "relative", children: [
    /* @__PURE__ */ jsx("label", { className: "label text-base mb-6", children: "Subject *" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "subject", value }),
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => setIsOpen(!isOpen),
        className: `input shadow-md backdrop-blur-sm w-full text-left flex items-center justify-between gap-3 ${hasError ? "ring-1 ring-red-500" : ""} ${!value ? "text-gray-400" : "text-gray-900"}`,
        children: [
          /* @__PURE__ */ jsx("span", { children: (selectedOption == null ? void 0 : selectedOption.label) || "Select a subject..." }),
          /* @__PURE__ */ jsx(
            "svg",
            {
              className: `h-5 w-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`,
              fill: "none",
              viewBox: "0 0 24 24",
              stroke: "currentColor",
              children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
            }
          )
        ]
      }
    ),
    isOpen && /* @__PURE__ */ jsx("div", { className: "absolute z-50 mt-1 w-full rounded-lg bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)] border border-gray-100 py-1 max-h-60 overflow-auto", children: SUBJECT_OPTIONS.map((option) => /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => {
          onChange(option.value);
          setIsOpen(false);
        },
        className: `w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${value === option.value ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700"}`,
        children: option.label
      },
      option.value
    )) })
  ] });
}
const meta$c = () => {
  return [{
    title: "Contact Us - Runoot"
  }];
};
async function loader$d({
  request
}) {
  const user = await getUser(request);
  return {
    user
  };
}
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function action$a({
  request
}) {
  var _a, _b, _c, _d;
  const user = await getUser(request);
  const formData = await request.formData();
  const name = (_a = formData.get("name")) == null ? void 0 : _a.trim();
  const email = (_b = formData.get("email")) == null ? void 0 : _b.trim();
  const subject = (_c = formData.get("subject")) == null ? void 0 : _c.trim();
  const message = (_d = formData.get("message")) == null ? void 0 : _d.trim();
  if (!user) {
    if (!name || name.length < 2) {
      return data({
        error: "Please provide your name (at least 2 characters)"
      }, {
        status: 400
      });
    }
    if (!email) {
      return data({
        error: "Please provide your email"
      }, {
        status: 400
      });
    }
    if (!emailRegex.test(email)) {
      return data({
        error: "Please provide a valid email address"
      }, {
        status: 400
      });
    }
  }
  if (!subject) {
    return data({
      error: "Please select a subject"
    }, {
      status: 400
    });
  }
  if (!message || message.length < 10) {
    return data({
      error: "Please provide a message (at least 10 characters)"
    }, {
      status: 400
    });
  }
  const {
    error
  } = await supabaseAdmin.from("contact_messages").insert({
    user_id: user ? user.id : null,
    name: user ? user.full_name : name,
    email: user ? user.email : email,
    subject,
    message
  });
  if (error) {
    console.error("Contact form error:", error);
    return data({
      error: "Failed to send message. Please try again."
    }, {
      status: 500
    });
  }
  return data({
    success: true
  });
}
const contact = UNSAFE_withComponentProps(function Contact() {
  var _a;
  const {
    user
  } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [subject, setSubject] = useState("");
  const isSubmitting = navigation.state === "submitting";
  return /* @__PURE__ */ jsx("div", {
    className: "min-h-screen bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed",
    children: /* @__PURE__ */ jsxs("div", {
      className: "min-h-screen bg-gray-50/85",
      children: [/* @__PURE__ */ jsx(Header, {
        user
      }), /* @__PURE__ */ jsxs("main", {
        className: "mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8",
        children: [/* @__PURE__ */ jsxs("button", {
          type: "button",
          onClick: () => window.history.back(),
          className: "mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors",
          children: [/* @__PURE__ */ jsx("svg", {
            className: "h-5 w-5",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M15 19l-7-7 7-7"
            })
          }), "Back"]
        }), /* @__PURE__ */ jsxs("div", {
          className: "mb-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-md p-6",
          children: [/* @__PURE__ */ jsx("h1", {
            className: "font-display text-3xl font-bold text-gray-900",
            children: "Contact Us"
          }), /* @__PURE__ */ jsx("p", {
            className: "mt-2 text-gray-600",
            children: "Send us a message and we'll get back to you"
          })]
        }), actionData && "success" in actionData ? /* @__PURE__ */ jsxs("div", {
          className: "card p-8 text-center shadow-md bg-white/70 backdrop-blur-sm",
          children: [/* @__PURE__ */ jsx("svg", {
            className: "mx-auto h-16 w-16 text-green-500",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            })
          }), /* @__PURE__ */ jsx("h2", {
            className: "mt-4 text-xl font-semibold text-gray-900",
            children: "Thank you!"
          }), /* @__PURE__ */ jsx("p", {
            className: "mt-2 text-gray-600",
            children: "Your message has been received. We'll get back to you soon."
          }), /* @__PURE__ */ jsx("a", {
            href: "/",
            className: "mt-6 btn-primary rounded-full inline-block",
            children: "Back to Home"
          })]
        }) : /* @__PURE__ */ jsxs("div", {
          className: "card p-6 shadow-md bg-white/70 backdrop-blur-sm",
          children: [actionData && "error" in actionData && /* @__PURE__ */ jsx("div", {
            className: "mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm",
            children: actionData.error
          }), /* @__PURE__ */ jsxs(Form, {
            method: "post",
            className: "space-y-6",
            children: [!user && /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "label",
                children: "Name *"
              }), /* @__PURE__ */ jsx("input", {
                type: "text",
                name: "name",
                className: "input shadow-sm",
                placeholder: "Your name",
                required: true,
                minLength: 2
              })]
            }), !user && /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "label",
                children: "Email *"
              }), /* @__PURE__ */ jsx("input", {
                type: "email",
                name: "email",
                className: "input shadow-sm",
                placeholder: "your@email.com",
                required: true
              })]
            }), /* @__PURE__ */ jsx(SubjectDropdown, {
              value: subject,
              onChange: setSubject,
              hasError: actionData && "error" in actionData && ((_a = actionData.error) == null ? void 0 : _a.includes("subject"))
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "label text-base mb-6",
                children: "Message *"
              }), /* @__PURE__ */ jsx("textarea", {
                name: "message",
                rows: 5,
                className: "input shadow-md",
                placeholder: "How can we help you?",
                required: true,
                minLength: 10
              }), /* @__PURE__ */ jsx("p", {
                className: "mt-1 text-sm text-gray-500",
                children: "Minimum 10 characters"
              })]
            }), /* @__PURE__ */ jsx("div", {
              children: /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "btn-primary rounded-full w-full shadow-lg shadow-accent-500/30",
                disabled: isSubmitting,
                children: isSubmitting ? "Sending..." : "Send Message"
              })
            })]
          })]
        })]
      }), /* @__PURE__ */ jsx(FooterLight, {})]
    })
  });
});
const route31 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$a,
  default: contact,
  loader: loader$d,
  meta: meta$c
}, Symbol.toStringTag, { value: "Module" }));
const meta$b = () => {
  return [{
    title: "Runoot - Room & Bibs Exchange Marketplace"
  }, {
    name: "description",
    content: "Exchange unsold hotel rooms and bibs for running events. Connect tour operators and runners."
  }];
};
async function loader$c({
  request
}) {
  const user = await getUser(request);
  const {
    data: listings
  } = await supabase.from("listings").select(`
      *,
      author:profiles(id, full_name, company_name, user_type, is_verified),
      event:events(id, name, slug, country, event_date)
    `).eq("status", "active").order("created_at", {
    ascending: false
  }).limit(3);
  let savedListingIds = [];
  if (user) {
    const {
      data: savedListings
    } = await supabaseAdmin.from("saved_listings").select("listing_id").eq("user_id", user.id);
    savedListingIds = (savedListings == null ? void 0 : savedListings.map((s) => s.listing_id)) || [];
  }
  const {
    data: events
  } = await supabase.from("events").select("id, name, country, event_date").order("event_date", {
    ascending: true
  });
  return {
    user,
    listings: listings || [],
    savedListingIds,
    events: events || []
  };
}
const _index = UNSAFE_withComponentProps(function Index() {
  const {
    user,
    listings,
    savedListingIds,
    events
  } = useLoaderData();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [subjectIndex, setSubjectIndex] = useState(0);
  const [verbIndex, setVerbIndex] = useState(0);
  const [subjectAnimating, setSubjectAnimating] = useState(false);
  const [verbAnimating, setVerbAnimating] = useState(false);
  const words = [{
    subject: "Rooms",
    subjectColor: "text-brand-200",
    verb: "Empty"
  }, {
    subject: "Bibs",
    subjectColor: "text-purple-300",
    verb: "Wasted"
  }];
  useEffect(() => {
    const interval = setInterval(() => {
      setSubjectAnimating(true);
      setTimeout(() => {
        setSubjectIndex((prev) => (prev + 1) % words.length);
        setSubjectAnimating(false);
      }, 600);
      setTimeout(() => {
        setVerbAnimating(true);
        setTimeout(() => {
          setVerbIndex((prev) => (prev + 1) % words.length);
          setVerbAnimating(false);
        }, 600);
      }, 900);
    }, 4e3);
    return () => clearInterval(interval);
  }, []);
  const filteredEvents = searchQuery.length >= 2 ? events.filter((event) => event.name.toLowerCase().includes(searchQuery.toLowerCase()) || event.country.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5) : [];
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleSuggestionClick = (eventName) => {
    setSearchQuery(eventName);
    setShowSuggestions(false);
    navigate(`/listings?search=${encodeURIComponent(eventName)}`);
  };
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("section", {
      className: "relative overflow-hidden",
      children: [/* @__PURE__ */ jsx("div", {
        className: "absolute inset-0 bg-[url('/hero.jpg')] bg-cover bg-center"
      }), /* @__PURE__ */ jsx("div", {
        className: "absolute inset-0 bg-brand-800/70"
      }), /* @__PURE__ */ jsx("div", {
        className: "relative mx-auto max-w-7xl px-4 py-32 sm:py-40 lg:py-48 sm:px-6 lg:px-8",
        children: /* @__PURE__ */ jsxs("div", {
          className: "text-center",
          children: [/* @__PURE__ */ jsxs("h1", {
            className: "font-display text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl [text-shadow:0_4px_20px_rgba(0,0,0,0.7)]",
            children: [/* @__PURE__ */ jsx("span", {
              className: "block",
              children: "Don't Let"
            }), /* @__PURE__ */ jsx("span", {
              className: "block",
              children: /* @__PURE__ */ jsx("span", {
                className: `inline-block ${words[subjectIndex].subjectColor} transition-all duration-500 ${subjectAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`,
                children: words[subjectIndex].subject
              })
            }), /* @__PURE__ */ jsx("span", {
              className: "block",
              children: "Go"
            }), /* @__PURE__ */ jsx("span", {
              className: "block",
              children: /* @__PURE__ */ jsx("span", {
                className: `inline-block text-accent-400 transition-all duration-500 ${verbAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`,
                children: words[verbIndex].verb
              })
            })]
          }), /* @__PURE__ */ jsxs("p", {
            className: "mx-auto mt-6 max-w-2xl text-xl sm:text-2xl text-white [text-shadow:0_4px_16px_rgba(0,0,0,0.6)]",
            children: [/* @__PURE__ */ jsx("span", {
              className: "font-bold",
              children: "Your race, your community."
            }), /* @__PURE__ */ jsx("br", {}), "Exchange rooms and bibs directly with runners like you."]
          }), /* @__PURE__ */ jsx("div", {
            className: "mt-10 mx-auto max-w-xl",
            children: /* @__PURE__ */ jsxs(Form, {
              method: "get",
              action: "/listings",
              className: "flex flex-col items-center gap-8",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "relative w-full",
                ref: searchRef,
                children: [/* @__PURE__ */ jsx("svg", {
                  className: "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10",
                  fill: "none",
                  viewBox: "0 0 24 24",
                  stroke: "currentColor",
                  children: /* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  })
                }), /* @__PURE__ */ jsx("input", {
                  type: "search",
                  name: "search",
                  autoComplete: "off",
                  placeholder: "Search by event name or location...",
                  value: searchQuery,
                  onChange: (e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  },
                  onFocus: () => setShowSuggestions(true),
                  className: "block w-full rounded-full border-0 pl-12 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 transition-colors",
                  style: {
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)"
                  }
                }), showSuggestions && filteredEvents.length > 0 && /* @__PURE__ */ jsx("div", {
                  className: "absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden",
                  children: filteredEvents.map((event) => /* @__PURE__ */ jsxs("button", {
                    type: "button",
                    onClick: () => handleSuggestionClick(event.name),
                    className: "w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors",
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "font-medium text-gray-900",
                      children: event.name
                    }), /* @__PURE__ */ jsxs("p", {
                      className: "text-sm text-gray-500",
                      children: [event.country, " • ", new Date(event.event_date).toLocaleDateString()]
                    })]
                  }, event.id))
                })]
              }), /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "px-8 py-3 bg-accent-500 text-white font-medium rounded-full hover:bg-accent-600 transition-all shadow-lg shadow-accent-500/30",
                children: "Search"
              })]
            })
          })]
        })
      })]
    }), listings.length > 0 && /* @__PURE__ */ jsx("section", {
      className: "pt-8 pb-20 md:py-20 bg-gray-50",
      children: /* @__PURE__ */ jsxs("div", {
        className: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "flex flex-col md:flex-row items-center justify-between",
          children: [/* @__PURE__ */ jsx("h2", {
            className: "font-display text-2xl sm:text-3xl font-bold text-gray-900 text-center md:text-left",
            children: "Recent Listings"
          }), /* @__PURE__ */ jsx(Link, {
            to: user ? "/listings" : "/login",
            className: "hidden md:inline-block px-6 py-2 bg-brand-500 text-white font-medium rounded-full hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/30",
            children: "View all"
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "mt-8 hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3",
          children: listings.map((listing) => /* @__PURE__ */ jsx(ListingCard, {
            listing,
            isUserLoggedIn: !!user,
            isSaved: (savedListingIds || []).includes(listing.id)
          }, listing.id))
        }), /* @__PURE__ */ jsx("div", {
          className: "mt-6 flex flex-col gap-3 md:hidden",
          children: listings.map((listing) => /* @__PURE__ */ jsx(ListingCardCompact, {
            listing,
            isUserLoggedIn: !!user,
            isSaved: (savedListingIds || []).includes(listing.id)
          }, listing.id))
        }), /* @__PURE__ */ jsx("div", {
          className: "mt-4 flex justify-center md:hidden",
          children: /* @__PURE__ */ jsx(Link, {
            to: user ? "/listings" : "/login",
            className: "px-6 py-2 bg-brand-500 text-white font-medium rounded-full hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/30",
            children: "View all"
          })
        })]
      })
    }), /* @__PURE__ */ jsx(FooterLight, {})]
  });
});
const route32 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _index,
  loader: loader$c,
  meta: meta$b
}, Symbol.toStringTag, { value: "Module" }));
async function action$9({
  request
}) {
  return logout(request);
}
async function loader$b() {
  return redirect("/");
}
const route33 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$9,
  loader: loader$b
}, Symbol.toStringTag, { value: "Module" }));
const meta$a = () => {
  return [{
    title: "Report - Runoot"
  }];
};
async function loader$a({
  request
}) {
  const user = await getUser(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "other";
  const reportedId = url.searchParams.get("id");
  const from = url.searchParams.get("from");
  let reportedUser = null;
  if (type === "user" && reportedId) {
    const {
      data: data2
    } = await supabaseAdmin.from("profiles").select("id, full_name, company_name").eq("id", reportedId).single();
    reportedUser = data2;
  }
  let reportedListing = null;
  if (type === "listing" && reportedId) {
    const {
      data: data2
    } = await supabaseAdmin.from("listings").select("id, title").eq("id", reportedId).single();
    reportedListing = data2;
  }
  return {
    user,
    type,
    reportedUser,
    reportedListing,
    from
  };
}
async function action$8({
  request
}) {
  const user = await getUser(request);
  const formData = await request.formData();
  const reportType = formData.get("report_type");
  const reason = formData.get("reason");
  const description = formData.get("description");
  const reportedUserId = formData.get("reported_user_id");
  const reportedListingId = formData.get("reported_listing_id");
  formData.get("email");
  formData.get("name");
  if (!reason || reason.trim() === "") {
    return data({
      error: "Please select a reason"
    }, {
      status: 400
    });
  }
  if (!description || description.trim().length < 10) {
    return data({
      error: "Please provide a description (at least 10 characters)"
    }, {
      status: 400
    });
  }
  if (user) {
    const {
      error
    } = await supabaseAdmin.from("reports").insert({
      reporter_id: user.id,
      report_type: reportType || "other",
      reason,
      description: description.trim(),
      reported_user_id: reportedUserId || null,
      reported_listing_id: reportedListingId || null
    });
    if (error) {
      console.error("Report error:", error);
      return data({
        error: "Failed to submit report. Please try again."
      }, {
        status: 500
      });
    }
  } else {
    return data({
      error: "Please log in to submit a report"
    }, {
      status: 401
    });
  }
  return data({
    success: true
  });
}
const report = UNSAFE_withComponentProps(function Report() {
  const {
    user,
    type,
    reportedUser,
    reportedListing,
    from
  } = useLoaderData();
  const actionData = useActionData();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const reasonOptions = {
    user: [{
      value: "spam",
      label: "Spam or fake account"
    }, {
      value: "harassment",
      label: "Harassment or bullying"
    }, {
      value: "scam",
      label: "Scam or fraud"
    }, {
      value: "inappropriate",
      label: "Inappropriate content"
    }, {
      value: "other",
      label: "Other"
    }],
    listing: [{
      value: "fake",
      label: "Fake or misleading listing"
    }, {
      value: "scam",
      label: "Scam or fraud"
    }, {
      value: "duplicate",
      label: "Duplicate listing"
    }, {
      value: "inappropriate",
      label: "Inappropriate content"
    }, {
      value: "other",
      label: "Other"
    }],
    bug: [{
      value: "ui",
      label: "UI/Display issue"
    }, {
      value: "functionality",
      label: "Feature not working"
    }, {
      value: "performance",
      label: "Slow performance"
    }, {
      value: "other",
      label: "Other"
    }],
    other: [{
      value: "feedback",
      label: "General feedback"
    }, {
      value: "feature",
      label: "Feature request"
    }, {
      value: "question",
      label: "Question"
    }, {
      value: "other",
      label: "Other"
    }]
  };
  const currentReasons = reasonOptions[type] || reasonOptions.other;
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-2xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "mb-8",
        children: [/* @__PURE__ */ jsxs("h1", {
          className: "font-display text-3xl font-bold text-gray-900",
          children: [type === "user" && "Report User", type === "listing" && "Report Listing", type === "bug" && "Report Bug", type === "other" && "Submit Report"]
        }), /* @__PURE__ */ jsx("p", {
          className: "mt-2 text-gray-600",
          children: "Help us keep the community safe by reporting inappropriate content or behavior."
        })]
      }), actionData && "success" in actionData ? /* @__PURE__ */ jsxs("div", {
        className: "card p-8 text-center",
        children: [/* @__PURE__ */ jsx("svg", {
          className: "mx-auto h-16 w-16 text-green-500",
          fill: "none",
          viewBox: "0 0 24 24",
          stroke: "currentColor",
          children: /* @__PURE__ */ jsx("path", {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 2,
            d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          })
        }), /* @__PURE__ */ jsx("h2", {
          className: "mt-4 text-xl font-semibold text-gray-900",
          children: "Thank you!"
        }), /* @__PURE__ */ jsx("p", {
          className: "mt-2 text-gray-600",
          children: "Your message has been received. We'll review it and get back to you if needed."
        }), from === "conversation" ? /* @__PURE__ */ jsx("a", {
          href: "/messages",
          className: "mt-6 btn-primary inline-block",
          children: "Back to Messages"
        }) : /* @__PURE__ */ jsx("a", {
          href: "/",
          className: "mt-6 btn-primary inline-block",
          children: "Back to Home"
        })]
      }) : /* @__PURE__ */ jsxs("div", {
        className: "card p-6",
        children: [actionData && "error" in actionData && /* @__PURE__ */ jsx("div", {
          className: "mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm",
          children: actionData.error
        }), reportedUser && /* @__PURE__ */ jsxs("div", {
          className: "mb-6 p-4 bg-gray-50 rounded-lg",
          children: [/* @__PURE__ */ jsx("p", {
            className: "text-sm text-gray-600",
            children: "Reporting user:"
          }), /* @__PURE__ */ jsx("p", {
            className: "font-medium text-gray-900",
            children: reportedUser.company_name || reportedUser.full_name
          })]
        }), reportedListing && /* @__PURE__ */ jsxs("div", {
          className: "mb-6 p-4 bg-gray-50 rounded-lg",
          children: [/* @__PURE__ */ jsx("p", {
            className: "text-sm text-gray-600",
            children: "Reporting listing:"
          }), /* @__PURE__ */ jsx("p", {
            className: "font-medium text-gray-900",
            children: reportedListing.title
          })]
        }), /* @__PURE__ */ jsxs(Form, {
          method: "post",
          className: "space-y-6",
          children: [/* @__PURE__ */ jsx("input", {
            type: "hidden",
            name: "report_type",
            value: type
          }), reportedUser && /* @__PURE__ */ jsx("input", {
            type: "hidden",
            name: "reported_user_id",
            value: reportedUser.id
          }), reportedListing && /* @__PURE__ */ jsx("input", {
            type: "hidden",
            name: "reported_listing_id",
            value: reportedListing.id
          }), !searchParams.get("type") && /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              className: "label",
              children: "What can we help you with?"
            }), /* @__PURE__ */ jsxs("select", {
              name: "report_type",
              className: "input",
              children: [/* @__PURE__ */ jsx("option", {
                value: "other",
                children: "General inquiry"
              }), /* @__PURE__ */ jsx("option", {
                value: "bug",
                children: "Report a bug"
              }), /* @__PURE__ */ jsx("option", {
                value: "user",
                children: "Report a user"
              }), /* @__PURE__ */ jsx("option", {
                value: "listing",
                children: "Report a listing"
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              className: "label",
              children: "Reason *"
            }), /* @__PURE__ */ jsxs("select", {
              name: "reason",
              className: "input",
              required: true,
              children: [/* @__PURE__ */ jsx("option", {
                value: "",
                children: "Select a reason..."
              }), currentReasons.map((reason) => /* @__PURE__ */ jsx("option", {
                value: reason.value,
                children: reason.label
              }, reason.value))]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              className: "label",
              children: "Description *"
            }), /* @__PURE__ */ jsx("textarea", {
              name: "description",
              rows: 5,
              className: "input",
              placeholder: "Please provide details...",
              required: true,
              minLength: 10
            }), /* @__PURE__ */ jsx("p", {
              className: "mt-1 text-sm text-gray-500",
              children: "Minimum 10 characters"
            })]
          }), !user && /* @__PURE__ */ jsxs(Fragment, {
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "label",
                children: "Your name *"
              }), /* @__PURE__ */ jsx("input", {
                type: "text",
                name: "name",
                className: "input",
                required: true
              })]
            }), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("label", {
                className: "label",
                children: "Your email *"
              }), /* @__PURE__ */ jsx("input", {
                type: "email",
                name: "email",
                className: "input",
                required: true
              })]
            }), /* @__PURE__ */ jsxs("p", {
              className: "text-sm text-amber-600 bg-amber-50 p-3 rounded-lg",
              children: ["Please ", /* @__PURE__ */ jsx("a", {
                href: "/login",
                className: "underline font-medium",
                children: "log in"
              }), " to submit a report."]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex gap-4",
            children: [from === "conversation" ? /* @__PURE__ */ jsx("a", {
              href: "/messages",
              className: "btn-secondary",
              children: "Cancel"
            }) : /* @__PURE__ */ jsx("a", {
              href: "/",
              className: "btn-secondary",
              children: "Cancel"
            }), /* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "btn-primary flex-1",
              disabled: isSubmitting || !user,
              children: isSubmitting ? "Submitting..." : "Submit"
            })]
          })]
        })]
      })]
    })]
  });
});
const route34 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$8,
  default: report,
  loader: loader$a,
  meta: meta$a
}, Symbol.toStringTag, { value: "Module" }));
async function loader$9({
  request
}) {
  const admin2 = await requireAdmin(request);
  const {
    count: pendingCount
  } = await supabaseAdmin.from("listings").select("*", {
    count: "exact",
    head: true
  }).eq("status", "pending");
  return {
    admin: admin2,
    pendingCount: pendingCount || 0
  };
}
const navItems = [{
  to: "/admin",
  label: "Dashboard",
  icon: /* @__PURE__ */ jsx("svg", {
    className: "w-5 h-5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ jsx("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    })
  }),
  exact: true
}, {
  to: "/admin/users",
  label: "Users",
  icon: /* @__PURE__ */ jsx("svg", {
    className: "w-5 h-5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ jsx("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    })
  })
}, {
  to: "/admin/listings",
  label: "Listings",
  icon: /* @__PURE__ */ jsx("svg", {
    className: "w-5 h-5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ jsx("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    })
  })
}, {
  to: "/admin/impersonate",
  label: "Impersonate",
  icon: /* @__PURE__ */ jsxs("svg", {
    className: "w-5 h-5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
    children: [/* @__PURE__ */ jsx("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    }), /* @__PURE__ */ jsx("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    })]
  })
}, {
  to: "/admin/team-leaders",
  label: "Team Leaders",
  icon: /* @__PURE__ */ jsx("svg", {
    className: "w-5 h-5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ jsx("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    })
  })
}, {
  to: "/admin/pending",
  label: "Pending",
  icon: /* @__PURE__ */ jsx("svg", {
    className: "w-5 h-5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
    children: /* @__PURE__ */ jsx("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    })
  })
}];
const admin = UNSAFE_withComponentProps(function AdminLayout() {
  var _a;
  const {
    admin: admin2,
    pendingCount
  } = useLoaderData();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  function isActive(to, exact) {
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to);
  }
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-screen bg-gray-100 flex",
    children: [sidebarOpen && /* @__PURE__ */ jsx("div", {
      className: "fixed inset-0 bg-black/50 z-40 md:hidden",
      onClick: () => setSidebarOpen(false)
    }), /* @__PURE__ */ jsxs("aside", {
      className: `fixed md:static inset-y-0 left-0 z-50 w-64 bg-navy-900 text-white flex flex-col transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`,
      children: [/* @__PURE__ */ jsx("div", {
        className: "p-6 border-b border-navy-700",
        children: /* @__PURE__ */ jsxs(Link, {
          to: "/admin",
          className: "flex items-center gap-3",
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-5 h-5 text-white",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M13 10V3L4 14h7v7l9-11h-7z"
              })
            })
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("p", {
              className: "font-display font-bold text-lg",
              children: "Runoot"
            }), /* @__PURE__ */ jsx("p", {
              className: "text-xs text-navy-300",
              children: "Admin Panel"
            })]
          })]
        })
      }), /* @__PURE__ */ jsx("nav", {
        className: "flex-1 p-4 space-y-1",
        children: navItems.map((item) => /* @__PURE__ */ jsxs(Link, {
          to: item.to,
          onClick: () => setSidebarOpen(false),
          className: `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive(item.to, item.exact) ? "bg-brand-600 text-white" : "text-navy-200 hover:bg-navy-800 hover:text-white"}`,
          children: [item.icon, /* @__PURE__ */ jsx("span", {
            className: "flex-1",
            children: item.label
          }), item.to === "/admin/pending" && pendingCount > 0 && /* @__PURE__ */ jsx("span", {
            className: "ml-auto bg-accent-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
            children: pendingCount
          })]
        }, item.to))
      }), /* @__PURE__ */ jsxs("div", {
        className: "p-4 border-t border-navy-700",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-3 mb-3",
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold",
            children: ((_a = admin2.full_name) == null ? void 0 : _a.charAt(0)) || admin2.email.charAt(0).toUpperCase()
          }), /* @__PURE__ */ jsxs("div", {
            className: "min-w-0",
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-sm font-medium text-white truncate",
              children: admin2.full_name || admin2.email
            }), /* @__PURE__ */ jsx("p", {
              className: "text-xs text-navy-400 capitalize",
              children: admin2.role
            })]
          })]
        }), /* @__PURE__ */ jsxs(Link, {
          to: "/",
          className: "flex items-center gap-2 text-sm text-navy-300 hover:text-white transition-colors",
          children: [/* @__PURE__ */ jsx("svg", {
            className: "w-4 h-4",
            fill: "none",
            stroke: "currentColor",
            viewBox: "0 0 24 24",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M10 19l-7-7m0 0l7-7m-7 7h18"
            })
          }), "Back to site"]
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "flex-1 flex flex-col min-w-0",
      children: [/* @__PURE__ */ jsxs("header", {
        className: "md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between",
        children: [/* @__PURE__ */ jsx("button", {
          onClick: () => setSidebarOpen(true),
          className: "p-2 rounded-lg hover:bg-gray-100",
          children: /* @__PURE__ */ jsx("svg", {
            className: "w-6 h-6 text-gray-600",
            fill: "none",
            stroke: "currentColor",
            viewBox: "0 0 24 24",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M4 6h16M4 12h16M4 18h16"
            })
          })
        }), /* @__PURE__ */ jsx("p", {
          className: "font-display font-bold text-gray-900",
          children: "Admin"
        }), /* @__PURE__ */ jsx(Link, {
          to: "/",
          className: "p-2 rounded-lg hover:bg-gray-100",
          children: /* @__PURE__ */ jsx("svg", {
            className: "w-5 h-5 text-gray-600",
            fill: "none",
            stroke: "currentColor",
            viewBox: "0 0 24 24",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M10 19l-7-7m0 0l7-7m-7 7h18"
            })
          })
        })]
      }), /* @__PURE__ */ jsx("main", {
        className: "flex-1 p-4 md:p-8 overflow-auto",
        children: /* @__PURE__ */ jsx(Outlet, {})
      })]
    })]
  });
});
const route35 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: admin,
  loader: loader$9
}, Symbol.toStringTag, { value: "Module" }));
const meta$9 = () => {
  return [{
    title: "Team Leaders - Admin - Runoot"
  }];
};
async function loader$8({
  request
}) {
  const admin2 = await requireAdmin(request);
  const {
    data: teamLeaders
  } = await supabaseAdmin.from("profiles").select("id, full_name, email, company_name, user_type, is_verified, is_team_leader, referral_code, created_at").eq("is_team_leader", true).order("created_at", {
    ascending: false
  });
  const tlIds = (teamLeaders || []).map((tl) => tl.id);
  let referralCounts = {};
  if (tlIds.length > 0) {
    const {
      data: counts
    } = await supabaseAdmin.from("referrals").select("team_leader_id").in("team_leader_id", tlIds);
    if (counts) {
      for (const row of counts) {
        referralCounts[row.team_leader_id] = (referralCounts[row.team_leader_id] || 0) + 1;
      }
    }
  }
  const {
    data: tokens
  } = await supabaseAdmin.from("tl_invite_tokens").select("id, token, created_by, used_by, used_at, expires_at, created_at").order("created_at", {
    ascending: false
  }).limit(20);
  const {
    count: totalTLs
  } = await supabaseAdmin.from("profiles").select("*", {
    count: "exact",
    head: true
  }).eq("is_team_leader", true);
  const {
    count: totalReferrals
  } = await supabaseAdmin.from("referrals").select("*", {
    count: "exact",
    head: true
  });
  return {
    admin: admin2,
    teamLeaders: teamLeaders || [],
    referralCounts,
    tokens: tokens || [],
    stats: {
      totalTLs: totalTLs || 0,
      totalReferrals: totalReferrals || 0
    }
  };
}
function generateToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
function generateReferralCode(name) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8);
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  return `${base}${year}`;
}
async function action$7({
  request
}) {
  var _a;
  const admin2 = await requireAdmin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");
  switch (actionType) {
    case "generateToken": {
      const token = generateToken();
      const expiresInDays = 30;
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1e3).toISOString();
      const {
        error
      } = await supabaseAdmin.from("tl_invite_tokens").insert({
        token,
        created_by: admin2.id,
        expires_at: expiresAt
      });
      if (error) {
        return data({
          error: `Failed to generate token: ${error.message}`
        }, {
          status: 500
        });
      }
      await logAdminAction(admin2.id, "tl_token_generated", {
        details: {
          token
        }
      });
      return data({
        success: true,
        token,
        message: "Invite token generated!"
      });
    }
    case "toggleTeamLeader": {
      const userId = formData.get("userId");
      const currentStatus = formData.get("currentStatus") === "true";
      const newStatus = !currentStatus;
      let updateData = {
        is_team_leader: newStatus
      };
      if (newStatus) {
        const {
          data: userProfile
        } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", userId).single();
        const baseName = (userProfile == null ? void 0 : userProfile.full_name) || ((_a = userProfile == null ? void 0 : userProfile.email) == null ? void 0 : _a.split("@")[0]) || "TL";
        let code = generateReferralCode(baseName);
        const {
          data: existing
        } = await supabaseAdmin.from("profiles").select("id").eq("referral_code", code).single();
        if (existing) {
          code = code + Math.floor(Math.random() * 100);
        }
        updateData.referral_code = code;
      }
      const {
        error
      } = await supabaseAdmin.from("profiles").update(updateData).eq("id", userId);
      if (error) {
        return data({
          error: `Failed to update: ${error.message}`
        }, {
          status: 500
        });
      }
      await logAdminAction(admin2.id, newStatus ? "tl_promoted" : "tl_demoted", {
        targetUserId: userId
      });
      if (newStatus) {
        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          type: "tl_promoted",
          title: "You're a Team Leader!",
          message: "An admin has promoted you to Team Leader. You can now share your referral link and manage your community from the TL Dashboard.",
          data: {
            referral_code: updateData.referral_code
          }
        });
      }
      return data({
        success: true
      });
    }
    case "deleteToken": {
      const tokenId = formData.get("tokenId");
      await supabaseAdmin.from("tl_invite_tokens").delete().eq("id", tokenId);
      return data({
        success: true
      });
    }
    default:
      return data({
        error: "Unknown action"
      }, {
        status: 400
      });
  }
}
const admin_teamLeaders = UNSAFE_withComponentProps(function AdminTeamLeaders() {
  const {
    teamLeaders,
    referralCounts,
    tokens,
    stats
  } = useLoaderData();
  const actionData = useActionData();
  const [copiedToken, setCopiedToken] = useState(null);
  const copyToClipboard = (text, tokenId) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2e3);
  };
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsxs("div", {
      className: "mb-6",
      children: [/* @__PURE__ */ jsx("h1", {
        className: "font-display text-2xl md:text-3xl font-bold text-gray-900",
        children: "Team Leaders"
      }), /* @__PURE__ */ jsx("p", {
        className: "text-gray-500 mt-1",
        children: "Manage team leaders and invite tokens"
      })]
    }), actionData && "error" in actionData && /* @__PURE__ */ jsx("div", {
      className: "mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm",
      children: actionData.error
    }), actionData && "token" in actionData && /* @__PURE__ */ jsxs("div", {
      className: "mb-4 p-4 rounded-lg bg-success-50 border border-success-200",
      children: [/* @__PURE__ */ jsx("p", {
        className: "text-sm font-medium text-success-800 mb-2",
        children: "Token generated!"
      }), /* @__PURE__ */ jsxs("div", {
        className: "flex items-center gap-2",
        children: [/* @__PURE__ */ jsxs("code", {
          className: "text-sm bg-white px-3 py-1.5 rounded border border-success-200 font-mono flex-1 break-all",
          children: [baseUrl, "/become-tl/", actionData.token]
        }), /* @__PURE__ */ jsx("button", {
          onClick: () => copyToClipboard(`${baseUrl}/become-tl/${actionData.token}`, "new"),
          className: "btn-secondary text-xs px-3 py-1.5 flex-shrink-0",
          children: copiedToken === "new" ? "Copied!" : "Copy"
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "grid grid-cols-2 gap-4 mb-6",
      children: [/* @__PURE__ */ jsx("div", {
        className: "bg-white rounded-xl p-5 border border-gray-200",
        children: /* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-3",
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-5 h-5 text-purple-600",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              })
            })
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-2xl font-bold text-gray-900",
              children: stats.totalTLs
            }), /* @__PURE__ */ jsx("p", {
              className: "text-xs text-gray-500",
              children: "Team Leaders"
            })]
          })]
        })
      }), /* @__PURE__ */ jsx("div", {
        className: "bg-white rounded-xl p-5 border border-gray-200",
        children: /* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-3",
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-5 h-5 text-brand-600",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              })
            })
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-2xl font-bold text-gray-900",
              children: stats.totalReferrals
            }), /* @__PURE__ */ jsx("p", {
              className: "text-xs text-gray-500",
              children: "Total Referrals"
            })]
          })]
        })
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "bg-white rounded-xl border border-gray-200 p-6 mb-6",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "flex items-center justify-between mb-4",
        children: [/* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "font-display font-semibold text-gray-900",
            children: "Invite Tokens"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-sm text-gray-500 mt-1",
            children: "Generate links to invite someone to become a Team Leader"
          })]
        }), /* @__PURE__ */ jsxs(Form, {
          method: "post",
          children: [/* @__PURE__ */ jsx("input", {
            type: "hidden",
            name: "_action",
            value: "generateToken"
          }), /* @__PURE__ */ jsxs("button", {
            type: "submit",
            className: "btn-primary text-sm inline-flex items-center gap-2",
            children: [/* @__PURE__ */ jsx("svg", {
              className: "w-4 h-4",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M12 4v16m8-8H4"
              })
            }), "Generate Token"]
          })]
        })]
      }), tokens.length > 0 ? /* @__PURE__ */ jsx("div", {
        className: "divide-y divide-gray-100",
        children: tokens.map((token) => /* @__PURE__ */ jsxs("div", {
          className: "py-3 flex items-center justify-between gap-3",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "min-w-0 flex-1",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-2",
              children: [/* @__PURE__ */ jsx("code", {
                className: "text-xs font-mono text-gray-600 truncate",
                children: token.token
              }), token.used_by ? /* @__PURE__ */ jsx("span", {
                className: "px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700",
                children: "Used"
              }) : token.expires_at && new Date(token.expires_at) < /* @__PURE__ */ new Date() ? /* @__PURE__ */ jsx("span", {
                className: "px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500",
                children: "Expired"
              }) : /* @__PURE__ */ jsx("span", {
                className: "px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700",
                children: "Active"
              })]
            }), /* @__PURE__ */ jsxs("p", {
              className: "text-xs text-gray-400 mt-1",
              children: ["Created ", new Date(token.created_at).toLocaleDateString(), token.expires_at && ` · Expires ${new Date(token.expires_at).toLocaleDateString()}`]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex items-center gap-2 flex-shrink-0",
            children: [!token.used_by && /* @__PURE__ */ jsx("button", {
              onClick: () => copyToClipboard(`${baseUrl}/become-tl/${token.token}`, token.id),
              className: "text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded bg-brand-50",
              children: copiedToken === token.id ? "Copied!" : "Copy Link"
            }), /* @__PURE__ */ jsxs(Form, {
              method: "post",
              className: "inline",
              children: [/* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "_action",
                value: "deleteToken"
              }), /* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "tokenId",
                value: token.id
              }), /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50",
                children: "Delete"
              })]
            })]
          })]
        }, token.id))
      }) : /* @__PURE__ */ jsx("p", {
        className: "text-sm text-gray-400 text-center py-4",
        children: "No invite tokens yet. Generate one to invite a Team Leader."
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "bg-white rounded-xl border border-gray-200 overflow-hidden",
      children: [/* @__PURE__ */ jsx("div", {
        className: "px-6 py-4 border-b border-gray-100",
        children: /* @__PURE__ */ jsx("h2", {
          className: "font-display font-semibold text-gray-900",
          children: "Active Team Leaders"
        })
      }), /* @__PURE__ */ jsx("div", {
        className: "divide-y divide-gray-100",
        children: teamLeaders.length > 0 ? teamLeaders.map((tl) => {
          var _a;
          return /* @__PURE__ */ jsxs("div", {
            className: "p-4 flex items-center justify-between gap-3",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-3 min-w-0 flex-1",
              children: [/* @__PURE__ */ jsx("div", {
                className: "w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold flex-shrink-0",
                children: ((_a = tl.full_name) == null ? void 0 : _a.charAt(0)) || tl.email.charAt(0).toUpperCase()
              }), /* @__PURE__ */ jsxs("div", {
                className: "min-w-0",
                children: [/* @__PURE__ */ jsxs("p", {
                  className: "text-sm font-medium text-gray-900 truncate",
                  children: [tl.full_name || "No name", tl.company_name && /* @__PURE__ */ jsxs("span", {
                    className: "text-gray-400 font-normal",
                    children: [" · ", tl.company_name]
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-2 mt-0.5 flex-wrap",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-xs text-gray-500",
                    children: tl.email
                  }), tl.referral_code && /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "text-xs text-gray-300",
                      children: "·"
                    }), /* @__PURE__ */ jsxs("span", {
                      className: "text-xs font-mono text-purple-600",
                      children: ["/", tl.referral_code]
                    })]
                  }), /* @__PURE__ */ jsx("span", {
                    className: "text-xs text-gray-300",
                    children: "·"
                  }), /* @__PURE__ */ jsxs("span", {
                    className: "text-xs text-brand-600 font-medium",
                    children: [referralCounts[tl.id] || 0, " referrals"]
                  })]
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-2 flex-shrink-0",
              children: [tl.referral_code && /* @__PURE__ */ jsx("button", {
                onClick: () => copyToClipboard(`${baseUrl}/join/${tl.referral_code}`, `tl-${tl.id}`),
                className: "text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded bg-brand-50",
                children: copiedToken === `tl-${tl.id}` ? "Copied!" : "Copy Referral"
              }), /* @__PURE__ */ jsxs(Form, {
                method: "post",
                className: "inline",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "_action",
                  value: "toggleTeamLeader"
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "userId",
                  value: tl.id
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "currentStatus",
                  value: "true"
                }), /* @__PURE__ */ jsx("button", {
                  type: "submit",
                  className: "text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50",
                  onClick: (e) => {
                    if (!confirm(`Remove Team Leader status from ${tl.full_name || tl.email}?`)) {
                      e.preventDefault();
                    }
                  },
                  children: "Remove TL"
                })]
              })]
            })]
          }, tl.id);
        }) : /* @__PURE__ */ jsxs("div", {
          className: "p-8 text-center text-gray-400 text-sm",
          children: ["No team leaders yet. Promote users from the", " ", /* @__PURE__ */ jsx("a", {
            href: "/admin/users",
            className: "text-brand-600 hover:underline",
            children: "Users page"
          }), " ", "or generate an invite token above."]
        })
      })]
    })]
  });
});
const route36 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7,
  default: admin_teamLeaders,
  loader: loader$8,
  meta: meta$9
}, Symbol.toStringTag, { value: "Module" }));
const meta$8 = () => {
  return [{
    title: "Impersonate - Admin - Runoot"
  }];
};
async function loader$7({
  request
}) {
  const admin2 = await requireAdmin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  let query = supabaseAdmin.from("profiles").select("id, full_name, email, user_type, company_name, is_verified, role, created_by_admin, created_at").not("created_by_admin", "is", null).order("created_at", {
    ascending: false
  }).limit(50);
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
  }
  const {
    data: users
  } = await query;
  return {
    admin: admin2,
    users: users || []
  };
}
async function action$6({
  request
}) {
  await requireAdmin(request);
  const formData = await request.formData();
  const userId = formData.get("userId");
  if (!userId) {
    return {
      error: "No user selected"
    };
  }
  const {
    data: targetUser
  } = await supabaseAdmin.from("profiles").select("id, created_by_admin").eq("id", userId).single();
  if (!targetUser || !targetUser.created_by_admin) {
    return {
      error: "You can only impersonate users created from the admin panel"
    };
  }
  return startImpersonation(request, userId);
}
const userTypeLabels$1 = {
  tour_operator: "Tour Operator",
  private: "Runner"
};
const admin_impersonate = UNSAFE_withComponentProps(function AdminImpersonate() {
  const {
    admin: admin2,
    users
  } = useLoaderData();
  const [searchParams] = useSearchParams();
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsxs("div", {
      className: "mb-6",
      children: [/* @__PURE__ */ jsx("h1", {
        className: "font-display text-2xl md:text-3xl font-bold text-gray-900",
        children: "Impersonate User"
      }), /* @__PURE__ */ jsx("p", {
        className: "text-gray-500 mt-1",
        children: "View and act as a user you created. Only admin-created users can be impersonated."
      })]
    }), /* @__PURE__ */ jsx("div", {
      className: "mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200",
      children: /* @__PURE__ */ jsxs("div", {
        className: "flex items-start gap-3",
        children: [/* @__PURE__ */ jsx("svg", {
          className: "w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0",
          fill: "none",
          stroke: "currentColor",
          viewBox: "0 0 24 24",
          children: /* @__PURE__ */ jsx("path", {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 2,
            d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          })
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("p", {
            className: "text-sm font-medium text-amber-800",
            children: "Actions taken while impersonating will appear as if the user performed them."
          }), /* @__PURE__ */ jsx("p", {
            className: "text-xs text-amber-600 mt-1",
            children: "All impersonation sessions are logged in the audit trail."
          })]
        })]
      })
    }), /* @__PURE__ */ jsx("div", {
      className: "bg-white rounded-xl border border-gray-200 p-4 mb-6",
      children: /* @__PURE__ */ jsxs(Form, {
        method: "get",
        className: "flex gap-3",
        children: [/* @__PURE__ */ jsx("input", {
          type: "text",
          name: "search",
          placeholder: "Search by name, email, or company...",
          defaultValue: searchParams.get("search") || "",
          className: "input flex-1"
        }), /* @__PURE__ */ jsx("button", {
          type: "submit",
          className: "btn-accent",
          children: "Search"
        })]
      })
    }), /* @__PURE__ */ jsxs("div", {
      className: "bg-white rounded-xl border border-gray-200 overflow-hidden",
      children: [/* @__PURE__ */ jsx("div", {
        className: "divide-y divide-gray-100",
        children: users.map((user) => {
          var _a;
          return /* @__PURE__ */ jsxs("div", {
            className: `p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${user.id === admin2.id ? "opacity-50" : ""}`,
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-3 min-w-0 flex-1",
              children: [/* @__PURE__ */ jsx("div", {
                className: "w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold flex-shrink-0",
                children: ((_a = user.full_name) == null ? void 0 : _a.charAt(0)) || user.email.charAt(0).toUpperCase()
              }), /* @__PURE__ */ jsxs("div", {
                className: "min-w-0",
                children: [/* @__PURE__ */ jsxs("p", {
                  className: "text-sm font-medium text-gray-900 truncate",
                  children: [user.full_name || "No name", user.company_name && /* @__PURE__ */ jsxs("span", {
                    className: "text-gray-400 font-normal",
                    children: [" · ", user.company_name]
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center gap-2 mt-0.5",
                  children: [/* @__PURE__ */ jsx("span", {
                    className: "text-xs text-gray-500",
                    children: user.email
                  }), /* @__PURE__ */ jsx("span", {
                    className: "text-xs text-gray-300",
                    children: "·"
                  }), /* @__PURE__ */ jsx("span", {
                    className: "text-xs text-gray-500",
                    children: userTypeLabels$1[user.user_type]
                  }), user.is_verified && /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "text-xs text-gray-300",
                      children: "·"
                    }), /* @__PURE__ */ jsx("span", {
                      className: "text-xs text-brand-600",
                      children: "Verified"
                    })]
                  }), user.role !== "user" && /* @__PURE__ */ jsxs(Fragment, {
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "text-xs text-gray-300",
                      children: "·"
                    }), /* @__PURE__ */ jsx("span", {
                      className: "text-xs text-purple-600 font-medium",
                      children: user.role
                    })]
                  })]
                })]
              })]
            }), user.id !== admin2.id ? /* @__PURE__ */ jsxs(Form, {
              method: "post",
              className: "flex-shrink-0 ml-4",
              children: [/* @__PURE__ */ jsx("input", {
                type: "hidden",
                name: "userId",
                value: user.id
              }), /* @__PURE__ */ jsxs("button", {
                type: "submit",
                className: "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-navy-700 rounded-lg hover:bg-navy-800 transition-colors",
                children: [/* @__PURE__ */ jsxs("svg", {
                  className: "w-4 h-4",
                  fill: "none",
                  stroke: "currentColor",
                  viewBox: "0 0 24 24",
                  children: [/* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  }), /* @__PURE__ */ jsx("path", {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  })]
                }), "Impersonate"]
              })]
            }) : /* @__PURE__ */ jsx("span", {
              className: "text-xs text-gray-400 flex-shrink-0 ml-4",
              children: "You"
            })]
          }, user.id);
        })
      }), users.length === 0 && /* @__PURE__ */ jsxs("div", {
        className: "p-8 text-center text-gray-400 text-sm",
        children: ["No admin-created users found. Create users from the ", /* @__PURE__ */ jsx("a", {
          href: "/admin/users/new",
          className: "text-brand-600 hover:underline",
          children: "Users panel"
        }), " to impersonate them."]
      })]
    })]
  });
});
const route37 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6,
  default: admin_impersonate,
  loader: loader$7,
  meta: meta$8
}, Symbol.toStringTag, { value: "Module" }));
async function action$5({
  request
}) {
  const realUserId = await getRealUserId(request);
  if (!realUserId) {
    return redirect("/login");
  }
  return stopImpersonation(request);
}
async function loader$6() {
  return redirect("/admin");
}
const route38 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
const meta$7 = () => {
  return [{
    title: "Listings - Admin - Runoot"
  }];
};
const ITEMS_PER_PAGE$1 = 20;
async function loader$5({
  request
}) {
  const admin2 = await requireAdmin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const statusFilter = url.searchParams.get("status") || "";
  const typeFilter = url.searchParams.get("type") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  let query = supabaseAdmin.from("listings").select(`*, author:profiles(id, full_name, email, company_name, user_type), event:events(id, name, country, event_date)`, {
    count: "exact"
  }).order("created_at", {
    ascending: false
  }).range((page - 1) * ITEMS_PER_PAGE$1, page * ITEMS_PER_PAGE$1 - 1);
  if (search) {
    query = query.or(`title.ilike.%${search}%`);
  }
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  if (typeFilter) {
    query = query.eq("listing_type", typeFilter);
  }
  const {
    data: listings,
    count
  } = await query;
  return {
    admin: admin2,
    listings: listings || [],
    totalCount: count || 0,
    currentPage: page,
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE$1)
  };
}
async function action$4({
  request
}) {
  const admin2 = await requireAdmin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");
  switch (actionType) {
    case "changeStatus": {
      const listingId = formData.get("listingId");
      const newStatus = formData.get("newStatus");
      if (!["pending", "active", "sold", "expired", "rejected"].includes(newStatus)) {
        return data({
          error: "Invalid status"
        }, {
          status: 400
        });
      }
      await supabaseAdmin.from("listings").update({
        status: newStatus
      }).eq("id", listingId);
      await logAdminAction(admin2.id, "listing_status_changed", {
        targetListingId: listingId,
        details: {
          new_status: newStatus
        }
      });
      return data({
        success: true
      });
    }
    case "delete": {
      const listingId = formData.get("listingId");
      await supabaseAdmin.from("listings").delete().eq("id", listingId);
      await logAdminAction(admin2.id, "listing_deleted", {
        targetListingId: listingId
      });
      return data({
        success: true
      });
    }
    case "impersonateAuthor": {
      const authorId = formData.get("authorId");
      return startImpersonation(request, authorId);
    }
    default:
      return data({
        error: "Unknown action"
      }, {
        status: 400
      });
  }
}
const listingTypeLabels$2 = {
  room: {
    label: "Hotel",
    color: "bg-blue-100 text-blue-700"
  },
  bib: {
    label: "Bib",
    color: "bg-purple-100 text-purple-700"
  },
  room_and_bib: {
    label: "Package",
    color: "bg-green-100 text-green-700"
  }
};
const statusColors$1 = {
  pending: "bg-yellow-100 text-yellow-700",
  active: "bg-success-100 text-success-700",
  sold: "bg-gray-100 text-gray-600",
  expired: "bg-alert-100 text-alert-700",
  rejected: "bg-red-100 text-red-700"
};
const admin_listings = UNSAFE_withComponentProps(function AdminListings() {
  const {
    listings,
    totalCount,
    currentPage,
    totalPages
  } = useLoaderData();
  const actionData = useActionData();
  const [searchParams] = useSearchParams();
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsxs("div", {
      className: "mb-6",
      children: [/* @__PURE__ */ jsx("h1", {
        className: "font-display text-2xl md:text-3xl font-bold text-gray-900",
        children: "Listings"
      }), /* @__PURE__ */ jsxs("p", {
        className: "text-gray-500 mt-1",
        children: [totalCount, " total listings"]
      })]
    }), actionData && "error" in actionData && /* @__PURE__ */ jsx("div", {
      className: "mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm",
      children: actionData.error
    }), /* @__PURE__ */ jsx("div", {
      className: "bg-white rounded-xl border border-gray-200 p-4 mb-6",
      children: /* @__PURE__ */ jsxs(Form, {
        method: "get",
        className: "flex flex-col md:flex-row gap-3",
        children: [/* @__PURE__ */ jsx("div", {
          className: "flex-1",
          children: /* @__PURE__ */ jsx("input", {
            type: "text",
            name: "search",
            placeholder: "Search by title...",
            defaultValue: searchParams.get("search") || "",
            className: "input w-full"
          })
        }), /* @__PURE__ */ jsxs("select", {
          name: "status",
          defaultValue: searchParams.get("status") || "",
          className: "input",
          children: [/* @__PURE__ */ jsx("option", {
            value: "",
            children: "All statuses"
          }), /* @__PURE__ */ jsx("option", {
            value: "pending",
            children: "Pending"
          }), /* @__PURE__ */ jsx("option", {
            value: "active",
            children: "Active"
          }), /* @__PURE__ */ jsx("option", {
            value: "sold",
            children: "Sold"
          }), /* @__PURE__ */ jsx("option", {
            value: "expired",
            children: "Expired"
          }), /* @__PURE__ */ jsx("option", {
            value: "rejected",
            children: "Rejected"
          })]
        }), /* @__PURE__ */ jsxs("select", {
          name: "type",
          defaultValue: searchParams.get("type") || "",
          className: "input",
          children: [/* @__PURE__ */ jsx("option", {
            value: "",
            children: "All types"
          }), /* @__PURE__ */ jsx("option", {
            value: "room",
            children: "Hotel"
          }), /* @__PURE__ */ jsx("option", {
            value: "bib",
            children: "Bib"
          }), /* @__PURE__ */ jsx("option", {
            value: "room_and_bib",
            children: "Package"
          })]
        }), /* @__PURE__ */ jsx("button", {
          type: "submit",
          className: "btn-accent",
          children: "Search"
        })]
      })
    }), /* @__PURE__ */ jsxs("div", {
      className: "bg-white rounded-xl border border-gray-200 overflow-hidden",
      children: [/* @__PURE__ */ jsx("div", {
        className: "hidden md:block overflow-x-auto",
        children: /* @__PURE__ */ jsxs("table", {
          className: "w-full",
          children: [/* @__PURE__ */ jsx("thead", {
            className: "bg-gray-50 border-b border-gray-200",
            children: /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Listing"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Author"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Type"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Status"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Event"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Created"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Actions"
              })]
            })
          }), /* @__PURE__ */ jsx("tbody", {
            className: "divide-y divide-gray-100",
            children: listings.map((listing) => {
              var _a, _b, _c, _d;
              const typeInfo = listingTypeLabels$2[listing.listing_type] || {
                label: listing.listing_type,
                color: "bg-gray-100 text-gray-600"
              };
              return /* @__PURE__ */ jsxs("tr", {
                className: "hover:bg-gray-50 transition-colors",
                children: [/* @__PURE__ */ jsxs("td", {
                  className: "px-6 py-4",
                  children: [/* @__PURE__ */ jsx(Link, {
                    to: `/listings/${listing.id}`,
                    className: "text-sm font-medium text-gray-900 hover:text-brand-600",
                    children: listing.title
                  }), listing.price && /* @__PURE__ */ jsxs("p", {
                    className: "text-xs text-gray-500 mt-0.5",
                    children: [listing.currency, " ", listing.price, listing.price_negotiable && " (negotiable)"]
                  })]
                }), /* @__PURE__ */ jsxs("td", {
                  className: "px-6 py-4",
                  children: [/* @__PURE__ */ jsx("p", {
                    className: "text-sm text-gray-700",
                    children: ((_a = listing.author) == null ? void 0 : _a.company_name) || ((_b = listing.author) == null ? void 0 : _b.full_name) || "Unknown"
                  }), /* @__PURE__ */ jsx("p", {
                    className: "text-xs text-gray-400",
                    children: (_c = listing.author) == null ? void 0 : _c.email
                  })]
                }), /* @__PURE__ */ jsx("td", {
                  className: "px-6 py-4",
                  children: /* @__PURE__ */ jsx("span", {
                    className: `px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`,
                    children: typeInfo.label
                  })
                }), /* @__PURE__ */ jsx("td", {
                  className: "px-6 py-4",
                  children: /* @__PURE__ */ jsxs(Form, {
                    method: "post",
                    className: "inline",
                    children: [/* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "_action",
                      value: "changeStatus"
                    }), /* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "listingId",
                      value: listing.id
                    }), /* @__PURE__ */ jsxs("select", {
                      name: "newStatus",
                      defaultValue: listing.status,
                      onChange: (e) => {
                        var _a2;
                        return (_a2 = e.target.form) == null ? void 0 : _a2.requestSubmit();
                      },
                      className: `text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${statusColors$1[listing.status] || ""}`,
                      children: [/* @__PURE__ */ jsx("option", {
                        value: "pending",
                        children: "pending"
                      }), /* @__PURE__ */ jsx("option", {
                        value: "active",
                        children: "active"
                      }), /* @__PURE__ */ jsx("option", {
                        value: "sold",
                        children: "sold"
                      }), /* @__PURE__ */ jsx("option", {
                        value: "expired",
                        children: "expired"
                      }), /* @__PURE__ */ jsx("option", {
                        value: "rejected",
                        children: "rejected"
                      })]
                    })]
                  })
                }), /* @__PURE__ */ jsx("td", {
                  className: "px-6 py-4 text-sm text-gray-600",
                  children: ((_d = listing.event) == null ? void 0 : _d.name) || "—"
                }), /* @__PURE__ */ jsx("td", {
                  className: "px-6 py-4 text-sm text-gray-500",
                  children: new Date(listing.created_at).toLocaleDateString()
                }), /* @__PURE__ */ jsx("td", {
                  className: "px-6 py-4 text-right",
                  children: /* @__PURE__ */ jsxs("div", {
                    className: "flex items-center justify-end gap-1",
                    children: [/* @__PURE__ */ jsxs(Form, {
                      method: "post",
                      className: "inline",
                      children: [/* @__PURE__ */ jsx("input", {
                        type: "hidden",
                        name: "_action",
                        value: "impersonateAuthor"
                      }), /* @__PURE__ */ jsx("input", {
                        type: "hidden",
                        name: "authorId",
                        value: listing.author_id
                      }), /* @__PURE__ */ jsx("button", {
                        type: "submit",
                        className: "text-xs font-medium text-navy-500 hover:text-navy-700 px-2 py-1 rounded hover:bg-gray-100",
                        title: "Impersonate author",
                        children: /* @__PURE__ */ jsxs("svg", {
                          className: "w-4 h-4",
                          fill: "none",
                          stroke: "currentColor",
                          viewBox: "0 0 24 24",
                          children: [/* @__PURE__ */ jsx("path", {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            strokeWidth: 2,
                            d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          }), /* @__PURE__ */ jsx("path", {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            strokeWidth: 2,
                            d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          })]
                        })
                      })]
                    }), /* @__PURE__ */ jsxs(Form, {
                      method: "post",
                      className: "inline",
                      onSubmit: (e) => {
                        if (!confirm("Are you sure you want to delete this listing?")) {
                          e.preventDefault();
                        }
                      },
                      children: [/* @__PURE__ */ jsx("input", {
                        type: "hidden",
                        name: "_action",
                        value: "delete"
                      }), /* @__PURE__ */ jsx("input", {
                        type: "hidden",
                        name: "listingId",
                        value: listing.id
                      }), /* @__PURE__ */ jsx("button", {
                        type: "submit",
                        className: "text-xs font-medium text-alert-500 hover:text-alert-700 px-2 py-1 rounded hover:bg-alert-50",
                        title: "Delete listing",
                        children: /* @__PURE__ */ jsx("svg", {
                          className: "w-4 h-4",
                          fill: "none",
                          stroke: "currentColor",
                          viewBox: "0 0 24 24",
                          children: /* @__PURE__ */ jsx("path", {
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            strokeWidth: 2,
                            d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          })
                        })
                      })]
                    })]
                  })
                })]
              }, listing.id);
            })
          })]
        })
      }), /* @__PURE__ */ jsx("div", {
        className: "md:hidden divide-y divide-gray-100",
        children: listings.map((listing) => {
          var _a, _b, _c;
          const typeInfo = listingTypeLabels$2[listing.listing_type] || {
            label: listing.listing_type,
            color: "bg-gray-100 text-gray-600"
          };
          return /* @__PURE__ */ jsxs("div", {
            className: "p-4",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex items-start justify-between mb-2",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "min-w-0 flex-1",
                children: [/* @__PURE__ */ jsx(Link, {
                  to: `/listings/${listing.id}`,
                  className: "text-sm font-medium text-gray-900 hover:text-brand-600",
                  children: listing.title
                }), /* @__PURE__ */ jsxs("p", {
                  className: "text-xs text-gray-500 mt-0.5",
                  children: ["by ", ((_a = listing.author) == null ? void 0 : _a.company_name) || ((_b = listing.author) == null ? void 0 : _b.full_name) || "Unknown"]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "flex items-center gap-1 ml-2",
                children: [/* @__PURE__ */ jsx("span", {
                  className: `px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`,
                  children: typeInfo.label
                }), /* @__PURE__ */ jsx("span", {
                  className: `px-2 py-0.5 rounded-full text-xs font-medium ${statusColors$1[listing.status] || ""}`,
                  children: listing.status
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "flex items-center justify-between mt-3",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "text-xs text-gray-500",
                children: [(_c = listing.event) == null ? void 0 : _c.name, " · ", new Date(listing.created_at).toLocaleDateString(), listing.price && /* @__PURE__ */ jsxs("span", {
                  children: [" · ", listing.currency, " ", listing.price]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "flex items-center gap-2",
                children: [/* @__PURE__ */ jsxs(Form, {
                  method: "post",
                  className: "inline",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "_action",
                    value: "changeStatus"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "listingId",
                    value: listing.id
                  }), /* @__PURE__ */ jsxs("select", {
                    name: "newStatus",
                    defaultValue: listing.status,
                    onChange: (e) => {
                      var _a2;
                      return (_a2 = e.target.form) == null ? void 0 : _a2.requestSubmit();
                    },
                    className: "text-xs px-2 py-1 rounded bg-gray-50 border-0",
                    children: [/* @__PURE__ */ jsx("option", {
                      value: "active",
                      children: "active"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "sold",
                      children: "sold"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "expired",
                      children: "expired"
                    })]
                  })]
                }), /* @__PURE__ */ jsxs(Form, {
                  method: "post",
                  className: "inline",
                  onSubmit: (e) => {
                    if (!confirm("Delete this listing?")) e.preventDefault();
                  },
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "_action",
                    value: "delete"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "listingId",
                    value: listing.id
                  }), /* @__PURE__ */ jsx("button", {
                    type: "submit",
                    className: "text-xs text-alert-500 px-2 py-1 rounded bg-gray-50",
                    children: "Delete"
                  })]
                })]
              })]
            })]
          }, listing.id);
        })
      }), listings.length === 0 && /* @__PURE__ */ jsx("div", {
        className: "p-8 text-center text-gray-400 text-sm",
        children: "No listings found"
      })]
    }), totalPages > 1 && /* @__PURE__ */ jsxs("div", {
      className: "mt-6 flex items-center justify-center gap-2",
      children: [currentPage > 1 && /* @__PURE__ */ jsx(Link, {
        to: `/admin/listings?page=${currentPage - 1}&search=${searchParams.get("search") || ""}&status=${searchParams.get("status") || ""}&type=${searchParams.get("type") || ""}`,
        className: "px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50",
        children: "Previous"
      }), /* @__PURE__ */ jsxs("span", {
        className: "text-sm text-gray-500",
        children: ["Page ", currentPage, " of ", totalPages]
      }), currentPage < totalPages && /* @__PURE__ */ jsx(Link, {
        to: `/admin/listings?page=${currentPage + 1}&search=${searchParams.get("search") || ""}&status=${searchParams.get("status") || ""}&type=${searchParams.get("type") || ""}`,
        className: "px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50",
        children: "Next"
      })]
    })]
  });
});
const route39 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4,
  default: admin_listings,
  loader: loader$5,
  meta: meta$7
}, Symbol.toStringTag, { value: "Module" }));
const meta$6 = () => {
  return [{
    title: "Pending Approvals - Admin - Runoot"
  }];
};
async function loader$4({
  request
}) {
  const admin2 = await requireAdmin(request);
  const {
    data: listings,
    count
  } = await supabaseAdmin.from("listings").select(`*, author:profiles(id, full_name, email, company_name, user_type, is_verified),
       event:events(id, name, country, event_date)`, {
    count: "exact"
  }).eq("status", "pending").order("created_at", {
    ascending: true
  });
  return {
    admin: admin2,
    listings: listings || [],
    pendingCount: count || 0
  };
}
async function action$3({
  request
}) {
  var _a;
  const admin2 = await requireAdmin(request);
  const adminId = admin2.id;
  const formData = await request.formData();
  const actionType = formData.get("_action");
  const listingId = formData.get("listingId");
  const adminNote = ((_a = formData.get("adminNote")) == null ? void 0 : _a.trim()) || null;
  if (!listingId) {
    return data({
      error: "Missing listing ID"
    }, {
      status: 400
    });
  }
  const {
    data: listing
  } = await supabaseAdmin.from("listings").select("id, title, author_id").eq("id", listingId).single();
  if (!listing) {
    return data({
      error: "Listing not found"
    }, {
      status: 404
    });
  }
  switch (actionType) {
    case "approve": {
      await supabaseAdmin.from("listings").update({
        status: "active",
        admin_note: adminNote,
        reviewed_at: (/* @__PURE__ */ new Date()).toISOString(),
        reviewed_by: adminId
      }).eq("id", listingId);
      await supabaseAdmin.from("notifications").insert({
        user_id: listing.author_id,
        type: "listing_approved",
        title: "Your listing has been approved!",
        message: `"${listing.title}" is now live and visible to other users.`,
        data: {
          listing_id: listingId
        }
      });
      await logAdminAction(adminId, "listing_approved", {
        targetListingId: listingId,
        details: {
          admin_note: adminNote
        }
      });
      return data({
        success: true,
        action: "approved",
        title: listing.title
      });
    }
    case "reject": {
      await supabaseAdmin.from("listings").update({
        status: "rejected",
        admin_note: adminNote,
        reviewed_at: (/* @__PURE__ */ new Date()).toISOString(),
        reviewed_by: adminId
      }).eq("id", listingId);
      await supabaseAdmin.from("notifications").insert({
        user_id: listing.author_id,
        type: "listing_rejected",
        title: "Your listing needs changes",
        message: adminNote ? `"${listing.title}" was not approved: ${adminNote}` : `"${listing.title}" was not approved. Please contact us for details.`,
        data: {
          listing_id: listingId
        }
      });
      await logAdminAction(adminId, "listing_rejected", {
        targetListingId: listingId,
        details: {
          admin_note: adminNote
        }
      });
      return data({
        success: true,
        action: "rejected",
        title: listing.title
      });
    }
    default:
      return data({
        error: "Unknown action"
      }, {
        status: 400
      });
  }
}
const listingTypeLabels$1 = {
  room: "Room",
  bib: "Bib",
  room_and_bib: "Room + Bib"
};
const listingTypeColors = {
  room: "bg-blue-100 text-blue-700",
  bib: "bg-purple-100 text-purple-700",
  room_and_bib: "bg-accent-100 text-accent-700"
};
const admin_pending = UNSAFE_withComponentProps(function AdminPending() {
  const {
    listings,
    pendingCount
  } = useLoaderData();
  const actionData = useActionData();
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsxs("div", {
      className: "mb-6",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "flex items-center gap-3",
        children: [/* @__PURE__ */ jsx("h1", {
          className: "font-display text-2xl md:text-3xl font-bold text-gray-900",
          children: "Pending Approvals"
        }), pendingCount > 0 && /* @__PURE__ */ jsx("span", {
          className: "flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-accent-500 px-2 text-sm font-bold text-white",
          children: pendingCount
        })]
      }), /* @__PURE__ */ jsx("p", {
        className: "text-gray-500 mt-1",
        children: "Review and approve listings before they go live"
      })]
    }), actionData && actionData.success && /* @__PURE__ */ jsx("div", {
      className: `mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${actionData.action === "approved" ? "bg-success-50 border-success-200 text-success-700" : "bg-alert-50 border-alert-200 text-alert-700"}`,
      children: actionData.action === "approved" ? `"${actionData.title}" has been approved and is now live.` : `"${actionData.title}" has been rejected.`
    }), actionData && actionData.error && /* @__PURE__ */ jsx("div", {
      className: "mb-6 rounded-lg border bg-red-50 border-red-200 px-4 py-3 text-sm font-medium text-red-700",
      children: actionData.error
    }), listings.length === 0 ? /* @__PURE__ */ jsxs("div", {
      className: "bg-white rounded-xl border border-gray-200 p-12 text-center",
      children: [/* @__PURE__ */ jsx("div", {
        className: "w-16 h-16 mx-auto mb-4 rounded-full bg-success-100 flex items-center justify-center",
        children: /* @__PURE__ */ jsx("svg", {
          className: "w-8 h-8 text-success-500",
          fill: "none",
          stroke: "currentColor",
          viewBox: "0 0 24 24",
          children: /* @__PURE__ */ jsx("path", {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 1.5,
            d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          })
        })
      }), /* @__PURE__ */ jsx("h3", {
        className: "font-display font-semibold text-gray-900 text-lg mb-2",
        children: "All clear!"
      }), /* @__PURE__ */ jsx("p", {
        className: "text-gray-500 text-sm max-w-md mx-auto",
        children: "No listings are waiting for review. New submissions will appear here automatically."
      })]
    }) : /* @__PURE__ */ jsx("div", {
      className: "space-y-4",
      children: listings.map((listing) => {
        var _a, _b, _c, _d, _e, _f, _g;
        return /* @__PURE__ */ jsxs("div", {
          className: "bg-white rounded-xl border border-gray-200 p-5",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "flex items-start justify-between gap-4 mb-3",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "min-w-0",
              children: [/* @__PURE__ */ jsx(Link, {
                to: `/listings/${listing.id}`,
                target: "_blank",
                className: "font-display font-semibold text-gray-900 hover:text-brand-600 transition-colors",
                children: listing.title
              }), /* @__PURE__ */ jsxs("p", {
                className: "text-sm text-gray-500 mt-0.5",
                children: ["by", " ", /* @__PURE__ */ jsx("span", {
                  className: "font-medium text-gray-700",
                  children: ((_a = listing.author) == null ? void 0 : _a.company_name) || ((_b = listing.author) == null ? void 0 : _b.full_name)
                }), " · ", (_c = listing.author) == null ? void 0 : _c.email]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "flex gap-2 flex-shrink-0",
              children: [/* @__PURE__ */ jsx("span", {
                className: `px-2 py-0.5 rounded-full text-xs font-medium ${((_d = listing.author) == null ? void 0 : _d.user_type) === "tour_operator" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`,
                children: ((_e = listing.author) == null ? void 0 : _e.user_type) === "tour_operator" ? "Tour Operator" : "Private"
              }), /* @__PURE__ */ jsx("span", {
                className: `px-2 py-0.5 rounded-full text-xs font-medium ${listingTypeColors[listing.listing_type] || "bg-gray-100 text-gray-600"}`,
                children: listingTypeLabels$1[listing.listing_type] || listing.listing_type
              }), ((_f = listing.author) == null ? void 0 : _f.is_verified) && /* @__PURE__ */ jsx("span", {
                className: "px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700",
                children: "Verified"
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mb-4",
            children: [listing.event && /* @__PURE__ */ jsxs("span", {
              className: "flex items-center gap-1",
              children: [/* @__PURE__ */ jsxs("svg", {
                className: "w-4 h-4 text-gray-400",
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: [/* @__PURE__ */ jsx("path", {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                }), /* @__PURE__ */ jsx("path", {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                })]
              }), listing.event.name, " · ", listing.event.country]
            }), ((_g = listing.event) == null ? void 0 : _g.event_date) && /* @__PURE__ */ jsxs("span", {
              className: "flex items-center gap-1",
              children: [/* @__PURE__ */ jsx("svg", {
                className: "w-4 h-4 text-gray-400",
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ jsx("path", {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                })
              }), "Event: ", new Date(listing.event.event_date).toLocaleDateString()]
            }), /* @__PURE__ */ jsxs("span", {
              className: "flex items-center gap-1",
              children: [/* @__PURE__ */ jsx("svg", {
                className: "w-4 h-4 text-gray-400",
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ jsx("path", {
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2,
                  d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                })
              }), "Submitted: ", new Date(listing.created_at).toLocaleDateString()]
            }), listing.price && /* @__PURE__ */ jsxs("span", {
              className: "font-medium text-gray-900",
              children: [listing.currency, " ", listing.price.toLocaleString(), listing.price_negotiable && " (negotiable)"]
            })]
          }), listing.description && /* @__PURE__ */ jsx("p", {
            className: "text-sm text-gray-500 mb-4 line-clamp-2",
            children: listing.description
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex flex-wrap gap-3 text-xs text-gray-500 mb-4",
            children: [listing.hotel_name && /* @__PURE__ */ jsxs("span", {
              className: "bg-gray-50 px-2 py-1 rounded",
              children: ["Hotel: ", listing.hotel_name, listing.hotel_stars && ` (${listing.hotel_stars}★)`]
            }), listing.room_count && /* @__PURE__ */ jsxs("span", {
              className: "bg-gray-50 px-2 py-1 rounded",
              children: [listing.room_count, " room", listing.room_count > 1 ? "s" : ""]
            }), listing.bib_count && /* @__PURE__ */ jsxs("span", {
              className: "bg-gray-50 px-2 py-1 rounded",
              children: [listing.bib_count, " bib", listing.bib_count > 1 ? "s" : ""]
            }), listing.transfer_type && /* @__PURE__ */ jsxs("span", {
              className: "bg-gray-50 px-2 py-1 rounded",
              children: ["Transfer: ", listing.transfer_type.replace("_", " ")]
            })]
          }), /* @__PURE__ */ jsx("div", {
            className: "border-t border-gray-100 pt-4",
            children: /* @__PURE__ */ jsxs("div", {
              className: "flex flex-col sm:flex-row gap-3",
              children: [/* @__PURE__ */ jsxs(Form, {
                method: "post",
                className: "flex-1",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "_action",
                  value: "approve"
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "listingId",
                  value: listing.id
                }), /* @__PURE__ */ jsx("textarea", {
                  name: "adminNote",
                  placeholder: "Optional note (visible to user)...",
                  className: "input w-full mb-2 text-sm",
                  rows: 2
                }), /* @__PURE__ */ jsxs("button", {
                  type: "submit",
                  className: "btn-primary w-full flex items-center justify-center gap-2",
                  children: [/* @__PURE__ */ jsx("svg", {
                    className: "w-4 h-4",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M5 13l4 4L19 7"
                    })
                  }), "Approve"]
                })]
              }), /* @__PURE__ */ jsxs(Form, {
                method: "post",
                className: "flex-1",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "_action",
                  value: "reject"
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "listingId",
                  value: listing.id
                }), /* @__PURE__ */ jsx("textarea", {
                  name: "adminNote",
                  placeholder: "Reason for rejection (shown to user)...",
                  className: "input w-full mb-2 text-sm",
                  rows: 2
                }), /* @__PURE__ */ jsxs("button", {
                  type: "submit",
                  className: "w-full py-2.5 px-4 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium text-sm transition-colors flex items-center justify-center gap-2",
                  children: [/* @__PURE__ */ jsx("svg", {
                    className: "w-4 h-4",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    stroke: "currentColor",
                    children: /* @__PURE__ */ jsx("path", {
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      strokeWidth: 2,
                      d: "M6 18L18 6M6 6l12 12"
                    })
                  }), "Reject"]
                })]
              })]
            })
          })]
        }, listing.id);
      })
    })]
  });
});
const route40 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3,
  default: admin_pending,
  loader: loader$4,
  meta: meta$6
}, Symbol.toStringTag, { value: "Module" }));
const meta$5 = () => {
  return [{
    title: "Admin Dashboard - Runoot"
  }];
};
async function loader$3({
  request
}) {
  await requireAdmin(request);
  const now = /* @__PURE__ */ new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3).toISOString();
  const [{
    count: totalUsers
  }, {
    count: newUsersWeek
  }, {
    count: newUsersMonth
  }, {
    count: totalListings
  }, {
    count: activeListings
  }, {
    count: soldListings
  }, {
    count: expiredListings
  }, {
    count: totalMessages
  }, {
    count: totalConversations
  }, {
    count: privateUsers
  }, {
    count: tourOperators
  }, {
    count: roomListings
  }, {
    count: bibListings
  }, {
    count: packageListings
  }, {
    count: totalTeamLeaders
  }, {
    count: totalReferrals
  }, {
    count: pendingListings
  }, {
    data: recentUsers
  }, {
    data: recentListings
  }] = await Promise.all([supabaseAdmin.from("profiles").select("*", {
    count: "exact",
    head: true
  }), supabaseAdmin.from("profiles").select("*", {
    count: "exact",
    head: true
  }).gte("created_at", sevenDaysAgo), supabaseAdmin.from("profiles").select("*", {
    count: "exact",
    head: true
  }).gte("created_at", thirtyDaysAgo), supabaseAdmin.from("listings").select("*", {
    count: "exact",
    head: true
  }), supabaseAdmin.from("listings").select("*", {
    count: "exact",
    head: true
  }).eq("status", "active"), supabaseAdmin.from("listings").select("*", {
    count: "exact",
    head: true
  }).eq("status", "sold"), supabaseAdmin.from("listings").select("*", {
    count: "exact",
    head: true
  }).eq("status", "expired"), supabaseAdmin.from("messages").select("*", {
    count: "exact",
    head: true
  }), supabaseAdmin.from("conversations").select("*", {
    count: "exact",
    head: true
  }), supabaseAdmin.from("profiles").select("*", {
    count: "exact",
    head: true
  }).eq("user_type", "private"), supabaseAdmin.from("profiles").select("*", {
    count: "exact",
    head: true
  }).eq("user_type", "tour_operator"), supabaseAdmin.from("listings").select("*", {
    count: "exact",
    head: true
  }).eq("listing_type", "room"), supabaseAdmin.from("listings").select("*", {
    count: "exact",
    head: true
  }).eq("listing_type", "bib"), supabaseAdmin.from("listings").select("*", {
    count: "exact",
    head: true
  }).eq("listing_type", "room_and_bib"), supabaseAdmin.from("profiles").select("*", {
    count: "exact",
    head: true
  }).eq("is_team_leader", true), supabaseAdmin.from("referrals").select("*", {
    count: "exact",
    head: true
  }), supabaseAdmin.from("listings").select("*", {
    count: "exact",
    head: true
  }).eq("status", "pending"), supabaseAdmin.from("profiles").select("id, full_name, email, user_type, role, is_verified, is_team_leader, created_at").order("created_at", {
    ascending: false
  }).limit(10), supabaseAdmin.from("listings").select(`id, title, listing_type, status, created_at, author:profiles(full_name, email, company_name)`).order("created_at", {
    ascending: false
  }).limit(10)]);
  return {
    stats: {
      totalUsers: totalUsers || 0,
      newUsersWeek: newUsersWeek || 0,
      newUsersMonth: newUsersMonth || 0,
      totalListings: totalListings || 0,
      activeListings: activeListings || 0,
      soldListings: soldListings || 0,
      expiredListings: expiredListings || 0,
      totalMessages: totalMessages || 0,
      totalConversations: totalConversations || 0,
      privateUsers: privateUsers || 0,
      tourOperators: tourOperators || 0,
      roomListings: roomListings || 0,
      bibListings: bibListings || 0,
      packageListings: packageListings || 0,
      totalTeamLeaders: totalTeamLeaders || 0,
      totalReferrals: totalReferrals || 0,
      pendingListings: pendingListings || 0
    },
    recentUsers: recentUsers || [],
    recentListings: recentListings || []
  };
}
function BarChart({
  items
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return /* @__PURE__ */ jsx("div", {
    className: "space-y-3",
    children: items.map((item) => /* @__PURE__ */ jsxs("div", {
      children: [/* @__PURE__ */ jsxs("div", {
        className: "flex items-center justify-between text-sm mb-1",
        children: [/* @__PURE__ */ jsx("span", {
          className: "text-gray-600",
          children: item.label
        }), /* @__PURE__ */ jsx("span", {
          className: "font-semibold text-gray-900",
          children: item.value
        })]
      }), /* @__PURE__ */ jsx("div", {
        className: "h-3 bg-gray-100 rounded-full overflow-hidden",
        children: /* @__PURE__ */ jsx("div", {
          className: `h-full rounded-full transition-all duration-500 ${item.color}`,
          style: {
            width: `${item.value / max * 100}%`
          }
        })
      })]
    }, item.label))
  });
}
const listingTypeLabels = {
  room: "Hotel",
  bib: "Bib",
  room_and_bib: "Package"
};
const statusColors = {
  active: "bg-success-100 text-success-700",
  sold: "bg-gray-100 text-gray-600",
  expired: "bg-alert-100 text-alert-700"
};
const admin__index = UNSAFE_withComponentProps(function AdminDashboard() {
  const {
    stats,
    recentUsers,
    recentListings
  } = useLoaderData();
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsxs("div", {
      className: "mb-8",
      children: [/* @__PURE__ */ jsx("h1", {
        className: "font-display text-2xl md:text-3xl font-bold text-gray-900",
        children: "Dashboard"
      }), /* @__PURE__ */ jsx("p", {
        className: "text-gray-500 mt-1",
        children: "Platform overview and statistics"
      })]
    }), stats.pendingListings > 0 && /* @__PURE__ */ jsx(Link, {
      to: "/admin/pending",
      className: "block mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 hover:bg-yellow-100 transition-colors",
      children: /* @__PURE__ */ jsxs("div", {
        className: "flex items-center gap-3",
        children: [/* @__PURE__ */ jsx("div", {
          className: "w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center flex-shrink-0",
          children: /* @__PURE__ */ jsx("svg", {
            className: "w-5 h-5 text-yellow-700",
            fill: "none",
            stroke: "currentColor",
            viewBox: "0 0 24 24",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            })
          })
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsxs("p", {
            className: "font-semibold text-yellow-800",
            children: [stats.pendingListings, " listing", stats.pendingListings > 1 ? "s" : "", " pending review"]
          }), /* @__PURE__ */ jsx("p", {
            className: "text-xs text-yellow-600",
            children: "Click to review and approve"
          })]
        })]
      })
    }), /* @__PURE__ */ jsxs("div", {
      className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-8",
      children: [/* @__PURE__ */ jsx(StatCard, {
        label: "Total Users",
        value: stats.totalUsers,
        icon: "users",
        color: "brand"
      }), /* @__PURE__ */ jsx(StatCard, {
        label: "New (7d)",
        value: stats.newUsersWeek,
        icon: "trending",
        color: "success"
      }), /* @__PURE__ */ jsx(StatCard, {
        label: "Active Listings",
        value: stats.activeListings,
        icon: "listings",
        color: "accent"
      }), /* @__PURE__ */ jsx(StatCard, {
        label: "Messages",
        value: stats.totalMessages,
        icon: "messages",
        color: "blue"
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl p-4 border border-gray-200",
        children: [/* @__PURE__ */ jsx("p", {
          className: "text-xs text-gray-500 uppercase tracking-wide",
          children: "New (30d)"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-2xl font-bold text-gray-900 mt-1",
          children: stats.newUsersMonth
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl p-4 border border-gray-200",
        children: [/* @__PURE__ */ jsx("p", {
          className: "text-xs text-gray-500 uppercase tracking-wide",
          children: "Total Listings"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-2xl font-bold text-gray-900 mt-1",
          children: stats.totalListings
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl p-4 border border-gray-200",
        children: [/* @__PURE__ */ jsx("p", {
          className: "text-xs text-gray-500 uppercase tracking-wide",
          children: "Sold"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-2xl font-bold text-success-600 mt-1",
          children: stats.soldListings
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl p-4 border border-gray-200",
        children: [/* @__PURE__ */ jsx("p", {
          className: "text-xs text-gray-500 uppercase tracking-wide",
          children: "Conversations"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-2xl font-bold text-gray-900 mt-1",
          children: stats.totalConversations
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "grid grid-cols-2 gap-4 mb-8",
      children: [/* @__PURE__ */ jsx("div", {
        className: "bg-white rounded-xl p-4 border border-gray-200",
        children: /* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-3",
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-5 h-5 text-purple-600",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              })
            })
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-2xl font-bold text-gray-900",
              children: stats.totalTeamLeaders
            }), /* @__PURE__ */ jsx("p", {
              className: "text-xs text-gray-500",
              children: "Team Leaders"
            })]
          })]
        })
      }), /* @__PURE__ */ jsx("div", {
        className: "bg-white rounded-xl p-4 border border-gray-200",
        children: /* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-3",
          children: [/* @__PURE__ */ jsx("div", {
            className: "w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center",
            children: /* @__PURE__ */ jsx("svg", {
              className: "w-5 h-5 text-brand-600",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx("path", {
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeWidth: 2,
                d: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              })
            })
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("p", {
              className: "text-2xl font-bold text-gray-900",
              children: stats.totalReferrals
            }), /* @__PURE__ */ jsx("p", {
              className: "text-xs text-gray-500",
              children: "Total Referrals"
            })]
          })]
        })
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "grid md:grid-cols-2 gap-6 mb-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl p-6 border border-gray-200",
        children: [/* @__PURE__ */ jsx("h2", {
          className: "font-display font-semibold text-gray-900 mb-4",
          children: "Users by Type"
        }), /* @__PURE__ */ jsx(BarChart, {
          items: [{
            label: "Private Runners",
            value: stats.privateUsers,
            color: "bg-brand-500"
          }, {
            label: "Tour Operators",
            value: stats.tourOperators,
            color: "bg-accent-500"
          }]
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl p-6 border border-gray-200",
        children: [/* @__PURE__ */ jsx("h2", {
          className: "font-display font-semibold text-gray-900 mb-4",
          children: "Listings by Type"
        }), /* @__PURE__ */ jsx(BarChart, {
          items: [{
            label: "Hotel Rooms",
            value: stats.roomListings,
            color: "bg-blue-500"
          }, {
            label: "Bibs",
            value: stats.bibListings,
            color: "bg-purple-500"
          }, {
            label: "Packages",
            value: stats.packageListings,
            color: "bg-success-500"
          }]
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "grid md:grid-cols-2 gap-6",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl border border-gray-200",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "px-6 py-4 border-b border-gray-100 flex items-center justify-between",
          children: [/* @__PURE__ */ jsx("h2", {
            className: "font-display font-semibold text-gray-900",
            children: "Recent Users"
          }), /* @__PURE__ */ jsx("a", {
            href: "/admin/users",
            className: "text-sm text-brand-600 font-medium hover:text-brand-700",
            children: "View all"
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "divide-y divide-gray-100",
          children: recentUsers.length > 0 ? recentUsers.map((user) => /* @__PURE__ */ jsxs("div", {
            className: "px-6 py-3 flex items-center justify-between",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "min-w-0 flex-1",
              children: [/* @__PURE__ */ jsx("p", {
                className: "text-sm font-medium text-gray-900 truncate",
                children: user.full_name || user.email
              }), /* @__PURE__ */ jsxs("p", {
                className: "text-xs text-gray-500",
                children: [user.user_type === "tour_operator" ? "TO" : "Runner", " · ", new Date(user.created_at).toLocaleDateString()]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-2",
              children: [user.is_verified && /* @__PURE__ */ jsx("span", {
                className: "text-brand-500",
                children: /* @__PURE__ */ jsx("svg", {
                  className: "w-4 h-4",
                  fill: "currentColor",
                  viewBox: "0 0 20 20",
                  children: /* @__PURE__ */ jsx("path", {
                    fillRule: "evenodd",
                    d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                    clipRule: "evenodd"
                  })
                })
              }), user.is_team_leader && /* @__PURE__ */ jsx("span", {
                className: "px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600",
                children: "TL"
              }), user.role !== "user" && /* @__PURE__ */ jsx("span", {
                className: "px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700",
                children: user.role
              })]
            })]
          }, user.id)) : /* @__PURE__ */ jsx("div", {
            className: "px-6 py-8 text-center text-gray-400 text-sm",
            children: "No users yet"
          })
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-xl border border-gray-200",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "px-6 py-4 border-b border-gray-100 flex items-center justify-between",
          children: [/* @__PURE__ */ jsx("h2", {
            className: "font-display font-semibold text-gray-900",
            children: "Recent Listings"
          }), /* @__PURE__ */ jsx("a", {
            href: "/admin/listings",
            className: "text-sm text-brand-600 font-medium hover:text-brand-700",
            children: "View all"
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "divide-y divide-gray-100",
          children: recentListings.length > 0 ? recentListings.map((listing) => {
            var _a, _b, _c;
            return /* @__PURE__ */ jsxs("div", {
              className: "px-6 py-3 flex items-center justify-between",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "min-w-0 flex-1",
                children: [/* @__PURE__ */ jsx("p", {
                  className: "text-sm font-medium text-gray-900 truncate",
                  children: listing.title
                }), /* @__PURE__ */ jsxs("p", {
                  className: "text-xs text-gray-500",
                  children: ["by ", ((_a = listing.author) == null ? void 0 : _a.company_name) || ((_b = listing.author) == null ? void 0 : _b.full_name) || ((_c = listing.author) == null ? void 0 : _c.email) || "Unknown", " · ", new Date(listing.created_at).toLocaleDateString()]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "flex items-center gap-2",
                children: [/* @__PURE__ */ jsx("span", {
                  className: "px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600",
                  children: listingTypeLabels[listing.listing_type] || listing.listing_type
                }), /* @__PURE__ */ jsx("span", {
                  className: `px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[listing.status] || ""}`,
                  children: listing.status
                })]
              })]
            }, listing.id);
          }) : /* @__PURE__ */ jsx("div", {
            className: "px-6 py-8 text-center text-gray-400 text-sm",
            children: "No listings yet"
          })
        })]
      })]
    })]
  });
});
function StatCard({
  label,
  value,
  icon,
  color
}) {
  const colorClasses = {
    brand: {
      bg: "bg-white",
      iconBg: "bg-brand-100",
      iconText: "text-brand-600"
    },
    success: {
      bg: "bg-white",
      iconBg: "bg-success-100",
      iconText: "text-success-600"
    },
    accent: {
      bg: "bg-white",
      iconBg: "bg-accent-100",
      iconText: "text-accent-600"
    },
    blue: {
      bg: "bg-white",
      iconBg: "bg-blue-100",
      iconText: "text-blue-600"
    }
  };
  const icons = {
    users: /* @__PURE__ */ jsx("svg", {
      className: "w-5 h-5",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24",
      children: /* @__PURE__ */ jsx("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      })
    }),
    trending: /* @__PURE__ */ jsx("svg", {
      className: "w-5 h-5",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24",
      children: /* @__PURE__ */ jsx("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      })
    }),
    listings: /* @__PURE__ */ jsx("svg", {
      className: "w-5 h-5",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24",
      children: /* @__PURE__ */ jsx("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      })
    }),
    messages: /* @__PURE__ */ jsx("svg", {
      className: "w-5 h-5",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24",
      children: /* @__PURE__ */ jsx("path", {
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: 2,
        d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      })
    })
  };
  const c = colorClasses[color] || colorClasses.brand;
  return /* @__PURE__ */ jsx("div", {
    className: `${c.bg} rounded-xl p-4 md:p-6 border border-gray-200 shadow-sm`,
    children: /* @__PURE__ */ jsxs("div", {
      className: "flex items-center gap-3",
      children: [/* @__PURE__ */ jsx("div", {
        className: `w-10 h-10 rounded-full ${c.iconBg} flex items-center justify-center ${c.iconText}`,
        children: icons[icon]
      }), /* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("p", {
          className: "text-2xl font-bold text-gray-900",
          children: value
        }), /* @__PURE__ */ jsx("p", {
          className: "text-xs text-gray-500",
          children: label
        })]
      })]
    })
  });
}
const route41 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: admin__index,
  loader: loader$3,
  meta: meta$5
}, Symbol.toStringTag, { value: "Module" }));
const meta$4 = () => {
  return [{
    title: "Users - Admin - Runoot"
  }];
};
const ITEMS_PER_PAGE = 20;
async function loader$2({
  request
}) {
  const admin2 = await requireAdmin(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const typeFilter = url.searchParams.get("type") || "";
  const roleFilter = url.searchParams.get("role") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  let query = supabaseAdmin.from("profiles").select("*", {
    count: "exact"
  }).order("created_at", {
    ascending: false
  }).range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
  }
  if (typeFilter) {
    query = query.eq("user_type", typeFilter);
  }
  if (roleFilter) {
    query = query.eq("role", roleFilter);
  }
  const {
    data: users,
    count
  } = await query;
  return {
    admin: admin2,
    users: users || [],
    totalCount: count || 0,
    currentPage: page,
    totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
  };
}
async function action$2({
  request
}) {
  var _a;
  const admin2 = await requireAdmin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");
  switch (actionType) {
    case "verify": {
      const userId = formData.get("userId");
      const currentStatus = formData.get("currentStatus") === "true";
      await supabaseAdmin.from("profiles").update({
        is_verified: !currentStatus
      }).eq("id", userId);
      await logAdminAction(admin2.id, currentStatus ? "user_unverified" : "user_verified", {
        targetUserId: userId
      });
      return data({
        success: true
      });
    }
    case "changeRole": {
      const userId = formData.get("userId");
      const newRole = formData.get("newRole");
      if (!["user", "admin", "superadmin"].includes(newRole)) {
        return data({
          error: "Invalid role"
        }, {
          status: 400
        });
      }
      if (admin2.role !== "superadmin") {
        return data({
          error: "Only superadmins can change roles"
        }, {
          status: 403
        });
      }
      await supabaseAdmin.from("profiles").update({
        role: newRole
      }).eq("id", userId);
      await logAdminAction(admin2.id, "role_changed", {
        targetUserId: userId,
        details: {
          new_role: newRole
        }
      });
      return data({
        success: true
      });
    }
    case "impersonate": {
      const userId = formData.get("userId");
      const {
        data: targetUser
      } = await supabaseAdmin.from("profiles").select("id, created_by_admin").eq("id", userId).single();
      if (!targetUser || !targetUser.created_by_admin) {
        return data({
          error: "You can only impersonate users created from the admin panel"
        }, {
          status: 403
        });
      }
      return startImpersonation(request, userId);
    }
    case "toggleTeamLeader": {
      const userId = formData.get("userId");
      const currentStatus = formData.get("currentStatus") === "true";
      const newStatus = !currentStatus;
      let updateData = {
        is_team_leader: newStatus
      };
      if (newStatus) {
        const {
          data: userProfile
        } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", userId).single();
        const baseName = (userProfile == null ? void 0 : userProfile.full_name) || ((_a = userProfile == null ? void 0 : userProfile.email) == null ? void 0 : _a.split("@")[0]) || "TL";
        let code = baseName.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8) + (/* @__PURE__ */ new Date()).getFullYear();
        const {
          data: existing
        } = await supabaseAdmin.from("profiles").select("id").eq("referral_code", code).single();
        if (existing) {
          code = code + Math.floor(Math.random() * 100);
        }
        updateData.referral_code = code;
        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          type: "tl_promoted",
          title: "You're a Team Leader!",
          message: "An admin has promoted you to Team Leader. Share your referral link from the TL Dashboard!",
          data: {
            referral_code: code
          }
        });
      }
      await supabaseAdmin.from("profiles").update(updateData).eq("id", userId);
      await logAdminAction(admin2.id, newStatus ? "tl_promoted" : "tl_demoted", {
        targetUserId: userId
      });
      return data({
        success: true
      });
    }
    case "deleteUser": {
      const userId = formData.get("userId");
      if (admin2.role !== "superadmin") {
        return data({
          error: "Only superadmins can delete users"
        }, {
          status: 403
        });
      }
      if (userId === admin2.id) {
        return data({
          error: "You cannot delete yourself"
        }, {
          status: 400
        });
      }
      await supabaseAdmin.from("messages").delete().eq("sender_id", userId);
      await supabaseAdmin.from("saved_listings").delete().eq("user_id", userId);
      await supabaseAdmin.from("conversations").delete().or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
      await supabaseAdmin.from("listings").delete().eq("author_id", userId);
      await supabaseAdmin.from("blocked_users").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
      await supabaseAdmin.from("reports").delete().eq("reporter_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await logAdminAction(admin2.id, "user_deleted", {
        targetUserId: userId
      });
      return data({
        success: true
      });
    }
    default:
      return data({
        error: "Unknown action"
      }, {
        status: 400
      });
  }
}
const userTypeLabels = {
  tour_operator: "Tour Operator",
  private: "Runner"
};
const roleColors = {
  user: "bg-gray-100 text-gray-600",
  admin: "bg-purple-100 text-purple-700",
  superadmin: "bg-red-100 text-red-700"
};
const admin_users = UNSAFE_withComponentProps(function AdminUsers() {
  const {
    admin: admin2,
    users,
    totalCount,
    currentPage,
    totalPages
  } = useLoaderData();
  const actionData = useActionData();
  const [searchParams, setSearchParams] = useSearchParams();
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsxs("div", {
      className: "flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6",
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h1", {
          className: "font-display text-2xl md:text-3xl font-bold text-gray-900",
          children: "Users"
        }), /* @__PURE__ */ jsxs("p", {
          className: "text-gray-500 mt-1",
          children: [totalCount, " total users"]
        })]
      }), /* @__PURE__ */ jsxs(Link, {
        to: "/admin/users/new",
        className: "btn-primary inline-flex items-center gap-2 self-start",
        children: [/* @__PURE__ */ jsx("svg", {
          className: "w-4 h-4",
          fill: "none",
          stroke: "currentColor",
          viewBox: "0 0 24 24",
          children: /* @__PURE__ */ jsx("path", {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 2,
            d: "M12 4v16m8-8H4"
          })
        }), "Create User"]
      })]
    }), actionData && "error" in actionData && /* @__PURE__ */ jsx("div", {
      className: "mb-4 p-3 rounded-lg bg-alert-50 text-alert-700 text-sm",
      children: actionData.error
    }), /* @__PURE__ */ jsx("div", {
      className: "bg-white rounded-xl border border-gray-200 p-4 mb-6",
      children: /* @__PURE__ */ jsxs(Form, {
        method: "get",
        className: "flex flex-col md:flex-row gap-3",
        children: [/* @__PURE__ */ jsx("div", {
          className: "flex-1",
          children: /* @__PURE__ */ jsx("input", {
            type: "text",
            name: "search",
            placeholder: "Search by name, email, or company...",
            defaultValue: searchParams.get("search") || "",
            className: "input w-full"
          })
        }), /* @__PURE__ */ jsxs("select", {
          name: "type",
          defaultValue: searchParams.get("type") || "",
          className: "input",
          children: [/* @__PURE__ */ jsx("option", {
            value: "",
            children: "All types"
          }), /* @__PURE__ */ jsx("option", {
            value: "private",
            children: "Runner"
          }), /* @__PURE__ */ jsx("option", {
            value: "tour_operator",
            children: "Tour Operator"
          })]
        }), /* @__PURE__ */ jsxs("select", {
          name: "role",
          defaultValue: searchParams.get("role") || "",
          className: "input",
          children: [/* @__PURE__ */ jsx("option", {
            value: "",
            children: "All roles"
          }), /* @__PURE__ */ jsx("option", {
            value: "user",
            children: "User"
          }), /* @__PURE__ */ jsx("option", {
            value: "admin",
            children: "Admin"
          }), /* @__PURE__ */ jsx("option", {
            value: "superadmin",
            children: "Superadmin"
          })]
        }), /* @__PURE__ */ jsx("button", {
          type: "submit",
          className: "btn-accent",
          children: "Search"
        })]
      })
    }), /* @__PURE__ */ jsxs("div", {
      className: "bg-white rounded-xl border border-gray-200 overflow-hidden",
      children: [/* @__PURE__ */ jsx("div", {
        className: "hidden md:block overflow-x-auto",
        children: /* @__PURE__ */ jsxs("table", {
          className: "w-full",
          children: [/* @__PURE__ */ jsx("thead", {
            className: "bg-gray-50 border-b border-gray-200",
            children: /* @__PURE__ */ jsxs("tr", {
              children: [/* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "User"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Type"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Role"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Verified"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Joined"
              }), /* @__PURE__ */ jsx("th", {
                className: "text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3",
                children: "Actions"
              })]
            })
          }), /* @__PURE__ */ jsx("tbody", {
            className: "divide-y divide-gray-100",
            children: users.map((user) => /* @__PURE__ */ jsxs("tr", {
              className: "hover:bg-gray-50 transition-colors",
              children: [/* @__PURE__ */ jsx("td", {
                className: "px-6 py-4",
                children: /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("p", {
                    className: "text-sm font-medium text-gray-900",
                    children: user.full_name || "No name"
                  }), /* @__PURE__ */ jsx("p", {
                    className: "text-xs text-gray-500",
                    children: user.email
                  }), user.company_name && /* @__PURE__ */ jsx("p", {
                    className: "text-xs text-gray-400",
                    children: user.company_name
                  })]
                })
              }), /* @__PURE__ */ jsx("td", {
                className: "px-6 py-4",
                children: /* @__PURE__ */ jsx("span", {
                  className: "text-sm text-gray-600",
                  children: userTypeLabels[user.user_type] || user.user_type
                })
              }), /* @__PURE__ */ jsx("td", {
                className: "px-6 py-4",
                children: admin2.role === "superadmin" ? /* @__PURE__ */ jsxs(Form, {
                  method: "post",
                  className: "inline",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "_action",
                    value: "changeRole"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "userId",
                    value: user.id
                  }), /* @__PURE__ */ jsxs("select", {
                    name: "newRole",
                    defaultValue: user.role,
                    onChange: (e) => {
                      var _a;
                      return (_a = e.target.form) == null ? void 0 : _a.requestSubmit();
                    },
                    className: `text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${roleColors[user.role] || ""}`,
                    children: [/* @__PURE__ */ jsx("option", {
                      value: "user",
                      children: "user"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "admin",
                      children: "admin"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "superadmin",
                      children: "superadmin"
                    })]
                  })]
                }) : /* @__PURE__ */ jsx("span", {
                  className: `px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role] || ""}`,
                  children: user.role
                })
              }), /* @__PURE__ */ jsx("td", {
                className: "px-6 py-4",
                children: /* @__PURE__ */ jsxs(Form, {
                  method: "post",
                  className: "inline",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "_action",
                    value: "verify"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "userId",
                    value: user.id
                  }), /* @__PURE__ */ jsx("input", {
                    type: "hidden",
                    name: "currentStatus",
                    value: user.is_verified.toString()
                  }), /* @__PURE__ */ jsx("button", {
                    type: "submit",
                    className: `text-sm font-medium ${user.is_verified ? "text-brand-600 hover:text-brand-700" : "text-gray-400 hover:text-gray-600"}`,
                    children: user.is_verified ? /* @__PURE__ */ jsxs("span", {
                      className: "flex items-center gap-1",
                      children: [/* @__PURE__ */ jsx("svg", {
                        className: "w-4 h-4",
                        fill: "currentColor",
                        viewBox: "0 0 20 20",
                        children: /* @__PURE__ */ jsx("path", {
                          fillRule: "evenodd",
                          d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                          clipRule: "evenodd"
                        })
                      }), "Verified"]
                    }) : "Not verified"
                  })]
                })
              }), /* @__PURE__ */ jsx("td", {
                className: "px-6 py-4 text-sm text-gray-500",
                children: new Date(user.created_at).toLocaleDateString()
              }), /* @__PURE__ */ jsx("td", {
                className: "px-6 py-4 text-right",
                children: /* @__PURE__ */ jsxs("div", {
                  className: "flex items-center justify-end gap-2",
                  children: [/* @__PURE__ */ jsxs(Form, {
                    method: "post",
                    className: "inline",
                    children: [/* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "_action",
                      value: "toggleTeamLeader"
                    }), /* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "userId",
                      value: user.id
                    }), /* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "currentStatus",
                      value: (user.is_team_leader || false).toString()
                    }), /* @__PURE__ */ jsxs("button", {
                      type: "submit",
                      className: `text-xs font-medium px-2 py-1 rounded transition-colors ${user.is_team_leader ? "text-purple-700 bg-purple-50 hover:bg-purple-100" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`,
                      title: user.is_team_leader ? "Remove Team Leader" : "Make Team Leader",
                      children: [/* @__PURE__ */ jsx("svg", {
                        className: "w-4 h-4 inline mr-0.5",
                        fill: "none",
                        stroke: "currentColor",
                        viewBox: "0 0 24 24",
                        children: /* @__PURE__ */ jsx("path", {
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          strokeWidth: 2,
                          d: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        })
                      }), user.is_team_leader ? "TL" : "Set TL"]
                    })]
                  }), user.created_by_admin && /* @__PURE__ */ jsxs(Form, {
                    method: "post",
                    className: "inline",
                    children: [/* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "_action",
                      value: "impersonate"
                    }), /* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "userId",
                      value: user.id
                    }), /* @__PURE__ */ jsxs("button", {
                      type: "submit",
                      className: "text-xs font-medium text-navy-500 hover:text-navy-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors",
                      title: "Impersonate this user",
                      children: [/* @__PURE__ */ jsxs("svg", {
                        className: "w-4 h-4 inline mr-1",
                        fill: "none",
                        stroke: "currentColor",
                        viewBox: "0 0 24 24",
                        children: [/* @__PURE__ */ jsx("path", {
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          strokeWidth: 2,
                          d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        }), /* @__PURE__ */ jsx("path", {
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          strokeWidth: 2,
                          d: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        })]
                      }), "Impersonate"]
                    })]
                  }), admin2.role === "superadmin" && user.id !== admin2.id && /* @__PURE__ */ jsxs(Form, {
                    method: "post",
                    className: "inline",
                    onSubmit: (e) => {
                      if (!confirm(`Delete ${user.full_name || user.email}? This cannot be undone.`)) e.preventDefault();
                    },
                    children: [/* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "_action",
                      value: "deleteUser"
                    }), /* @__PURE__ */ jsx("input", {
                      type: "hidden",
                      name: "userId",
                      value: user.id
                    }), /* @__PURE__ */ jsxs("button", {
                      type: "submit",
                      className: "text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors",
                      title: "Delete this user",
                      children: [/* @__PURE__ */ jsx("svg", {
                        className: "w-4 h-4 inline mr-1",
                        fill: "none",
                        stroke: "currentColor",
                        viewBox: "0 0 24 24",
                        children: /* @__PURE__ */ jsx("path", {
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          strokeWidth: 2,
                          d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        })
                      }), "Delete"]
                    })]
                  })]
                })
              })]
            }, user.id))
          })]
        })
      }), /* @__PURE__ */ jsx("div", {
        className: "md:hidden divide-y divide-gray-100",
        children: users.map((user) => /* @__PURE__ */ jsxs("div", {
          className: "p-4",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "flex items-start justify-between mb-2",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("p", {
                className: "text-sm font-medium text-gray-900",
                children: user.full_name || "No name"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-xs text-gray-500",
                children: user.email
              }), user.company_name && /* @__PURE__ */ jsx("p", {
                className: "text-xs text-gray-400",
                children: user.company_name
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-1",
              children: [user.is_team_leader && /* @__PURE__ */ jsx("span", {
                className: "px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700",
                children: "TL"
              }), /* @__PURE__ */ jsx("span", {
                className: `px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role] || ""}`,
                children: user.role
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex items-center justify-between mt-3",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-2 text-xs text-gray-500",
              children: [/* @__PURE__ */ jsx("span", {
                children: userTypeLabels[user.user_type]
              }), /* @__PURE__ */ jsx("span", {
                children: "·"
              }), /* @__PURE__ */ jsx("span", {
                children: new Date(user.created_at).toLocaleDateString()
              }), user.is_verified && /* @__PURE__ */ jsxs(Fragment, {
                children: [/* @__PURE__ */ jsx("span", {
                  children: "·"
                }), /* @__PURE__ */ jsx("span", {
                  className: "text-brand-600",
                  children: "Verified"
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "flex items-center gap-2 flex-wrap",
              children: [/* @__PURE__ */ jsxs(Form, {
                method: "post",
                className: "inline",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "_action",
                  value: "verify"
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "userId",
                  value: user.id
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "currentStatus",
                  value: user.is_verified.toString()
                }), /* @__PURE__ */ jsx("button", {
                  type: "submit",
                  className: "text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded bg-gray-50",
                  children: user.is_verified ? "Unverify" : "Verify"
                })]
              }), /* @__PURE__ */ jsxs(Form, {
                method: "post",
                className: "inline",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "_action",
                  value: "toggleTeamLeader"
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "userId",
                  value: user.id
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "currentStatus",
                  value: (user.is_team_leader || false).toString()
                }), /* @__PURE__ */ jsx("button", {
                  type: "submit",
                  className: `text-xs px-2 py-1 rounded ${user.is_team_leader ? "text-purple-700 bg-purple-50" : "text-gray-500 bg-gray-50"}`,
                  children: user.is_team_leader ? "Remove TL" : "Set TL"
                })]
              }), user.created_by_admin && /* @__PURE__ */ jsxs(Form, {
                method: "post",
                className: "inline",
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "_action",
                  value: "impersonate"
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "userId",
                  value: user.id
                }), /* @__PURE__ */ jsx("button", {
                  type: "submit",
                  className: "text-xs text-navy-500 hover:text-navy-700 px-2 py-1 rounded bg-gray-50",
                  children: "Impersonate"
                })]
              }), admin2.role === "superadmin" && user.id !== admin2.id && /* @__PURE__ */ jsxs(Form, {
                method: "post",
                className: "inline",
                onSubmit: (e) => {
                  if (!confirm(`Delete ${user.full_name || user.email}?`)) e.preventDefault();
                },
                children: [/* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "_action",
                  value: "deleteUser"
                }), /* @__PURE__ */ jsx("input", {
                  type: "hidden",
                  name: "userId",
                  value: user.id
                }), /* @__PURE__ */ jsx("button", {
                  type: "submit",
                  className: "text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded bg-red-50",
                  children: "Delete"
                })]
              })]
            })]
          })]
        }, user.id))
      }), users.length === 0 && /* @__PURE__ */ jsx("div", {
        className: "p-8 text-center text-gray-400 text-sm",
        children: "No users found"
      })]
    }), totalPages > 1 && /* @__PURE__ */ jsxs("div", {
      className: "mt-6 flex items-center justify-center gap-2",
      children: [currentPage > 1 && /* @__PURE__ */ jsx(Link, {
        to: `/admin/users?page=${currentPage - 1}&search=${searchParams.get("search") || ""}&type=${searchParams.get("type") || ""}&role=${searchParams.get("role") || ""}`,
        className: "px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50",
        children: "Previous"
      }), /* @__PURE__ */ jsxs("span", {
        className: "text-sm text-gray-500",
        children: ["Page ", currentPage, " of ", totalPages]
      }), currentPage < totalPages && /* @__PURE__ */ jsx(Link, {
        to: `/admin/users?page=${currentPage + 1}&search=${searchParams.get("search") || ""}&type=${searchParams.get("type") || ""}&role=${searchParams.get("role") || ""}`,
        className: "px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50",
        children: "Next"
      })]
    })]
  });
});
const route42 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  default: admin_users,
  loader: loader$2,
  meta: meta$4
}, Symbol.toStringTag, { value: "Module" }));
const meta$3 = () => {
  return [{
    title: "Create User - Admin - Runoot"
  }];
};
async function action$1({
  request
}) {
  const admin2 = await requireAdmin(request);
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const fullName = formData.get("fullName");
  const userType = formData.get("userType");
  const companyName = formData.get("companyName");
  const role = formData.get("role") || "user";
  const skipConfirmation = formData.get("skipConfirmation") === "on";
  if (!email || !password || !fullName || !userType) {
    return data({
      error: "Email, password, full name, and user type are required"
    }, {
      status: 400
    });
  }
  if (password.length < 6) {
    return data({
      error: "Password must be at least 6 characters"
    }, {
      status: 400
    });
  }
  if (!["private", "tour_operator"].includes(userType)) {
    return data({
      error: "Invalid user type"
    }, {
      status: 400
    });
  }
  if (role !== "user" && admin2.role !== "superadmin") {
    return data({
      error: "Only superadmins can create admin users"
    }, {
      status: 403
    });
  }
  try {
    const {
      data: authData,
      error: authError
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: skipConfirmation,
      user_metadata: {
        full_name: fullName,
        user_type: userType,
        company_name: companyName || null
      }
    });
    if (authError) {
      return data({
        error: authError.message
      }, {
        status: 400
      });
    }
    if (!authData.user) {
      return data({
        error: "Failed to create user"
      }, {
        status: 500
      });
    }
    const profileData = {
      id: authData.user.id,
      email,
      full_name: fullName,
      user_type: userType,
      role,
      company_name: companyName || null,
      created_by_admin: admin2.id
    };
    const {
      error: profileError
    } = await supabaseAdmin.from("profiles").insert(profileData);
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return data({
        error: `Profile creation failed: ${profileError.message}`
      }, {
        status: 500
      });
    }
    await logAdminAction(admin2.id, "user_created", {
      targetUserId: authData.user.id,
      details: {
        email,
        user_type: userType,
        role
      }
    });
    return redirect("/admin/users");
  } catch (err) {
    return data({
      error: err.message || "An unexpected error occurred"
    }, {
      status: 500
    });
  }
}
const admin_users_new = UNSAFE_withComponentProps(function AdminCreateUser() {
  const actionData = useActionData();
  return /* @__PURE__ */ jsxs("div", {
    className: "max-w-2xl",
    children: [/* @__PURE__ */ jsxs("div", {
      className: "flex items-center gap-4 mb-6",
      children: [/* @__PURE__ */ jsx(Link, {
        to: "/admin/users",
        className: "p-2 rounded-lg hover:bg-gray-200 transition-colors",
        children: /* @__PURE__ */ jsx("svg", {
          className: "w-5 h-5 text-gray-600",
          fill: "none",
          stroke: "currentColor",
          viewBox: "0 0 24 24",
          children: /* @__PURE__ */ jsx("path", {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 2,
            d: "M10 19l-7-7m0 0l7-7m-7 7h18"
          })
        })
      }), /* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h1", {
          className: "font-display text-2xl md:text-3xl font-bold text-gray-900",
          children: "Create User"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-gray-500 mt-1",
          children: "Add a new user to the platform"
        })]
      })]
    }), actionData && "error" in actionData && /* @__PURE__ */ jsx("div", {
      className: "mb-6 p-4 rounded-lg bg-alert-50 border border-alert-200 text-alert-700 text-sm",
      children: actionData.error
    }), /* @__PURE__ */ jsx("div", {
      className: "bg-white rounded-xl border border-gray-200 p-6",
      children: /* @__PURE__ */ jsxs(Form, {
        method: "post",
        className: "space-y-5",
        children: [/* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("label", {
            htmlFor: "email",
            className: "label",
            children: "Email *"
          }), /* @__PURE__ */ jsx("input", {
            type: "email",
            id: "email",
            name: "email",
            required: true,
            className: "input w-full",
            placeholder: "user@example.com"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("label", {
            htmlFor: "password",
            className: "label",
            children: "Password *"
          }), /* @__PURE__ */ jsx("input", {
            type: "password",
            id: "password",
            name: "password",
            required: true,
            minLength: 6,
            className: "input w-full",
            placeholder: "Minimum 6 characters"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("label", {
            htmlFor: "fullName",
            className: "label",
            children: "Full Name *"
          }), /* @__PURE__ */ jsx("input", {
            type: "text",
            id: "fullName",
            name: "fullName",
            required: true,
            className: "input w-full",
            placeholder: "John Doe"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("label", {
            htmlFor: "userType",
            className: "label",
            children: "User Type *"
          }), /* @__PURE__ */ jsxs("select", {
            id: "userType",
            name: "userType",
            required: true,
            className: "input w-full",
            children: [/* @__PURE__ */ jsx("option", {
              value: "",
              children: "Select type..."
            }), /* @__PURE__ */ jsx("option", {
              value: "private",
              children: "Private Runner"
            }), /* @__PURE__ */ jsx("option", {
              value: "tour_operator",
              children: "Tour Operator"
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsxs("label", {
            htmlFor: "companyName",
            className: "label",
            children: ["Company Name ", /* @__PURE__ */ jsx("span", {
              className: "text-gray-400 font-normal",
              children: "(for Tour Operators)"
            })]
          }), /* @__PURE__ */ jsx("input", {
            type: "text",
            id: "companyName",
            name: "companyName",
            className: "input w-full",
            placeholder: "Travel Agency Name"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("label", {
            htmlFor: "role",
            className: "label",
            children: "Role"
          }), /* @__PURE__ */ jsxs("select", {
            id: "role",
            name: "role",
            className: "input w-full",
            children: [/* @__PURE__ */ jsx("option", {
              value: "user",
              children: "User (default)"
            }), /* @__PURE__ */ jsx("option", {
              value: "admin",
              children: "Admin"
            }), /* @__PURE__ */ jsx("option", {
              value: "superadmin",
              children: "Superadmin"
            })]
          }), /* @__PURE__ */ jsx("p", {
            className: "text-xs text-gray-400 mt-1",
            children: "Only superadmins can create admin/superadmin users"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-3",
          children: [/* @__PURE__ */ jsx("input", {
            type: "checkbox",
            id: "skipConfirmation",
            name: "skipConfirmation",
            defaultChecked: true,
            className: "w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          }), /* @__PURE__ */ jsx("label", {
            htmlFor: "skipConfirmation",
            className: "text-sm text-gray-700",
            children: "Skip email confirmation (user can login immediately)"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-3 pt-4 border-t border-gray-100",
          children: [/* @__PURE__ */ jsx("button", {
            type: "submit",
            className: "btn-primary",
            children: "Create User"
          }), /* @__PURE__ */ jsx(Link, {
            to: "/admin/users",
            className: "btn-secondary",
            children: "Cancel"
          })]
        })]
      })
    })]
  });
});
const route43 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: admin_users_new,
  meta: meta$3
}, Symbol.toStringTag, { value: "Module" }));
const meta$2 = () => {
  return [{
    title: "Login - Runoot"
  }];
};
async function loader$1({
  request
}) {
  const user = await getUser(request);
  if (user) {
    const redirectUrl = user.user_type === "tour_operator" ? "/dashboard" : "/listings";
    return redirect(redirectUrl);
  }
  return {};
}
async function action({
  request
}) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectToParam = formData.get("redirectTo");
  if (typeof email !== "string" || typeof password !== "string") {
    return data({
      error: "Invalid form submission"
    }, {
      status: 400
    });
  }
  if (!email || !password) {
    return data({
      error: "Email and password are required"
    }, {
      status: 400
    });
  }
  const {
    data: authData,
    error
  } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    return data({
      error: error.message
    }, {
      status: 400
    });
  }
  if (!authData.session) {
    return data({
      error: "Login failed"
    }, {
      status: 400
    });
  }
  const {
    data: profile
  } = await supabaseAdmin.from("profiles").select("user_type").eq("id", authData.user.id).single();
  let redirectTo = "/listings";
  if (redirectToParam && redirectToParam !== "/dashboard") {
    redirectTo = redirectToParam;
  } else if ((profile == null ? void 0 : profile.user_type) === "tour_operator") {
    redirectTo = "/dashboard";
  }
  return createUserSession(authData.user.id, authData.session.access_token, authData.session.refresh_token, redirectTo);
}
const login = UNSAFE_withComponentProps(function Login() {
  const [searchParams] = useSearchParams();
  const actionData = useActionData();
  const redirectTo = searchParams.get("redirectTo") || "";
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50",
    children: [/* @__PURE__ */ jsxs("div", {
      className: "sm:mx-auto sm:w-full sm:max-w-md",
      children: [/* @__PURE__ */ jsx(Link, {
        to: "/",
        className: "flex justify-center",
        children: /* @__PURE__ */ jsx("div", {
          className: "flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600",
          children: /* @__PURE__ */ jsx("svg", {
            className: "h-7 w-7 text-white",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 2,
              d: "M13 10V3L4 14h7v7l9-11h-7z"
            })
          })
        })
      }), /* @__PURE__ */ jsx("h2", {
        className: "mt-6 text-center font-display text-3xl font-bold tracking-tight text-gray-900",
        children: "Welcome back"
      }), /* @__PURE__ */ jsxs("p", {
        className: "mt-2 text-center text-sm text-gray-600",
        children: ["Don't have an account?", " ", /* @__PURE__ */ jsx(Link, {
          to: "/register",
          className: "font-medium text-brand-600 hover:text-brand-500",
          children: "Sign up"
        })]
      })]
    }), /* @__PURE__ */ jsx("div", {
      className: "mt-8 sm:mx-auto sm:w-full sm:max-w-md",
      children: /* @__PURE__ */ jsxs("div", {
        className: "bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10 border border-gray-200",
        children: [/* @__PURE__ */ jsxs(Form, {
          method: "post",
          className: "space-y-6",
          children: [/* @__PURE__ */ jsx("input", {
            type: "hidden",
            name: "redirectTo",
            value: redirectTo
          }), (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx("div", {
            className: "rounded-lg bg-red-50 p-4 text-sm text-red-700",
            children: actionData.error
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "email",
              className: "label",
              children: "Email address"
            }), /* @__PURE__ */ jsx("input", {
              id: "email",
              name: "email",
              type: "email",
              autoComplete: "email",
              required: true,
              className: "input"
            })]
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              htmlFor: "password",
              className: "label",
              children: "Password"
            }), /* @__PURE__ */ jsx("input", {
              id: "password",
              name: "password",
              type: "password",
              autoComplete: "current-password",
              required: true,
              className: "input"
            })]
          }), /* @__PURE__ */ jsx("div", {
            children: /* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "btn-primary w-full",
              children: "Sign in"
            })
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "mt-6",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "relative",
            children: [/* @__PURE__ */ jsx("div", {
              className: "absolute inset-0 flex items-center",
              children: /* @__PURE__ */ jsx("div", {
                className: "w-full border-t border-gray-200"
              })
            }), /* @__PURE__ */ jsx("div", {
              className: "relative flex justify-center text-sm",
              children: /* @__PURE__ */ jsx("span", {
                className: "bg-white px-2 text-gray-500",
                children: "Or continue with"
              })
            })]
          }), /* @__PURE__ */ jsx("div", {
            className: "mt-6",
            children: /* @__PURE__ */ jsx(Form, {
              action: "/auth/google",
              method: "post",
              children: /* @__PURE__ */ jsxs("button", {
                type: "submit",
                className: "btn-secondary w-full flex items-center justify-center gap-3",
                children: [/* @__PURE__ */ jsxs("svg", {
                  className: "h-5 w-5",
                  viewBox: "0 0 24 24",
                  children: [/* @__PURE__ */ jsx("path", {
                    fill: "#4285F4",
                    d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  }), /* @__PURE__ */ jsx("path", {
                    fill: "#34A853",
                    d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  }), /* @__PURE__ */ jsx("path", {
                    fill: "#FBBC05",
                    d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  }), /* @__PURE__ */ jsx("path", {
                    fill: "#EA4335",
                    d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  })]
                }), "Continue with Google"]
              })
            })
          })]
        })]
      })
    })]
  });
});
const route44 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: login,
  loader: loader$1,
  meta: meta$2
}, Symbol.toStringTag, { value: "Module" }));
const meta$1 = () => {
  return [{
    title: "Saved Listings - Runoot"
  }];
};
async function loader({
  request
}) {
  const user = await requireUser(request);
  const userId = user.id;
  const {
    data: savedListings,
    error
  } = await supabaseAdmin.from("saved_listings").select(`
      id,
      created_at,
      listing:listings(
        id,
        title,
        listing_type,
        hotel_name,
        hotel_stars,
        hotel_rating,
        room_count,
        room_type,
        bib_count,
        price,
        currency,
        price_negotiable,
        transfer_type,
        associated_costs,
        check_in,
        check_out,
        status,
        created_at,
        author:profiles(id, full_name, company_name, user_type, is_verified),
        event:events(id, name, country, event_date)
      )
    `).eq("user_id", userId).order("created_at", {
    ascending: false
  });
  if (error) {
    console.error("Error fetching saved listings:", error);
    return {
      user,
      savedListings: []
    };
  }
  const activeListings = (savedListings == null ? void 0 : savedListings.filter((s) => s.listing && s.listing.status === "active").map((s) => s.listing)) || [];
  return {
    user,
    savedListings: activeListings
  };
}
const saved = UNSAFE_withComponentProps(function SavedListings() {
  const {
    user,
    savedListings
  } = useLoaderData();
  return /* @__PURE__ */ jsx("div", {
    className: "min-h-screen bg-[url('/savedBG.png')] bg-cover bg-center bg-fixed",
    children: /* @__PURE__ */ jsxs("div", {
      className: "min-h-screen bg-gray-50/60 md:bg-gray-50/85 flex flex-col",
      children: [/* @__PURE__ */ jsx(Header, {
        user
      }), /* @__PURE__ */ jsxs("main", {
        className: "mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8 sm:px-6 lg:px-8 flex-grow w-full",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "mb-8 bg-white/70 backdrop-blur-sm rounded-xl shadow-md px-3 py-4 sm:p-6",
          children: [/* @__PURE__ */ jsx("h1", {
            className: "font-display text-2xl sm:text-3xl font-bold text-gray-900 text-center sm:text-left",
            children: "Saved Listings"
          }), /* @__PURE__ */ jsx("p", {
            className: "hidden sm:block mt-2 text-gray-600",
            children: "Listings you've saved for later"
          })]
        }), savedListings.length === 0 ? /* @__PURE__ */ jsxs("div", {
          className: "card p-12 text-center shadow-md",
          children: [/* @__PURE__ */ jsx("svg", {
            className: "mx-auto h-16 w-16 text-gray-300",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            children: /* @__PURE__ */ jsx("path", {
              strokeLinecap: "round",
              strokeLinejoin: "round",
              strokeWidth: 1.5,
              d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "mt-4 text-lg font-medium text-gray-900",
            children: "No saved listings yet"
          }), /* @__PURE__ */ jsx("p", {
            className: "mt-2 text-gray-500",
            children: "When you find a listing you like, click the heart icon to save it here."
          }), /* @__PURE__ */ jsx(Link, {
            to: "/listings",
            className: "btn-primary rounded-full mt-6 inline-block",
            children: "Browse Listings"
          })]
        }) : /* @__PURE__ */ jsxs(Fragment, {
          children: [/* @__PURE__ */ jsx("div", {
            className: "hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3",
            children: savedListings.map((listing) => /* @__PURE__ */ jsx(ListingCard, {
              listing,
              isUserLoggedIn: true,
              isSaved: true
            }, listing.id))
          }), /* @__PURE__ */ jsx("div", {
            className: "flex flex-col gap-3 md:hidden",
            children: savedListings.map((listing) => /* @__PURE__ */ jsx(ListingCardCompact, {
              listing,
              isUserLoggedIn: true,
              isSaved: true
            }, listing.id))
          })]
        })]
      }), /* @__PURE__ */ jsx(FooterLight, {})]
    })
  });
});
const route45 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: saved,
  loader,
  meta: meta$1
}, Symbol.toStringTag, { value: "Module" }));
const meta = () => {
  return [{
    title: "Termini e Condizioni | Runoot"
  }, {
    name: "description",
    content: "Termini e Condizioni di utilizzo della piattaforma Runoot - Leggi attentamente prima di utilizzare il servizio."
  }];
};
const terms = UNSAFE_withComponentProps(function TermsOfService() {
  const lastUpdated = "29 Gennaio 2025";
  const companyEmail = "legal@runoot.com";
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-screen bg-gray-50",
    children: [/* @__PURE__ */ jsx("header", {
      className: "bg-white shadow-sm",
      children: /* @__PURE__ */ jsxs("div", {
        className: "max-w-4xl mx-auto px-4 py-6",
        children: [/* @__PURE__ */ jsx("a", {
          href: "/",
          className: "text-brand-600 hover:text-brand-700 text-sm",
          children: "← Torna alla Home"
        }), /* @__PURE__ */ jsx("h1", {
          className: "text-3xl font-bold text-gray-900 mt-4",
          children: "Termini e Condizioni di Utilizzo"
        }), /* @__PURE__ */ jsxs("p", {
          className: "text-gray-500 mt-2",
          children: ["Ultimo aggiornamento: ", lastUpdated]
        })]
      })
    }), /* @__PURE__ */ jsxs("main", {
      className: "max-w-4xl mx-auto px-4 py-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "bg-white rounded-lg shadow-sm p-8 space-y-8",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "bg-red-50 border-2 border-red-200 rounded-lg p-6",
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-lg font-bold text-red-800 mb-3",
            children: "AVVISO IMPORTANTE - LEGGERE ATTENTAMENTE"
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-red-700 leading-relaxed",
            children: ["Runoot è esclusivamente una piattaforma di annunci che mette in contatto utenti interessati allo scambio di stanze d'hotel e pettorali per eventi podistici. ", /* @__PURE__ */ jsx("strong", {
              children: "Runoot NON partecipa, media, garantisce o supervisiona in alcun modo le transazioni tra utenti."
            }), " Tutte le transazioni avvengono direttamente tra le parti coinvolte, a loro esclusivo rischio e responsabilità."]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "1. Accettazione dei Termini"
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed",
            children: [`I presenti Termini e Condizioni di Utilizzo (di seguito "Termini") regolano l'accesso e l'utilizzo della piattaforma Runoot (di seguito "Piattaforma" o "Servizio"), accessibile all'indirizzo`, " ", /* @__PURE__ */ jsx("a", {
              href: "https://runoot.com",
              className: "text-brand-600 hover:underline",
              children: "runoot.com"
            }), "."]
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: [/* @__PURE__ */ jsx("strong", {
              children: "Utilizzando la Piattaforma, l'utente dichiara di aver letto, compreso e accettato integralmente i presenti Termini."
            }), " Se non si accettano i Termini, è necessario astenersi dall'utilizzo della Piattaforma."]
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: "La registrazione e l'utilizzo della Piattaforma costituiscono accettazione vincolante dei presenti Termini, della Privacy Policy e della Cookie Policy."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "2. Definizioni"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-3 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-bold",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: '"Piattaforma"'
                }), ": il sito web Runoot e tutti i servizi ad esso correlati."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-bold",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: '"Titolare"'
                }), ": il soggetto che gestisce la Piattaforma, come identificato nei documenti legali."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-bold",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: '"Utente"'
                }), ": qualsiasi persona fisica o giuridica che accede o utilizza la Piattaforma."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-bold",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: '"Tour Operator"'
                }), ": utente registrato come operatore professionale nel settore turistico."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-bold",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: '"Privato" o "Private Runner"'
                }), ": utente registrato come individuo non professionale."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-bold",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: '"Annuncio" o "Listing"'
                }), ": inserzione pubblicata da un utente per offrire stanze d'hotel, pettorali o pacchetti combinati."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-bold",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: '"Pettorale" o "Bib"'
                }), ": numero di gara che consente la partecipazione a un evento podistico."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-bold",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: '"Venditore"'
                }), ": utente che pubblica un annuncio per cedere stanze, pettorali o pacchetti."]
              })]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2 font-bold",
                children: "•"
              }), /* @__PURE__ */ jsxs("span", {
                children: [/* @__PURE__ */ jsx("strong", {
                  children: '"Acquirente"'
                }), ": utente interessato ad acquisire quanto offerto in un annuncio."]
              })]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "3. Natura del Servizio"
          }), /* @__PURE__ */ jsx("div", {
            className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4",
            children: /* @__PURE__ */ jsx("p", {
              className: "text-gray-700 leading-relaxed font-medium",
              children: "Runoot è una piattaforma di annunci classificati che consente agli utenti di pubblicare offerte relative a stanze d'hotel e pettorali per eventi podistici (maratone, mezze maratone, trail, ecc.) e di entrare in contatto tra loro."
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "3.1 Cosa fa Runoot"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-green-500 mr-2",
                children: "✓"
              }), "Fornisce uno spazio dove pubblicare annunci di stanze d'hotel e pettorali"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-green-500 mr-2",
                children: "✓"
              }), "Consente agli utenti di cercare e visualizzare annunci"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-green-500 mr-2",
                children: "✓"
              }), "Permette agli utenti di contattarsi tramite sistema di messaggistica interno"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-green-500 mr-2",
                children: "✓"
              }), "Offre strumenti di traduzione automatica dei messaggi"]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "3.2 Cosa NON fa Runoot"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "NON partecipa, media o garantisce le transazioni tra utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "NON gestisce, processa o trasferisce pagamenti tra utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "NON verifica l'identità, l'affidabilità, la solvibilità o la buona fede degli utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "NON garantisce la disponibilità, qualità, legittimità o veridicità degli annunci"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "NON verifica la conformità del trasferimento dei pettorali ai regolamenti delle gare"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "NON fornisce servizi di prenotazione alberghiera o agenzia di viaggi"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "NON offre servizi di escrow, deposito a garanzia o protezione acquirenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "NON interviene in caso di dispute, controversie o inadempimenti tra utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "NON fornisce rimborsi, risarcimenti o compensazioni di alcun tipo"]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "4. Registrazione e Account"
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3",
            children: "4.1 Requisiti"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Per utilizzare la Piattaforma è necessario:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700 mt-3",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Aver compiuto 18 anni di età"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Possedere la capacità legale di stipulare contratti vincolanti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Fornire informazioni veritiere e complete durante la registrazione"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Mantenere aggiornate le informazioni del proprio account"]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "4.2 Tipologie di Account"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-3",
            children: "La Piattaforma prevede due tipologie di account:"
          }), /* @__PURE__ */ jsxs("div", {
            className: "space-y-4",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "bg-gray-50 rounded-lg p-4",
              children: [/* @__PURE__ */ jsx("h4", {
                className: "font-medium text-gray-900",
                children: "Tour Operator"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-700 mt-2",
                children: "Account destinato a professionisti del settore turistico. Consente di pubblicare annunci con quantità illimitate di stanze e pettorali e di utilizzare tutte le modalità di trasferimento disponibili."
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "bg-gray-50 rounded-lg p-4",
              children: [/* @__PURE__ */ jsx("h4", {
                className: "font-medium text-gray-900",
                children: "Privato (Private Runner)"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-700 mt-2",
                children: "Account destinato a individui non professionisti. Limitato a massimo 1 stanza e 1 pettorale per annuncio. Il trasferimento dei pettorali deve avvenire esclusivamente tramite la procedura ufficiale dell'organizzatore della gara."
              })]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "4.3 Responsabilità dell'Account"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "L'utente è l'unico responsabile della sicurezza del proprio account e della password. Qualsiasi attività svolta tramite l'account è imputabile all'utente titolare. In caso di accesso non autorizzato, l'utente deve notificarlo immediatamente al Titolare."
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "4.4 Verifica degli Account"
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed",
            children: ['Il Titolare si riserva la facoltà, a propria esclusiva discrezione, di verificare gli account e assegnare un badge "Verificato". Tale verifica è puramente discrezionale e ', /* @__PURE__ */ jsx("strong", {
              children: "non costituisce in alcun modo garanzia di affidabilità, solvibilità o buona fede dell'utente"
            }), ". L'assenza del badge di verifica non implica che l'utente sia inaffidabile."]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "5. Pubblicazione degli Annunci"
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3",
            children: "5.1 Tipologie di Annunci"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-3",
            children: "La Piattaforma consente la pubblicazione di tre tipologie di annunci:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsx("strong", {
                children: "Solo Stanza:"
              }), " offerta di prenotazione alberghiera in prossimità di un evento podistico"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsx("strong", {
                children: "Solo Pettorale:"
              }), " offerta di numero di gara (bib) per un evento podistico"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), /* @__PURE__ */ jsx("strong", {
                children: "Stanza + Pettorale:"
              }), " pacchetto combinato"]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "5.2 Obblighi del Venditore"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-3",
            children: "Pubblicando un annuncio, il Venditore dichiara e garantisce che:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "a)"
              }), "Le informazioni fornite sono veritiere, accurate e complete"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "b)"
              }), "Ha la piena e legittima disponibilità di quanto offerto"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "c)"
              }), "La cessione è conforme alle leggi applicabili e ai regolamenti degli organizzatori"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "d)"
              }), "Non sta violando diritti di terzi o obblighi contrattuali"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "e)"
              }), "Aggiornerà tempestivamente l'annuncio in caso di variazioni o indisponibilità"]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "5.3 Contenuti Vietati"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-3",
            children: "È vietato pubblicare annunci che:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Contengano informazioni false, ingannevoli o fuorvianti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Offrano prodotti o servizi illegali o non autorizzati"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Violino i regolamenti degli organizzatori degli eventi"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Contengano contenuti offensivi, discriminatori o inappropriati"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Promuovano attività fraudolente o schemi truffaldini"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Includano dati personali di terzi senza consenso"]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "6. Trasferimento dei Pettorali - Avvertenze Importanti"
          }), /* @__PURE__ */ jsx("div", {
            className: "bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4",
            children: /* @__PURE__ */ jsx("p", {
              className: "text-red-700 leading-relaxed font-medium",
              children: "ATTENZIONE: Il trasferimento dei pettorali (numeri di gara) è soggetto ai regolamenti specifici di ciascun evento podistico. Molti organizzatori VIETANO o limitano severamente il trasferimento dei pettorali. È ESCLUSIVA RESPONSABILITÀ degli utenti verificare e rispettare tali regolamenti."
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3",
            children: "6.1 Rischi del Trasferimento Non Autorizzato"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-3",
            children: "Correre con un pettorale intestato ad altra persona senza autorizzazione ufficiale può comportare:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Squalifica immediata dalla gara"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Annullamento del risultato e del tempo"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Ban permanente dalle future edizioni dell'evento"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Problemi assicurativi in caso di infortuni"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Conseguenze legali in determinate giurisdizioni"]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "6.2 Modalità di Trasferimento"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-3",
            children: "La Piattaforma prevede le seguenti modalità di trasferimento:"
          }), /* @__PURE__ */ jsxs("div", {
            className: "space-y-4",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "bg-green-50 border border-green-200 rounded-lg p-4",
              children: [/* @__PURE__ */ jsx("h4", {
                className: "font-medium text-gray-900",
                children: "Procedura Ufficiale (Consigliata)"
              }), /* @__PURE__ */ jsxs("p", {
                className: "text-gray-700 mt-2",
                children: ["Il trasferimento avviene attraverso la procedura ufficiale dell'organizzatore della gara (cambio nome).", /* @__PURE__ */ jsx("strong", {
                  children: " Questa è l'UNICA modalità disponibile per gli utenti Privati."
                })]
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4",
              children: [/* @__PURE__ */ jsx("h4", {
                className: "font-medium text-gray-900",
                children: "Pacchetto (Solo Tour Operator)"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-700 mt-2",
                children: "Il pettorale è incluso in un pacchetto turistico completo gestito dal Tour Operator."
              })]
            }), /* @__PURE__ */ jsxs("div", {
              className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4",
              children: [/* @__PURE__ */ jsx("h4", {
                className: "font-medium text-gray-900",
                children: "Da Concordare (Solo Tour Operator)"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-gray-700 mt-2",
                children: "Le modalità di trasferimento vengono concordate direttamente tra le parti."
              })]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "6.3 Esclusione di Responsabilità"
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed",
            children: [/* @__PURE__ */ jsx("strong", {
              children: "Runoot declina ogni responsabilità"
            }), " per trasferimenti di pettorali non conformi ai regolamenti degli organizzatori, per le conseguenze derivanti dall'utilizzo non autorizzato di pettorali, e per qualsiasi sanzione, squalifica, infortunio o danno che ne possa derivare."]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "7. Transazioni tra Utenti"
          }), /* @__PURE__ */ jsx("div", {
            className: "bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4",
            children: /* @__PURE__ */ jsx("p", {
              className: "text-gray-700 leading-relaxed font-medium",
              children: "TUTTE LE TRANSAZIONI AVVENGONO DIRETTAMENTE TRA GLI UTENTI, SENZA ALCUN COINVOLGIMENTO DI RUNOOT. Il Titolare non è parte delle transazioni e non ha alcun controllo su di esse."
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3",
            children: "7.1 Pagamenti"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "I pagamenti avvengono direttamente tra Venditore e Acquirente, con le modalità da loro liberamente concordate. Runoot NON gestisce, processa, trattiene o trasferisce denaro in alcun modo. Gli utenti sono gli unici responsabili della scelta dei metodi di pagamento e dei rischi ad essi connessi."
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "7.2 Raccomandazioni di Sicurezza"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-3",
            children: "Prima di effettuare qualsiasi pagamento, si raccomanda vivamente di:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Verificare l'identità della controparte attraverso canali indipendenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Richiedere documentazione comprovante la disponibilità di quanto offerto"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Per i pettorali: attendere la conferma ufficiale del cambio nome da parte dell'organizzatore"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Per le stanze: ottenere conferma scritta dall'hotel del cambio di intestazione"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Utilizzare metodi di pagamento tracciabili che offrano protezione (es. PayPal Beni e Servizi)"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Diffidare di richieste di pagamento urgenti o con metodi non tracciabili"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Conservare tutta la documentazione e le comunicazioni"]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "7.3 Dispute tra Utenti"
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed",
            children: ["In caso di controversie tra utenti relative a transazioni, ", /* @__PURE__ */ jsx("strong", {
              children: "Runoot non interverrà e non potrà essere chiamato a mediare, arbitrare o risolvere la disputa"
            }), ". Gli utenti dovranno risolvere qualsiasi controversia direttamente tra loro o attraverso i canali legali appropriati."]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "8. Sistema di Messaggistica"
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3",
            children: "8.1 Utilizzo Consentito"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Il sistema di messaggistica interno è destinato esclusivamente alla comunicazione tra utenti in relazione agli annunci pubblicati sulla Piattaforma."
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "8.2 Utilizzo Vietato"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-3",
            children: "È vietato utilizzare il sistema di messaggistica per:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Inviare spam, messaggi pubblicitari non richiesti o catene"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Molestare, minacciare o intimidire altri utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Tentare truffe, phishing o altre attività fraudolente"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Condividere contenuti illegali, offensivi o inappropriati"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "✕"
              }), "Raccogliere dati personali di altri utenti"]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "8.3 Blocco e Segnalazione"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Gli utenti possono bloccare altri utenti e segnalare comportamenti inappropriati. Il Titolare si riserva il diritto di esaminare le segnalazioni e adottare i provvedimenti ritenuti opportuni, inclusa la sospensione o eliminazione degli account."
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "8.4 Traduzione Automatica"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: `La Piattaforma offre un servizio di traduzione automatica dei messaggi. Tale servizio è fornito "così com'è" e il Titolare non garantisce l'accuratezza delle traduzioni. In caso di discrepanze, fa fede il messaggio nella lingua originale.`
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "9. Proprietà Intellettuale"
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3",
            children: "9.1 Diritti del Titolare"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Tutti i diritti di proprietà intellettuale relativi alla Piattaforma (marchi, loghi, design, software, contenuti originali) sono di proprietà esclusiva del Titolare o dei suoi licenzianti. Nessun diritto viene trasferito all'utente oltre alla licenza limitata di utilizzo della Piattaforma."
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "9.2 Contenuti degli Utenti"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "L'utente mantiene i diritti sui contenuti da lui pubblicati, ma concede al Titolare una licenza non esclusiva, gratuita, mondiale e perpetua per utilizzare, riprodurre, modificare e visualizzare tali contenuti ai fini del funzionamento della Piattaforma."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "10. Limitazione di Responsabilità"
          }), /* @__PURE__ */ jsx("div", {
            className: "bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4",
            children: /* @__PURE__ */ jsx("p", {
              className: "text-red-700 leading-relaxed font-medium",
              children: "LA PRESENTE SEZIONE CONTIENE IMPORTANTI LIMITAZIONI DI RESPONSABILITÀ. SI PREGA DI LEGGERLA ATTENTAMENTE."
            })
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3",
            children: "10.1 Esclusione Generale"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Nella misura massima consentita dalla legge applicabile, il Titolare NON è responsabile per:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700 mt-3",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Danni diretti, indiretti, incidentali, speciali, consequenziali o punitivi derivanti dall'utilizzo della Piattaforma"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Perdite economiche, mancato guadagno, perdita di opportunità o danni alla reputazione"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Transazioni tra utenti, inclusi inadempimenti, truffe, frodi o comportamenti illeciti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Veridicità, accuratezza, completezza o legalità degli annunci e delle informazioni fornite dagli utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Conformità degli annunci o delle transazioni alle leggi applicabili o ai regolamenti degli organizzatori"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Infortuni, incidenti o danni alla salute durante eventi podistici"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Squalifiche, ban o sanzioni inflitte da organizzatori di eventi"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-red-500 mr-2",
                children: "•"
              }), "Problemi assicurativi derivanti dall'utilizzo non autorizzato di pettorali"]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: `10.2 Servizio "Così Com'è"`
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: `La Piattaforma è fornita "così com'è" e "come disponibile", senza garanzie di alcun tipo, esplicite o implicite, incluse garanzie di commerciabilità, idoneità per uno scopo particolare o non violazione. Il Titolare non garantisce che la Piattaforma sia priva di errori, sicura o sempre disponibile.`
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "10.3 Limitazione Quantitativa"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "In ogni caso, qualora il Titolare fosse ritenuto responsabile, la responsabilità sarà limitata all'importo maggiore tra (a) le eventuali somme pagate dall'utente al Titolare nei 12 mesi precedenti l'evento che ha dato origine alla responsabilità, oppure (b) Euro 100,00 (cento)."
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "10.4 Applicabilità"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Le limitazioni di responsabilità si applicano indipendentemente dalla teoria legale su cui si basa la pretesa (contratto, illecito, negligenza, responsabilità oggettiva o altra) e anche se il Titolare è stato avvisato della possibilità di tali danni."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "11. Manleva e Indennizzo"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "L'utente si impegna a manlevare, difendere e tenere indenne il Titolare, i suoi amministratori, dipendenti, collaboratori e affiliati da qualsiasi richiesta, pretesa, danno, perdita, costo, spesa (incluse le spese legali) derivanti da o connessi a:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700 mt-3",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "a)"
              }), "L'utilizzo della Piattaforma da parte dell'utente"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "b)"
              }), "La violazione dei presenti Termini da parte dell'utente"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "c)"
              }), "La violazione di leggi o diritti di terzi da parte dell'utente"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "d)"
              }), "I contenuti pubblicati dall'utente sulla Piattaforma"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "e)"
              }), "Le transazioni effettuate dall'utente con altri utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "f)"
              }), "Dispute con altri utenti o terze parti"]
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "12. Sospensione e Terminazione"
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3",
            children: "12.1 Diritti del Titolare"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Il Titolare si riserva il diritto, a propria esclusiva discrezione e senza preavviso, di:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700 mt-3",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Sospendere o terminare l'accesso di qualsiasi utente alla Piattaforma"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Rimuovere qualsiasi annuncio o contenuto"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Modificare o interrompere qualsiasi funzionalità della Piattaforma"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Sospendere o terminare completamente il Servizio"]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "12.2 Motivi di Sospensione o Terminazione"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mb-3",
            children: "Tali provvedimenti possono essere adottati, tra l'altro, in caso di:"
          }), /* @__PURE__ */ jsxs("ul", {
            className: "space-y-2 text-gray-700",
            children: [/* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Violazione dei presenti Termini"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Comportamenti fraudolenti, ingannevoli o illegali"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Segnalazioni da parte di altri utenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Richieste delle autorità competenti"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Inattività prolungata dell'account"]
            }), /* @__PURE__ */ jsxs("li", {
              className: "flex items-start",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-brand-600 mr-2",
                children: "•"
              }), "Qualsiasi altro motivo ritenuto opportuno dal Titolare"]
            })]
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "12.3 Cancellazione da Parte dell'Utente"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "L'utente può richiedere la cancellazione del proprio account in qualsiasi momento contattando il Titolare. La cancellazione comporta la rimozione degli annunci attivi e l'impossibilità di accedere ai messaggi. Alcune informazioni potrebbero essere conservate per obblighi di legge."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "13. Modifiche ai Termini"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Il Titolare si riserva il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche saranno pubblicate sulla Piattaforma con indicazione della data di aggiornamento. Per modifiche sostanziali, gli utenti registrati potranno essere informati via email."
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: "L'utilizzo continuato della Piattaforma dopo la pubblicazione delle modifiche costituisce accettazione dei nuovi Termini. Se l'utente non accetta le modifiche, deve cessare l'utilizzo della Piattaforma e richiedere la cancellazione del proprio account."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "14. Disposizioni Generali"
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3",
            children: "14.1 Intero Accordo"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "I presenti Termini, insieme alla Privacy Policy e alla Cookie Policy, costituiscono l'intero accordo tra l'utente e il Titolare relativamente all'utilizzo della Piattaforma e sostituiscono qualsiasi precedente accordo o intesa."
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "14.2 Nullità Parziale"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Se una qualsiasi disposizione dei presenti Termini fosse ritenuta invalida o inapplicabile, tale disposizione sarà limitata o eliminata nella misura minima necessaria, e le restanti disposizioni rimarranno pienamente valide ed efficaci."
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "14.3 Rinuncia"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Il mancato esercizio di un diritto o il mancato richiamo a una disposizione da parte del Titolare non costituisce rinuncia a tale diritto o disposizione."
          }), /* @__PURE__ */ jsx("h3", {
            className: "text-lg font-medium text-gray-900 mb-3 mt-6",
            children: "14.4 Cessione"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "L'utente non può cedere o trasferire i propri diritti o obblighi derivanti dai presenti Termini senza il consenso scritto del Titolare. Il Titolare può cedere i propri diritti e obblighi a terzi senza il consenso dell'utente."
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "15. Legge Applicabile e Foro Competente"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia derivante da o connessa ai presenti Termini o all'utilizzo della Piattaforma sarà competente in via esclusiva il Foro di [INSERIRE CITTÀ], salvo diversa disposizione inderogabile di legge a tutela del consumatore."
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-gray-700 leading-relaxed mt-3",
            children: ["Ai sensi dell'art. 14 del Regolamento UE 524/2013, si informa che per la risoluzione delle controversie è possibile ricorrere alla piattaforma ODR (Online Dispute Resolution) dell'Unione Europea, accessibile al seguente link:", " ", /* @__PURE__ */ jsx("a", {
              href: "https://ec.europa.eu/consumers/odr",
              target: "_blank",
              rel: "noopener noreferrer",
              className: "text-brand-600 hover:underline",
              children: "https://ec.europa.eu/consumers/odr"
            })]
          })]
        }), /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsx("h2", {
            className: "text-xl font-semibold text-gray-900 mb-4",
            children: "16. Contatti"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-700 leading-relaxed",
            children: "Per qualsiasi domanda, richiesta o comunicazione relativa ai presenti Termini, è possibile contattare il Titolare all'indirizzo:"
          }), /* @__PURE__ */ jsx("div", {
            className: "mt-4 bg-brand-50 rounded-lg p-4 border border-brand-200",
            children: /* @__PURE__ */ jsxs("p", {
              className: "text-gray-700",
              children: ["Email: ", /* @__PURE__ */ jsx("a", {
                href: `mailto:${companyEmail}`,
                className: "text-brand-600 hover:underline font-medium",
                children: companyEmail
              })]
            })
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "pt-6 border-t border-gray-200",
          children: /* @__PURE__ */ jsx("p", {
            className: "text-gray-500 text-sm italic text-center",
            children: "Utilizzando Runoot, l'utente conferma di aver letto, compreso e accettato i presenti Termini e Condizioni."
          })
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "mt-8 text-center text-sm text-gray-500",
        children: [/* @__PURE__ */ jsx("a", {
          href: "/privacy-policy",
          className: "hover:text-brand-600",
          children: "Privacy Policy"
        }), /* @__PURE__ */ jsx("span", {
          className: "mx-2",
          children: "•"
        }), /* @__PURE__ */ jsx("a", {
          href: "/cookie-policy",
          className: "hover:text-brand-600",
          children: "Cookie Policy"
        }), /* @__PURE__ */ jsx("span", {
          className: "mx-2",
          children: "•"
        }), /* @__PURE__ */ jsx("a", {
          href: "/",
          className: "hover:text-brand-600",
          children: "Torna alla Home"
        })]
      })]
    })]
  });
});
const route46 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: terms,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-CUqhxZpv.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/index-D3X4eI3W.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": true, "module": "/assets/root-nWbadHQn.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/index-D3X4eI3W.js"], "css": ["/assets/root-kKo9WkIi.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings.$id_.contact": { "id": "routes/listings.$id_.contact", "parentId": "root", "path": "listings/:id/contact", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings._id_.contact-ePf07xbC.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings.$id_.edit": { "id": "routes/listings.$id_.edit", "parentId": "root", "path": "listings/:id/edit", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings._id_.edit-CLMQ4qj4.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js", "/assets/listing-rules-BUYIbtOx.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/profile.experience": { "id": "routes/profile.experience", "parentId": "root", "path": "profile/experience", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/profile.experience-mrtLbLFn.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.conversations": { "id": "routes/api.conversations", "parentId": "root", "path": "api/conversations", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.conversations-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.notifications": { "id": "routes/api.notifications", "parentId": "root", "path": "api/notifications", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.notifications-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.messages.$id": { "id": "routes/api.messages.$id", "parentId": "root", "path": "api/messages/:id", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.messages._id-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/become-tl.$token": { "id": "routes/become-tl.$token", "parentId": "root", "path": "become-tl/:token", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/become-tl._token-CrQ5hP6i.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/profile.settings": { "id": "routes/profile.settings", "parentId": "root", "path": "profile/settings", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/profile.settings-D3_0ZNje.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings._index": { "id": "routes/listings._index", "parentId": "root", "path": "listings", "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings._index-CUy3BVi9.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js", "/assets/FooterLight-j7wjw8pq.js", "/assets/ListingCard-DyuJ_FNu.js", "/assets/ListingCardCompact-zqsE7_pc.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/privacy-policy": { "id": "routes/privacy-policy", "parentId": "root", "path": "privacy-policy", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/privacy-policy-BKSpoqXL.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/profile._index": { "id": "routes/profile._index", "parentId": "root", "path": "profile", "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/profile._index-CUSWgLTJ.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/profile.agency": { "id": "routes/profile.agency", "parentId": "root", "path": "profile/agency", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/profile.agency-Hqcv7NLZ.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/profile.social": { "id": "routes/profile.social", "parentId": "root", "path": "profile/social", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/profile.social-D9aX0o-0.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.translate": { "id": "routes/api.translate", "parentId": "root", "path": "api/translate", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.translate-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/cookie-policy": { "id": "routes/cookie-policy", "parentId": "root", "path": "cookie-policy", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/cookie-policy-k6PbImY2.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/notifications": { "id": "routes/notifications", "parentId": "root", "path": "notifications", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/notifications-CYy77Nsz.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings.$id": { "id": "routes/listings.$id", "parentId": "root", "path": "listings/:id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings._id-DG9jsyRB.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js", "/assets/FooterLight-j7wjw8pq.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings.$id.backup": { "id": "routes/listings.$id.backup", "parentId": "routes/listings.$id", "path": "backup", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings._id.backup-tKtep0OC.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings.new": { "id": "routes/listings.new", "parentId": "root", "path": "listings/new", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings.new-B3rLSPxi.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js", "/assets/listing-rules-BUYIbtOx.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/tl-dashboard": { "id": "routes/tl-dashboard", "parentId": "root", "path": "tl-dashboard", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/tl-dashboard-Us05S9Jn.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/my-listings": { "id": "routes/my-listings", "parentId": "root", "path": "my-listings", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/my-listings-DtroIJ0V.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js", "/assets/ListingCard-DyuJ_FNu.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.unread": { "id": "routes/api.unread", "parentId": "root", "path": "api/unread", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.unread-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/join.$code": { "id": "routes/join.$code", "parentId": "root", "path": "join/:code", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/join._code-BIrCTY6H.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.saved": { "id": "routes/api.saved", "parentId": "root", "path": "api/saved", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.saved-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/dashboard": { "id": "routes/dashboard", "parentId": "root", "path": "dashboard", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/dashboard-B0MAIw5p.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js", "/assets/ListingCardCompact-zqsE7_pc.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/messages": { "id": "routes/messages", "parentId": "root", "path": "messages", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/messages-IplCLS-y.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js", "/assets/FooterLight-j7wjw8pq.js", "/assets/avatarColors-CZJ_YuDz.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/messages._index": { "id": "routes/messages._index", "parentId": "routes/messages", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/messages._index-DOFYkBTK.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/messages.$id": { "id": "routes/messages.$id", "parentId": "routes/messages", "path": ":id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/messages._id-UXZzIk1m.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/avatarColors-CZJ_YuDz.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/register": { "id": "routes/register", "parentId": "root", "path": "register", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/register-CPCn8rgg.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/settings": { "id": "routes/settings", "parentId": "root", "path": "settings", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/settings-CLh_JPPh.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/contact": { "id": "routes/contact", "parentId": "root", "path": "contact", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/contact-Bcc1LKMa.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js", "/assets/FooterLight-j7wjw8pq.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_index-DeVetV0a.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js", "/assets/FooterLight-j7wjw8pq.js", "/assets/ListingCard-DyuJ_FNu.js", "/assets/ListingCardCompact-zqsE7_pc.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/logout": { "id": "routes/logout", "parentId": "root", "path": "logout", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/logout-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/report": { "id": "routes/report", "parentId": "root", "path": "report", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/report-BI53kD0j.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/admin": { "id": "routes/admin", "parentId": "root", "path": "admin", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/admin-DHBpyNJ9.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/admin.team-leaders": { "id": "routes/admin.team-leaders", "parentId": "routes/admin", "path": "team-leaders", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/admin.team-leaders-Cn9M1AZ6.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/admin.impersonate": { "id": "routes/admin.impersonate", "parentId": "routes/admin", "path": "impersonate", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/admin.impersonate-DH69_UoV.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/admin.impersonate.stop": { "id": "routes/admin.impersonate.stop", "parentId": "routes/admin.impersonate", "path": "stop", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/admin.impersonate.stop-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/admin.listings": { "id": "routes/admin.listings", "parentId": "routes/admin", "path": "listings", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/admin.listings-DgMrAiJZ.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/admin.pending": { "id": "routes/admin.pending", "parentId": "routes/admin", "path": "pending", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/admin.pending-DRCj5j7K.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/admin._index": { "id": "routes/admin._index", "parentId": "routes/admin", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/admin._index-Do-kKemp.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/admin.users": { "id": "routes/admin.users", "parentId": "routes/admin", "path": "users", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/admin.users-CkurRKn9.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/admin.users.new": { "id": "routes/admin.users.new", "parentId": "routes/admin.users", "path": "new", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/admin.users.new-D9c7Bq7D.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/login": { "id": "routes/login", "parentId": "root", "path": "login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/login-4W49vUR2.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/saved": { "id": "routes/saved", "parentId": "root", "path": "saved", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/saved-CnsJcCkI.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js", "/assets/Header-DiP6E3C1.js", "/assets/FooterLight-j7wjw8pq.js", "/assets/ListingCard-DyuJ_FNu.js", "/assets/ListingCardCompact-zqsE7_pc.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/terms": { "id": "routes/terms", "parentId": "root", "path": "terms", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/terms-B55xBHiF.js", "imports": ["/assets/chunk-JZWAC4HX-Dlc7LzsC.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-cabf7744.js", "version": "cabf7744", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_subResourceIntegrity": false, "unstable_trailingSlashAwareDataRequests": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/listings.$id_.contact": {
    id: "routes/listings.$id_.contact",
    parentId: "root",
    path: "listings/:id/contact",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/listings.$id_.edit": {
    id: "routes/listings.$id_.edit",
    parentId: "root",
    path: "listings/:id/edit",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/profile.experience": {
    id: "routes/profile.experience",
    parentId: "root",
    path: "profile/experience",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/api.conversations": {
    id: "routes/api.conversations",
    parentId: "root",
    path: "api/conversations",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/api.notifications": {
    id: "routes/api.notifications",
    parentId: "root",
    path: "api/notifications",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/api.messages.$id": {
    id: "routes/api.messages.$id",
    parentId: "root",
    path: "api/messages/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/become-tl.$token": {
    id: "routes/become-tl.$token",
    parentId: "root",
    path: "become-tl/:token",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/profile.settings": {
    id: "routes/profile.settings",
    parentId: "root",
    path: "profile/settings",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/listings._index": {
    id: "routes/listings._index",
    parentId: "root",
    path: "listings",
    index: true,
    caseSensitive: void 0,
    module: route9
  },
  "routes/privacy-policy": {
    id: "routes/privacy-policy",
    parentId: "root",
    path: "privacy-policy",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/profile._index": {
    id: "routes/profile._index",
    parentId: "root",
    path: "profile",
    index: true,
    caseSensitive: void 0,
    module: route11
  },
  "routes/profile.agency": {
    id: "routes/profile.agency",
    parentId: "root",
    path: "profile/agency",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  },
  "routes/profile.social": {
    id: "routes/profile.social",
    parentId: "root",
    path: "profile/social",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  },
  "routes/api.translate": {
    id: "routes/api.translate",
    parentId: "root",
    path: "api/translate",
    index: void 0,
    caseSensitive: void 0,
    module: route14
  },
  "routes/cookie-policy": {
    id: "routes/cookie-policy",
    parentId: "root",
    path: "cookie-policy",
    index: void 0,
    caseSensitive: void 0,
    module: route15
  },
  "routes/notifications": {
    id: "routes/notifications",
    parentId: "root",
    path: "notifications",
    index: void 0,
    caseSensitive: void 0,
    module: route16
  },
  "routes/listings.$id": {
    id: "routes/listings.$id",
    parentId: "root",
    path: "listings/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route17
  },
  "routes/listings.$id.backup": {
    id: "routes/listings.$id.backup",
    parentId: "routes/listings.$id",
    path: "backup",
    index: void 0,
    caseSensitive: void 0,
    module: route18
  },
  "routes/listings.new": {
    id: "routes/listings.new",
    parentId: "root",
    path: "listings/new",
    index: void 0,
    caseSensitive: void 0,
    module: route19
  },
  "routes/tl-dashboard": {
    id: "routes/tl-dashboard",
    parentId: "root",
    path: "tl-dashboard",
    index: void 0,
    caseSensitive: void 0,
    module: route20
  },
  "routes/my-listings": {
    id: "routes/my-listings",
    parentId: "root",
    path: "my-listings",
    index: void 0,
    caseSensitive: void 0,
    module: route21
  },
  "routes/api.unread": {
    id: "routes/api.unread",
    parentId: "root",
    path: "api/unread",
    index: void 0,
    caseSensitive: void 0,
    module: route22
  },
  "routes/join.$code": {
    id: "routes/join.$code",
    parentId: "root",
    path: "join/:code",
    index: void 0,
    caseSensitive: void 0,
    module: route23
  },
  "routes/api.saved": {
    id: "routes/api.saved",
    parentId: "root",
    path: "api/saved",
    index: void 0,
    caseSensitive: void 0,
    module: route24
  },
  "routes/dashboard": {
    id: "routes/dashboard",
    parentId: "root",
    path: "dashboard",
    index: void 0,
    caseSensitive: void 0,
    module: route25
  },
  "routes/messages": {
    id: "routes/messages",
    parentId: "root",
    path: "messages",
    index: void 0,
    caseSensitive: void 0,
    module: route26
  },
  "routes/messages._index": {
    id: "routes/messages._index",
    parentId: "routes/messages",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route27
  },
  "routes/messages.$id": {
    id: "routes/messages.$id",
    parentId: "routes/messages",
    path: ":id",
    index: void 0,
    caseSensitive: void 0,
    module: route28
  },
  "routes/register": {
    id: "routes/register",
    parentId: "root",
    path: "register",
    index: void 0,
    caseSensitive: void 0,
    module: route29
  },
  "routes/settings": {
    id: "routes/settings",
    parentId: "root",
    path: "settings",
    index: void 0,
    caseSensitive: void 0,
    module: route30
  },
  "routes/contact": {
    id: "routes/contact",
    parentId: "root",
    path: "contact",
    index: void 0,
    caseSensitive: void 0,
    module: route31
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route32
  },
  "routes/logout": {
    id: "routes/logout",
    parentId: "root",
    path: "logout",
    index: void 0,
    caseSensitive: void 0,
    module: route33
  },
  "routes/report": {
    id: "routes/report",
    parentId: "root",
    path: "report",
    index: void 0,
    caseSensitive: void 0,
    module: route34
  },
  "routes/admin": {
    id: "routes/admin",
    parentId: "root",
    path: "admin",
    index: void 0,
    caseSensitive: void 0,
    module: route35
  },
  "routes/admin.team-leaders": {
    id: "routes/admin.team-leaders",
    parentId: "routes/admin",
    path: "team-leaders",
    index: void 0,
    caseSensitive: void 0,
    module: route36
  },
  "routes/admin.impersonate": {
    id: "routes/admin.impersonate",
    parentId: "routes/admin",
    path: "impersonate",
    index: void 0,
    caseSensitive: void 0,
    module: route37
  },
  "routes/admin.impersonate.stop": {
    id: "routes/admin.impersonate.stop",
    parentId: "routes/admin.impersonate",
    path: "stop",
    index: void 0,
    caseSensitive: void 0,
    module: route38
  },
  "routes/admin.listings": {
    id: "routes/admin.listings",
    parentId: "routes/admin",
    path: "listings",
    index: void 0,
    caseSensitive: void 0,
    module: route39
  },
  "routes/admin.pending": {
    id: "routes/admin.pending",
    parentId: "routes/admin",
    path: "pending",
    index: void 0,
    caseSensitive: void 0,
    module: route40
  },
  "routes/admin._index": {
    id: "routes/admin._index",
    parentId: "routes/admin",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route41
  },
  "routes/admin.users": {
    id: "routes/admin.users",
    parentId: "routes/admin",
    path: "users",
    index: void 0,
    caseSensitive: void 0,
    module: route42
  },
  "routes/admin.users.new": {
    id: "routes/admin.users.new",
    parentId: "routes/admin.users",
    path: "new",
    index: void 0,
    caseSensitive: void 0,
    module: route43
  },
  "routes/login": {
    id: "routes/login",
    parentId: "root",
    path: "login",
    index: void 0,
    caseSensitive: void 0,
    module: route44
  },
  "routes/saved": {
    id: "routes/saved",
    parentId: "root",
    path: "saved",
    index: void 0,
    caseSensitive: void 0,
    module: route45
  },
  "routes/terms": {
    id: "routes/terms",
    parentId: "root",
    path: "terms",
    index: void 0,
    caseSensitive: void 0,
    module: route46
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
