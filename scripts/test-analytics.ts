import assert from "node:assert/strict";
import { CONSENT_CHANGED, CONSENT_VERSION, parseConsent } from "../app/lib/analytics/consent";
import { publicPage, safeAnalyticsProps, startAnalytics, trackPage, trackEvent } from "../app/lib/analytics/client";

const storage = new Map<string, string>();
const fakeStorage = { get length() { return storage.size; }, key: (i: number) => [...storage.keys()][i], getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
const scripts: unknown[] = [];
const fakeWindow = Object.assign(new EventTarget(), { ENV: { ANALYTICS_GA_MEASUREMENT_ID: "G-TESTONLY" }, localStorage: fakeStorage, sessionStorage: fakeStorage, location: { hostname: "www.runoot.com", origin: "https://www.runoot.com", pathname: "/go", search: "", protocol: "https:" }, dataLayer: [] as IArguments[] });
Object.assign(globalThis, { window: fakeWindow, location: fakeWindow.location, document: { cookie: "", referrer: "https://example.com/?email=private@example.com", createElement: () => ({}), head: { appendChild: (script: unknown) => scripts.push(script) } } });
const consent = (analytics: boolean, version = CONSENT_VERSION) => JSON.stringify({ version, timestamp: new Date().toISOString(), preferences: { necessary: true, analytics, marketing: false } });

assert.equal(parseConsent("broken"), null);
assert.equal(parseConsent(consent(true, "1.0")), null);
assert.equal(parseConsent(consent(true), Date.now() + 181 * 86400000), null);
assert.equal(publicPage("/go?email=private@example.com&utm_source=banner#secret", location.origin), "https://www.runoot.com/go?utm_source=banner");
assert.equal(publicPage("/join/private-token", location.origin), null);
assert.equal(publicPage("/admin/bib-requests", location.origin), null);
assert.deepEqual(safeAnalyticsProps({ email: "private@example.com", query: "personal text", landing_source: "qr", race: "Tokyo" }), { landing_source: "qr", race: "Tokyo" });

storage.set("cookie_consent", consent(true, "1.0"));
storage.set("ph_test_posthog", "old tracking identifier");
const stop = startAnalytics();
assert.equal(storage.has("ph_test_posthog"), false);
trackPage("/go", { landing_source: "qr" });
trackEvent("generate_lead", { race: "Tokyo" });
assert.equal(scripts.length, 0, "No tag before new consent");
assert.equal(fakeWindow.dataLayer.length, 0);

storage.set("cookie_consent", consent(true));
fakeWindow.dispatchEvent(new Event(CONSENT_CHANGED));
assert.equal(scripts.length, 1, "Acceptance activates analytics immediately");
let commands = fakeWindow.dataLayer.map(command => Array.from(command));
assert.equal(commands[0][0], "consent");
assert.equal((commands[0][2] as any).analytics_storage, "denied");
assert.equal((commands[1][2] as any).ad_storage, "denied");
assert.equal(commands.filter(command => command[1] === "page_view").length, 1);
trackPage("/go", { landing_source: "qr" });
assert.equal(fakeWindow.dataLayer.filter(command => command[1] === "page_view").length, 1, "No duplicate re-render views");
trackPage("/", { landing_source: "site" });
assert.equal(fakeWindow.dataLayer.filter(command => command[1] === "page_view").length, 2);
trackEvent("generate_lead", { race: "Tokyo", email: "private@example.com" });
assert.equal((fakeWindow.dataLayer.at(-1)![2] as any).email, undefined);

storage.set("cookie_consent", consent(false));
fakeWindow.dispatchEvent(new Event(CONSENT_CHANGED));
const afterRevoke = fakeWindow.dataLayer.length;
trackPage("/go");
trackEvent("generate_lead");
assert.equal(fakeWindow.dataLayer.length, afterRevoke, "Rejection prevents future events");
assert.equal((fakeWindow as any)["ga-disable-G-TESTONLY"], true);
storage.set("cookie_consent", consent(true));
fakeWindow.dispatchEvent(new Event(CONSENT_CHANGED));
assert.equal(scripts.length, 1, "Reaccepting does not reload tag");
trackPage("/admin/bib-requests");
assert.equal((fakeWindow as any)["ga-disable-G-TESTONLY"], true);
stop();
console.log("PASS: consent gating, immediate activation, revocation, SPA views, source, PII filtering and legacy cleanup. No network requests made.");
