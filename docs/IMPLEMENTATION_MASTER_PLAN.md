# SI YBY NET — Master Implementation Plan

> **Dokumen ini adalah single source of truth untuk implementasi.** Hasil merger dari Audit Report dan Feature Proposal (2026-05-05). Setiap task punya ID unik, lokasi file spesifik, dan acceptance criteria yang bisa di-verifikasi.

**Versi project:** branch `main`, commit `cfd1640`
**Tanggal merge:** 2026-05-05
**Stack:** Next.js 16 + Drizzle + PostgreSQL + BullMQ + Redis + node-routeros + Fonnte

---

## 📑 Daftar Isi

1. [Konteks Project](#1-konteks-project)
2. [Prinsip Implementasi (Wajib Dibaca AI)](#2-prinsip-implementasi-wajib-dibaca-ai)
3. [Sequence Eksekusi Definitif](#3-sequence-eksekusi-definitif)
4. [Phase 1 — Stabilisasi (FIX-001 s/d FIX-009)](#phase-1--stabilisasi)
5. [Phase 2 — Penguatan Fondasi (DEBT-001 s/d DEBT-008)](#phase-2--penguatan-fondasi)
6. [Phase 3 — Otomasi Inti (FEAT-001 s/d FEAT-005)](#phase-3--otomasi-inti-tier-1)
7. [Phase 4 — Customer Experience (FEAT-006 s/d FEAT-010)](#phase-4--customer-experience-tier-2)
8. [Phase 5 — Diferensiasi & Skala (FEAT-011 s/d FEAT-016)](#phase-5--diferensiasi--skala-tier-3)
9. [Definition of Done per Phase](#9-definition-of-done-per-phase)
10. [Risk Register](#10-risk-register)
11. [Open Questions yang Harus Dijawab Maintainer](#11-open-questions-yang-harus-dijawab-maintainer)

---

## 1. Konteks Project

**Apa:** Sistem manajemen ISP RT/RW Net untuk YBY NET. Mengelola data pelanggan, billing bulanan, kontrol PPPoE/queue MikroTik via BullMQ, reminder WhatsApp via Fonnte, dan dashboard monitoring.

**Status saat ini:** Late prototype / early MVP. Fondasi arsitektur solid (worker BullMQ terpisah, schema Drizzle modular, Zod validators, NextAuth v5), TAPI ada beberapa flow yang masih demoware:
- Mock data hard-coded di `activity-logs` dan `settings/users`
- `service-request-form` tidak memanggil API
- Password PPPoE default ke nomor HP atau `"123456"`
- Tidak ada test sama sekali (Vitest & Playwright dideklarasikan tapi config tidak ada)

**Target akhir:** Platform otomasi ISP yang:
- Mengurangi pekerjaan operator >70% (auto-billing, auto-suspend, auto-notify)
- Self-service customer portal (lihat tagihan, bayar online, lapor gangguan)
- Monitoring & alerting jaringan proaktif
- AI-powered insights (churn prediction, anomaly detection)

**Verdict:** **Refactor sebelum lanjut.** Skeleton bagus, tapi 1-2 minggu stabilisasi wajib sebelum tambah fitur baru.

---

## 2. Prinsip Implementasi (Wajib Dibaca AI)

Bagian ini adalah aturan main. AI yang mengerjakan task di dokumen ini **harus** mematuhi semuanya.

### 2.1 Aturan Kode

1. **Bahasa:** TypeScript strict mode. Tidak ada `any` kecuali sangat terpaksa (dan harus ada komentar `// FIXME: typed any` + alasan).
2. **File paths absolute dari root:** Saat menyebut file selalu format `src/app/api/customers/route.ts`. Jangan pakai `./` atau `../`.
3. **Validation di boundary:** Setiap input dari HTTP/queue/external API HARUS lewat Zod schema di `src/validators/`. Validator BERBEDA dengan DB schema — jangan dicampur.
4. **Error handling pattern (PILIH SATU, KONSISTEN):** Throw exceptions di service layer. API routes catch dan transform ke HTTP response. **Hapus pattern `{success, error}` tuple yang ada di `src/lib/mikrotik/pppoe.ts`.**
5. **Logging:** Pakai `pino` (akan di-setup di DEBT-003). Sementara `console.*` masih boleh, tapi WAJIB dengan prefix yang jelas (`[customers]`, `[worker:mikrotik]`, dll).
6. **Tidak ada secret di kode.** Tidak ada password, token, API key di kode atau di-commit ke `.env`. Pakai `.env.local` (yang di-gitignore) untuk dev, dan settings table (encrypted) untuk runtime.
7. **MikroTik client:** **HANYA** pakai `src/lib/mikrotik/pool.ts` (`mikrotikQuery`). Refactor `pppoe.ts` dan `queue.ts` agar pakai pool. `client.ts` akan dihapus (lihat DEBT-001).

### 2.2 Aturan Database

1. **Migrasi Drizzle:** Setiap perubahan schema → generate migration file → commit. Jangan edit migration file lama.
2. **Index FK:** Setiap kolom FK WAJIB punya index manual (Drizzle tidak auto-index FK di PostgreSQL).
3. **`onDelete` strategy:** Setiap relation harus eksplisit. Default ke `restrict` kecuali ada alasan kuat untuk `cascade` atau `set null`.
4. **Money:** Pakai `decimal(12,2)` untuk Rupiah. JANGAN pakai `float`/`real`.
5. **Date semantics:**
   - `varchar(7)` untuk periode billing → ganti ke `date` (selalu hari pertama bulan, mis. `2026-03-01`).
   - Timestamp gunakan `timestamp with time zone`.

### 2.3 Aturan Testing

1. **Setiap fix kritis (severity Critical/High) WAJIB punya test minimal 1 (unit atau integration).**
2. **Test framework:** Vitest untuk unit/integration, Playwright untuk e2e.
3. **Lokasi test:** `*.test.ts` colocated dengan source file, atau di `tests/` untuk e2e.
4. **Coverage target:** 60% di `src/lib/` dan `src/app/api/` dalam 6 minggu (bukan 100% — fokus path kritis).

### 2.4 Aturan Async / Hardware

1. **MikroTik calls:** SELALU lewat BullMQ. Tidak ada call sinkron dari API route (kecuali read-only seperti `/api/bandwidth`).
2. **Idempotency:** Setiap job MikroTik harus idempotent. Cek existence sebelum create (lihat FIX-006).
3. **Concurrency MikroTik queue:** TETAP `1`. Jangan dinaikkan — RouterOS API tidak suka koneksi paralel.
4. **Timeout:** Semua external HTTP call (Fonnte, payment gateway) WAJIB pakai `AbortController` dengan timeout maksimal 10 detik.
5. **Transaction:** Operasi yang mengubah DB + dispatch job → bungkus dalam transaction. Jika dispatch gagal, rollback DB.

### 2.5 Format Task Card

Setiap task di dokumen ini punya format konsisten. AI **harus** baca semua field sebelum mulai:

```
┌─ TASK-ID
├─ Severity / Tier: ...
├─ Lokasi: file:line (atau "new file")
├─ Effort: S (≤1 hari) / M (1-3 hari) / L (1-2 minggu) / XL (>2 minggu)
├─ Dependencies: [TASK-ID lain] atau "none"
├─ Problem: Apa masalahnya
├─ Solution: Apa yang harus dilakukan (high-level)
├─ Implementation Steps: Langkah konkret
├─ Acceptance Criteria: Cara verifikasi selesai
└─ Anti-patterns: Hal yang TIDAK boleh dilakukan
```

---

## 3. Sequence Eksekusi Definitif

**Aturan:** Jangan loncat phase. Phase berikutnya hanya boleh dimulai setelah Definition of Done phase sebelumnya tercapai.

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Stabilisasi             1-2 minggu    → MVP-ready  │
│   FIX-001 → FIX-009                                         │
├─────────────────────────────────────────────────────────────┤
│ Phase 2: Penguatan Fondasi       2-4 minggu    → Solid base │
│   DEBT-001 → DEBT-008                                       │
├─────────────────────────────────────────────────────────────┤
│ Phase 3: Otomasi Inti (Tier 1)   1-2 bulan     → 70% saved  │
│   FEAT-001 → FEAT-005                                       │
├─────────────────────────────────────────────────────────────┤
│ Phase 4: Customer Experience     1-2 bulan     → Pelanggan  │
│   FEAT-006 → FEAT-010                            puas       │
├─────────────────────────────────────────────────────────────┤
│ Phase 5: Diferensiasi & Skala    2-3 bulan     → Moat       │
│   FEAT-011 → FEAT-016                                       │
└─────────────────────────────────────────────────────────────┘
```

**Total estimasi:** ~6 bulan untuk full execution. Tier 1 + Phase 1+2 saja sudah memberi 70% nilai dengan 30% effort.

---

## Phase 1 — Stabilisasi

**Tujuan:** Hilangkan bug kritis, security holes, dan demoware. Jangan tambah fitur baru di phase ini.

---

### FIX-001: Hardening Password PPPoE

```
├─ Severity: CRITICAL
├─ Lokasi: src/app/api/customers/route.ts:89, src/workers/mikrotik.worker.ts:21
├─ Effort: S-M (1-2 hari)
├─ Dependencies: none
```

**Problem:** Password PPPoE default ke nomor HP customer (mudah ditebak), dan worker punya fallback literal `"123456"`. Berarti credentials customer effectively public.

**Solution:** Generate password kriptografis random, simpan hash di DB, push plaintext ke MikroTik hanya saat provisioning.

**Implementation Steps:**
1. Tambah utility `src/lib/crypto/password.ts` dengan fungsi `generatePPPoEPassword(): string` (12 karakter alphanumeric, pakai `crypto.randomBytes`).
2. Tambah kolom `pppoe_password_hash varchar(255)` di `src/db/schema/customers.ts`. Migrasi dengan Drizzle.
3. Pada customer create flow:
   - Generate password
   - Hash dengan bcrypt (cost 10) → simpan ke DB
   - Pass plaintext ke job payload BullMQ (jangan simpan plaintext di DB)
4. Di worker `src/workers/mikrotik.worker.ts`: HAPUS fallback `"123456"`. Jika password tidak ada di payload, throw error.
5. Tambah CI check: `grep -r "123456" src/` harus return 0 hits di file production.

**Acceptance Criteria:**
- [ ] Customer baru mendapat password unik 12 karakter
- [ ] Tidak ada string `"123456"` di codebase production (grep)
- [ ] DB inspection: `pppoe_password_hash` berisi bcrypt hash, bukan plaintext
- [ ] Job payload bisa di-replay tanpa exposure password ke logs

**Anti-patterns:**
- ❌ Simpan plaintext password di DB
- ❌ Log password ke console (bahkan saat debug)
- ❌ Pakai `Math.random()` — wajib `crypto.randomBytes`

---

### FIX-002: Transaction Customer Create + Compensation MikroTik

```
├─ Severity: HIGH
├─ Lokasi: src/app/api/customers/route.ts:58-93
├─ Effort: M (2-3 hari)
├─ Dependencies: FIX-001
```

**Problem:** Customer di-insert ke DB lebih dulu, lalu MikroTik job di-dispatch. Jika dispatch gagal atau worker gagal setelah retry, DB punya customer yang tidak ada di RouterOS — drift silent.

**Solution:** Bungkus insert + enqueue dalam Drizzle transaction. Tambah status `provisioning_failed` yang visible di UI.

**Implementation Steps:**
1. Tambah enum value `"provisioning_failed"` di `customers.status`.
2. Refactor `POST /api/customers`:
   ```ts
   await db.transaction(async (tx) => {
     const customer = await tx.insert(customers).values({...}).returning();
     await enqueueCreatePPPoE(customer.id, {...}); // throws on enqueue failure
     return customer;
   });
   ```
3. Di worker `mikrotik.worker.ts`: setelah max retries, update `customers.status = 'provisioning_failed'`.
4. UI: tampilkan badge merah + tombol "Retry provisioning" di customer detail page.
5. Tambah endpoint `POST /api/customers/[id]/retry-provisioning` untuk re-enqueue.

**Acceptance Criteria:**
- [ ] Mematikan Redis sebelum customer create → tidak ada orphan row di DB
- [ ] Worker gagal setelah 3x retry → status berubah jadi `provisioning_failed`, visible di UI
- [ ] Tombol retry berhasil re-trigger provisioning
- [ ] Integration test mensimulasi 3 skenario: success, enqueue fail, worker fail

**Anti-patterns:**
- ❌ Catch error enqueue lalu silent skip
- ❌ Dispatch job sebelum DB commit

---

### FIX-003: Implement `requireRole()` Helper

```
├─ Severity: HIGH
├─ Lokasi: NEW FILE src/lib/auth-guard.ts (referenced by CLAUDE.md tapi belum ada)
├─ Effort: S (1 hari)
├─ Dependencies: none
```

**Problem:** ~12 route melakukan copy-paste pattern `if (!session || (role !== "admin" && role !== "operator")) {...}`. Satu copy yang missed = privilege escalation.

**Solution:** Buat helper terpusat dengan typed error.

**Implementation Steps:**
1. Buat `src/lib/auth-guard.ts`:
   ```ts
   import { auth } from "@/lib/auth";

   export class ForbiddenError extends Error {}
   export class UnauthorizedError extends Error {}

   export async function requireRole(
     allowed: ("admin" | "operator" | "viewer")[]
   ) {
     const session = await auth();
     if (!session) throw new UnauthorizedError("Not signed in");
     if (!allowed.includes(session.user.role as any)) {
       throw new ForbiddenError(`Requires role: ${allowed.join("|")}`);
     }
     return session;
   }
   ```
2. Buat handler error standar di `src/lib/api-handler.ts`:
   ```ts
   export function withErrorHandler(handler: Function) {
     return async (...args: any[]) => {
       try { return await handler(...args); }
       catch (e) {
         if (e instanceof UnauthorizedError) return Response.json({error: e.message}, {status: 401});
         if (e instanceof ForbiddenError) return Response.json({error: e.message}, {status: 403});
         // ...
       }
     };
   }
   ```
3. Refactor SEMUA route di `src/app/api/` untuk pakai pattern baru.
4. Daftar file yang harus di-update (minimum):
   - `src/app/api/customers/route.ts`
   - `src/app/api/customers/[id]/route.ts`
   - `src/app/api/customers/bulk/route.ts`
   - `src/app/api/customers/export/route.ts`
   - `src/app/api/payments/route.ts`
   - `src/app/api/payments/[id]/route.ts`
   - `src/app/api/packages/route.ts`
   - `src/app/api/packages/[id]/route.ts`
   - `src/app/api/service-requests/route.ts`
   - `src/app/api/service-requests/[id]/route.ts`
   - `src/app/api/settings/route.ts`
   - `src/app/api/settings/test-mikrotik/route.ts`

**Acceptance Criteria:**
- [ ] `grep -rn "session.user.role !==" src/app/api/` returns 0 hits
- [ ] Test: viewer hit POST /api/customers → 403
- [ ] Test: unauthenticated hit GET /api/customers → 401

**Anti-patterns:**
- ❌ Pakai middleware Next.js untuk role check (terlalu kasar — perlu per-route granularity)

---

### FIX-004: Sequence-Based ID Generation

```
├─ Severity: HIGH
├─ Lokasi: src/lib/utils.ts:33-51
├─ Effort: S (≤1 hari)
├─ Dependencies: none
```

**Problem:** Random 4-5 digit ID + UNIQUE constraint = birthday paradox. Pada ~1k customer akan mulai sering 500 error karena collision.

**Solution:** Pakai PostgreSQL sequence atau counter table per-bulan untuk customer/invoice/ticket numbers.

**Implementation Steps:**
1. Buat migration: `CREATE SEQUENCE yby_customer_seq START 1000;`
2. Buat helper:
   ```ts
   export async function nextCustomerNumber(): Promise<string> {
     const result = await db.execute(sql`SELECT nextval('yby_customer_seq')`);
     const num = result[0].nextval;
     return `YBY-${String(num).padStart(5, '0')}`;
   }
   ```
3. Untuk invoice/ticket dengan format per-bulan (`INV-2026-03-0001`): pakai counter table:
   ```sql
   CREATE TABLE counters (
     scope varchar(50) PRIMARY KEY,  -- 'invoice:2026-03', 'ticket:2026-03'
     value bigint NOT NULL DEFAULT 0
   );
   ```
   Dengan helper `nextNumber(scope: string)` yang `INSERT ... ON CONFLICT UPDATE SET value = value + 1 RETURNING value`.
4. Replace `generateRandomId()` di semua call site.

**Acceptance Criteria:**
- [ ] Test: insert 10.000 customer berturut-turut, 0 collision
- [ ] Format ID konsisten: `YBY-00001`, `YBY-00002`, ...
- [ ] Invoice number reset per bulan: `INV-2026-03-0001`

**Anti-patterns:**
- ❌ Pakai UUID (terlalu panjang untuk customer-facing ID)
- ❌ Pakai `Date.now()` (collision jika 2 request ms yang sama)

---

### FIX-005: Wire Service Request Form ke API

```
├─ Severity: HIGH
├─ Lokasi: src/components/forms/service-request-form.tsx:33
├─ Effort: S (≤1 hari)
├─ Dependencies: none
```

**Problem:** Form tidak memanggil API. Submission hilang. Toast success palsu di line 37.

**Solution:** Wire ke `POST /api/service-requests` dengan proper error handling.

**Implementation Steps:**
1. Ganti placeholder submission dengan fetch call ke `/api/service-requests`.
2. Handle 3 state: loading (disable submit, show spinner), success (toast + reset form + redirect), error (toast dengan message dari API).
3. Sambil refactor: convert ke `react-hook-form` + `zodResolver` (sudah ada di dependencies).
4. Tambah e2e Playwright test: isi form → submit → verify row di DB.

**Acceptance Criteria:**
- [ ] Submit form berhasil membuat row di `service_requests` table
- [ ] Network failure → user melihat error message asli, bukan fake success
- [ ] Form fields punya client-side validation feedback (Zod errors per field)

---

### FIX-006: Idempotent MikroTik PPPoE Create

```
├─ Severity: HIGH
├─ Lokasi: src/lib/mikrotik/pppoe.ts:3-19
├─ Effort: S (≤1 hari)
├─ Dependencies: DEBT-001 (consolidate MikroTik client)
```

**Problem:** Retry job PPPoE create akan hit `/ppp/secret/add` lagi dan fail dengan "already exists". Worker treat sebagai gagal final, customer status stuck.

**Solution:** Cek existence sebelum add. Jika ada, update bukan add.

**Implementation Steps:**
1. Refactor `createPPPoEUser`:
   ```ts
   export async function createPPPoEUser(opts: {...}) {
     const existing = await mikrotikQuery('/ppp/secret/print', {
       '?name': opts.name
     });
     if (existing.length > 0) {
       // Update instead
       return mikrotikQuery('/ppp/secret/set', {
         '.id': existing[0]['.id'],
         password: opts.password,
         profile: opts.profile,
         disabled: 'no'
       });
     }
     return mikrotikQuery('/ppp/secret/add', {...});
   }
   ```
2. Apply pattern yang sama untuk delete (graceful jika tidak ada).
3. Test: enqueue create job 3x untuk customer yang sama → harus sukses semua, tidak ada error "already exists".

**Acceptance Criteria:**
- [ ] Job dispatch 3x untuk customer sama → 3x success
- [ ] Hapus customer yang PPPoE-nya sudah dihapus manual di MikroTik → tidak error

---

### FIX-007: Encrypt Sensitive Settings Values

```
├─ Severity: HIGH
├─ Lokasi: src/db/schema/settings.ts, src/lib/settings.ts
├─ Effort: M (2 hari)
├─ Dependencies: none
```

**Problem:** Password MikroTik dan token Fonnte disimpan plaintext di `settings.value varchar(1000)`. DB dump = full credential exposure.

**Solution:** Tambah kolom `value_encrypted boolean` dan flag sensitive keys. Encrypt dengan AES-256-GCM key derived dari `AUTH_SECRET`.

**Implementation Steps:**
1. Migration:
   ```sql
   ALTER TABLE settings ADD COLUMN value_encrypted boolean NOT NULL DEFAULT false;
   ```
2. Helper `src/lib/crypto/settings-cipher.ts`:
   ```ts
   const SENSITIVE_KEYS = ['mikrotik_password', 'fonnte_token', 'midtrans_server_key'];

   export function encryptValue(plaintext: string): string {
     // AES-256-GCM with key derived from AUTH_SECRET via HKDF
     // Return base64(iv + ciphertext + authtag)
   }

   export function decryptValue(ciphertext: string): string { /* ... */ }
   export function isSensitive(key: string): boolean { return SENSITIVE_KEYS.includes(key); }
   ```
3. Refactor `setSetting()` & `getSetting()` di `src/lib/settings.ts` untuk auto-encrypt/decrypt jika key sensitive.
4. Migration script: encrypt existing sensitive values yang sudah di DB.
5. Hapus fallback "DB or env" yang membingungkan — pilih satu strategi.

**Acceptance Criteria:**
- [ ] DB inspection `SELECT value FROM settings WHERE key='mikrotik_password'` → ciphertext base64
- [ ] `getSetting('mikrotik_password')` return plaintext
- [ ] Rotasi `AUTH_SECRET` membuat decrypt gagal (expected — ada migration tooling untuk re-encrypt)

---

### FIX-008: README & Setup Documentation

```
├─ Severity: MEDIUM
├─ Lokasi: README.md
├─ Effort: S (≤1 hari)
├─ Dependencies: none
```

**Problem:** README masih boilerplate `create-next-app`. Maintainer baru tidak tahu cara menjalankan project.

**Solution:** Tulis README minimum yang cover semua hal essential.

**Required Sections:**
1. Overview — apa project ini, target user
2. Prerequisites — Node 20+, PostgreSQL 14+, Redis 7+, MikroTik dengan API enabled
3. Setup steps — clone, `pnpm install`, copy `.env.example` → `.env.local`, edit, `pnpm db:migrate`, `pnpm db:seed`
4. Running — `pnpm dev` (web) + `pnpm worker` (BullMQ worker), atau `pm2 start ecosystem.config.cjs`
5. Architecture diagram (ASCII atau link ke `CLAUDE.md`)
6. Common tasks — add migration, run tests, deploy
7. Troubleshooting — top 5 issue umum

**Acceptance Criteria:**
- [ ] Developer baru bisa setup dari nol < 30 menit
- [ ] Tidak ada langkah "tanya ke owner" di flow setup

---

### FIX-009: Fonnte Timeout & Retry

```
├─ Severity: MEDIUM
├─ Lokasi: src/workers/notification.worker.ts:13
├─ Effort: S (≤1 hari)
├─ Dependencies: none
```

**Problem:** Fetch ke Fonnte tidak ada timeout. Endpoint hang → notification queue stuck selamanya.

**Solution:** `AbortController` dengan timeout 10 detik, biarkan BullMQ retry.

**Implementation Steps:**
1. Wrap fetch:
   ```ts
   const ctrl = new AbortController();
   const timeout = setTimeout(() => ctrl.abort(), 10_000);
   try {
     const res = await fetch(FONNTE_URL, { signal: ctrl.signal, ... });
     // ...
   } finally {
     clearTimeout(timeout);
   }
   ```
2. Tambah idempotency key per notification (UUID) di payload — disimpan di tabel `notification_log` (lihat FEAT-005). Cek sebelum kirim untuk hindari spam jika BullMQ retry setelah Fonnte sebenarnya berhasil tapi response timeout.
3. Standarisasi BullMQ retry config:
   ```ts
   { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
   ```
   untuk SEMUA queue (saat ini inkonsisten — `enqueueCreatePPPoE` punya, yang lain default).

**Acceptance Criteria:**
- [ ] Synthetic test: matikan jaringan ke Fonnte → job fail dalam 11 detik (bukan hang)
- [ ] BullMQ retry config seragam di `src/lib/queue/producer.ts`

---

## Phase 2 — Penguatan Fondasi

**Tujuan:** Test coverage, observability, infra dasar yang membuat refactor di phase berikutnya aman.

---

### DEBT-001: Konsolidasi MikroTik Client

```
├─ Severity: HIGH
├─ Lokasi: src/lib/mikrotik/pool.ts vs src/lib/mikrotik/client.ts
├─ Effort: M (2-3 hari)
├─ Dependencies: none
```

**Problem:** Dua implementasi MikroTik client paralel. `pool.ts` (cached, throws) dipakai read paths. `client.ts` (per-call, return tuple) dipakai worker via `pppoe.ts` & `queue.ts`. Bug fix harus dilakukan dua kali.

**Solution:** `pool.ts` jadi satu-satunya client. `client.ts` dihapus.

**Implementation Steps:**
1. Refactor `src/lib/mikrotik/pppoe.ts` → semua call ganti ke `mikrotikQuery` dari `pool.ts`. Hapus pattern `{success, error}` — throw exceptions.
2. Refactor `src/lib/mikrotik/queue.ts` (RouterOS queue, bukan BullMQ) → sama.
3. Hapus file `src/lib/mikrotik/client.ts`.
4. Update `src/workers/mikrotik.worker.ts` — adapt error handling (catch throws bukan check `result.success`).
5. Pastikan worker dan web process sama-sama bisa pakai pool (mungkin perlu instance pool terpisah per process untuk hindari konflik).

**Acceptance Criteria:**
- [ ] `client.ts` tidak ada lagi
- [ ] Semua MikroTik call di codebase pakai `mikrotikQuery`
- [ ] Worker test: suspend/activate flow tetap jalan

---

### DEBT-002: Test Bedrock — Vitest & Playwright Config

```
├─ Severity: HIGH
├─ Lokasi: vitest.config.ts (new), playwright.config.ts (new), tests/ (new dir)
├─ Effort: M (2-3 hari)
├─ Dependencies: none
```

**Problem:** Vitest & Playwright dideklarasikan tapi tidak ada config. `pnpm vitest` run nothing.

**Solution:** Setup config + tulis test wajib untuk 4 critical flow.

**Implementation Steps:**
1. Buat `vitest.config.ts` dengan `@vitest/coverage-v8`. Setup test DB (PostgreSQL container atau pakai `pg-mem`).
2. Buat `playwright.config.ts` dengan baseURL dev server.
3. Tulis integration test untuk 4 flow kritis:
   - **Flow 1:** Customer create → PPPoE provisioning sukses → record di DB + MikroTik
   - **Flow 2:** Payment record → notification job enqueued
   - **Flow 3:** Status change ke `suspended` → suspend job dispatched ke MikroTik
   - **Flow 4:** Settings update (encrypted) → `getSetting()` return plaintext
4. Tambah script `pnpm test` (vitest) & `pnpm test:e2e` (playwright).

**Acceptance Criteria:**
- [ ] `pnpm test` jalan dan pass minimal 4 test
- [ ] Coverage report tergenerate di `coverage/`
- [ ] Target coverage `src/lib/` > 60% dalam 6 minggu

---

### DEBT-003: Structured Logging dengan Pino

```
├─ Severity: MEDIUM
├─ Lokasi: NEW src/lib/logger.ts, replace console.* repo-wide
├─ Effort: M (2-3 hari)
├─ Dependencies: none
```

**Problem:** `console.log`/`console.error` saja. Tidak ada level, request ID, atau structured context. Production debugging = guesswork.

**Solution:** Pino dengan child loggers per-module + correlation ID propagation.

**Implementation Steps:**
1. Install `pino` + `pino-pretty` (dev only).
2. Buat `src/lib/logger.ts`:
   ```ts
   import pino from 'pino';
   export const logger = pino({
     level: process.env.LOG_LEVEL ?? 'info',
     base: { service: 'yby-net' },
     transport: process.env.NODE_ENV === 'development'
       ? { target: 'pino-pretty' } : undefined,
   });
   ```
3. Generate request ID di Next.js middleware, propagate via `headers()` ke API routes.
4. Untuk BullMQ: tambah `requestId` di job data, log di worker dengan `logger.child({jobId, requestId})`.
5. Replace SEMUA `console.*` di production code (test files boleh tetap).

**Acceptance Criteria:**
- [ ] `grep -rn "console\." src/` (kecuali tests) returns 0
- [ ] Log JSON di production, pretty di dev
- [ ] Trace satu request dari HTTP → API → queue → worker via correlation ID

---

### DEBT-004: Pagination & Index untuk List Endpoints

```
├─ Severity: MEDIUM
├─ Lokasi: Multiple API routes + DB schema
├─ Effort: M (2-3 hari)
├─ Dependencies: none
```

**Problem:**
- `GET /api/customers`, `GET /api/service-requests`, `GET /api/payments` return full table tanpa pagination.
- `GET /api/bandwidth` poll semua active customer setiap interval.
- Tidak ada index manual di FK columns.

**Solution:** Cursor-based pagination + indexes.

**Implementation Steps:**
1. Tambah indexes via migration:
   ```sql
   CREATE INDEX idx_customers_package ON customers(package_id);
   CREATE INDEX idx_customers_status ON customers(status);
   CREATE INDEX idx_payments_customer ON payments(customer_id);
   CREATE INDEX idx_payments_period ON payments(period_month);
   CREATE INDEX idx_payments_status ON payments(status);
   CREATE INDEX idx_activity_customer ON activity_logs(customer_id);
   CREATE INDEX idx_activity_ts ON activity_logs(timestamp DESC);
   CREATE INDEX idx_service_status ON service_requests(status);
   CREATE INDEX idx_service_customer ON service_requests(customer_id);
   ```
2. Refactor list endpoints dengan cursor-based pagination:
   ```ts
   // Query params: ?cursor=<id>&limit=50
   const items = await db.select().from(customers)
     .where(cursor ? gt(customers.id, cursor) : undefined)
     .limit(limit + 1)
     .orderBy(customers.id);
   const hasMore = items.length > limit;
   const data = hasMore ? items.slice(0, -1) : items;
   const nextCursor = hasMore ? data[data.length-1].id : null;
   return Response.json({ data, nextCursor });
   ```
3. Update UI list pages pakai TanStack Table dengan infinite scroll atau page-based.

**Acceptance Criteria:**
- [ ] Test: 10k customer di DB → list endpoint < 500ms
- [ ] EXPLAIN ANALYZE tunjukkan index scan, bukan seq scan
- [ ] UI menampilkan "Load more" atau pagination

---

### DEBT-005: react-hook-form Migration

```
├─ Severity: MEDIUM
├─ Lokasi: src/components/forms/*.tsx
├─ Effort: M (2-3 hari)
├─ Dependencies: none
```

**Problem:** Form pakai plain `FormData`. `react-hook-form` di dependencies tapi tidak dipakai. Tidak ada client-side validation feedback.

**Solution:** Migrasi semua form ke RHF + zodResolver.

**Files to migrate:**
- `src/components/forms/customer-form.tsx`
- `src/components/forms/payment-form.tsx`
- `src/components/forms/package-form.tsx`
- `src/components/forms/service-request-form.tsx` (sudah di-fix di FIX-005)

**Acceptance Criteria:**
- [ ] Semua form pakai `useForm({resolver: zodResolver(...)})`
- [ ] Field-level errors muncul di UI (FormMessage shadcn)
- [ ] Reuse Zod schema dari `src/validators/` — JANGAN duplikasi

---

### DEBT-006: CI Pipeline (GitHub Actions)

```
├─ Severity: MEDIUM
├─ Lokasi: .github/workflows/ci.yml (new)
├─ Effort: S (≤1 hari)
├─ Dependencies: DEBT-002
```

**Problem:** Tidak ada CI. Setiap merge ke main = coin toss apakah build masih jalan.

**Solution:** GitHub Actions dengan typecheck → lint → test → build.

**Workflow Spec:**
```yaml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: {...}, ports: ['5432:5432'] }
      redis: { image: redis:7, ports: ['6379:6379'] }
    steps:
      - checkout
      - setup-node 20 with pnpm cache
      - pnpm install --frozen-lockfile
      - pnpm typecheck
      - pnpm lint
      - pnpm db:migrate (against test DB)
      - pnpm test
      - pnpm build
```

**Acceptance Criteria:**
- [ ] PR ke main otomatis trigger CI
- [ ] CI red → PR diblok dari merge
- [ ] CI < 5 menit total

---

### DEBT-007: Refactor `payments.periodMonth` ke `date`

```
├─ Severity: MEDIUM
├─ Lokasi: src/db/schema/payments.ts, semua kode yang baca/tulis periodMonth
├─ Effort: S-M (1-2 hari)
├─ Dependencies: none
```

**Problem:** `varchar(7)` rawan inkonsistensi (`"2026-3"` vs `"2026-03"` vs `"2026/03"`).

**Solution:** Ubah ke `date` (selalu hari pertama bulan).

**Implementation Steps:**
1. Migration:
   ```sql
   ALTER TABLE payments ADD COLUMN period_month_new date;
   UPDATE payments SET period_month_new = (period_month || '-01')::date;
   ALTER TABLE payments DROP COLUMN period_month;
   ALTER TABLE payments RENAME COLUMN period_month_new TO period_month;
   ALTER TABLE payments ALTER COLUMN period_month SET NOT NULL;
   ```
2. Update Drizzle schema → `date('period_month').notNull()`.
3. Helper `firstDayOfMonth(year, month): Date` di utils.
4. Update validator: input bisa `"YYYY-MM"`, transform ke Date.

**Acceptance Criteria:**
- [ ] Schema tipe `date`
- [ ] Existing data ter-migrate tanpa loss
- [ ] Test: query `WHERE period_month = '2026-03-01'` jalan

---

### DEBT-008: Refactor `settings.value` ke `jsonb`

```
├─ Severity: LOW
├─ Lokasi: src/db/schema/settings.ts
├─ Effort: S-M (1-2 hari)
├─ Dependencies: FIX-007 (encryption)
```

**Problem:** `varchar(1000)` susah untuk setting kompleks (template WA dengan placeholder, jadwal cron, dll).

**Solution:** `jsonb` column dengan helper typed accessor.

**Implementation Steps:**
1. Tambah kolom `value_json jsonb`.
2. Migrate existing data: simple values tetap di `value`, complex values pindah ke `value_json`.
3. Atau, lebih clean: ganti SEMUA ke `jsonb` (string juga bisa simpan di jsonb).
4. Update `getSetting<T>(key): T` dengan generic type.

**Acceptance Criteria:**
- [ ] Setting `notification_templates` bisa simpan object nested dengan placeholder
- [ ] Type-safe accessor

---

## Phase 3 — Otomasi Inti (Tier 1)

**Tujuan:** Hilangkan 70%+ kerja operator. Auto-billing, auto-notification, auto-suspend.

---

### FEAT-001: Refactor Invoice ↔ Payment Menjadi 2 Entitas

```
├─ Tier: 1
├─ Impact: 4 / Effort: 2 / ROI: 2.0
├─ Lokasi: src/db/schema/invoices.ts (new), refactor payments.ts
├─ Effort: M (3-4 hari)
├─ Dependencies: DEBT-007
```

**Problem:** Saat ini "tagihan" dan "pembayaran" digabung di table `payments`. Tagihan unpaid = row dengan `status='pending'`. Konsekuensi: sulit handle pembayaran sebagian, satu pembayaran untuk multiple invoice, riwayat tagihan vs riwayat pembayaran tercampur.

**Solution:** Pisah jadi 2 entitas berbeda dengan relasi 1:N (satu invoice bisa punya banyak payment partial).

**Schema Baru:**
```ts
// src/db/schema/invoices.ts
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  periodMonth: date('period_month').notNull(),  // first day of month
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
  dueDate: date('due_date').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // unpaid|partial|paid|void
  packageSnapshot: jsonb('package_snapshot').notNull(), // {id, name, price, speedMbps}
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// payments refactored
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  receiptNumber: varchar('receipt_number', { length: 50 }).notNull().unique(),
  invoiceId: integer('invoice_id').references(() => invoices.id).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  method: varchar('method', { length: 30 }).notNull(), // cash|transfer|qris|midtrans
  paymentDate: timestamp('payment_date', { withTimezone: true }).notNull(),
  receivedBy: integer('received_by').references(() => users.id),
  reference: varchar('reference', { length: 100 }), // bank ref / midtrans order_id
  notes: text('notes'),
});
```

**Implementation Steps:**
1. Buat migration untuk schema baru.
2. Migrasi data: existing `payments` jadi `invoices` (status `unpaid`/`paid`) + `payments` (jika `paid_at` ada).
3. Refactor API routes:
   - `POST /api/invoices` (manual create — biasanya dipakai untuk invoice ad-hoc)
   - `GET /api/invoices` (list dengan filter status, customer, period)
   - `POST /api/payments` (record pembayaran ke invoice spesifik)
   - Endpoint lama `POST /api/payments` di-deprecate atau jadi shortcut "create invoice + record payment in one shot".
4. Trigger update `invoices.amountPaid` & `invoices.status` setiap kali payment dibuat:
   - `amountPaid + payment.amount >= invoice.amount` → status `paid`
   - `amountPaid > 0 && < amount` → `partial`
5. UI: pisah halaman `/invoices` (semua tagihan) dan `/payments` (semua transaksi). Customer detail page tampilkan keduanya.

**Acceptance Criteria:**
- [ ] Bisa create invoice tanpa langsung dibayar
- [ ] Bisa record 2 payment partial → invoice status auto-update ke `partial` lalu `paid`
- [ ] Test: laporan piutang (sum unpaid invoices) akurat

---

### FEAT-002: Billing Engine Otomatis (Auto-Invoice + Auto-Suspend + Auto-Reactivate)

```
├─ Tier: 1 (PALING PRIORITAS)
├─ Impact: 5 / Effort: 2 / ROI: 2.5
├─ Lokasi: src/workers/billing.worker.ts (new), src/lib/queue/billing.ts (new)
├─ Effort: M-L (1 minggu)
├─ Dependencies: FEAT-001, FIX-002
```

**Problem:** Operator manual generate invoice tiap awal bulan, manual suspend customer telat bayar, manual aktifkan setelah bayar. Total ~10-20 jam/bulan kerja repetitif.

**Solution:** BullMQ repeatable job untuk semua siklus billing.

**Implementation Steps:**

1. **Setup queue baru:** `src/lib/queue/billing.ts`
   ```ts
   export const billingQueue = new Queue('billing', { connection });

   // Repeatable jobs (idempotent — boleh fire multiple kali per hari)
   await billingQueue.add('generate-monthly-invoices', null, {
     repeat: { pattern: '0 1 1 * *' }  // Tanggal 1, jam 01:00
   });
   await billingQueue.add('check-overdue', null, {
     repeat: { pattern: '0 8 * * *' }   // Setiap hari, jam 08:00
   });
   ```

2. **Worker `src/workers/billing.worker.ts`:**

   **Job: `generate-monthly-invoices`**
   - Query semua customer dengan `status='active'`
   - Untuk tiap customer, cek apakah invoice untuk `periodMonth = startOfMonth(now)` sudah ada
   - Jika belum, create invoice dengan `dueDate = startOfMonth + 10 hari`, `packageSnapshot = customer.package`
   - Log hasil ke `audit_logs`

   **Job: `check-overdue`**
   - Query invoices `status IN ('unpaid','partial') AND dueDate < now - graceDays`
   - Untuk tiap invoice unpaid:
     - Hitung hari telat
     - Sesuai grace days di settings (default 7), enqueue suspend job ke `mikrotikQueue`
     - Update `customers.status = 'suspended'`
     - Enqueue notification "layanan dinonaktifkan"

   **Trigger ketika payment in `paid`:**
   - Setelah invoice status berubah jadi `paid` (via FEAT-001 trigger), cek apakah customer status `suspended`
   - Jika ya, enqueue activate PPPoE + update `activeUntil += 1 bulan` + set `status = 'active'` + notify

3. **Settings baru di tabel `settings`:**
   ```
   billing.invoice_generation_day: 1
   billing.due_days_after_invoice: 10
   billing.grace_days_after_due: 7
   billing.auto_suspend_enabled: true
   ```

4. **UI:**
   - Page `/billing/runs` untuk lihat history execution billing engine
   - Toggle di settings untuk disable auto-suspend (manual mode untuk testing)

**Acceptance Criteria:**
- [ ] Tanggal 1 jam 01:00 → semua customer aktif punya invoice baru
- [ ] Customer telat bayar > grace days → otomatis suspended di MikroTik + notif terkirim
- [ ] Customer bayar via portal/manual → auto-reactivate dalam < 1 menit
- [ ] Test: simulasi 1 siklus penuh (create customer → invoice → tunggu jatuh tempo → suspend → bayar → activate)

**Anti-patterns:**
- ❌ Cron OS-level (rentan timezone, tidak observable). Pakai BullMQ repeatable.
- ❌ Suspend tanpa grace period
- ❌ Generate invoice sebelum customer didaftarkan minimal 1 hari (mungkin masih pending provisioning)

---

### FEAT-003: Audit Log Terpusat

```
├─ Tier: 1
├─ Impact: 4 / Effort: 1 / ROI: 4.0
├─ Lokasi: src/db/schema/audit_logs.ts (new), src/lib/audit.ts (new)
├─ Effort: S-M (2 hari)
├─ Dependencies: none
```

**Problem:** Multi-operator → tidak ada akuntabilitas siapa edit apa kapan. Tidak bisa investigate "siapa yang ubah harga paket?". Tabel `activity_logs` yang ada hanya untuk PPPoE event, bukan user action.

**Solution:** Tabel `audit_logs` terpisah + helper `withAudit()` wrapper.

**Schema:**
```ts
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(), // 'customer.create', 'package.update', dll
  entity: varchar('entity', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }),
  before: jsonb('before'),  // null untuk create
  after: jsonb('after'),    // null untuk delete
  ip: varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});
```

**Helper:**
```ts
export async function withAudit<T>(
  ctx: { userId: number; ip: string; userAgent: string },
  action: string,
  entity: string,
  entityId: string,
  fn: () => Promise<{ before?: any; after?: any; result: T }>
): Promise<T> {
  const { before, after, result } = await fn();
  await db.insert(auditLogs).values({
    userId: ctx.userId, action, entity, entityId,
    before: before ?? null, after: after ?? null,
    ip: ctx.ip, userAgent: ctx.userAgent,
  });
  return result;
}
```

**Wajib di-audit (minimum):**
- customer.create / update / delete / suspend / activate
- package.create / update / delete
- payment.create / update / void
- invoice.create / void
- settings.update
- user.create / update / delete / role-change

**UI:** Page `/audit-logs` (admin only) dengan filter user, entity, date range.

**Acceptance Criteria:**
- [ ] Setiap action di list di atas tercatat
- [ ] `before` dan `after` accurate
- [ ] Filter di UI berfungsi
- [ ] Test: edit customer name → audit_logs row ada dengan diff yang benar

---

### FEAT-004: Job History Persisted

```
├─ Tier: 1
├─ Impact: 3 / Effort: 1 / ROI: 3.0
├─ Lokasi: src/db/schema/mikrotik_jobs.ts (new)
├─ Effort: S (1-2 hari)
├─ Dependencies: none
```

**Problem:** BullMQ default expire job dalam 24 jam di Redis. Setelah itu, history hilang. Tidak bisa investigate "kenapa internet customer X mati 3 hari lalu?".

**Solution:** Snapshot job ke DB pada saat completed/failed.

**Schema:**
```ts
export const mikrotikJobs = pgTable('mikrotik_jobs', {
  id: serial('id').primaryKey(),
  bullJobId: varchar('bull_job_id', { length: 50 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),  // 'create', 'suspend', 'activate', 'delete', 'set_queue'
  customerId: integer('customer_id').references(() => customers.id),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // pending|running|completed|failed
  attempts: integer('attempts').notNull().default(0),
  error: text('error'),
  durationMs: integer('duration_ms'),
  enqueuedAt: timestamp('enqueued_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
```

**Implementation:**
1. Saat enqueue: insert row dengan status `pending`.
2. Worker `onActive`: update `status='running'`.
3. Worker `onCompleted`: update status, durationMs, completedAt.
4. Worker `onFailed`: update status, error, attempts.

**UI:**
- Page `/jobs` dengan filter customer, type, status, date.
- Customer detail page: timeline event MikroTik per customer.

**Acceptance Criteria:**
- [ ] Setiap job ter-record dari enqueue sampai final state
- [ ] Filter "customer X dalam 30 hari terakhir" return semua job
- [ ] Failed job menampilkan error message yang readable

---

### FEAT-005: Notifikasi Multi-Stage WhatsApp

```
├─ Tier: 1
├─ Impact: 4 / Effort: 2 / ROI: 2.0
├─ Lokasi: src/lib/notifications/, src/db/schema/notification_log.ts (new)
├─ Effort: M (3-4 hari)
├─ Dependencies: FEAT-001, FEAT-002, DEBT-008
```

**Problem:** Saat ini reminder WA hanya satu jenis. Tidak ada series welcome, tidak ada multi-stage reminder, tidak ada idempotency (rentan spam).

**Solution:** Template engine + scheduler + log idempoten.

**Schema:**
```ts
export const notificationLog = pgTable('notification_log', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  templateKey: varchar('template_key', { length: 50 }).notNull(),
  context: jsonb('context').notNull(),  // {invoiceId, etc}
  idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull(), // sent|failed|pending
  sentAt: timestamp('sent_at', { withTimezone: true }),
  fonnte_response: jsonb('fonnte_response'),
});
```

**Templates (di settings.value_json `notification.templates`):**
```json
{
  "due_h_minus_3": "Halo {{name}}, tagihan {{period}} sebesar {{amount}} jatuh tempo {{dueDate}}. Bayar di: {{paymentLink}}",
  "due_today": "...",
  "overdue_h3": "...",
  "suspended": "...",
  "payment_received": "...",
  "welcome_1_after_signup": "...",
  "welcome_2_first_week": "...",
  "welcome_3_first_month": "..."
}
```

**Trigger sources:**
- BullMQ repeatable harian: scan invoices untuk H-3, H-0, H+3, H+7
- Event-driven: payment created → `payment_received`, customer created → enqueue welcome series dengan delay
- Suspend job completed → `suspended` notification

**Idempotency Key Pattern:**
- `due_h_minus_3:invoice_123` — key per invoice + stage. Cek sebelum kirim. Kalau sudah pernah → skip.

**UI:**
- Settings page: editor template (pakai `react-hook-form` + textarea) dengan preview placeholder.
- Page `/notifications/log` untuk lihat history.

**Acceptance Criteria:**
- [ ] Edit template tanpa deploy
- [ ] Customer X tidak menerima reminder H-3 untuk invoice yang sama lebih dari 1 kali (idempoten)
- [ ] Welcome series 3 pesan terkirim sesuai schedule (H+0, H+7, H+30)
- [ ] Test: matikan Fonnte → job retry, tapi setelah 3x fail status `failed` di log

---

## Phase 4 — Customer Experience (Tier 2)

**Tujuan:** Pelanggan bisa self-service, bayar online, mendapatkan info real-time. Operator hanya handle exception.

---

### FEAT-006: Customer Self-Service Portal

```
├─ Tier: 2
├─ Impact: 5 / Effort: 3 / ROI: 1.67
├─ Lokasi: src/app/(portal)/* (new route group)
├─ Effort: L (2 minggu)
├─ Dependencies: FEAT-001, FEAT-005
```

**Apa:** Portal pelanggan terpisah dari dashboard operator.

**Auth:** Nomor HP + OTP via Fonnte. NextAuth provider kustom.

**Pages:**
- `/portal/login` — masukkan nomor HP → OTP via WA
- `/portal` — dashboard (tagihan terbaru, status layanan, paket aktif)
- `/portal/invoices` — list tagihan (paid + unpaid), download PDF receipt
- `/portal/invoices/[id]/pay` — pilih metode bayar, redirect ke Midtrans/Xendit (dependency FEAT-007)
- `/portal/service-requests/new` — submit gangguan
- `/portal/service-requests` — track status tiket
- `/portal/profile` — edit kontak, ubah password OTP

**Security:**
- Rate limit OTP: max 3 request per nomor per 10 menit
- Session pakai cookie httpOnly, secure, samesite=lax
- API portal terpisah di `/api/portal/*` dengan guard `requirePortalSession()`

**Acceptance Criteria:**
- [ ] Customer login dengan OTP < 30 detik
- [ ] Tagihan akurat (matches database)
- [ ] Submit service request → tercipta row, operator dapat notif
- [ ] Test: customer A tidak bisa lihat tagihan customer B (authorization)

---

### FEAT-007: Payment Gateway Integration

```
├─ Tier: 2
├─ Impact: 5 / Effort: 3 / ROI: 1.67
├─ Lokasi: src/lib/payment-gateway/ (new)
├─ Effort: L (1-2 minggu)
├─ Dependencies: FEAT-001, FEAT-006
```

**Provider rekomendasi:** Midtrans Snap (dokumentasi paling lengkap di ID) atau Xendit (fee QRIS lebih kompetitif).

**Flow:**
1. Customer di portal klik "Bayar" → POST `/api/portal/invoices/[id]/checkout`
2. Backend: call Midtrans Snap API → dapat `transaction_token` + `redirect_url`
3. Frontend redirect ke `redirect_url` (Midtrans hosted page)
4. Customer bayar via QRIS / VA / e-wallet
5. Midtrans webhook → `POST /api/webhooks/midtrans` → verify signature → mark invoice paid → enqueue activate-PPPoE

**Implementation Steps:**

1. **Settings (encrypted via FIX-007):**
   ```
   payment.midtrans_server_key
   payment.midtrans_client_key
   payment.midtrans_is_production: false
   ```

2. **Module `src/lib/payment-gateway/midtrans.ts`:**
   - `createTransaction(invoice, customer)` → return Snap token + URL
   - `verifyWebhookSignature(payload, signature)` — wajib, ini security critical
   - `mapStatus(midtransStatus)` → internal status

3. **Webhook handler `src/app/api/webhooks/midtrans/route.ts`:**
   - Verify signature (jangan trust payload)
   - Idempotency check: cek `payments.reference = order_id` sudah ada → skip
   - Mark invoice paid, create payment row, trigger reactivate

4. **Receipt PDF:** Setelah paid, generate PDF receipt pakai `@react-pdf/renderer`. Simpan di S3 (atau MinIO local). Link di portal.

**Acceptance Criteria:**
- [ ] Customer bayar QRIS jam 11 malam → invoice paid + layanan aktif dalam < 2 menit
- [ ] Webhook tampered → ditolak (signature mismatch)
- [ ] Webhook duplicate (Midtrans retry) → tidak double-credit invoice
- [ ] PDF receipt bisa di-download

---

### FEAT-008: 2FA + Rate Limiting + Security Hardening

```
├─ Tier: 2
├─ Impact: 4 / Effort: 2 / ROI: 2.0
├─ Lokasi: NextAuth config, middleware, src/lib/rate-limit.ts (new)
├─ Effort: M (3-4 hari)
├─ Dependencies: none
```

**Items:**

1. **2FA TOTP** untuk role `admin`:
   - Pakai `otpauth` library
   - Setup flow di `/settings/security`: scan QR → input 6 digit → enable
   - Login: setelah password OK → tampilkan input TOTP
   - Backup codes 10x sekali pakai

2. **Rate limiting** pakai Redis (sudah ada):
   - `/api/auth/*`: 5 attempt per IP per 15 menit
   - `/api/portal/login`: 3 OTP request per nomor per 10 menit
   - `/api/portal/*` lainnya: 100 req/menit per session
   - Helper `rateLimit(key, limit, windowSec)` return `{allowed, remaining}`

3. **Security headers** di `next.config.ts`:
   ```
   Content-Security-Policy
   X-Frame-Options: DENY
   X-Content-Type-Options: nosniff
   Strict-Transport-Security
   ```

4. **Backup PostgreSQL terjadwal:**
   - Cron daily `pg_dump` ke S3/MinIO
   - Retention 30 hari
   - Monitoring: alert WA jika backup gagal 2 hari berturut

**Acceptance Criteria:**
- [ ] Admin tanpa 2FA tidak bisa login (force enable on first admin signup)
- [ ] Brute force login 6x → IP blocked 15 menit
- [ ] Backup berhasil tiap hari, restore ter-test bulanan

---

### FEAT-009: Network Health Monitor + Alerting

```
├─ Tier: 2
├─ Impact: 4 / Effort: 3 / ROI: 1.33
├─ Lokasi: src/workers/monitor.worker.ts (new)
├─ Effort: M-L (1 minggu)
├─ Dependencies: DEBT-001
```

**Apa:** Worker baru poll RouterOS tiap 1 menit. Simpan metrics. Alert jika anomali.

**Metrics yang dipoll:**
- `/ppp/active/print` → count active PPPoE
- `/interface/print stats` → traffic in/out per interface
- `/system/resource/print` → CPU, RAM, uptime
- `/queue/simple/print` → traffic per customer (jika queue per-user)

**Schema:**
```ts
export const networkMetrics = pgTable('network_metrics', {
  id: serial('id').primaryKey(),
  metricType: varchar('metric_type', { length: 30 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }), // customerId, interfaceName, atau null untuk global
  value: decimal('value', { precision: 20, scale: 4 }).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
});
// Index: (metric_type, entity_id, timestamp DESC)
// Pertimbangkan partition by month untuk volume tinggi
```

**Alerting rules (configurable di settings):**
- Active count drop > 30% dalam 5 menit → notify admin
- CPU > 90% selama 5 menit → notify
- Customer offline > 1 jam saat seharusnya aktif → notify customer + log ke service request

**Visualisasi:** Page `/monitoring` dengan Recharts time-series.

**Acceptance Criteria:**
- [ ] Metrics terkumpul tiap menit
- [ ] Alert terkirim ke admin via WA saat anomali
- [ ] Dashboard menampilkan grafik 24 jam terakhir

---

### FEAT-010: Activity Log dari MikroTik Real

```
├─ Tier: 2
├─ Impact: 3 / Effort: 2 / ROI: 1.5
├─ Lokasi: src/workers/activity-log.worker.ts (new)
├─ Effort: M (2-3 hari)
├─ Dependencies: FEAT-009
```

**Problem:** Tabel `activity_logs` ada tapi tidak diisi. UI page hard-coded mock.

**Solution:** Worker poll `/log/print ?topics=ppp` setiap 5 menit, persist event PPPoE login/logout dengan IP, MAC, NAS port, framed-IP, termination reason.

**Implementation Steps:**
1. Tambah kolom di `activity_logs`:
   ```
   framedIp varchar(45)
   nasPort varchar(50)
   terminationReason varchar(50)
   bytesIn bigint  -- ganti dari decimal
   bytesOut bigint
   ```
2. Worker logic: dedup pakai timestamp + customer + event type sebagai natural key.
3. Refactor `src/app/(dashboard)/activity-logs/page.tsx` → fetch dari `/api/activity-logs` (yang juga harus dibuat).

**Acceptance Criteria:**
- [ ] Customer login PPPoE → row tercipta dalam 5 menit
- [ ] UI menampilkan data real
- [ ] Mock data dihapus

---

## Phase 5 — Diferensiasi & Skala (Tier 3)

**Tujuan:** Membedakan YBY NET dari kompetitor RT/RW Net lokal lainnya. Ekspansi & insight strategis.

---

### FEAT-011: PWA Teknisi Lapangan

```
├─ Tier: 3
├─ Impact: 4 / Effort: 3 / ROI: 1.33
├─ Lokasi: src/app/(field)/* (new route group)
├─ Effort: L (2 minggu)
├─ Dependencies: FEAT-006 pattern auth
```

Mobile-first PWA untuk teknisi:
- List tugas hari ini (assigned ke user role `technician`)
- GPS check-in saat tiba di lokasi
- Upload foto sebelum/sesudah (ODP, kabel, ONU) ke S3/MinIO
- OCR serial ONU via kamera (opsional, manual input fine)
- Tanda tangan digital pelanggan via canvas
- Offline support pakai service worker + IndexedDB sync

**Acceptance Criteria:**
- [ ] Teknisi bisa kerja offline, sync saat online
- [ ] Foto + GPS + signature tersimpan
- [ ] Operator bisa lihat dokumentasi instalasi

---

### FEAT-012: Manajemen Aset & Topologi

```
├─ Tier: 3
├─ Impact: 3 / Effort: 4 / ROI: 0.75
├─ Effort: L (2-3 minggu)
├─ Dependencies: none
```

Tabel `network_devices` (ODP, ODC, splitter, OLT) dengan koordinat lat/lng, kapasitas, port. Customer di-link ke ODP. Visualisasi map pakai Leaflet + OpenStreetMap (gratis).

Saat ada gangguan di ODP X → langsung tahu customer mana yang terdampak → proactive notification.

---

### FEAT-013: Multi-Tenant / Multi-Router

```
├─ Tier: 3
├─ Effort: XL (1 bulan+)
├─ Dependencies: FIX-007, semua FEAT-001 s/d FEAT-010 stable
```

Refactor agar satu DB melayani banyak router/tenant. Tambah `tenant_id` di semua table. `mikrotik/pool.ts` terima `routerId` dari context.

**JANGAN dikerjakan kecuali ada permintaan ekspansi nyata.** Jika single-tenant lifetime, ini over-engineering.

---

### FEAT-014: AI-Powered Insights

```
├─ Tier: 3
├─ Effort: L (2-3 minggu)
├─ Dependencies: FEAT-005 (history data), FEAT-009 (network metrics)
```

3 sub-feature:
1. **Churn prediction:** Logistic regression dari fitur (umur langganan, jumlah tiket, hari telat bayar). Flag risiko churn → automated retention WA.
2. **Bandwidth anomaly:** Customer rumah tangga upload 100GB tiba-tiba → kemungkinan kompromi router. Notify.
3. **Tiket auto-categorization:** Klasifikasi keluhan WA masuk via Claude API atau model lokal (sudah ada Ollama di home server). Auto-create service request dengan kategori yang benar.

---

### FEAT-015: WhatsApp Bot Dua Arah

```
├─ Tier: 3
├─ Effort: M (1 minggu)
├─ Dependencies: FEAT-005, Fonnte webhook config
```

Customer kirim:
- "tagihan" → bot balas saldo + link bayar
- "lapor gangguan" → bot guide isi data → auto-create service request
- Lainnya → bot escalate ke admin

---

### FEAT-016: Financial Module Lanjutan

```
├─ Tier: 3
├─ Effort: M (1 minggu)
├─ Dependencies: FEAT-001, FEAT-002 (data history minimal 3 bulan)
```

- ARPU, MRR, churn rate dashboard
- Cohort retention chart
- Export ke format jurnal akuntansi (Excel/CSV)
- Komisi referral pelanggan (kode referral + diskon bulan berikutnya)

---

## 9. Definition of Done per Phase

### Phase 1 DoD
- [ ] Semua FIX-001 s/d FIX-009 acceptance criteria checked
- [ ] Tidak ada hard-coded credentials di codebase (CI grep check)
- [ ] Tidak ada mock data di production pages
- [ ] CI berjalan (typecheck + build minimal — test belum wajib di phase 1)
- [ ] README cukup untuk onboarding developer baru

### Phase 2 DoD
- [ ] Test coverage `src/lib/` ≥ 60%
- [ ] Test coverage `src/app/api/` ≥ 60%
- [ ] Structured logging di seluruh production code
- [ ] Semua list endpoint pakai pagination + index
- [ ] CI pipeline green dan blocking merge

### Phase 3 DoD
- [ ] Auto-billing jalan 1 siklus penuh tanpa intervensi manual
- [ ] Audit log mencatat semua mutasi penting
- [ ] Job history bisa di-query untuk customer apapun
- [ ] Notifikasi multi-stage idempoten (test: dispatch 5x, hanya 1 yang sampai)

### Phase 4 DoD
- [ ] Customer bisa bayar online dan layanan auto-aktif
- [ ] Portal handle minimal 100 concurrent customer
- [ ] 2FA wajib untuk admin
- [ ] Backup harian + restore ter-test

### Phase 5 DoD
- Per-feature, tidak ada DoD agregat (semua optional/strategic)

---

## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migrasi schema (FEAT-001) breaks production data | Medium | High | Test migration di staging dengan dump production. Backup sebelum migrate. Reversible migration. |
| Webhook payment gateway tampered → fake payment | Low | Critical | Verify signature WAJIB. Idempotency check. Manual reconciliation harian (FEAT-016). |
| OTP via WA disalahgunakan (bombing) | Medium | Medium | Rate limit ketat (FEAT-008), captcha kalau >2x request, 15-menit cooldown. |
| MikroTik queue backlog saat batch operation 1k+ customer | Medium | High | Concurrency tetap 1, tapi tambah priority queue. Monitor backlog di FEAT-009. |
| Kehilangan AUTH_SECRET → semua encrypted setting tidak bisa di-decrypt | Low | Critical | Backup secret di password manager. Documented rotation procedure. |
| Worker crash silent → billing engine tidak jalan | Medium | High | PM2 auto-restart + healthcheck endpoint + alert WA jika worker offline >5 menit. |
| Single-router assumption broken kalau ekspansi | Low (untuk YBY) | High | Refactor multi-tenant (FEAT-013) sebelum onboard router kedua. |

---

## 11. Open Questions yang Harus Dijawab Maintainer

Pertanyaan ini mempengaruhi prioritas dan scope. Jawab sebelum mulai eksekusi:

1. **Deadline.** Apakah ada hard date (sidang skripsi, customer go-live)? Ini mempengaruhi urutan A vs B track significantly.

2. **Scale target.** Berapa customer di launch dan 12 bulan ke depan? 50 vs 5000 mengubah apakah DEBT-004 (pagination/index) wajib di Phase 1 atau bisa ditunda.

3. **Single vs multi-tenant.** Apakah project ini selamanya YBY NET only, atau ada rencana onboard ISP lain? Kalau multi-tenant in scope, `tenant_id` harus ditambahkan SEKARANG di semua schema, bukan nanti.

4. **MikroTik change ownership.** Siapa yang ubah konfigurasi router — aplikasi saja, atau network engineer juga manual? Kalau dua-duanya, worker harus handle drift gracefully (PPPoE secret yang dihapus manual, queue yang di-rename, dll).

5. **`.env` di git.** `ls -la` menunjukkan `.env` ada di disk. Pastikan `.gitignore` benar-benar exclude. Kalau `.env` pernah ke-commit di `cfd1640`, **rotate semua secret SEKARANG** (MikroTik password, Fonnte token, AUTH_SECRET, DB password).

---

## 📌 Cara Pakai Dokumen Ini untuk AI

**Untuk Cline / Continue / Cursor:**

1. Letakkan dokumen ini di root project sebagai `IMPLEMENTATION_MASTER_PLAN.md`.
2. Saat memulai sesi AI, beri instruksi:
   ```
   Baca IMPLEMENTATION_MASTER_PLAN.md. Saat ini saya mau mengerjakan task [TASK-ID].
   Ikuti aturan di Section 2 (Prinsip Implementasi) dengan ketat.
   Sebelum mulai coding, baca seluruh task card untuk task tersebut, cek dependencies-nya,
   dan konfirmasikan ke saya bahwa dependencies sudah selesai.
   ```
3. Untuk verifikasi selesai:
   ```
   Verifikasi setiap acceptance criteria di TASK-ID telah terpenuhi. 
   Tunjukkan output test atau grep yang membuktikannya.
   ```

**Untuk batch execution (mis. autonomous agent):**

```
Jalankan Phase 1 (FIX-001 s/d FIX-009) secara berurutan. Untuk setiap task:
1. Baca task card
2. Verifikasi dependencies selesai
3. Implement
4. Run acceptance criteria
5. Commit dengan message format: "fix(scope): TASK-ID — summary"
6. Lapor status ke saya sebelum mulai task berikutnya.

Hentikan dan tanya jika:
- Dependencies belum selesai
- Acceptance criteria gagal setelah 2 attempt
- Ada ambiguitas yang tidak terjawab di dokumen
```

---

*Dokumen ini adalah living document. Update di akhir setiap phase berdasarkan learnings.*

**Next action:** Jawab Open Questions di Section 11, lalu mulai dari **FIX-001**.
