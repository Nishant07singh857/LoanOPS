// Log pruning — the DB half of the free-tier retention job.
//
// The plan (which tables, which rules) lives in src/lib/prune-logs.ts.
// This module executes it: batched deletes of OPERATIONAL LOG rows
// outside the retention window. Financial and business records are
// never in scope — see MODEL_CLASSIFICATION.
//
// ReminderLog needs more than an age check, because its rows are the
// reminder engine's idempotency guard (src/lib/server/reminders.ts):
// deleting the wrong row makes the engine send a duplicate reminder.
// A ReminderLog row is pruned ONLY when all of these hold:
//   1. It is older than the retention window (createdAt).
//   2. Its status is a terminal delivery outcome: SENT or SKIPPED_PTP,
//      or FAILED at the re-claim attempt cap (FAILED below the cap is
//      still owed retries). QUEUED is NEVER pruned — it means a staff
//      task carries the message or delivery is in flight.
//   3. The engine can never evaluate its slot again:
//      - receipt rows (paymentId): the payment's verify lifecycle is
//        complete (status beyond INITIATED / PENDING_VERIFICATION) —
//        receipts fire exactly once, inside the one-way verify
//        transition, so a completed payment can never re-notify;
//      - installment rows: the installment is PAID, or its loan has
//        left ACTIVE — the runner only evaluates unpaid installments
//        on ACTIVE loans, so the slot is unreachable. Rows for OPEN
//        installments on ACTIVE loans are the live dedup guard
//        (notably OVERDUE_30, whose stage never expires) and are kept
//        however old they are; their count is bounded by the open
//        loan book, one row per (installment, stage, channel).
//
// Sessions and password-reset tokens are pruned on their own fields,
// independent of the window: expired sessions (auth already rejects
// them) and revoked sessions, expired reset tokens and used ones —
// all permanently dead artefacts.

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import {
  REMINDERLOG_MAX_ATTEMPTS,
  REMINDERLOG_TERMINAL_STATUSES,
  retentionCutoff,
} from '@/lib/prune-logs'

/** Rows per delete batch — a huge backlog never becomes one giant DELETE. */
const BATCH_SIZE = 1000

export interface PruneTableResult {
  table: string
  /** Human-readable predicate, for the run log. */
  rule: string
  /** Rows matching the predicate when the run started. */
  matched: number
  /** Rows actually deleted (always 0 on a dry run). */
  deleted: number
}

export interface PruneSummary {
  dryRun: boolean
  retentionDays: number
  cutoff: Date
  tables: PruneTableResult[]
  totalMatched: number
  totalDeleted: number
}

export interface RunPruneOptions {
  dryRun?: boolean
  retentionDays: number
  now?: Date
}

interface PruneOps {
  count: () => Promise<number>
  findBatch: () => Promise<string[]>
  deleteBatch: (ids: string[]) => Promise<number>
}

async function pruneTarget(
  table: string,
  rule: string,
  dryRun: boolean,
  ops: PruneOps
): Promise<PruneTableResult> {
  const matched = await ops.count()
  if (dryRun || matched === 0) return { table, rule, matched, deleted: 0 }
  let deleted = 0
  for (;;) {
    const ids = await ops.findBatch()
    if (ids.length === 0) break
    deleted += await ops.deleteBatch(ids)
    if (ids.length < BATCH_SIZE) break
  }
  return { table, rule, matched, deleted }
}

export async function runPruneLogs(options: RunPruneOptions): Promise<PruneSummary> {
  const dryRun = options.dryRun ?? false
  const now = options.now ?? new Date()
  // Throws on a below-floor window — a bad value must fail the run,
  // never prune with it.
  const cutoff = retentionCutoff(options.retentionDays, now)

  const auditWhere: Prisma.AuditLogWhereInput = { createdAt: { lt: cutoff } }
  const notificationWhere: Prisma.NotificationWhereInput = { createdAt: { lt: cutoff } }
  // Unprocessed webhook events are pending work (or failed processing
  // awaiting replay) — only the processed idempotency log ages out.
  const webhookWhere: Prisma.WebhookEventWhereInput = {
    processed: true,
    receivedAt: { lt: cutoff },
  }
  const reminderWhere: Prisma.ReminderLogWhereInput = {
    createdAt: { lt: cutoff },
    AND: [
      {
        OR: [
          { status: { in: [...REMINDERLOG_TERMINAL_STATUSES] } },
          { status: 'FAILED', attempts: { gte: REMINDERLOG_MAX_ATTEMPTS } },
        ],
      },
      {
        OR: [
          {
            paymentId: { not: null },
            payment: { status: { notIn: ['INITIATED', 'PENDING_VERIFICATION'] } },
          },
          { installmentId: { not: null }, installment: { status: 'PAID' } },
          { installmentId: { not: null }, loan: { status: { not: 'ACTIVE' } } },
        ],
      },
    ],
  }
  const sessionWhere: Prisma.SessionWhereInput = {
    OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }],
  }
  const resetTokenWhere: Prisma.PasswordResetTokenWhereInput = {
    OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }],
  }

  const tables: PruneTableResult[] = []

  tables.push(
    await pruneTarget('AuditLog', `createdAt < ${cutoff.toISOString()}`, dryRun, {
      count: () => db.auditLog.count({ where: auditWhere }),
      findBatch: async () =>
        (
          await db.auditLog.findMany({
            where: auditWhere,
            select: { id: true },
            take: BATCH_SIZE,
            orderBy: { id: 'asc' },
          })
        ).map((r) => r.id),
      deleteBatch: async (ids) =>
        (await db.auditLog.deleteMany({ where: { id: { in: ids } } })).count,
    })
  )

  tables.push(
    await pruneTarget('Notification', `createdAt < ${cutoff.toISOString()}`, dryRun, {
      count: () => db.notification.count({ where: notificationWhere }),
      findBatch: async () =>
        (
          await db.notification.findMany({
            where: notificationWhere,
            select: { id: true },
            take: BATCH_SIZE,
            orderBy: { id: 'asc' },
          })
        ).map((r) => r.id),
      deleteBatch: async (ids) =>
        (await db.notification.deleteMany({ where: { id: { in: ids } } })).count,
    })
  )

  tables.push(
    await pruneTarget(
      'ReminderLog',
      `createdAt < ${cutoff.toISOString()}, terminal status, slot unreachable`,
      dryRun,
      {
        count: () => db.reminderLog.count({ where: reminderWhere }),
        findBatch: async () =>
          (
            await db.reminderLog.findMany({
              where: reminderWhere,
              select: { id: true },
              take: BATCH_SIZE,
              orderBy: { id: 'asc' },
            })
          ).map((r) => r.id),
        deleteBatch: async (ids) =>
          (await db.reminderLog.deleteMany({ where: { id: { in: ids } } })).count,
      }
    )
  )

  tables.push(
    await pruneTarget(
      'WebhookEvent',
      `processed = true, receivedAt < ${cutoff.toISOString()}`,
      dryRun,
      {
        count: () => db.webhookEvent.count({ where: webhookWhere }),
        findBatch: async () =>
          (
            await db.webhookEvent.findMany({
              where: webhookWhere,
              select: { id: true },
              take: BATCH_SIZE,
              orderBy: { id: 'asc' },
            })
          ).map((r) => r.id),
        deleteBatch: async (ids) =>
          (await db.webhookEvent.deleteMany({ where: { id: { in: ids } } })).count,
      }
    )
  )

  tables.push(
    await pruneTarget('Session', 'expiresAt < now, or revoked', dryRun, {
      count: () => db.session.count({ where: sessionWhere }),
      findBatch: async () =>
        (
          await db.session.findMany({
            where: sessionWhere,
            select: { id: true },
            take: BATCH_SIZE,
            orderBy: { id: 'asc' },
          })
        ).map((r) => r.id),
      deleteBatch: async (ids) =>
        (await db.session.deleteMany({ where: { id: { in: ids } } })).count,
    })
  )

  tables.push(
    await pruneTarget('PasswordResetToken', 'expiresAt < now, or used', dryRun, {
      count: () => db.passwordResetToken.count({ where: resetTokenWhere }),
      findBatch: async () =>
        (
          await db.passwordResetToken.findMany({
            where: resetTokenWhere,
            select: { id: true },
            take: BATCH_SIZE,
            orderBy: { id: 'asc' },
          })
        ).map((r) => r.id),
      deleteBatch: async (ids) =>
        (await db.passwordResetToken.deleteMany({ where: { id: { in: ids } } })).count,
    })
  )

  return {
    dryRun,
    retentionDays: options.retentionDays,
    cutoff,
    tables,
    totalMatched: tables.reduce((sum, t) => sum + t.matched, 0),
    totalDeleted: tables.reduce((sum, t) => sum + t.deleted, 0),
  }
}
