import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { logout } from "~/lib/session.server";
import { resolveLocaleForRequest } from "~/lib/locale";

export async function action({ request }: ActionFunctionArgs) {
  return logout(request);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const locale = resolveLocaleForRequest(request, null);
  return redirect(`/${locale}`);
}
