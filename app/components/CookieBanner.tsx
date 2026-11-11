import { useEffect, useState } from "react";
import { CONSENT_CHANGED, CONSENT_OPEN, readConsent, saveConsent } from "~/lib/analytics/consent";
export { reopenCookieBanner } from "~/lib/analytics/consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  useEffect(() => {
    const check = () => setVisible(!readConsent());
    const open = () => {
      setAnalytics(readConsent()?.preferences.analytics ?? true);
      setCustomizing(true);
      setVisible(true);
    };
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
  const choose = (allowAnalytics: boolean) => { saveConsent(allowAnalytics); setVisible(false); setCustomizing(false); };
  return <section aria-label="Cookie preferences" className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
    <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-2xl text-sm leading-relaxed text-gray-700">We use essential cookies. With your permission, Google Analytics helps us understand visits. You can manage your choices in Preferences. Your race request works either way. <a href="/privacy-policy#cookies" className="underline underline-offset-2">Cookie policy</a></p>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" aria-expanded={customizing} aria-controls="cookie-options" onClick={() => {
          if (!customizing) setAnalytics(readConsent()?.preferences.analytics ?? true);
          setCustomizing(!customizing);
        }} className="flex-1 whitespace-nowrap rounded-lg border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">Preferences</button>
        <button onClick={() => choose(true)} className="flex-1 whitespace-nowrap rounded-lg border border-brand-600 bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">Accept</button>
      </div>
    </div>
    {customizing && <div id="cookie-options" className="mx-auto mt-3 max-h-[50vh] max-w-6xl overflow-y-auto border-t border-gray-200 pt-3">
      <div className="flex items-center justify-between gap-4 py-2">
        <div><p id="essential-cookie-label" className="text-sm font-semibold text-gray-900">Essential cookies</p><p className="text-xs text-gray-600">Required for the website to work. Always active.</p></div>
        <button type="button" role="switch" aria-checked={true} aria-labelledby="essential-cookie-label" disabled className="relative h-6 w-11 shrink-0 cursor-not-allowed rounded-full bg-gray-400"><span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" /></button>
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <div><p id="analytics-cookie-label" className="text-sm font-semibold text-gray-900">Google Analytics</p><p className="text-xs text-gray-600">Optional visitor statistics to help us improve Runoot.</p></div>
        <button type="button" role="switch" aria-checked={analytics} aria-labelledby="analytics-cookie-label" onClick={() => setAnalytics(!analytics)} className={`relative h-6 w-11 shrink-0 rounded-full ${analytics ? "bg-brand-600" : "bg-gray-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white ${analytics ? "right-1" : "left-1"}`} /></button>
      </div>
      <div className="mt-3 flex justify-end"><button type="button" onClick={() => choose(analytics)} className="rounded-lg border border-brand-600 bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">Save preferences</button></div>
    </div>}
  </section>;
}
