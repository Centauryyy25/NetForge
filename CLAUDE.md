# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ **Read the import above first.** This repo runs **Next.js 16.2.2 + React 19** —
> App Router APIs and conventions differ from older Next.js. When unsure about a Next.js
> API, read the bundled guide in `node_modules/next/dist/docs/` before writing code.

NetForge is an ISP management platform for an RT/RW Net operator (YBY NET, Bogor). User-facing
strings are **Bahasa Indonesia**; keep that at call sites.

## Commands

```bash
pnpm dev                 # Next.js dev server (http://localhost:3000)
pnpm worker              # BullMQ consumer — SEPARATE process, required for jobs to run
pnpm build               # production build (Next standalone output)
pnpm lint                # ESLint
pnpm exec tsc --noEmit   # type check
pnpm test                # Vitest (run mode)
pnpm test src/lib/whatsapp.test.ts   # single test file
pnpm test -t "name"      # single test by name

# Database (Drizzle)
pnpm db:generate         # generate migration after editing src/db/schema/*.ts
pnpm db:migrate          # apply migrations
pnpm db:studio           # browser DB UI
pnpm db:seed             # seed dummy/admin data (src/db/seed.ts) — initial login comes from here
pnpm encrypt-settings    # re-encrypt sensitive settings after AUTH_SECRET rotation
```

Local dev needs **two terminals**: `pnpm dev` and `pnpm worker`. Without the worker, MikroTik
provisioning and WhatsApp notifications silently queue in Redis and never execute.

## Architecture

**Two-process system, one codebase.** The Next.js web app and the BullMQ worker are deployed
as separate processes that share `src/`:

- **Web** (`src/app`) — App Router. Mutations that touch hardware/external services do NOT call
  MikroTik/Fonnte directly; they **enqueue a job** (`src/lib/queue/producer.ts`) and return.
- **Worker** (`src/workers/index.ts`) — boots `mikrotik.worker.ts` + `notification.worker.ts`,
  and on startup registers a repeatable BullMQ job (`MARK_OVERDUE`, cron `0 1 * * *`) for the
  daily overdue sweep. Graceful shutdown on SIGINT/SIGTERM.

Flow: `Browser → API route → Postgres (Drizzle) → enqueue → Redis → worker → MikroTik RouterOS / Fonnte API`.

Queue/job contract lives in `src/lib/queue/jobs.ts` (queue names, `JOB_NAMES`, and the typed
job-data interfaces). Add new background work by extending that file on both producer and worker sides.

### Key conventions to follow

- **API routes** wrap handlers in `withErrorHandler` (`src/lib/api-handler.ts`): it applies
  rate limiting and maps `UnauthorizedError`/`ForbiddenError` (from `src/lib/auth-guard.ts`) to
  401/403. Gate by role with `await requireRole([...])`. Roles: `admin`, `operator`, `technician`
  (`src/lib/constants.ts`), carried in the NextAuth v5 JWT/session (`src/lib/auth.ts`).
- **Settings are DB-sourced and encrypted.** MikroTik password and Fonnte token are stored
  encrypted (`src/lib/crypto/settings-cipher.ts`) keyed by `AUTH_SECRET`. Read them via the typed
  getters in `src/lib/settings.ts` (`getMikroTikConfig`, `getFonnteConfig`, `getBillingConfig`) —
  never read the settings table directly. Rotating `AUTH_SECRET` breaks decryption until
  `pnpm encrypt-settings` is re-run.
- **MikroTik access goes through the singleton pool** (`src/lib/mikrotik/pool.ts`): one reused
  connection with reconnect cooldown and a short response cache, stored on `globalThis` to survive
  HMR. Don't open raw `RouterOSAPI` connections in app code (the `test-mikrotik` route is the
  deliberate exception — it tests arbitrary typed-in credentials).
- **Human-facing IDs** (customer numbers, invoice numbers) come from `src/lib/ids.ts`, backed by a
  Postgres sequence (`yby_customer_seq`) and a `counters` table — not from row IDs.
- **Validators are separate from schema.** Zod input validation lives in `src/validators/`;
  Drizzle table definitions in `src/db/schema/`. Migrations in `drizzle/migrations/` are generated,
  not hand-written (except deliberate raw SQL like the sequence in `0005`).

## Deployment (production)

**Production runs on a low-RAM (~1.8 GB) ARM box via Docker Compose** — and *this machine is that
box*. (`README.md` still documents an older PM2/port-3000 flow; the live deployment is the
`docker-compose.yml` here: web on port 8080, plus `worker`, `migrate`, `postgres`, `redis`.)

> ⚠️ **Never build the image on this box.** The build needs ~2 GB heap; on the 1.8 GB host it
> thrashes swap and once ran >64 min without finishing, causing a multi-hour outage of co-tenant
> stacks (`qrtabel`, `ppdb`) that share the box. There is intentionally **no `build:` key** in
> `docker-compose.yml` — the three app services (`web`, `worker`, `migrate`) pull a prebuilt image.

**Images are built off-box by CI.** `.github/workflows/deploy-image.yml` builds a `linux/arm64`
image on a native arm64 runner and pushes it to GHCR (`ghcr.io/centauryyy25/netforge`) on every
push to `fix/production-deploy` or `main`. Compose pulls `${NETFORGE_IMAGE:-…:latest}`.

Deploy on the box = pull + recreate (no build):

```bash
docker compose pull            # fetch the image CI just built
docker compose up -d           # recreate changed containers from the pulled image
# Pin an exact build instead of latest:
#   NETFORGE_IMAGE=ghcr.io/centauryyy25/netforge:sha-<commit> docker compose up -d
```

The `migrate` service runs `drizzle-kit migrate` automatically before `web` starts. The Dockerfile
caps V8 heap (`--max-old-space-size=2048`) and Postgres has `oom_score_adj: -800` + memory limits
so nothing can OOM-kill the database on this RAM-starved host. (First pull requires the box to be
logged into GHCR — `docker login ghcr.io` — unless the package is made public.)
