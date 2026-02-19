import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data } from "react-router";

function buildNotFoundPayload(request: Request) {
  return {
    error: "Not found",
    code: "API_ROUTE_NOT_FOUND",
    method: request.method,
    path: new URL(request.url).pathname,
  };
}

// Catch-all for unknown API GET requests under /api/*
export async function loader({ request }: LoaderFunctionArgs) {
  return data(buildNotFoundPayload(request), { status: 404 });
}

// Catch-all for unknown API non-GET requests under /api/*
export async function action({ request }: ActionFunctionArgs) {
  return data(buildNotFoundPayload(request), { status: 404 });
}
