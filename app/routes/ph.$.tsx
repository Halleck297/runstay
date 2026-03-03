import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

function resolveProxyTargets() {
  const ingestHost = (process.env.POSTHOG_PROXY_INGEST_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
  const assetsHost = (process.env.POSTHOG_PROXY_ASSETS_HOST || "https://eu-assets.i.posthog.com").replace(/\/$/, "");
  return { ingestHost, assetsHost };
}

function extractProxyPath(request: Request, splat?: string): string {
  if (splat && splat.trim()) return splat.replace(/^\/+/, "");
  const pathname = new URL(request.url).pathname;
  return pathname.replace(/^\/ph\/?/, "").replace(/^\/+/, "");
}

function buildTargetUrl(request: Request, splat?: string): string {
  const { ingestHost, assetsHost } = resolveProxyTargets();
  const url = new URL(request.url);
  const proxyPath = extractProxyPath(request, splat);
  const base = proxyPath.startsWith("static/") ? assetsHost : ingestHost;
  return `${base}/${proxyPath}${url.search}`;
}

function sanitizeRequestHeaders(input: Headers): Headers {
  const headers = new Headers(input);
  headers.delete("host");
  headers.delete("content-length");
  return headers;
}

function sanitizeResponseHeaders(input: Headers): Headers {
  const headers = new Headers(input);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return headers;
}

async function proxyRequest(request: Request, splat?: string): Promise<Response> {
  const targetUrl = buildTargetUrl(request, splat);
  const method = request.method.toUpperCase();

  const init: RequestInit = {
    method,
    headers: sanitizeRequestHeaders(request.headers),
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, init);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: sanitizeResponseHeaders(upstream.headers),
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return proxyRequest(request, params["*"]);
}

export async function action({ request, params }: ActionFunctionArgs) {
  return proxyRequest(request, params["*"]);
}

export default function PosthogProxyRoute() {
  return null;
}
