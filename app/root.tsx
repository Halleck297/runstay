import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { getUser, getAccessToken } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import CookieBanner from "~/components/CookieBanner";
import { MobileNav } from "~/components/MobileNav";
import "./styles/tailwind.css";

export const links: LinksFunction = () => [
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
  const user = await getUser(request);
  const accessToken = await getAccessToken(request);

  // Se l'utente è loggato, conta i messaggi non letti
  let unreadCount = 0;
  if (user) {
    const { data: conversations } = await supabaseAdmin
      .from("conversations")
      .select(`
        id,
        messages(id, sender_id, read_at)
      `)
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

    if (conversations) {
      conversations.forEach((conv: any) => {
        conv.messages?.forEach((msg: any) => {
          if (msg.sender_id !== user.id && !msg.read_at) {
            unreadCount++;
          }
        });
      });
    }
  }

  return {
    user: user ? { ...user, unreadCount } : null,
    ENV: {
      SUPABASE_URL: process.env.SUPABASE_URL!,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
      ACCESS_TOKEN: accessToken,
    },
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
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

export default function App() {
  const { user, ENV } = useLoaderData<typeof loader>();

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.ENV = ${JSON.stringify(ENV)}`,
        }}
      />
      <Outlet />
      <CookieBanner />
      <MobileNav user={user} />
    </>
  );
}
