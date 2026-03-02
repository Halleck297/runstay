import type { MetaFunction } from "react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";

export const meta: MetaFunction = () => {
  return [
    { title: "Impressum | Runoot" },
    { name: "description", content: "Impressum and legal notice for Runoot." },
  ];
};

export default function ImpressumPage() {
  return <LegalDocumentPage forcedKey="impressum" forcedLocale="de" />;
}
