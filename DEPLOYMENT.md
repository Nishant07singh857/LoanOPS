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

## 6. Monitoring & Alerting Recommendations
- **Liveness / Readiness Probe**: Poll `GET /api/health` every 30 seconds. Alert on `status != 200` or latency `> 1500ms`.
- **Security Alerts**:
  - Spike in `429 Too Many Requests` (`Rate limit exceeded` in structured JSON logs).
  - Spike in `AuditLog` entries with `action = 'LOGIN_FAILED'` or `action = 'REVEAL_PII'`.
- **Financial Reconciliation**:
  - Run daily reconciliation in `/admin/reconciliation` and alert if any `PENDING_VERIFICATION` field cash collection remains unverified by the Owner for more than 48 hours.
