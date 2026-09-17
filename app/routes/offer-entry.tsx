import { useEffect, useRef, useState } from "react";
import { Link, useActionData, useFetcher, type MetaFunction } from "react-router";
import BibInfoLayout from "~/components/BibInfoLayout";
import { BIB_OFFER_CONSENT } from "~/lib/bib-offers";
import type { submitBibOffer } from "~/lib/bib-offers.server";
export { links } from "~/components/BibInfoLayout";
export { submitBibOffer as action } from "~/lib/bib-offers.server";
export const meta: MetaFunction = () => [{ title: "Offer a bib | BibExchange by Runoot" }, { name: "description", content: "Plans changed? Tell Runoot about your race entry. We review availability and transfer conditions before matching it with runners." }];

export default function OfferEntry() {
  const [transferStatus, setTransferStatus] = useState("");
  const fetcher = useFetcher<typeof submitBibOffer>();
  const actionData = useActionData<typeof submitBibOffer>();
  const result = fetcher.data ?? actionData;
  const submitting = fetcher.state !== "idle";
  const complete = !submitting && result?.success;
  const confirmation = useRef<HTMLDivElement>(null);
  useEffect(() => { if (complete) confirmation.current?.focus(); }, [complete]);

  return <BibInfoLayout eyebrow="PLANS CHANGED?" title="Your bib. Someone else’s next start line." intro="Can’t make your race? Tell us what you can offer. We’ll review the details and contact you about the next steps.">
    <div className="bib-offer-layout">
      <aside className="bib-offer-explainer"><p className="bib-eyebrow">HOW IT WORKS</p><h2>A little detail.<br />A possible new start.</h2><ol><li><strong>Tell us about the entry.</strong><span>Include the race, date and any transfer conditions you know.</span></li><li><strong>We review the details.</strong><span>We check what can be offered before looking for a match.</span></li><li><strong>We get in touch.</strong><span>If there’s a possible next step, we’ll contact you by email.</span></li></ol><p>This is a private availability report. It is not a public listing or a guaranteed sale. Any transfer must follow the organizer’s rules.</p></aside>
      <div className="bib-info-card bib-offer-form">
        {complete ? <div className="bib-confirmation" ref={confirmation} tabIndex={-1}><span className="bib-check" aria-hidden="true">✓</span><h2>Your offer is on our list.</h2><p>We’ll review the entry and contact you if we need more details or can suggest a next step. Your offer has not been published, and no sale or transfer has been approved.</p><Link className="bib-submit" to="/">Back to BibExchange</Link></div> : <fetcher.Form method="post">
          <div className="bib-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <h2>Tell us about your entry.</h2><p className="bib-offer-required">Fields marked * are required.</p>
          <div className="bib-contact-grid">
            <label className="bib-field">Race name *<input name="race" placeholder="e.g. Valencia" required minLength={2} maxLength={120} /></label>
            <label className="bib-field">Race date *<input name="raceDate" type="date" required /></label>
            <label className="bib-field bib-email-field">What are you offering? *<select name="entryType" defaultValue="bib"><option value="bib">Bib only</option><option value="package">Full package (bib + hotel)</option></select></label>
            <label className="bib-field bib-email-field">How can the entry be transferred? *<select name="transferStatus" value={transferStatus} onChange={event => setTransferStatus(event.target.value)} required><option value="" disabled>Select an option</option><option value="official_transfer">The organizer allows an official transfer</option><option value="unknown">Not sure — please review</option></select></label>
            <label className="bib-field bib-email-field">Transfer / assignment deadline <span className="bib-field-optional">Optional, if known</span><input name="deadline" type="date" /></label>
            <label className="bib-field">Asking price<input name="price" type="number" min="0" max="100000" step="0.01" placeholder="e.g. 150" /></label>
            <label className="bib-field">Currency<select name="currency" defaultValue="EUR">{["EUR", "GBP", "USD", "JPY", "AUD", "CAD", "ZAR"].map(code => <option key={code} value={code}>{code}</option>)}</select></label>
            <label className="bib-field bib-email-field">Anything we should know? <span className="bib-field-optional">Optional</span><textarea name="notes" rows={4} maxLength={2000} placeholder="Transfer fees, package details, or a link to the organizer’s transfer rules. Please don’t include ID documents or booking codes." /></label>
          </div>
          <div className="bib-offer-contact"><h2>How can we reach you?</h2><div className="bib-contact-grid"><label className="bib-field">First name *<input name="firstName" autoComplete="given-name" required maxLength={100} /></label><label className="bib-field">Last name *<input name="lastName" autoComplete="family-name" required maxLength={100} /></label><label className="bib-field bib-email-field">Email address *<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /></label><label className="bib-field bib-email-field">Phone number *<input name="phone" type="tel" autoComplete="tel" placeholder="Include your country code" required maxLength={40} /></label></div></div>
          <label className="bib-consent"><input type="checkbox" name="consent" required /><span>{BIB_OFFER_CONSENT} <Link to="/privacy-policy">Privacy policy</Link></span></label>
          {result?.error && <p role="alert" className="bib-error">{result.error}</p>}
          <button className="bib-submit" disabled={submitting} type="submit">{submitting ? "Saving your offer…" : "Submit my offer"}</button>
          <p className="bib-form-note">Free to submit. No account needed. Reviewed before any matching.</p>
        </fetcher.Form>}
      </div>
    </div>
  </BibInfoLayout>;
}
