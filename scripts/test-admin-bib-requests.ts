import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../app/lib/database.types";
import { deleteRunnerRequests, loadRunnerRequests, parseRequestDeletion, type AdminBibRequest } from "../app/lib/admin-bib-requests.server";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function row(n: number, email: string, source: "qr" | "site" = "site"): AdminBibRequest {
  return { id: id(n), email, race: `Race ${n}`, first_name: "Test", last_name: "Runner", created_at: new Date(Date.UTC(2026, 8, 19, 0, n)).toISOString(), source, preference: source === "qr" ? "package" : "bib" };
}

// Exercise the real Supabase query builder against a disposable in-memory API.
let records: AdminBibRequest[] = [];
let failReads = false;
let failDeletes = false;
const client = createClient<Database>("https://test.invalid", "test-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    const deleting = init?.method === "DELETE";
    if (deleting ? failDeletes : failReads) return new Response(JSON.stringify({ message: "Unavailable" }), { status: 503 });
    let selected = records.filter(record => {
      for (const key of ["email", "source", "id"] as const) {
        const filter = url.searchParams.get(key);
        if (filter?.startsWith("eq.") && record[key] !== filter.slice(3)) return false;
        if (filter?.startsWith("in.(") && !filter.slice(4, -1).split(",").map(value => value.replace(/^"|"$/g, "")).includes(record[key])) return false;
      }
      return true;
    });
    if (deleting) {
      const selectedIds = new Set(selected.map(item => item.id));
      records = records.filter(item => !selectedIds.has(item.id));
      return new Response(null, { status: 204, headers: { "content-range": `*/${selected.length}` } });
    }
    for (const order of (url.searchParams.get("order") || "").split(",").reverse()) {
      const [key, direction] = order.split(".");
      selected.sort((a, b) => String(a[key as keyof AdminBibRequest]).localeCompare(String(b[key as keyof AdminBibRequest])) * (direction === "desc" ? -1 : 1));
    }
    const start = Number(url.searchParams.get("offset") || 0);
    // Simulate a server row cap smaller than our requested batch.
    selected = selected.slice(start, start + Math.min(200, Number(url.searchParams.get("limit") || 200)));
    const fields = (url.searchParams.get("select") || "").split(",");
    return new Response(JSON.stringify(selected.map(item => Object.fromEntries(fields.map(field => [field, item[field as keyof AdminBibRequest]])))), { headers: { "content-type": "application/json" } });
  } },
});

const empty = await loadRunnerRequests(client, "all", 99);
assert.equal(empty.page, 1);
assert.equal(empty.count, 0);
assert.deepEqual(empty.requests, []);

records = Array.from({ length: 1100 }, (_, n) => row(n, "many@example.com", n % 2 ? "qr" : "site"));
records.push(...Array.from({ length: 51 }, (_, n) => row(2000 + n, `runner${n}@example.com`)));
const first = await loadRunnerRequests(client, "all", 1);
const second = await loadRunnerRequests(client, "all", 2);
assert.equal(first.count, 52, "Count runners rather than race rows");
assert.equal(first.raceCount, 1151);
assert.equal(first.requests.length, 50);
assert.equal(second.requests.length, 2);
assert.equal(second.requests[1].races.length, 1100, "All races stay together across server limits and page boundaries");
assert.equal(new Set([...first.requests, ...second.requests].map(item => item.email)).size, 52);
assert.equal((await loadRunnerRequests(client, "all", 99)).page, 2);

const qr = await loadRunnerRequests(client, "qr", 1);
assert.equal(qr.count, 1);
assert.equal(qr.raceCount, 550);
assert.equal(qr.requests[0].races.length, 550);
assert.ok(qr.requests[0].races.every(item => item.source === "qr" && item.preference === "package"));

function deletionForm(email: string, ids: string[]) {
  const form = new FormData();
  form.set("intent", "delete");
  form.set("email", email);
  ids.forEach(value => form.append("requestId", value));
  return form;
}
assert.equal(parseRequestDeletion(deletionForm("many@example.com", [])), null);
assert.equal(parseRequestDeletion(deletionForm("invalid", [id(1)])), null);
assert.equal(parseRequestDeletion(deletionForm("many@example.com", ["invalid-id"])), null);
const wrongIntent = deletionForm("many@example.com", [id(1)]);
wrongIntent.set("intent", "unknown");
assert.equal(parseRequestDeletion(wrongIntent), null);
assert.deepEqual(parseRequestDeletion(deletionForm("many@example.com", [id(1), id(1)]))?.ids, [id(1)]);

// Keep hidden sources, other runners and newly arrived requests untouched.
records = [row(1, "one@example.com", "qr"), row(2, "one@example.com", "qr"), row(3, "one@example.com", "site"), row(4, "other@example.com", "qr")];
const shown = await loadRunnerRequests(client, "qr", 1);
const selected = shown.requests.find(item => item.email === "one@example.com")!;
const deletion = parseRequestDeletion(deletionForm(selected.email, selected.races.map(item => item.id)))!;
records.push(row(5, "one@example.com", "qr"));
assert.equal(await deleteRunnerRequests(client, deletion), 2);
assert.deepEqual(records.map(item => item.id), [id(3), id(4), id(5)]);
assert.equal(await deleteRunnerRequests(client, deletion), 0, "Retrying an already deleted request is harmless");
assert.equal(await deleteRunnerRequests(client, { email: "one@example.com", ids: [id(4)] }), 0, "IDs must belong to the confirmed email");

failReads = true;
await assert.rejects(() => loadRunnerRequests(client, "all", 1));
failReads = false;
failDeletes = true;
await assert.rejects(() => deleteRunnerRequests(client, { email: "one@example.com", ids: [id(3)] }));
assert.ok(records.some(item => item.id === id(3)));
console.log("Admin bib requests: grouping, pagination, source filters, deletion scope and failure handling passed.");
