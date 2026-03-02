import type { MetaFunction } from "react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";

export const meta: MetaFunction = () => {
  return [
    { title: "Note Legali | Runoot" },
    { name: "description", content: "Note legali del sito Runoot." },
  ];
};

export default function NoteLegaliPage() {
  return <LegalDocumentPage forcedKey="legal-notes" forcedLocale="it" />;
}
