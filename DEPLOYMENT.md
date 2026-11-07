# LoanOps — Production Operations, Security & Deployment Runbook

> **IMPORTANT LEGAL & REGULATORY NOTICE**:
> Operating as a digital lender in India requires Reserve Bank of India (RBI) registration as a Non-Banking Financial Company (NBFC) or a formal Regulated Entity (RE) – Lending Service Provider (LSP) agreement under the RBI Digital Lending Guidelines (2022) and compliance with the Digital Personal Data Protection (DPDP) Act, 2023. All legal pages (`/privacy`, `/terms`, `/kfs`, `/grievance`, `/fair-practices`) must be reviewed and signed off by qualified Indian legal counsel before live commercial operation.

---

## 1. HTTPS-Only & Reverse Proxy Requirement
- **Strict TLS**: In production, LoanOps must be served behind a TLS-terminating reverse proxy or load balancer (Cloudflare, AWS ALB, Nginx, or Caddy) enforcing **HTTPS (TLS 1.2 / 1.3)**.
- **HSTS & Secure Cookies**: When `NODE_ENV="production"` and `NEXT_PUBLIC_APP_URL` starts with `https://` (or `COOKIE_SECURE="true"`), session cookies (`loanops_session`) are automatically flagged `HttpOnly; Secure; SameSite=Lax`, and `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` is emitted on all responses.

---

## 2. Database Migration & Deployment Procedure
Never run `prisma db push --accept-data-loss` in staging or production. Always use versioned Prisma migrations located in `prisma/migrations/`:

```bash
# 1. Install dependencies & generate Prisma Client
npm ci
npx prisma generate

# 2. Apply pending migrations to production database
npx prisma migrate deploy

# 3. Build standalone production bundle
npm run build

# 4. Start standalone production server
NODE_ENV=production node .next/standalone/server.js
```

On the hosted setup (Vercel + Neon) the procedure above is not run by the platform: the Vercel build only generates the Prisma client and builds the app, so a merged PR that adds a Prisma migration changes nothing in production until the **Migrate production database (manual)** workflow (`.github/workflows/migrate-production.yml`) is dispatched with its `confirm` input set to `MIGRATE`. That workflow runs `prisma migrate deploy` only — no seed, no reset — and prints `prisma migrate status` so the run log proves what was applied; schema PRs therefore require dispatching it after merge. `seed-production.yml` remains only for the initial seed or an owner-approved reseed, because it runs the seed step in both of its modes and must never be used just to apply a migration.

### Docker Deployment (Non-Root User `nextjs`)
```bash
docker build -t loanops:<git-sha> .
docker run -d \
  --name loanops \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.production \
  loanops:<git-sha>
```

---

## 3. PostgreSQL Backup & Restore Procedure

### Automated Daily Backups
Schedule `pg_dump` via cron or managed RDS/Supabase Point-in-Time Recovery (PITR):
```bash
# Create compressed custom-format backup encrypted with GPG/KMS
pg_dump "$DIRECT_URL" --format=custom --no-owner --no-acl -f "loanops_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Restore Procedure (Tested Drill)
```bash
# Restore into target database
pg_restore --clean --if-exists --no-owner --no-acl -d "$DIRECT_URL" loanops_backup_YYYYMMDD_HHMMSS.dump
npx prisma migrate status
```

---

## 4. Rollback Plan
1. **Application Rollback**:
   - Redeploy the previous immutable Docker image tag (`loanops:<previous-git-sha>`).
   - Verify `/api/health` returns `200 OK` (`{"status":"ok","database":"connected"}`).
2. **Database Migration Rollback**:
   - Make additive, backward-compatible schema changes wherever possible.
   - If a migration fails mid-flight, mark it rolled back with `npx prisma migrate resolve --rolled-back <migration_name>` and restore from the pre-deployment snapshot if data was mutated.

---

## 5. PII Encryption Key Rotation Plan
LoanOps encrypts sensitive KYC fields (`Aadhaar`, `PAN`, `Bank Account`, `TOTP Secret`) using **AES-256-GCM** (`src/lib/server/crypto.ts`):
1. Move the current `PII_ENCRYPTION_KEY` value into `PII_ENCRYPTION_KEY_PREVIOUS`.
2. Generate a new 64-char hex key (`openssl rand -hex 32`) and set it as `PII_ENCRYPTION_KEY`.
3. Deploy the application — `decryptPII()` automatically attempts `PII_ENCRYPTION_KEY` first and falls back to `PII_ENCRYPTION_KEY_PREVIOUS` with zero downtime.
4. Run a background batch job calling `rotateEncryptedPII()` on existing `Candidate`, `Application`, and `KycDocument` rows, then clear `PII_ENCRYPTION_KEY_PREVIOUS`.

---

## 6. Scheduled Jobs (cron)
Two standalone runners must be scheduled; both are idempotent and safe to re-run:

```bash
# Flip past-due installments to OVERDUE (all organizations) — hourly or daily
0 * * * * cd /opt/loanops && npx tsx scripts/mark-overdue.ts

# Auto reminders — daily, after the overdue sweep. Sends due-soon / due-today /
# overdue reminders at fixed stages (3d & 1d before, due day, 1/3/7/15/30 days
# overdue) as borrower portal notifications, plus WhatsApp:
#   - Meta Cloud API direct send when WHATSAPP_API_TOKEN and
#     WHATSAPP_PHONE_NUMBER_ID are set (see .env.example section 5b);
#   - otherwise a staff collection task carrying a wa.me draft link.
# Active promise-to-pay (PTP) records suppress reminders until the promise
# date passes. Preview any run with: npx tsx scripts/send-reminders.ts --dry-run
15 9 * * * cd /opt/loanops && npx tsx scripts/send-reminders.ts
```

Receipt notifications on owner payment verification reuse the same engine and
need no schedule. An organization can opt out of all reminder traffic with
`Organization.remindersEnabled = false`; delivery history is visible to the
owner under **Operations → Reminders** (`/admin/reminders`).

Optional heartbeat monitoring: set `HEARTBEAT_MARK_OVERDUE_URL` and/or
`HEARTBEAT_REMINDERS_URL` to a monitor's ping URL (healthchecks.io, Better
Stack) and each runner pings it after a successful run; a failed ping never
fails the job, and unset means no ping.

---

## 7. Monitoring & Alerting Recommendations
- **Liveness / Readiness Probe**: Poll `GET /api/health` every 30 seconds. Alert on `status != 200` or latency `> 1500ms`.
- **Security Alerts**:
  - Spike in `429 Too Many Requests` (`Rate limit exceeded` in structured JSON logs).
  - Spike in `AuditLog` entries with `action = 'LOGIN_FAILED'` or `action = 'REVEAL_PII'`.
- **Financial Reconciliation**:
  - Run daily reconciliation in `/admin/reconciliation` and alert if any `PENDING_VERIFICATION` field cash collection remains unverified by the Owner for more than 48 hours.

---

## 8. Optional Redis (Upstash)

Redis is an **accelerator only — the application runs identically without it**.
A URL + token pair enables it, under either of two naming schemes:

- **Direct Upstash names** — `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN`, e.g. copied from the Upstash console.
- **Vercel Marketplace alias names** — the **Upstash** integration from the
  Vercel Marketplace (Storage / Marketplace) creates a free Upstash database
  and injects the same credentials into the project under the legacy Vercel
  KV names `KV_REST_API_URL` / `KV_REST_API_TOKEN`. This is the recommended
  setup for the Vercel-hosted `loanops` project; redeploy once afterwards
  so the new env vars take effect.

`src/lib/server/redis.ts` resolves UPSTASH_* first and falls back to the
KV_* aliases when the direct names are unset; if both schemes are present,
UPSTASH_* wins. (Equivalently to the integration, create a database in the
Upstash console and copy the REST URL and token shown there into the
project's env vars manually under the UPSTASH_* names.)

```bash
UPSTASH_REDIS_REST_URL=""    # REST endpoint of the Upstash database
UPSTASH_REDIS_REST_TOKEN=""  # REST token (read-write)
# — or, injected automatically by the Vercel Marketplace integration —
KV_REST_API_URL=""           # alias of UPSTASH_REDIS_REST_URL
KV_REST_API_TOKEN=""         # alias of UPSTASH_REDIS_REST_TOKEN
```

What it powers when configured:

- **Rate limiting / login throttling** (`src/lib/server/rate-limit.ts`,
  `src/lib/server/auth.ts`): counters move from per-instance in-memory
  buckets to Redis (INCR + EXPIRE fixed windows, key prefix `ratelimit:`;
  login lockout counters as hashes, key prefix `loginlock:`), so limits
  are shared across instances instead of multiplying per instance.
  Policies (limits, windows, lockout threshold and duration) are
  unchanged; the DB-level account lockout is unaffected.
- **Owner dashboard cache** (`GET /api/owner/dashboard`): the computed KPI
  payload is cached per organization for **30 seconds**
  (key `dashboard-kpis:<organizationId>` — never shared across orgs).

**Fail-open contract:** if either variable is unset, or any Redis command
errors, the app silently falls back to the in-memory limiter and to direct
database queries for that request. A Redis outage must never take the app
(or its login rate limits) down. The Upstash free tier is more than
sufficient for this workload (a handful of commands per request at most).
