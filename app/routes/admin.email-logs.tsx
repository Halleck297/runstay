import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, useLoaderData } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => [{ title: "Email Errors - Admin - Runoot" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const { data: logs } = await (supabaseAdmin as any)
    .from("email_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return { logs: logs || [] };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete_all") {
    await (supabaseAdmin as any).from("email_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  } else if (intent === "delete_one") {
    const id = formData.get("id");
    if (id) await (supabaseAdmin as any).from("email_logs").delete().eq("id", id);
  }

  return data({ ok: true });
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminEmailLogs() {
  const { logs } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Email Errors</h1>
          <p className="mt-1 text-sm text-gray-500">
            {logs.length === 0
              ? "No failed emails — everything is working."
              : `${logs.length} failed email${logs.length === 1 ? "" : "s"} (last 100)`}
          </p>
        </div>
        {logs.length > 0 && (
          <Form method="post">
            <input type="hidden" name="intent" value="delete_all" />
            <button
              type="submit"
              className="text-sm text-red-600 hover:text-red-800 font-medium"
              onClick={(e) => { if (!confirm("Delete all error logs?")) e.preventDefault(); }}
            >
              Clear all
            </button>
          </Form>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <svg className="mx-auto h-10 w-10 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium text-green-800">All emails delivered successfully</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log: any) => (
            <div key={log.id} className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      {log.template_id}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(log.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900 truncate">{log.recipient}</p>
                  <p className="mt-1 text-sm text-red-700 break-words">{log.error}</p>
                </div>
                <Form method="post" className="flex-shrink-0">
                  <input type="hidden" name="intent" value="delete_one" />
                  <input type="hidden" name="id" value={log.id} />
                  <button type="submit" className="text-gray-400 hover:text-red-600 transition-colors" title="Dismiss">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
