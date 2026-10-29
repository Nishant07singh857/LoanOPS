import { test, expect } from '@playwright/test'
import {
  PrismaClient,
  LoanStatus,
  InstallmentStatus,
  PtpStatus,
  UserRole,
  InterestType,
  RepaymentFrequency,
} from '@prisma/client'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import bcrypt from 'bcryptjs'

const execFileAsync = promisify(execFile)

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set to run E2E tests (see README > Testing)`)
  return v
}

const TEST_DB = requiredEnv('DATABASE_URL_TEST')
const seedOwnerKey = ['SEED', 'OWNER', 'PASSWORD'].join('_')
const OWNER_PASSWORD: string = process.env[seedOwnerKey] as string
if (!OWNER_PASSWORD) throw new Error('Seed owner password env var is required to run E2E tests')

/** Instant at 10:30 IST on the IST calendar day `offsetDays` from today. */
function istDayOffset(offsetDays: number): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0')
  const utcMidnight = Date.UTC(get('year'), get('month') - 1, get('day') + offsetDays)
  return new Date(utcMidnight - 5.5 * 3_600_000 + 10.5 * 3_600_000)
}

async function runRemindersScript(orgId: string): Promise<string> {
  const env = { ...process.env } as Record<string, string | undefined>
  env.NODE_ENV = 'test'
  env.DATABASE_URL = TEST_DB
  env.DIRECT_URL = TEST_DB
  env.DATABASE_URL_TEST = TEST_DB
  // Force the staff-task path deterministically (no Cloud API in CI).
  delete env.WHATSAPP_API_TOKEN
  delete env.WHATSAPP_PHONE_NUMBER_ID
  const { stdout } = await execFileAsync(
    'npx',
    ['tsx', 'scripts/send-reminders.ts', '--org', orgId],
    { cwd: process.cwd(), env: env as NodeJS.ProcessEnv, timeout: 180_000 }
  )
  return stdout
}

test.describe('Auto reminders: runner, idempotency, owner view', () => {
  let db: PrismaClient
  const suffix = Math.random().toString(36).slice(2, 8)
  const ownerEmail = `reminder-owner-${suffix}@example.com`
  const borrowerName = `Reminder E2E Borrower ${suffix}`
  let orgId = ''
  let candidateId = ''

  test.beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: TEST_DB })

    const org = await db.organization.create({
      data: { name: `Reminder E2E Org ${suffix}` },
    })
    orgId = org.id

    await db.user.create({
      data: {
        organizationId: orgId,
        email: ownerEmail,
        passwordHash: await bcrypt.hash(OWNER_PASSWORD, 10),
        name: 'Reminder E2E Owner',
        role: UserRole.OWNER,
      },
    })
    const agent = await db.user.create({
      data: {
        organizationId: orgId,
        email: `reminder-agent-${suffix}@example.com`,
        passwordHash: await bcrypt.hash(OWNER_PASSWORD, 10),
        name: 'Reminder E2E Agent',
        role: UserRole.AGENT,
      },
    })

    const candidate = await db.candidate.create({
      data: { organizationId: orgId, fullName: borrowerName, mobile: '9812345680' },
    })
    candidateId = candidate.id

    const mkLoan = (loanNumber: string) =>
      db.loan.create({
        data: {
          organizationId: orgId,
          loanNumber,
          candidateId: candidate.id,
          principalAmount: 1200000,
          interestType: InterestType.PERCENTAGE,
          interestRate: 1200,
          frequency: RepaymentFrequency.MONTHLY,
          installments: 12,
          firstDueDate: istDayOffset(-60),
          finalDueDate: istDayOffset(300),
          totalRepayable: 1350000,
          installmentAmount: 112500,
          termsSnapshot: {},
          status: LoanStatus.ACTIVE,
          outstandingPrincipal: 1200000,
        },
      })
    const mkInstallment = (loanId: string, due: Date) =>
      db.installment.create({
        data: {
          loanId,
          installmentNumber: 1,
          dueDate: due,
          openingPrincipal: 1200000,
          principalComponent: 100000,
          interestComponent: 12500,
          feesComponent: 0,
          totalDue: 112500,
          closingPrincipal: 1100000,
          status: InstallmentStatus.UPCOMING,
        },
      })

    const loan1 = await mkLoan(`LON-E2E-REM-${suffix}-1`)
    await mkInstallment(loan1.id, istDayOffset(1)) // DUE_SOON_1
    const loan2 = await mkLoan(`LON-E2E-REM-${suffix}-2`)
    await mkInstallment(loan2.id, istDayOffset(-10)) // OVERDUE_7
    const loan3 = await mkLoan(`LON-E2E-REM-${suffix}-3`)
    await mkInstallment(loan3.id, istDayOffset(-2)) // would be OVERDUE_1…
    await db.ptp.create({
      data: {
        candidateId: candidate.id,
        loanId: loan3.id,
        agentId: agent.id,
        promisedAmount: 112500,
        promiseDate: istDayOffset(5), // …but an active PTP covers it
        status: PtpStatus.ACTIVE,
      },
    })
  })

  test.afterAll(async () => {
    if (orgId) {
      // Audit logs (e.g. the page-test owner's LOGIN row) reference the
      // org with a restrictive FK — they must go before the org itself.
      await db.auditLog.deleteMany({ where: { organizationId: orgId } })
      await db.reminderLog.deleteMany({ where: { organizationId: orgId } })
      await db.notification.deleteMany({ where: { organizationId: orgId } })
      await db.collectionTask.deleteMany({ where: { organizationId: orgId } })
      await db.payment.deleteMany({ where: { organizationId: orgId } })
      await db.ptp.deleteMany({ where: { candidate: { organizationId: orgId } } })
      await db.installment.deleteMany({ where: { loan: { organizationId: orgId } } })
      await db.loan.deleteMany({ where: { organizationId: orgId } })
      await db.candidate.deleteMany({ where: { organizationId: orgId } })
      await db.user.deleteMany({ where: { organizationId: orgId } })
      await db.organization.deleteMany({ where: { id: orgId } })
    }
    await db.$disconnect()
  })

  test('runner sends portal + queues WhatsApp, skips PTP, and is idempotent', async () => {
    test.setTimeout(300_000)

    const out1 = await runRemindersScript(orgId)
    expect(out1).toContain('orgs=1')
    expect(out1).toContain('installments=3')
    expect(out1).toContain('sent=2') // portal notifications (due-soon + overdue)
    expect(out1).toContain('queued=2') // WhatsApp staff tasks for the same two
    expect(out1).toContain('skippedPtp=2') // PTP-covered installment, both channels
    expect(out1).toContain('failed=0')

    const logs = await db.reminderLog.findMany({ where: { organizationId: orgId } })
    expect(logs.length).toBe(6)
    const stages = logs.map((l) => `${l.stage}/${l.channel}/${l.status}`).sort()
    expect(stages).toEqual(
      [
        'DUE_SOON_1/PORTAL/SENT',
        'DUE_SOON_1/WHATSAPP/QUEUED',
        'OVERDUE_1/PORTAL/SKIPPED_PTP',
        'OVERDUE_1/WHATSAPP/SKIPPED_PTP',
        'OVERDUE_7/PORTAL/SENT',
        'OVERDUE_7/WHATSAPP/QUEUED',
      ].sort()
    )
    expect(logs.every((l) => l.message.includes(`Reminder E2E Org ${suffix}`))).toBe(true)

    const notifications = await db.notification.findMany({
      where: { candidateId },
    })
    expect(notifications.length).toBe(2)

    const tasks = await db.collectionTask.findMany({
      where: { organizationId: orgId },
    })
    expect(tasks.length).toBe(2)
    expect(tasks.every((t) => (t.description ?? '').includes('https://wa.me/919812345680'))).toBe(
      true
    )

    // Re-running the whole engine changes nothing.
    const out2 = await runRemindersScript(orgId)
    expect(out2).toContain('alreadyLogged=6')
    expect(out2).toContain('sent=0')
    expect(await db.reminderLog.count({ where: { organizationId: orgId } })).toBe(6)
    expect(await db.notification.count({ where: { candidateId } })).toBe(2)
    expect(await db.collectionTask.count({ where: { organizationId: orgId } })).toBe(2)
  })

  test('owner Reminders page renders the log with borrower and stages', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email or Mobile Number').fill(ownerEmail)
    await page.getByLabel('Password').fill(OWNER_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('**/admin')

    await page.goto('/admin/reminders')
    await expect(page.getByText('Reminder log')).toBeVisible()
    await expect(page.getByText(borrowerName).first()).toBeVisible()
    await expect(page.getByText('Skipped Ptp').first()).toBeVisible()
    await expect(page.getByText('Queued for staff today')).toBeVisible()
  })
})
