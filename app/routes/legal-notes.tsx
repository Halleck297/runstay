import type { MetaFunction } from "react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";

export const meta: MetaFunction = () => {
  return [
    { title: "Legal Notes | Runoot" },
    { name: "description", content: "Legal notes for Runoot." },
  ];
};

export default function LegalNotesPage() {
  return <LegalDocumentPage forcedKey="legal-notes" />;
}
