# LoanOps

Loan operations platform for a lending business: borrower onboarding via secure QR links, loan application review, disbursement, repayment schedules, cash and online collections, reconciliation, and DPDP Act 2023 compliance workflows — in one multi-tenant system.

> Legal note: live lending in India requires an RBI-registered NBFC / Regulated Entity arrangement and qualified legal review of all disclosures (KFS, fair-practices, privacy, grievance). Placeholder legal identifiers in `.env.example` must be replaced before any commercial launch.

## Portals & roles

| Portal | Path | Role | What it does |
|---|---|---|---|
| Owner / Admin | `/admin` | `OWNER` | Candidates, applications (approve/reject/request-info), loans, disbursements, payments, cash verification, refunds, corrections, ledger, reconciliation, reports, audit log, PII reveal (audited, rate-limited) |
| Agent | `/agent` | `AGENT` | Assigned candidates only: follow-ups, PTP (promise-to-pay), escalations, collection tasks, cash collection entry, QR links |
| Borrower | `/portal` | `CANDIDATE` | Own loan, schedule, payments, receipts, notifications, support, profile, DPDP data requests |
| Public | `/apply/[token]` | — (bearer link) | Loan application via owner/agent-issued QR link |

Roles are enforced server-side on every API route (`requireOwner` / `requireAgent` / `requireCandidate`) and data is organisation-scoped. Client-side route guards are UX only.

## Tech stack

- **App:** Next.js (App Router, standalone output) + React + TypeScript (strict)
- **UI:** Tailwind CSS v4 (CSS-first — there is intentionally no `tailwind.config.ts`), shadcn-style components in `src/components/ui`, Radix primitives
- **Data:** PostgreSQL via Prisma ORM (`@prisma/client` is the runtime dependency; the Prisma CLI is a dev dependency used for migrations/generation)
- **Auth:** Server sessions (HMAC-hashed tokens at rest, idle timeout, revocation), bcrypt password hashing, optional TOTP for owners
- **Validation:** Zod schemas on API inputs (`src/lib/server/api.ts`)
- **Payments:** Offline cash (primary) with owner verification; optional online payments behind `ENABLE_ONLINE_PAYMENTS` with HMAC-verified, idempotent webhooks
- **Tests:** Playwright E2E + a unit/security test runner for the financial engine (`tests/unit/financial-engine.test.ts`)
- **Deploy:** Multi-stage Docker image + Caddy reverse proxy with automatic HTTPS

## Repository layout

```
src/app/            Pages (admin / agent / portal / apply / auth) and src/app/api/** route handlers
src/lib/server/     Server-only modules: auth, API helpers, financial engine, ledger, payments, crypto, security, rate limiting, env validation
src/lib/            Shared client-safe helpers (money formatting, API client, session context)
prisma/             schema.prisma + migrations/ (the schema is the source of truth; never edit a merged migration)
scripts/            Seed, audit and build helper scripts
tests/              Playwright specs + unit tests
```

## Local setup

Prerequisites: Node.js 20+, PostgreSQL, and (for `db:seed` as scripted) Bun — or run the seed with `npx tsx scripts/seed.ts`.

```bash
npm ci                      # reproducible install from package-lock.json
cp .env.example .env        # then REPLACE every REPLACE-ME / empty value
```

Set at minimum in `.env`:

- `DATABASE_URL`, `DIRECT_URL` — PostgreSQL connections (runtime / migrations)
- `DATABASE_URL_TEST` — **required** by the seed script and E2E tests; must point at a *different* database than `DATABASE_URL`
- `SESSION_SECRET` — `openssl rand -hex 32`
- `PII_ENCRYPTION_KEY` — exactly 64 hex characters (`openssl rand -hex 32`)
- `AADHAAR_HASH_PEPPER` — 32+ characters; set once, never rotate
- `SEED_OWNER_PASSWORD`, `SEED_AGENT_PASSWORD`, `SEED_AGENT2_PASSWORD`, `SEED_CANDIDATE_PASSWORD` — you choose these; there are no usable defaults

Then:

```bash
npx prisma generate
npx prisma migrate deploy   # or: npm run db:migrate for local migration development
npm run db:seed             # development/CI only
npm run dev                 # http://localhost:3000
```

Startup validates the environment (`src/lib/server/env.ts`): in production the process refuses to start with weak/missing secrets, a non-HTTPS `NEXT_PUBLIC_APP_URL`, `COOKIE_SECURE` not set to `"true"`, or online payments enabled without `PAYMENT_WEBHOOK_SECRET`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build (standalone) + standalone copy step |
| `npm start` | Run the standalone server (`.next/standalone/server.js`) |
| `npm run lint` | ESLint |
| `npm run test:unit` | Financial-engine & security unit tests (tsx) |
| `npm run test:e2e` | Playwright E2E suite (needs a running server + `DATABASE_URL_TEST`) |
| `npm run db:migrate` / `db:migrate:deploy` | Prisma migrations (dev / deploy) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Seed development data (never in production unless `ALLOW_PROD_SEED=true` — do not) |

Never use `prisma db push` or `prisma migrate reset` against staging/production — schema changes go through committed migrations only.

## Testing & CI

CI (`.github/workflows/ci.yml`) is a blocking gate, in order: gitleaks secret scan → `npm ci` → `npm audit --audit-level=critical` (critical vulnerabilities fail the build) → Prisma generate + `migrate deploy` → `tsc --noEmit` → ESLint → unit tests → production build → seeded Playwright E2E against a PostgreSQL service.

## Deployment

**Docker**

```bash
docker build -t loanops:<git-sha> .
docker run --env-file .env.production -p 3000:3000 loanops:<git-sha>
```

The image is multi-stage (deps → builder → standalone runner, non-root user, healthcheck on `/api/health`). The build context honours `.dockerignore`: `.env*`, `.git`, `node_modules`, `.next`, local databases and audit artifacts never enter the image. Tag images immutably (git SHA), never `latest`, so rollback targets exist.

**Caddy (TLS termination)**

Set `DOMAIN` to the public hostname and run Caddy with the committed `Caddyfile`. Caddy obtains/renews certificates automatically (for `localhost` it issues a local dev certificate) — there is deliberately no plain-HTTP site block. The Caddyfile also sets HSTS, `X-Content-Type-Options`, `Referrer-Policy` and compression, and forwards the real client IP/proto to the app.

**Proxy trust:** because Caddy is the trusted proxy, deployed environments should set `TRUST_PROXY="true"` (or `TRUSTED_PROXY_HEADER="x-forwarded-for"`). Without a trusted proxy the app ignores forwarding headers for rate limiting — clients can spoof them.

## Security notes

- **Borrower account linking (claim codes):** candidates are often pre-created by staff before the borrower ever logs in. Signup must **never** silently attach an account to a pre-existing candidate by mobile number alone. Linking requires a one-time claim code issued to that candidate (stored only as a hash in `Candidate.claimCodeHash`, with `claimCodeExpiresAt` expiry). Treat claim codes like passwords: single-use, short-lived, never logged.
- **PII:** Aadhaar/PAN/bank details are encrypted at rest (AES-256-GCM, `src/lib/server/crypto.ts`), masked in API responses, and full values are only exposed through the owner-only, rate-limited, audited PII-reveal endpoint. In production, the crypto and file-signing helpers **fail closed** — there are no fallback development secrets in production code paths.
- **Cash verification flow:** an agent recording cash does **not** settle a loan. Cash payments enter `PENDING_VERIFICATION`; borrower liability, installment allocation and any loan closure happen only when an owner verifies the cash was actually received. A rejected verification reverses the pending entry.
- **Payments & webhooks:** webhook signatures are verified with `PAYMENT_WEBHOOK_SECRET`, and provider events are idempotent at the database level (`WebhookEvent` has a unique `(provider, eventId)` constraint). Payment capture is transactional.
- **Consents:** DPDP consent records are legal evidence. They may only be written for an authenticated, identified subject — never from unauthenticated client-supplied candidate/application IDs.
- **Rate limiting:** limits in `src/lib/server/rate-limit.ts` are in-memory and per-instance (documented in that file). Behind multiple instances, treat them as a first line of defence, not a distributed control.
- **Sessions & secrets:** rotate any secret that was ever committed, seeded with a default, or shared outside the secret store. `.env` files are never committed (see `.gitignore`); deployed secrets come from the platform environment, which overrides any local `.env` file.

## Repo hygiene rules

- Never commit: `.env*` (except `.env.example`), databases (`*.db`, `*.sqlite*`), run output (`result.json`, `audit-raw-proofs.txt`, `audit-output/`, `test-results/`, logs). These are gitignored and dockerignored — keep it that way.
- Audit output goes to `audit-output/` via `scripts/run-audit.mjs`, not the repo root.
- `package-lock.json` is committed and is the source of truth for installs: always use `npm ci`, regenerate the lockfile in the same PR as any `package.json` dependency change, and never hand-edit it.
- One change set = code + Prisma schema + its migration, together.
- No demo credentials, sample passwords, or "temporary" secrets in source, tests, seeds, or docs — test credentials come from environment variables in CI only.
