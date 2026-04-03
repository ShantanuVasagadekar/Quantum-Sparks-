ALTER TABLE invoices ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS invoice_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  version INT NOT NULL,
  
  -- Snapshot fields
  invoice_number TEXT,
  total_amount NUMERIC(14,2),
  due_date DATE,
  invoice_hash TEXT,
  algo_anchor_tx_id TEXT,
  
  -- The full line items JSON array at that point in time
  line_items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, version)
);

CREATE INDEX IF NOT EXISTS idx_invoice_versions_invoice_id ON invoice_versions(invoice_id);
