import type { ReactNode } from "react";
import { Link } from "react-router";
import landingStyles from "~/styles/bib-landing.css?url";
import homeStyles from "~/styles/bib-home.css?url";
import { reopenCookieBanner } from "~/lib/analytics/consent";

export const links = () => [
  { rel: "stylesheet", href: landingStyles },
  { rel: "stylesheet", href: homeStyles },
  { rel: "preload", href: "/fonts/archivo-variable-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" as const },
];

// Faded contour lines behind poster sections.
const contours = [
  ...Array.from({ length: 12 }, (_, i) => ({ cx: 980 + i * 6, cy: 150 - i * 3, rx: 50 + i * 46, ry: (50 + i * 46) * (0.52 + (i % 3) * 0.04), rotate: `rotate(${-14 + i * 1.5} 980 150)` })),
  ...Array.from({ length: 9 }, (_, i) => ({ cx: 120 + i * 6, cy: 640 - i * 3, rx: 50 + i * 46, ry: (50 + i * 46) * (0.52 + (i % 3) * 0.04), rotate: `rotate(${18 + i * 1.5} 120 640)` })),
];

export function BxTopo() {
  return <svg className="bx-topo" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.4">{contours.map((ring, i) => <ellipse key={i} cx={ring.cx} cy={ring.cy} rx={ring.rx} ry={ring.ry} transform={ring.rotate} />)}</g>
  </svg>;
}

// homeHref is "#" on the home itself, "/" everywhere else.
export function BxHeader({ homeHref = "/", children }: { homeHref?: string; children: ReactNode }) {
  return <header className="bx-head">
    {homeHref === "/" ? <Link to="/" className="bx-wordmark" aria-label="BibExchange by Runoot">bibexchange<span>by <strong>runoot</strong></span></Link>
      : <a href={homeHref} className="bx-wordmark" aria-label="BibExchange by Runoot">bibexchange<span>by <strong>runoot</strong></span></a>}
    <nav className="bx-nav" aria-label="Main">{children}</nav>
  </header>;
}

export function BxFooter({ homeHref = "/" }: { homeHref?: string }) {
  return <footer className="bx-foot">
    <div className="bx-foot-grid">
      <div className="bx-foot-brand">
        {homeHref === "/" ? <Link to="/" className="bx-wordmark">bibexchange<span>by <strong>runoot</strong></span></Link>
          : <a href={homeHref} className="bx-wordmark">bibexchange<span>by <strong>runoot</strong></span></a>}
        <p>More start lines. More possibilities.</p>
      </div>
      <nav className="bx-foot-links" aria-label="Footer">
        <p className="bx-foot-title">Info</p>
        <Link to="/offer-entry">Sell your bib</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/privacy-policy">Privacy</Link>
        <Link to="/terms-of-use">Terms of use</Link>
        <button type="button" onClick={reopenCookieBanner}>Cookie settings</button>
      </nav>
      <div className="bx-foot-social">
        <p className="bx-foot-title">Follow us</p>
        <a className="bx-instagram" href="https://www.instagram.com/thebibexchange/" target="_blank" rel="noreferrer" aria-label="BibExchange on Instagram, @thebibexchange">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" /></svg>
          <span>@thebibexchange</span>
        </a>
        <a className="bx-trustpilot" href="https://www.trustpilot.com/review/runoot.com" target="_blank" rel="noreferrer" aria-label="Read our reviews on Trustpilot">
          <span className="bx-trustpilot-head"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#00b67a" d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7L12 17.6 5.8 21.2l1.6-7L2 9.5l7.1-.6z" /></svg>Trustpilot</span>
          <span className="bx-stars" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <span className="bx-trustpilot-cta">Read our reviews</span>
        </a>
      </div>
    </div>
    <div className="bx-foot-bottom">
      <small>Independent service. Not affiliated with or endorsed by the featured races.</small>
      <small>© 2026 Runoot</small>
    </div>
  </footer>;
}
