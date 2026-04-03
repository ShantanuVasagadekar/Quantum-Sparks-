-- Safe, idempotent schema hardening migration.
-- Run multiple times safely.

-- users wallet support
ALTER TABLE users
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(128);

-- keep backward compatibility with algo_wallet_address if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'algo_wallet_address'
  ) THEN
    UPDATE users
    SET wallet_address = algo_wallet_address
    WHERE wallet_address IS NULL
      AND algo_wallet_address IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_wallet_address_unique'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_wallet_address_unique UNIQUE (wallet_address);
  END IF;
END $$;

-- invoice line items completeness
ALTER TABLE invoice_line_items
ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(14,2) NOT NULL DEFAULT 0;

UPDATE invoice_line_items
SET gst_amount = ROUND((quantity * unit_price) * (COALESCE(gst_percent, 0) / 100.0), 2)
WHERE gst_amount = 0;

-- invoices completeness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'invoice_status'
  ) THEN
    CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled');
  END IF;
END $$;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS gst_total NUMERIC(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS status invoice_status NOT NULL DEFAULT 'draft';

UPDATE invoices
SET gst_total = COALESCE(tax_amount, 0)
WHERE gst_total = 0;

-- payments completeness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'payment_method'
  ) THEN
    CREATE TYPE payment_method AS ENUM ('cash', 'bank', 'upi', 'algo', 'manual');
  END IF;
END $$;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS payment_method payment_method NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS reference_number TEXT,
ADD COLUMN IF NOT EXISTS algo_tx_id TEXT,
ADD COLUMN IF NOT EXISTS algo_sender_address TEXT,
ADD COLUMN IF NOT EXISTS algo_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS txn_id TEXT,
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_payments_txn_id ON payments(txn_id);
