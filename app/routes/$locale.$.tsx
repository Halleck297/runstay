import { redirect, type LoaderFunctionArgs } from "react-router";
import {
  buildLocaleCookie,
  isSupportedLocale,
  stripLocaleFromPathname,
} from "~/lib/locale";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const localeParam = params.locale?.toLowerCase();
  if (!isSupportedLocale(localeParam)) {
    throw new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const targetPath = stripLocaleFromPathname(url.pathname);
  const target = `${targetPath}${url.search}`;

  return redirect(target, {
    headers: {
      "Set-Cookie": buildLocaleCookie(localeParam),
    },
  });
}

export default function LocalizedRedirectRoute() {
  return null;
}
