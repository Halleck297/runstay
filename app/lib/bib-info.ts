import { isBibLandingPath } from "./bib-requests";

export function isBibPublicPage(path: string) {
  return isBibLandingPath(path) || /^\/(?:privacy-policy|terms-of-use|contact|offer-entry|mailing-list\/confirm)\/?$/.test(path);
}
