import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

// Backward compatibility redirect — event requests are now managed under /admin/events
export async function loader(_args: LoaderFunctionArgs) {
  return redirect("/admin/events?tab=requests", { status: 301 });
}
