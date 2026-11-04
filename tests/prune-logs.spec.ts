import { test, expect } from '@playwright/test'
import {
  PrismaClient,
  InterestType,
  LoanStatus,
  PaymentStatus,
  RepaymentFrequency,
  UserRole,
} from '@prisma/client'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set to run E2E tests (see README > Testing)`)
  return v
}

const TEST_DB = requiredEnv('DATABASE_URL_TEST')

async function runPruneScript(
  extraEnv: Record<string, string>,
  args: string[] = []
): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env } as Record<string, string | undefined>
  env.NODE_ENV = 'test'
  env.DATABASE_URL = TEST_DB
  env.DIRECT_URL = TEST_DB
  env.DATABASE_URL_TEST = TEST_DB
  Object.assign(env, extraEnv)
  const { stdout, stderr } = await execFileAsync(
    'npx',
    ['tsx', 'scripts/prune-logs.ts', ...args],
    { cwd: process.cwd(), env: env as NodeJS.ProcessEnv, timeout: 120_000 }
  )
  return { stdout, stderr }
}

const daysAgo = (n: number, from: Date) => new Date(from.getTime() - n * 86_400_000)

test.describe('Log pruning: script end-to-end against the test DB', () => {
  let db: PrismaClient
  const suffix = Math.random().toString(36).slice(2, 8)
  const NOW = new Date()
  const OLD = daysAgo(100, NOW)
  let orgId = ''
  let ownerId = ''
  let sentPaidId = ''
  let sentOpenId = ''
  let queuedPaidId = ''
  let auditOldId = ''
  let auditRecentId = ''
  let sessExpiredId = ''
  let sessLiveId = ''

  test.beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: TEST_DB })

    const org = await db.organization.create({
      data: { name: `Prune Spec Org ${suffix}` },
    })
    orgId = org.id
    const owner = await db.user.create({
      data: {
        organizationId: orgId,
        email: `prune-spec-owner-${suffix}@example.com`,
        passwordHash: 'not-a-real-hash-prune-spec',
        name: 'Prune Spec Owner',
        role: UserRole.OWNER,
      },
    })
    ownerId = owner.id
    const candidate = await db.candidate.create({
      data: {
        organizationId: orgId,
        fullName: `Prune Spec Borrower ${suffix}`,
        mobile: `98765${suffix.replace(/\D/g, '').padEnd(5, '0').slice(0, 5)}`,
      },
    })
    const loan = await db.loan.create({
      data: {
        organizationId: orgId,
        loanNumber: `PRUNE-SPEC-${suffix}`,
        candidateId: candidate.id,
        principalAmount: 7_500_000,
        interestType: InterestType.PERCENTAGE,
        interestRate: 1800,
        frequency: RepaymentFrequency.MONTHLY,
        installments: 12,
        firstDueDate: daysAgo(200, NOW),
        finalDueDate: daysAgo(-130, NOW),
        totalRepayable: 8_925_000,
        installmentAmount: 743_750,
        termsSnapshot: {},
        status: LoanStatus.ACTIVE,
      },
    })
    const instData = (installmentNumber: number, status: 'PAID' | 'OVERDUE', paidAmount: number) => ({
      loanId: loan.id,
      installmentNumber,
      dueDate: daysAgo(60, NOW),
      openingPrincipal: 7_500_000,
      principalComponent: 625_000,
      interestComponent: 118_750,
      feesComponent: 0,
      totalDue: 743_750,
      closingPrincipal: 6_875_000,
      paidAmount,
      status,
    })
    const paidInst = await db.installment.create({ data: instData(1, 'PAID', 743_750) })
    const openInst = await db.installment.create({ data: instData(2, 'OVERDUE', 0) })
    await db.payment.create({
      data: {
        organizationId: orgId,
        paymentNumber: `PRUNE-SPEC-PAY-${suffix}`,
        loanId: loan.id,
        candidateId: candidate.id,
        method: 'CASH',
        amount: 743_750,
        status: PaymentStatus.VERIFIED,
      },
    })

    const logBase = {
      organizationId: orgId,
      candidateId: candidate.id,
      loanId: loan.id,
      message: 'prune spec message',
      createdAt: OLD,
    }
    sentPaidId = (
      await db.reminderLog.create({
        data: {
          ...logBase, installmentId: paidInst.id,
          stage: 'OVERDUE_30', channel: 'PORTAL', status: 'SENT',
        },
      })
    ).id
    sentOpenId = (
      await db.reminderLog.create({
        data: {
          ...logBase, installmentId: openInst.id,
          stage: 'OVERDUE_30', channel: 'PORTAL', status: 'SENT',
        },
      })
    ).id
    queuedPaidId = (
      await db.reminderLog.create({
        data: {
          ...logBase, installmentId: paidInst.id,
          stage: 'DUE_TODAY', channel: 'WHATSAPP', status: 'QUEUED',
        },
      })
    ).id
    auditOldId = (
      await db.auditLog.create({
        data: {
          organizationId: orgId, userId: ownerId, action: 'CREATE',
          entityType: 'Loan', description: 'spec old audit', createdAt: OLD,
        },
      })
    ).id
    auditRecentId = (
      await db.auditLog.create({
        data: {
          organizationId: orgId, userId: ownerId, action: 'CREATE',
          entityType: 'Loan', description: 'spec recent audit', createdAt: daysAgo(1, NOW),
        },
      })
    ).id
    sessExpiredId = (
      await db.session.create({
        data: { userId: ownerId, token: `spec-tok-expired-${suffix}`, expiresAt: daysAgo(1, NOW) },
      })
    ).id
    sessLiveId = (
      await db.session.create({
        data: { userId: ownerId, token: `spec-tok-live-${suffix}`, expiresAt: daysAgo(-30, NOW) },
      })
    ).id
  })

  test.afterAll(async () => {
    if (orgId) {
      await db.reminderLog.deleteMany({ where: { organizationId: orgId } })
      await db.auditLog.deleteMany({ where: { organizationId: orgId } })
      await db.payment.deleteMany({ where: { organizationId: orgId } })
      await db.installment.deleteMany({ where: { loan: { organizationId: orgId } } })
      await db.loan.deleteMany({ where: { organizationId: orgId } })
      await db.session.deleteMany({ where: { userId: ownerId } })
      await db.candidate.deleteMany({ where: { organizationId: orgId } })
      await db.user.deleteMany({ where: { organizationId: orgId } })
      await db.organization.deleteMany({ where: { id: orgId } })
    }
    await db.$disconnect()
  })

  test('dry run reports what would be deleted and deletes nothing', async () => {
    const { stdout } = await runPruneScript({}, ['--dry-run'])
    expect(stdout).toContain('dry run — nothing deleted')
    expect(stdout).toContain('would delete')
    expect(await db.reminderLog.findUnique({ where: { id: sentPaidId } })).not.toBeNull()
    expect(await db.auditLog.findUnique({ where: { id: auditOldId } })).not.toBeNull()
    expect(await db.session.findUnique({ where: { id: sessExpiredId } })).not.toBeNull()
  })

  test('real run prunes only the safe rows; financial records untouched', async () => {
    const { stdout } = await runPruneScript({})
    expect(stdout).toContain('[prune-logs] done')
    // Safe set gone…
    expect(await db.reminderLog.findUnique({ where: { id: sentPaidId } })).toBeNull()
    expect(await db.auditLog.findUnique({ where: { id: auditOldId } })).toBeNull()
    expect(await db.session.findUnique({ where: { id: sessExpiredId } })).toBeNull()
    // …guarded rows survive: open-installment SENT (live dedup guard),
    // QUEUED (never pruned), recent audit, live session.
    expect(await db.reminderLog.findUnique({ where: { id: sentOpenId } })).not.toBeNull()
    expect(await db.reminderLog.findUnique({ where: { id: queuedPaidId } })).not.toBeNull()
    expect(await db.auditLog.findUnique({ where: { id: auditRecentId } })).not.toBeNull()
    expect(await db.session.findUnique({ where: { id: sessLiveId } })).not.toBeNull()
    // Financial records untouched.
    expect(await db.loan.count({ where: { organizationId: orgId } })).toBe(1)
    expect(await db.payment.count({ where: { organizationId: orgId } })).toBe(1)
    expect(await db.installment.count({ where: { loan: { organizationId: orgId } } })).toBe(2)
  })

  test('a below-floor LOG_RETENTION_DAYS fails the run and deletes nothing', async () => {
    let err: { stdout?: string; stderr?: string; code?: number } | null = null
    try {
      await runPruneScript({ LOG_RETENTION_DAYS: '3' })
    } catch (e) {
      err = e as { stdout?: string; stderr?: string; code?: number }
    }
    expect(err, 'script must exit non-zero below the retention floor').not.toBeNull()
    expect(err?.code).not.toBe(0)
    expect(`${err?.stderr ?? ''}${err?.stdout ?? ''}`).toContain('below the minimum')
    expect(await db.reminderLog.findUnique({ where: { id: sentOpenId } })).not.toBeNull()
  })
})
