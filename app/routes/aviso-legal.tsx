import type { MetaFunction } from "react-router";
import { LegalDocumentPage } from "~/components/LegalDocumentPage";

export const meta: MetaFunction = () => {
  return [
    { title: "Aviso Legal | Runoot" },
    { name: "description", content: "Aviso legal de Runoot." },
  ];
};

export default function AvisoLegalPage() {
  return <LegalDocumentPage forcedKey="aviso-legal" forcedLocale="es" />;
}
