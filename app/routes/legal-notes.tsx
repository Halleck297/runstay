import type { MetaFunction } from "react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";

export const meta: MetaFunction = () => {
  return [
    { title: "Legal Notes | Runoot" },
    { name: "description", content: "Legal notes for Runoot." },
    { name: "robots", content: "index,follow" },
    { tagName: "link", rel: "canonical", href: "https://www.runoot.com/legal-notes" },
  ];
};

export default function LegalNotesPage() {
  return <LegalDocumentPage forcedKey="legal-notes" />;
}
