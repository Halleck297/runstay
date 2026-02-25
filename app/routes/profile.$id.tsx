import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.id;
  if (!id) {
    throw new Response("Not found", { status: 404 });
  }
  return redirect(`/profiles/${id}`, { status: 301 });
}

export default function LegacyPublicProfileRedirect() {
  return null;
}
