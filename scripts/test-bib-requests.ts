import assert from "node:assert/strict";
import { bibRequestSource, isBibLandingPath, validateBibRequest } from "../app/lib/bib-requests";

function form(overrides: Record<string, string> = {}) {
  const value = new FormData();
  Object.entries({ race: "Tokyo", firstName: "Test", lastName: "Runner", email: " TEST@EXAMPLE.COM ", preference: "bib", ...overrides }).forEach(([k, v]) => value.set(k, v));
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
assert.equal(validateBibRequest(form({ race: "Another race", otherRace: " Valencia   Marathon " })).value?.races[0].race_key, "valencia marathon");
const multiple = form();
multiple.append("race", "Cardiff");
multiple.append("race", "Another race");
multiple.set("otherRace", "São Paulo Trail / 50K");
multiple.append("preference", "package");
assert.deepEqual(validateBibRequest(multiple).value?.races.map(item => item.race), ["Tokyo", "Cardiff", "São Paulo Trail / 50K"]);
assert.equal(validateBibRequest(multiple).value?.preference, "both");
multiple.set("otherRace", "tokyo");
multiple.append("race", "Cardiff");
assert.equal(validateBibRequest(multiple).value?.races.length, 2);
multiple.append("race", "Invalid race");
assert.ok(validateBibRequest(multiple).error, "Any invalid selection rejects the whole submission");
const noRace = form();
noRace.delete("race");
assert.ok(validateBibRequest(noRace).error);
const noPreference = form();
noPreference.delete("preference");
assert.ok(validateBibRequest(noPreference).error);
const extraPreference = form();
extraPreference.append("preference", "invalid");
assert.ok(validateBibRequest(extraPreference).error);
assert.equal(validateBibRequest(form({ preference: "package" })).value?.preference, "package");
// The new page sends each "Another race" name as its own otherRace value, up to six.
const customOnly = form();
customOnly.delete("race");
["Valencia", "Berlin", "Paris"].forEach(name => customOnly.append("otherRace", name));
assert.deepEqual(validateBibRequest(customOnly).value?.races.map(item => item.race), ["Valencia", "Berlin", "Paris"]);
const tooMany = form();
["A1", "B2", "C3", "D4", "E5", "F6", "G7"].forEach(name => tooMany.append("otherRace", name));
assert.ok(validateBibRequest(tooMany).error, "More than six custom races are rejected");
const sixAndListed = form();
["A1", "B2", "C3", "D4", "E5", "F6", "tokyo"].forEach(name => sixAndListed.append("otherRace", name));
assert.equal(validateBibRequest(sixAndListed).value?.races.length, 7, "A custom name matching a listed race does not count twice");
assert.equal(validateBibRequest(form()).value?.phone, null);
assert.equal(validateBibRequest(form({ phone: " +39 333 123 4567 " })).value?.phone, "+39 333 123 4567");
for (const phone of ["12345", "call me", "+".repeat(41)]) {
  assert.ok(validateBibRequest(form({ phone })).error, `Invalid phone ${phone}`);
}
const invalidForms: Record<string, string>[] = [{ race: "Berlin" }, { race: "Another race", otherRace: " " }, { email: "wrong" }, { firstName: " " }, { lastName: "" }, { preference: "invalid" }, { race: "Another race", otherRace: "x".repeat(121) }];
for (const fields of invalidForms) {
  assert.ok(validateBibRequest(form(fields)).error);
}
console.log("Bib request validation and source checks passed.");
