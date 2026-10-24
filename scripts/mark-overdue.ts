// Standalone overdue sweep — flips past-due, not-fully-paid installments to
// OVERDUE for ALL organizations. Run on a schedule (cron) with:
//   npx tsx scripts/mark-overdue.ts
// The owner dashboard also refreshes its own org on load; this runner is the
// system-wide guarantee for orgs nobody has logged into.

import { refreshOverdueStatuses } from '../src/lib/server/overdue'
import { db } from '../src/lib/db'

async function main() {
  const count = await refreshOverdueStatuses()
  console.log(`[mark-overdue] ${count} installment(s) transitioned to OVERDUE`)
}

main()
  .catch((err) => {
    console.error('[mark-overdue] failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
