-- =====================================================
-- Migration: Add Bib Transfer Fields
-- Data: 2026-01-14
-- Descrizione: Aggiunge campi per gestire il trasferimento
--              di bibs in modo conforme ai regolamenti
-- =====================================================

-- 1. Aggiungere nuova colonna per tipo di trasferimento
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS transfer_type TEXT
CHECK (transfer_type IN ('official_process', 'package', 'contact'));

-- 2. Aggiungere colonna per costi associati (non "prezzo")
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS associated_costs NUMERIC(10,2) CHECK (associated_costs >= 0);

-- 3. Aggiungere colonna per note sui costi
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS cost_notes TEXT;

-- 4. Aggiungere colonna per future integrazioni pacchetti (nullable, FK verrà aggiunta dopo)
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS package_id UUID;

-- 5. Creare indice per migliorare query filtrate per transfer_type
CREATE INDEX IF NOT EXISTS idx_listings_transfer_type
ON listings(transfer_type)
WHERE transfer_type IS NOT NULL;

-- 6. Creare indice per associated_costs
CREATE INDEX IF NOT EXISTS idx_listings_associated_costs
ON listings(associated_costs)
WHERE associated_costs IS NOT NULL;

-- 7. Aggiungere commenti per documentazione
COMMENT ON COLUMN listings.transfer_type IS 'Metodo di trasferimento del bib: official_process (cambio nome ufficiale), package (incluso in pacchetto), contact (da concordare)';
COMMENT ON COLUMN listings.associated_costs IS 'Costi associati al trasferimento (es. fee amministrative), NON prezzo di vendita diretto';
COMMENT ON COLUMN listings.cost_notes IS 'Dettagli sui costi associati (es. "Include fee cambio nome ufficiale €50")';
COMMENT ON COLUMN listings.package_id IS 'FK a futura tabella packages per Phase 2';

-- 8. OPZIONALE: Migrare dati esistenti (se ci sono listing con bibs)
-- Se hai già listing "bib" o "room_and_bib" con price, puoi migrarli ad associated_costs
UPDATE listings
SET
  associated_costs = price,
  transfer_type = 'contact',
  cost_notes = CASE
    WHEN price IS NOT NULL THEN 'Includes transfer arrangements'
    ELSE NULL
  END
WHERE
  (listing_type = 'bib' OR listing_type = 'room_and_bib')
  AND price IS NOT NULL
  AND associated_costs IS NULL;

-- 9. Verificare la migration
SELECT
  'Migration completata con successo!' as status,
  COUNT(*) FILTER (WHERE transfer_type IS NOT NULL) as listings_con_transfer_type,
  COUNT(*) FILTER (WHERE associated_costs IS NOT NULL) as listings_con_associated_costs
FROM listings
WHERE listing_type IN ('bib', 'room_and_bib');
