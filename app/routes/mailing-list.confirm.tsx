import { redirect } from "react-router";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const oldLinkRedirect = () => redirect("/?mailing=old-link#request", { headers });

// Old confirmation emails must lead back to the current one-click invitation.
export const loader = oldLinkRedirect;
export const action = oldLinkRedirect;
