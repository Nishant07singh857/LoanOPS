// Standalone log-pruning runner — deletes OPERATIONAL LOG rows older
// than the retention window so the free-tier database (Neon Free,
// ~0.5 GB) stays near ₹0 across the 1–2 year free run. Run weekly:
//   npx tsx scripts/prune-logs.ts
// Options:
//   --dry-run     log what WOULD be deleted per table; delete nothing
// Environment:
//   LOG_RETENTION_DAYS   retention window in days (default 90;
//                        values below 7 are refused — the run fails
//                        rather than prune with a dangerous window)
// Only log tables are touched (AuditLog, Notification, ReminderLog,
// WebhookEvent, dead Sessions / PasswordResetTokens). Financial and
// business records are NEVER deleted — the full classification is
// MODEL_CLASSIFICATION in src/lib/prune-logs.ts, and ReminderLog rows
// are pruned only when the reminder engine can never act on them
// again (see src/lib/server/prune-logs.ts).

import { runPruneLogs } from '../src/lib/server/prune-logs'
import { parseRetentionDays } from '../src/lib/prune-logs'
import { pingHeartbeat } from '../src/lib/server/heartbeat'
import { db } from '../src/lib/db'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  // Throws (→ non-zero exit) on a missing-floor or malformed window:
  // a typo in LOG_RETENTION_DAYS must fail the run, not prune wrongly.
  const retentionDays = parseRetentionDays(process.env.LOG_RETENTION_DAYS)

  const summary = await runPruneLogs({ dryRun, retentionDays })
  const mode = dryRun ? ' (dry run — nothing deleted)' : ''
  console.log(
    `[prune-logs] retentionDays=${summary.retentionDays} cutoff=${summary.cutoff.toISOString()}${mode}`
  )
  for (const t of summary.tables) {
    console.log(
      dryRun
        ? `[prune-logs] ${t.table}: would delete ${t.matched} (${t.rule})`
        : `[prune-logs] ${t.table}: deleted ${t.deleted} of ${t.matched} matched (${t.rule})`
    )
  }
  console.log(
    `[prune-logs] done tables=${summary.tables.length} ` +
      (dryRun
        ? `totalWouldDelete=${summary.totalMatched}`
        : `totalDeleted=${summary.totalDeleted}`)
  )
  // Success ping for the cron heartbeat monitor (docs/LAUNCH.md §4).
  // Skipped on dry runs — a preview is not a scheduled execution.
  if (!dryRun) {
    await pingHeartbeat(process.env.HEARTBEAT_PRUNE_URL, 'prune-logs')
  }
}

main()
  .catch((err) => {
    console.error('[prune-logs] failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
