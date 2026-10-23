import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useFetcher, useActionData, useLocation } from "react-router";
import type { submitBibRequest } from "~/lib/bib-requests.server";
import { bibRaces, BIB_CONSENT_TEXT, MAX_CUSTOM_RACES } from "~/lib/bib-requests";
import { trackEvent } from "~/lib/analytics/client";
import { bibRequestSource } from "~/lib/bib-requests";
import MailingListOffer from "./MailingListOffer";
import { BxFooter, BxHeader, BxTopo } from "./BxChrome";
export { links } from "./BxChrome";

const listedRaces = bibRaces.filter(item => item.name !== "Another race");
const tickerCities = ["Tokyo", "London", "New York", "Chicago", "Sydney", "Cape Town", "Cardiff", "Your next race"];
const faq = [
  { q: "Does a request guarantee an entry?", a: "No. You’re expressing interest, not reserving a place or joining an official event waiting list. Availability depends on the event, entry conditions and the opportunities we can source." },
  { q: "Do I pay anything now?", a: "No. Leaving a request is free. If an opportunity becomes available, you’ll see its price and conditions before making a decision." },
  { q: "Will I have to buy a hotel package?", a: "Only if you choose an offer that includes one. Select only ‘Bib only’ if you don’t want package offers, or select both if you’re open to either. Packages have much more availability, so selecting both gives you the best chance." },
  { q: "Why do you recommend the full package?", a: "Many entries are available only as part of a bib + hotel package. Choosing the full package gives you much more availability than bib only, and the best chance of getting a place." },
  { q: "Why do you ask for my WhatsApp number?", a: "It’s optional. We use it only to reach you quickly when a last-minute place comes up, in case our email ends up in spam." },
  { q: "My race isn’t listed. Can I still ask?", a: `Yes. Choose ‘Another race’, type the race name and press OK. You can add up to ${MAX_CUSTOM_RACES} races that aren’t on the list.` },
  { q: "Who checks the organizer’s transfer rules?", a: "BibExchange helps sellers and runners find each other. Checking and following the organizer’s transfer rules and deadlines is the responsibility of the seller and the buyer." },
  { q: "I can’t run my race. Can I sell my bib here?", a: "Yes. Tell us about your entry and we’ll review the details. Your offer is a private report, not a public listing. Following the organizer’s transfer rules is up to you and the buyer." },
];
const preferenceOptions = [
  { value: "package", title: "Full package (bib + hotel)", text: "Much more availability than bib only. Your best chance of getting a place.", badge: "Best availability" },
  { value: "bib", title: "Bib only", text: "Fewer entries available on their own." },
];
type CustomRace = { name: string; code: string; selected: boolean };
const raceCode = (name: string) => name.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "RUN";

export default function BibLanding() {
  const { pathname, search } = useLocation();
  const isQr = /^\/go\/?$/.test(pathname);
  const oldMailingLink = new URLSearchParams(search).get("mailing") === "old-link";
  const [races, setRaces] = useState<string[]>([]);
  const [customRaces, setCustomRaces] = useState<CustomRace[]>([]);
  const [anotherOpen, setAnotherOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [preferences, setPreferences] = useState<string[]>(["package"]);
  const [selectionError, setSelectionError] = useState("");
  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  const fetcher = useFetcher<typeof submitBibRequest>();
  const actionData = useActionData<typeof submitBibRequest>();
  const result = fetcher.data ?? actionData;
  const [dismissed, setDismissed] = useState(false);
  const complete = !dismissed && fetcher.state === "idle" && result?.success === true;
  const submitting = fetcher.state !== "idle";
  const customFull = customRaces.length >= MAX_CUSTOM_RACES;
  const customInput = useRef<HTMLInputElement>(null);
  const trackedResult = useRef<unknown>(null);
  useEffect(() => {
    if (complete && result !== trackedResult.current) {
      trackedResult.current = result;
      trackEvent("generate_lead", {
        landing_source: bibRequestSource(window.location.pathname),
        race: result.races.length > 1 ? "Multiple races" : listedRaces.some(item => item.name === result.races[0]) ? result.races[0] : "Another race",
        preference: result.preference,
      });
    }
  }, [complete, result]);
  const confirmation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (complete) confirmation.current?.focus();
  }, [complete]);
  useEffect(() => {
    if (anotherOpen) customInput.current?.focus();
  }, [anotherOpen]);

  // Each confirmed name becomes its own selected race box; "Another race" closes again.
  const addCustomRace = () => {
    const name = customName.trim().replace(/\s+/g, " ");
    if (name.length < 2) { setSelectionError("Type the race name, then press OK."); customInput.current?.focus(); return; }
    const listed = listedRaces.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (listed) setRaces(current => current.includes(listed.name) ? current : [...current, listed.name]);
    else if (customRaces.some(item => item.name.toLowerCase() === name.toLowerCase())) setCustomRaces(current => current.map(item => item.name.toLowerCase() === name.toLowerCase() ? { ...item, selected: true } : item));
    else if (!customFull) setCustomRaces(current => [...current, { name, code: raceCode(name), selected: true }]);
    setCustomName("");
    setAnotherOpen(false);
    setSelectionError("");
  };
  const onCustomKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { event.preventDefault(); addCustomRace(); }
  };
  const resetRequest = () => {
    setDismissed(true); setRaces([]); setCustomRaces([]); setAnotherOpen(false); setCustomName(""); setSelectionError("");
  };

  return (
    <div className={`bib-page bx-page ${isQr ? "bx-qr" : "bx-home"}`} lang="en">
      <BxHeader homeHref="#">
        <a className="bx-nav-link" href="#how-it-works">How it works</a>
        <a className="bx-nav-link" href="#faq">FAQ</a>
        {!isQr && <Link className="bx-pill" to="/offer-entry">Sell your bib</Link>}
      </BxHeader>

      <main>
        {!isQr && <section className="bx-hero" aria-label="Find or sell a bib">
          <div className="bx-door bx-door-run">
            <div className="bx-run-grid">
              <div className="bx-run-copy">
                <p className="bx-kicker"><b>RUNNERS</b> I want to run</p>
                <h1 className="bx-cond">The race is on your list. <span>Let’s find your bib.</span></h1>
                <p className="bx-lead">Tokyo on your mind? New York on your bucket list? Tell us where you want to run. We’ll contact you when a matching opportunity becomes available.</p>
                <a className="bx-btn bx-btn-run" href="#request">Find my bib <span className="bx-arrow" aria-hidden="true">→</span></a>
              </div>
              <div className="bx-bib" aria-hidden="true">
                <span className="bx-pin" /><span className="bx-pin" /><span className="bx-pin" /><span className="bx-pin" />
                <div className="bx-bib-band"><strong>BIBEXCHANGE</strong><span>MARATHON</span></div>
                <b className="bx-bib-number">00000</b>
                <div className="bx-bib-row"><span>YOUR NEXT RACE</span><span>42.195 KM</span></div>
              </div>
            </div>
          </div>
          <div className="bx-door bx-door-sell">
            <p className="bx-kicker"><b>SELLERS</b> I can’t run</p>
            <h2 className="bx-cond">Plans changed? <span>Sell your bib.</span></h2>
            <p className="bx-lead">Tell us about your entry. We review it before any matching.</p>
            <Link className="bx-btn bx-btn-sell" to="/offer-entry">Sell your bib <span aria-hidden="true">→</span></Link>
            <p className="bx-note">Free. Not a public listing.</p>
          </div>
        </section>}

        <div className="bx-ticker" aria-hidden="true"><div>
          {[...tickerCities, ...tickerCities].map((city, i) => <span key={i}>{city} <i>●</i></span>)}
        </div></div>

        <section className="bx-request" id="request" aria-labelledby="request-title">
          <BxTopo />
          <div className="bx-request-head">
            <div><p className="bx-eyebrow">LET’S MAKE IT HAPPEN</p><h2 id="request-title" className="bx-cond">Where do you want to run?</h2></div>
            <div><p>Select one or more races. We’ll keep an eye out and email you when a matching opportunity becomes available.</p><ul className="bx-facts"><li>Free to request</li><li>No account needed</li></ul></div>
          </div>

          {complete ? (
            <div className="bx-confirmation-card">
              <div className="bib-confirmation" ref={confirmation} tabIndex={-1}>
                <span className="bib-check" aria-hidden="true">✓</span>
                <p className="bib-eyebrow">YOU’RE AT THE NEXT STEP</p>
                <h2>{result.races.join(", ")}.<br />Got it.</h2>
                <p>Your request is on our list. We’ll contact you by email when a matching opportunity becomes available, with the price and conditions before you decide.</p>
                {result.confirmationEmail === "sent" && <p role="status">We’ve also sent you a confirmation email. If you don’t see it, check your spam folder.</p>}
                {result.confirmationEmail === "failed" && <p role="status">Your request is saved, but we couldn’t send the confirmation email. If you need a copy, please try again later or contact <a href="mailto:support@runoot.com">support@runoot.com</a>.</p>}
                <div className="bib-demo-note">An entry is not reserved or guaranteed. To withdraw your request, contact <a href="mailto:support@runoot.com">support@runoot.com</a>.</div>
                <button className="bib-submit" type="button" onClick={resetRequest}>Request another race</button>
                {result.mailingOffer && <MailingListOffer offer={result.mailingOffer} />}
              </div>
            </div>
          ) : (
            <fetcher.Form method="post" onSubmit={(event) => {
              const typed = anotherOpen && customName.trim().length >= 2;
              const chosen = races.length + customRaces.filter(item => item.selected).length + (typed ? 1 : 0);
              if (!chosen || !preferences.length) {
                event.preventDefault();
                setSelectionError(!chosen ? (anotherOpen ? "Type the race name, then press OK." : "Please select at least one race.") : "Please select Bib only, Full package, or both.");
                if (!chosen && anotherOpen) customInput.current?.focus();
                else event.currentTarget.querySelector<HTMLInputElement>(`input[name="${!chosen ? "race" : "preference"}"]`)?.focus();
                return;
              }
              setSelectionError("");
              setDismissed(false);
            }}>
              <div className="bib-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              {oldMailingLink && <p role="status" className="bib-demo-note">This older subscription link is no longer used. Runoot Last Minute is now activated in the popup after a race request.</p>}
              <fieldset className="bx-tiles"><legend className="bib-sr-only">Choose your races. Select one or more.</legend>
                {listedRaces.map((item, i) => <label className={`bx-tile${races.includes(item.name) ? " is-selected" : ""}`} key={item.name} htmlFor={`race-${i}`}>
                  <input id={`race-${i}`} type="checkbox" name="race" value={item.name} checked={races.includes(item.name)} onChange={() => { setRaces(current => toggle(current, item.name)); setSelectionError(""); }} />
                  <span className="bx-tile-tick" aria-hidden="true">✓</span><span className="bx-tile-code" aria-hidden="true">{item.code}</span><span className="bx-tile-name">{item.name}<small>{item.country}</small></span>
                </label>)}
                {customRaces.map((item, i) => <label className={`bx-tile${item.selected ? " is-selected" : ""}`} key={item.name} htmlFor={`custom-race-${i}`}>
                  <input id={`custom-race-${i}`} type="checkbox" name="otherRace" value={item.name} checked={item.selected} onChange={() => { setCustomRaces(current => current.map(race => race.name === item.name ? { ...race, selected: !race.selected } : race)); setSelectionError(""); }} />
                  <span className="bx-tile-tick" aria-hidden="true">✓</span><span className="bx-tile-code" aria-hidden="true">{item.code}</span><span className="bx-tile-name">{item.name}</span>
                </label>)}
                <label className={`bx-tile${anotherOpen ? " is-selected" : ""}${customFull ? " is-disabled" : ""}`} htmlFor="another-race" title={customFull ? `You can add up to ${MAX_CUSTOM_RACES} races` : undefined}>
                  <input id="another-race" type="checkbox" checked={anotherOpen} disabled={customFull} onChange={() => { setAnotherOpen(open => !open); setSelectionError(""); }} />
                  <span className="bx-tile-tick" aria-hidden="true">✓</span><span className="bx-tile-code" aria-hidden="true">+</span><span className="bx-tile-name">Another race<small>{customFull ? `Max ${MAX_CUSTOM_RACES} races` : "Your next adventure"}</small></span>
                </label>
              </fieldset>
              {anotherOpen && <div className="bx-other">
                <label htmlFor="custom-race-name">Which race?</label>
                <div className="bx-other-row">
                  <input ref={customInput} id="custom-race-name" name="otherRace" value={customName} onChange={event => setCustomName(event.target.value)} onKeyDown={onCustomKey} placeholder="e.g. Valencia" maxLength={120} enterKeyHint="done" />
                  <button type="button" onClick={addCustomRace}>OK</button>
                </div>
              </div>}

              <div className="bx-panel">
                <fieldset className="bx-pref">
                  <legend>I’m looking for <span>Select one or both.</span></legend>
                  <div className="bx-pref-opts">
                    {preferenceOptions.map(item => <label key={item.value} htmlFor={`preference-${item.value}`} className={`bx-pref-opt${item.badge ? " is-recommended" : ""}${preferences.includes(item.value) ? " is-on" : ""}`}>
                      <input id={`preference-${item.value}`} type="checkbox" name="preference" value={item.value} checked={preferences.includes(item.value)} onChange={() => { setPreferences(current => toggle(current, item.value)); setSelectionError(""); }} />
                      <span className="bx-pref-box" aria-hidden="true">✓</span><b>{item.title}</b><small>{item.text}</small>{item.badge && <span className="bx-badge">{item.badge}</span>}
                    </label>)}
                  </div>
                </fieldset>
                <div className="bx-contact">
                  <label className="bx-field">First name<input name="firstName" autoComplete="given-name" placeholder="First name" required maxLength={100} /></label>
                  <label className="bx-field">Last name<input name="lastName" autoComplete="family-name" placeholder="Last name" required maxLength={100} /></label>
                  <label className="bx-field">Email address<input type="email" name="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /></label>
                  <label className="bx-field"><span>WhatsApp <span className="bx-optional">(optional)</span></span><input type="tel" name="phone" autoComplete="tel" inputMode="tel" placeholder="+39 333 123 4567" maxLength={40} /></label>
                  <button className="bx-submit" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Notify me"}</button>
                </div>
                <p className="bx-whatsapp">Get last-minute places on WhatsApp.</p>
              </div>
              {(selectionError || (!dismissed && result?.error)) && <p role="alert" className="bib-error">{selectionError || result?.error}</p>}
              <p className="bx-legal">{BIB_CONSENT_TEXT} <Link to="/terms-of-use">Terms of use</Link> · <Link to="/privacy-policy">Privacy policy</Link> · Free to request. An entry is not reserved or guaranteed.</p>
            </fetcher.Form>
          )}
        </section>

        <section className="bx-how" id="how-it-works" aria-labelledby="how-title">
          <p className="bx-eyebrow">ONE BIB. TWO RUNNERS.</p>
          <h2 id="how-title" className="bx-cond">Find a bib. Or pass yours on.</h2>
          <div className="bx-how-grid">
            <article className="bx-track bx-track-run">
              <header><h3 className="bx-cond">Looking for a bib</h3><span>RUNNERS</span></header>
              <ol>
                <li data-km="START"><strong>Tell us your race</strong><span>Choose where you want to run and what you’re looking for. It only takes a moment.</span></li>
                <li data-km="21.1K"><strong>We find a match</strong><span>When a matching opportunity becomes available, we’ll email you the details.</span></li>
                <li data-km="FINISH"><strong>You decide</strong><span>Check the price and conditions. Take the next step only if it’s right for you.</span></li>
              </ol>
            </article>
            <article className="bx-track bx-track-sell">
              <header><h3 className="bx-cond">Selling your bib</h3><span>SELLERS</span></header>
              <ol>
                <li><strong>Tell us about the entry</strong><span>Include the race, the date and what you’re offering.</span></li>
                <li><strong>We review the details</strong><span>We check what can be offered before looking for a match.</span></li>
                <li><strong>We get in touch</strong><span>If there’s a possible next step, we’ll contact you by email.</span></li>
              </ol>
              <Link className="bx-btn bx-btn-sell" to="/offer-entry">Sell your bib <span aria-hidden="true">→</span></Link>
            </article>
          </div>
        </section>

        <section className="bx-faq" id="faq" aria-labelledby="faq-title">
          <h2 id="faq-title" className="bx-cond">Good to know.</h2>
          <div>{faq.map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
        </section>

        <section className="bx-band" aria-labelledby="band-title">
          <h2 id="band-title" className="bx-cond">Can’t make it to the start line?</h2>
          <Link className="bx-btn" to="/offer-entry">Sell your bib <span aria-hidden="true">→</span></Link>
        </section>
      </main>

      <BxFooter homeHref="#" />
    </div>
  );
}
