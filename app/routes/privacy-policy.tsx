import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | Runoot" },
    { name: "description", content: "Informativa sulla privacy di Runoot - Scopri come raccogliamo, utilizziamo e proteggiamo i tuoi dati personali." },
  ];
};

export default function PrivacyPolicy() {
  const lastUpdated = "29 Gennaio 2025";
  const companyEmail = "privacy@runoot.com"; // Da personalizzare

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <a href="/" className="text-brand-600 hover:text-brand-700 text-sm">
            ← Torna alla Home
          </a>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Privacy Policy</h1>
          <p className="text-gray-500 mt-2">Ultimo aggiornamento: {lastUpdated}</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">

          {/* 1. Introduzione */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introduzione</h2>
            <p className="text-gray-700 leading-relaxed">
              La presente Privacy Policy descrive le modalità di raccolta, utilizzo e protezione dei dati personali
              degli utenti che accedono e utilizzano la piattaforma Runoot (di seguito "Piattaforma" o "Servizio"),
              accessibile all'indirizzo{" "}
              <a href="https://runoot.com" className="text-brand-600 hover:underline">runoot.com</a>.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Runoot è un marketplace che consente a tour operator e runner privati di scambiare stanze d'hotel e
              pettorali (bibs) per eventi podistici. La Piattaforma funge esclusivamente da intermediario tecnologico
              e non partecipa in alcun modo alle transazioni tra utenti.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Utilizzando la Piattaforma, l'utente dichiara di aver letto, compreso e accettato integralmente la
              presente Privacy Policy.
            </p>
          </section>

          {/* 2. Titolare del Trattamento */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Titolare del Trattamento</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700">
                <strong>Denominazione:</strong> [INSERIRE RAGIONE SOCIALE / NOME]<br />
                <strong>Sede legale:</strong> [INSERIRE INDIRIZZO COMPLETO]<br />
                <strong>P.IVA / C.F.:</strong> [INSERIRE P.IVA O CODICE FISCALE]<br />
                <strong>Email di contatto:</strong>{" "}
                <a href={`mailto:${companyEmail}`} className="text-brand-600 hover:underline">{companyEmail}</a>
              </p>
            </div>
          </section>

          {/* 3. Dati Personali Raccolti */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Dati Personali Raccolti</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              La Piattaforma raccoglie i seguenti dati personali:
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">3.1 Dati forniti volontariamente dall'utente</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-brand-600 mr-2">•</span>
                    Nome completo
                  </li>
                  <li className="flex items-start">
                    <span className="text-brand-600 mr-2">•</span>
                    Indirizzo email
                  </li>
                  <li className="flex items-start">
                    <span className="text-brand-600 mr-2">•</span>
                    Password (conservata in forma crittografata)
                  </li>
                  <li className="flex items-start">
                    <span className="text-brand-600 mr-2">•</span>
                    Tipologia di utente (Tour Operator o Private Runner)
                  </li>
                  <li className="flex items-start">
                    <span className="text-brand-600 mr-2">•</span>
                    Nome azienda (solo per Tour Operator)
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">3.2 Dati raccolti automaticamente</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-brand-600 mr-2">•</span>
                    Indirizzo IP
                  </li>
                  <li className="flex items-start">
                    <span className="text-brand-600 mr-2">•</span>
                    Tipo di browser e dispositivo
                  </li>
                  <li className="flex items-start">
                    <span className="text-brand-600 mr-2">•</span>
                    Dati di navigazione e interazione con la Piattaforma
                  </li>
                  <li className="flex items-start">
                    <span className="text-brand-600 mr-2">•</span>
                    Data e ora di accesso
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">3.3 Dati da servizi di terze parti</h3>
                <p className="text-gray-700 leading-relaxed">
                  In caso di registrazione tramite Google OAuth, la Piattaforma riceve: nome, indirizzo email e
                  immagine del profilo associati all'account Google dell'utente.
                </p>
              </div>
            </div>
          </section>

          {/* 4. Finalità del Trattamento */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Finalità del Trattamento</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              I dati personali sono trattati per le seguenti finalità:
            </p>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-medium">a)</span>
                <span><strong>Erogazione del Servizio:</strong> creazione e gestione dell'account utente, pubblicazione e visualizzazione degli annunci, facilitazione del contatto tra utenti.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-medium">b)</span>
                <span><strong>Comunicazioni di servizio:</strong> invio di notifiche tecniche, aggiornamenti sulla Piattaforma, comunicazioni relative all'account.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-medium">c)</span>
                <span><strong>Sicurezza:</strong> prevenzione di frodi, abusi e attività illecite.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-medium">d)</span>
                <span><strong>Adempimenti legali:</strong> ottemperanza a obblighi di legge o richieste delle autorità competenti.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-medium">e)</span>
                <span><strong>Analisi statistica:</strong> miglioramento della Piattaforma attraverso analisi aggregate e anonimizzate.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-medium">f)</span>
                <span><strong>Marketing (previo consenso):</strong> invio di newsletter e comunicazioni promozionali, solo se l'utente ha espresso il proprio consenso esplicito.</span>
              </li>
            </ul>
          </section>

          {/* 5. Base Giuridica del Trattamento */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Base Giuridica del Trattamento</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Il trattamento dei dati personali si fonda sulle seguenti basi giuridiche ai sensi dell'art. 6 del GDPR:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Esecuzione del contratto:</strong> il trattamento è necessario per fornire il Servizio richiesto dall'utente.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Consenso:</strong> per l'invio di comunicazioni di marketing e l'utilizzo di cookie non essenziali.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Obbligo legale:</strong> per adempiere a obblighi previsti dalla normativa vigente.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Legittimo interesse:</strong> per garantire la sicurezza della Piattaforma e prevenire frodi.</span>
              </li>
            </ul>
          </section>

          {/* 6. Cookie e Tecnologie di Tracciamento */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Cookie e Tecnologie di Tracciamento</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">6.1 Cookie tecnici (essenziali)</h3>
                <p className="text-gray-700 leading-relaxed">
                  La Piattaforma utilizza cookie tecnici strettamente necessari per il funzionamento del Servizio.
                  Questi cookie non richiedono il consenso dell'utente e includono: cookie di sessione, cookie di
                  autenticazione, cookie per le preferenze di navigazione (es. lingua, tema).
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">6.2 Cookie analitici (previo consenso)</h3>
                <p className="text-gray-700 leading-relaxed">
                  La Piattaforma potrà utilizzare Google Analytics per analizzare l'utilizzo del Servizio in forma
                  aggregata. Tali cookie saranno installati solo previo consenso esplicito dell'utente tramite il
                  banner cookie. L'utente può modificare le proprie preferenze in qualsiasi momento.
                </p>
                <p className="text-gray-700 leading-relaxed mt-2">
                  Per maggiori informazioni su Google Analytics, si rimanda alla{" "}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    privacy policy di Google
                  </a>.
                </p>
              </div>
            </div>
          </section>

          {/* 7. Condivisione dei Dati con Terze Parti */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Condivisione dei Dati con Terze Parti</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              I dati personali possono essere comunicati a:
            </p>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Supabase Inc.:</strong> fornitore dei servizi di database e autenticazione. I server possono essere ubicati negli Stati Uniti. Supabase aderisce ai meccanismi di trasferimento dati previsti dal GDPR.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Vercel Inc.:</strong> fornitore dei servizi di hosting. I server possono essere ubicati negli Stati Uniti e in altre giurisdizioni. Vercel aderisce ai meccanismi di trasferimento dati previsti dal GDPR.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Google LLC:</strong> per il servizio di autenticazione OAuth e, previo consenso, per Google Analytics.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Autorità competenti:</strong> quando richiesto dalla legge o per tutelare i diritti del Titolare.</span>
              </li>
            </ul>
            <div className="mt-4 p-4 bg-brand-50 rounded-lg border border-brand-200">
              <p className="text-gray-700 font-medium">
                I dati personali non saranno mai venduti a terzi.
              </p>
            </div>
          </section>

          {/* 8. Trasferimento dei Dati Extra-UE */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Trasferimento dei Dati Extra-UE</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Alcuni dei fornitori di servizi indicati al punto 7 hanno sede al di fuori dell'Unione Europea, in
              particolare negli Stati Uniti. Il trasferimento dei dati avviene in conformità al GDPR mediante:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Decisioni di adeguatezza della Commissione Europea (es. EU-US Data Privacy Framework)
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Clausole Contrattuali Standard (SCC) approvate dalla Commissione Europea
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Altre garanzie appropriate previste dall'art. 46 del GDPR
              </li>
            </ul>
          </section>

          {/* 9. Periodo di Conservazione dei Dati */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Periodo di Conservazione dei Dati</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              I dati personali sono conservati per il tempo strettamente necessario al perseguimento delle finalità indicate:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Dati dell'account:</strong> fino alla cancellazione dell'account da parte dell'utente o fino a 2 anni di inattività.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Dati di navigazione:</strong> massimo 12 mesi.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Dati per obblighi legali:</strong> per il periodo previsto dalla normativa applicabile.</span>
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Al termine del periodo di conservazione, i dati saranno cancellati o resi anonimi in modo irreversibile.
            </p>
          </section>

          {/* 10. Diritti dell'Interessato */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Diritti dell'Interessato</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Ai sensi degli artt. 15-22 del GDPR, l'utente ha il diritto di:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Accesso:</strong> ottenere conferma dell'esistenza di un trattamento e accedere ai propri dati.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Rettifica:</strong> ottenere la correzione di dati inesatti o l'integrazione di dati incompleti.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Cancellazione:</strong> ottenere la cancellazione dei propri dati nei casi previsti dalla legge.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Limitazione:</strong> ottenere la limitazione del trattamento nei casi previsti dalla legge.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Portabilità:</strong> ricevere i propri dati in un formato strutturato e trasferirli a un altro titolare.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Opposizione:</strong> opporsi al trattamento per motivi legittimi.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <span><strong>Revoca del consenso:</strong> revocare in qualsiasi momento il consenso prestato, senza pregiudicare la liceità del trattamento effettuato prima della revoca.</span>
              </li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Per esercitare tali diritti, l'utente può contattare il Titolare all'indirizzo email indicato al punto 2.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              L'utente ha inoltre il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati
              Personali:{" "}
              <a
                href="https://www.garanteprivacy.it"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                www.garanteprivacy.it
              </a>.
            </p>
          </section>

          {/* 11. Età Minima */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Età Minima</h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>La Piattaforma è destinata esclusivamente a utenti che abbiano compiuto 18 anni di età.</strong>{" "}
                Registrandosi, l'utente dichiara e garantisce di avere almeno 18 anni.
              </p>
              <p className="text-gray-700 leading-relaxed mt-3">
                Il Titolare non raccoglie consapevolmente dati personali di minori. Qualora venisse a conoscenza di
                una registrazione effettuata da un minore, il Titolare provvederà tempestivamente alla cancellazione
                dei relativi dati.
              </p>
            </div>
          </section>

          {/* 12. Ruolo della Piattaforma e Limitazione di Responsabilità */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Ruolo della Piattaforma e Limitazione di Responsabilità</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-gray-700 leading-relaxed font-medium">
                IMPORTANTE: Runoot opera esclusivamente come piattaforma tecnologica di intermediazione che consente
                agli utenti di pubblicare annunci e mettersi in contatto tra loro.
              </p>
            </div>

            <p className="text-gray-700 leading-relaxed mb-4 font-medium">
              La Piattaforma NON:
            </p>
            <ul className="space-y-2 text-gray-700 mb-6">
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Partecipa, media o garantisce le transazioni tra utenti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Gestisce pagamenti o trasferimenti di denaro tra utenti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Verifica l'identità, l'affidabilità o la solvibilità degli utenti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Garantisce la disponibilità, qualità o legittimità degli annunci pubblicati
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Verifica la conformità del trasferimento di pettorali ai regolamenti delle singole gare
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Fornisce servizi di prenotazione alberghiera o organizzazione di viaggi
              </li>
            </ul>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>Le transazioni avvengono direttamente tra utenti, con metodi di pagamento scelti autonomamente
                dalle parti coinvolte.</strong> Il Titolare declina ogni responsabilità per:
              </p>
              <ul className="space-y-2 text-gray-700 mt-4">
                <li className="flex items-start">
                  <span className="text-gray-400 mr-2">•</span>
                  Eventuali controversie, inadempimenti o danni derivanti dalle transazioni tra utenti
                </li>
                <li className="flex items-start">
                  <span className="text-gray-400 mr-2">•</span>
                  La veridicità, completezza o accuratezza delle informazioni fornite dagli utenti
                </li>
                <li className="flex items-start">
                  <span className="text-gray-400 mr-2">•</span>
                  Perdite economiche derivanti da transazioni non andate a buon fine
                </li>
                <li className="flex items-start">
                  <span className="text-gray-400 mr-2">•</span>
                  Violazioni dei regolamenti delle gare podistiche da parte degli utenti
                </li>
                <li className="flex items-start">
                  <span className="text-gray-400 mr-2">•</span>
                  Eventuali frodi, truffe o comportamenti illeciti perpetrati da utenti della Piattaforma
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4 italic">
                Gli utenti riconoscono e accettano che ogni transazione effettuata attraverso contatti ottenuti tramite
                la Piattaforma è di loro esclusiva responsabilità. Si raccomanda agli utenti di adottare tutte le
                precauzioni necessarie prima di effettuare pagamenti o scambi.
              </p>
            </div>
          </section>

          {/* 13. Newsletter e Comunicazioni di Marketing */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">13. Newsletter e Comunicazioni di Marketing</h2>
            <p className="text-gray-700 leading-relaxed">
              L'utente può acconsentire a ricevere comunicazioni di marketing e newsletter da parte del Titolare.
              Tale consenso è facoltativo e può essere revocato in qualsiasi momento tramite:
            </p>
            <ul className="space-y-2 text-gray-700 mt-4">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Il link di disiscrizione presente in ogni comunicazione
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Le impostazioni del proprio account
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Contattando il Titolare all'indirizzo email indicato al punto 2
              </li>
            </ul>
          </section>

          {/* 14. Misure di Sicurezza */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">14. Misure di Sicurezza</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Il Titolare adotta misure tecniche e organizzative appropriate per proteggere i dati personali da
              accessi non autorizzati, perdita, distruzione o alterazione, tra cui:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Crittografia delle password
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Connessioni HTTPS protette
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Controlli di accesso ai sistemi
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Backup periodici dei dati
              </li>
            </ul>
          </section>

          {/* 15. Modifiche alla Privacy Policy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">15. Modifiche alla Privacy Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              Il Titolare si riserva il diritto di modificare la presente Privacy Policy in qualsiasi momento.
              Le modifiche saranno comunicate agli utenti tramite pubblicazione sulla Piattaforma e, per modifiche
              sostanziali, tramite email.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              L'uso continuato della Piattaforma dopo la pubblicazione delle modifiche costituisce accettazione delle stesse.
            </p>
          </section>

          {/* 16. Contatti */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">16. Contatti</h2>
            <p className="text-gray-700 leading-relaxed">
              Per qualsiasi domanda, richiesta o comunicazione relativa alla presente Privacy Policy o al trattamento
              dei dati personali, l'utente può contattare il Titolare all'indirizzo email:
            </p>
            <div className="mt-4 bg-brand-50 rounded-lg p-4 border border-brand-200">
              <p className="text-gray-700">
                Email: <a href={`mailto:${companyEmail}`} className="text-brand-600 hover:underline font-medium">{companyEmail}</a>
              </p>
            </div>
          </section>

          {/* 17. Legge Applicabile e Foro Competente */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">17. Legge Applicabile e Foro Competente</h2>
            <p className="text-gray-700 leading-relaxed">
              La presente Privacy Policy è regolata dalla legge italiana e dal Regolamento (UE) 2016/679 (GDPR).
              Per qualsiasi controversia sarà competente il Foro di [INSERIRE CITTÀ], salvo diversa disposizione
              inderogabile di legge.
            </p>
          </section>

          {/* Footer documento */}
          <div className="pt-6 border-t border-gray-200">
            <p className="text-gray-500 text-sm italic text-center">
              Documento redatto in conformità al Regolamento (UE) 2016/679 (GDPR)
            </p>
          </div>

        </div>

        {/* Footer links */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <a href="/cookie-policy" className="hover:text-brand-600">Cookie Policy</a>
          <span className="mx-2">•</span>
          <a href="/terms" className="hover:text-brand-600">Termini di Servizio</a>
          <span className="mx-2">•</span>
          <a href="/" className="hover:text-brand-600">Torna alla Home</a>
        </div>
      </main>
    </div>
  );
}
