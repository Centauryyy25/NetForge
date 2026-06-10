# SI YBY NET — Project Audit Report

**Auditor:** External Senior Staff Engineer / Product Architect (consultative)
**Date:** 2026-05-05
**Repo state:** branch `main`, 1 substantive commit (`cfd1640 feat: initial commit`)
**Scope:** Full repository at `si-ybynet/` (Next.js 16 + Drizzle + BullMQ + node-routeros)

---

## 1. Executive Summary

SI YBY NET is an internal management system for an RT/RW Net ISP in Bogor: customer CRUD, monthly invoicing, MikroTik PPPoE/queue control via BullMQ, WhatsApp billing reminders (Fonnte), and dashboards. The codebase is a Next.js 16 App-Router project with PostgreSQL + Drizzle, NextAuth v5 credentials auth, and a separate BullMQ worker process.

**Maturity:** Late prototype / early MVP. Most CRUD flows compile and persist; several user-facing pages (`activity-logs`, `settings/users`, service-request form) still ship hard-coded mock data; there are **zero automated tests** despite Vitest and Playwright being declared dependencies and named in `CLAUDE.md`.

**Top 3 strengths**
1. Clean schema separation per domain (`src/db/schema/*.ts`) with explicit Drizzle relations.
2. Async hardware boundary respected: API routes enqueue BullMQ jobs rather than calling RouterOS synchronously (`src/app/api/customers/[id]/route.ts:88-115`).
3. Sensible MikroTik connection pool with TTL cache and reconnect cooldown (`src/lib/mikrotik/pool.ts`).

**Top 3 risks / weaknesses**
1. **Hard-coded / weak credentials in production paths.** PPPoE password defaults to the customer's phone number (`src/app/api/customers/route.ts:89`) and to the literal string `"123456"` in the worker fallback (`src/workers/mikrotik.worker.ts:21`). Settings are stored plaintext in DB.
2. **No persistence-side coordination.** Customer-create dispatches a MikroTik job *after* the DB insert with no transaction or compensation; on RouterOS failure the DB row stays, creating drift between billing system and edge router (`src/app/api/customers/route.ts:58-93`).
3. **Two parallel MikroTik client implementations.** `lib/mikrotik/pool.ts` (pooled, cached) is used by read paths; `lib/mikrotik/client.ts` (per-call, no pool) is used by `pppoe.ts`/`queue.ts` in the worker. Behavior, error handling, and timeouts diverge (`pppoe.ts` returns `{success,error}`, `pool.ts` throws).

**Verdict:** **Refactor before continuing.** The skeleton is sound and the domain modeling is reasonable, but several flows are demoware-grade (mock pages, auto-generated 4-digit random IDs hitting unique constraints, plaintext secrets). Do **not** ship to a real customer base in the current state. ~1–2 weeks of stabilization gets it to a defensible MVP.

---

## 2. Architecture Review

**Pattern:** Layered modular monolith. Two deployable processes (web + worker) sharing `src/lib` and `src/db`. Layer boundaries:

| Layer | Folder | Evidence |
|---|---|---|
| HTTP / UI | `src/app/(dashboard)`, `src/app/api` | Next.js App Router with route-group split for auth/dashboard |
| Domain validators | `src/validators/*` | Zod schemas per resource (`customer.ts`, `payment.ts`) |
| Persistence | `src/db/schema/*`, `src/db/index.ts` | Drizzle, table-per-file, central `relations.ts` |
| Hardware integration | `src/lib/mikrotik/*` | RouterOS API wrapper |
| Async messaging | `src/lib/queue/*`, `src/workers/*` | BullMQ producer/consumer split |
| Cross-cutting | `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/settings.ts` | NextAuth + middleware RBAC |

**Drift from the stated pattern:**

- `CLAUDE.md` mentions a `requireRole()` helper at `src/lib/auth-guard.ts`. **It does not exist.** Every API route re-implements the role check inline (`src/app/api/customers/route.ts:35`, `src/app/api/payments/route.ts:48`, `src/app/api/customers/bulk/route.ts:17`, …). That's ~12 places duplicating the same `if (!session || (role !== "admin" && role !== "operator")) {…}` pattern. This is the single largest source of consistency drift in the codebase.
- The MikroTik abstraction was started twice (see Risk #3 above). The worker never uses the pool; the read API never uses the per-call client. If the worker later needs caching, or the read path needs unpooled access, both need separate fixes.
- Server Components fetch DB directly *and* there are API routes returning the same data (e.g., `src/app/(dashboard)/page.tsx:26-80` and `src/app/api/dashboard/route.ts`). Two implementations of the same query — the API route is currently dead code from the UI's perspective.

**Coupling:** Loose at the data layer (validators ≠ DB schema, intentional and good). Tight at the route layer (every route redoes auth + role check + try/catch + JSON wrapping).

**Dependency direction:** Clean — `app/api → lib/queue → lib/mikrotik`, no cycles. Workers import from `lib/`, never from `app/`.

**Scalability ceiling:**
- Single Postgres connection from `postgres()` with default pool (no `max:` set in `src/db/index.ts:10`); fine to ~hundreds of concurrent users on modest hardware. The seed script correctly sets `max:1`.
- MikroTik throughput is bottlenecked by `concurrency: 1` in the worker (`src/workers/mikrotik.worker.ts:67`) — appropriate for RouterOS but caps you at ~one operation per second. At >~1k customers doing simultaneous suspends/activates this becomes a queue backlog.
- `/api/bandwidth` does an unfiltered `customers.findMany` on every poll (`src/app/api/bandwidth/route.ts:47-50`). At the bandwidth-monitor's polling interval × N admins, this is the first query that will hurt.

---

## 3. Code Quality Assessment

| Area | Score | Justification |
|---|---|---|
| Readability & naming | 4/5 | Names are descriptive and consistent (`enqueueSuspendPPPoE`, `getMikroTikConfig`). One exception: `pppoeUser` vs `pppoeUsername` vs `name` (the MikroTik field) gets confusing in `src/app/api/customers/[id]/route.ts:86-115`. |
| Error handling consistency | 2/5 | Two paradigms in conflict: `pppoe.ts` returns `{success,error}` tuples, while `pool.ts` and most API routes throw. Workers re-throw via `if (!result.success) throw new Error(result.error)` (`mikrotik.worker.ts:22`). Pick one. |
| Logging & observability | 1/5 | `console.log` / `console.error` only. No structured logging, no request IDs, no log levels. Workers log emoji-prefixed strings (`workers/index.ts:5`). Production debugging will be guesswork. |
| Input validation | 3/5 | Zod is used at API boundaries. Gaps: bulk endpoint type-narrows but raw `any[]` for `whereConditions` in `payments/route.ts:23`, `service-request-form.tsx` doesn't even call the API (`:33`), and `payment-method` field accepts free string in the table (`payments.ts:20`) but enum in validator. |
| Concurrency safety | 3/5 | Worker is `concurrency: 1` (correct for serializing MikroTik). Race in the customer-create flow: DB row inserted before MikroTik job dispatched, no idempotency key, retry on the queue may try to re-create a PPPoE secret that already exists. `pppoe.ts:7` does not check existence before `/ppp/secret/add`. |
| Configuration | 2/5 | Mixed: secrets read from DB *or* env (`src/lib/settings.ts:48-67`). DB stores plaintext password in `varchar(1000)` (`src/db/schema/settings.ts:6`). `.env` is committed to the repo (`.env` shows in `ls -la`) — needs verification it's gitignored. |
| Security hygiene | 2/5 | See section 5. NextAuth handles sessions correctly; bcrypt is fine. But: plaintext settings, default PPPoE passwords, `trustHost: true` (`src/lib/auth.ts:86`) without origin validation, no rate limiting on `/api/auth`, settings test endpoint returns 200 on connection failure rather than 4xx (`api/settings/test-mikrotik/route.ts:51`). |
| Test coverage | 0/5 | Zero test files. `pnpm vitest` would run nothing. Vitest and Playwright are listed as devDependencies but no `vitest.config.*` or `playwright.config.*` exists. |
| Documentation | 2/5 | `CLAUDE.md` is decent but partly aspirational (references files that don't exist). `README.md` is the unmodified create-next-app boilerplate — no setup, no architecture, no run instructions for the worker. Inline JSDoc is present on `pool.ts` and `settings.ts` but absent elsewhere. |

---

## 4. Tech Debt Inventory

| # | Item | Location | Severity | Effort | Why it matters |
|---|---|---|---|---|---|
| 1 | PPPoE password defaults to phone number / `"123456"` | `api/customers/route.ts:89`, `workers/mikrotik.worker.ts:21` | **Critical** | S | Customer credentials are guessable; fail-safe default is publicly known |
| 2 | Settings (MikroTik password, Fonnte token) stored plaintext | `db/schema/settings.ts`, `lib/settings.ts` | **High** | M | DB dump = full credential exposure; need at-rest encryption or move to env-only |
| 3 | No `requireRole()` helper despite docs claiming one | absent (referenced by `CLAUDE.md`) | High | S | ~12 routes copy-paste the role check; one missed copy = privilege escalation |
| 4 | Two divergent MikroTik client implementations | `lib/mikrotik/pool.ts` vs `lib/mikrotik/client.ts` | High | M | Bug fixes / timeout changes have to be made twice and easily drift |
| 5 | Random 4–5 digit IDs collide with `UNIQUE` constraint | `lib/utils.ts:33-51` | High | S | At ~1k customers, birthday-paradox collisions occur; insert just throws 500 |
| 6 | Customer create has no transaction + no compensation on MikroTik failure | `api/customers/route.ts:58-93` | High | M | DB and edge router drift silently |
| 7 | `service-request-form.tsx` does not call the API | `components/forms/service-request-form.tsx:33` | High | S | Public-facing form swallows submissions — looks like a working feature, isn't |
| 8 | `activity-logs` and `settings/users` pages render hard-coded arrays | `app/(dashboard)/activity-logs/page.tsx:13`, `app/(dashboard)/settings/users/page.tsx:13` | High | M | Demoware passing as real features |
| 9 | Zero automated tests; configs missing for declared frameworks | repo-wide | High | L | Every refactor is a coin toss |
| 10 | README is unmodified create-next-app boilerplate | `README.md` | Medium | S | New maintainers cannot bootstrap the app |
| 11 | `console.*` logging only | repo-wide | Medium | M | No production observability |
| 12 | No DB indexes on FK columns | all schema files | Medium | S | `payments.customerId`, `payments.periodMonth`, `customers.packageId`, `activity_logs.customerId` will hit seq scans at scale |
| 13 | `pppoeUsername` is not unique in DB | `db/schema/customers.ts:25` | Medium | S | Two customers can share a PPPoE account; MikroTik is the only enforcer |
| 14 | `customers.activeUntil` always set to "1 month from creation" with no respect for prepaid amounts | `api/customers/route.ts:55-57` | Medium | S | Doesn't reflect billing cycle; payment doesn't extend it |
| 15 | Dashboard data fetched twice (RSC + dead `/api/dashboard`) | `app/(dashboard)/page.tsx`, `app/api/dashboard/route.ts` | Low | S | Dead-code maintenance burden |
| 16 | `whereConditions: any[]` and dynamic `and(...[])` with empty array | `api/payments/route.ts:23-30` | Low | S | Drizzle `and()` of empty array is a footgun; type discipline lost |

15 substantive items above; this is more than a "few rough edges" but well within reach of one focused engineer-month.

---

## 5. Performance & Reliability

**N+1 / unbounded queries**
- `/api/bandwidth` (`src/app/api/bandwidth/route.ts:47`) reads *all* active customers on every poll. With the bandwidth monitor refreshing on a timer, this scales linearly with customer count × active admin sessions.
- `/api/customers` GET (`src/app/api/customers/route.ts:18`) returns the full table with no pagination, ordering, or `LIMIT`. Will degrade noticeably past ~5k rows.
- `/api/service-requests` GET same pattern (no pagination).

**Missing indexes:** `customers.packageId`, `customers.status`, `payments.customerId`, `payments.periodMonth`, `payments.status`, `activity_logs.customerId`, `activity_logs.timestamp`, `service_requests.status`, `service_requests.customerId`. Drizzle does not auto-index FKs in PostgreSQL.

**Missing timeouts / circuit breakers**
- `node-routeros` timeout is set (10 s) — good (`pool.ts:71`).
- Fonnte HTTP call has **no timeout, no retry, no circuit breaker** (`workers/notification.worker.ts:13`). A hanging Fonnte endpoint stalls the notification queue.
- BullMQ retry config is partial — `enqueueCreatePPPoE` has `attempts:3, exponential 2s` but `enqueueSuspendPPPoE`, `enqueueSetQueue`, etc. have only `attempts:3` with default linear backoff (`lib/queue/producer.ts:42-58`). Inconsistent.

**Single points of failure**
- One MikroTik connection in `pool.ts` shared across the entire web process. If it's stuck, all read endpoints stall until the 5 s reconnect cooldown.
- One Redis instance, no Sentinel / cluster — fine for the target scale, but worth recording.
- The Next.js process and worker both load full `dotenv` at startup; misconfigured env crashes both.

**Schema concerns**
- `payments.amount` is `decimal(12,2)` and snapshotted — good. But the *package* price at time of payment is **not** snapshotted (`db/schema/payments.ts`). `CLAUDE.md` claims "Payment records snapshot the package price at time of payment" — the schema does not implement that claim. The `amount` column is the closest thing, but `packageId` / package name at the time isn't recorded.
- `customers` has no `onDelete` strategy on `packageId` FK; deleting a package referenced by customers throws a 500.
- `activity_logs.bytesIn / bytesOut` are `decimal(15,0)` — works, but `bigint` would be more natural and faster.

**Concurrency / idempotency**
- A retried PPPoE-create job will hit `/ppp/secret/add` again and fail with "already exists" — no idempotency check in `createPPPoEUser` (`lib/mikrotik/pppoe.ts:3-19`). The "set queue" worker correctly handles upsert (`lib/mikrotik/queue.ts:11`); pppoe does not.

---

## 6. Product / Feature Gap Analysis

Inferred intended scope from `CLAUDE.md`, parent-dir `Implementation_Plan_YBY_NET_v2_NextJS.md`, and route layout:

| Feature | Status | Evidence |
|---|---|---|
| Customer CRUD | **Working** | API + UI complete, list/detail/edit/delete |
| Customer bulk suspend/activate | **Working** | `api/customers/bulk/route.ts` |
| Customer CSV export | **Working** | `api/customers/export/route.ts` |
| Package CRUD | **Mostly working** | Routes + tables exist; UI for create exists |
| Payment recording | **Working** | POST creates payment + enqueues WhatsApp |
| Payment status update | **Working** | PATCH endpoint exists |
| MikroTik PPPoE create/suspend/activate/delete via queue | **Working** (with caveats #5, #6, idempotency above) | worker + producer + pppoe.ts |
| MikroTik bandwidth monitor (live) | **Working** | `api/bandwidth/route.ts` reads `/ppp/active/print` + `/queue/simple/print` |
| Service request creation (admin form) | **Backend-only** | API exists; the form `service-request-form.tsx:33` doesn't call it |
| Service request detail/update | **Working** | PATCH endpoint, detail page |
| Activity logs (PPPoE login/logout history) | **Stub** | `app/(dashboard)/activity-logs/page.tsx:13` is hard-coded, no MikroTik log poller, no `/api/activity-logs` route |
| User management (admin add/edit operators) | **Stub** | `settings/users/page.tsx:13` hard-coded; no API route |
| Settings UI (MikroTik / Fonnte config) | **Working** | GET/PUT routes + form; test-connection works |
| Dashboard (counts + revenue chart) | **Working** | RSC variant in use |
| Reports page | **Unverified** | `(dashboard)/reports/page.tsx` exists at 143 lines, not deeply audited |
| Auto-suspend on overdue billing | **Missing** | No scheduled job; no cron/repeat queue declared |
| Recurring monthly invoice generation | **Missing** | Invoices created manually via POST /api/payments only |
| WhatsApp due-date reminders (proactive) | **Missing** | Only fires after a payment is *recorded*, not before due date |
| Digital receipts | **Missing in UI** | No PDF/print view found |
| Activity log → MikroTik live tail / scheduled sync | **Missing** | `activity_logs` table exists but no writer |

**Rough UX edges**
- All list pages render the full dataset with no pagination, search, or empty-state design.
- Forms use plain HTML `FormData` rather than the `react-hook-form` already in the dependency tree (`components/forms/customer-form.tsx:51`). No client-side Zod validation feedback; users only see errors after a round trip.
- Toaster (`sonner`) is used, but error messages from the API are surfaced as raw `err.error` — fine for admins, opaque for non-technical operators.
- `service-request-form` shows a fake success toast (`:37`) regardless of actual outcome.

---

## 7. Recommended Next Steps — Prioritized

### A. Stabilize (next 1–2 weeks)

| # | Problem | Proposed fix | Effort | Acceptance |
|---|---|---|---|---|
| A1 | PPPoE password defaults are unsafe | Generate cryptographically random 12-char password; store hashed in DB column `pppoe_password_hash`; store plaintext only briefly to push to MikroTik. Remove the `"123456"` fallback in worker. | S–M | New customer + suspend/activate flow uses unique password; CI grep for `"123456"` fails the build |
| A2 | DB ↔ MikroTik drift on create failure | Wrap insert + enqueue in a Drizzle transaction; if enqueue throws, roll back. On worker failure after retries, transition customer to a `provisioning_failed` status visible in the UI. | M | Killing Redis after insert leaves no orphan customer; worker failure surfaces in admin UI |
| A3 | `requireRole()` missing | Implement `src/lib/auth-guard.ts` returning `{session}` or throwing a typed `ForbiddenError`; replace inline checks. | S | Single grep for inline `session.user.role !==` returns zero hits |
| A4 | Random ID collision on `UNIQUE` | Use a Postgres sequence (`yby_customer_seq`) or a per-month counter table; same for invoice / ticket numbers. | S | 10k inserts in a row never collide |
| A5 | `service-request-form` doesn't submit | Wire to `POST /api/service-requests`. | S | Form submission persists; e2e test confirms |
| A6 | Activity-logs and users pages mock data | Either ship the feature or hide the route. Recommend hiding for now (see B-track) and replacing the page with an "in-development" banner. | S | No mock data in production code; route omitted from sidebar until built |
| A7 | Settings password plaintext | Add column `value_encrypted` (boolean), encrypt sensitive keys with `AUTH_SECRET`-derived AES-GCM key. | M | DB inspection of `settings.value` for `mikrotik_password` shows ciphertext |
| A8 | README has no setup info | Replace with: prerequisites, env, migration commands, seed, dev + worker commands, deploy notes pointing to `ecosystem.config.cjs`. | S | New developer can `pnpm dev` + `pnpm worker` in <30 min |
| A9 | Fonnte call has no timeout | Wrap fetch in `AbortController` with 10 s timeout; let BullMQ retry. | S | Synthetic test against unreachable host fails the job in <11 s, not hangs |

### B. Strengthen (next 1–2 months)

- **Test bedrock.** Add `vitest.config.ts` and `playwright.config.ts`. Write integration tests for the four critical flows: customer create → PPPoE provisioning, payment record → WhatsApp enqueue, status change → suspend job, settings update. Target 60 % coverage on `src/lib` and `src/app/api` within 6 weeks.
- **Consolidate MikroTik clients.** Make `pool.ts` the only client. Refactor `pppoe.ts` and `queue.ts` to use `mikrotikQuery`. Make `createPPPoEUser` idempotent (check before add).
- **Pagination + indexes.** Add cursor or offset pagination to all list endpoints; add the indexes listed in §5. Migration generation via Drizzle.
- **Structured logging.** Adopt `pino` (or similar). Worker job-id ↔ HTTP request-id correlation IDs propagated through BullMQ job data. Log levels driven by env.
- **CI.** Add a GitHub Actions workflow: install → typecheck → lint → vitest → build. Block merge on red.
- **Activity-log ingestion.** Either (a) poll `/log/print ?topics=ppp` on a schedule and persist, or (b) configure RouterOS to push to a syslog endpoint and scrape from there. Recommend (a) for simplicity at this scale.
- **Recurring invoice + due-date reminder cron.** BullMQ supports repeat jobs — schedule `generate-monthly-invoices` on the 1st and `whatsapp-due-reminder` 3 days before `activeUntil`.
- **react-hook-form everywhere.** It's already a dependency. Convert the four manual `FormData` forms to RHF + zodResolver; surface field-level errors in the UI.

### C. Grow (next quarter)

Ranked by (impact × confidence) ÷ effort.

| Rank | Feature | User problem | Sketch | Prerequisites | Risks |
|---|---|---|---|---|---|
| 1 | **Customer self-service portal (read-only)** | Customers want to see their own bills, due date, and submit complaints without calling the operator | Add `/portal` route group, second NextAuth provider (phone + OTP via Fonnte), customer-scoped views of payments + service-request submission | Service-request form fixed (A5); WhatsApp OTP utility | Phone-number authentication is weak; rate-limit OTP carefully |
| 2 | **Online payment (Midtrans/Xendit/QRIS dynamic)** | Reduce manual cash collection trips | Webhook → mark `payment.status='paid'` → enqueue activate-PPPoE job; receipt PDF | Settings encryption (A7); structured logging | Money handling — must reconcile carefully; tax/PPN |
| 3 | **Auto-suspend on N days overdue** | Operators forget to manually suspend; revenue leakage | Daily BullMQ repeat job: scan customers where `activeUntil < now - 7d AND status='active'` → enqueue suspend | Recurring jobs in B-track | False suspend if payment was recorded out-of-band |
| 4 | **MikroTik live activity → activity_logs persistence** | Operators investigate "why is X offline?" without SSH access to the router | Cron poller writes `login`/`logout` events with byte counters; UI page reads from DB | Activity-log feature in B-track | Polling cadence vs DB write volume (1k customers × 5 min poll = 12k inserts/hr) |
| 5 | **Bandwidth alerts** | Detect anomalous usage (e.g. 100 % saturation by one customer) | Background job comparing rolling avg to current rate; Fonnte alert to admin | Activity logs persisted | Alert fatigue if thresholds wrong |

Demoting from "obvious" to "later": multi-tenant support, mobile app, role-based dashboards. None of these have validated demand from the description provided.

---

## 8. What I Would Do If This Were My Project

If I owned this for one focused month, I would not write a single new feature. I'd spend the month making the existing flows believable: **harden the customer-creation pipeline end-to-end** (transaction, idempotent MikroTik provisioning, deterministic IDs, proper PPPoE password generation, structured logs around every step), and use that work as the template for the next two flows (payment record → notify, status change → suspend). Then I'd write integration tests for those three pipelines so the next person doesn't have to be afraid to refactor. Everything else — activity-logs page, online payment, customer portal — is more valuable on top of a foundation you trust than on top of one you don't. The current foundation is roughly 70 % there; the missing 30 % is what makes the difference between a school project and a system you can hand to a non-technical operator on Monday morning.

---

## 9. Open Questions for the Maintainer

1. **Deployment timeline.** Is there a hard date (thesis defense, customer go-live) we're optimizing toward? That changes A-track vs B-track ordering significantly.
2. **Customer count at launch and 12 months out.** ~50 vs ~5,000 changes whether pagination/indexing belongs in §A or §C.
3. **Is this project meant for a single operator or multiple ISPs?** I'm assuming single-tenant. If multi-tenant is in scope, the schema needs `org_id` everywhere now, not later.
4. **Who is responsible for MikroTik configuration changes — the app or the network engineer?** If the engineer might tweak queue/secret names by hand, the worker needs to handle drift gracefully (it currently does not for PPPoE create).
5. **Is `.env` committed?** `ls -la` shows it on disk; please confirm `.gitignore` actually excludes it. If it leaked into commit `cfd1640`, secrets must be rotated.

---

*End of report.*
