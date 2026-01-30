import { Link } from "react-router";

export function FooterLight() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-2 text-gray-500">
          <span className="text-xs sm:text-sm">© {new Date().getFullYear()} <span className="hidden sm:inline">Runoot Exchange. All rights reserved.</span><span className="sm:hidden">Runoot</span></span>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <Link to="/privacy-policy" className="hover:text-gray-700 transition-colors">
              <span className="hidden sm:inline">Privacy Policy</span>
              <span className="sm:hidden">Privacy</span>
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/cookie-policy" className="hover:text-gray-700 transition-colors">
              <span className="hidden sm:inline">Cookie Policy</span>
              <span className="sm:hidden">Cookies</span>
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/terms" className="hover:text-gray-700 transition-colors">
              <span className="hidden sm:inline">Terms & Conditions</span>
              <span className="sm:hidden">Terms</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
