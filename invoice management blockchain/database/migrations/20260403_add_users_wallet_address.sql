ALTER TABLE users
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(128);

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
