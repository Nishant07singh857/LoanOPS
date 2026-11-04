import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PrismaClient,
  AuditAction,
  InterestType,
  LoanStatus,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  RepaymentFrequency,
  UserRole,
} from '@prisma/client'
import {
  DEFAULT_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  MODEL_CLASSIFICATION,
  NEVER_PRUNE_MODELS,
  PRUNED_MODELS,
  REMINDERLOG_MAX_ATTEMPTS,
  REMINDERLOG_TERMINAL_STATUSES,
  parseRetentionDays,
  retentionCutoff,
} from '../../src/lib/prune-logs'

interface TestCase {
  name: string
  fn: () => void | Promise<void>
}

const tests: TestCase[] = []
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

// ============================================================
// 1. Retention window parsing — default, floor, malformed input
// ============================================================

test('parseRetentionDays: unset or empty falls back to the 90-day default', () => {
  assert.equal(parseRetentionDays(undefined), DEFAULT_RETENTION_DAYS)
  assert.equal(parseRetentionDays(null), DEFAULT_RETENTION_DAYS)
  assert.equal(parseRetentionDays(''), DEFAULT_RETENTION_DAYS)
  assert.equal(parseRetentionDays('   '), DEFAULT_RETENTION_DAYS)
  assert.equal(DEFAULT_RETENTION_DAYS, 90)
})

test('parseRetentionDays: valid windows pass through', () => {
  assert.equal(parseRetentionDays('7'), 7)
  assert.equal(parseRetentionDays('90'), 90)
  assert.equal(parseRetentionDays('365'), 365)
  assert.equal(parseRetentionDays(' 30 '), 30)
})

test('parseRetentionDays: below the floor is refused, never clamped', () => {
  assert.equal(MIN_RETENTION_DAYS, 7)
  assert.throws(() => parseRetentionDays('6'), RangeError)
  assert.throws(() => parseRetentionDays('1'), RangeError)
  assert.throws(() => parseRetentionDays('0'), RangeError)
})

test('parseRetentionDays: malformed values are refused', () => {
  assert.throws(() => parseRetentionDays('abc'), RangeError)
  assert.throws(() => parseRetentionDays('7.5'), RangeError)
  assert.throws(() => parseRetentionDays('-30'), RangeError)
  assert.throws(() => parseRetentionDays('90d'), RangeError)
})

test('retentionCutoff: exact day math, and the floor is enforced again', () => {
  const now = new Date('2026-11-05T00:00:00Z')
  assert.equal(retentionCutoff(90, now).toISOString(), '2026-08-07T00:00:00.000Z')
  assert.equal(retentionCutoff(7, now).toISOString(), '2026-10-29T00:00:00.000Z')
  assert.throws(() => retentionCutoff(6, now), RangeError)
  assert.throws(() => retentionCutoff(0, now), RangeError)
  assert.throws(() => retentionCutoff(90.5, now), RangeError)
})

// ============================================================
// 2. Schema classification — every model classified exactly once,
//    financial/business models can never enter the prune set
// ============================================================

test('classification covers every model in prisma/schema.prisma exactly', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
  const schemaModels = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)]
    .map((m) => m[1])
    .sort()
  const classified = Object.keys(MODEL_CLASSIFICATION).sort()
  assert.deepEqual(
    classified,
    schemaModels,
    'MODEL_CLASSIFICATION must name every schema model — a new model must be classified deliberately'
  )
})

test('the prune set is exactly the six operational-log models', () => {
  assert.deepEqual(
    [...PRUNED_MODELS].sort(),
    [
      'AuditLog',
      'Notification',
      'PasswordResetToken',
      'ReminderLog',
      'Session',
      'WebhookEvent',
    ]
  )
})

test('no financial or business model is ever prunable', () => {
  const neverExpected = [
    // financial core
    'Loan',
    'Installment',
    'Disbursement',
    'Payment',
    'LedgerEntry',
    'Refund',
    'FinancialCorrection',
    'ReconciliationRun',
    'ReconciliationException',
    // borrower & origination records
    'Candidate',
    'Application',
    'Document',
    'KycDocument',
    'QrLink',
    'AgreementTemplate',
    // collections & grievance records
    'CollectionTask',
    'FollowUp',
    'Ptp',
    'Escalation',
    'SupportTicket',
    // identity & product content
    'Organization',
    'User',
    'AgentProfile',
    'AiInsight',
    // legal / DPDP evidence
    'ConsentRecord',
    'DataSubjectRequest',
  ]
  for (const model of neverExpected) {
    assert.equal(
      MODEL_CLASSIFICATION[model],
      'NEVER',
      `${model} must be classified NEVER`
    )
    assert.ok(NEVER_PRUNE_MODELS.includes(model), `${model} must be in NEVER_PRUNE_MODELS`)
    assert.ok(!PRUNED_MODELS.includes(model), `${model} must not be in PRUNED_MODELS`)
  }
})

test('ReminderLog safety constants: QUEUED is never terminal, cap mirrors the engine', () => {
  assert.deepEqual([...REMINDERLOG_TERMINAL_STATUSES], ['SENT', 'SKIPPED_PTP'])
  assert.ok(
    !(REMINDERLOG_TERMINAL_STATUSES as readonly string[]).includes('QUEUED'),
    'QUEUED rows are in-flight / handed to staff — never prunable'
  )
  // Must match MAX_DELIVERY_ATTEMPTS in src/lib/server/reminders.ts.
  assert.equal(REMINDERLOG_MAX_ATTEMPTS, 3)
})

// ============================================================
// 3. DB: the runner prunes exactly the safe rows
//    (runs only when DATABASE_URL_TEST is available; CI covers the
//    rest — same gating as tests/unit/reminders.test.ts)
// ============================================================

const HAS_DB = Boolean(process.env.DATABASE_URL_TEST)

const daysAgo = (n: number, from: Date) => new Date(from.getTime() - n * 86_400_000)

test('DB: dry run counts without deleting; real run prunes only the safe set', async () => {
  if (!HAS_DB) {
    console.log('  (skipped — DATABASE_URL_TEST not set)')
    return
  }
  const { runPruneLogs } = await import('../../src/lib/server/prune-logs')
  const raw = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST })
  const suffix = Math.random().toString(36).slice(2, 8)
  const NOW = new Date()
  let orgId = ''
  let ownerId = ''

  try {
    // Pruning is global (no org scope), and the test DB is shared with
    // other suites — so expectations are deltas over a baseline dry
    // run taken before the fixtures exist.
    const dry0 = await runPruneLogs({ dryRun: true, retentionDays: 90, now: NOW })
    const baseline = Object.fromEntries(dry0.tables.map((t) => [t.table, t.matched]))
    const org = await raw.organization.create({
      data: { name: `Prune E2E Org ${suffix}` },
    })
    orgId = org.id
    const owner = await raw.user.create({
      data: {
        organizationId: orgId,
        email: `prune-owner-${suffix}@example.com`,
        passwordHash: 'not-a-real-hash-prune-test',
        name: 'Prune Test Owner',
        role: UserRole.OWNER,
      },
    })
    ownerId = owner.id
    const candidate = await raw.candidate.create({
      data: {
        organizationId: orgId,
        fullName: `Prune Borrower ${suffix}`,
        mobile: `98765${suffix.replace(/\D/g, '').padEnd(5, '0').slice(0, 5)}`,
      },
    })

    const loanData = (loanNumber: string, status: LoanStatus) => ({
      organizationId: orgId,
      loanNumber,
      candidateId: candidate.id,
      principalAmount: 7_500_000,
      interestType: InterestType.PERCENTAGE,
      interestRate: 1800,
      frequency: RepaymentFrequency.MONTHLY,
      installments: 12,
      firstDueDate: daysAgo(200, NOW),
      finalDueDate: daysAgo(200 - 330, NOW),
      totalRepayable: 8_925_000,
      installmentAmount: 743_750,
      termsSnapshot: {},
      status,
    })
    const activeLoan = await raw.loan.create({
      data: loanData(`PRUNE-A-${suffix}`, LoanStatus.ACTIVE),
    })
    const closedLoan = await raw.loan.create({
      data: loanData(`PRUNE-C-${suffix}`, LoanStatus.CLOSED),
    })

    const instData = (
      loanId: string,
      installmentNumber: number,
      status: 'PAID' | 'OVERDUE',
      paidAmount: number
    ) => ({
      loanId,
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
    const paidInst = await raw.installment.create({
      data: instData(activeLoan.id, 1, 'PAID', 743_750),
    })
    const openInst = await raw.installment.create({
      data: instData(activeLoan.id, 2, 'OVERDUE', 0),
    })
    const closedInst = await raw.installment.create({
      data: instData(closedLoan.id, 1, 'PAID', 743_750),
    })

    const verifiedPayment = await raw.payment.create({
      data: {
        organizationId: orgId,
        paymentNumber: `PRUNE-PAY-V-${suffix}`,
        loanId: activeLoan.id,
        candidateId: candidate.id,
        method: PaymentMethod.CASH,
        amount: 743_750,
        status: PaymentStatus.VERIFIED,
      },
    })
    const pendingPayment = await raw.payment.create({
      data: {
        organizationId: orgId,
        paymentNumber: `PRUNE-PAY-P-${suffix}`,
        loanId: activeLoan.id,
        candidateId: candidate.id,
        method: PaymentMethod.CASH,
        amount: 743_750,
        status: PaymentStatus.PENDING_VERIFICATION,
      },
    })
    await raw.ledgerEntry.create({
      data: {
        organizationId: orgId,
        entryNumber: `PRUNE-LED-${suffix}`,
        type: 'PAYMENT_PRINCIPAL',
        debitAccount: 'CASH',
        creditAccount: 'LOANS',
        amount: 625_000,
        loanId: activeLoan.id,
        paymentId: verifiedPayment.id,
        createdAt: daysAgo(100, NOW),
      },
    })

    // ReminderLog matrix — [tag, expected after a real run]
    const OLD = daysAgo(100, NOW)
    type LogSpec = Parameters<typeof raw.reminderLog.create>[0]['data']
    const logSpecs: Array<{ tag: string; deleted: boolean; data: LogSpec }> = []
    const base = {
      organizationId: orgId,
      candidateId: candidate.id,
      message: 'prune test message',
      createdAt: OLD,
    }
    const add = (tag: string, deleted: boolean, data: LogSpec) =>
      logSpecs.push({ tag, deleted, data })
    add('sent-paid', true, {
      ...base, loanId: activeLoan.id, installmentId: paidInst.id,
      stage: 'OVERDUE_30', channel: 'PORTAL', status: 'SENT',
    })
    add('sent-open', false, {
      ...base, loanId: activeLoan.id, installmentId: openInst.id,
      stage: 'OVERDUE_30', channel: 'PORTAL', status: 'SENT',
    })
    add('sent-closed-loan', true, {
      ...base, loanId: closedLoan.id, installmentId: closedInst.id,
      stage: 'OVERDUE_30', channel: 'WHATSAPP', status: 'SENT',
    })
    add('queued-paid', false, {
      ...base, loanId: activeLoan.id, installmentId: paidInst.id,
      stage: 'DUE_TODAY', channel: 'WHATSAPP', status: 'QUEUED',
    })
    add('failed-final-paid', true, {
      ...base, loanId: activeLoan.id, installmentId: paidInst.id,
      stage: 'OVERDUE_7', channel: 'WHATSAPP', status: 'FAILED', attempts: 3,
    })
    add('failed-retryable-paid', false, {
      ...base, loanId: activeLoan.id, installmentId: paidInst.id,
      stage: 'OVERDUE_3', channel: 'PORTAL', status: 'FAILED', attempts: 1,
    })
    add('skipped-closed-loan', true, {
      ...base, loanId: closedLoan.id, installmentId: closedInst.id,
      stage: 'DUE_SOON_1', channel: 'PORTAL', status: 'SKIPPED_PTP',
    })
    add('skipped-open', false, {
      ...base, loanId: activeLoan.id, installmentId: openInst.id,
      stage: 'OVERDUE_15', channel: 'WHATSAPP', status: 'SKIPPED_PTP',
    })
    add('receipt-verified', true, {
      ...base, loanId: activeLoan.id, paymentId: verifiedPayment.id,
      stage: 'RECEIPT', channel: 'PORTAL', status: 'SENT',
    })
    add('receipt-pending', false, {
      ...base, loanId: activeLoan.id, paymentId: pendingPayment.id,
      stage: 'RECEIPT', channel: 'WHATSAPP', status: 'SENT',
    })
    add('sent-recent-paid', false, {
      ...base, loanId: activeLoan.id, installmentId: paidInst.id,
      stage: 'OVERDUE_1', channel: 'PORTAL', status: 'SENT',
      createdAt: daysAgo(1, NOW),
    })
    const logIds = new Map<string, string>()
    for (const spec of logSpecs) {
      const row = await raw.reminderLog.create({ data: spec.data })
      logIds.set(spec.tag, row.id)
    }

    const auditOld = await raw.auditLog.create({
      data: {
        organizationId: orgId, userId: ownerId, action: AuditAction.CREATE,
        entityType: 'Loan', description: 'old audit row', createdAt: OLD,
      },
    })
    const auditRecent = await raw.auditLog.create({
      data: {
        organizationId: orgId, userId: ownerId, action: AuditAction.CREATE,
        entityType: 'Loan', description: 'recent audit row', createdAt: daysAgo(1, NOW),
      },
    })
    const notifOld = await raw.notification.create({
      data: {
        organizationId: orgId, candidateId: candidate.id,
        type: NotificationType.PAYMENT_REMINDER, title: 'old', message: 'old',
        createdAt: OLD,
      },
    })
    const notifRecent = await raw.notification.create({
      data: {
        organizationId: orgId, candidateId: candidate.id,
        type: NotificationType.PAYMENT_REMINDER, title: 'recent', message: 'recent',
        createdAt: daysAgo(1, NOW),
      },
    })
    const hookOld = await raw.webhookEvent.create({
      data: {
        organizationId: orgId, provider: 'mock', eventId: `evt-old-${suffix}`,
        rawPayload: {}, processed: true, receivedAt: OLD,
      },
    })
    const hookRecent = await raw.webhookEvent.create({
      data: {
        organizationId: orgId, provider: 'mock', eventId: `evt-recent-${suffix}`,
        rawPayload: {}, processed: true, receivedAt: daysAgo(1, NOW),
      },
    })
    const hookUnprocessed = await raw.webhookEvent.create({
      data: {
        organizationId: orgId, provider: 'mock', eventId: `evt-pending-${suffix}`,
        rawPayload: {}, processed: false, receivedAt: OLD,
      },
    })
    const sessExpired = await raw.session.create({
      data: { userId: ownerId, token: `tok-expired-${suffix}`, expiresAt: daysAgo(1, NOW) },
    })
    const sessRevoked = await raw.session.create({
      data: {
        userId: ownerId, token: `tok-revoked-${suffix}`,
        expiresAt: daysAgo(-30, NOW), revokedAt: daysAgo(2, NOW),
      },
    })
    const sessLive = await raw.session.create({
      data: { userId: ownerId, token: `tok-live-${suffix}`, expiresAt: daysAgo(-30, NOW) },
    })
    const tokExpired = await raw.passwordResetToken.create({
      data: { userId: ownerId, tokenHash: `hash-expired-${suffix}`, expiresAt: daysAgo(1, NOW) },
    })
    const tokUsed = await raw.passwordResetToken.create({
      data: {
        userId: ownerId, tokenHash: `hash-used-${suffix}`,
        expiresAt: daysAgo(-1, NOW), usedAt: daysAgo(2, NOW),
      },
    })
    const tokLive = await raw.passwordResetToken.create({
      data: { userId: ownerId, tokenHash: `hash-live-${suffix}`, expiresAt: daysAgo(-1, NOW) },
    })

    const financialCounts = async () => ({
      loans: await raw.loan.count({ where: { organizationId: orgId } }),
      payments: await raw.payment.count({ where: { organizationId: orgId } }),
      installments: await raw.installment.count({
        where: { loan: { organizationId: orgId } },
      }),
      ledger: await raw.ledgerEntry.count({ where: { organizationId: orgId } }),
    })
    const before = await financialCounts()
    assert.deepEqual(before, { loans: 2, payments: 2, installments: 3, ledger: 1 })

    // — Dry run: counts the safe set (as deltas over baseline), deletes nothing —
    const dry = await runPruneLogs({ dryRun: true, retentionDays: 90, now: NOW })
    assert.equal(dry.totalDeleted, 0)
    const matchedByTable = Object.fromEntries(dry.tables.map((t) => [t.table, t.matched]))
    const expectedDeltas: Record<string, number> = {
      AuditLog: 1,
      Notification: 1,
      ReminderLog: 5,
      WebhookEvent: 1,
      Session: 2,
      PasswordResetToken: 2,
    }
    for (const [table, delta] of Object.entries(expectedDeltas)) {
      assert.equal(
        matchedByTable[table] - (baseline[table] ?? 0),
        delta,
        `dry run should count ${delta} new prunable ${table} rows`
      )
    }
    assert.equal(await raw.reminderLog.count({ where: { organizationId: orgId } }), 11)
    assert.equal(await raw.auditLog.count({ where: { organizationId: orgId } }), 2)

    // — Real run: exactly what the dry run counted disappears —
    const real = await runPruneLogs({ dryRun: false, retentionDays: 90, now: NOW })
    assert.equal(real.totalDeleted, dry.totalMatched)
    for (const spec of logSpecs) {
      const row = await raw.reminderLog.findUnique({ where: { id: logIds.get(spec.tag) } })
      assert.equal(
        row === null,
        spec.deleted,
        `ReminderLog ${spec.tag} should ${spec.deleted ? 'be pruned' : 'survive'}`
      )
    }
    const gone = async (p: Promise<unknown>) => (await p) === null
    assert.equal(await gone(raw.auditLog.findUnique({ where: { id: auditOld.id } })), true)
    assert.equal(await gone(raw.auditLog.findUnique({ where: { id: auditRecent.id } })), false)
    assert.equal(await gone(raw.notification.findUnique({ where: { id: notifOld.id } })), true)
    assert.equal(await gone(raw.notification.findUnique({ where: { id: notifRecent.id } })), false)
    assert.equal(await gone(raw.webhookEvent.findUnique({ where: { id: hookOld.id } })), true)
    assert.equal(await gone(raw.webhookEvent.findUnique({ where: { id: hookRecent.id } })), false)
    assert.equal(await gone(raw.webhookEvent.findUnique({ where: { id: hookUnprocessed.id } })), false)
    assert.equal(await gone(raw.session.findUnique({ where: { id: sessExpired.id } })), true)
    assert.equal(await gone(raw.session.findUnique({ where: { id: sessRevoked.id } })), true)
    assert.equal(await gone(raw.session.findUnique({ where: { id: sessLive.id } })), false)
    assert.equal(await gone(raw.passwordResetToken.findUnique({ where: { id: tokExpired.id } })), true)
    assert.equal(await gone(raw.passwordResetToken.findUnique({ where: { id: tokUsed.id } })), true)
    assert.equal(await gone(raw.passwordResetToken.findUnique({ where: { id: tokLive.id } })), false)

    // — Financial records untouched; a second run is a no-op —
    assert.deepEqual(await financialCounts(), before)
    const again = await runPruneLogs({ dryRun: false, retentionDays: 90, now: NOW })
    assert.equal(again.totalDeleted, 0)
  } finally {
    if (orgId) {
      await raw.reminderLog.deleteMany({ where: { organizationId: orgId } })
      await raw.notification.deleteMany({ where: { organizationId: orgId } })
      await raw.auditLog.deleteMany({ where: { organizationId: orgId } })
      await raw.webhookEvent.deleteMany({ where: { organizationId: orgId } })
      await raw.ledgerEntry.deleteMany({ where: { organizationId: orgId } })
      await raw.payment.deleteMany({ where: { organizationId: orgId } })
      await raw.installment.deleteMany({ where: { loan: { organizationId: orgId } } })
      await raw.loan.deleteMany({ where: { organizationId: orgId } })
      await raw.session.deleteMany({ where: { userId: ownerId } })
      await raw.passwordResetToken.deleteMany({ where: { userId: ownerId } })
      await raw.candidate.deleteMany({ where: { organizationId: orgId } })
      await raw.user.deleteMany({ where: { organizationId: orgId } })
      await raw.organization.deleteMany({ where: { id: orgId } })
    }
    await raw.$disconnect()
  }
})

// ============================================================
// RUNNER
// ============================================================

async function runTests() {
  console.log(`\nRunning ${tests.length} prune-logs unit tests...\n`)
  let passed = 0
  for (const t of tests) {
    try {
      await t.fn()
      console.log(`✓ ${t.name}`)
      passed++
    } catch (err) {
      console.error(`✗ ${t.name}`)
      console.error(err)
      process.exit(1)
    }
  }
  console.log(`\nAll ${passed}/${tests.length} prune-logs unit tests passed.`)
}
runTests()
