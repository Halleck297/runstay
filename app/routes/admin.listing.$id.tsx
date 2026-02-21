import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireAdmin } from "~/lib/session.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const id = params.id;
  if (!id) throw new Response("Listing not found", { status: 404 });
  return redirect(`/admin/listings/${id}`);
}

export default function LegacyAdminListingRedirect() {
  return null;
}
