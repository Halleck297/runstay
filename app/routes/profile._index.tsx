import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { requireUser } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  
  if (user.user_type === "tour_operator") {
    return redirect("/profile/agency");
  } else {
    return redirect("/profile/runner");
  }
}
