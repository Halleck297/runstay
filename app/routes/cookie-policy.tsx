import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Cookie Policy | Runoot" },
    { name: "description", content: "Informativa sui cookie di Runoot - Scopri come utilizziamo i cookie e come gestire le tue preferenze." },
  ];
};

export default function CookiePolicy() {
  const lastUpdated = "29 Gennaio 2025";
  const websiteUrl = "https://runstay.vercel.app";
  const companyEmail = "privacy@runoot.com"; // Da personalizzare

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <a href="/" className="text-brand-600 hover:text-brand-700 text-sm">
            ← Torna alla Home
          </a>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Cookie Policy</h1>
          <p className="text-gray-500 mt-2">Ultimo aggiornamento: {lastUpdated}</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          
          {/* Introduzione */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introduzione</h2>
            <p className="text-gray-700 leading-relaxed">
              La presente Cookie Policy descrive come <strong>Runoot</strong> (di seguito "noi", "nostro" o "Sito") 
              utilizza i cookie e tecnologie simili quando visiti il nostro sito web disponibile all'indirizzo{" "}
              <a href={websiteUrl} className="text-brand-600 hover:underline">{websiteUrl}</a>.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Questa policy è conforme al Regolamento (UE) 2016/679 (GDPR), alla Direttiva ePrivacy 2002/58/CE 
              e successive modifiche, nonché alle Linee Guida del Garante Privacy italiano sui cookie.
            </p>
          </section>

          {/* Cosa sono i cookie */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Cosa sono i Cookie</h2>
            <p className="text-gray-700 leading-relaxed">
              I cookie sono piccoli file di testo che vengono memorizzati sul tuo dispositivo (computer, tablet 
              o smartphone) quando visiti un sito web. I cookie permettono al sito di riconoscerti e ricordare 
              le tue preferenze (come la lingua, le dimensioni dei caratteri e altre impostazioni di visualizzazione) 
              per un determinato periodo di tempo.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              I cookie possono essere "di sessione" (temporanei, eliminati alla chiusura del browser) o "persistenti" 
              (rimangono sul dispositivo per un periodo definito o fino alla loro cancellazione manuale).
            </p>
          </section>

          {/* Tipologie di cookie */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Tipologie di Cookie Utilizzati</h2>
            
            {/* Cookie Tecnici */}
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">3.1 Cookie Tecnici Necessari</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Questi cookie sono essenziali per il funzionamento del Sito e non possono essere disattivati. 
                Vengono impostati in risposta ad azioni da te effettuate, come l'impostazione delle preferenze 
                sulla privacy, l'accesso o la compilazione di moduli.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Nome Cookie</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Fornitore</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Scopo</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Durata</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">sb-*-auth-token</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Supabase</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">
                        Gestione dell'autenticazione e della sessione utente. Necessario per mantenere 
                        l'utente connesso e garantire la sicurezza dell'account.
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Sessione / 1 anno</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">sb-*-auth-token-code-verifier</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Supabase</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">
                        Verifica del codice durante il flusso di autenticazione OAuth (PKCE).
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Sessione</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">__session</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Runoot</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">
                        Cookie di sessione per memorizzare le informazioni dell'utente durante la navigazione.
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Sessione</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">cookie_consent</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Runoot</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">
                        Memorizza le tue preferenze sui cookie per non mostrare nuovamente il banner.
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">12 mesi</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <p className="text-gray-600 text-sm mt-3 italic">
                Base giuridica: Art. 6(1)(f) GDPR - Legittimo interesse per il funzionamento del servizio.
              </p>
            </div>

            {/* Cookie di Terze Parti */}
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-3">3.2 Cookie di Terze Parti per l'Autenticazione</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Se scegli di accedere tramite Google, verranno utilizzati cookie di terze parti necessari 
                per completare il processo di autenticazione OAuth.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Nome Cookie</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Fornitore</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Scopo</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Privacy Policy</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Vari cookie Google</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Google Ireland Ltd</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">
                        Autenticazione tramite Google OAuth 2.0. Utilizzati solo se scegli di accedere con Google.
                      </td>
                      <td className="border border-gray-200 px-4 py-3">
                        <a 
                          href="https://policies.google.com/privacy" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:underline"
                        >
                          Privacy Policy Google
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <p className="text-gray-600 text-sm mt-3 italic">
                Base giuridica: Art. 6(1)(a) GDPR - Consenso esplicito (attivato dalla scelta dell'utente di accedere con Google).
              </p>
            </div>

            {/* Cookie Analytics (se attivi) */}
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-3">3.3 Cookie Analitici (Opzionali)</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Potremmo utilizzare cookie analitici per comprendere come i visitatori interagiscono con il Sito. 
                Questi cookie raccolgono informazioni in forma aggregata e anonima.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Nome Cookie</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Fornitore</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Scopo</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Durata</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">_vercel_*</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Vercel Inc.</td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">
                        Analytics di base per monitorare le prestazioni del sito (se Vercel Analytics è attivo).
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-gray-700">Sessione</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <p className="text-gray-600 text-sm mt-3 italic">
                Base giuridica: Art. 6(1)(a) GDPR - Consenso. Questi cookie vengono installati solo previo tuo consenso.
              </p>
            </div>
          </section>

          {/* Gestione dei cookie */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Come Gestire i Cookie</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">4.1 Banner dei Cookie</h3>
                <p className="text-gray-700 leading-relaxed">
                  Al primo accesso al Sito, ti verrà mostrato un banner che ti permette di accettare o rifiutare 
                  i cookie non necessari. Puoi modificare le tue preferenze in qualsiasi momento cliccando sul 
                  link "Gestisci Cookie" presente nel footer del sito.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">4.2 Impostazioni del Browser</h3>
                <p className="text-gray-700 leading-relaxed">
                  Puoi anche gestire i cookie attraverso le impostazioni del tuo browser. Di seguito i link 
                  alle istruzioni dei principali browser:
                </p>
                <ul className="mt-3 space-y-2">
                  <li>
                    <a 
                      href="https://support.google.com/chrome/answer/95647" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      → Google Chrome
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://support.mozilla.org/it/kb/protezione-antitracciamento-avanzata-firefox-desktop" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      → Mozilla Firefox
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      → Safari
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      → Microsoft Edge
                    </a>
                  </li>
                </ul>
                <p className="text-gray-600 text-sm mt-4 italic">
                  Nota: La disabilitazione dei cookie tecnici necessari potrebbe compromettere il funzionamento 
                  di alcune parti del Sito.
                </p>
              </div>
            </div>
          </section>

          {/* Trasferimento dati */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Trasferimento dei Dati</h2>
            <p className="text-gray-700 leading-relaxed">
              Alcuni dei nostri fornitori di servizi potrebbero essere situati al di fuori dell'Unione Europea. 
              In tali casi, ci assicuriamo che il trasferimento dei dati avvenga in conformità con il GDPR, 
              attraverso:
            </p>
            <ul className="mt-3 space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Clausole contrattuali standard approvate dalla Commissione Europea
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Decisioni di adeguatezza della Commissione Europea
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                EU-US Data Privacy Framework (per fornitori statunitensi certificati)
              </li>
            </ul>
            
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Fornitore</th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Sede</th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-medium text-gray-900">Meccanismo di Trasferimento</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-4 py-3 text-gray-700">Supabase Inc.</td>
                    <td className="border border-gray-200 px-4 py-3 text-gray-700">USA</td>
                    <td className="border border-gray-200 px-4 py-3 text-gray-700">EU-US Data Privacy Framework / SCCs</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-4 py-3 text-gray-700">Vercel Inc.</td>
                    <td className="border border-gray-200 px-4 py-3 text-gray-700">USA</td>
                    <td className="border border-gray-200 px-4 py-3 text-gray-700">EU-US Data Privacy Framework / SCCs</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-4 py-3 text-gray-700">Google Ireland Ltd</td>
                    <td className="border border-gray-200 px-4 py-3 text-gray-700">Irlanda (UE)</td>
                    <td className="border border-gray-200 px-4 py-3 text-gray-700">N/A (all'interno dell'UE)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Diritti dell'utente */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. I Tuoi Diritti</h2>
            <p className="text-gray-700 leading-relaxed">
              In conformità con il GDPR, hai il diritto di:
            </p>
            <ul className="mt-3 space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <strong>Accesso:</strong> ottenere informazioni sui dati che trattiamo
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <strong>Rettifica:</strong> correggere dati inesatti o incompleti
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <strong>Cancellazione:</strong> richiedere la cancellazione dei tuoi dati
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <strong>Limitazione:</strong> limitare il trattamento dei tuoi dati
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <strong>Portabilità:</strong> ricevere i tuoi dati in formato strutturato
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <strong>Opposizione:</strong> opporti al trattamento basato sul legittimo interesse
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <strong>Revoca del consenso:</strong> ritirare il consenso in qualsiasi momento
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Per esercitare questi diritti, contattaci all'indirizzo:{" "}
              <a href={`mailto:${companyEmail}`} className="text-brand-600 hover:underline">
                {companyEmail}
              </a>
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Hai inoltre il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali:{" "}
              <a 
                href="https://www.garanteprivacy.it" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                www.garanteprivacy.it
              </a>
            </p>
          </section>

          {/* Titolare del trattamento */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Titolare del Trattamento</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700">
                <strong>Runoot</strong><br />
                {/* Personalizza con i tuoi dati */}
                [Inserire Ragione Sociale]<br />
                [Inserire Indirizzo]<br />
                [Inserire Partita IVA / Codice Fiscale]<br />
                Email: <a href={`mailto:${companyEmail}`} className="text-brand-600 hover:underline">{companyEmail}</a>
              </p>
            </div>
          </section>

          {/* Modifiche alla policy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Modifiche alla Cookie Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              Ci riserviamo il diritto di modificare questa Cookie Policy in qualsiasi momento. Eventuali 
              modifiche saranno pubblicate su questa pagina con indicazione della data di ultimo aggiornamento. 
              Ti invitiamo a consultare periodicamente questa pagina per rimanere informato sulle nostre pratiche 
              relative ai cookie.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              In caso di modifiche sostanziali, ti informeremo tramite un avviso ben visibile sul nostro Sito 
              o, ove possibile, via email.
            </p>
          </section>

          {/* Contatti */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Contatti</h2>
            <p className="text-gray-700 leading-relaxed">
              Per qualsiasi domanda relativa a questa Cookie Policy o al trattamento dei tuoi dati personali, 
              puoi contattarci a:
            </p>
            <div className="mt-4 bg-brand-50 rounded-lg p-4 border border-brand-200">
              <p className="text-gray-700">
                📧 Email: <a href={`mailto:${companyEmail}`} className="text-brand-600 hover:underline font-medium">{companyEmail}</a>
              </p>
            </div>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <a href="/privacy" className="hover:text-brand-600">Privacy Policy</a>
          <span className="mx-2">•</span>
          <a href="/terms" className="hover:text-brand-600">Termini di Servizio</a>
          <span className="mx-2">•</span>
          <a href="/" className="hover:text-brand-600">Torna alla Home</a>
        </div>
      </main>
    </div>
  );
}
