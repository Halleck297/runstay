import type { MetaFunction } from "react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";

export const meta: MetaFunction = () => {
  return [
    { title: "Aviso Legal | Runoot" },
    { name: "description", content: "Aviso legal de Runoot." },
    { name: "robots", content: "index,follow" },
    { tagName: "link", rel: "canonical", href: "https://www.runoot.com/aviso-legal" },
  ];
};

export default function AvisoLegalPage() {
  return <LegalDocumentPage forcedKey="aviso-legal" forcedLocale="es" />;
}
