import type { ReactNode } from "react";
import { Link } from "react-router";
import { reopenCookieBanner } from "~/lib/analytics/consent";
import landingStyles from "~/styles/bib-landing.css?url";

export const links = () => [{ rel: "stylesheet", href: landingStyles }];

export default function BibInfoLayout({ eyebrow, title, intro, children }: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return <div className="bib-page bib-info-page" lang="en">
    <header className="bib-header">
      <Link to="/" className="bib-wordmark" aria-label="BibExchange by Runoot">bibexchange<span>by <strong>runoot</strong></span></Link>
      <Link to="/" className="bib-info-back">Back to race requests</Link>
    </header>
    <main className="bib-info-main">
      <div className="bib-info-intro">
        <p className="bib-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="bib-info-lead">{intro}</p>
      </div>
      {children}
    </main>
    <footer className="bib-footer">
      <Link to="/" className="bib-wordmark">bibexchange<span>by <strong>runoot</strong></span></Link>
      <p>More start lines. More possibilities.</p>
      <div><Link to="/privacy-policy">Privacy</Link><Link to="/contact">Contact</Link><button type="button" onClick={reopenCookieBanner}>Cookie settings</button></div>
      <small>Independent service. Not affiliated with or endorsed by the featured races.</small>
    </footer>
  </div>;
}
