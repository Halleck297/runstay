# QA Checklist — Ambassador invites + i18n email

Sessione: aprile 2026  
Aree toccate: pagina inviti ambassador, selettore lingua nei form inviti, fix `locale: null` su tutte le email transazionali.

---

## 1. Registrazione — selettore lingua

- [ ] Aprire `/register`
- [ ] Cambiare la lingua nel dropdown (es. IT → DE)
- [ ] Verificare che i testi della pagina cambino **immediatamente**, senza ricaricare e senza perdere i dati già inseriti nel form
- [ ] Completare la registrazione: la lingua scelta deve restare attiva dopo il redirect

---

## 2. Navigazione — link "Inviti" per ambassador

- [ ] Fare login con un account **ambassador**
- [ ] Aprire il menu utente (desktop: click sull'avatar; mobile: nav in basso)
- [ ] Verificare che compaia la voce **"Inviti"** (con icona busta) sopra "Impostazioni"
- [ ] Verificare che la voce **non** compaia per utenti normali o team leader

---

## 3. Pagina `/profile/invites` — ambassador

### Accesso
- [ ] URL `/profile/invites` accessibile solo per ambassador (gli altri vengono reindirizzati a `/profile`)

### Form invio
- [ ] Il form mostra un campo email e un selettore lingua
- [ ] Il selettore lingua parte con la lingua preferita dell'ambassador (se impostata)
- [ ] Inviare un invito a un'email valida non ancora registrata → messaggio di successo verde
- [ ] Il campo email si svuota dopo il successo

### Errori
- [ ] Email non valida → errore `"Email non valida"`
- [ ] Email già registrata su Runoot → errore `"Email già registrata"`
- [ ] Email già riservata da **qualsiasi** TL o ambassador → errore `"Email già riservata"` (verificare anche cross-ruolo: TL che invita email già presa da un ambassador, e viceversa)

### Lista inviti
- [ ] Gli inviti inviati compaiono nella lista sotto il form
- [ ] Badge **"In attesa"** per inviti non ancora accettati
- [ ] Badge **"Accettato"** dopo che l'utente si è registrato tramite il link

---

## 4. Email invito ambassador — template

- [ ] Ricevere l'email di invito ambassador
- [ ] Il mittente mostra il nome corretto (es. "Jonathan Mazzantini"), **senza** la scritta `[Ambassador]` o parentesi
- [ ] Oggetto: `"Jonathan Mazzantini invited you to join Runoot"` (o traduzione corretta nella lingua scelta)
- [ ] Il corpo non mostra tag HTML come testo grezzo (es. `&lt;strong&gt;`)
- [ ] Il pulsante CTA porta al link `/join/<token>` corretto
- [ ] Testare almeno in EN e IT per verificare la traduzione

---

## 5. TL Dashboard — form inviti email (`/tl-dashboard/referrals`)

### Selettore lingua
- [ ] Il form "Invita per email" mostra un selettore lingua tra i pulsanti aggiungi/rimuovi e il pulsante Invia
- [ ] Il selettore parte con la lingua preferita del team leader
- [ ] Cambiando la lingua e inviando gli inviti, le email arrivano nella lingua selezionata

### Invio batch
- [ ] Invitare 1 email → successo, modal di conferma
- [ ] Invitare più email → conteggio corretto nel modal
- [ ] Reinvia invito (pulsante nella lista "Riservate") → email arriva in lingua del TL (non più in inglese forzato)

---

## 6. Email transazionali — fix `locale: null`

Verificare che nessuna email arrivi in inglese forzato quando il destinatario ha una lingua preferita impostata.

| Template | Trigger | Lingua attesa |
|---|---|---|
| `referral_invite` | TL invia invito batch | Lingua selezionata nel form |
| `referral_invite` | TL reinvia invito | Lingua preferita del TL |
| `referral_invite` | Admin crea nuovo utente (`/admin/users/new`) | EN (nessun profilo ancora) |
| `referral_invite` | Admin reinvia invito (`/admin/users`) | EN (nessun profilo ancora) |
| `ambassador_invite` | Ambassador invia invito | Lingua selezionata nel form |
| `account_setup` | Admin crea account TO (`/admin/to-accounts/new`) | EN (nuovo utente) |
| `account_setup` | Admin approva access request | EN (nuovo utente) |

---

## 7. Smoke test generale post-deploy

- [ ] Login/logout funzionano
- [ ] Listing browse e detail non sono rotti
- [ ] Messaggistica funziona
- [ ] Profile settings salvano correttamente
- [ ] TL dashboard carica senza errori
- [ ] Nessun errore 500 nei log Vercel/Supabase
