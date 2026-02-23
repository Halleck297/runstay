import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { NotFoundPage } from "~/components/NotFoundPage";

export const meta: MetaFunction = () => {
  return [{ title: "Page Not Found - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return data({ pathname: url.pathname }, { status: 404 });
}

export default function CatchAllNotFoundRoute() {
  return <NotFoundPage />;
}
