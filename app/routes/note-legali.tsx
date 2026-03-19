import type { MetaFunction } from "react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";

export const meta: MetaFunction = () => {
  return [
    { title: "Note Legali | Runoot" },
    { name: "description", content: "Note legali del sito Runoot." },
    { name: "robots", content: "index,follow" },
    { tagName: "link", rel: "canonical", href: "https://www.runoot.com/note-legali" },
  ];
};

export default function NoteLegaliPage() {
  return <LegalDocumentPage forcedKey="legal-notes" forcedLocale="it" />;
}
