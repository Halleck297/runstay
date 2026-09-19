import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;
export type RequestSource = "all" | "qr" | "site";
type RequestRow = Database["public"]["Tables"]["bib_requests"]["Row"];
export type AdminBibRequest = Pick<RequestRow, "id" | "created_at" | "first_name" | "last_name" | "email" | "race" | "preference" | "source">;
export type RunnerRequest = {
  email: string;
  firstName: string;
  lastName: string;
  latestRequestAt: string;
  races: AdminBibRequest[];
};

const BATCH_SIZE = 500;
const PAGE_SIZE = 50;

// Read past the API's row limit so a runner's races cannot be split or lost.
async function readAll<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await read(rows.length, rows.length + BATCH_SIZE - 1);
    if (error) throw new Error("Unable to load bib requests.");
    if (!data?.length) return rows;
    rows.push(...data);
  }
}

export async function loadRunnerRequests(client: Client, source: RequestSource, requestedPage: number) {
  // Count and paginate people before fetching their details. Existing records
  // work immediately; no submission or database schema changes are needed.
  const index = await readAll<{ email: string }>((from, to) => {
    let query = client.from("bib_requests").select("email")
      .order("created_at", { ascending: false }).order("id", { ascending: false });
    if (source !== "all") query = query.eq("source", source);
    return query.range(from, to);
  });
  const emails = [...new Set(index.map(row => row.email))];
  const count = emails.length;
  const page = Math.min(Math.max(1, requestedPage), Math.max(1, Math.ceil(count / PAGE_SIZE)));
  const pageEmails = emails.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (!pageEmails.length) return { requests: [], count, raceCount: index.length, page, pageSize: PAGE_SIZE };

  const rows = await readAll<AdminBibRequest>((from, to) => {
    let query = client.from("bib_requests")
      .select("id,created_at,first_name,last_name,email,race,preference,source")
      .in("email", pageEmails)
      .order("created_at", { ascending: false }).order("id", { ascending: false });
    if (source !== "all") query = query.eq("source", source);
    return query.range(from, to);
  });
  const groups = new Map<string, RunnerRequest>();
  for (const row of rows) {
    let group = groups.get(row.email);
    if (!group) {
      group = { email: row.email, firstName: row.first_name, lastName: row.last_name, latestRequestAt: row.created_at, races: [] };
      groups.set(row.email, group);
    }
    group.races.push(row);
  }
  const requests = pageEmails.flatMap(email => {
    const group = groups.get(email);
    return group ? [group] : [];
  });
  return { requests, count, raceCount: index.length, page, pageSize: PAGE_SIZE };
}

export function parseRequestDeletion(form: FormData) {
  const email = form.get("email");
  const ids = [...new Set(form.getAll("requestId"))];
  if (form.get("intent") !== "delete" || typeof email !== "string" || email.length > 254 ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || !ids.length ||
    ids.some(id => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return null;
  }
  return { email, ids: ids as string[] };
}

export async function deleteRunnerRequests(client: Client, selection: NonNullable<ReturnType<typeof parseRequestDeletion>>) {
  // Delete only the records shown and confirmed, including when a source filter
  // is active. Requests arriving after confirmation are never deleted implicitly.
  const { error, count } = await client.from("bib_requests").delete({ count: "exact" })
    .eq("email", selection.email).in("id", selection.ids);
  if (error) throw new Error("Unable to delete bib requests.");
  return count ?? 0;
}
