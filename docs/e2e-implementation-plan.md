# Piano Implementazione E2E Testing — Runoot Exchange

**Data**: 2026-04-14
**Stato**: Da approvare
**Sostituisce**: `docs/e2e-testing-plan.md` (versione precedente con assunzioni errate)

---

## Obiettivo

Test end-to-end automatizzati con **Playwright** + **Supabase Local** + **GitHub Actions**.
Ad ogni push/PR, un browser vero naviga il sito, clicca, compila form, e verifica che tutto funzioni.

---

## Panoramica lavoro

| # | Blocco | File coinvolti | Complessità |
|---|--------|---------------|-------------|
| 1 | Setup Supabase locale | `supabase/config.toml`, `supabase/seed.sql` | Media |
| 2 | Bypass Twilio per test | `app/lib/twilio-verify.server.ts` | Bassa |
| 3 | Bypass Email per test | `app/lib/email/provider.resend.server.ts` | Bassa |
| 4 | Playwright config + fixtures | `playwright.config.ts`, `e2e/fixtures/auth.ts` | Media |
| 5 | Test suite (Fase 1) | `e2e/*.spec.ts` (5-6 file) | Alta |
| 6 | GitHub Actions workflow | `.github/workflows/e2e.yml` | Media |

---

## Blocco 1 — Setup Supabase Locale

### Cosa fare

```bash
supabase init                    # crea supabase/config.toml
supabase start                   # avvia Postgres + Auth + API in Docker
supabase db reset                # applica migrazioni + seed
```

### Problema: migrazioni

Il progetto ha **63 file** in `/migrations/` ma NON ha la cartella `supabase/`.
Supabase CLI cerca le migrazioni in `supabase/migrations/`.

**Soluzione**: Dopo `supabase init`, spostare (o symlink) le migrazioni:

```bash
# Opzione A: copia le migrazioni nel formato Supabase CLI
cp migrations/*.sql supabase/migrations/

# Opzione B: symlink (più pulito, una sola fonte di verità)
# Richiede che i nomi file seguano il formato YYYYMMDDHHMMSS_name.sql
```

> **Nota**: I nomi attuali (`20260114_add_bib_transfer_fields.sql`) mancano di ore/minuti/secondi.
> Supabase CLI vuole il formato `20260114000000_add_bib_transfer_fields.sql`.
> Servirà un rename batch una tantum oppure un script di copia che aggiunge `000000`.

### Schema base

Oltre alle migrazioni, serve che `supabase-schema.sql` sia applicato come primo file.
Opzione: rinominarlo `20260101000000_initial_schema.sql` e metterlo come prima migrazione.

### Seed data (`supabase/seed.sql`)

Utenti di test creati via Supabase Auth API locale:

| Ruolo | Email | Password | Note |
|-------|-------|----------|------|
| Superadmin | `admin@test.runoot.local` | `TestAdmin123!` | `role=superadmin`, `phone_verified_at` già valorizzato |
| Team Leader | `tl@test.runoot.local` | `TestTL123!` | `is_team_leader=true`, `referral_code` generato |
| Tour Operator | `to@test.runoot.local` | `TestTO123!` | `user_type=tour_operator` |
| Private | `user@test.runoot.local` | `TestUser123!` | `user_type=private` |

Dati aggiuntivi nel seed:
- 2 eventi (maratone)
- 3 listing (1 room, 1 bib, 1 room_and_bib) — status `approved`
- 1 conversazione con 2 messaggi
- 1 referral_invite pending (per testare resend/revoke)

> **Importante**: L'utente admin deve avere `phone_verified_at` già settato nel seed,
> altrimenti ogni test admin viene redirezionato a `/verify-phone` (vedi `root.tsx:40-56`).

---

## Blocco 2 — Bypass Twilio per Test

### Problema

`verify-phone.tsx` chiama `startPhoneVerification()` e `checkPhoneVerificationCode()` da
`twilio-verify.server.ts`. In ambiente test non c'è Twilio e i test admin fallirebbero.

### Soluzione

Aggiungere bypass in `app/lib/twilio-verify.server.ts`:

```typescript
// In cima al file
const E2E_MODE = process.env.E2E_TEST === "true";
const E2E_OTP_CODE = "123456"; // codice fisso per i test

export async function startPhoneVerification(phoneE164: string): Promise<void> {
  if (E2E_MODE) {
    console.log(`[e2e] Skipping Twilio verification for ${phoneE164}`);
    return;
  }
  // ... codice esistente invariato
}

export async function checkPhoneVerificationCode(phoneE164: string, code: string): Promise<boolean> {
  if (E2E_MODE) {
    return code === E2E_OTP_CODE;
  }
  // ... codice esistente invariato
}
```

**File modificato**: `app/lib/twilio-verify.server.ts`
**Env var nuova**: `E2E_TEST=true` (solo in `.env.test` e CI)
**Rischio**: Nessuno in produzione — la var non è mai settata.

---

## Blocco 3 — Bypass Email per Test

### Problema

`sendTemplatedEmail()` chiama Resend via HTTP. In test non vogliamo mandare email reali
né fallire perché mancano le API key.

### Soluzione

Aggiungere bypass in `app/lib/email/provider.resend.server.ts`:

```typescript
export async function sendWithResend(input: SendEmailInput): Promise<SendEmailResult> {
  // In E2E mode, simula invio riuscito senza chiamare Resend
  if (process.env.E2E_TEST === "true") {
    console.log(`[e2e] Email skipped → to: ${input.to}, subject: ${input.subject}`);
    return { ok: true, providerId: "e2e-mock-id" };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  // ... resto del codice invariato
}
```

**File modificato**: `app/lib/email/provider.resend.server.ts`
**Stessa env var**: `E2E_TEST=true`
**Rischio**: Nessuno — le email vengono loggate in console per debug.

### Alternativa avanzata (Fase 2)

Salvare le email "inviate" in una tabella `e2e_sent_emails` per poterle verificare nei test
(es. "verifica che dopo resend invite sia stata inviata un'email a X").
Da implementare solo se serve — per Fase 1 basta il bypass.

---

## Blocco 4 — Playwright Config + Fixtures

### Installazione

```bash
npm install -D @playwright/test
npx playwright install chromium  # solo Chromium per ora
```

### `playwright.config.ts`

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      E2E_TEST: "true",
    },
  },
});
```

> **Nota**: `webServer.env` passa `E2E_TEST=true` al dev server,
> attivando automaticamente i bypass Twilio ed Email.

### Fixture di autenticazione (`e2e/fixtures/auth.ts`)

Helper riutilizzabile per login nei test:

```typescript
import { test as base, type Page } from "@playwright/test";

// Utenti di test (devono corrispondere al seed)
export const TEST_USERS = {
  admin:    { email: "admin@test.runoot.local", password: "TestAdmin123!" },
  tl:       { email: "tl@test.runoot.local",    password: "TestTL123!" },
  to:       { email: "to@test.runoot.local",     password: "TestTO123!" },
  private:  { email: "user@test.runoot.local",   password: "TestUser123!" },
};

async function loginAs(page: Page, role: keyof typeof TEST_USERS) {
  const { email, password } = TEST_USERS[role];
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log\s*in|accedi|sign\s*in/i }).click();
  // Dopo login, React Router redireziona — aspettiamo che non siamo più su /login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
}

// Playwright fixture custom
export const test = base.extend<{ loginAs: (role: keyof typeof TEST_USERS) => Promise<void> }>({
  loginAs: async ({ page }, use) => {
    await use(async (role) => loginAs(page, role));
  },
});

export { expect } from "@playwright/test";
```

---

## Blocco 5 — Test Suite (Fase 1)

### Redirect da conoscere per scrivere test corretti

| Percorso | Comportamento reale | Dove nel codice |
|-----------|-------------------|-----------------|
| `/` | Redirect a `/{locale}` (es. `/en`) | `root.tsx:59-66` |
| `/dashboard` | Redirect a `/to-panel` | `routes/dashboard.tsx:9` |
| Route protette senza auth | Redirect a `/login?redirectTo=/percorso` | `session.server.ts:213` |
| Admin senza `phone_verified_at` | Redirect a `/verify-phone` | `root.tsx:40-56` |

### File test previsti

#### `e2e/navigation.spec.ts` — Navigazione pubblica
```
- Homepage `/` redireziona a `/{locale}` e carica senza errori
- Pagina listings carica e mostra almeno 1 listing
- Pagina dettaglio listing carica titolo e info
- URL inesistente mostra pagina 404
```

#### `e2e/auth.spec.ts` — Login / Logout / Protezione route
```
- Login con credenziali corrette → redireziona fuori da /login
- Login con credenziali errate → mostra messaggio errore
- Logout → torna a homepage, non più autenticato
- Accesso a /to-panel senza login → redirect a /login?redirectTo=...
- Dopo login con redirectTo → arriva alla pagina originale
```

#### `e2e/admin.spec.ts` — Pannello Admin
```
- Admin vede lista utenti in /admin/users
- Admin crea invito (tipo private) → appare in pending
- Admin resend invite su invito pending → successo (no "invite not found")
- Admin resend invite su invito expired → successo (rigenera token)
- Admin revoke invite → invito rimosso dalla lista
- Admin cambia categoria utente
```

#### `e2e/listings.spec.ts` — Creazione e Gestione Listing
```
- Utente TO crea un nuovo listing (compila form, submit)
- Listing appare nella lista (dopo approvazione admin, se richiesta)
- Filtri per tipo (room/bib) funzionano
```

#### `e2e/messages.spec.ts` — Messaggistica
```
- Utente apre conversazione da pagina listing
- Messaggio viene inviato e appare nella chat
- L'altro utente vede il messaggio ricevuto
```

#### `e2e/join-onboarding.spec.ts` — Flusso Invito + Registrazione
```
- Naviga a /join/{token_valido} → mostra form registrazione
- Compila form e registra → redirect a onboarding/dashboard
- Token scaduto → mostra errore appropriato
```

### Priorità

**Scrivere prima**: `navigation.spec.ts` e `auth.spec.ts` (validano che il setup funzioni).
**Poi**: `admin.spec.ts` (copre il bug appena fixato e il flusso inviti).
**Infine**: `listings.spec.ts`, `messages.spec.ts`, `join-onboarding.spec.ts`.

---

## Blocco 6 — GitHub Actions Workflow

### `.github/workflows/e2e.yml`

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase
        run: supabase start

      - name: Apply migrations + seed
        run: supabase db reset

      - name: Create .env for tests
        run: |
          echo "SUPABASE_URL=$(supabase status -o env | grep API_URL | cut -d= -f2)" >> .env
          echo "SUPABASE_ANON_KEY=$(supabase status -o env | grep ANON_KEY | cut -d= -f2)" >> .env
          echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2)" >> .env
          echo "SESSION_SECRET=e2e-test-secret-32-chars-long!!" >> .env
          echo "APP_URL=http://localhost:5173" >> .env
          echo "E2E_TEST=true" >> .env

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Stop Supabase
        if: always()
        run: supabase stop
```

### Note sulla CI

- **Docker**: GitHub Actions `ubuntu-latest` ha Docker preinstallato. Non serve setup extra.
- **Tempo stimato**: ~5-8 min totali (Supabase start ~2min, install ~1min, test ~2-3min).
- **Costo**: GitHub Actions è gratuito per repo pubblici; per repo privati hai 2000 min/mese gratis.

---

## Riepilogo file nuovi e modificati

### File NUOVI da creare

| File | Descrizione |
|------|-------------|
| `supabase/config.toml` | Generato da `supabase init` |
| `supabase/seed.sql` | Dati di test (utenti, eventi, listing, messaggi) |
| `supabase/migrations/` | Copia delle migrazioni con nomi rinominati |
| `playwright.config.ts` | Config Playwright |
| `e2e/fixtures/auth.ts` | Helper login riutilizzabile |
| `e2e/navigation.spec.ts` | Test navigazione pubblica |
| `e2e/auth.spec.ts` | Test autenticazione |
| `e2e/admin.spec.ts` | Test pannello admin |
| `e2e/listings.spec.ts` | Test listing |
| `e2e/messages.spec.ts` | Test messaggistica |
| `e2e/join-onboarding.spec.ts` | Test flusso invito |
| `.github/workflows/e2e.yml` | CI workflow |
| `.env.test` | Env vars per test locali (da aggiungere a `.gitignore`) |

### File ESISTENTI da modificare (piccole aggiunte)

| File | Modifica |
|------|----------|
| `app/lib/twilio-verify.server.ts` | +6 righe: bypass `E2E_TEST` |
| `app/lib/email/provider.resend.server.ts` | +4 righe: bypass `E2E_TEST` |
| `.gitignore` | Aggiungere: `.env.test`, `playwright-report/`, `test-results/` |
| `.env.example` | Aggiungere: `E2E_TEST=` (documentazione) |
| `package.json` | Aggiungere script: `"test:e2e": "playwright test"` |

---

## Ordine di implementazione consigliato

```
1. Bypass Twilio + Email (Blocco 2 + 3)         → 15 min
2. Setup Supabase locale (Blocco 1)              → 30-45 min (rinomina migrazioni)
3. Playwright config + fixtures (Blocco 4)       → 15 min
4. Primi 2 test: navigation + auth (Blocco 5a)   → 30 min
5. Verifica che tutto gira in locale              → debug
6. GitHub Actions workflow (Blocco 6)             → 15 min
7. Resto dei test (Blocco 5b)                     → 1-2 ore
```

---

## Domande aperte per te (Jay)

1. **Migrazioni**: Vuoi spostare definitivamente le migrazioni in `supabase/migrations/` (standard Supabase CLI) o preferisci tenerle in `/migrations/` e fare una copia automatica?

2. **Schema base**: `supabase-schema.sql` contiene lo schema iniziale. Va trasformato nella prima migrazione o preferisci tenerlo separato?

3. **Multi-browser**: Per ora solo Chromium. Vuoi aggiungere Firefox/Safari in futuro?

4. **Quando partire**: Vuoi implementare subito o prima finire altri fix?
