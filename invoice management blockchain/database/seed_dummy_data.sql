-- Dummy Data Seed Script for Development / Testing
-- NOTE: Please ensure the schema uses the business profile fields and GST fields before running this.

BEGIN;

-- 1. Insert a Test User (Business)
-- Password is 'password123'
INSERT INTO users (id, email, password_hash, business_name, owner_name, gst_number, phone, address, city, state, pincode, algo_wallet_address)
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'demo@quantumsparks.com', 
    '$2b$10$w09dK1L/ZfS3P6P6X7t4O.5yF4y.U9L0u6T5X0v1mO7K4Y7Yv7dWu', 
    'Quantum Sparks Pvt Ltd',
    'Jane Doe',
    '27AAAAA0000A1Z5',
    '9876543210',
    '123, Tech Hub, Bandra',
    'Mumbai',
    'Maharashtra',
    '400050',
    'ALGOXXXXXXX'
) ON CONFLICT (email) DO NOTHING;

-- Retrieve user id (if already exists, handle manually, but for demo we assume the UUID above)

-- 2. Insert Test Clients
INSERT INTO clients (id, user_id, name, company_name, email, phone, address, city, state, zip)
VALUES 
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Acme Corp', 'Acme Corporation', 'acme@example.com', '1234567890', '456 Market St', 'Mumbai', 'Maharashtra', '400001'),
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Globex Inc', 'Globex Inc', 'globex@example.com', '0987654321', '789 Business Rd', 'Bengaluru', 'Karnataka', '560001')
ON CONFLICT DO NOTHING;

-- 3. Insert Test Invoices
-- Same state (Maharashtra -> CGST + SGST)
INSERT INTO invoices (id, user_id, client_id, invoice_number, title, currency, subtotal_amount, tax_amount, cgst_amount, sgst_amount, igst_amount, discount_amount, total_amount, paid_amount, status, issue_date, due_date)
VALUES 
    ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'INV-2026-001', 'Website Redesign', 'INR', 10000.00, 1800.00, 900.00, 900.00, 0.00, 0.00, 11800.00, 11800.00, 'paid', current_date - 30, current_date - 15),
    ('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'INV-2026-002', 'SEO Services', 'INR', 15000.00, 2700.00, 0.00, 0.00, 2700.00, 0.00, 17700.00, 0.00, 'overdue', current_date - 45, current_date - 15),
    ('44444444-4444-4444-4444-444444444443', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'INV-2026-003', 'Hosting Maintenance', 'INR', 5000.00, 900.00, 450.00, 450.00, 0.00, 0.00, 5900.00, 0.00, 'sent', current_date - 5, current_date + 10)
ON CONFLICT DO NOTHING;

-- 4. Insert Line Items
INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, gst_percent, line_total, sort_order)
VALUES 
    ('44444444-4444-4444-4444-444444444441', 'Frontend Development', 1, 10000.00, 18, 10000.00, 0),
    ('44444444-4444-4444-4444-444444444442', 'Monthly SEO Package', 1, 15000.00, 18, 15000.00, 0),
    ('44444444-4444-4444-4444-444444444443', 'Annual Cloud Hosting', 1, 5000.00, 18, 5000.00, 0)
ON CONFLICT DO NOTHING;

-- 5. Insert Payments
INSERT INTO payments (id, invoice_id, amount, payment_date, payment_method)
VALUES 
    (gen_random_uuid(), '44444444-4444-4444-4444-444444444441', 11800.00, current_date - 14, 'bank_transfer')
ON CONFLICT DO NOTHING;

COMMIT;
