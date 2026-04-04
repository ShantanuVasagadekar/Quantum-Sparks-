-- ==============================================================
-- NeonDB Complete Deploy Script
-- Run this ONCE on a fresh NeonDB instance.
-- Includes: Schema + Extensions + Realistic Demo Data
-- Demo Login: demo@quantumsparks.com / password123
-- ==============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'accepted', 'disputed', 'partial', 'paid', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'bank', 'upi', 'algo', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================
-- TABLES
-- ==============================================================

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
  portal_token         TEXT            DEFAULT gen_random_uuid()::text,
  accepted_at          TIMESTAMPTZ,
  accepted_by          TEXT,
  acceptance_note      TEXT,
  created_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT invoices_amount_non_negative CHECK (total_amount >= 0),
  CONSTRAINT invoices_paid_non_negative   CHECK (paid_amount  >= 0)
);

DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_number_user_unique UNIQUE (user_id, invoice_number);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    NUMERIC(12,2) NOT NULL,
  unit_price  NUMERIC(14,2) NOT NULL,
  gst_percent NUMERIC(5,2)  NOT NULL DEFAULT 0,
  line_total  NUMERIC(14,2) NOT NULL,
  sort_order  INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS invoice_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL,
  event_payload JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  accepted_at         TIMESTAMPTZ,
  accepted_by         TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, version)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_user_id             ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_status        ON invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_user_due_date      ON invoices(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id          ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_line_items_invoice_id       ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id         ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_date          ON payments(user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice_id   ON invoice_events(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_versions_invoice_id ON invoice_versions(invoice_id);

-- Triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_users_updated_at   ON users;
CREATE TRIGGER trg_users_updated_at   BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ==============================================================
-- DEMO SEED DATA
-- Login: demo@quantumsparks.com / password123
-- ==============================================================
BEGIN;

-- Demo User
INSERT INTO users (id, email, password_hash, business_name, owner_name, gst_number, phone, address, city, state, pincode, algo_wallet_address)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'demo@quantumsparks.com',
  '$2b$10$w09dK1L/ZfS3P6P6X7t4O.5yF4y.U9L0u6T5X0v1mO7K4Y7Yv7dWu',
  'Quantum Sparks Pvt Ltd',
  'Shantanu Vasagadekar',
  '27AABCQ1234A1Z5',
  '9876543210',
  '12, Inspire Hub, Bandra Kurla Complex',
  'Mumbai',
  'Maharashtra',
  '400051',
  'ALGO3ZQBK7KXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
) ON CONFLICT (email) DO NOTHING;

-- Clients (8 realistic companies)
INSERT INTO clients (id, user_id, name, company_name, email, phone, address, city, state, zip) VALUES
  ('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Riya Mehta',    'Acme Digital Solutions',   'riya@acmedigital.com',    '9100001111', '45, MG Road',         'Mumbai',    'Maharashtra', '400001'),
  ('c1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Arjun Sharma',  'Globex Fintech Pvt Ltd',    'arjun@globexfintech.com', '9100002222', '22, Koramangala',     'Bengaluru', 'Karnataka',   '560034'),
  ('c1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Priya Nair',    'NimbusTech Innovations',    'priya@nimbustech.io',     '9100003333', '17, Hitech City Rd',  'Hyderabad', 'Telangana',   '500081'),
  ('c1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Vikram Singh',  'Apex Cloud Corp',           'vikram@apexcloud.in',     '9100004444', '9, Sector 18',        'Noida',     'Uttar Pradesh','201301'),
  ('c1000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Kavitha Rao',   'SolarMind Analytics',       'kavitha@solarmind.ai',    '9100005555', '1, Anna Salai',       'Chennai',   'Tamil Nadu',  '600002'),
  ('c1000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Rohit Desai',   'BlueStar Retail Ltd',       'rohit@bluestar.co',       '9100006666', '78, FC Road',         'Pune',      'Maharashtra', '411004'),
  ('c1000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Sneha Kapoor',  'Zenith Media Group',        'sneha@zenithmedia.in',    '9100007777', '35, Connaught Place', 'Delhi',     'Delhi',       '110001'),
  ('c1000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Aditya Kumar',  'IronBridge Logistics',      'aditya@ironbridge.io',    '9100008888', '4, Salt Lake City',   'Kolkata',   'West Bengal', '700091')
ON CONFLICT DO NOTHING;

-- ============================================================
-- INVOICES — spanning 6 months with varied statuses
-- Maharashtra clients (c1,c6): CGST+SGST. Others: IGST
-- ============================================================
INSERT INTO invoices (id, user_id, client_id, invoice_number, title, currency, subtotal_amount, tax_amount, cgst_amount, sgst_amount, igst_amount, discount_amount, total_amount, paid_amount, status, issue_date, due_date, paid_at, sent_at, metadata)
VALUES

-- PAID (older, fully settled, good history)
('i0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000001','QS-2025-001','Brand Identity Design',     'INR',25000,4500,2250,2250,0,0,29500,29500,'paid',   current_date-180,current_date-150,current_date-148,current_date-180,
  '{"payment_mode":"Bank Transfer","terms":"Net 30"}'),
('i0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000002','QS-2025-002','API Integration Project',   'INR',40000,7200,0,0,7200,2000,45200,45200,'paid',  current_date-160,current_date-130,current_date-128,current_date-160,
  '{"payment_mode":"UPI","terms":"Net 30"}'),
('i0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000003','QS-2025-003','UX Research & Prototype',   'INR',30000,5400,0,0,5400,0,35400,35400,'paid',   current_date-140,current_date-110,current_date-105,current_date-140,
  '{"payment_mode":"Bank Transfer","terms":"Net 30"}'),
('i0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000004','QS-2025-004','Cloud Architecture Review',  'INR',50000,9000,0,0,9000,0,59000,59000,'paid',   current_date-120,current_date-90, current_date-87, current_date-120,
  '{"payment_mode":"Bank Transfer","terms":"Net 30"}'),
('i0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000005','QS-2025-005','Data Pipeline Setup',       'INR',35000,6300,0,0,6300,1000,40300,40300,'paid',   current_date-100,current_date-70, current_date-65, current_date-100,
  '{"payment_mode":"UPI","terms":"Net 30"}'),

-- PAID (recent)
('i0000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000006','QS-2026-001','E-Commerce Development',    'INR',60000,10800,5400,5400,0,5000,65800,65800,'paid',  current_date-60,current_date-30, current_date-28, current_date-60,
  '{"payment_mode":"Bank Transfer","terms":"Net 30"}'),
('i0000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000007','QS-2026-002','Content Marketing Package',  'INR',20000,3600,0,0,3600,0,23600,23600,'paid',   current_date-50,current_date-20, current_date-19, current_date-50,
  '{"payment_mode":"UPI","terms":"Net 15"}'),

-- PARTIAL (partially paid)
('i0000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000001','QS-2026-003','Mobile App Development',    'INR',80000,14400,7200,7200,0,0,94400,50000,'partial', current_date-40,current_date+5,  NULL,current_date-40,
  '{"payment_mode":"Bank Transfer","terms":"Net 45"}'),
('i0000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000003','QS-2026-004','Machine Learning Model',     'INR',75000,13500,0,0,13500,0,88500,40000,'partial', current_date-35,current_date+10, NULL,current_date-35,
  '{"payment_mode":"UPI","terms":"Net 45"}'),

-- OVERDUE
('i0000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000004','QS-2026-005','DevOps Automation Setup',   'INR',45000,8100,0,0,8100,0,53100,0,'overdue',  current_date-50,current_date-10, NULL,current_date-50,
  '{"payment_mode":"Bank Transfer","terms":"Net 30"}'),
('i0000000-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000008','QS-2026-006','Logistics Dashboard Build',  'INR',38000,6840,0,0,6840,2000,42840,0,'overdue',  current_date-45,current_date-5,  NULL,current_date-45,
  '{"payment_mode":"UPI","terms":"Net 30"}'),

-- ACCEPTED (ready for payment)
('i0000000-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000002','QS-2026-007','Fintech Portal Development', 'INR',90000,16200,0,0,16200,0,106200,0,'accepted', current_date-15,current_date+20, NULL,current_date-15,
  '{"payment_mode":"Bank Transfer","terms":"Net 35"}'),
('i0000000-0000-0000-0000-000000000013','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000005','QS-2026-008','AI Chatbot Integration',     'INR',55000,9900,0,0,9900,3000,61900,0,'accepted', current_date-10,current_date+25, NULL,current_date-10,
  '{"payment_mode":"Algorand Crypto","terms":"Net 35"}'),

-- SENT (awaiting acceptance)
('i0000000-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000006','QS-2026-009','SEO & Performance Audit',   'INR',18000,3240,1620,1620,0,0,21240,0,'sent',  current_date-5,current_date+25, NULL,current_date-5,
  '{"payment_mode":"UPI","terms":"Net 30"}'),
('i0000000-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000007','QS-2026-010','Social Media Campaign',      'INR',22000,3960,0,0,3960,1000,24960,0,'sent',  current_date-3,current_date+27, NULL,current_date-3,
  '{"payment_mode":"Bank Transfer","terms":"Net 30"}'),

-- DRAFT (just created)
('i0000000-0000-0000-0000-000000000016','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000008','QS-2026-011','Warehouse Management System','INR',120000,21600,0,0,21600,10000,131600,0,'draft', current_date,current_date+30, NULL,NULL,
  '{"payment_mode":"Bank Transfer","terms":"Net 30"}'),

-- DISPUTED
('i0000000-0000-0000-0000-000000000017','11111111-1111-1111-1111-111111111111','c1000000-0000-0000-0000-000000000007','QS-2026-012','Video Production & Editing','INR',15000,2700,0,0,2700,0,17700,0,'disputed',current_date-20,current_date-5,  NULL,current_date-20,
  '{"payment_mode":"UPI","terms":"Net 15"}')

ON CONFLICT DO NOTHING;

-- Line Items for each invoice
INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, gst_percent, line_total, sort_order) VALUES
  ('i0000000-0000-0000-0000-000000000001','Logo & Brand Guidelines',1,15000,18,15000,0),
  ('i0000000-0000-0000-0000-000000000001','Business Card Design',2,5000,18,10000,1),
  ('i0000000-0000-0000-0000-000000000002','REST API Development',1,30000,18,30000,0),
  ('i0000000-0000-0000-0000-000000000002','3rd Party Integration',2,5000,18,10000,1),
  ('i0000000-0000-0000-0000-000000000003','User Research Sessions',3,5000,18,15000,0),
  ('i0000000-0000-0000-0000-000000000003','Prototype (Figma)',1,15000,18,15000,1),
  ('i0000000-0000-0000-0000-000000000004','Architecture Review',1,30000,18,30000,0),
  ('i0000000-0000-0000-0000-000000000004','Cloud Cost Optimization Report',1,20000,18,20000,1),
  ('i0000000-0000-0000-0000-000000000005','ETL Pipeline Design',1,25000,18,25000,0),
  ('i0000000-0000-0000-0000-000000000005','Dashboard Integration',1,10000,18,10000,1),
  ('i0000000-0000-0000-0000-000000000006','Shopify Store Development',1,45000,18,45000,0),
  ('i0000000-0000-0000-0000-000000000006','Payment Gateway Integration',1,15000,18,15000,1),
  ('i0000000-0000-0000-0000-000000000007','Blog Content (20 articles)',20,1000,18,20000,0),
  ('i0000000-0000-0000-0000-000000000008','iOS App Development',1,50000,18,50000,0),
  ('i0000000-0000-0000-0000-000000000008','Android App Development',1,30000,18,30000,1),
  ('i0000000-0000-0000-0000-000000000009','BERT Model Training',1,50000,18,50000,0),
  ('i0000000-0000-0000-0000-000000000009','API Deployment',1,25000,18,25000,1),
  ('i0000000-0000-0000-0000-000000000010','CI/CD Pipeline',1,25000,18,25000,0),
  ('i0000000-0000-0000-0000-000000000010','Kubernetes Setup',1,20000,18,20000,1),
  ('i0000000-0000-0000-0000-000000000011','Dashboard UI/UX',1,22000,18,22000,0),
  ('i0000000-0000-0000-0000-000000000011','Route Tracking Module',1,16000,18,16000,1),
  ('i0000000-0000-0000-0000-000000000012','Frontend React Portal',1,50000,18,50000,0),
  ('i0000000-0000-0000-0000-000000000012','Backend Node.js APIs',1,40000,18,40000,1),
  ('i0000000-0000-0000-0000-000000000013','OpenAI Integration',1,35000,18,35000,0),
  ('i0000000-0000-0000-0000-000000000013','Training & Fine-tuning',1,20000,18,20000,1),
  ('i0000000-0000-0000-0000-000000000014','Technical SEO Audit',1,10000,18,10000,0),
  ('i0000000-0000-0000-0000-000000000014','Performance Report & Plan',1,8000,18,8000,1),
  ('i0000000-0000-0000-0000-000000000015','Instagram Campaign (1 month)',1,12000,18,12000,0),
  ('i0000000-0000-0000-0000-000000000015','LinkedIn Paid Ads Management',1,10000,18,10000,1),
  ('i0000000-0000-0000-0000-000000000016','WMS Core Development',1,80000,18,80000,0),
  ('i0000000-0000-0000-0000-000000000016','Barcode & RFID Integration',1,40000,18,40000,1),
  ('i0000000-0000-0000-0000-000000000017','Video Editing (5 videos)',5,3000,18,15000,0)
ON CONFLICT DO NOTHING;

-- Payments for paid and partial invoices
INSERT INTO payments (invoice_id, user_id, amount, payment_date, payment_method, reference_number, notes) VALUES
  ('i0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',29500,current_date-148,'bank','IMPS2025148001','Full payment received via IMPS'),
  ('i0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',45200,current_date-128,'upi','UPI202512801','Full payment via PhonePe'),
  ('i0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',35400,current_date-105,'bank','NEFT202510501','Full payment NEFT transfer'),
  ('i0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',59000,current_date-87,'bank','RTGS20258701','Full payment RTGS'),
  ('i0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111',40300,current_date-65,'upi','UPI20256501','Full UPI payment'),
  ('i0000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111',65800,current_date-28,'bank','IMPS20262801','Full settlement via IMPS'),
  ('i0000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111',23600,current_date-19,'upi','UPI20261901','Full UPI payment on time'),
  -- Partial payments
  ('i0000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111',30000,current_date-20,'bank','IMPS20262001','50% advance on app project'),
  ('i0000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111',20000,current_date-10,'upi','UPI20261001','Second tranche payment'),
  ('i0000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111',40000,current_date-15,'bank','IMPS20261501','Advance 45% for ML project')
ON CONFLICT DO NOTHING;

-- Invoice Events
INSERT INTO invoice_events (invoice_id, event_type, event_payload) VALUES
  ('i0000000-0000-0000-0000-000000000012','invoice.accepted','{"message":"Client accepted terms via portal"}'),
  ('i0000000-0000-0000-0000-000000000013','invoice.accepted','{"message":"Client accepted terms via portal"}'),
  ('i0000000-0000-0000-0000-000000000010','invoice.overdue','{"message":"Invoice automatically marked overdue"}'),
  ('i0000000-0000-0000-0000-000000000011','invoice.overdue','{"message":"Invoice automatically marked overdue"}'),
  ('i0000000-0000-0000-0000-000000000017','invoice.disputed','{"reason":"Scope mismatch - 3 videos were delivered not 5"}')
ON CONFLICT DO NOTHING;

COMMIT;

-- Final verification
SELECT
  'Users'    AS entity, COUNT(*) FROM users    WHERE id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'Clients',   COUNT(*) FROM clients   WHERE user_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'Invoices',  COUNT(*) FROM invoices  WHERE user_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'Payments',  COUNT(*) FROM payments  WHERE user_id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'Line Items',COUNT(*) FROM invoice_line_items JOIN invoices ON invoice_line_items.invoice_id = invoices.id WHERE invoices.user_id = '11111111-1111-1111-1111-111111111111';
