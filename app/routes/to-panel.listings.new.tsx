import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "~/lib/session.server";
import { action as sharedAction, loader as sharedLoader } from "~/routes/listings.new";
import CreateListingPage from "~/routes/listings.new";

export const meta: MetaFunction = () => {
  return [{ title: "Create Listing - TO Panel - Runoot" }];
};

export async function loader(args: LoaderFunctionArgs) {
  const user = await requireUser(args.request);
  if (user.user_type !== "tour_operator") return redirect("/listings/new");
  return sharedLoader(args);
}

export async function action(args: ActionFunctionArgs) {
  const user = await requireUser(args.request);
  if (user.user_type !== "tour_operator") return redirect("/listings/new");
  return sharedAction(args);
}

export default function ToCreateListing() {
  return <CreateListingPage />;
}
