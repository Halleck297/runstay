import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { data } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/session.server";
import { sendTemplatedEmail } from "~/lib/email/service.server";
import { supabaseAdmin } from "~/lib/supabase.server";

export const meta: MetaFunction = () => [{ title: "Access Requests - Admin - Runoot" }];

const PAGE_SIZE = 30;

function randomTempPassword() {
  return `Runoot!${Math.random().toString(36).slice(2, 10)}A1`;
}

function getActionLinkFromLinkResponse(linkData: any): string | null {
  return (
    linkData?.properties?.action_link ||
    linkData?.action_link ||
    linkData?.data?.properties?.action_link ||
    linkData?.data?.action_link ||
    null
  );
}

async function createUserWithInviteEmail(args: {
  email: string;
  fullName: string;
  appUrl: string;
}) {
  const tempPassword = randomTempPassword();

  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: args.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: args.fullName,
      user_type: "private",
      company_name: null,
    },
  });

  if (createError || !createData?.user?.id) {
    return { error: createError?.message || "Failed to create user", userId: null as string | null };
  }

  const redirectTo = `${args.appUrl}/reset-password`;
  const { data: linkData, error: linkError } = await (supabaseAdmin.auth.admin as any).generateLink({
    type: "recovery",
    email: args.email,
    options: { redirectTo },
  });

  const actionLink = getActionLinkFromLinkResponse(linkData);
  if (linkError || !actionLink) {
    return {
      error: linkError?.message || "Could not generate password setup link",
      userId: createData.user.id,
    };
  }

  const emailResult = await sendTemplatedEmail({
    to: args.email,
    templateId: "account_setup",
    locale: null,
    payload: { setupLink: actionLink },
  });

  if (!emailResult.ok) {
    return {
      error: emailResult.error || "Could not send password setup email",
      userId: createData.user.id,
    };
  }

  return { error: null as string | null, userId: createData.user.id };
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") || "pending").toLowerCase();
  const search = (url.searchParams.get("search") || "").trim();
  const page = Number.parseInt(url.searchParams.get("page") || "1", 10) || 1;

  let query = (supabaseAdmin.from("access_requests" as any) as any)
    .select("id, full_name, email, country, city, phone, preferred_language, note, source, status, reviewed_by, reviewed_at, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (["pending", "approved", "rejected"].includes(status)) {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: requests, count } = await query;

  const [pendingAgg, approvedAgg, rejectedAgg] = await Promise.all([
    (supabaseAdmin.from("access_requests" as any) as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
    (supabaseAdmin.from("access_requests" as any) as any).select("id", { count: "exact", head: true }).eq("status", "approved"),
    (supabaseAdmin.from("access_requests" as any) as any).select("id", { count: "exact", head: true }).eq("status", "rejected"),
  ]);

  return {
    requests: requests || [],
    status,
    search,
    page,
    totalPages: Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)),
    counts: {
      pending: pendingAgg.count || 0,
      approved: approvedAgg.count || 0,
      rejected: rejectedAgg.count || 0,
    },
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const admin = await requireAdmin(request);
  const adminId = (admin as any).id as string;

  const formData = await request.formData();
  const actionType = String(formData.get("_action") || "");
  const requestId = String(formData.get("requestId") || "");

  if (!requestId) {
    return data({ error: "Missing request id" }, { status: 400 });
  }

  const { data: accessRequest } = await (supabaseAdmin.from("access_requests" as any) as any)
    .select("id, full_name, email, country, city, phone, preferred_language, status")
    .eq("id", requestId)
    .maybeSingle();

  if (!accessRequest) {
    return data({ error: "Request not found" }, { status: 404 });
  }

  if (actionType === "reject") {
    await (supabaseAdmin.from("access_requests" as any) as any)
      .update({ status: "rejected", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq("id", requestId);

    await logAdminAction(adminId, "access_request_rejected", {
      details: { access_request_id: requestId, email: (accessRequest as any).email },
    });

    return data({ success: true, message: "Request rejected." });
  }

  if (actionType === "approve_invite") {
    const normalizedEmail = String((accessRequest as any).email || "").trim().toLowerCase();
    const fullName = String((accessRequest as any).full_name || "").trim() || "Runoot User";

    const { data: existingProfile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile?.id) {
      await (supabaseAdmin.from("access_requests" as any) as any)
        .update({ status: "approved", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);

      await logAdminAction(adminId, "access_request_approved_existing_user", {
        targetUserId: existingProfile.id,
        details: { access_request_id: requestId, email: normalizedEmail },
      });

      return data({ success: true, message: "Request approved. User already exists, no invite sent." });
    }

    const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
    const inviteResult = await createUserWithInviteEmail({
      email: normalizedEmail,
      fullName,
      appUrl,
    });

    if (inviteResult.error || !inviteResult.userId) {
      return data({ error: inviteResult.error || "Could not create invited user" }, { status: 400 });
    }

    const profileData: any = {
      id: inviteResult.userId,
      email: normalizedEmail,
      full_name: fullName,
      user_type: "private",
      company_name: null,
      is_verified: false,
      created_by_admin: adminId,
      country: ((accessRequest as any).country as string | null) || null,
      city: ((accessRequest as any).city as string | null) || null,
      phone: ((accessRequest as any).phone as string | null) || null,
      preferred_language: ((accessRequest as any).preferred_language as string | null) || null,
    };

    const { error: profileError } = await (supabaseAdmin as any).from("profiles").upsert(profileData, { onConflict: "id" });
    if (profileError) {
      return data({ error: `Profile creation failed: ${profileError.message}` }, { status: 500 });
    }

    const { error: managedError } = await (supabaseAdmin as any)
      .from("admin_managed_accounts")
      .upsert(
        {
          user_id: inviteResult.userId,
          access_mode: "external_invite",
          created_by_admin: adminId,
        },
        { onConflict: "user_id" },
      );

    if (managedError) {
      return data({ error: `Managed account tagging failed: ${managedError.message}` }, { status: 500 });
    }

    await (supabaseAdmin.from("access_requests" as any) as any)
      .update({ status: "approved", reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq("id", requestId);

    await logAdminAction(adminId, "access_request_approved_invited", {
      targetUserId: inviteResult.userId,
      details: { access_request_id: requestId, email: normalizedEmail },
    });

    return data({ success: true, message: `Approved and invited ${normalizedEmail}.` });
  }

  return data({ error: "Invalid action" }, { status: 400 });
}

function formatDateStable(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export default function AdminAccessRequests() {
  const { requests, status, search, page, totalPages, counts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { error?: string; success?: boolean; message?: string } | undefined;

  const tabHref = (tab: "pending" | "approved" | "rejected") => {
    const params = new URLSearchParams();
    if (tab !== "pending") params.set("status", tab);
    if (search) params.set("search", search);
    params.set("page", "1");
    const query = params.toString();
    return query ? `/admin/access-requests?${query}` : "/admin/access-requests";
  };

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (status && status !== "pending") params.set("status", status);
    if (search) params.set("search", search);
    params.set("page", String(nextPage));
    return `/admin/access-requests?${params.toString()}`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">Access Requests</h1>
        <p className="text-gray-500 mt-1">Review incoming leads and decide who gets an invite.</p>
      </div>

      {actionData?.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}
      {actionData?.success && actionData.message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{actionData.message}</div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to={tabHref("pending")} className={`rounded-full px-3 py-1.5 text-sm font-medium ${status === "pending" ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-600"}`}>
          Pending ({counts.pending})
        </Link>
        <Link to={tabHref("approved")} className={`rounded-full px-3 py-1.5 text-sm font-medium ${status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
          Approved ({counts.approved})
        </Link>
        <Link to={tabHref("rejected")} className={`rounded-full px-3 py-1.5 text-sm font-medium ${status === "rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
          Rejected ({counts.rejected})
        </Link>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <Form method="get" className="flex flex-col gap-3 md:flex-row md:items-center">
          {status && status !== "pending" ? <input type="hidden" name="status" value={status} /> : null}
          <input
            type="text"
            name="search"
            defaultValue={search}
            className="input w-full md:max-w-sm"
            placeholder="Search by name or email"
          />
          <button type="submit" className="btn-secondary">Search</button>
          <Link to={status && status !== "pending" ? `/admin/access-requests?status=${status}` : "/admin/access-requests"} className="text-sm text-gray-500">
            Reset
          </Link>
        </Form>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          No access requests found.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req: any) => (
            <div key={req.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-gray-900">{req.full_name}</p>
                  <p className="text-sm text-gray-600">{req.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    {req.country ? <span className="rounded bg-gray-100 px-2 py-1">Country: {req.country}</span> : null}
                    {req.city ? <span className="rounded bg-gray-100 px-2 py-1">City: {req.city}</span> : null}
                    {req.phone ? <span className="rounded bg-gray-100 px-2 py-1">Phone: {req.phone}</span> : null}
                    {req.preferred_language ? <span className="rounded bg-gray-100 px-2 py-1">Language: {req.preferred_language}</span> : null}
                    <span className="rounded bg-gray-100 px-2 py-1">Source: {req.source}</span>
                    <span className="rounded bg-gray-100 px-2 py-1">Created: {formatDateStable(req.created_at)}</span>
                  </div>
                  {req.note ? (
                    <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{req.note}</p>
                  ) : null}
                </div>

                {req.status === "pending" ? (
                  <div className="flex w-full flex-col gap-2 md:w-auto">
                    <Form method="post">
                      <input type="hidden" name="_action" value="approve_invite" />
                      <input type="hidden" name="requestId" value={req.id} />
                      <button type="submit" className="btn-primary w-full md:w-auto">Approve and invite</button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="_action" value="reject" />
                      <input type="hidden" name="requestId" value={req.id} />
                      <button type="submit" className="btn-secondary w-full md:w-auto">Reject</button>
                    </Form>
                  </div>
                ) : (
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${req.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {req.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Link
          to={page > 1 ? pageHref(page - 1) : "#"}
          className={`rounded border px-3 py-1.5 text-sm ${page > 1 ? "border-gray-300 text-gray-700" : "border-gray-200 text-gray-400 pointer-events-none"}`}
        >
          Previous
        </Link>
        <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
        <Link
          to={page < totalPages ? pageHref(page + 1) : "#"}
          className={`rounded border px-3 py-1.5 text-sm ${page < totalPages ? "border-gray-300 text-gray-700" : "border-gray-200 text-gray-400 pointer-events-none"}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
