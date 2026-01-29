import { useState, useEffect } from "react";

interface CookieConsentProps {
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onSavePreferences?: (preferences: CookiePreferences) => void;
}

interface CookiePreferences {
  necessary: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
}

export default function CookieBanner({
  onAcceptAll,
  onRejectAll,
  onSavePreferences,
}: CookieConsentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always enabled
    analytics: true,  // Pre-selected, user can deselect
    marketing: true,  // Pre-selected, user can deselect
  });

  useEffect(() => {
    // Check if consent was already given
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const saveConsent = (type: "all" | "necessary" | "custom") => {
    const consentData = {
      type,
      preferences: type === "all"
        ? { necessary: true, analytics: true, marketing: true }
        : type === "necessary"
        ? { necessary: true, analytics: false, marketing: false }
        : preferences,
      timestamp: new Date().toISOString(),
      version: "1.0",
    };

    localStorage.setItem("cookie_consent", JSON.stringify(consentData));

    // Set a cookie as well for server-side access
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `cookie_consent=${type};expires=${expires.toUTCString()};path=/;SameSite=Lax`;

    setIsVisible(false);
  };

  const handleAcceptAll = () => {
    saveConsent("all");
    onAcceptAll?.();
  };

  const handleRejectAll = () => {
    saveConsent("necessary");
    onRejectAll?.();
  };

  const handleSavePreferences = () => {
    saveConsent("custom");
    onSavePreferences?.(preferences);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" aria-hidden="true" />

      {/* Cookie Banner */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-banner-title"
        className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-2xl border-t border-gray-200"
      >
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          {!showDetails ? (
            /* Simple View */
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1">
                <h2 id="cookie-banner-title" className="text-lg font-semibold text-gray-900">
                  We use cookies
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  We use essential cookies to make our site work. With your consent, we may also use
                  analytics cookies to improve your experience. You can accept all cookies or
                  customize your preferences.{" "}
                  <a href="/cookie-policy" className="text-brand-600 hover:underline">
                    Learn more
                  </a>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
                <button
                  onClick={() => setShowDetails(true)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Customize
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                >
                  Accept All
                </button>
              </div>
            </div>
          ) : (
            /* Detailed View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 id="cookie-banner-title" className="text-lg font-semibold text-gray-900">
                  Cookie Preferences
                </h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close details"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-600">
                Select which cookie categories you want to enable. Essential cookies cannot be
                disabled as they are required for the site to function properly.
              </p>

              <div className="space-y-3">
                {/* Necessary Cookies */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">Essential Cookies</h3>
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                        Always active
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Required for basic site functionality, including authentication
                      and session management.
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="w-5 h-5 rounded border-gray-300 text-brand-600 cursor-not-allowed"
                      aria-label="Essential cookies (always active)"
                    />
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Analytics Cookies</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Help us understand how visitors interact with the site by collecting
                      anonymous and aggregated information.
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences({ ...preferences, analytics: e.target.checked })
                      }
                      className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      aria-label="Enable analytics cookies"
                    />
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Marketing Cookies</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Used to show you relevant ads and measure the effectiveness
                      of advertising campaigns.
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) =>
                        setPreferences({ ...preferences, marketing: e.target.checked })
                      }
                      className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      aria-label="Enable marketing cookies"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                <a
                  href="/cookie-policy"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-brand-600 text-center"
                >
                  Read full Cookie Policy
                </a>
                <div className="flex-1" />
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Only Essential
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Hook to check cookie consent
 * Use in pages where you want to conditionally load third-party scripts
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState<{
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
  } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("cookie_consent");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConsent(parsed.preferences);
      } catch {
        setConsent({ necessary: true, analytics: false, marketing: false });
      }
    }
  }, []);

  return consent;
}

/**
 * Function to reopen the cookie banner
 * Use in the footer for the "Manage Cookies" link
 */
export function reopenCookieBanner() {
  localStorage.removeItem("cookie_consent");
  // Remove the cookie as well
  document.cookie = "cookie_consent=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  // Reload to show the banner
  window.location.reload();
}
