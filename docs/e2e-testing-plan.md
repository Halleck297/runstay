# E2E Testing Plan — Runoot Exchange

**Data**: 2026-04-07
**Stato**: Da implementare

---

## Obiettivo

Configurare test end-to-end con **Playwright** + **Supabase Local** + **GitHub Actions** per verificare automaticamente che le pagine e i flow principali funzionino ad ogni push/PR.

---

## Stack

| Tool | Ruolo |
|------|-------|
| **Playwright** | Test runner E2E — apre un browser vero, naviga, clicca, verifica |
| **Supabase CLI** (`supabase start`) | Database + Auth locale via Docker, applica migrazioni |
| **Seed script** | Popola il DB locale con utenti e dati di test |
| **GitHub Actions** | CI — esegue tutto automaticamente su push/PR |

---

## Prerequisiti

- Docker installato (confermato)
- Supabase CLI (`brew install supabase/tap/supabase` se non presente)
- Node.js (già presente)

---

## Setup da fare

### 1. Supabase Local

```bash
supabase init          # crea supabase/ config dir (se non esiste)
supabase start         # avvia Postgres, Auth, Storage, ecc. in Docker
supabase db reset      # applica tutte le migrazioni da /migrations
```

- Le migrazioni esistenti in `/migrations` vengono applicate automaticamente
- Genera `.env.test` con URL e chiavi locali (diversi da produzione)

### 2. Playwright

```bash
npm install -D @playwright/test
npx playwright install  # scarica browser binaries
```

Config file: `playwright.config.ts`
- Base URL: `http://localhost:5173`
- Progetti: Chromium (default), opzionalmente Firefox/Safari
- Timeout globale: 30s
- Screenshot on failure: sì
- Web server: avvia `npm run dev` automaticamente

### 3. Seed Data

Script: `supabase/seed.sql` oppure `scripts/seed-test-data.ts`

Utenti di test con credenziali fisse:

| Ruolo | Email | Password |
|-------|-------|----------|
| Superadmin | `admin@test.runoot.local` | `TestAdmin123!` |
| Team Leader | `tl@test.runoot.local` | `TestTL123!` |
| Tour Operator | `to@test.runoot.local` | `TestTO123!` |
| Private user | `user@test.runoot.local` | `TestUser123!` |

Dati aggiuntivi:
- 1-2 eventi
- 2-3 listing (mix room/bib/room_and_bib)
- 1 conversazione con messaggi

### 4. GitHub Action

File: `.github/workflows/e2e.yml`

```yaml
trigger: push + pull_request
steps:
  1. Checkout code
  2. Setup Node.js
  3. Install dependencies (npm ci)
  4. Setup Supabase CLI
  5. supabase start
  6. supabase db reset (applica migrazioni + seed)
  7. Crea .env con chiavi locali
  8. Install Playwright browsers
  9. Run Playwright tests
  10. Upload test report come artifact
```

---

## Test da scrivere (Fase 1 — Flow critici)

### Navigazione base
- [ ] Homepage carica senza errori
- [ ] Pagina listings carica e mostra listing
- [ ] Pagina dettaglio listing carica
- [ ] Pagina 404 funziona

### Auth
- [ ] Login con credenziali corrette → redirect a dashboard
- [ ] Login con credenziali errate → mostra errore
- [ ] Logout funziona
- [ ] Accesso a /dashboard senza login → redirect a /login

### Admin
- [ ] Admin vede lista utenti
- [ ] Admin crea invito (tipo private, TL, TO)
- [ ] Admin vede pending invites
- [ ] Admin resend invite
- [ ] Admin revoke invite
- [ ] Admin cambia categoria utente

### Listings
- [ ] Utente crea un nuovo listing
- [ ] Listing appare nella lista
- [ ] Filtri funzionano

### Messaggi
- [ ] Utente apre conversazione da listing
- [ ] Messaggio viene inviato e appare nella chat

---

## Test da scrivere (Fase 2 — Espansione futura)

- [ ] Onboarding completo via /join/:token
- [ ] TL dashboard: invio inviti, referral link
- [ ] TO dashboard (quando implementato)
- [ ] Admin: gestione listing (approve/reject)
- [ ] Mobile responsive (viewport ridotto)
- [ ] Multi-lingua (cambio locale)

---

## Cosa NON testare

- **Invio email reale** — mockare il servizio email nei test (env var o intercept)
- **Twilio OTP** — bypassare la verifica telefono nei test (env var `SKIP_PHONE_VERIFICATION=true`)
- **Google OAuth** — non testabile in E2E senza mock complessi
- **Pagamenti** — non implementati

---

## Struttura file prevista

```
runoot-exchange/
├── supabase/
│   ├── config.toml         # Config Supabase local
│   └── seed.sql             # Seed data per test
├── e2e/
│   ├── fixtures/
│   │   └── auth.ts          # Helper login riutilizzabile
│   ├── pages.spec.ts        # Test navigazione
│   ├── auth.spec.ts         # Test login/logout
│   ├── admin.spec.ts        # Test admin panel
│   ├── listings.spec.ts     # Test listings
│   └── messages.spec.ts     # Test messaggi
├── playwright.config.ts
├── .github/
│   └── workflows/
│       └── e2e.yml
└── .env.test                # Env per test locali (non committato)
```

---

## Note

- I test E2E sono lenti (~1-3 min per suite). Non sostituiscono test unitari ma coprono i flow utente reali.
- `supabase start` richiede Docker con ~2GB RAM.
- Per lo sviluppo locale: `npx playwright test --ui` apre un'interfaccia visuale per debug.
- Playwright genera automaticamente screenshot e video dei test falliti → utili per debug.
