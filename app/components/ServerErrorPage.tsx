import { Link } from "react-router";

export function ServerErrorPage({ statusCode = 500 }: { statusCode?: number }) {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <img
          src="/logo.svg"
          alt="Runoot"
          className="mx-auto mb-4 h-28 w-auto"
        />
        <p className="text-sm font-semibold tracking-wide text-alert-600">{statusCode}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-gray-900">Something went wrong</h1>
        <p className="mt-3 text-gray-600">A temporary error occurred. Please try again in a moment.</p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="btn-primary w-full sm:w-auto rounded-full px-6 py-2.5"
          >
            Retry
          </button>
          <Link to="/" className="btn-secondary w-full sm:w-auto rounded-full px-6 py-2.5">
            Go to home
          </Link>
          <Link to="/contact?subject=bug" className="btn-secondary w-full sm:w-auto rounded-full px-6 py-2.5">
            Contact us
          </Link>
        </div>
      </div>
    </main>
  );
}
