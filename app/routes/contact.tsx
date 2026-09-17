import type { MetaFunction } from "react-router";
import { Link } from "react-router";
import BibInfoLayout from "~/components/BibInfoLayout";
export { links } from "~/components/BibInfoLayout";

export const meta: MetaFunction = () => [
  { title: "Contact | BibExchange by Runoot" },
  { name: "description", content: "Contact Runoot about your race request, available opportunities or your personal data." },
];

export default function Contact() {
  return <BibInfoLayout eyebrow="LET’S TALK" title="A question before your next start line?" intro="We’re here to help with your race request. Get in touch directly by email.">
    <div className="bib-contact-layout">
      <section className="bib-info-card bib-contact-primary" aria-labelledby="contact-email-title">
        <p className="bib-eyebrow">YOUR DIRECT LINE</p>
        <h2 id="contact-email-title">Write to Runoot.</h2>
        <a className="bib-contact-email" href="mailto:support@runoot.com">support@runoot.com</a>
        <p>Tell us which race you’re interested in and how we can help. If you’ve already sent a request, use the same email address so we can find it.</p>
        <a className="bib-submit" href="mailto:support@runoot.com?subject=BibExchange%20enquiry">Email us</a>
        <p className="bib-contact-note">Opens your email app. You can also copy the address above.</p>
      </section>
      <div className="bib-contact-topics">
        <section><p className="bib-eyebrow">01 / YOUR REQUEST</p><h2>Change your plans.</h2><p>Want to change a race or your bib/package preference? Email us the details you’d like to update.</p></section>
        <section><p className="bib-eyebrow">02 / YOUR DATA</p><h2>Stay in control.</h2><p>To stop opportunity emails or ask us to delete your request, write to the same address. Read our <Link to="/privacy-policy">privacy policy</Link> for more information.</p></section>
        <section><p className="bib-eyebrow">03 / YOUR NEXT RACE</p><h2>Looking for an entry?</h2><p>The best place to start is the <Link to="/">race request form</Link>. Leaving a request is free; an entry is not reserved or guaranteed.</p></section>
      </div>
    </div>
  </BibInfoLayout>;
}
