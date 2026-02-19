import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, Link } from "react-router";

export const meta: MetaFunction = () => {
  return [{ title: "Page Not Found - Runoot" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return data({ pathname: url.pathname }, { status: 404 });
}

export default function NotFoundPage() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-alert-600">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-3 text-gray-600">
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/" className="btn-primary w-full sm:w-auto">
            Go to home
          </Link>
          <Link to="/listings" className="btn-secondary w-full sm:w-auto">
            Browse listings
          </Link>
        </div>
      </div>
    </main>
  );
}
