// Log pruning — pure core (no DB, no env access, unit-testable).
//
// The free-tier production database (Neon Free, ~0.5 GB) grows almost
// entirely through append-only operational logs. This module defines
// WHICH tables may ever be pruned and the retention-window rules; the
// DB runner that executes the plan is src/lib/server/prune-logs.ts
// (invoked weekly by scripts/prune-logs.ts).
//
// HARD RULE: only operational logs are pruned. Financial and business
// records — loans, installments, payments, the ledger, disbursements,
// corrections, KYC, support tickets, consent records — are NEVER
// touched. Every model in prisma/schema.prisma is classified below,
// and a unit test asserts the classification covers the schema exactly,
// so a future model cannot slip in unclassified.

export const DEFAULT_RETENTION_DAYS = 90

/**
 * Hard floor for the retention window. A typo like LOG_RETENTION_DAYS=1
 * must never be able to wipe recent logs, so anything below this is
 * refused outright (the runner exits non-zero).
 */
export const MIN_RETENTION_DAYS = 7

/**
 * ReminderLog FAILED rows are re-claimable while attempts <
 * MAX_DELIVERY_ATTEMPTS (see src/lib/server/reminders.ts, where the
 * constant of the same name lives). A FAILED row AT the cap is final —
 * the engine will never touch it again. Mirror of that value; the two
 * must change together.
 */
export const REMINDERLOG_MAX_ATTEMPTS = 3

/**
 * ReminderLog statuses the engine treats as finished DELIVERY outcomes.
 * QUEUED is deliberately absent: a QUEUED row means work was handed off
 * (a staff task carries the message) or is in flight — it is never
 * pruned regardless of age. SKIPPED_PTP and FAILED are handled with
 * extra conditions in the runner (see src/lib/server/prune-logs.ts):
 * SKIPPED_PTP rows can be re-claimed while their installment is open,
 * and FAILED rows only become final at the attempt cap.
 */
export const REMINDERLOG_TERMINAL_STATUSES = ['SENT', 'SKIPPED_PTP'] as const

/**
 * Parses LOG_RETENTION_DAYS. Unset/empty → DEFAULT_RETENTION_DAYS.
 * Anything that is not a whole number of days, or is below
 * MIN_RETENTION_DAYS, throws — a misconfigured window must fail the
 * run loudly, never silently prune with a wrong (or zero) window.
 */
export function parseRetentionDays(raw: string | undefined | null): number {
  if (raw === undefined || raw === null || raw.trim() === '') {
    return DEFAULT_RETENTION_DAYS
  }
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) {
    throw new RangeError(
      `LOG_RETENTION_DAYS must be a whole number of days, got "${raw}"`
    )
  }
  const days = Number(trimmed)
  if (days < MIN_RETENTION_DAYS) {
    throw new RangeError(
      `LOG_RETENTION_DAYS=${days} is below the minimum of ${MIN_RETENTION_DAYS} days — refusing to prune with such a short window`
    )
  }
  return days
}

/** Rows created before this instant fall outside the retention window. */
export function retentionCutoff(retentionDays: number, now: Date): Date {
  if (!Number.isInteger(retentionDays) || retentionDays < MIN_RETENTION_DAYS) {
    throw new RangeError(
      `retentionDays must be an integer >= ${MIN_RETENTION_DAYS}, got ${retentionDays}`
    )
  }
  return new Date(now.getTime() - retentionDays * 86_400_000)
}

export type PruneClassification = 'PRUNED' | 'NEVER'

/**
 * Classification of EVERY model in prisma/schema.prisma.
 *
 * PRUNED — append-only operational logs / dead auth artefacts:
 *   AuditLog            action log; windowed by createdAt
 *   Notification        delivered notifications; windowed by createdAt
 *   ReminderLog         reminder engine log; windowed + terminal-state
 *                       and installment/payment-closed guards (runner)
 *   WebhookEvent        provider event log; only processed rows,
 *                       windowed by receivedAt (unprocessed rows are
 *                       pending work and are never deleted)
 *   Session             only expired or revoked rows (dead either way:
 *                       auth requires expiresAt > now AND revokedAt null)
 *   PasswordResetToken  only expired or already-used rows
 *
 * NEVER — financial records, business records, and legal/compliance
 * evidence. If a future model is even arguably financial, it belongs
 * here; the burden of proof is on pruning, not on keeping.
 */
export const MODEL_CLASSIFICATION: Readonly<Record<string, PruneClassification>> = {
  // — Pruned (operational logs only) —
  AuditLog: 'PRUNED',
  Notification: 'PRUNED',
  ReminderLog: 'PRUNED',
  WebhookEvent: 'PRUNED',
  Session: 'PRUNED',
  PasswordResetToken: 'PRUNED',

  // — Never: tenancy & identity (accounts are not logs) —
  Organization: 'NEVER',
  User: 'NEVER',
  AgentProfile: 'NEVER',

  // — Never: borrower & origination business records —
  Candidate: 'NEVER',
  Application: 'NEVER',
  QrLink: 'NEVER',
  AgreementTemplate: 'NEVER',
  Document: 'NEVER',
  KycDocument: 'NEVER',

  // — Never: financial core (the ledger and everything feeding it) —
  Loan: 'NEVER',
  Installment: 'NEVER',
  Disbursement: 'NEVER',
  Payment: 'NEVER',
  LedgerEntry: 'NEVER',
  Refund: 'NEVER',
  FinancialCorrection: 'NEVER',
  ReconciliationRun: 'NEVER',
  ReconciliationException: 'NEVER',

  // — Never: collections & borrower-contact business records —
  CollectionTask: 'NEVER',
  FollowUp: 'NEVER',
  Ptp: 'NEVER',
  Escalation: 'NEVER',
  SupportTicket: 'NEVER',
  SupportTicketMessage: 'NEVER', // ticket thread replies — support evidence, like the ticket itself
  Enquiry: 'NEVER', // website sales leads — business records, not logs

  // — Never: product content & legal/compliance evidence —
  AiInsight: 'NEVER',
  ConsentRecord: 'NEVER',
  DataSubjectRequest: 'NEVER',
}

export const PRUNED_MODELS: readonly string[] = Object.keys(MODEL_CLASSIFICATION).filter(
  (m) => MODEL_CLASSIFICATION[m] === 'PRUNED'
)

export const NEVER_PRUNE_MODELS: readonly string[] = Object.keys(MODEL_CLASSIFICATION).filter(
  (m) => MODEL_CLASSIFICATION[m] === 'NEVER'
)
