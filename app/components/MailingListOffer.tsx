import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import type { action } from "~/routes/api.mailing-list.subscribe";

const sessionKey = "runoot-last-minute-prompt-shown";

export default function MailingListOffer({ offer }: { offer: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = useRef(false);
  const [closed, setClosed] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const complete = fetcher.data?.success && !busy;
  useEffect(() => {
    if (closed) return;
    if (!shown.current) {
      try { if (sessionStorage.getItem(sessionKey)) return; sessionStorage.setItem(sessionKey, "1"); } catch { /* Still show once in this page when storage is unavailable. */ }
      shown.current = true;
    }
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); previousFocus?.focus(); };
  }, [closed]);
  const close = () => { dialog.current?.close(); setClosed(true); };
  return <><button type="button" className="bib-mailing-decline" onClick={() => { shown.current = true; setClosed(false); dialog.current?.showModal(); }}>Get last-minute updates by email</button><dialog ref={dialog} className="bib-mailing-dialog" aria-labelledby="last-minute-title" aria-describedby="last-minute-description" onCancel={() => setClosed(true)}>
    <button type="button" className="bib-mailing-close" aria-label="Close mailing list invitation" onClick={close}>×</button>
    <p className="bib-eyebrow">YOUR REQUEST IS SAVED</p>
    <h2 id="last-minute-title">{complete ? "Check your inbox." : "Want last-minute updates?"}</h2>
    <p id="last-minute-description">{complete ? "We’ve sent a link to confirm your subscription. Once confirmed, you’ll receive Runoot Last Minute updates by email." : "One mailing list for last-minute bibs, hotel stays and race packages — across all races and destinations."}</p>
    {complete ? <button className="bib-submit" type="button" onClick={close}>Got it</button> : <fetcher.Form method="post" action="/api/mailing-list/subscribe">
      <input type="hidden" name="offer" value={offer} /><input type="hidden" name="consent" value="yes" />
      {fetcher.data?.error && <p role="alert" className="bib-error">{fetcher.data.error}</p>}
      <button className="bib-submit" disabled={busy}>{busy ? "Sending confirmation…" : "Yes, keep me updated"}</button>
      <button className="bib-mailing-decline" type="button" onClick={close}>No, thanks</button>
      <p className="bib-form-note">We’ll ask you to confirm your email. Optional. Unsubscribe anytime. <Link to="/privacy-policy">Privacy policy</Link></p>
    </fetcher.Form>}
  </dialog></>;
}
