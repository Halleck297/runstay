import type { MetaFunction } from "react-router";
import { useI18n } from "~/hooks/useI18n";

export const meta: MetaFunction = () => {
  return [
    { title: "Termini e Condizioni | Runoot" },
    { name: "description", content: "Termini e Condizioni di utilizzo della piattaforma Runoot - Leggi attentamente prima di utilizzare il servizio." },
  ];
};

export default function TermsOfService() {
  const lastUpdated = "29 Gennaio 2025";
  const companyEmail = "legal@runoot.com"; // Da personalizzare
  const { locale, t } = useI18n();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <a href="/" className="text-brand-600 hover:text-brand-700 text-sm">
            ← {t("legal.back_home")}
          </a>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">{t("legal.terms.title")}</h1>
          <p className="text-gray-500 mt-2">{t("legal.last_updated")}: {lastUpdated}</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {locale !== "it" && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">{t("legal.notice_title")}</p>
            <p className="mt-1">{t("legal.notice_body")}</p>
          </div>
        )}
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">

          {/* Avviso importante */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-bold text-red-800 mb-3">AVVISO IMPORTANTE - LEGGERE ATTENTAMENTE</h2>
            <p className="text-red-700 leading-relaxed">
              Runoot è esclusivamente una piattaforma di annunci che mette in contatto utenti interessati allo scambio
              di stanze d'hotel e pettorali per eventi podistici. <strong>Runoot NON partecipa, media, garantisce o
              supervisiona in alcun modo le transazioni tra utenti.</strong> Tutte le transazioni avvengono direttamente
              tra le parti coinvolte, a loro esclusivo rischio e responsabilità.
            </p>
          </div>

          {/* 1. Accettazione dei Termini */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Accettazione dei Termini</h2>
            <p className="text-gray-700 leading-relaxed">
              I presenti Termini e Condizioni di Utilizzo (di seguito "Termini") regolano l'accesso e l'utilizzo della
              piattaforma Runoot (di seguito "Piattaforma" o "Servizio"), accessibile all'indirizzo{" "}
              <a href="https://runoot.com" className="text-brand-600 hover:underline">runoot.com</a>.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              <strong>Utilizzando la Piattaforma, l'utente dichiara di aver letto, compreso e accettato integralmente
              i presenti Termini.</strong> Se non si accettano i Termini, è necessario astenersi dall'utilizzo della
              Piattaforma.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              La registrazione e l'utilizzo della Piattaforma costituiscono accettazione vincolante dei presenti Termini,
              della Privacy Policy e della Cookie Policy.
            </p>
          </section>

          {/* 2. Definizioni */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Definizioni</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-bold">•</span>
                <span><strong>"Piattaforma"</strong>: il sito web Runoot e tutti i servizi ad esso correlati.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-bold">•</span>
                <span><strong>"Titolare"</strong>: il soggetto che gestisce la Piattaforma, come identificato nei documenti legali.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-bold">•</span>
                <span><strong>"Utente"</strong>: qualsiasi persona fisica o giuridica che accede o utilizza la Piattaforma.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-bold">•</span>
                <span><strong>"Tour Operator"</strong>: utente registrato come operatore professionale nel settore turistico.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-bold">•</span>
                <span><strong>"Privato" o "Private Runner"</strong>: utente registrato come individuo non professionale.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-bold">•</span>
                <span><strong>"Annuncio" o "Listing"</strong>: inserzione pubblicata da un utente per offrire stanze d'hotel, pettorali o pacchetti combinati.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-bold">•</span>
                <span><strong>"Pettorale" o "Bib"</strong>: numero di gara che consente la partecipazione a un evento podistico.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-bold">•</span>
                <span><strong>"Venditore"</strong>: utente che pubblica un annuncio per cedere stanze, pettorali o pacchetti.</span>
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2 font-bold">•</span>
                <span><strong>"Acquirente"</strong>: utente interessato ad acquisire quanto offerto in un annuncio.</span>
              </li>
            </ul>
          </section>

          {/* 3. Natura del Servizio */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Natura del Servizio</h2>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-gray-700 leading-relaxed font-medium">
                Runoot è una piattaforma di annunci classificati che consente agli utenti di pubblicare offerte relative
                a stanze d'hotel e pettorali per eventi podistici (maratone, mezze maratone, trail, ecc.) e di entrare
                in contatto tra loro.
              </p>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">3.1 Cosa fa Runoot</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Fornisce uno spazio dove pubblicare annunci di stanze d'hotel e pettorali
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Consente agli utenti di cercare e visualizzare annunci
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Permette agli utenti di contattarsi tramite sistema di messaggistica interno
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                Offre strumenti di traduzione automatica dei messaggi
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">3.2 Cosa NON fa Runoot</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                NON partecipa, media o garantisce le transazioni tra utenti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                NON gestisce, processa o trasferisce pagamenti tra utenti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                NON verifica l'identità, l'affidabilità, la solvibilità o la buona fede degli utenti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                NON garantisce la disponibilità, qualità, legittimità o veridicità degli annunci
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                NON verifica la conformità del trasferimento dei pettorali ai regolamenti delle gare
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                NON fornisce servizi di prenotazione alberghiera o agenzia di viaggi
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                NON offre servizi di escrow, deposito a garanzia o protezione acquirenti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                NON interviene in caso di dispute, controversie o inadempimenti tra utenti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                NON fornisce rimborsi, risarcimenti o compensazioni di alcun tipo
              </li>
            </ul>
          </section>

          {/* 4. Registrazione e Account */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Registrazione e Account</h2>

            <h3 className="text-lg font-medium text-gray-900 mb-3">4.1 Requisiti</h3>
            <p className="text-gray-700 leading-relaxed">
              Per utilizzare la Piattaforma è necessario:
            </p>
            <ul className="space-y-2 text-gray-700 mt-3">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Aver compiuto 18 anni di età
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Possedere la capacità legale di stipulare contratti vincolanti
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Fornire informazioni veritiere e complete durante la registrazione
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Mantenere aggiornate le informazioni del proprio account
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">4.2 Tipologie di Account</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              La Piattaforma prevede due tipologie di account:
            </p>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Tour Operator</h4>
                <p className="text-gray-700 mt-2">
                  Account destinato a professionisti del settore turistico. Consente di pubblicare annunci con
                  quantità illimitate di stanze e pettorali e di utilizzare tutte le modalità di trasferimento disponibili.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Privato (Private Runner)</h4>
                <p className="text-gray-700 mt-2">
                  Account destinato a individui non professionisti. Limitato a massimo 1 stanza e 1 pettorale per annuncio.
                  Il trasferimento dei pettorali deve avvenire esclusivamente tramite la procedura ufficiale dell'organizzatore
                  della gara.
                </p>
              </div>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">4.3 Responsabilità dell'Account</h3>
            <p className="text-gray-700 leading-relaxed">
              L'utente è l'unico responsabile della sicurezza del proprio account e della password. Qualsiasi attività
              svolta tramite l'account è imputabile all'utente titolare. In caso di accesso non autorizzato, l'utente
              deve notificarlo immediatamente al Titolare.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">4.4 Verifica degli Account</h3>
            <p className="text-gray-700 leading-relaxed">
              Il Titolare si riserva la facoltà, a propria esclusiva discrezione, di verificare gli account e assegnare
              un badge "Verificato". Tale verifica è puramente discrezionale e <strong>non costituisce in alcun modo
              garanzia di affidabilità, solvibilità o buona fede dell'utente</strong>. L'assenza del badge di verifica
              non implica che l'utente sia inaffidabile.
            </p>
          </section>

          {/* 5. Pubblicazione degli Annunci */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Pubblicazione degli Annunci</h2>

            <h3 className="text-lg font-medium text-gray-900 mb-3">5.1 Tipologie di Annunci</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              La Piattaforma consente la pubblicazione di tre tipologie di annunci:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <strong>Solo Stanza:</strong> offerta di prenotazione alberghiera in prossimità di un evento podistico
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <strong>Solo Pettorale:</strong> offerta di numero di gara (bib) per un evento podistico
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                <strong>Stanza + Pettorale:</strong> pacchetto combinato
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">5.2 Obblighi del Venditore</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Pubblicando un annuncio, il Venditore dichiara e garantisce che:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">a)</span>
                Le informazioni fornite sono veritiere, accurate e complete
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">b)</span>
                Ha la piena e legittima disponibilità di quanto offerto
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">c)</span>
                La cessione è conforme alle leggi applicabili e ai regolamenti degli organizzatori
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">d)</span>
                Non sta violando diritti di terzi o obblighi contrattuali
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">e)</span>
                Aggiornerà tempestivamente l'annuncio in caso di variazioni o indisponibilità
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">5.3 Contenuti Vietati</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              È vietato pubblicare annunci che:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Contengano informazioni false, ingannevoli o fuorvianti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Offrano prodotti o servizi illegali o non autorizzati
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Violino i regolamenti degli organizzatori degli eventi
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Contengano contenuti offensivi, discriminatori o inappropriati
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Promuovano attività fraudolente o schemi truffaldini
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Includano dati personali di terzi senza consenso
              </li>
            </ul>
          </section>

          {/* 6. Trasferimento dei Pettorali */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Trasferimento dei Pettorali - Avvertenze Importanti</h2>

            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 leading-relaxed font-medium">
                ATTENZIONE: Il trasferimento dei pettorali (numeri di gara) è soggetto ai regolamenti specifici di
                ciascun evento podistico. Molti organizzatori VIETANO o limitano severamente il trasferimento dei pettorali.
                È ESCLUSIVA RESPONSABILITÀ degli utenti verificare e rispettare tali regolamenti.
              </p>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-3">6.1 Rischi del Trasferimento Non Autorizzato</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Correre con un pettorale intestato ad altra persona senza autorizzazione ufficiale può comportare:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Squalifica immediata dalla gara
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Annullamento del risultato e del tempo
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Ban permanente dalle future edizioni dell'evento
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Problemi assicurativi in caso di infortuni
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Conseguenze legali in determinate giurisdizioni
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">6.2 Modalità di Trasferimento</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              La Piattaforma prevede le seguenti modalità di trasferimento:
            </p>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Procedura Ufficiale (Consigliata)</h4>
                <p className="text-gray-700 mt-2">
                  Il trasferimento avviene attraverso la procedura ufficiale dell'organizzatore della gara (cambio nome).
                  <strong> Questa è l'UNICA modalità disponibile per gli utenti Privati.</strong>
                </p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Pacchetto (Solo Tour Operator)</h4>
                <p className="text-gray-700 mt-2">
                  Il pettorale è incluso in un pacchetto turistico completo gestito dal Tour Operator.
                </p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Da Concordare (Solo Tour Operator)</h4>
                <p className="text-gray-700 mt-2">
                  Le modalità di trasferimento vengono concordate direttamente tra le parti.
                </p>
              </div>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">6.3 Esclusione di Responsabilità</h3>
            <p className="text-gray-700 leading-relaxed">
              <strong>Runoot declina ogni responsabilità</strong> per trasferimenti di pettorali non conformi ai regolamenti
              degli organizzatori, per le conseguenze derivanti dall'utilizzo non autorizzato di pettorali, e per qualsiasi
              sanzione, squalifica, infortunio o danno che ne possa derivare.
            </p>
          </section>

          {/* 7. Transazioni tra Utenti */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Transazioni tra Utenti</h2>

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-gray-700 leading-relaxed font-medium">
                TUTTE LE TRANSAZIONI AVVENGONO DIRETTAMENTE TRA GLI UTENTI, SENZA ALCUN COINVOLGIMENTO DI RUNOOT.
                Il Titolare non è parte delle transazioni e non ha alcun controllo su di esse.
              </p>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-3">7.1 Pagamenti</h3>
            <p className="text-gray-700 leading-relaxed">
              I pagamenti avvengono direttamente tra Venditore e Acquirente, con le modalità da loro liberamente concordate.
              Runoot NON gestisce, processa, trattiene o trasferisce denaro in alcun modo. Gli utenti sono gli unici
              responsabili della scelta dei metodi di pagamento e dei rischi ad essi connessi.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">7.2 Raccomandazioni di Sicurezza</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Prima di effettuare qualsiasi pagamento, si raccomanda vivamente di:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Verificare l'identità della controparte attraverso canali indipendenti
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Richiedere documentazione comprovante la disponibilità di quanto offerto
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Per i pettorali: attendere la conferma ufficiale del cambio nome da parte dell'organizzatore
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Per le stanze: ottenere conferma scritta dall'hotel del cambio di intestazione
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Utilizzare metodi di pagamento tracciabili che offrano protezione (es. PayPal Beni e Servizi)
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Diffidare di richieste di pagamento urgenti o con metodi non tracciabili
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Conservare tutta la documentazione e le comunicazioni
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">7.3 Dispute tra Utenti</h3>
            <p className="text-gray-700 leading-relaxed">
              In caso di controversie tra utenti relative a transazioni, <strong>Runoot non interverrà e non potrà
              essere chiamato a mediare, arbitrare o risolvere la disputa</strong>. Gli utenti dovranno risolvere
              qualsiasi controversia direttamente tra loro o attraverso i canali legali appropriati.
            </p>
          </section>

          {/* 8. Sistema di Messaggistica */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Sistema di Messaggistica</h2>

            <h3 className="text-lg font-medium text-gray-900 mb-3">8.1 Utilizzo Consentito</h3>
            <p className="text-gray-700 leading-relaxed">
              Il sistema di messaggistica interno è destinato esclusivamente alla comunicazione tra utenti in relazione
              agli annunci pubblicati sulla Piattaforma.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">8.2 Utilizzo Vietato</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              È vietato utilizzare il sistema di messaggistica per:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Inviare spam, messaggi pubblicitari non richiesti o catene
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Molestare, minacciare o intimidire altri utenti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Tentare truffe, phishing o altre attività fraudolente
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Condividere contenuti illegali, offensivi o inappropriati
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">✕</span>
                Raccogliere dati personali di altri utenti
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">8.3 Blocco e Segnalazione</h3>
            <p className="text-gray-700 leading-relaxed">
              Gli utenti possono bloccare altri utenti e segnalare comportamenti inappropriati. Il Titolare si riserva
              il diritto di esaminare le segnalazioni e adottare i provvedimenti ritenuti opportuni, inclusa la
              sospensione o eliminazione degli account.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">8.4 Traduzione Automatica</h3>
            <p className="text-gray-700 leading-relaxed">
              La Piattaforma offre un servizio di traduzione automatica dei messaggi. Tale servizio è fornito "così com'è"
              e il Titolare non garantisce l'accuratezza delle traduzioni. In caso di discrepanze, fa fede il messaggio
              nella lingua originale.
            </p>
          </section>

          {/* 9. Proprietà Intellettuale */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Proprietà Intellettuale</h2>

            <h3 className="text-lg font-medium text-gray-900 mb-3">9.1 Diritti del Titolare</h3>
            <p className="text-gray-700 leading-relaxed">
              Tutti i diritti di proprietà intellettuale relativi alla Piattaforma (marchi, loghi, design, software,
              contenuti originali) sono di proprietà esclusiva del Titolare o dei suoi licenzianti. Nessun diritto
              viene trasferito all'utente oltre alla licenza limitata di utilizzo della Piattaforma.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">9.2 Contenuti degli Utenti</h3>
            <p className="text-gray-700 leading-relaxed">
              L'utente mantiene i diritti sui contenuti da lui pubblicati, ma concede al Titolare una licenza non
              esclusiva, gratuita, mondiale e perpetua per utilizzare, riprodurre, modificare e visualizzare tali
              contenuti ai fini del funzionamento della Piattaforma.
            </p>
          </section>

          {/* 10. Limitazione di Responsabilità */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Limitazione di Responsabilità</h2>

            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 leading-relaxed font-medium">
                LA PRESENTE SEZIONE CONTIENE IMPORTANTI LIMITAZIONI DI RESPONSABILITÀ. SI PREGA DI LEGGERLA ATTENTAMENTE.
              </p>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-3">10.1 Esclusione Generale</h3>
            <p className="text-gray-700 leading-relaxed">
              Nella misura massima consentita dalla legge applicabile, il Titolare NON è responsabile per:
            </p>
            <ul className="space-y-2 text-gray-700 mt-3">
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Danni diretti, indiretti, incidentali, speciali, consequenziali o punitivi derivanti dall'utilizzo della Piattaforma
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Perdite economiche, mancato guadagno, perdita di opportunità o danni alla reputazione
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Transazioni tra utenti, inclusi inadempimenti, truffe, frodi o comportamenti illeciti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Veridicità, accuratezza, completezza o legalità degli annunci e delle informazioni fornite dagli utenti
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Conformità degli annunci o delle transazioni alle leggi applicabili o ai regolamenti degli organizzatori
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Infortuni, incidenti o danni alla salute durante eventi podistici
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Squalifiche, ban o sanzioni inflitte da organizzatori di eventi
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                Problemi assicurativi derivanti dall'utilizzo non autorizzato di pettorali
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">10.2 Servizio "Così Com'è"</h3>
            <p className="text-gray-700 leading-relaxed">
              La Piattaforma è fornita "così com'è" e "come disponibile", senza garanzie di alcun tipo, esplicite o
              implicite, incluse garanzie di commerciabilità, idoneità per uno scopo particolare o non violazione.
              Il Titolare non garantisce che la Piattaforma sia priva di errori, sicura o sempre disponibile.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">10.3 Limitazione Quantitativa</h3>
            <p className="text-gray-700 leading-relaxed">
              In ogni caso, qualora il Titolare fosse ritenuto responsabile, la responsabilità sarà limitata all'importo
              maggiore tra (a) le eventuali somme pagate dall'utente al Titolare nei 12 mesi precedenti l'evento che ha
              dato origine alla responsabilità, oppure (b) Euro 100,00 (cento).
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">10.4 Applicabilità</h3>
            <p className="text-gray-700 leading-relaxed">
              Le limitazioni di responsabilità si applicano indipendentemente dalla teoria legale su cui si basa la
              pretesa (contratto, illecito, negligenza, responsabilità oggettiva o altra) e anche se il Titolare è
              stato avvisato della possibilità di tali danni.
            </p>
          </section>

          {/* 11. Manleva e Indennizzo */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Manleva e Indennizzo</h2>
            <p className="text-gray-700 leading-relaxed">
              L'utente si impegna a manlevare, difendere e tenere indenne il Titolare, i suoi amministratori, dipendenti,
              collaboratori e affiliati da qualsiasi richiesta, pretesa, danno, perdita, costo, spesa (incluse le spese
              legali) derivanti da o connessi a:
            </p>
            <ul className="space-y-2 text-gray-700 mt-3">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">a)</span>
                L'utilizzo della Piattaforma da parte dell'utente
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">b)</span>
                La violazione dei presenti Termini da parte dell'utente
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">c)</span>
                La violazione di leggi o diritti di terzi da parte dell'utente
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">d)</span>
                I contenuti pubblicati dall'utente sulla Piattaforma
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">e)</span>
                Le transazioni effettuate dall'utente con altri utenti
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">f)</span>
                Dispute con altri utenti o terze parti
              </li>
            </ul>
          </section>

          {/* 12. Sospensione e Terminazione */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Sospensione e Terminazione</h2>

            <h3 className="text-lg font-medium text-gray-900 mb-3">12.1 Diritti del Titolare</h3>
            <p className="text-gray-700 leading-relaxed">
              Il Titolare si riserva il diritto, a propria esclusiva discrezione e senza preavviso, di:
            </p>
            <ul className="space-y-2 text-gray-700 mt-3">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Sospendere o terminare l'accesso di qualsiasi utente alla Piattaforma
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Rimuovere qualsiasi annuncio o contenuto
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Modificare o interrompere qualsiasi funzionalità della Piattaforma
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Sospendere o terminare completamente il Servizio
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">12.2 Motivi di Sospensione o Terminazione</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Tali provvedimenti possono essere adottati, tra l'altro, in caso di:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Violazione dei presenti Termini
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Comportamenti fraudolenti, ingannevoli o illegali
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Segnalazioni da parte di altri utenti
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Richieste delle autorità competenti
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Inattività prolungata dell'account
              </li>
              <li className="flex items-start">
                <span className="text-brand-600 mr-2">•</span>
                Qualsiasi altro motivo ritenuto opportuno dal Titolare
              </li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">12.3 Cancellazione da Parte dell'Utente</h3>
            <p className="text-gray-700 leading-relaxed">
              L'utente può richiedere la cancellazione del proprio account in qualsiasi momento contattando il Titolare.
              La cancellazione comporta la rimozione degli annunci attivi e l'impossibilità di accedere ai messaggi.
              Alcune informazioni potrebbero essere conservate per obblighi di legge.
            </p>
          </section>

          {/* 13. Modifiche ai Termini */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">13. Modifiche ai Termini</h2>
            <p className="text-gray-700 leading-relaxed">
              Il Titolare si riserva il diritto di modificare i presenti Termini in qualsiasi momento. Le modifiche
              saranno pubblicate sulla Piattaforma con indicazione della data di aggiornamento. Per modifiche sostanziali,
              gli utenti registrati potranno essere informati via email.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              L'utilizzo continuato della Piattaforma dopo la pubblicazione delle modifiche costituisce accettazione
              dei nuovi Termini. Se l'utente non accetta le modifiche, deve cessare l'utilizzo della Piattaforma e
              richiedere la cancellazione del proprio account.
            </p>
          </section>

          {/* 14. Disposizioni Generali */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">14. Disposizioni Generali</h2>

            <h3 className="text-lg font-medium text-gray-900 mb-3">14.1 Intero Accordo</h3>
            <p className="text-gray-700 leading-relaxed">
              I presenti Termini, insieme alla Privacy Policy e alla Cookie Policy, costituiscono l'intero accordo
              tra l'utente e il Titolare relativamente all'utilizzo della Piattaforma e sostituiscono qualsiasi
              precedente accordo o intesa.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">14.2 Nullità Parziale</h3>
            <p className="text-gray-700 leading-relaxed">
              Se una qualsiasi disposizione dei presenti Termini fosse ritenuta invalida o inapplicabile, tale
              disposizione sarà limitata o eliminata nella misura minima necessaria, e le restanti disposizioni
              rimarranno pienamente valide ed efficaci.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">14.3 Rinuncia</h3>
            <p className="text-gray-700 leading-relaxed">
              Il mancato esercizio di un diritto o il mancato richiamo a una disposizione da parte del Titolare non
              costituisce rinuncia a tale diritto o disposizione.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-3 mt-6">14.4 Cessione</h3>
            <p className="text-gray-700 leading-relaxed">
              L'utente non può cedere o trasferire i propri diritti o obblighi derivanti dai presenti Termini senza
              il consenso scritto del Titolare. Il Titolare può cedere i propri diritti e obblighi a terzi senza
              il consenso dell'utente.
            </p>
          </section>

          {/* 15. Legge Applicabile e Foro Competente */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">15. Legge Applicabile e Foro Competente</h2>
            <p className="text-gray-700 leading-relaxed">
              I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia derivante da o
              connessa ai presenti Termini o all'utilizzo della Piattaforma sarà competente in via esclusiva il
              Foro di [INSERIRE CITTÀ], salvo diversa disposizione inderogabile di legge a tutela del consumatore.
            </p>
            <p className="text-gray-700 leading-relaxed mt-3">
              Ai sensi dell'art. 14 del Regolamento UE 524/2013, si informa che per la risoluzione delle controversie
              è possibile ricorrere alla piattaforma ODR (Online Dispute Resolution) dell'Unione Europea, accessibile
              al seguente link:{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline"
              >
                https://ec.europa.eu/consumers/odr
              </a>
            </p>
          </section>

          {/* 16. Contatti */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">16. Contatti</h2>
            <p className="text-gray-700 leading-relaxed">
              Per qualsiasi domanda, richiesta o comunicazione relativa ai presenti Termini, è possibile contattare
              il Titolare all'indirizzo:
            </p>
            <div className="mt-4 bg-brand-50 rounded-lg p-4 border border-brand-200">
              <p className="text-gray-700">
                Email: <a href={`mailto:${companyEmail}`} className="text-brand-600 hover:underline font-medium">{companyEmail}</a>
              </p>
            </div>
          </section>

          {/* Footer documento */}
          <div className="pt-6 border-t border-gray-200">
            <p className="text-gray-500 text-sm italic text-center">
              Utilizzando Runoot, l'utente conferma di aver letto, compreso e accettato i presenti Termini e Condizioni.
            </p>
          </div>

        </div>

        {/* Footer links */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <a href="/privacy-policy" className="hover:text-brand-600">{t("legal.privacy_policy")}</a>
          <span className="mx-2">•</span>
          <a href="/cookie-policy" className="hover:text-brand-600">{t("legal.cookie_policy")}</a>
          <span className="mx-2">•</span>
          <a href="/" className="hover:text-brand-600">{t("legal.back_home")}</a>
        </div>
      </main>
    </div>
  );
}
