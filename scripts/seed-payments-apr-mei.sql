-- Seed payments: April - Mei 2026
-- Melengkapi data yang belum ada dari seed sebelumnya
-- Customer 1-3 (active) -> paid, Customer 4-5 (suspended) -> overdue
-- Variasi tanggal bayar & metode supaya realistis

BEGIN;

-- ============================================================
-- APRIL 2026 — hanya Customer 1 yang belum ada
-- ============================================================
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by, paid_at, generated_by)
VALUES
  ('INV-2026-04-0005', 1, 150000.00, '2026-04-11', 'transfer', '2026-04', 'paid', 'Transfer BCA mobile', 1, '2026-04-11 10:23:00', 'manual')
ON CONFLICT (invoice_number) DO NOTHING;

-- ============================================================
-- MEI 2026 — semua customer
-- ============================================================

-- Customer 1 (Ahmad, active, paket 150.000) — bayar awal bulan, rajin
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by, paid_at, generated_by)
VALUES
  ('INV-2026-05-0001', 1, 150000.00, '2026-05-03', 'qris', '2026-05', 'paid', 'QRIS ShopeePay', 2, '2026-05-03 14:05:00', 'manual')
ON CONFLICT (invoice_number) DO NOTHING;

-- Customer 2 (Siti, active, paket 200.000) — bayar pertengahan bulan
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by, paid_at, generated_by)
VALUES
  ('INV-2026-05-0002', 2, 200000.00, '2026-05-14', 'transfer', '2026-05', 'paid', 'Transfer Mandiri', 1, '2026-05-14 09:30:00', 'manual')
ON CONFLICT (invoice_number) DO NOTHING;

-- Customer 3 (Budi, active, paket 100.000) — bayar agak telat tapi masih lunas
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by, paid_at, generated_by)
VALUES
  ('INV-2026-05-0003', 3, 100000.00, '2026-05-22', 'cash', '2026-05', 'paid', 'Tunai, ditagih door-to-door', 2, '2026-05-22 16:40:00', 'manual')
ON CONFLICT (invoice_number) DO NOTHING;

-- Customer 4 (Dewi, suspended, paket 200.000) — masih overdue
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by, paid_at, generated_by)
VALUES
  ('INV-2026-05-0004', 4, 200000.00, '2026-05-01', 'transfer', '2026-05', 'overdue', 'WA reminder dikirim 3x, tidak direspon', 1, NULL, 'bulk')
ON CONFLICT (invoice_number) DO NOTHING;

-- Customer 5 (Eko, suspended, paket 150.000) — masih overdue
INSERT INTO payments (invoice_number, customer_id, amount, payment_date, payment_method, period_month, status, notes, received_by, paid_at, generated_by)
VALUES
  ('INV-2026-05-0005', 5, 150000.00, '2026-05-01', 'cash', '2026-05', 'overdue', 'Nomor HP tidak aktif', 2, NULL, 'bulk')
ON CONFLICT (invoice_number) DO NOTHING;

-- ============================================================
-- Update counter supaya invoice berikutnya tidak bentrok
-- ============================================================
INSERT INTO counters (scope, value) VALUES
  ('invoice:2026-04', 5),
  ('invoice:2026-05', 5)
ON CONFLICT (scope) DO UPDATE SET value = GREATEST(counters.value, EXCLUDED.value);

COMMIT;
