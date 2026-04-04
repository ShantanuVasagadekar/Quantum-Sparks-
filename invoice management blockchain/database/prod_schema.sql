-- ============================================================
-- Invoice Management Blockchain — Production Schema
-- Fully idempotent: safe to run multiple times
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums (safe re-run)
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'accepted', 'disputed', 'partial', 'paid', 'overdue', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Safely add new enum values for existing databases
DO $$ BEGIN
  ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'accepted' AFTER 'sent';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'disputed' AFTER 'accepted';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'bank', 'upi', 'algo', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- USERS
-- password_hash is included from day one
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT        UNIQUE NOT NULL,
  business_name       TEXT        NOT NULL,
  owner_name          TEXT,
  gst_number          TEXT,
  phone               TEXT,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  pincode             TEXT,
  algo_wallet_address TEXT,
  password_hash       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist on pre-existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode TEXT;

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  email               TEXT,
  phone               TEXT,
  company_name        TEXT,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  zip                 TEXT,
  algo_wallet_address TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address     TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city        TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state       TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS zip         TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS algo_wallet_address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes       TEXT;

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id            UUID            NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  invoice_number       TEXT            NOT NULL,
  title                TEXT,
  description          TEXT,
  currency             TEXT            NOT NULL DEFAULT 'INR',
  subtotal_amount      NUMERIC(14,2)   NOT NULL DEFAULT 0,
  tax_amount           NUMERIC(14,2)   NOT NULL DEFAULT 0,
  cgst_amount          NUMERIC(14,2)   NOT NULL DEFAULT 0,
  sgst_amount          NUMERIC(14,2)   NOT NULL DEFAULT 0,
  igst_amount          NUMERIC(14,2)   NOT NULL DEFAULT 0,
  discount_amount      NUMERIC(14,2)   NOT NULL DEFAULT 0,
  total_amount         NUMERIC(14,2)   NOT NULL,
  paid_amount          NUMERIC(14,2)   NOT NULL DEFAULT 0,
  outstanding_amount   NUMERIC(14,2)   GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status               invoice_status  NOT NULL DEFAULT 'draft',
  issue_date           DATE            NOT NULL,
  due_date             DATE            NOT NULL,
  sent_at              TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  overdue_at           TIMESTAMPTZ,
  is_cancelled         BOOLEAN         NOT NULL DEFAULT false,
  anchor_tx_id         TEXT,
  anchor_hash          TEXT,
  anchor_simulated     BOOLEAN         NOT NULL DEFAULT false,
  anchor_explorer_url  TEXT,
  anchored_at          TIMESTAMPTZ,
  invoice_hash         TEXT,
  algo_anchor_tx_id    TEXT,
  algo_anchor_status   TEXT,
  version              INT             NOT NULL DEFAULT 1,
  metadata             JSONB,
  created_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT invoices_amount_non_negative CHECK (total_amount >= 0),
  CONSTRAINT invoices_paid_non_negative   CHECK (paid_amount  >= 0)
);

-- Per-user unique invoice number (the correct constraint)
DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_number_user_unique UNIQUE (user_id, invoice_number);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Additive columns for older databases
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS title               TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description         TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency            TEXT          DEFAULT 'INR';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal_amount     NUMERIC(14,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount          NUMERIC(14,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_amount         NUMERIC(14,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_amount         NUMERIC(14,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_amount         NUMERIC(14,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount     NUMERIC(14,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date          DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at             TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at             TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS overdue_at          TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_cancelled        BOOLEAN       DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS anchor_tx_id        TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS anchor_hash         TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS anchor_simulated    BOOLEAN       DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS anchor_explorer_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS anchored_at         TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_hash        TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS algo_anchor_tx_id   TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS algo_anchor_status  TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS version             INT           DEFAULT 1;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS metadata            JSONB;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS portal_token        TEXT DEFAULT gen_random_uuid()::text;
-- Mutual-agreement acceptance columns
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS accepted_at         TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS accepted_by         TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS acceptance_note     TEXT;

-- Snapshot acceptance in version history
ALTER TABLE invoice_versions ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE invoice_versions ADD COLUMN IF NOT EXISTS accepted_by TEXT;


-- ============================================================
-- INVOICE LINE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    NUMERIC(12,2) NOT NULL,
  unit_price  NUMERIC(14,2) NOT NULL,
  gst_percent NUMERIC(5,2)  NOT NULL DEFAULT 0,
  line_total  NUMERIC(14,2) NOT NULL,
  sort_order  INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT line_items_positive_quantity    CHECK (quantity   > 0),
  CONSTRAINT line_items_non_negative_price  CHECK (unit_price >= 0),
  CONSTRAINT line_items_non_negative_total  CHECK (line_total >= 0)
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id           UUID          NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  amount            NUMERIC(14,2) NOT NULL,
  payment_date      TIMESTAMPTZ   NOT NULL,
  payment_method    payment_method NOT NULL,
  reference_number  TEXT,
  algo_tx_id        TEXT,
  algo_sender_address TEXT,
  algo_verified     BOOLEAN       NOT NULL DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_positive CHECK (amount > 0)
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id              UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number     TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS algo_tx_id           TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS algo_sender_address  TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS algo_verified        BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes                TEXT;

-- ============================================================
-- INVOICE EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL,
  event_payload JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INVOICE VERSIONS (immutable audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_versions (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  version             INT           NOT NULL,
  invoice_number      TEXT,
  total_amount        NUMERIC(14,2),
  due_date            DATE,
  invoice_hash        TEXT,
  algo_anchor_tx_id   TEXT,
  line_items_snapshot JSONB         NOT NULL DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, version)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_user_id            ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_name          ON clients(user_id, name);

CREATE INDEX IF NOT EXISTS idx_invoices_user_status       ON invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_user_due_date     ON invoices(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id         ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_anchor_tx_id      ON invoices(anchor_tx_id);
CREATE INDEX IF NOT EXISTS idx_invoices_algo_anchor_tx_id ON invoices(algo_anchor_tx_id);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice_id      ON invoice_line_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id        ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_date         ON payments(user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_algo_tx           ON payments(algo_tx_id);

CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice_id  ON invoice_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_events_event_type  ON invoice_events(event_type);

CREATE INDEX IF NOT EXISTS idx_invoice_versions_invoice_id ON invoice_versions(invoice_id);

-- ============================================================
-- TRIGGERS — updated_at auto-maintenance
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at   ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- SEED DATA (idempotent)
-- ============================================================
INSERT INTO users (id, email, business_name)
VALUES ('11111111-1111-1111-1111-111111111111', 'demo@invoice.local', 'Demo Business')
ON CONFLICT (email) DO NOTHING;

INSERT INTO clients (id, user_id, name, email, company_name)
VALUES
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Acme Labs',     'billing@acmelabs.com',   'Acme Labs'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Nimbus Retail', 'finance@nimbusretail.com','Nimbus Retail')
ON CONFLICT (id) DO NOTHING;
