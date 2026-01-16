# Supabase Client Usage Guide

## Quando usare `supabase` (con RLS)
Usa il client normale quando:
- Fai SELECT su tabelle pubbliche (events, listings pubblici)
- L'operazione è fatta dal proprietario dei dati (es. user aggiorna proprio profilo)
- Non serve bypassare le policy RLS

## Quando usare `supabaseAdmin` (senza RLS)
Usa il service role client quando:
- Inserisci in tabelle con policy che richiedono service role (es. hotels)
- Fai query complesse con JOIN multipli che RLS potrebbe bloccare
- Crei/modifici dati cross-user (messaggi tra utenti, conversazioni)
- Fai UPDATE che RLS policy bloccherebbe (es. mark messages as read)

## Regola generale
Se la query fallisce con "row-level security policy" error, usa `supabaseAdmin`.
Altrimenti, preferisci `supabase` per sicurezza.
