-- Seed payments: Des 2025 - Apr 2026 (5 bulan)
-- Active customers (1, 2, 3) -> paid; Suspended (4, 5) -> overdue
-- Skip kombinasi (customer_id, period_month) yang sudah ada

BEGIN;

-- Customer 1 (Ahmad, active, 150.000) — periode Mar & Apr sudah ada, isi Des/Jan/Feb
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by) VALUES
  ('INV-2025-12-0001', 1, 150000.00, '2025-12-05', 'transfer', '2025-12', 'paid', 'Transfer BCA', 1),
  ('INV-2026-01-0001', 1, 150000.00, '2026-01-08', 'qris',     '2026-01', 'paid', NULL, 2),
  ('INV-2026-02-0001', 1, 150000.00, '2026-02-12', 'cash',     '2026-02', 'paid', 'Diterima tunai di kantor', 2);

-- Customer 2 (Siti, active, 200.000) — periode Mar sudah ada, isi Des/Jan/Feb/Apr
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by) VALUES
  ('INV-2025-12-0002', 2, 200000.00, '2025-12-10', 'transfer', '2025-12', 'paid', NULL, 1),
  ('INV-2026-01-0002', 2, 200000.00, '2026-01-15', 'transfer', '2026-01', 'paid', 'Transfer Mandiri', 1),
  ('INV-2026-02-0002', 2, 200000.00, '2026-02-18', 'qris',     '2026-02', 'paid', NULL, 2),
  ('INV-2026-04-0001', 2, 200000.00, '2026-04-09', 'qris',     '2026-04', 'paid', 'QRIS GoPay', 2);

-- Customer 3 (Budi, active, 100.000) — periode Mar sudah ada, isi Des/Jan/Feb/Apr
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by) VALUES
  ('INV-2025-12-0003', 3, 100000.00, '2025-12-20', 'cash',     '2025-12', 'paid', NULL, 2),
  ('INV-2026-01-0003', 3, 100000.00, '2026-01-22', 'cash',     '2026-01', 'paid', 'Tunai door-to-door', 2),
  ('INV-2026-02-0003', 3, 100000.00, '2026-02-09', 'transfer', '2026-02', 'paid', NULL, 1),
  ('INV-2026-04-0002', 3, 100000.00, '2026-04-14', 'transfer', '2026-04', 'paid', 'Transfer BRI', 1);

-- Customer 4 (Dewi, suspended, 200.000) — semua overdue
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by) VALUES
  ('INV-2025-12-0004', 4, 200000.00, '2025-12-01', 'transfer', '2025-12', 'overdue', 'Reminder WA dikirim', 1),
  ('INV-2026-01-0004', 4, 200000.00, '2026-01-01', 'transfer', '2026-01', 'overdue', 'Reminder WA dikirim', 1),
  ('INV-2026-02-0004', 4, 200000.00, '2026-02-01', 'transfer', '2026-02', 'overdue', NULL, 1),
  ('INV-2026-03-0001', 4, 200000.00, '2026-03-01', 'transfer', '2026-03', 'overdue', 'Tagihan menumpuk', 1),
  ('INV-2026-04-0003', 4, 200000.00, '2026-04-01', 'transfer', '2026-04', 'overdue', 'Customer suspended', 1);

-- Customer 5 (Eko, suspended, 150.000) — semua overdue
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by) VALUES
  ('INV-2025-12-0005', 5, 150000.00, '2025-12-01', 'cash', '2025-12', 'overdue', NULL, 2),
  ('INV-2026-01-0005', 5, 150000.00, '2026-01-01', 'cash', '2026-01', 'overdue', 'Reminder dikirim', 2),
  ('INV-2026-02-0005', 5, 150000.00, '2026-02-01', 'cash', '2026-02', 'overdue', NULL, 2),
  ('INV-2026-03-0002', 5, 150000.00, '2026-03-01', 'cash', '2026-03', 'overdue', 'Customer sulit dihubungi', 2),
  ('INV-2026-04-0004', 5, 150000.00, '2026-04-01', 'cash', '2026-04', 'overdue', 'Customer suspended', 2);

-- Sinkronkan counter agar invoice berikutnya tidak bentrok
INSERT INTO counters (scope, value) VALUES
  ('invoice:2025-12', 5),
  ('invoice:2026-01', 5),
  ('invoice:2026-02', 5),
  ('invoice:2026-03', 2),
  ('invoice:2026-04', 4)
ON CONFLICT (scope) DO UPDATE SET value = GREATEST(counters.value, EXCLUDED.value);

COMMIT;
