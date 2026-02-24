import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";

export const meta: MetaFunction = () => {
  return [{ title: "Dashboard - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  return redirect(new URL("/to-panel", request.url).toString());
}

export default function LegacyDashboardRedirect() {
  return null;
}
