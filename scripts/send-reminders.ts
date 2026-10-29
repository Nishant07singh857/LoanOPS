// Standalone auto-reminder runner — sends due/overdue installment
// reminders for ALL organizations (portal notifications + WhatsApp).
// Run on a schedule (cron, daily) with:
//   npx tsx scripts/send-reminders.ts
// Options:
//   --dry-run     log what WOULD happen; write nothing, send nothing
//   --org <id>    limit the run to one organization
// WhatsApp delivery uses the Meta Cloud API when WHATSAPP_API_TOKEN and
// WHATSAPP_PHONE_NUMBER_ID are set; otherwise each WhatsApp reminder
// becomes a staff task carrying a wa.me draft link. Organizations can
// opt out entirely with Organization.remindersEnabled = false.

import { runReminders } from '../src/lib/server/reminders'
import { db } from '../src/lib/db'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const orgFlag = args.indexOf('--org')
  const organizationId = orgFlag >= 0 ? args[orgFlag + 1] : undefined

  const summary = await runReminders({ dryRun, organizationId })
  const mode = dryRun ? ' (dry run — nothing written)' : ''
  console.log(
    `[send-reminders] orgs=${summary.organizations} installments=${summary.installmentsEvaluated} ` +
      `sent=${summary.sent} queued=${summary.queued} skippedPtp=${summary.skippedPtp} ` +
      `failed=${summary.failed} alreadyLogged=${summary.alreadyLogged} noStage=${summary.noStage}${mode}`
  )
}

main()
  .catch((err) => {
    console.error('[send-reminders] failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
