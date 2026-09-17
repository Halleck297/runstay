import { useEffect, useRef, useState } from "react";
import { Link, useFetcher, useActionData, useLocation } from "react-router";
import type { submitBibRequest } from "~/lib/bib-requests.server";
import { bibRaces, BIB_CONSENT_TEXT } from "~/lib/bib-requests";
import landingStyles from "~/styles/bib-landing.css?url";
import { trackEvent } from "~/lib/analytics/client";
import { reopenCookieBanner } from "~/lib/analytics/consent";
import { bibRequestSource } from "~/lib/bib-requests";

export const links = () => [{ rel: "stylesheet", href: landingStyles }];

export default function BibLanding() {
  const { pathname } = useLocation();
  const showOfferLink = !/^\/go\/?$/.test(pathname);
  const [races, setRaces] = useState<string[]>([]);
  const [otherRace, setOtherRace] = useState("");
  const [preferences, setPreferences] = useState<string[]>(["bib"]);
  const [selectionError, setSelectionError] = useState("");
  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  const fetcher = useFetcher<typeof submitBibRequest>();
  const actionData = useActionData<typeof submitBibRequest>();
  const result = fetcher.data ?? actionData;
  const [dismissed, setDismissed] = useState(false);
  const complete = !dismissed && fetcher.state === "idle" && result?.success === true;
  const submitting = fetcher.state !== "idle";
  const trackedResult = useRef<unknown>(null);
  useEffect(() => {
    if (complete && result !== trackedResult.current) {
      trackedResult.current = result;
      trackEvent("generate_lead", {
        landing_source: bibRequestSource(window.location.pathname),
        race: result.races.length > 1 ? "Multiple races" : bibRaces.some(item => item.name === result.races[0]) ? result.races[0] : "Another race",
        preference: result.preference,
      });
    }
  }, [complete, result]);
  const confirmation = useRef<HTMLDivElement>(null);
  const selectedRaces = result?.success ? result.races : races.map(race => race === "Another race" ? otherRace : race);
  useEffect(() => {
    if (complete) confirmation.current?.focus();
  }, [complete]);

  return (
    <div className="bib-page" lang="en">
      <header className={`bib-header${showOfferLink ? " bib-header-with-offer" : ""}`}>
        <a href="#" className="bib-wordmark" aria-label="BibExchange by Runoot">bibexchange<span>by <strong>runoot</strong></span></a>
        {showOfferLink && <Link className="bib-offer-link" to="/offer-entry">Sell your bib</Link>}
      </header>

      <main>
        <section className="bib-main" aria-labelledby="bib-title">
          <div className="bib-intro">
            <p className="bib-eyebrow"><span aria-hidden="true" /> Your next race starts with a request.</p>
            <h1 id="bib-title">The race is<br /> on your list.<br /><em>Let’s find<br className="bib-desktop-break" /> your bib.</em></h1>
            <p className="bib-lead">Tokyo on your mind? New York on your bucket list? Tell us where you want to run. We’ll contact you when a matching opportunity becomes available.</p>
            <div className="bib-ticket" aria-hidden="true">
              <div><span>DESTINATION</span><strong>YOUR NEXT RACE</strong></div>
              <div className="bib-ticket-bottom"><span>ONE MORE<br />START LINE.</span><span className="bib-barcode" /></div>
            </div>
          </div>

          <div className="bib-form-card" id="request">
            {complete ? (
              <div className="bib-confirmation" ref={confirmation} tabIndex={-1}>
                <span className="bib-check" aria-hidden="true">✓</span>
                <p className="bib-eyebrow">YOU’RE AT THE NEXT STEP</p>
                <h2>{selectedRaces.join(", ")}.<br />Got it.</h2>
                <p>Your request is on our list. We’ll contact you by email when a matching opportunity becomes available, with the price and conditions before you decide.</p>
                <div className="bib-demo-note">An entry is not reserved or guaranteed. To withdraw your request, contact <a href="mailto:support@runoot.com">support@runoot.com</a>.</div>
                <button className="bib-submit" type="button" onClick={() => { setDismissed(true); setRaces([]); setOtherRace(""); setSelectionError(""); }}>Request another race</button>
              </div>
            ) : (
              <fetcher.Form method="post" onSubmit={(event) => {
                if (!races.length || !preferences.length) {
                  event.preventDefault();
                  setSelectionError(!races.length ? "Please select at least one race." : "Please select Bib only, Full package, or both.");
                  event.currentTarget.querySelector<HTMLInputElement>(`input[name="${!races.length ? "race" : "preference"}"]`)?.focus();
                  return;
                }
                setSelectionError("");
                setDismissed(false);
              }}>
                <div className="bib-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
                <div className="bib-form-heading"><p className="bib-eyebrow">LET’S MAKE IT HAPPEN</p><h2>Where do you want to run?</h2><p>Select one or more races. We’ll keep an eye out.</p></div>
                <fieldset className="bib-race-fieldset"><legend className="bib-sr-only">Choose your races. Select one or more.</legend><div className="bib-race-grid">
                  {bibRaces.map((item) => <label className={`bib-race ${races.includes(item.name) ? "is-selected" : ""}`} key={item.name}>
                    <input type="checkbox" name="race" value={item.name} checked={races.includes(item.name)} onChange={() => { setRaces(current => toggle(current, item.name)); setSelectionError(""); }} />
                    <span className="bib-race-code" aria-hidden="true">{item.code}</span><span className="bib-race-name">{item.name}<small>{item.country}</small></span><span className="bib-selection-check" aria-hidden="true">{races.includes(item.name) ? "✓" : ""}</span>
                  </label>)}
                </div></fieldset>
                {races.includes("Another race") && <label className="bib-field">Race name<input name="otherRace" value={otherRace} onChange={(event) => setOtherRace(event.target.value)} placeholder="e.g. Valencia" required maxLength={120} /></label>}
                <fieldset className="bib-preference"><legend>I’m looking for <span className="bib-preference-hint">Select one or both.</span></legend><div>{[{ value: "bib", text: "Bib only" }, { value: "package", text: "Full package (bib + hotel)" }].map(item => <label key={item.value}><input type="checkbox" name="preference" checked={preferences.includes(item.value)} onChange={() => { setPreferences(current => toggle(current, item.value)); setSelectionError(""); }} value={item.value} /><span>{item.text}</span></label>)}</div></fieldset>
                <div className="bib-contact-grid"><label className="bib-field">First name<input name="firstName" autoComplete="given-name" placeholder="First name" required maxLength={100} /></label><label className="bib-field">Last name<input name="lastName" autoComplete="family-name" placeholder="Last name" required maxLength={100} /></label><label className="bib-field bib-email-field">Email address<input type="email" name="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /></label></div>
                <label className="bib-consent"><input type="checkbox" name="consent" required /><span>{BIB_CONSENT_TEXT} <Link to="/privacy-policy">Privacy policy</Link></span></label>
                {(selectionError || (!dismissed && result?.error)) && <p role="alert" className="bib-error">{selectionError || result?.error}</p>}
                <button className="bib-submit" type="submit" disabled={submitting}>{submitting ? "Saving your request…" : races.length > 1 ? "Notify me about my races" : races.length === 1 && races[0] !== "Another race" ? `Notify me about ${races[0]}` : "Notify me about my race"}</button>
                <p className="bib-form-note">Free to request. An entry is not reserved or guaranteed.</p>
              </fetcher.Form>
            )}
          </div>
        </section>

        <section className="bib-how" id="how-it-works" aria-labelledby="bib-how-title"><div className="bib-how-heading"><p className="bib-eyebrow">LESS SEARCHING. MORE RUNNING.</p><h2 id="bib-how-title">A little closer to the start line.</h2></div><div className="bib-steps">
          {[{ n: "01", title: "Tell us your race", text: "Choose where you want to run and what you’re looking for. It only takes a moment." }, { n: "02", title: "We find a match", text: "When a matching opportunity becomes available, we’ll email you the details." }, { n: "03", title: "You decide", text: "Check the price and conditions. Take the next step only if it’s right for you." }].map(step => <article key={step.n}><span>{step.n}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}
        </div></section>
        <section className="bib-faq" aria-labelledby="bib-faq-title"><h2 id="bib-faq-title">Good to know.</h2><div>
          {[{ q: "Does a request guarantee an entry?", a: "No. You’re expressing interest, not reserving a place or joining an official event waiting list. Availability depends on the event, entry conditions and the opportunities we can source." }, { q: "Will I have to buy a hotel package?", a: "Only if you choose an offer that includes one. Select only ‘Bib only’ if you don’t want package offers, or select both options if you’re open to either. Some entries are available only as part of a package." }, { q: "Do I pay anything now?", a: "No. Leaving a request is free. If an opportunity becomes available, you’ll see its price and conditions before making a decision." }].map(item => <details key={item.q}><summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}
        </div></section>
      </main>
      <footer className="bib-footer"><a href="#" className="bib-wordmark">bibexchange<span>by <strong>runoot</strong></span></a><p>More start lines. More possibilities.</p><div><Link to="/privacy-policy">Privacy</Link><Link to="/contact">Contact</Link><button type="button" onClick={reopenCookieBanner}>Cookie settings</button></div><small>Independent service. Not affiliated with or endorsed by the featured races.</small></footer>
    </div>
  );
}
