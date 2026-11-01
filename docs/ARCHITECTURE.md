# LoanOPS — Architecture

This document describes the system as it stands in the code. Operational
procedures (deployment steps, backups, key rotation, cron schedules) live
in `DEPLOYMENT.md`; this file is the map, not the runbook.

## 1. System overview

LoanOPS is a multi-tenant digital-lending back office for Indian NBFC /
LSP operations. One deployment serves many lender organizations
("orgs"); every business record belongs to exactly one org and every API
query is scoped by it.

Three roles, three surfaces:

| Role      | Surface    | Capabilities |
|-----------|------------|--------------|
| OWNER     | `/admin`   | Full org administration: agents, applications, loans, disbursement, cash verification, refunds, reconciliation, reports, reminders, audit log, PII reveal |
| AGENT     | `/agent`   | Field operations on their book: assigned candidates (+ unassigned pool), cash collection, PTP promises, tasks, escalations, QR apply links |
| CANDIDATE | `/portal`  | Borrower self-service: application, KYC, loan schedule, payments view, receipts, support tickets, data requests |

Public surfaces: marketing/legal pages, the QR apply flow
(`/apply/[token]`, one-shot links minted by owners/agents), webhooks.

## 2. Topology

```
 Browser ──► Vercel (region bom1, Mumbai) ──► Next.js standalone app
                  │                                │
                  │                                ├──► Neon Postgres (system of record)
                  │                                └──► Upstash Redis (accelerator only)
                  └──► src/proxy.ts runs per-request: session-cookie gate
                       for /admin, /agent, /portal + security headers
```

- **App**: Next.js 16 (App Router), `output: 'standalone'`, deployed on
  Vercel from `main`. Function region bom1 so compute sits near the
  database and users.
- **Database**: Neon Postgres via Prisma. All money state lives here;
  it is the only system of record.
- **Redis**: Upstash (REST). Used for rate-limit counters, login-lockout
  counters and the owner-dashboard KPI cache. It is an accelerator,
  never a dependency: every call site fails open to in-memory counters
  or direct DB reads when Redis is absent or errors
  (`src/lib/server/redis.ts`). Local dev and CI run with no Redis and
  behave identically to a Redis-less production deploy.
- **Private files**: KYC documents, payment proofs and ticket
  attachments are stored on the app server's local disk under
  `.storage/uploads` (outside `public/`) and served only through the
  authorized endpoint `GET /api/files/[fileKey]`. Known constraint:
  this is instance-local storage in the current deployment shape;
  durable object storage is a recorded deferral (see §9).

## 3. Layering and module map

Requests flow strictly downward; no layer reaches around the one below.

```
src/app/** pages (React client components)
  └─► src/lib/api-client.ts ──► /api/** route handlers
        └─► src/lib/server/* services ──► Prisma ──► Postgres
```

- **Pages** never touch the database or server libraries (enforced by
  convention and verified in review: zero `db` imports outside
  `src/app/api`). They render skeletons while loading and honest
  empty/error states after PR #12.
- **Route handlers** (`src/app/api/**/route.ts`, 87 files) are thin:
  guard → validate → delegate → respond. Every handler is wrapped by
  `apiHandler` (`src/lib/server/api.ts`), which applies the global
  rate limit, body-size and JSON-depth limits, payload sanitization,
  CSRF origin/referer checks on state-changing requests, and uniform
  error mapping (no Prisma internals or stack traces leak).
- **Services** (`src/lib/server/`):
  - `auth.ts` — password hashing/policy, sessions, lockouts, TOTP
    re-exports, audit log writers, role guards (`requireOwner` /
    `requireAgent` / `requireCandidate`).
  - `payments.ts` — the money-movement engine: capture, cash collect /
    verify / reverse. Everything happens inside one transaction with
    row locks and in-transaction status re-checks.
  - `financial.ts` — authoritative BigInt-paise schedule generation and
    allocation waterfall.
  - `ledger.ts` — ledger posting and reversals.
  - `reminders.ts` — reminder stage engine and receipt notifications.
  - `crypto.ts` — AES-256-GCM PII encryption, keyed Aadhaar hashing.
  - `security.ts` — sanitization primitives, upload validation
    (magic bytes, metadata stripping, private storage), signed file
    URLs verification.
  - `rate-limit.ts`, `redis.ts` — abuse controls and the cache client.
  - `env.ts` — startup environment validation (imported by `db.ts`,
    so it runs before the first query; production fails closed).
- **Shared pure libraries** (`src/lib/`): money formatting
  (`money.ts`), the client-side preview mirror of the financial engine
  (`financial-engine.ts`, see §4), mobile canonicalization
  (`mobile.ts`), loan-term ceilings (`loan-terms.ts`), reminder
  date math (`reminders.ts`), CSV injection-safe export (`csv.ts`),
  compliance copy/config (`compliance-config.ts`).
- **Security headers** have one source of truth,
  `src/lib/security-headers.ts`, consumed by both `next.config.ts`
  (`headers()`) and `src/proxy.ts` (per-request applicator).

## 4. Data model essentials

- **Money is integer paise** in every column (`Int`), computed in
  `BigInt` inside the engines and serialized as strings at the API
  boundary. No floats ever carry money.
- **Interest is flat**: total interest is computed once from principal,
  rate (basis points) and tenure, then spread across installments; the
  processing fee is likewise spread into the schedule (₹62.50 per
  installment on the seeded demo loan). EMI × installments = total
  repayable, exactly — the final installment absorbs rounding
  remainders.
- **Schedule generation** (`generateSchedule`) is deterministic and
  shared by apply, approval, origination and restructure. The UI
  preview engine (`financial-engine.ts`) is a deliberate mirror with
  different input/output shapes for form state; a unit parity test
  (`tests/unit/financial-engine.test.ts`) pins preview totals to the
  server engine so the two cannot drift silently.
- **Allocation happens at collection time**: a recorded payment is
  allocated immediately inside its creation transaction, in the order
  fees → interest → principal across installments in due order.
  Owner VERIFY of a cash collection is a confirmation only; owner
  REJECT moves the payment to REJECTED and fully reverses the
  allocation (`reversed: true` on the payment, installments and loan
  totals recomputed, ledger reversal entries posted).
- **Ledger**: disbursements and allocations post entries
  (`postLedger`, account map in `ledger.ts`); excess over outstanding
  is parked in the Unallocated Payments suspense account, never
  dropped. Seed data posts the same entries the services post, and a
  coherence spec keeps seed, ledger and disbursement totals equal.
- **Tenancy**: `organizationId` on every business table;
  `@@unique([organizationId, mobile])` on candidates makes the
  canonical 10-digit mobile the per-org identity key.

## 5. Security model

- **Sessions**: opaque 256-bit tokens; only an HMAC of the token is
  stored, looked up by a 16-char prefix and verified in constant time.
  24-hour absolute lifetime, 2-hour idle timeout, rotation on login,
  revocation on password change/reset. Cookie is `httpOnly`,
  `SameSite=Lax`, `Secure` in production.
- **Login defenses**: per-IP+account rate limit (8/15 min), an
  in-app lockout after 5 failures (15 min) backed by Redis or memory,
  plus a durable DB lockout (`failedLoginAttempts` / `lockedUntil`).
  Unknown accounts get a constant-time dummy bcrypt verify and the
  identical error message — no enumeration oracle. CAPTCHA is enforced
  when configured, after 3 failures.
- **TOTP 2FA** (owner accounts): RFC 6238 with step-aware verification;
  the last accepted step is persisted, so a code can never be replayed.
- **Authorization**: role guard first, then org scoping inside the
  query itself (cross-org ids return 404, indistinguishable from
  nonexistent). Agent write/read access is scoped to their own work;
  candidates assigned to another agent return 403, unassigned
  candidates are pool work in every agent route uniformly.
- **PII**: Aadhaar full numbers are never stored — only masked form,
  last-4 and a keyed HMAC. PAN and bank account numbers are stored
  AES-256-GCM encrypted (`enc:v1:` format, dual-key rotation support).
  List/detail endpoints return masked values via a masking decrypt
  that can never widen exposure beyond the mask; the full-value path
  is the owner-only, rate-limited, audit-logged reveal endpoint
  (`POST /api/owner/pii/reveal`), which never returns Aadhaar in full
  and never echoes ciphertext.
- **Public apply**: a QR link is single-use (consumed atomically
  inside the submission transaction), submissions for an already
  registered mobile are refused with 409 and can never create or link
  a login, loan terms are capped by shared ceilings, and DPDP consents
  are recorded inside the same transaction.
- **Webhooks**: the payment webhook requires an HMAC signature over
  `providerEventId.paymentId.status`, is idempotent via a unique
  provider-event constraint, and can never un-allocate a payment with
  a late FAILED event. The mock webhook exists for development only
  and is hard-disabled unless `NODE_ENV=development` and online
  payments are explicitly enabled.
- **Uploads**: base64 data URLs are size-capped, magic-byte verified
  against the declared type, stripped of JPEG/PNG metadata, and stored
  under random names outside `public/`. Downloads re-check role +
  record ownership per file (or a short-lived HMAC signature) and are
  rate-limited.
- **Headers**: HSTS (2 years, preload), `nosniff`, frame denial,
  referrer and permissions policies, and an enforcing CSP
  (`default-src 'self'`, `object-src 'none'`, inline scripts/styles
  allowed as Next.js requires) — see `src/lib/security-headers.ts`.
- **Audit**: security-relevant actions append to `AuditLog`
  (logins, failures, reveals with reason, state transitions), and the
  application logger redacts credential/PII keys and masks
  Aadhaar/PAN-shaped strings.

## 6. Background jobs

Operator-scheduled CLI scripts (see `DEPLOYMENT.md` §6 for the cron
contract); both are idempotent and safe to re-run.

- `scripts/mark-overdue.ts` → `refreshOverdueStatuses`: flips
  past-due installments to OVERDUE.
- `scripts/send-reminders.ts` → `runReminders`: stage engine on
  Asia/Kolkata calendar days — DUE_SOON_3, DUE_SOON_1, DUE_TODAY,
  OVERDUE_1/3/7/15/30, latest-threshold only (no backfill). Portal
  notifications are always sent; WhatsApp goes through the Meta Cloud
  API when configured, otherwise a staff collection task with a
  tap-to-send `wa.me` draft is created. Claims are insert-first
  (`@@unique([installmentId, stage, channel])`), PTP-covered loans are
  suppressed, and a per-org kill switch (`Organization.
  remindersEnabled`) can stop the engine. Receipt notifications fire
  on owner VERIFY only.

## 7. CI / deployment pipeline

- **GitHub Actions CI** on every PR and on `main`: gitleaks history
  scan, `npm audit` (critical), Prisma migrate, `tsc`, ESLint, the
  unit suite (`npm run test:unit`, 75 tests), production build, and
  the Playwright suite against a seeded throwaway database.
- **Merge rule**: a PR merges only with green CI and an independent
  tester's CLEAR verdict.
- **Production**: Vercel builds from `main`; database changes ship as
  Prisma migrations applied by the manual `seed-production.yml`
  workflow (deploy or reset mode) using GitHub secrets. The demo seed
  requires explicit seed-password secrets and refuses production
  without `ALLOW_PROD_SEED=true`.
- **Launch integrations** are env-gated and inert until the owner
  configures them: Sentry error tracking (DSN-gated, PII-scrubbed),
  Search Console verification + sitemap/robots, Vercel Analytics, and
  the weekly `backup-database.yml` pg_dump workflow (skips cleanly
  until `BACKUP_DATABASE_URL` exists). The owner-side steps live in
  [docs/LAUNCH.md](LAUNCH.md).

## 8. Testing map

- `tests/unit/` — tsx suites: financial engine + preview parity,
  security hardening, reminders (DB-backed), Redis/rate-limit,
  audit fixes.
- `tests/*.spec.ts` — Playwright API/UI suites: full E2E, authz
  matrix, red-team round 2 repros, apply-hijack repros, reminders,
  seed coherence, candidate detail, reports PTP shapes, hardening,
  sidebar scrolling.

## 9. Known deliberate deferrals

Recorded decisions, not oversights:

- **Nonce-based CSP**: `script-src 'unsafe-inline'` remains because
  Next.js injects inline bootstrap scripts; moving to nonces needs
  per-request nonce plumbing in the proxy.
- **Engine unification**: the preview mirror (`financial-engine.ts`)
  and server engine stay separate modules guarded by the parity test;
  unifying their result shapes is a dedicated refactor.
- **Object storage for uploads**: local `.storage/uploads` until a
  durable store (S3-compatible / Vercel Blob) is adopted.
- **Bundle/CSS trims**: deferred since the performance PR — shared
  baseline trim and global-CSS split are still open.
- **Large page components**: several admin/agent pages exceed 800
  lines; they are cohesive single screens and are split only when
  next edited substantively.
- **Strict assigned-only agent RBAC**: unassigned candidates are
  pool work by design today; making every agent route assigned-only
  is a product decision pending with the owner.
- **Error tracking / search console / analytics wiring**: launch
  package is a separate phase (Sentry, GSC, Vercel Analytics).
