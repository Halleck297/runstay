import { isBibLandingPath } from "./bib-requests";

export function isBibPublicPage(path: string) {
  return isBibLandingPath(path) || /^\/(?:privacy-policy|contact|offer-entry)\/?$/.test(path);
}
