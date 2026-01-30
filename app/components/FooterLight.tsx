import { Link } from "react-router";

export function FooterLight() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-gray-500">
          <span className="text-sm">© {new Date().getFullYear()} Runoot Exchange. All rights reserved.</span>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/privacy-policy" className="hover:text-gray-700 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/cookie-policy" className="hover:text-gray-700 transition-colors">
              Cookie Policy
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/terms" className="hover:text-gray-700 transition-colors">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
