import { NavLink, Outlet } from "react-router";

export default function MailingListLayout() {
  return <main className="mx-auto max-w-6xl p-4 sm:p-8">
    <h1 className="text-2xl font-bold text-navy-900">Runoot Last Minute</h1>
    <p className="mt-2 text-sm text-gray-600">Bibs, hotels, race packages and last-minute offers across all destinations.</p>
    <nav aria-label="Mailing list" className="my-6 flex gap-3 border-b border-gray-200 pb-3">
      {[['/admin/mailing-list', 'Subscribers'], ['/admin/mailing-list/campaigns', 'Emails']].map(([to, label]) => <NavLink key={to} to={to} end={label === 'Subscribers'} className={({ isActive }) => `rounded-lg px-4 py-2 text-sm font-semibold ${isActive ? 'bg-brand-600 text-white' : 'bg-white text-gray-700'}`}>{label}</NavLink>)}
    </nav><Outlet />
  </main>;
}
