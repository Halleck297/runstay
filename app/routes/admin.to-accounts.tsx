import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, Outlet, useLoaderData, useLocation } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import { supabaseAdmin } from "~/lib/supabase.server";
import { getProfilePublicId } from "~/lib/publicIds";

export const meta: MetaFunction = () => {
  return [{ title: "TO Accounts - Admin - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const { data: accounts } = await supabaseAdmin
    .from("profiles")
    .select("id, short_id, email, full_name, company_name, phone, website, country, city, is_verified, created_at")
    .eq("user_type", "tour_operator")
    .order("created_at", { ascending: false });

  return { accounts: accounts || [] };
}

function formatDateStable(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export default function AdminToAccounts() {
  const { accounts } = useLoaderData<typeof loader>();
  const location = useLocation();

  if (location.pathname !== "/admin/to-accounts" && location.pathname !== "/admin/to-accounts/") {
    return <Outlet />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-900">TO Accounts</h1>
          <p className="mt-1 text-gray-500">{accounts.length} tour operator accounts</p>
        </div>
        <Link to="/admin/to-accounts/new" className="btn-primary rounded-full inline-flex items-center gap-2 self-start">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create TO Account
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Representative</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((account: any) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-gray-900">{account.company_name || "N/A"}</p>
                    <p className="text-xs text-gray-500">{account.website || "No website"}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{account.full_name || "N/A"}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{account.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {[account.city, account.country].filter(Boolean).join(", ") || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDateStable(account.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/admin/to-accounts/${getProfilePublicId(account)}`}
                      className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 md:hidden">
          {accounts.map((account: any) => (
            <div key={account.id} className="p-4">
              <p className="text-sm font-semibold text-gray-900">{account.company_name || "N/A"}</p>
              <p className="text-xs text-gray-500">{account.email}</p>
              <p className="mt-1 text-xs text-gray-500">{[account.city, account.country].filter(Boolean).join(", ") || "N/A"}</p>
              <Link
                to={`/admin/to-accounts/${getProfilePublicId(account)}`}
                className="mt-3 inline-block rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
