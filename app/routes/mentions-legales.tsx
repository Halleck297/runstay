import type { MetaFunction } from "react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";

export const meta: MetaFunction = () => {
  return [
    { title: "Mentions Legales | Runoot" },
    { name: "description", content: "Mentions legales du site Runoot." },
  ];
};

export default function MentionsLegalesPage() {
  return <LegalDocumentPage forcedKey="mentions-legales" forcedLocale="fr" />;
}
