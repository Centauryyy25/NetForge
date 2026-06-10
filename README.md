# NetForge

Open-source ISP management platform for RT/RW Net operators.
Customers, billing, bandwidth, tickets — all in one place.

Built for **YBY NET**, an RT/RW Net ISP in Bogor, Indonesia.
Manages customers, payments, bandwidth (via MikroTik API), service requests,
activity logs, billing notifications (WhatsApp), and financial reports.

Target users: **admin** and **operator** at the ISP office, plus field
**technicians** (three-role RBAC).

For full architecture and design decisions, see [`CLAUDE.md`](./CLAUDE.md)
and [`docs/IMPLEMENTATION_MASTER_PLAN.md`](./docs/IMPLEMENTATION_MASTER_PLAN.md).

---

## Prerequisites

- **Node.js** 20+ (LTS)
- **pnpm** 9+
- **PostgreSQL** 14+
- **Redis** 7+
- **MikroTik RouterOS** dengan API service enabled (port 8728 default)
- (Production) **PM2** untuk process management

---

## Setup (≤ 30 menit dari clone)

```bash
# 1. Clone & install
git clone <repo-url> si-ybynet && cd si-ybynet
pnpm install

# 2. Konfigurasi environment
cp .env.example .env
# edit .env — minimal: AUTH_SECRET, DATABASE_URL, REDIS_URL, MIKROTIK_*
# generate AUTH_SECRET: openssl rand -base64 32

# 3. Migrasi database
pnpm db:migrate

# 4. (Opsional) Seed data dummy untuk dev
pnpm db:seed

# 5. (Opsional, kalau sudah pernah isi settings plaintext lama)
pnpm encrypt-settings
```

---

## Running

### Dev mode (dua terminal)

```bash
# Terminal 1 — Next.js app
pnpm dev                  # http://localhost:3000

# Terminal 2 — BullMQ worker (MikroTik + WhatsApp)
pnpm worker
```

### Production (PM2)

```bash
pnpm build
pm2 start ecosystem.config.cjs
```

PM2 menjalankan **dua process**: web (`next start`) di port 3000 dan
`worker` (BullMQ consumer) sebagai process terpisah. Nginx di depan
sebagai reverse proxy.

Login awal pakai user yang dibuat oleh `pnpm db:seed` (lihat
`src/db/seed.ts`).

---

## Arsitektur (ringkas)

```
Browser  ─────►  Next.js (App Router, RSC)
                     │
                     ├──► API Routes  ─►  PostgreSQL (Drizzle ORM)
                     │                       │
                     │                       └──► counters / sequence (FIX-004)
                     │
                     └──► BullMQ enqueue
                                │
                                ▼
                     Redis (job queue)
                                │
                ┌───────────────┴────────────────┐
                ▼                                ▼
       MikroTik worker               Notification worker
       (PPPoE, queue ops             (Fonnte WhatsApp,
        via pool.ts)                  timeout 10s)
                │                                │
                ▼                                ▼
       MikroTik RouterOS                 Fonnte API
```

**Detail per modul:** [`CLAUDE.md`](./CLAUDE.md). **Roadmap & task list:**
[`docs/IMPLEMENTATION_MASTER_PLAN.md`](./docs/IMPLEMENTATION_MASTER_PLAN.md).

---

## Common Tasks

### Tambah migrasi schema

```bash
# 1. Edit src/db/schema/<file>.ts
# 2. Generate migration
pnpm db:generate
# 3. Review file di drizzle/migrations/, lalu apply
pnpm db:migrate
```

### Run tests

```bash
pnpm test                  # Vitest (unit + integration mock-based)
pnpm exec tsc --noEmit     # TypeScript type check
pnpm lint                  # ESLint
```

### Inspect DB

```bash
pnpm db:studio             # browser UI Drizzle Studio
```

### Rotate `AUTH_SECRET`

`AUTH_SECRET` dipakai untuk encrypt sensitive settings (MikroTik password,
Fonnte token). Setelah rotasi, decrypt akan gagal — re-encrypt dengan:

```bash
# 1. Set settings plaintext via UI Pengaturan (atau seed ulang)
# 2. Dengan AUTH_SECRET baru sudah aktif:
pnpm encrypt-settings
```

### Deploy ke server

1. SSH ke server (`10.10.20.3`, VLAN 20)
2. `git pull`
3. `pnpm install --frozen-lockfile`
4. `pnpm build`
5. `pnpm db:migrate`
6. `pm2 reload ecosystem.config.cjs`

---

## Troubleshooting

| Gejala | Kemungkinan penyebab | Cara cek / fix |
|---|---|---|
| `Error: AUTH_SECRET is required to encrypt/decrypt settings` saat boot | `.env` belum punya `AUTH_SECRET` | Generate: `openssl rand -base64 32`, isi `AUTH_SECRET=...` di `.env` |
| `MikroTik belum dikonfigurasi` di log worker | Settings table kosong / migration belum jalan | Login admin → Pengaturan → isi host/port/user/password, atau `pnpm db:seed` |
| Worker tidak proses job (queue numpuk di Redis) | `pnpm worker` tidak jalan, atau Redis down | `pm2 status` / `redis-cli ping` |
| Customer create sukses tapi PPPoE tidak masuk RouterOS | MikroTik unreachable atau credentials salah | Cek `customers.status` — kalau `provisioning_failed`, klik "Retry Provisioning" di detail page (FIX-002) |
| `relation "yby_customer_seq" does not exist` saat insert customer | Migration 0005 belum di-apply | `pnpm db:migrate` |

---

## Project layout

```
src/
├── app/                  # Next.js App Router (pages + api/)
├── components/           # React components (UI + forms + tables)
├── db/                   # Drizzle schema + client
├── lib/                  # Auth, settings, crypto, queue, mikrotik, ids
├── validators/           # Zod schemas (separate from DB schema)
└── workers/              # BullMQ consumers (separate process)
drizzle/migrations/       # SQL migrations (auto-generated)
scripts/                  # One-shot ops scripts (encrypt-settings, …)
docs/                     # Engineering docs & implementation plan
```
