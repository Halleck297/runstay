import assert from "node:assert/strict";
import { bibRequestSource, isBibLandingPath, validateBibRequest } from "../app/lib/bib-requests";

function form(overrides: Record<string, string> = {}) {
  const value = new FormData();
  Object.entries({ race: "Tokyo", firstName: "Test", lastName: "Runner", email: " TEST@EXAMPLE.COM ", preference: "bib", consent: "on", ...overrides }).forEach(([k, v]) => value.set(k, v));
  return value;
}

assert.equal(bibRequestSource("/go"), "qr");
assert.equal(bibRequestSource("/go/"), "qr");
for (const path of ["/", "/en", "/it/"]) {
  assert.equal(bibRequestSource(path), "site");
  assert.equal(isBibLandingPath(path), true);
}
assert.equal(isBibLandingPath("/admin"), false);
assert.equal(isBibLandingPath("/en/listings"), false);
assert.equal(validateBibRequest(form()).value?.email, "test@example.com");
assert.equal(validateBibRequest(form({ race: "Another race", otherRace: " Valencia   Marathon " })).value?.race_key, "valencia marathon");
const invalidForms: Record<string, string>[] = [{ race: "Berlin" }, { race: "Another race", otherRace: " " }, { email: "wrong" }, { firstName: " " }, { lastName: "" }, { consent: "" }, { preference: "invalid" }, { race: "Another race", otherRace: "x".repeat(121) }];
for (const fields of invalidForms) {
  assert.ok(validateBibRequest(form(fields)).error);
}
console.log("Bib request validation and source checks passed.");
