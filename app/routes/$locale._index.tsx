import { data, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import HomePage, { loader as homeLoader, meta as homeMeta } from "./_index";
import { buildLocaleCookie, isSupportedLocale } from "~/lib/locale";
import ReferralFallbackPage, {
  loader as referralLoader,
  action as referralAction,
  meta as referralMeta,
} from "./$";

export const meta: MetaFunction = (args) => {
  if ((args.data as any)?.mode === "referral" || (args.data as any)?.mode === "not_found") {
    return referralMeta(args as any);
  }
  return homeMeta(args as any);
};

export async function loader(args: LoaderFunctionArgs) {
  const localeParam = args.params.locale?.toLowerCase();
  if (!isSupportedLocale(localeParam)) {
    return referralLoader(args);
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

export async function action(args: ActionFunctionArgs) {
  const localeParam = args.params.locale?.toLowerCase();
  if (!isSupportedLocale(localeParam)) {
    return referralAction(args);
  }
  throw new Response("Method Not Allowed", { status: 405 });
}

export default function LocaleIndexRoute() {
  const loaderData = useLoaderData<typeof loader>() as any;
  if (loaderData?.mode === "referral" || loaderData?.mode === "not_found") {
    return <ReferralFallbackPage />;
  }
  return <HomePage />;
}
