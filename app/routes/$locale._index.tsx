import { data, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import HomePage, { loader as homeLoader, meta as homeMeta } from "./_index";
import { buildLocaleCookie, isSupportedLocale } from "~/lib/locale";

export const meta: MetaFunction = homeMeta;

export async function loader(args: LoaderFunctionArgs) {
  const localeParam = args.params.locale?.toLowerCase();
  if (!isSupportedLocale(localeParam)) {
    throw new Response("Not Found", { status: 404 });
  }

  const payload = await homeLoader(args);
  const localeCookie = buildLocaleCookie(localeParam);

  if (payload instanceof Response) {
    const headers = new Headers(payload.headers);
    headers.append("Set-Cookie", localeCookie);
    return new Response(payload.body, {
      status: payload.status,
      statusText: payload.statusText,
      headers,
    });
  }

  return data(payload, {
    headers: {
      "Set-Cookie": localeCookie,
    },
  });
}

export default HomePage;
