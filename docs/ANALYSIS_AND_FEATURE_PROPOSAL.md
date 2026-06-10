# SI YBY NET — Analisis Mendalam & Proposal Fitur Strategis

**Tanggal:** 2026-05-05
**Versi proyek dianalisis:** branch `main` (commit `cfd1640`)
**Penulis:** Hasil analisis kode oleh Claude Code

---

## 1. Ringkasan Eksekutif

SI YBY NET adalah aplikasi manajemen ISP RT/RW Net berbasis **Next.js 16 + Drizzle + PostgreSQL + BullMQ**, dengan integrasi **MikroTik RouterOS API** dan **Fonnte WhatsApp API**. Fondasi arsitekturnya sudah benar untuk skala UMKM ISP:

- Pemisahan worker BullMQ vs Next.js (PM2 dua proses) — sangat tepat untuk operasi hardware async.
- Pemisahan validator Zod vs schema DB — fleksibel.
- Snapshot harga paket pada `payments` (sesuai prinsip data integrity di CLAUDE.md).

Namun, proyek saat ini masih berada pada level **operasional dasar** (CRUD pelanggan, billing manual, suspend manual). Untuk menjadi *powerful* dan *impactful* — yaitu mengurangi pekerjaan operator hingga >70% dan meningkatkan retensi/pendapatan pelanggan — proyek ini perlu naik kelas dari "sistem pencatatan" menjadi "sistem otomasi & customer experience platform".

Dokumen ini terbagi menjadi:
1. **Analisis arsitektur saat ini** — apa yang sudah ada, kekuatan & risiko.
2. **Gap analysis** — yang penting tapi belum ada.
3. **Proposal fitur** — diranking berdasarkan dampak/effort, dengan justifikasi bisnis.
4. **Roadmap eksekusi** dalam 3 fase.

---

## 2. Analisis Arsitektur Saat Ini

### 2.1 Struktur kode (observed)

```
src/
├── app/
│   ├── (auth)/login              # NextAuth login
│   ├── (dashboard)/              # 8 halaman: customers, packages, payments,
│   │                              #            service-requests, bandwidth,
│   │                              #            activity-logs, reports, settings
│   └── api/                       # REST: customers, packages, payments,
│                                   #       service-requests, bandwidth,
│                                   #       dashboard, jobs, settings
├── db/schema/                    # 7 tabel domain
├── lib/
│   ├── mikrotik/                 # client, pool, pppoe, queue, monitor
│   └── queue/                    # BullMQ producer + jobs
├── workers/                      # mikrotik.worker, notification.worker
└── validators/                   # 6 Zod schema
```

### 2.2 Kekuatan

| Area | Penilaian | Catatan |
|---|---|---|
| Async hardware ops | ★★★★★ | BullMQ + worker terpisah, concurrency=1 untuk MikroTik (tepat — RouterOS API tidak suka koneksi paralel banyak). |
| Type safety | ★★★★☆ | Drizzle + Zod + TS strict. Belum ada inferensi end-to-end ke client (no tRPC/server actions). |
| Data integrity | ★★★★☆ | Snapshot harga di payments. Tapi `payments.amount` decimal — bagus. Belum ada audit trail terpusat. |
| RBAC | ★★★☆☆ | 3 role, middleware-level. Tapi belum ada permission granular (mis. operator boleh suspend tapi tidak boleh delete). |
| UI | ★★★★☆ | shadcn/ui + Recharts + TanStack Table. Cukup modern. |

### 2.3 Risiko & Hutang Teknis

1. **`payments.periodMonth` sebagai `varchar(7)`** — rawan inkonsistensi (`"2026-3"` vs `"2026-03"`). Sebaiknya pakai `date` (tanggal-1 bulan tsb) atau enum tervalidasi.
2. **Tidak ada tabel `invoices` terpisah** dari `payments`. Saat ini "invoice" dan "payment" digabung dalam satu row — artinya tagihan yang belum dibayar tetap diperlakukan sebagai row payment dengan `status=pending`. **Konsekuensi:** sulit melacak siklus tagihan (terbit → kirim → reminder → bayar → lunas), sulit handle pembayaran sebagian, sulit handle satu pembayaran untuk multiple invoice.
3. **`activityLogs` minim** — tidak menyimpan IP, MAC, NAS port, framed-IP. Padahal data ini ada dari `/ppp/active/print`. Akan terasa saat audit/forensik.
4. **`settings` table key-value `varchar(1000)`** — setting kompleks (mis. template WA, jadwal cron) akan sulit. Pertimbangkan `jsonb`.
5. **`notification.worker` tanpa retry strategy & dedup** — kalau Fonnte gagal, BullMQ default retry, tapi tidak ada idempotency key → potensi spam customer.
6. **Tidak ada audit log perubahan data** (siapa edit pelanggan kapan). Wajib untuk operator multi-orang.
7. **MikroTik password disimpan plain di env** — OK untuk satu router, tapi tidak scalable. Belum ada konsep multi-router/multi-NAS.
8. **Tidak ada tabel `jobs` di DB** — status job hanya di Redis. Setelah job expired (default BullMQ 24 jam), riwayat hilang. Untuk audit "kapan PPPoE customer X di-suspend dan oleh siapa" — data hilang.
9. **`activeUntil` diupdate manual?** — tidak terlihat scheduler yang otomatis suspend customer ketika `activeUntil < today`. Ini fitur **kritis** untuk ISP.
10. **Tidak ada rate limiting di API routes** — login brute force, scraping endpoint dashboard mungkin terjadi.
11. **Bahasa worker pakai relative import** (`../lib/queue/...`) — fine, tapi kalau dikompilasi ke `dist/workers/` perlu hati-hati dengan path resolution.

---

## 3. Gap Analysis — Yang Penting Tapi Belum Ada

| Kategori | Gap |
|---|---|
| **Otomasi billing** | Generator invoice bulanan otomatis, scheduler suspend ketika jatuh tempo, scheduler reaktivasi setelah bayar. |
| **Customer experience** | Portal pelanggan (self-service), notifikasi multi-channel, riwayat pembayaran online. |
| **Pembayaran digital** | Tidak ada integrasi payment gateway (Midtrans, Xendit, QRIS dinamis). Operator masih manual catat. |
| **Monitoring jaringan** | Bandwidth chart ada, tapi tidak ada alerting (link down, ONU offline, traffic anomaly). |
| **Manajemen aset & topologi** | Tidak ada inventarisasi ODP, ODC, kabel, router, ONU per pelanggan dengan koordinat. |
| **Field operations** | Tidak ada PWA/mobile untuk teknisi (tugas instalasi, foto dokumentasi, GPS check-in). |
| **Forecasting & BI** | Reports masih chart sederhana. Tidak ada churn prediction, ARPU, MRR, cohort. |
| **Compliance & keamanan** | Tidak ada audit log, tidak ada 2FA, tidak ada backup terjadwal yang ter-monitor. |
| **AI/ML opportunity** | Belum dimanfaatkan — padahal data jaringan + tiket gangguan kaya untuk ML. |

---

## 4. Proposal Fitur — Diranking Berdasarkan Impact × Effort

Notasi: **Impact** (1-5) seberapa besar dampak ke bisnis, **Effort** (1-5) estimasi kompleksitas, **ROI = Impact/Effort**.

### 🥇 Tier 1 — Quick Win Berimpact Tinggi (kerjakan dulu)

#### F1. **Billing Engine Otomatis (Auto-Invoice + Auto-Suspend + Auto-Reactivate)**
- **Impact: 5 / Effort: 2 / ROI: 2.5**
- **Apa:** Cron job harian (BullMQ repeatable job) yang:
  1. Setiap tanggal 1 bulan → generate invoice untuk semua customer aktif berdasarkan paketnya, status `pending`.
  2. Setiap hari → cek customer dengan `activeUntil < today` dan tagihan unpaid > N hari → enqueue `SUSPEND_PPPOE` + kirim WA "layanan dinonaktifkan".
  3. Saat payment di-mark `paid` → otomatis update `activeUntil += 1 bulan` dan enqueue `ACTIVATE_PPPOE`.
- **Mengapa:** Ini adalah **inti bisnis ISP** dan saat ini dilakukan manual oleh operator. Otomasi ini saja menghemat 10-20 jam/bulan kerja operator.
- **Implementasi:**
  - Tambah queue `BILLING_QUEUE` + worker baru.
  - Refactor: pisahkan tabel `invoices` dari `payments` (lihat F2).
  - Tambah setting `auto_suspend_grace_days`, `invoice_generation_day`.

#### F2. **Refactor Invoice ↔ Payment menjadi 2 entitas**
- **Impact: 4 / Effort: 2 / ROI: 2.0**
- **Apa:** Pisah `invoices` (tagihan terbit, satu per customer per periode) dan `payments` (transaksi bayar, bisa banyak-ke-satu invoice atau pembayaran sebagian).
- **Mengapa:** Mendukung F1, partial payment, riwayat akurat, laporan piutang yang benar.
- **Skema baru (rekomendasi):**
  ```
  invoices (id, invoiceNumber, customerId, periodMonth date, amount, dueDate,
            status[unpaid|partial|paid|void], packageSnapshot jsonb, createdAt)
  payments (id, receiptNumber, invoiceId FK, amount, method, paymentDate, receivedBy)
  ```

#### F3. **Audit Log Terpusat (`audit_logs` table)**
- **Impact: 4 / Effort: 1 / ROI: 4.0**
- **Apa:** Tabel `audit_logs (id, userId, action, entity, entityId, before jsonb, after jsonb, ip, userAgent, ts)`. Trigger di setiap mutasi penting via helper `withAudit()`.
- **Mengapa:** Multi-operator → harus ada akuntabilitas. Juga jadi sumber data untuk dashboard "aktivitas tim".
- **Mudah:** ~1-2 hari kerja.

#### F4. **Job History Persisted (`mikrotik_jobs` table)**
- **Impact: 3 / Effort: 1 / ROI: 3.0**
- **Apa:** Setiap job MikroTik di-snapshot ke DB (status, attempts, error, payload, durationMs). Page `/jobs` untuk lihat riwayat.
- **Mengapa:** Saat ini job hilang setelah expired Redis. Untuk troubleshooting customer ("kenapa internet saya mati?") wajib ada timeline.

#### F5. **Notifikasi Multi-Stage WhatsApp**
- **Impact: 4 / Effort: 2 / ROI: 2.0**
- **Apa:** Bukan hanya 1 reminder, tapi serangkaian:
  - H-3 jatuh tempo: pengingat lembut
  - H-0: pengingat keras + link bayar
  - H+3 unpaid: peringatan pemutusan
  - H+7: notifikasi pemutusan + cara reaktivasi
  - Bayar berhasil: kuitansi digital + ucapan terima kasih
  - Welcome series untuk customer baru (3 pesan)
- **Tambahan:** template WA disimpan di `settings` (jsonb), bisa diedit admin tanpa deploy.
- **Idempotency:** simpan `notification_log (invoiceId, stage, sentAt)` agar tidak dobel.

---

### 🥈 Tier 2 — Diferensiator Kompetitif

#### F6. **Customer Self-Service Portal** (subdomain `pelanggan.ybynet.id` / route `/portal`)
- **Impact: 5 / Effort: 4 / ROI: 1.25**
- **Apa:** Halaman tanpa login berat (otentikasi via OTP WA → magic link), pelanggan bisa:
  - Lihat tagihan & status
  - Bayar via QRIS/VA (lihat F7)
  - Download kuitansi PDF
  - Lapor gangguan (auto-create service request)
  - Lihat statistik pemakaian bandwidth bulan ini
  - Lihat ETA teknisi untuk tiket mereka
- **Mengapa:** Mengurangi 50%+ chat masuk ke admin WA, meningkatkan persepsi profesionalisme, sekaligus mempercepat collection.

#### F7. **Integrasi Payment Gateway (Midtrans / Xendit / QRIS Dinamis)**
- **Impact: 5 / Effort: 3 / ROI: 1.67**
- **Apa:** Generate QRIS dinamis per invoice, callback webhook → otomatis mark paid → trigger reaktivasi (F1).
- **Mengapa:** Customer bayar 24/7 tanpa konfirmasi manual. Cash flow lebih cepat, error pencatatan turun ke nol.
- **Saran provider:** Midtrans Snap (dokumentasi paling lengkap di ID) atau Xendit (fee lebih kompetitif untuk QRIS).

#### F8. **PWA Teknisi (`/field`)**
- **Impact: 4 / Effort: 3 / ROI: 1.33**
- **Apa:** Mobile-first PWA untuk teknisi:
  - List tugas hari ini (dari service-requests assigned ke dia)
  - Check-in GPS saat tiba di lokasi
  - Upload foto sebelum/sesudah (ODP, kabel, ONU)
  - Capture serial ONU via kamera (OCR/manual)
  - Tanda tangan digital pelanggan
  - Auto-update status tiket
- **Mengapa:** Kualitas instalasi terdokumentasi, klaim "teknisi tidak datang" tidak bisa diperdebatkan, foto ODP/redaman bisa dipakai saat troubleshoot.
- **Storage:** simpan file di S3-compatible (MinIO local atau Cloudflare R2).

#### F9. **Network Health Monitor + Alerting**
- **Impact: 4 / Effort: 3 / ROI: 1.33**
- **Apa:** Worker tambahan poll RouterOS tiap 1 menit:
  - Active PPPoE count
  - Per-customer signal/redaman (dari OLT EPON/GPON kalau ada SNMP)
  - Interface traffic
  - CPU/RAM router
- **Alerting:** kalau >X customer offline serentak → kemungkinan link down → kirim WA ke admin/teknisi otomatis.
- **Storage time-series:** tabel `network_metrics` partitioned by month, atau pakai TimescaleDB extension PostgreSQL.

#### F10. **Manajemen Aset & Topologi (ODP/ODC/Kabel)**
- **Impact: 3 / Effort: 4 / ROI: 0.75**
- **Apa:** Tabel `network_devices` (ODP, ODC, splitter, OLT) dengan koordinat lat/lng, kapasitas, port terisi. Customer di-link ke ODP. Visualisasi peta (Leaflet + OpenStreetMap, gratis).
- **Mengapa:** Saat ada gangguan di satu ODP, langsung tahu customer mana yang terdampak → bisa proactive notification ke mereka.

---

### 🥉 Tier 3 — Long-term Strategic

#### F11. **Multi-Tenant / Multi-Router**
- Untuk ekspansi ke RT/RW lain, satu DB melayani banyak router. Refactor `mikrotik/client.ts` agar terima `routerId` dari konteks.

#### F12. **AI-Powered Insights**
- **Churn prediction:** model sederhana logistic regression dari fitur (umur langganan, jumlah tiket, hari terlambat bayar) → flag customer risiko churn → automated retention WA.
- **Anomaly detection bandwidth:** pelanggan rumah tangga tiba-tiba upload 100GB → bisa terjadi kompromi router. Notifikasi.
- **Tiket auto-categorization:** klasifikasi keluhan WhatsApp masuk via Claude API (atau lokal) → auto-create service request dengan kategori benar.

#### F13. **Financial Module Lanjutan**
- ARPU, MRR, churn rate dashboard
- Cohort retention chart
- Export ke format jurnal akuntansi (Excel/CSV) untuk pembukuan
- Komisi referral pelanggan (kode referral di portal, diskon bulan berikutnya bagi yang refer)

#### F14. **2FA + Rate Limiting + Hardening Keamanan**
- 2FA (TOTP) untuk role admin
- Rate limit di route login & public API (gunakan Upstash Redis atau in-memory + Redis yang sudah ada)
- CSP & security headers
- Backup PostgreSQL terjadwal + monitoring restore success

#### F15. **CRM Lite — Lead Pipeline**
- Tabel `leads` (calon pelanggan dari WA/web form) dengan status (new → survey → quoted → won/lost). Konversi otomatis ke `customers` saat won.
- Form survey kelayakan dari portal publik (input alamat → cek apakah dalam jangkauan ODP terdekat via F10).

#### F16. **WhatsApp Bot Dua Arah** (incoming webhook Fonnte)
- Customer kirim "tagihan" → bot balas saldo & link bayar.
- Customer kirim "lapor gangguan" → bot guide isi data → auto-create service request.
- Bot escalate ke admin kalau intent tidak terdeteksi.

---

## 5. Roadmap Eksekusi (3 Fase, ~6 Bulan)

### Fase 1 — Otomasi Inti (Bulan 1-2)
**Tujuan:** Hilangkan 80% pekerjaan operator yang berulang.

1. F2 — Refactor invoices vs payments
2. F1 — Billing engine otomatis
3. F4 — Job history persisted
4. F3 — Audit log terpusat
5. F5 — Notifikasi multi-stage

**Output:** operator hanya perlu cek dashboard pagi, mostly system jalan sendiri.

### Fase 2 — Customer Experience (Bulan 3-4)
**Tujuan:** Pelanggan puas, pembayaran lancar, churn turun.

6. F7 — Payment gateway
7. F6 — Customer self-service portal
8. F14 — 2FA + rate limit + backup
9. F9 — Network health monitor + alerting

**Output:** pelanggan bisa bayar QRIS jam 11 malam dan layanannya nyala otomatis.

### Fase 3 — Diferensiasi & Skala (Bulan 5-6)
**Tujuan:** Membedakan YBY NET dari kompetitor RT/RW Net lain.

10. F8 — PWA teknisi
11. F10 — Topologi & peta jaringan
12. F16 — WhatsApp bot dua arah
13. F12 — AI insights (churn + anomali)
14. F11 — Multi-tenant (kalau ekspansi)
15. F15 — CRM lead pipeline
16. F13 — Financial advanced

---

## 6. Rekomendasi Hutang Teknis untuk Diberesi Bersamaan

Saat menyentuh area terkait, sekalian beresi:

| # | Masalah | Solusi |
|---|---|---|
| H1 | `payments.periodMonth` varchar | Ubah ke `date` (selalu hari pertama bulan) — dilakukan saat F2. |
| H2 | `settings.value varchar(1000)` | Ubah ke `jsonb` — dilakukan saat F5 (template WA). |
| H3 | Activity logs minim field | Tambah `framedIp`, `nasPort`, `terminationReason` — saat F9. |
| H4 | Tidak ada idempotency notification | Tambah `notification_log` table — saat F5. |
| H5 | MikroTik password plain di env | Pindah ke `network_devices.credentials` (encrypted via libsodium / pgcrypto) — saat F11. |
| H6 | Tidak ada `requireRole()` granular | Buat enum `permissions` & helper RBAC matrix — saat F3. |
| H7 | Tidak ada test coverage terlihat | Tambah Vitest unit test untuk billing engine (paling kritis) — saat F1. |

---

## 7. Estimasi Dampak Bisnis

Asumsi 200 pelanggan, ARPU Rp 150.000/bulan = MRR Rp 30 juta.

| Fitur | Dampak terukur |
|---|---|
| F1+F7 (auto billing + payment gateway) | Cash collection cycle: dari rata 18 hari → 5 hari. ~Rp 13 juta cash flow lebih cepat. |
| F1+F5 (auto-suspend + multi-stage notif) | Bad debt turun dari ~5% → <1%. Hemat Rp 1.5 juta/bulan. |
| F6 (self-service portal) | Operator hemat 15-20 jam/bulan dari menjawab "tagihan saya berapa?". |
| F8 (PWA teknisi) | Kualitas instalasi naik, tiket re-visit turun ~30%, hemat biaya teknisi. |
| F12 (churn prediction) | Kalau bisa save 2-3 customer/bulan dari churn, saving Rp 300-450 ribu/bulan recurring. |

**Total potensi dampak finansial Tier 1+2 sekitar Rp 3-5 juta/bulan recurring + 60-80 jam waktu operator/bulan**, dari investasi development ~6-8 minggu.

---

## 8. Penutup

Proyek ini **fondasinya solid**. Yang membedakan apakah ia jadi sekadar "alat catat operator" atau "platform yang membuat YBY NET sulit dikalahkan kompetitor lokal" adalah **Tier 1 + Tier 2** di atas. Saran konkret:

> Mulai dari **F2 → F1 → F7** (refactor invoice → billing engine → payment gateway). Tiga ini saling mengunci dan memberi 70% dari total impact dengan ~30% dari total effort.

Sisanya bisa di-iterasi mengikuti feedback pengguna nyata (operator & pelanggan) setelah fase otomasi inti selesai.
