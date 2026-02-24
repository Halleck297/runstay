import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "~/lib/session.server";

export const meta: MetaFunction = () => {
  return [{ title: "Business details - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") return redirect("/listings");
  return redirect("/to-panel/profile/experience");
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  if (user.user_type !== "tour_operator") return redirect("/listings");
  return redirect("/to-panel/profile/experience");
}

export default function ToProfileSocialRedirect() {
  return null;
}
