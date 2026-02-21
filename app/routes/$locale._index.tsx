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

  return data(payload, {
    headers: {
      "Set-Cookie": buildLocaleCookie(localeParam),
    },
  });
}

export default HomePage;
