import type { ReactNode } from "react";
import { Link } from "react-router";
import { BxFooter, BxHeader } from "./BxChrome";

export { links } from "./BxChrome";

export default function BibInfoLayout({ eyebrow, title, intro, children }: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return <div className="bib-page bx-page bx-info bib-info-page" lang="en">
    <BxHeader>
      <Link className="bx-nav-link" to="/#how-it-works">How it works</Link>
      <Link className="bx-nav-link" to="/#faq">FAQ</Link>
      <Link className="bx-pill" to="/offer-entry">Sell your bib</Link>
    </BxHeader>
    <main className="bib-info-main">
      <div className="bib-info-intro">
        <p className="bib-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="bib-info-lead">{intro}</p>
      </div>
      {children}
    </main>
    <BxFooter />
  </div>;
}
