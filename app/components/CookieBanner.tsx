import { useEffect, useState } from "react";
import { CONSENT_CHANGED, CONSENT_OPEN, readConsent, saveConsent } from "~/lib/analytics/consent";
export { reopenCookieBanner } from "~/lib/analytics/consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const check = () => setVisible(!readConsent());
    const open = () => setVisible(true);
    check();
    window.addEventListener(CONSENT_OPEN, open);
    window.addEventListener(CONSENT_CHANGED, check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener(CONSENT_OPEN, open);
      window.removeEventListener(CONSENT_CHANGED, check);
      window.removeEventListener("storage", check);
    };
  }, []);
  if (!visible) return null;
  const choose = (analytics: boolean) => { saveConsent(analytics); setVisible(false); };
  return <section aria-label="Cookie preferences" className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
    <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-2xl text-sm leading-relaxed text-gray-700">We use essential cookies. With your permission, Google Analytics helps us understand visits. Your race request works either way. <a href="/cookie-policy" className="underline underline-offset-2">Cookie policy</a></p>
      <div className="flex shrink-0 gap-2">
        <button onClick={() => choose(false)} className="flex-1 whitespace-nowrap rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">Reject optional</button>
        <button onClick={() => choose(true)} className="flex-1 whitespace-nowrap rounded-lg border border-brand-600 bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">Accept analytics</button>
      </div>
    </div>
  </section>;
}
