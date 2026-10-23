import { useEffect, useRef, useState } from "react";
import { Link, useActionData, useFetcher, type MetaFunction } from "react-router";
import { BxFooter, BxHeader, BxTopo } from "~/components/BxChrome";
import { BIB_OFFER_CONSENT } from "~/lib/bib-offers";
import type { submitBibOffer } from "~/lib/bib-offers.server";
export { links } from "~/components/BxChrome";
export { submitBibOffer as action } from "~/lib/bib-offers.server";
export const meta: MetaFunction = () => [{ title: "Offer a bib | BibExchange by Runoot" }, { name: "description", content: "Plans changed? Tell Runoot about your race entry. We review every offer before matching it with runners." }];

const entryOptions = [
  { value: "bib", title: "Bib only", text: "Just the race entry." },
  { value: "package", title: "Full package (bib + hotel)", text: "The entry together with a hotel booking." },
];

export default function OfferEntry() {
  const [entryType, setEntryType] = useState("bib");
  const fetcher = useFetcher<typeof submitBibOffer>();
  const actionData = useActionData<typeof submitBibOffer>();
  const result = fetcher.data ?? actionData;
  const submitting = fetcher.state !== "idle";
  const complete = !submitting && result?.success;
  const confirmation = useRef<HTMLDivElement>(null);
  useEffect(() => { if (complete) confirmation.current?.focus(); }, [complete]);

  const choice = (name: string, options: typeof entryOptions, value: string, onChange: (value: string) => void) => <div className="bx-pref-opts">
    {options.map(item => <label key={item.value} htmlFor={`${name}-${item.value}`} className={`bx-pref-opt${value === item.value ? " is-on" : ""}`}>
      <input id={`${name}-${item.value}`} type="radio" name={name} value={item.value} checked={value === item.value} onChange={() => onChange(item.value)} required />
      <span className="bx-pref-box" aria-hidden="true">✓</span><b>{item.title}</b><small>{item.text}</small>
    </label>)}
  </div>;

  return <div className="bib-page bx-page bx-info" lang="en">
    <BxHeader>
      <a className="bx-nav-link" href="#how-it-works">How it works</a>
      <Link className="bx-nav-link" to="/#faq">FAQ</Link>
      <Link className="bx-pill" to="/#request">Find a bib</Link>
    </BxHeader>

    <main>
      <section className="bx-door bx-offer-hero" aria-label="Sell your bib">
        <div className="bx-run-grid">
          <div className="bx-run-copy">
            <p className="bx-kicker"><b>SELLERS</b> I can’t run</p>
            <h1 className="bx-cond">Plans changed? <span>Sell your bib.</span></h1>
            <p className="bx-lead">Can’t make your race? Tell us what you can offer. We’ll review the details and contact you about the next steps.</p>
            <a className="bx-btn bx-btn-sell" href="#offer">Offer my entry <span aria-hidden="true">→</span></a>
            <p className="bx-note">Free. Not a public listing.</p>
          </div>
          <div className="bx-bib" aria-hidden="true">
            <span className="bx-pin" /><span className="bx-pin" /><span className="bx-pin" /><span className="bx-pin" />
            <div className="bx-bib-band"><strong>BIBEXCHANGE</strong><span>MARATHON</span></div>
            <b className="bx-bib-number">00000</b>
            <div className="bx-bib-row"><span>NEXT RUNNER</span><span>42.195 KM</span></div>
          </div>
        </div>
      </section>

      <section className="bx-request bx-offer" id="offer" aria-labelledby="offer-title">
        <BxTopo />
        <div className="bx-request-head">
          <div><p className="bx-eyebrow">YOUR BIB. SOMEONE ELSE’S START LINE.</p><h2 id="offer-title" className="bx-cond">Tell us about your entry.</h2></div>
          <div><p>Include the race, the date and what you’re offering. We review every offer before looking for a match.</p><ul className="bx-facts"><li>Free to submit</li><li>No account needed</li><li>Not a public listing</li></ul></div>
        </div>

        {complete ? <div className="bx-confirmation-card">
          <div className="bib-confirmation" ref={confirmation} tabIndex={-1}><span className="bib-check" aria-hidden="true">✓</span><h2>Your offer is on our list.</h2><p>We’ll review the entry and contact you if we need more details or can suggest a next step. Your offer has not been published, and no sale has been agreed.</p><Link className="bib-submit" to="/">Back to BibExchange</Link></div>
        </div> : <fetcher.Form method="post">
          <div className="bib-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <div className="bx-panel">
            <fieldset className="bx-pref">
              <legend>The race <span>Fields marked * are required.</span></legend>
              <div className="bx-offer-grid">
                <label className="bx-field">Race name *<input name="race" placeholder="e.g. Valencia" required minLength={2} maxLength={120} /></label>
                <label className="bx-field">Race date *<input name="raceDate" type="date" required /></label>
              </div>
            </fieldset>
            <fieldset className="bx-pref">
              <legend>What are you offering? *</legend>
              {choice("entryType", entryOptions, entryType, setEntryType)}
            </fieldset>
            <div className="bx-offer-grid">
              <label className="bx-field"><span>Transfer deadline <span className="bx-optional">(optional, if known)</span></span><input name="deadline" type="date" /></label>
              <div className="bx-field"><label htmlFor="offer-price">Asking price</label><div className="bx-money">
                <input id="offer-price" name="price" type="number" min="0" max="100000" step="0.01" placeholder="e.g. 150" />
                <select name="currency" defaultValue="EUR" aria-label="Currency">{["EUR", "GBP", "USD", "JPY", "AUD", "CAD", "ZAR"].map(code => <option key={code} value={code}>{code}</option>)}</select>
              </div></div>
              <label className="bx-field bx-span-full"><span>Anything we should know? <span className="bx-optional">(optional)</span></span><textarea name="notes" rows={4} maxLength={2000} placeholder="Package details, fees or anything else useful. Please don’t include ID documents or booking codes." /></label>
            </div>
            <div className="bx-offer-contact"><fieldset className="bx-pref">
              <legend>How can we reach you?</legend>
              <div className="bx-offer-grid">
                <label className="bx-field">First name *<input name="firstName" autoComplete="given-name" placeholder="First name" required maxLength={100} /></label>
                <label className="bx-field">Last name *<input name="lastName" autoComplete="family-name" placeholder="Last name" required maxLength={100} /></label>
                <label className="bx-field">Email address *<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /></label>
                <label className="bx-field">Phone number *<input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+39 333 123 4567" required maxLength={40} /></label>
              </div>
            </fieldset></div>
            <label className="bx-consent"><input type="checkbox" name="consent" required /><span>{BIB_OFFER_CONSENT} <Link to="/privacy-policy">Privacy policy</Link></span></label>
            <button className="bx-submit" disabled={submitting} type="submit">{submitting ? "Saving your offer…" : "Submit my offer"}</button>
          </div>
          {result?.error && <p role="alert" className="bib-error">{result.error}</p>}
          <p className="bx-legal">Free to submit. No account needed. Reviewed before any matching.</p>
        </fetcher.Form>}
      </section>

      <section className="bx-how" id="how-it-works" aria-labelledby="how-title">
        <p className="bx-eyebrow">HOW IT WORKS</p>
        <h2 id="how-title" className="bx-cond">A little detail. A possible new start.</h2>
        <div className="bx-how-grid">
          <article className="bx-track bx-track-sell">
            <header><h3 className="bx-cond">Selling your bib</h3><span>SELLERS</span></header>
            <ol>
              <li><strong>Tell us about the entry</strong><span>Include the race, the date and what you’re offering.</span></li>
              <li><strong>We review the details</strong><span>We check what can be offered before looking for a match.</span></li>
              <li><strong>We get in touch</strong><span>If there’s a possible next step, we’ll contact you by email.</span></li>
            </ol>
          </article>
          <article className="bx-track bx-track-run bx-offer-rules">
            <header><h3 className="bx-cond">Good to know</h3><span>BEFORE YOU SUBMIT</span></header>
            <ul className="bx-facts">
              <li>This is a private availability report, not a public listing.</li>
              <li>Submitting does not guarantee a sale.</li>
              <li>The seller and the buyer are responsible for following the organizer’s transfer rules.</li>
              <li>Never send ID documents or booking codes.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="bx-band" aria-labelledby="band-title">
        <h2 id="band-title" className="bx-cond">Looking for a bib instead?</h2>
        <Link className="bx-btn" to="/#request">Find my bib <span aria-hidden="true">→</span></Link>
      </section>
    </main>

    <BxFooter />
  </div>;
}
