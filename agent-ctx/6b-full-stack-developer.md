# Task 6b — Remaining Backend API Routes

## Summary
Task 6b: complete the REMAINING backend API routes for the Loan Ops Platform. Audit of the existing files revealed that the previous build pass had already created the vast majority of the required routes (Task 6a) — this task verified every route end-to-end with curl, identified the small set of gaps, and closed them. All 41 routes return real data (200/201, never 500), every multi-write path runs in a `ctx.db.$transaction`, money is serialized as strings, and `bun run lint` exits 0.

## What I Found
On inspecting `src/app/api/**/route.ts`, the previous Task 6a pass had already built most routes. The gaps I found:

1. `GET /api/candidate/schedule` — 404 (route file did not exist; only `/api/candidate/installments` did).
2. `GET/POST /api/candidate/notifications` — 404 (only top-level `/api/notifications` existed).
3. `POST /api/agent/tasks` — 405 (only GET existed).
4. `/api/owner/reports?type=...` — only supported 5 types (`loans`, `payments`, `collections`, `applications`, `ptps`). The task spec asks for 11 (`portfolio`, `loans`, `applications`, `payments`, `collections`, `overdue`, `ptp`, `agent_performance`, `reconciliation`, `audit`, `disbursement`).
5. `/api/owner/reconciliation/run` — only accepted `{from,to}` body; the task spec asks for `{periodStart, periodEnd}`.
6. `/api/webhooks/payment` — required HMAC signature verification even when `PAYMENT_WEBHOOK_SECRET` env var was not set, making the dev test (`signature:"mock"`) fail with `400 Invalid signature`. The spec says: "If env var not set, accept any payload (for dev)."

## Files Created

- `src/app/api/candidate/schedule/route.ts` — `GET` — returns the candidate's primary loan schedule (installment list + summary: paid / overdue / due / upcoming / partiallyPaid + progressPercent + totalPaidAmount + totalDueAmount + outstandingAmount + nextDue). Falls back from `ACTIVE` loan to any loan if no active. Serializes all paise as strings.

- `src/app/api/candidate/notifications/route.ts` — `GET` + `POST`.
  - GET: paginated list of candidate's own notifications (filterable by `unreadOnly=true`), with `unreadCount`. Tenant-isolated by `candidateId` + `organizationId`.
  - POST: accepts `{ id }` (marks one as read) or `{ all: true }` (marks all unread as read via `updateMany`). Writes an audit log on each mark action.

## Files Modified

- `src/app/api/agent/tasks/route.ts` — Added `POST` handler. Validates `candidateId`/`loanId` belong to the current agent's portfolio, creates a `CollectionTask` with `status='ASSIGNED'`, `assignedToId=agentProfile.id`, `priority` (LOW/MEDIUM/HIGH/URGENT), `dueDate`, optional `amount` (paise string), optional `description`/`notes`. Returns 201 with the new task + candidate + loan. Writes an `audit` log.

- `src/app/api/owner/reports/route.ts` — Extended to support all 11 report types from the task spec:
  - `portfolio` — loan-level summary (total disbursed, collected, outstanding principal/interest/fees, collection rate) + per-loan details (candidate, agent, principal, outstanding, collected, status, frequency, payments count).
  - `overdue` — overdue installments with days-overdue, aging buckets (d0_7, d8_30, d31_60, d61_90, d90_plus), total outstanding.
  - `ptp` — alias of `ptps` plus `fulfilled`/`broken`/`active` counts.
  - `agent_performance` — per-agent stats (assigned candidates, tasks assigned/completed, PTP created/fulfilled/broken, collection amount, outstanding assigned, success rate).
  - `reconciliation` — recent runs + open exceptions.
  - `audit` — audit log filtered by `status` (action), `agent` (userId), date range.
  - `disbursement` — disbursement records with loan + candidate + agent + status.

- `src/app/api/owner/reconciliation/run/route.ts` — Updated Zod schema to accept EITHER `(from, to)` OR `(periodStart, periodEnd)` for backward compatibility. Added `.refine()` to require at least one pair.

- `src/app/api/webhooks/payment/route.ts` — Replaced the strict HMAC-verify with a dev-mode-aware policy:
  - If `process.env.PAYMENT_WEBHOOK_SECRET` is unset → dev mode → accept any payload (per spec).
  - If it is set → require HMAC-SHA256 of `providerEventId` (NOT the full raw payload — matches spec) using `timingSafeEqual` for constant-time comparison.
  - Moved the schema (`providerEventId`, `paymentId`, `status: CAPTURED|FAILED`, `signature?`, `reason?`) inline so it is no longer accidentally deleted.

## Verification

### Demo data setup
1. Logged in as owner (`owner@loanops.in`).
2. Approved Priya Sharma's application (`app-001`) via `POST /api/owner/applications/app-001/approve` → created loan `LON-MU61OPC1C1V1` with a 12-installment monthly schedule.
3. Disbursed the loan via `POST /api/owner/loans/{id}/disburse` with `method:OFFLINE`, `amount:"7500000"`, `reference:"UTR-PRIYA-001"` → loan is now `ACTIVE`.
4. Initiated a candidate payment via `POST /api/candidate/payments` (`amount:"743750"`, `method:"ONLINE_UPI"`) and captured it via the mock webhook → first installment is now `PAID`.

### Owner routes (HTTP 200/201 verified)
- `GET  /api/owner/dashboard` ✓
- `GET  /api/owner/candidates` ✓
- `POST /api/owner/candidates` ✓ (201)
- `GET  /api/owner/candidates/candidate-001` ✓
- `GET  /api/owner/loans` ✓
- `GET  /api/owner/loans/[id]` ✓
- `POST /api/owner/loans/[id]/disburse` ✓
- `GET  /api/owner/applications` ✓
- `POST /api/owner/applications` ✓
- `GET  /api/owner/applications/[id]` ✓
- `POST /api/owner/applications/[id]/approve` ✓ (used to seed Priya's loan)
- `POST /api/owner/applications/[id]/reject` ✓ (existing)
- `POST /api/owner/applications/[id]/request-info` ✓ (existing)
- `GET  /api/owner/payments` ✓
- `GET  /api/owner/cash-collections` ✓
- `POST /api/owner/cash-collections/[id]/verify` ✓ (VERIFY → allocated against installments + ledger; verified end-to-end)
- `GET  /api/owner/ledger` ✓
- `POST /api/owner/reconciliation/run` ✓ (both `{from,to}` and `{periodStart,periodEnd}` accepted)
- `GET  /api/owner/reconciliation/runs` ✓
- `GET  /api/owner/reconciliation/exceptions` ✓
- `GET  /api/owner/refunds` ✓
- `POST /api/owner/refunds` ✓ (201)
- `POST /api/owner/refunds/[id]/complete` ✓ (reversal applied end-to-end)
- `GET  /api/owner/corrections` ✓
- `POST /api/owner/corrections` ✓ (201)
- `POST /api/owner/corrections/[id]/approve` ✓ (applied)
- `GET  /api/owner/agents` ✓
- `GET  /api/owner/audit` ✓
- `GET  /api/owner/agreements` ✓
- `POST /api/owner/agreements` ✓ (201)
- `GET  /api/owner/support` ✓
- `POST /api/owner/support/[id]/resolve` ✓ (existing)
- `GET  /api/owner/analytics` ✓
- `GET  /api/owner/reports?type=portfolio|loans|applications|payments|collections|overdue|ptp|ptps|agent_performance|reconciliation|audit|disbursement` — all 200 ✓
- `GET  /api/owner/ai-insights` ✓ (returns real broken-PTP insight for Rahul)
- `GET  /api/owner/disbursements` ✓
- `GET  /api/owner/escalations` ✓

### Agent routes (HTTP 200/201 verified, logged in as `agent@loanops.in`)
- `GET  /api/agent/dashboard` ✓
- `GET  /api/agent/tasks` ✓
- `POST /api/agent/tasks` ✓ (201, NEW)
- `POST /api/agent/tasks/[id]/complete` ✓ (existing)
- `GET  /api/agent/candidates` ✓
- `GET  /api/agent/candidates/[id]` ✓
- `GET  /api/agent/follow-ups` ✓
- `POST /api/agent/follow-ups` ✓ (201)
- `GET  /api/agent/ptp` ✓
- `POST /api/agent/ptp` ✓ (201)
- `POST /api/agent/ptp/[id]/fulfill` ✓
- `POST /api/agent/ptp/[id]/break` ✓
- `GET  /api/agent/cash-collections` ✓
- `POST /api/agent/cash-collections` ✓ (201)
- `GET  /api/agent/escalations` ✓
- `POST /api/agent/escalations` ✓ (201)
- `PATCH /api/agent/escalations/[id]` ✓ (existing)
- `GET  /api/agent/performance` ✓

### Candidate routes (HTTP 200/201 verified, logged in as `9820277789` / Priya)
- `GET  /api/candidate/loan` ✓ (returns Priya's disbursed loan with schedule, payments summary, disbursement)
- `GET  /api/candidate/schedule` ✓ (NEW — returns full installment list + summary + nextDue)
- `GET  /api/candidate/installments` ✓ (existing)
- `GET  /api/candidate/loans` ✓ (existing)
- `GET  /api/candidate/payments` ✓
- `POST /api/candidate/payments` ✓ (201)
- `GET  /api/candidate/receipts` ✓
- `GET  /api/candidate/notifications` ✓ (NEW)
- `POST /api/candidate/notifications` ✓ (NEW — both `{id}` and `{all:true}` work)
- `GET  /api/candidate/support` ✓
- `POST /api/candidate/support` ✓ (201)
- `GET  /api/candidate/profile` ✓

### Webhook + Notifications
- `POST /api/webhooks/payment` ✓ (PUBLIC; dev mode accepts any payload; idempotent via `WebhookEvent(provider,eventId)`; `CAPTURED` → `capturePayment()` allocates against installments + posts ledger + receipt)
- `GET  /api/notifications` ✓
- `POST /api/notifications/[id]/read` ✓

### Lint
`bun run lint` → exit 0 (0 errors, 0 warnings).

## Stage Summary
- All 41 routes from the Task 6b spec are now implemented and return real DB data (no 500 errors).
- New routes: `/api/candidate/schedule`, `/api/candidate/notifications`, `POST /api/agent/tasks`.
- Extended: `/api/owner/reports` (11 types), `/api/owner/reconciliation/run` (dual parameter names), `/api/webhooks/payment` (dev-mode accept-any-payload).
- All writes are tenant-isolated (`organizationId: ctx.user.organizationId`), multi-write operations use `ctx.db.$transaction`, every state change writes an `AuditLog`, every significant event creates a `Notification`, and money is serialized as strings.
- The candidate portal now has a real active loan to display (Priya's `LON-MU61OPC1C1V1`, disbursed + 1 payment captured), so the `/portal/loan`, `/portal/schedule`, `/portal/receipts`, `/portal/notifications` pages will have live data.
