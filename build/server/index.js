import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, createCookieSessionStorage, redirect, UNSAFE_withComponentProps, useLoaderData, Outlet, Meta, Links, ScrollRestoration, Scripts, useFetcher, Link, Form, useActionData, data, useSearchParams, useNavigate, useParams, useNavigation } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { createClient } from "@supabase/supabase-js";
import { useState, useRef, useEffect, useCallback } from "react";
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
  const userId = await getUserId(request);
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return profile;
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
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!profile) {
    throw await logout(request);
  }
  return profile;
}
async function logout(request) {
  const session = await getUserSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await storage.destroySession(session)
    }
  });
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
async function loader$n({
  request
}) {
  const user = await getUser(request);
  const accessToken = await getAccessToken(request);
  let unreadCount = 0;
  if (user) {
    const {
      data: conversations
    } = await supabaseAdmin.from("conversations").select(`
        id,
        messages(id, sender_id, read_at)
      `).or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);
    if (conversations) {
      conversations.forEach((conv) => {
        var _a;
        (_a = conv.messages) == null ? void 0 : _a.forEach((msg) => {
          if (msg.sender_id !== user.id && !msg.read_at) {
            unreadCount++;
          }
        });
      });
    }
  }
  return {
    user: user ? {
      ...user,
      unreadCount
    } : null,
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
const root = UNSAFE_withComponentProps(function App() {
  const {
    ENV
  } = useLoaderData();
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("script", {
      dangerouslySetInnerHTML: {
        __html: `window.ENV = ${JSON.stringify(ENV)}`
      }
    }), /* @__PURE__ */ jsx(Outlet, {})]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Layout,
  default: root,
  links,
  loader: loader$n
}, Symbol.toStringTag, { value: "Module" }));
const UNREAD_POLL_INTERVAL = 5e3;
function Header({ user }) {
  var _a;
  const fetcher = useFetcher();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isPollingRef = useRef(false);
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
  return /* @__PURE__ */ jsx("header", { className: "sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-7xl px-6 sm:px-8 lg:px-12", children: /* @__PURE__ */ jsxs("div", { className: "flex h-20 items-center justify-between", children: [
    /* @__PURE__ */ jsx(Link, { to: "/", className: "flex items-center -ml-6", children: /* @__PURE__ */ jsx(
      "img",
      {
        src: "/logo.png",
        alt: "Runoot",
        className: "h-12 w-auto"
      }
    ) }),
    /* @__PURE__ */ jsxs("nav", { className: "hidden md:flex items-center gap-10 flex-1 justify-center", children: [
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
    user ? /* @__PURE__ */ jsx("nav", { className: "flex items-center", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-6", children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: "relative",
          onMouseEnter: () => setIsMenuOpen(true),
          onMouseLeave: () => setIsMenuOpen(false),
          children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                className: "flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-full bg-white hover:bg-gray-50 text-gray-900 transition-colors",
                children: [
                  unreadCount > 0 && /* @__PURE__ */ jsx("span", { className: "h-2.5 w-2.5 rounded-full bg-red-500" }),
                  /* @__PURE__ */ jsx("span", { className: "text-sm font-bold", children: user.full_name || user.email }),
                  /* @__PURE__ */ jsx(
                    "svg",
                    {
                      className: `h-4 w-4 text-gray-500 transition-transform ${isMenuOpen ? "rotate-180" : ""}`,
                      fill: "none",
                      viewBox: "0 0 24 24",
                      stroke: "currentColor",
                      children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" })
                    }
                  )
                ]
              }
            ),
            isMenuOpen && /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("div", { className: "absolute right-0 top-full w-56 rounded-2xl bg-white shadow-lg border border-gray-200 py-2 z-20", children: [
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
                    "Profilo"
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
          className: "btn-primary flex items-center gap-2 px-8 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-accent-500/30",
          children: [
            /* @__PURE__ */ jsx("svg", { className: "h-5 w-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }),
            /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "New Listing" }),
            /* @__PURE__ */ jsx("span", { className: "sm:hidden", children: "New" })
          ]
        }
      )
    ] }) }) : /* @__PURE__ */ jsxs("nav", { className: "flex items-center gap-4", children: [
      /* @__PURE__ */ jsx(Link, { to: "/login", className: "btn-secondary rounded-full", children: "Login" }),
      /* @__PURE__ */ jsx(Link, { to: "/register", className: "btn-primary rounded-full shadow-lg shadow-accent-500/30", children: "Sign up" })
    ] })
  ] }) }) });
}
function EventPicker({ events, onSelectEvent, defaultEventId }) {
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
        className: "input text-left text-gray-500 hover:border-brand-500",
        children: "Choose your event..."
      }
    ) : /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-lg border border-accent-500 bg-accent-50 p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-accent-600", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }),
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
                    d: "M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm text-gray-600", children: "Can't find your event?" }),
            /* @__PURE__ */ jsx(
              Link,
              {
                to: "/contact",
                className: "mt-3 inline-block px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors",
                children: "Contact us"
              }
            )
          ] })
        ) })
      ] })
    ] }) })
  ] });
}
function HotelAutocomplete({ onSelectHotel, apiKey, eventCity, eventCountry, defaultHotelName }) {
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
  const [showManualForm, setShowManualForm] = useState(false);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  useEffect(() => {
    if (!inputRef.current || !apiKey) return;
    const loadGooglePlaces = async () => {
      if (!window.google) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
        script.onload = () => {
          initAutocomplete();
        };
      } else {
        initAutocomplete();
      }
    };
    const initAutocomplete = () => {
      if (!inputRef.current) return;
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["lodging"],
        fields: ["place_id", "name", "formatted_address", "address_components", "geometry", "rating", "website"]
      });
      if (eventCity && eventCountry) {
        const countryCode = getCountryCode(eventCountry);
        if (countryCode) {
          autocompleteRef.current.setComponentRestrictions({
            country: countryCode
          });
        }
      }
      autocompleteRef.current.addListener("place_changed", () => {
        var _a, _b, _c, _d, _e, _f;
        const place = (_a = autocompleteRef.current) == null ? void 0 : _a.getPlace();
        if (!place || !place.place_id) return;
        let city = "";
        let country = "";
        (_b = place.address_components) == null ? void 0 : _b.forEach((component) => {
          if (component.types.includes("locality")) {
            city = component.long_name;
          }
          if (component.types.includes("country")) {
            country = component.long_name;
          }
        });
        const hotel = {
          placeId: place.place_id,
          name: place.name || "",
          city,
          country,
          formattedAddress: place.formatted_address || "",
          lat: (_d = (_c = place.geometry) == null ? void 0 : _c.location) == null ? void 0 : _d.lat(),
          lng: (_f = (_e = place.geometry) == null ? void 0 : _e.location) == null ? void 0 : _f.lng(),
          rating: place.rating,
          website: place.website
        };
        setSelectedHotel(hotel);
        onSelectHotel(hotel);
      });
    };
    loadGooglePlaces();
  }, [apiKey, onSelectHotel]);
  const handleChange = () => {
    setSelectedHotel(null);
    onSelectHotel(null);
  };
  const handleManualSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const manualHotel = {
      placeId: "",
      name: formData.get("manualHotelName"),
      city: formData.get("manualCity"),
      country: formData.get("manualCountry"),
      formattedAddress: ""
    };
    setSelectedHotel(manualHotel);
    onSelectHotel(manualHotel);
    setShowManualForm(false);
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
    /* @__PURE__ */ jsx(
      "input",
      {
        ref: inputRef,
        type: "text",
        placeholder: "Start typing hotel name or city...",
        className: "input",
        onChange: handleChange
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => setShowManualForm(!showManualForm),
        className: "mt-2 inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
        children: showManualForm ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }),
          "Use autocomplete instead"
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("svg", { className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }),
          "Add hotel manually"
        ] })
      }
    ),
    showManualForm && /* @__PURE__ */ jsxs("form", { onSubmit: handleManualSubmit, className: "mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { htmlFor: "manualHotelName", className: "label text-sm", children: "Hotel name *" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            id: "manualHotelName",
            name: "manualHotelName",
            required: true,
            className: "input",
            placeholder: "e.g. Hotel Artemide"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { htmlFor: "manualCity", className: "label text-sm", children: "City *" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              id: "manualCity",
              name: "manualCity",
              required: true,
              className: "input",
              placeholder: "e.g. Rome"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { htmlFor: "manualCountry", className: "label text-sm", children: "Country *" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              id: "manualCountry",
              name: "manualCountry",
              required: true,
              className: "input",
              placeholder: "e.g. Italy"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("button", { type: "submit", className: "btn-primary text-sm", children: "Save hotel" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => setShowManualForm(false),
            className: "text-sm text-gray-600 hover:text-gray-800",
            children: "Cancel"
          }
        )
      ] })
    ] })
  ] }) : /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-lg border border-green-500 bg-green-50 p-4", children: [
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelPlaceId", value: (selectedHotel == null ? void 0 : selectedHotel.placeId) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelName", value: (selectedHotel == null ? void 0 : selectedHotel.name) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelCity", value: (selectedHotel == null ? void 0 : selectedHotel.city) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelCountry", value: (selectedHotel == null ? void 0 : selectedHotel.country) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelLat", value: (selectedHotel == null ? void 0 : selectedHotel.lat) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelLng", value: (selectedHotel == null ? void 0 : selectedHotel.lng) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelRating", value: (selectedHotel == null ? void 0 : selectedHotel.rating) || "" }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: "hotelWebsite", value: (selectedHotel == null ? void 0 : selectedHotel.website) || "" }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx("svg", { className: "h-5 w-5 text-green-600", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("p", { className: "text-sm font-medium text-gray-900", children: [
          "Hotel: ",
          selectedHotel.name
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-600", children: [
          selectedHotel.city,
          selectedHotel.country ? `, ${selectedHotel.country}` : "",
          selectedHotel.rating && ` • ⭐ ${selectedHotel.rating}`,
          selectedHotel.website && ` • 🌐 Website available`
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: handleChange,
        className: "text-sm text-brand-600 hover:text-brand-700 font-medium",
        children: "Change"
      }
    )
  ] }) });
}
function getCountryCode(countryName) {
  const countryMap = {
    "Italy": "IT",
    "Germany": "DE",
    "USA": "US",
    "United States": "US",
    "UK": "GB",
    "United Kingdom": "GB",
    "France": "FR",
    "Spain": "ES",
    "Japan": "JP",
    "Netherlands": "NL"
    // Add more as needed
  };
  return countryMap[countryName] || "";
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
const meta$h = () => {
  return [{
    title: "Edit Listing - Runoot"
  }];
};
async function loader$m({
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
async function action$e({
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
  const priceNegotiable = formData.get("priceNegotiable") === "on";
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
  var _a, _b, _c;
  const {
    user,
    listing,
    events,
    googlePlacesApiKey
  } = useLoaderData();
  const actionData = useActionData();
  const listingData = listing;
  const [listingType, setListingType] = useState(listingData.listing_type);
  const [roomType, setRoomType] = useState(listingData.room_type || "");
  const [selectedEvent, setSelectedEvent] = useState(listingData.event);
  const [transferMethod, setTransferMethod] = useState(listingData.transfer_type);
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
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "mb-8",
        children: [/* @__PURE__ */ jsxs(Link, {
          to: `/listings/${listingData.id}`,
          className: "inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4",
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
        className: "card p-6 sm:p-8",
        children: /* @__PURE__ */ jsxs(Form, {
          method: "post",
          className: "space-y-8",
          children: [(actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx("div", {
            className: "rounded-lg bg-red-50 p-4 text-sm text-red-700",
            children: actionData.error
          }), /* @__PURE__ */ jsxs("div", {
            children: [/* @__PURE__ */ jsx("label", {
              className: "label",
              children: "What are you offering?"
            }), /* @__PURE__ */ jsxs("div", {
              className: "mt-2 grid grid-cols-3 gap-3",
              children: [/* @__PURE__ */ jsxs("label", {
                className: "relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500",
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
                className: "relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500",
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
                className: "relative flex cursor-pointer rounded-lg border border-gray-300 bg-white p-4 shadow-sm focus:outline-none hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:ring-1 has-[:checked]:ring-brand-500",
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
              defaultEventId: (_a = listingData.event) == null ? void 0 : _a.id,
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
                      className: "flex h-12 w-12 items-center justify-center rounded-lg bg-brand-100 text-brand-700 font-bold text-2xl",
                      children: "1"
                    }), /* @__PURE__ */ jsx("span", {
                      className: "text-sm text-gray-600",
                      children: "Private users can list 1 room only"
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
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "roomType",
                  className: "label",
                  children: "Room type"
                }), /* @__PURE__ */ jsxs("select", {
                  id: "roomType",
                  name: "roomType",
                  className: "input",
                  defaultValue: listingData.room_type || "",
                  onChange: (e) => setRoomType(e.target.value),
                  children: [/* @__PURE__ */ jsx("option", {
                    value: "",
                    children: "Select type"
                  }), /* @__PURE__ */ jsx("option", {
                    value: "single",
                    children: "Single"
                  }), /* @__PURE__ */ jsx("option", {
                    value: "double",
                    children: "Double"
                  }), /* @__PURE__ */ jsx("option", {
                    value: "twin",
                    children: "Twin"
                  }), /* @__PURE__ */ jsx("option", {
                    value: "twin_shared",
                    children: "Twin Shared"
                  }), /* @__PURE__ */ jsx("option", {
                    value: "double_single_use",
                    children: "Double Single Use"
                  }), /* @__PURE__ */ jsx("option", {
                    value: "triple",
                    children: "Triple"
                  }), /* @__PURE__ */ jsx("option", {
                    value: "quadruple",
                    children: "Quadruple"
                  }), /* @__PURE__ */ jsx("option", {
                    value: "other",
                    children: "Other * (specify)"
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "checkIn",
                  className: "label",
                  children: "Check-in date"
                }), /* @__PURE__ */ jsx("input", {
                  type: "date",
                  id: "checkIn",
                  name: "checkIn",
                  defaultValue: ((_b = listingData.check_in) == null ? void 0 : _b.split("T")[0]) || "",
                  min: dateConstraints.min,
                  max: dateConstraints.max,
                  className: "input"
                }), selectedEvent && /* @__PURE__ */ jsxs("p", {
                  className: "mt-1 text-xs text-gray-500",
                  children: ["Event date: ", new Date(selectedEvent.event_date).toLocaleDateString(), " (+/-7 days)"]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "checkOut",
                  className: "label",
                  children: "Check-out date"
                }), /* @__PURE__ */ jsx("input", {
                  type: "date",
                  id: "checkOut",
                  name: "checkOut",
                  defaultValue: ((_c = listingData.check_out) == null ? void 0 : _c.split("T")[0]) || "",
                  min: dateConstraints.min,
                  max: dateConstraints.max,
                  className: "input"
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
              className: "bg-blue-50 border border-blue-200 rounded-lg p-4",
              children: /* @__PURE__ */ jsxs("p", {
                className: "text-sm text-blue-800",
                children: [/* @__PURE__ */ jsx("strong", {
                  children: "Important:"
                }), " Runoot facilitates connections for legitimate bib transfers only. Direct sale of bibs may violate event regulations."]
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
                    className: "flex h-12 w-12 items-center justify-center rounded-lg bg-brand-100 text-brand-700 font-bold text-2xl",
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
            }), visibleFields.showAssociatedCosts && /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsxs("label", {
                htmlFor: "associatedCosts",
                className: "label",
                children: ["Associated Costs (EUR) ", /* @__PURE__ */ jsx("span", {
                  className: "text-red-500",
                  children: "*"
                })]
              }), /* @__PURE__ */ jsx("input", {
                type: "number",
                id: "associatedCosts",
                name: "associatedCosts",
                min: "0",
                step: "0.01",
                defaultValue: listingData.associated_costs || "",
                placeholder: "e.g. 50",
                className: "input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                required: true
              }), /* @__PURE__ */ jsx("p", {
                className: "mt-1 text-xs text-gray-500",
                children: "Official name change fee from the event organizer"
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
              className: "grid gap-4 sm:grid-cols-2",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "price",
                  className: "label",
                  children: "Price (EUR)"
                }), /* @__PURE__ */ jsx("input", {
                  type: "number",
                  id: "price",
                  name: "price",
                  min: "0",
                  step: "0.01",
                  defaultValue: listingData.price || "",
                  placeholder: "Empty = Contact for price",
                  className: "input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                })]
              }), (listingType === "room" || listingType === "room_and_bib") && /* @__PURE__ */ jsx("div", {
                className: "flex items-end",
                children: /* @__PURE__ */ jsxs("label", {
                  className: "flex items-center gap-2 cursor-pointer",
                  children: [/* @__PURE__ */ jsx("input", {
                    type: "checkbox",
                    name: "priceNegotiable",
                    defaultChecked: listingData.price_negotiable,
                    className: "h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  }), /* @__PURE__ */ jsx("span", {
                    className: "text-sm text-gray-700",
                    children: "Price is negotiable"
                  })]
                })
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
          }), /* @__PURE__ */ jsxs("div", {
            className: "flex gap-4 pt-4",
            children: [/* @__PURE__ */ jsx(Link, {
              to: `/listings/${listingData.id}`,
              className: "btn-secondary flex-1 text-center",
              children: "Cancel"
            }), /* @__PURE__ */ jsx("button", {
              type: "submit",
              className: "btn-primary flex-1",
              children: "Save Changes"
            })]
          })]
        })
      })]
    })]
  });
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$e,
  default: listings_$id__edit,
  loader: loader$m,
  meta: meta$h
}, Symbol.toStringTag, { value: "Module" }));
async function loader$l({
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
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$l
}, Symbol.toStringTag, { value: "Module" }));
async function loader$k({
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
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$k
}, Symbol.toStringTag, { value: "Module" }));
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
function getEventSlug$1(event) {
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
              src: `/events/${getEventSlug$1(listing.event)}.jpg`,
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
function ListingCardCompact({ listing, isUserLoggedIn = true, isSaved = false }) {
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
  return /* @__PURE__ */ jsxs(
    Link,
    {
      to: isUserLoggedIn ? `/listings/${listing.id}` : "/login",
      className: cardClass,
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2 mb-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badgeColor}`, children: listing.listing_type === "bib" ? "Bib" : listing.listing_type === "room" ? "Hotel" : "Package" }),
            isLM && /* @__PURE__ */ jsx("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-accent-100 text-accent-700", children: "LM" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: isUserLoggedIn && /* @__PURE__ */ jsxs(
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
          ) })
        ] }),
        /* @__PURE__ */ jsx("h3", { className: "font-display text-base font-bold text-gray-900 leading-tight mb-0.5 line-clamp-1", children: listing.event.name }),
        /* @__PURE__ */ jsxs("p", { className: "text-sm font-medium text-brand-600 mb-2", children: [
          subtitle,
          listing.hotel_name && ` • ${listing.hotel_name}`
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between gap-3 pt-2 border-t border-gray-100", children: isUserLoggedIn ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 min-w-0 flex-1", children: [
            /* @__PURE__ */ jsxs("span", { className: "text-xs text-gray-600 truncate", children: [
              "📍 ",
              listing.event.country,
              " • 🗓 Race Day : ",
              eventDateShort
            ] }),
            /* @__PURE__ */ jsx("span", { className: "text-xs text-gray-400", children: "•" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 min-w-0", children: [
              /* @__PURE__ */ jsx("span", { className: "text-xs font-medium text-gray-700 truncate", children: sellerNameShort }),
              listing.author.user_type === "tour_operator" && /* @__PURE__ */ jsx("span", { className: "text-xs text-gray-500", children: "(TO)" }),
              listing.author.is_verified && /* @__PURE__ */ jsx("svg", { className: "h-3 w-3 text-brand-500 flex-shrink-0", fill: "currentColor", viewBox: "0 0 20 20", children: /* @__PURE__ */ jsx(
                "path",
                {
                  fillRule: "evenodd",
                  d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                  clipRule: "evenodd"
                }
              ) })
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "text-right flex-shrink-0", children: listing.listing_type === "bib" && listing.associated_costs ? /* @__PURE__ */ jsxs("p", { className: "text-base font-bold text-gray-900", children: [
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
const meta$g = () => {
  return [{
    title: "Browse Listings - Runoot"
  }];
};
async function loader$j({
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
  const [searchQuery, setSearchQuery] = useState(currentSearch);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "mb-6",
        children: [/* @__PURE__ */ jsx("h1", {
          className: "font-display text-3xl font-bold text-gray-900",
          children: "Browse Listings"
        }), /* @__PURE__ */ jsx("p", {
          className: "mt-2 text-gray-600",
          children: "Find available rooms and bibs for upcoming marathons"
        })]
      }), /* @__PURE__ */ jsx("div", {
        className: "mb-4",
        children: /* @__PURE__ */ jsxs(Form, {
          method: "get",
          name: "listing-search",
          className: "flex items-center",
          children: [/* @__PURE__ */ jsx("input", {
            type: "hidden",
            name: "type",
            value: currentType
          }), /* @__PURE__ */ jsxs("div", {
            className: "relative flex-1 max-w-xl",
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
              placeholder: "Search by event name or location...",
              value: searchQuery,
              onChange: (e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              },
              onFocus: () => setShowSuggestions(true),
              className: "block w-full rounded-lg border-0 pl-12 pr-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500/20 transition-colors",
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
            className: "ml-12 px-8 py-2.5 bg-accent-500 text-white font-medium rounded-full hover:bg-accent-600 transition-all shadow-lg shadow-accent-500/30",
            children: "Search"
          })]
        })
      }), /* @__PURE__ */ jsx("div", {
        className: "mb-8 flex flex-wrap gap-2",
        children: [{
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
          className: `px-4 py-2 rounded-full text-sm font-medium transition-colors ${currentType === category.value ? "bg-brand-500 text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`,
          children: category.label
        }, category.value))
      }), listings.length > 0 ? /* @__PURE__ */ jsxs(Fragment, {
        children: [/* @__PURE__ */ jsx("div", {
          className: "hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr",
          children: listings.map((listing) => /* @__PURE__ */ jsx(ListingCard, {
            listing,
            isUserLoggedIn: !!user,
            isSaved: (savedListingIds || []).includes(listing.id)
          }, listing.id))
        }), /* @__PURE__ */ jsx("div", {
          className: "flex flex-col gap-3 md:hidden",
          children: listings.map((listing) => /* @__PURE__ */ jsx(ListingCardCompact, {
            listing,
            isUserLoggedIn: !!user,
            isSaved: (savedListingIds || []).includes(listing.id)
          }, listing.id))
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
    })]
  });
});
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: listings__index,
  loader: loader$j,
  meta: meta$g
}, Symbol.toStringTag, { value: "Module" }));
async function loader$i({
  request
}) {
  const user = await requireUser(request);
  if (user.user_type === "tour_operator") {
    return redirect("/profile/agency");
  } else {
    return redirect("/profile/runner");
  }
}
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$i
}, Symbol.toStringTag, { value: "Module" }));
const meta$f = () => {
  return [{
    title: "Company Profile - runoot"
  }];
};
async function loader$h({
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
async function action$d({
  request
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const fullName = formData.get("fullName");
  const companyName = formData.get("companyName");
  const phone = formData.get("phone");
  formData.get("bio");
  formData.get("country");
  formData.get("city");
  formData.get("website");
  formData.get("languages");
  formData.get("yearsExperience");
  formData.get("specialties");
  formData.get("instagram");
  formData.get("facebook");
  formData.get("linkedin");
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
    phone: phone || null
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
      className: "mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs("div", {
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
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$d,
  default: profile_agency,
  loader: loader$h,
  meta: meta$f
}, Symbol.toStringTag, { value: "Module" }));
const meta$e = () => {
  return [{
    title: "My Profile - runoot"
  }];
};
async function loader$g({
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
async function action$c({
  request
}) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const fullName = formData.get("fullName");
  const phone = formData.get("phone");
  formData.get("bio");
  formData.get("country");
  formData.get("city");
  formData.get("website");
  formData.get("languages");
  formData.get("marathonsCompleted");
  formData.get("favoriteRaces");
  formData.get("instagram");
  formData.get("facebook");
  formData.get("linkedin");
  if (typeof fullName !== "string" || !fullName) {
    return data({
      error: "Full name is required"
    }, {
      status: 400
    });
  }
  const updateData = {
    full_name: fullName,
    phone: phone || null
    // Questi campi dovranno essere aggiunti al database
    // Per ora li ignoriamo finché non aggiungiamo le colonne
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
const profile_runner = UNSAFE_withComponentProps(function RunnerProfile() {
  const {
    user
  } = useLoaderData();
  const actionData = useActionData();
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "mb-8",
        children: [/* @__PURE__ */ jsx("h1", {
          className: "font-display text-3xl font-bold text-gray-900",
          children: "Runner Profile"
        }), /* @__PURE__ */ jsx("p", {
          className: "mt-2 text-gray-600",
          children: "Manage your personal information and running experience"
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
                  children: "Private Runner"
                })]
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "pt-6 border-t border-gray-200",
            children: [/* @__PURE__ */ jsx("h2", {
              className: "font-display text-lg font-semibold text-gray-900 mb-4",
              children: "Personal Information"
            }), /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "fullName",
                  className: "label",
                  children: "Full name *"
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
                  children: "About me"
                }), /* @__PURE__ */ jsx("textarea", {
                  id: "bio",
                  name: "bio",
                  rows: 4,
                  className: "input",
                  placeholder: "Tell others about yourself and your running journey..."
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-1 text-xs text-gray-500",
                  children: "Brief description visible to other users"
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
                    placeholder: "Milan"
                  })]
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
              children: "Running Experience"
            }), /* @__PURE__ */ jsxs("div", {
              className: "space-y-4",
              children: [/* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "marathonsCompleted",
                  className: "label",
                  children: "Marathons completed"
                }), /* @__PURE__ */ jsx("input", {
                  id: "marathonsCompleted",
                  name: "marathonsCompleted",
                  type: "number",
                  min: "0",
                  className: "input",
                  placeholder: "3"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "favoriteRaces",
                  className: "label",
                  children: "Favorite races"
                }), /* @__PURE__ */ jsx("textarea", {
                  id: "favoriteRaces",
                  name: "favoriteRaces",
                  rows: 2,
                  className: "input",
                  placeholder: "Berlin Marathon, New York Marathon..."
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
                    placeholder: "username"
                  })]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "facebook",
                  className: "label",
                  children: "Facebook"
                }), /* @__PURE__ */ jsx("input", {
                  id: "facebook",
                  name: "facebook",
                  type: "url",
                  className: "input",
                  placeholder: "https://facebook.com/yourprofile"
                })]
              }), /* @__PURE__ */ jsxs("div", {
                children: [/* @__PURE__ */ jsx("label", {
                  htmlFor: "linkedin",
                  className: "label",
                  children: "LinkedIn"
                }), /* @__PURE__ */ jsx("input", {
                  id: "linkedin",
                  name: "linkedin",
                  type: "url",
                  className: "input",
                  placeholder: "https://linkedin.com/in/yourprofile"
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
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$c,
  default: profile_runner,
  loader: loader$g,
  meta: meta$e
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
async function action$b({
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
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$b
}, Symbol.toStringTag, { value: "Module" }));
const meta$d = ({
  data: data2
}) => {
  var _a;
  return [{
    title: ((_a = data2 == null ? void 0 : data2.listing) == null ? void 0 : _a.title) || "Listing - Runoot"
  }];
};
async function loader$f({
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
async function action$a({
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
      error: error2
    } = await supabaseAdmin.from("listings").delete().eq("id", id);
    if (error2) {
      return data({
        error: "Failed to delete listing"
      }, {
        status: 500
      });
    }
    const redirectPath = (userProfile == null ? void 0 : userProfile.user_type) === "tour_operator" ? "/dashboard" : "/my-listings";
    return redirect(redirectPath);
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
    return redirect(`/messages/${existingConversation.id}`);
  }
  const {
    data: newConversation,
    error
  } = await supabaseAdmin.from("conversations").insert({
    listing_id: id,
    participant_1: userId,
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
const typeLabels$1 = {
  room: "Room only",
  bib: "Bib only",
  room_and_bib: "Package"
};
const typeColors$1 = {
  room: "bg-blue-100 text-blue-700 border-blue-200",
  bib: "bg-purple-100 text-purple-700 border-purple-200",
  room_and_bib: "bg-green-100 text-green-700 border-green-200"
};
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
function getEventSlug(event) {
  if (event.slug) return event.slug;
  return event.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
const listings_$id = UNSAFE_withComponentProps(function ListingDetail() {
  var _a, _b;
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
  const eventDateFormatted = eventDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  eventDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const isOwner = (userData == null ? void 0 : userData.id) === listingData.author_id;
  const daysUntil = getDaysUntilEvent(listingData.event.event_date);
  if (listingData.listing_type === "room") {
    const nights = listingData.check_in && listingData.check_out ? Math.ceil((new Date(listingData.check_out).getTime() - new Date(listingData.check_in).getTime()) / (1e3 * 60 * 60 * 24)) : 0;
    `${formatRoomType(listingData.room_type)} · ${nights > 0 ? `${nights} nights` : "Race weekend"}`;
  } else if (listingData.listing_type === "bib") {
    `${listingData.bib_count || 1} bib${(listingData.bib_count || 1) > 1 ? "s" : ""} available`;
  } else ;
  const priceAnchor = listingData.hotel_stars ? `Comparable ${listingData.hotel_stars}-star hotels from €${Math.round(listingData.hotel_stars * 80 + 100)}` : "Comparable hotels from €200+";
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs(Link, {
        to: "/listings",
        className: "inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 mb-6",
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
        className: "grid gap-6 lg:grid-cols-3",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "lg:col-span-2 space-y-6",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "relative rounded-xl overflow-hidden shadow-lg",
            children: [/* @__PURE__ */ jsx("img", {
              src: `/events/${getEventSlug(listingData.event)}.jpg`,
              alt: listingData.event.name,
              className: "w-full aspect-video object-cover",
              onError: (e) => {
                const target = e.target;
                target.style.display = "none";
                const fallback = target.nextElementSibling;
                if (fallback) fallback.style.display = "flex";
              }
            }), /* @__PURE__ */ jsx("div", {
              className: "w-full aspect-video bg-gradient-to-br from-brand-100 to-brand-200 items-center justify-center",
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
          }), (listingData.listing_type === "room" || listingData.listing_type === "room_and_bib") && /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-xl shadow-lg p-6",
            children: [/* @__PURE__ */ jsx("h3", {
              className: "font-display text-lg font-semibold text-gray-900 mb-4",
              children: "Hotel & Location"
            }), /* @__PURE__ */ jsxs("div", {
              className: "space-y-5",
              children: [listingData.hotel_name && /* @__PURE__ */ jsx("div", {
                children: /* @__PURE__ */ jsxs("div", {
                  className: "flex items-start gap-3",
                  children: [/* @__PURE__ */ jsx("div", {
                    className: "flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 flex-shrink-0",
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
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-sm text-gray-500 mb-1",
                      children: "Hotel"
                    }), /* @__PURE__ */ jsx("p", {
                      className: "font-semibold text-gray-900",
                      children: listingData.hotel_website ? /* @__PURE__ */ jsxs("a", {
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
                      }) : listingData.hotel_name
                    }), (listingData.hotel_city || listingData.hotel_country) && /* @__PURE__ */ jsxs("p", {
                      className: "text-sm text-gray-600 mt-0.5",
                      children: ["📍 ", listingData.hotel_city || "", listingData.hotel_city && listingData.hotel_country ? ", " : "", listingData.hotel_country || ""]
                    }), listingData.hotel_rating && /* @__PURE__ */ jsxs("p", {
                      className: "text-sm text-gray-600 mt-1",
                      children: ["⭐ ", listingData.hotel_rating.toFixed(1), " rating"]
                    })]
                  })]
                })
              }), /* @__PURE__ */ jsxs("div", {
                className: "flex items-start gap-3",
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
                      d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    })
                  })
                }), /* @__PURE__ */ jsxs("div", {
                  className: "flex-1",
                  children: [/* @__PURE__ */ jsx("p", {
                    className: "text-sm text-gray-500 mb-1",
                    children: "Accommodation"
                  }), /* @__PURE__ */ jsxs("p", {
                    className: "font-semibold text-gray-900",
                    children: [listingData.room_count || 1, " ", formatRoomType(listingData.room_type), " room", (listingData.room_count || 1) > 1 ? "s" : ""]
                  })]
                })]
              }), listingData.check_in && listingData.check_out && (() => {
                const checkIn = new Date(listingData.check_in);
                const checkOut = new Date(listingData.check_out);
                const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1e3 * 60 * 60 * 24));
                return /* @__PURE__ */ jsxs("div", {
                  className: "flex items-start gap-3",
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
                  }), /* @__PURE__ */ jsxs("div", {
                    className: "flex-1",
                    children: [/* @__PURE__ */ jsx("p", {
                      className: "text-sm text-gray-500 mb-1",
                      children: "Dates"
                    }), /* @__PURE__ */ jsxs("p", {
                      className: "font-semibold text-gray-900",
                      children: [checkIn.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short"
                      }), " → ", checkOut.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })]
                    }), /* @__PURE__ */ jsxs("p", {
                      className: "text-sm text-gray-600 mt-0.5",
                      children: [nights, " night", nights > 1 ? "s" : ""]
                    })]
                  })]
                });
              })()]
            })]
          }), (listingData.listing_type === "room" || listingData.listing_type === "room_and_bib") && listingData.hotel_name && /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-xl shadow-lg p-6",
            children: [/* @__PURE__ */ jsx("h3", {
              className: "font-display text-lg font-semibold text-gray-900 mb-4",
              children: "Why this stay"
            }), /* @__PURE__ */ jsxs("div", {
              className: "space-y-2.5",
              children: [listingData.hotel_rating && listingData.hotel_rating >= 4 && /* @__PURE__ */ jsxs("div", {
                className: "flex items-start gap-3",
                children: [/* @__PURE__ */ jsx("svg", {
                  className: "h-5 w-5 text-green-600 flex-shrink-0 mt-0.5",
                  fill: "currentColor",
                  viewBox: "0 0 20 20",
                  children: /* @__PURE__ */ jsx("path", {
                    fillRule: "evenodd",
                    d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                    clipRule: "evenodd"
                  })
                }), /* @__PURE__ */ jsxs("span", {
                  className: "text-gray-700",
                  children: ["Top-rated hotel (⭐ ", listingData.hotel_rating.toFixed(1), " on Google)"]
                })]
              }), listingData.hotel_city && /* @__PURE__ */ jsxs("div", {
                className: "flex items-start gap-3",
                children: [/* @__PURE__ */ jsx("svg", {
                  className: "h-5 w-5 text-green-600 flex-shrink-0 mt-0.5",
                  fill: "currentColor",
                  viewBox: "0 0 20 20",
                  children: /* @__PURE__ */ jsx("path", {
                    fillRule: "evenodd",
                    d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                    clipRule: "evenodd"
                  })
                }), /* @__PURE__ */ jsxs("span", {
                  className: "text-gray-700",
                  children: ["Located in ", listingData.hotel_city]
                })]
              }), /* @__PURE__ */ jsxs("div", {
                className: "flex items-start gap-3",
                children: [/* @__PURE__ */ jsx("svg", {
                  className: "h-5 w-5 text-green-600 flex-shrink-0 mt-0.5",
                  fill: "currentColor",
                  viewBox: "0 0 20 20",
                  children: /* @__PURE__ */ jsx("path", {
                    fillRule: "evenodd",
                    d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                    clipRule: "evenodd"
                  })
                }), /* @__PURE__ */ jsx("span", {
                  className: "text-gray-700",
                  children: "Perfect for race weekend rest & recovery"
                })]
              })]
            })]
          }), (listingData.listing_type === "bib" || listingData.listing_type === "room_and_bib") && /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-xl shadow-lg p-6",
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
            className: "bg-white rounded-xl shadow-lg p-6",
            children: [/* @__PURE__ */ jsx("h3", {
              className: "font-display text-lg font-semibold text-gray-900 mb-3",
              children: "Additional Information"
            }), /* @__PURE__ */ jsx("p", {
              className: "text-gray-700 whitespace-pre-wrap leading-relaxed",
              children: listingData.description
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-xl shadow-lg p-6",
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
            className: "bg-white rounded-xl shadow-lg overflow-hidden",
            children: [/* @__PURE__ */ jsxs("div", {
              className: "px-5 py-4 flex items-center justify-between border-b border-gray-100",
              children: [/* @__PURE__ */ jsx("span", {
                className: `inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${typeColors$1[listingData.listing_type]}`,
                children: typeLabels$1[listingData.listing_type]
              }), /* @__PURE__ */ jsxs("div", {
                className: "flex items-center gap-3",
                children: [user && !isOwner && listingData.status === "active" && /* @__PURE__ */ jsxs(saveFetcher.Form, {
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
                }), listingData.status !== "active" && /* @__PURE__ */ jsx("span", {
                  className: "px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600",
                  children: listingData.status === "sold" ? "Sold" : "Expired"
                })]
              })]
            }), /* @__PURE__ */ jsx("div", {
              className: "p-5 bg-gradient-to-br from-brand-50 to-blue-50",
              children: /* @__PURE__ */ jsxs("div", {
                className: "flex items-start gap-3",
                children: [/* @__PURE__ */ jsx("div", {
                  className: "flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-white flex-shrink-0",
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
                  children: [/* @__PURE__ */ jsx("h2", {
                    className: "font-display text-lg font-bold text-gray-900",
                    children: listingData.event.name
                  }), /* @__PURE__ */ jsxs("p", {
                    className: "text-sm text-gray-600 mt-1",
                    children: [/* @__PURE__ */ jsx("span", {
                      className: "font-medium",
                      children: "Race day:"
                    }), " ", eventDateFormatted]
                  }), daysUntil > 0 && daysUntil <= 60 && /* @__PURE__ */ jsxs("span", {
                    className: "inline-block mt-3 px-2.5 py-1 text-xs font-medium text-accent-600 bg-accent-50 border border-accent-300 rounded-full",
                    children: [daysUntil, " days until race"]
                  })]
                })]
              })
            }), /* @__PURE__ */ jsx("div", {
              className: "px-5 py-4",
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
                className: "text-center pb-4",
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
              }), listingData.status === "active" && !isOwner && /* @__PURE__ */ jsx(Form, {
                method: "post",
                children: /* @__PURE__ */ jsx("button", {
                  type: "submit",
                  className: "btn-primary w-full text-base py-3 font-semibold",
                  children: "Request price & availability"
                })
              }), isOwner && /* @__PURE__ */ jsxs("div", {
                className: "space-y-3",
                children: [/* @__PURE__ */ jsx(Link, {
                  to: `/listings/${listingData.id}/edit`,
                  className: "btn-secondary w-full",
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
                    className: "w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors",
                    children: "Delete Listing"
                  })]
                })]
              }), !user && listingData.status === "active" && /* @__PURE__ */ jsx(Link, {
                to: `/login?redirectTo=/listings/${listingData.id}`,
                className: "btn-primary w-full",
                children: "Login to Contact"
              })]
            })]
          }), /* @__PURE__ */ jsxs("div", {
            className: "bg-white rounded-xl shadow-lg overflow-hidden",
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
        className: "fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg lg:hidden z-10",
        children: /* @__PURE__ */ jsx(Form, {
          method: "post",
          children: /* @__PURE__ */ jsx("button", {
            type: "submit",
            className: "btn-primary w-full text-base py-3 font-semibold",
            children: "Request price & availability"
          })
        })
      })]
    })]
  });
});
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$a,
  default: listings_$id,
  loader: loader$f,
  meta: meta$d
}, Symbol.toStringTag, { value: "Module" }));
const meta$c = ({
  data: data2
}) => {
  var _a;
  return [{
    title: ((_a = data2 == null ? void 0 : data2.listing) == null ? void 0 : _a.title) || "Listing - Runoot"
  }];
};
async function loader$e({
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
async function action$9({
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
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$9,
  default: listings_$id_backup,
  loader: loader$e,
  meta: meta$c
}, Symbol.toStringTag, { value: "Module" }));
const meta$b = () => {
  return [{
    title: "Create Listing - RunStay Exchange"
  }];
};
async function loader$d({
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
async function action$8({
  request
}) {
  const user = await requireUser(request);
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
  const priceNegotiable = formData.get("priceNegotiable") === "on";
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
    // MODIFICARE QUESTE RIGHE:
    price: price ? parseFloat(price) : null,
    // mantieni per backward compatibility
    price_negotiable: priceNegotiable,
    // mantieni per backward compatibility
    // AGGIUNGERE QUESTE RIGHE:
    transfer_type: transferType || null,
    associated_costs: associatedCosts ? parseFloat(associatedCosts) : null,
    cost_notes: costNotes || null,
    status: "active"
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
      className: "min-h-screen bg-cover bg-center bg-no-repeat",
      style: {
        backgroundImage: "url('/new-listing.jpg')"
      },
      children: /* @__PURE__ */ jsxs("main", {
        className: "mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "mb-8 rounded-xl bg-white/70 backdrop-blur-sm p-4 inline-block shadow-[0_2px_8px_rgba(0,0,0,0.15)]",
          children: [/* @__PURE__ */ jsx("h1", {
            className: "font-display text-3xl font-bold text-gray-900",
            children: "Create a Listing"
          }), /* @__PURE__ */ jsx("p", {
            className: "mt-2 text-gray-600",
            children: "Share your available rooms or bibs with the community"
          })]
        }), /* @__PURE__ */ jsx("div", {
          className: "rounded-2xl bg-white/70 backdrop-blur-sm p-6 sm:p-8 shadow-[0_2px_8px_rgba(0,0,0,0.15)]",
          children: /* @__PURE__ */ jsxs(Form, {
            method: "post",
            className: "space-y-8",
            onSubmit: () => setFormSubmitted(true),
            children: [(actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx("div", {
              className: "rounded-lg bg-red-50 p-4 text-sm text-red-700",
              children: actionData.error
            }), /* @__PURE__ */ jsxs("div", {
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
                    onSelectHotel: (hotel) => {
                    }
                  })]
                }), /* @__PURE__ */ jsx("div", {
                  children: " "
                }), /* @__PURE__ */ jsx("div", {
                  children: " "
                }), /* @__PURE__ */ jsxs("div", {
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
                      }), /* @__PURE__ */ jsx("span", {
                        className: "text-sm text-gray-600",
                        children: "Private users can list 1 room only"
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
                }), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    htmlFor: "roomType",
                    className: "label",
                    children: "Room type"
                  }), /* @__PURE__ */ jsxs("select", {
                    id: "roomType",
                    name: "roomType",
                    className: "input",
                    onChange: (e) => setRoomType(e.target.value),
                    children: [/* @__PURE__ */ jsx("option", {
                      value: "",
                      children: "Select type"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "single",
                      children: "Single"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "double",
                      children: "Double"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "twin",
                      children: "Twin"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "twin_shared",
                      children: "Twin Shared"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "double_single_use",
                      children: "Double Single Use"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "triple",
                      children: "Triple"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "quadruple",
                      children: "Quadruple"
                    }), /* @__PURE__ */ jsx("option", {
                      value: "other",
                      children: "Other * (specify)"
                    })]
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    htmlFor: "checkIn",
                    className: "label",
                    children: "Check-in date"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "date",
                    id: "checkIn",
                    name: "checkIn",
                    placeholder: "dd/mm/yyyy",
                    min: dateConstraints.min,
                    max: dateConstraints.max,
                    className: "input"
                  }), selectedEvent && /* @__PURE__ */ jsxs("p", {
                    className: "mt-1 text-xs text-gray-500",
                    children: ["Event date: ", new Date(selectedEvent.event_date).toLocaleDateString(), " (±7 days)"]
                  })]
                }), /* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    htmlFor: "checkOut",
                    className: "label",
                    children: "Check-out date"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "date",
                    id: "checkOut",
                    name: "checkOut",
                    placeholder: "dd/mm/yyyy",
                    min: dateConstraints.min,
                    max: dateConstraints.max,
                    className: "input"
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
                  }), " RunOot facilitates connections for legitimate bib transfers only. Direct sale of bibs may violate event regulations."]
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
                    className: "text-red-500",
                    children: "*"
                  })]
                }), /* @__PURE__ */ jsx("input", {
                  type: "number",
                  id: "associatedCosts",
                  name: "associatedCosts",
                  min: "0",
                  step: "0.01",
                  placeholder: "e.g. 50",
                  className: "input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                  required: true
                }), /* @__PURE__ */ jsx("p", {
                  className: "mt-1 text-xs text-gray-500",
                  children: "Official name change fee from the event organizer"
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
                className: "grid gap-4 sm:grid-cols-2",
                children: [/* @__PURE__ */ jsxs("div", {
                  children: [/* @__PURE__ */ jsx("label", {
                    htmlFor: "price",
                    className: "label",
                    children: "Price (€)"
                  }), /* @__PURE__ */ jsx("input", {
                    type: "number",
                    id: "price",
                    name: "price",
                    min: "0",
                    step: "0.01",
                    placeholder: "Empty = Contact for price",
                    className: "input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  })]
                }), (listingType === "room" || listingType === "room_and_bib") && /* @__PURE__ */ jsx("div", {
                  className: "flex items-end",
                  children: /* @__PURE__ */ jsxs("label", {
                    className: "flex items-center gap-2 cursor-pointer",
                    children: [/* @__PURE__ */ jsx("input", {
                      type: "checkbox",
                      name: "priceNegotiable",
                      className: "h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    }), /* @__PURE__ */ jsx("span", {
                      className: "text-sm text-gray-700",
                      children: "Price is negotiable"
                    })]
                  })
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
            }), /* @__PURE__ */ jsx("div", {
              className: "flex gap-4 pt-4",
              children: /* @__PURE__ */ jsx("button", {
                type: "submit",
                className: "btn-primary flex-1",
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
            children: "Listing Created!"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-gray-600 mb-8",
            children: "Your listing has been published successfully and is now visible to other users."
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
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$8,
  default: listings_new,
  loader: loader$d,
  meta: meta$b
}, Symbol.toStringTag, { value: "Module" }));
const meta$a = () => {
  return [{
    title: "My Listings - Runoot"
  }];
};
async function loader$c({
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
  const activeListings = userListings.filter((listing) => {
    const eventDate = new Date(listing.event.event_date);
    return eventDate >= today;
  });
  const endedListings = userListings.filter((listing) => {
    const eventDate = new Date(listing.event.event_date);
    return eventDate < today;
  });
  return {
    user,
    activeListings,
    endedListings
  };
}
const myListings = UNSAFE_withComponentProps(function MyListings() {
  const {
    user,
    activeListings,
    endedListings
  } = useLoaderData();
  const totalListings = activeListings.length + endedListings.length;
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "mb-8 flex items-center justify-between",
        children: [/* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("h1", {
            className: "font-display text-3xl font-bold text-gray-900",
            children: "My Listings"
          }), /* @__PURE__ */ jsx("p", {
            className: "mt-2 text-gray-600",
            children: totalListings === 0 ? "You haven't created any listings yet" : `You have ${totalListings} listing${totalListings > 1 ? "s" : ""}`
          })]
        }), /* @__PURE__ */ jsx(Link, {
          to: "/listings/new",
          className: "btn-primary",
          children: "+ New Listing"
        })]
      }), totalListings > 0 ? /* @__PURE__ */ jsxs("div", {
        className: "space-y-10",
        children: [activeListings.length > 0 && /* @__PURE__ */ jsxs("section", {
          children: [/* @__PURE__ */ jsxs("h2", {
            className: "font-display text-xl font-semibold text-gray-900 mb-4",
            children: ["Active (", activeListings.length, ")"]
          }), /* @__PURE__ */ jsx("div", {
            className: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3",
            children: activeListings.map((listing) => /* @__PURE__ */ jsx(ListingCard, {
              listing,
              isUserLoggedIn: true
            }, listing.id))
          })]
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
          className: "btn-primary",
          children: "Create your first listing"
        })]
      })]
    })]
  });
});
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: myListings,
  loader: loader$c,
  meta: meta$a
}, Symbol.toStringTag, { value: "Module" }));
async function loader$b({
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
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$b
}, Symbol.toStringTag, { value: "Module" }));
async function action$7({
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
const route14 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7
}, Symbol.toStringTag, { value: "Module" }));
const meta$9 = () => {
  return [{
    title: "Dashboard - Runoot"
  }];
};
async function loader$a({
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
const statusColors = {
  active: "bg-success-100 text-success-700 border border-success-200",
  sold: "bg-gray-100 text-gray-700 border border-gray-200",
  expired: "bg-alert-100 text-alert-700 border border-alert-200"
};
const dashboard = UNSAFE_withComponentProps(function Dashboard() {
  var _a;
  const {
    user,
    listings,
    conversations,
    unreadCount
  } = useLoaderData();
  const activeListings = listings.filter((l) => l.status === "active");
  const soldListings = listings.filter((l) => l.status === "sold");
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "mb-8",
        children: [/* @__PURE__ */ jsxs("h1", {
          className: "font-display text-3xl font-bold text-gray-900",
          children: ["Welcome back, ", user.full_name || user.email.split("@")[0]]
        }), /* @__PURE__ */ jsx("p", {
          className: "mt-2 text-gray-600",
          children: "Manage your listings and conversations"
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
                  className: `px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ${statusColors[listing.status]}`,
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
              to: "/dashboard/listings",
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
  });
});
const route15 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: dashboard,
  loader: loader$a,
  meta: meta$9
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
async function loader$9({
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
  if (url.pathname === "/messages" && conversations && conversations.length > 0) {
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
    className: "h-screen flex flex-col bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsx("div", {
      className: "flex-1 overflow-hidden bg-cover bg-center bg-no-repeat",
      style: {
        backgroundImage: "url('/messages.webp')"
      },
      children: /* @__PURE__ */ jsx("div", {
        className: "mx-auto max-w-7xl h-full px-4 sm:px-6 lg:px-8 py-16",
        children: /* @__PURE__ */ jsxs("div", {
          className: "flex h-full rounded-lg shadow-xl overflow-hidden",
          children: [/* @__PURE__ */ jsxs("aside", {
            className: `w-full md:w-80 lg:w-96 bg-white/95 backdrop-blur-sm rounded-l-lg flex flex-col overflow-hidden border-r border-gray-200 ${activeConversationId ? "hidden md:flex" : "flex"}`,
            children: [/* @__PURE__ */ jsx("div", {
              className: "p-4 border-b border-gray-200 flex items-center h-[72px]",
              children: /* @__PURE__ */ jsx("h1", {
                className: "font-display text-xl font-bold text-gray-900",
                children: "Messages"
              })
            }), /* @__PURE__ */ jsx("div", {
              className: "flex-1 overflow-y-auto",
              children: conversations.length > 0 ? /* @__PURE__ */ jsx("div", {
                className: "divide-y divide-gray-100",
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
            })]
          }), /* @__PURE__ */ jsx("main", {
            className: `flex-1 flex flex-col ${activeConversationId ? "flex" : "hidden md:flex"}`,
            children: /* @__PURE__ */ jsx(Outlet, {
              context: {
                user,
                conversations
              }
            })
          })]
        })
      })
    })]
  });
});
const route16 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: messages,
  loader: loader$9
}, Symbol.toStringTag, { value: "Module" }));
const meta$8 = () => {
  return [{
    title: "Messages - Runoot"
  }];
};
const messages__index = UNSAFE_withComponentProps(function MessagesIndex() {
  return /* @__PURE__ */ jsx("div", {
    className: "flex-1 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-r-lg",
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
const route17 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: messages__index,
  meta: meta$8
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
const meta$7 = () => {
  return [{
    title: "Conversation - Runoot"
  }];
};
async function loader$8({
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
      listing:listings(id, title, listing_type, status),
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
async function action$6({
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
  var _a, _b, _c, _d;
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
    className: "flex-1 flex flex-col bg-white/95 backdrop-blur-sm rounded-r-lg overflow-hidden",
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
        className: `flex h-10 w-10 items-center justify-center rounded-full font-semibold flex-shrink-0 ${getAvatarClasses((otherUser == null ? void 0 : otherUser.id) || "", otherUser == null ? void 0 : otherUser.user_type)}`,
        children: ((_a = otherUser == null ? void 0 : otherUser.company_name) == null ? void 0 : _a.charAt(0)) || ((_b = otherUser == null ? void 0 : otherUser.full_name) == null ? void 0 : _b.charAt(0)) || "?"
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
          to: `/listings/${(_c = conversation.listing) == null ? void 0 : _c.id}`,
          className: "text-sm text-brand-600 hover:text-brand-700 truncate block",
          children: (_d = conversation.listing) == null ? void 0 : _d.title
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
      className: "flex-1 overflow-y-auto px-8 py-4",
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
              const displayContent = getDisplayContent(message);
              return /* @__PURE__ */ jsx("div", {
                className: `flex ${isOwnMessage ? "justify-end" : "justify-start"}`,
                children: /* @__PURE__ */ jsxs("div", {
                  className: `max-w-[70%] rounded-2xl px-4 py-2.5 ${isOwnMessage ? "bg-accent-100 text-gray-900 rounded-br-md" : "bg-gray-200 text-gray-900 rounded-bl-md"}`,
                  children: [/* @__PURE__ */ jsx("p", {
                    className: "whitespace-pre-wrap break-words",
                    children: displayContent.content
                  }), displayContent.isLoading && /* @__PURE__ */ jsxs("div", {
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
                  }), displayContent.canToggle && /* @__PURE__ */ jsxs("button", {
                    type: "button",
                    onClick: () => toggleShowOriginal(message.id),
                    className: `flex items-center gap-1 mt-1.5 text-xs transition-colors ${isOwnMessage ? "text-accent-500 hover:text-accent-700" : "text-gray-400 hover:text-gray-600"}`,
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
                      children: displayContent.showOriginal ? "Show translation" : "Auto-translated • Show original"
                    })]
                  }), (showTimestamp || isOwnMessage) && /* @__PURE__ */ jsxs("div", {
                    className: `flex items-center justify-end gap-1.5 text-xs mt-1 ${isOwnMessage ? "text-accent-600" : "text-gray-500"}`,
                    children: [showTimestamp && /* @__PURE__ */ jsx("span", {
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
                    })]
                  })]
                })
              });
            })()]
          }, message.id);
        }), /* @__PURE__ */ jsx("div", {
          ref: messagesEndRef
        })]
      })
    }), /* @__PURE__ */ jsxs("div", {
      className: "border-t border-gray-200 p-4",
      children: [actionData && "error" in actionData && /* @__PURE__ */ jsx("p", {
        className: "text-sm text-red-600 mb-2",
        children: actionData.error
      }), isBlocked ? /* @__PURE__ */ jsx("p", {
        className: "text-sm text-gray-500 text-center py-2",
        children: "You have blocked this user. Unblock to send messages."
      }) : /* @__PURE__ */ jsxs(Form, {
        ref: formRef,
        method: "post",
        className: "flex gap-3 items-end",
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
          className: "input flex-1 resize-none py-3 min-h-[48px] max-h-[150px] overflow-hidden rounded-2xl",
          disabled: isSubmitting,
          onChange: handleTextareaChange
        }), /* @__PURE__ */ jsx("button", {
          type: "submit",
          disabled: isSubmitting,
          className: "btn-primary px-4 h-12 flex items-center justify-center rounded-2xl",
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
const route18 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6,
  default: messages_$id,
  loader: loader$8,
  meta: meta$7
}, Symbol.toStringTag, { value: "Module" }));
const meta$6 = () => {
  return [{
    title: "Sign Up - Runoot"
  }];
};
async function loader$7({
  request
}) {
  const userId = await getUserId(request);
  if (userId) return redirect("/dashboard");
  return null;
}
async function action$5({
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
const route19 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  default: register,
  loader: loader$7,
  meta: meta$6
}, Symbol.toStringTag, { value: "Module" }));
const meta$5 = () => {
  return [{
    title: "Settings - Runoot"
  }];
};
async function loader$6({
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
async function action$4({
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
const settings = UNSAFE_withComponentProps(function Settings() {
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
      className: "mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8",
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
const route20 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4,
  default: settings,
  loader: loader$6,
  meta: meta$5
}, Symbol.toStringTag, { value: "Module" }));
const meta$4 = () => {
  return [{
    title: "Contact Us - Runoot"
  }];
};
async function loader$5({
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
async function action$3({
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
const contact = UNSAFE_withComponentProps(function Contact() {
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
      className: "mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "mb-8",
        children: [/* @__PURE__ */ jsx("h1", {
          className: "font-display text-3xl font-bold text-gray-900",
          children: "Contact Us"
        }), /* @__PURE__ */ jsxs("p", {
          className: "mt-2 text-gray-600",
          children: [type === "user" && "Report a user", type === "listing" && "Report a listing", type === "bug" && "Report a bug", type === "other" && "Send us a message"]
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
const route21 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3,
  default: contact,
  loader: loader$5,
  meta: meta$4
}, Symbol.toStringTag, { value: "Module" }));
const meta$3 = () => {
  return [{
    title: "Runoot - Room & Bibs Exchange Marketplace"
  }, {
    name: "description",
    content: "Exchange unsold hotel rooms and bibs for running events. Connect tour operators and runners."
  }];
};
async function loader$4({
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
            children: ["Don't Let", " ", /* @__PURE__ */ jsx("span", {
              className: "inline-block w-[140px] sm:w-[175px] lg:w-[210px] text-left",
              children: /* @__PURE__ */ jsx("span", {
                className: `inline-block ${words[subjectIndex].subjectColor} transition-all duration-500 ${subjectAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`,
                children: words[subjectIndex].subject
              })
            }), /* @__PURE__ */ jsxs("span", {
              className: "block",
              children: ["Go", " ", /* @__PURE__ */ jsx("span", {
                className: "inline-block w-[145px] sm:w-[185px] lg:w-[225px] text-left",
                children: /* @__PURE__ */ jsx("span", {
                  className: `inline-block text-accent-400 transition-all duration-500 ${verbAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`,
                  children: words[verbIndex].verb
                })
              })]
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
              className: "flex items-center gap-3",
              children: [/* @__PURE__ */ jsxs("div", {
                className: "relative flex-1",
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
                className: "px-6 py-3 bg-accent-500 text-white font-medium rounded-full hover:bg-accent-600 transition-all shadow-lg shadow-accent-500/30",
                children: "Search"
              })]
            })
          })]
        })
      })]
    }), listings.length > 0 && /* @__PURE__ */ jsx("section", {
      className: "py-20 bg-gray-50",
      children: /* @__PURE__ */ jsxs("div", {
        className: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "flex items-center justify-between",
          children: [/* @__PURE__ */ jsx("h2", {
            className: "font-display text-3xl font-bold text-gray-900",
            children: "Recent Listings"
          }), /* @__PURE__ */ jsx(Link, {
            to: user ? "/listings" : "/login",
            className: "px-6 py-2 bg-brand-500 text-white font-medium rounded-full hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/30",
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
        })]
      })
    }), /* @__PURE__ */ jsx("section", {
      className: "py-20 bg-gray-900",
      children: /* @__PURE__ */ jsxs("div", {
        className: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center",
        children: [/* @__PURE__ */ jsx("h2", {
          className: "font-display text-3xl font-bold text-white",
          children: "Ready to get started?"
        }), /* @__PURE__ */ jsx("p", {
          className: "mt-4 text-lg text-gray-400",
          children: "Join tour operators and runners already using RunStay Exchange."
        }), /* @__PURE__ */ jsx("div", {
          className: "mt-8",
          children: user ? /* @__PURE__ */ jsx(Link, {
            to: "/listings/new",
            className: "btn-primary text-lg px-8 py-3",
            children: "Create a Listing"
          }) : /* @__PURE__ */ jsx(Link, {
            to: "/register",
            className: "btn-primary text-lg px-8 py-3",
            children: "Create Free Account"
          })
        })]
      })
    }), /* @__PURE__ */ jsx("footer", {
      className: "bg-gray-900 border-t border-gray-800",
      children: /* @__PURE__ */ jsx("div", {
        className: "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
        children: /* @__PURE__ */ jsxs("p", {
          className: "text-center text-sm text-gray-500",
          children: ["© ", (/* @__PURE__ */ new Date()).getFullYear(), " Runoot Exchange. Platform for informational purposes only. Transactions are between users."]
        })
      })
    })]
  });
});
const route22 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _index,
  loader: loader$4,
  meta: meta$3
}, Symbol.toStringTag, { value: "Module" }));
async function action$2({
  request
}) {
  return logout(request);
}
async function loader$3() {
  return redirect("/");
}
const route23 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const meta$2 = () => {
  return [{
    title: "Report - Runoot"
  }];
};
async function loader$2({
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
async function action$1({
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
      className: "mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8",
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
const route24 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: report,
  loader: loader$2,
  meta: meta$2
}, Symbol.toStringTag, { value: "Module" }));
const meta$1 = () => {
  return [{
    title: "Login - Runoot"
  }];
};
async function loader$1({
  request
}) {
  const userId = await getUserId(request);
  if (userId) return redirect("/dashboard");
  return null;
}
async function action({
  request
}) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo") || "/dashboard";
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
  return createUserSession(authData.user.id, authData.session.access_token, authData.session.refresh_token, redirectTo);
}
const login = UNSAFE_withComponentProps(function Login() {
  const [searchParams] = useSearchParams();
  const actionData = useActionData();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
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
const route25 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: login,
  loader: loader$1,
  meta: meta$1
}, Symbol.toStringTag, { value: "Module" }));
const meta = () => {
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
  return /* @__PURE__ */ jsxs("div", {
    className: "min-h-full bg-gray-50",
    children: [/* @__PURE__ */ jsx(Header, {
      user
    }), /* @__PURE__ */ jsxs("main", {
      className: "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "mb-8",
        children: [/* @__PURE__ */ jsx("h1", {
          className: "font-display text-3xl font-bold text-gray-900",
          children: "Saved Listings"
        }), /* @__PURE__ */ jsx("p", {
          className: "mt-2 text-gray-600",
          children: "Listings you've saved for later"
        })]
      }), savedListings.length === 0 ? /* @__PURE__ */ jsxs("div", {
        className: "card p-12 text-center",
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
          className: "btn-primary mt-6 inline-block",
          children: "Browse Listings"
        })]
      }) : /* @__PURE__ */ jsx("div", {
        className: "grid gap-6 md:grid-cols-2 lg:grid-cols-3",
        children: savedListings.map((listing) => /* @__PURE__ */ jsx(ListingCard, {
          listing,
          isUserLoggedIn: true,
          isSaved: true
        }, listing.id))
      })]
    })]
  });
});
const route26 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: saved,
  loader,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-Bj2TN-Zi.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/root-s-W88QXJ.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js"], "css": ["/assets/root-DPsn7tEh.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings.$id_.edit": { "id": "routes/listings.$id_.edit", "parentId": "root", "path": "listings/:id/edit", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings._id_.edit-Dbvxcncd.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js", "/assets/listing-rules-CouRL6vW.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.conversations": { "id": "routes/api.conversations", "parentId": "root", "path": "api/conversations", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.conversations-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.messages.$id": { "id": "routes/api.messages.$id", "parentId": "root", "path": "api/messages/:id", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.messages._id-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings._index": { "id": "routes/listings._index", "parentId": "root", "path": "listings", "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings._index-DUh5nK6L.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js", "/assets/ListingCard-UlCRqv1D.js", "/assets/ListingCardCompact-Bf9JPoRI.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/profile._index": { "id": "routes/profile._index", "parentId": "root", "path": "profile", "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/profile._index-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/profile.agency": { "id": "routes/profile.agency", "parentId": "root", "path": "profile/agency", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/profile.agency-fQhOx7kB.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/profile.runner": { "id": "routes/profile.runner", "parentId": "root", "path": "profile/runner", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/profile.runner-5thRFXV3.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.translate": { "id": "routes/api.translate", "parentId": "root", "path": "api/translate", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.translate-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings.$id": { "id": "routes/listings.$id", "parentId": "root", "path": "listings/:id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings._id-DPbMNEYB.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings.$id.backup": { "id": "routes/listings.$id.backup", "parentId": "routes/listings.$id", "path": "backup", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings._id.backup-DcgidxCD.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/listings.new": { "id": "routes/listings.new", "parentId": "root", "path": "listings/new", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/listings.new-CdeuYDid.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js", "/assets/listing-rules-CouRL6vW.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/my-listings": { "id": "routes/my-listings", "parentId": "root", "path": "my-listings", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/my-listings-aNcJmjJx.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js", "/assets/ListingCard-UlCRqv1D.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.unread": { "id": "routes/api.unread", "parentId": "root", "path": "api/unread", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.unread-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.saved": { "id": "routes/api.saved", "parentId": "root", "path": "api/saved", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.saved-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/dashboard": { "id": "routes/dashboard", "parentId": "root", "path": "dashboard", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/dashboard-BKMfxwZn.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js", "/assets/ListingCardCompact-Bf9JPoRI.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/messages": { "id": "routes/messages", "parentId": "root", "path": "messages", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/messages-dQcQR5VE.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js", "/assets/avatarColors-CZJ_YuDz.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/messages._index": { "id": "routes/messages._index", "parentId": "routes/messages", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/messages._index-DHfLeAla.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/messages.$id": { "id": "routes/messages.$id", "parentId": "routes/messages", "path": ":id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/messages._id-BknZCwbF.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/avatarColors-CZJ_YuDz.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/register": { "id": "routes/register", "parentId": "root", "path": "register", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/register-DkT2czJd.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/settings": { "id": "routes/settings", "parentId": "root", "path": "settings", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/settings-xQ-JyM2P.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/contact": { "id": "routes/contact", "parentId": "root", "path": "contact", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/contact-DF8TJiT5.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_index-CUR7S7Px.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js", "/assets/ListingCard-UlCRqv1D.js", "/assets/ListingCardCompact-Bf9JPoRI.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/logout": { "id": "routes/logout", "parentId": "root", "path": "logout", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/logout-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/report": { "id": "routes/report", "parentId": "root", "path": "report", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/report-Dq-9biZi.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/login": { "id": "routes/login", "parentId": "root", "path": "login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/login-Hkz_UgEP.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/saved": { "id": "routes/saved", "parentId": "root", "path": "saved", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/saved-CeKFT0zZ.js", "imports": ["/assets/chunk-JZWAC4HX-Wpy6LLBq.js", "/assets/Header-DbNBnIdE.js", "/assets/ListingCard-UlCRqv1D.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-7db72fee.js", "version": "7db72fee", "sri": void 0 };
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
  "routes/listings.$id_.edit": {
    id: "routes/listings.$id_.edit",
    parentId: "root",
    path: "listings/:id/edit",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/api.conversations": {
    id: "routes/api.conversations",
    parentId: "root",
    path: "api/conversations",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/api.messages.$id": {
    id: "routes/api.messages.$id",
    parentId: "root",
    path: "api/messages/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/listings._index": {
    id: "routes/listings._index",
    parentId: "root",
    path: "listings",
    index: true,
    caseSensitive: void 0,
    module: route4
  },
  "routes/profile._index": {
    id: "routes/profile._index",
    parentId: "root",
    path: "profile",
    index: true,
    caseSensitive: void 0,
    module: route5
  },
  "routes/profile.agency": {
    id: "routes/profile.agency",
    parentId: "root",
    path: "profile/agency",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/profile.runner": {
    id: "routes/profile.runner",
    parentId: "root",
    path: "profile/runner",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/api.translate": {
    id: "routes/api.translate",
    parentId: "root",
    path: "api/translate",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/listings.$id": {
    id: "routes/listings.$id",
    parentId: "root",
    path: "listings/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/listings.$id.backup": {
    id: "routes/listings.$id.backup",
    parentId: "routes/listings.$id",
    path: "backup",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/listings.new": {
    id: "routes/listings.new",
    parentId: "root",
    path: "listings/new",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/my-listings": {
    id: "routes/my-listings",
    parentId: "root",
    path: "my-listings",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  },
  "routes/api.unread": {
    id: "routes/api.unread",
    parentId: "root",
    path: "api/unread",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  },
  "routes/api.saved": {
    id: "routes/api.saved",
    parentId: "root",
    path: "api/saved",
    index: void 0,
    caseSensitive: void 0,
    module: route14
  },
  "routes/dashboard": {
    id: "routes/dashboard",
    parentId: "root",
    path: "dashboard",
    index: void 0,
    caseSensitive: void 0,
    module: route15
  },
  "routes/messages": {
    id: "routes/messages",
    parentId: "root",
    path: "messages",
    index: void 0,
    caseSensitive: void 0,
    module: route16
  },
  "routes/messages._index": {
    id: "routes/messages._index",
    parentId: "routes/messages",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route17
  },
  "routes/messages.$id": {
    id: "routes/messages.$id",
    parentId: "routes/messages",
    path: ":id",
    index: void 0,
    caseSensitive: void 0,
    module: route18
  },
  "routes/register": {
    id: "routes/register",
    parentId: "root",
    path: "register",
    index: void 0,
    caseSensitive: void 0,
    module: route19
  },
  "routes/settings": {
    id: "routes/settings",
    parentId: "root",
    path: "settings",
    index: void 0,
    caseSensitive: void 0,
    module: route20
  },
  "routes/contact": {
    id: "routes/contact",
    parentId: "root",
    path: "contact",
    index: void 0,
    caseSensitive: void 0,
    module: route21
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route22
  },
  "routes/logout": {
    id: "routes/logout",
    parentId: "root",
    path: "logout",
    index: void 0,
    caseSensitive: void 0,
    module: route23
  },
  "routes/report": {
    id: "routes/report",
    parentId: "root",
    path: "report",
    index: void 0,
    caseSensitive: void 0,
    module: route24
  },
  "routes/login": {
    id: "routes/login",
    parentId: "root",
    path: "login",
    index: void 0,
    caseSensitive: void 0,
    module: route25
  },
  "routes/saved": {
    id: "routes/saved",
    parentId: "root",
    path: "saved",
    index: void 0,
    caseSensitive: void 0,
    module: route26
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
