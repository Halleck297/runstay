// app/routes/admin.impersonate.stop.tsx - Stop impersonation (action-only route)
import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { stopImpersonation, getRealUserId } from "~/lib/session.server";

export async function action({ request }: ActionFunctionArgs) {
  const realUserId = await getRealUserId(request);
  if (!realUserId) {
    return redirect("/login");
  }

  return stopImpersonation(request);
}

// If someone navigates to this page directly, redirect to admin
export async function loader() {
  return redirect("/admin");
}
