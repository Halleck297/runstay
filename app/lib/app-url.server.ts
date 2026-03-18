const DEFAULT_PRODUCTION_APP_URL = "https://www.runoot.com";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

function isVercelHostname(hostname: string): boolean {
  return hostname.endsWith(".vercel.app") || hostname.endsWith(".vercel.com");
}

export function getAppUrl(request: Request): string {
  const envAppUrl = String(process.env.APP_URL || "").trim();
  if (envAppUrl) {
    try {
      const envUrl = new URL(envAppUrl);
      const envHostname = envUrl.hostname.toLowerCase();
      if (!isLocalHostname(envHostname) && isVercelHostname(envHostname)) {
        return DEFAULT_PRODUCTION_APP_URL;
      }
      return trimTrailingSlash(envUrl.toString());
    } catch {
      return trimTrailingSlash(envAppUrl);
    }
  }

  const requestUrl = new URL(request.url);
  if (isLocalHostname(requestUrl.hostname.toLowerCase())) {
    return trimTrailingSlash(requestUrl.origin);
  }

  return DEFAULT_PRODUCTION_APP_URL;
}
