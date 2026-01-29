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
    analytics: false,
    marketing: false,
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
                  🍪 Questo sito utilizza i cookie
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Utilizziamo cookie tecnici necessari per il funzionamento del sito e, con il tuo consenso, 
                  cookie analitici per migliorare la tua esperienza. Puoi accettare tutti i cookie, 
                  rifiutarli o personalizzare le tue preferenze.{" "}
                  <a href="/cookie-policy" className="text-brand-600 hover:underline">
                    Maggiori informazioni
                  </a>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
                <button
                  onClick={() => setShowDetails(true)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Personalizza
                </button>
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Rifiuta tutti
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                >
                  Accetta tutti
                </button>
              </div>
            </div>
          ) : (
            /* Detailed View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 id="cookie-banner-title" className="text-lg font-semibold text-gray-900">
                  🍪 Gestione preferenze cookie
                </h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Chiudi dettagli"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-600">
                Seleziona quali categorie di cookie desideri abilitare. I cookie necessari non possono 
                essere disabilitati in quanto essenziali per il funzionamento del sito.
              </p>

              <div className="space-y-3">
                {/* Necessary Cookies */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">Cookie Necessari</h3>
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                        Sempre attivi
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Essenziali per la navigazione e l'utilizzo delle funzionalità del sito, 
                      inclusa l'autenticazione e la gestione della sessione.
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="w-5 h-5 rounded border-gray-300 text-brand-600 cursor-not-allowed"
                      aria-label="Cookie necessari (sempre attivi)"
                    />
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Cookie Analitici</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Ci permettono di capire come i visitatori interagiscono con il sito, 
                      raccogliendo informazioni in forma anonima e aggregata.
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
                      aria-label="Abilita cookie analitici"
                    />
                  </div>
                </div>

                {/* Marketing Cookies (if applicable) */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Cookie di Marketing</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Utilizzati per mostrarti pubblicità più pertinenti e misurare 
                      l'efficacia delle campagne pubblicitarie.
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
                      aria-label="Abilita cookie di marketing"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                <a
                  href="/cookie-policy"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-brand-600 text-center"
                >
                  Leggi la Cookie Policy completa
                </a>
                <div className="flex-1" />
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Rifiuta tutti
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
                >
                  Salva preferenze
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
 * Hook per verificare il consenso ai cookie
 * Usalo nelle pagine dove vuoi condizionare il caricamento di script di terze parti
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
 * Funzione per aprire nuovamente il banner dei cookie
 * Da usare nel footer per il link "Gestisci Cookie"
 */
export function reopenCookieBanner() {
  localStorage.removeItem("cookie_consent");
  // Remove the cookie as well
  document.cookie = "cookie_consent=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  // Reload to show the banner
  window.location.reload();
}
