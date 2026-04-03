INSERT INTO users (id, email, business_name)
VALUES ('11111111-1111-1111-1111-111111111111', 'demo@invoice.local', 'Demo Business')
ON CONFLICT (email) DO NOTHING;

INSERT INTO clients (id, user_id, name, email, company_name)
VALUES
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Acme Labs', 'billing@acmelabs.com', 'Acme Labs'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Nimbus Retail', 'finance@nimbusretail.com', 'Nimbus Retail')
ON CONFLICT (id) DO NOTHING;
