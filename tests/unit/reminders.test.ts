import assert from 'node:assert/strict'
import {
  PrismaClient,
  LoanStatus,
  InstallmentStatus,
  PtpStatus,
  PaymentMethod,
  PaymentStatus,
  NotificationType,
  UserRole,
  InterestType,
  RepaymentFrequency,
} from '@prisma/client'
import {
  daysUntilDue,
  stageForDayDiff,
  stageForDueDate,
  isPtpCovered,
  buildReminderMessage,
  buildReceiptMessage,
  firstName,
} from '../../src/lib/reminders'
import { buildWhatsAppLink } from '../../src/lib/whatsapp'
import {
  isWhatsAppApiConfigured,
  sendWhatsAppText,
  toWhatsAppNumber,
} from '../../src/lib/server/whatsapp-sender'

interface TestCase {
  name: string
  fn: () => void | Promise<void>
}

const tests: TestCase[] = []
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn })
}

// Reference "now": 5 Nov 2026, 11:30 IST.
const NOW = new Date('2026-11-05T06:00:00Z')
const istDay = (isoDay: string) => new Date(`${isoDay}T05:00:00Z`) // 10:30 IST that day

// ============================================================
// 1. Stage selection — boundary dates (Asia/Kolkata calendar days)
// ============================================================

test('daysUntilDue counts IST calendar days, not UTC days', () => {
  assert.equal(daysUntilDue(istDay('2026-11-08'), NOW), 3)
  assert.equal(daysUntilDue(istDay('2026-11-06'), NOW), 1)
  assert.equal(daysUntilDue(istDay('2026-11-05'), NOW), 0)
  assert.equal(daysUntilDue(istDay('2026-11-04'), NOW), -1)
  // 20:00 UTC on Nov 5 is already Nov 6 in IST.
  const lateUtc = new Date('2026-11-05T20:00:00Z')
  assert.equal(daysUntilDue(istDay('2026-11-06'), lateUtc), 0)
  // 00:30 IST on Nov 5 — due later that same IST morning is still "today".
  const earlyIst = new Date('2026-11-04T19:00:00Z')
  assert.equal(daysUntilDue(istDay('2026-11-05'), earlyIst), 0)
})

test('stageForDayDiff fires exact due-soon stages and no others before due', () => {
  assert.equal(stageForDayDiff(4), null)
  assert.equal(stageForDayDiff(3), 'DUE_SOON_3')
  assert.equal(stageForDayDiff(2), null)
  assert.equal(stageForDayDiff(1), 'DUE_SOON_1')
  assert.equal(stageForDayDiff(0), 'DUE_TODAY')
})

test('stageForDayDiff overdue stages use latest-threshold semantics', () => {
  assert.equal(stageForDayDiff(-1), 'OVERDUE_1')
  assert.equal(stageForDayDiff(-2), 'OVERDUE_1')
  assert.equal(stageForDayDiff(-3), 'OVERDUE_3')
  assert.equal(stageForDayDiff(-5), 'OVERDUE_3')
  assert.equal(stageForDayDiff(-7), 'OVERDUE_7')
  assert.equal(stageForDayDiff(-14), 'OVERDUE_7')
  assert.equal(stageForDayDiff(-15), 'OVERDUE_15')
  assert.equal(stageForDayDiff(-29), 'OVERDUE_15')
  assert.equal(stageForDayDiff(-30), 'OVERDUE_30')
  assert.equal(stageForDayDiff(-90), 'OVERDUE_30')
})

test('stageForDueDate composes day math and stage selection', () => {
  assert.equal(stageForDueDate(istDay('2026-11-06'), NOW), 'DUE_SOON_1')
  assert.equal(stageForDueDate(istDay('2026-10-29'), NOW), 'OVERDUE_7')
  assert.equal(stageForDueDate(istDay('2026-11-07'), NOW), null)
})

// ============================================================
// 2. PTP suppression
// ============================================================

test('isPtpCovered: active PTP with promise day today or later covers', () => {
  assert.equal(isPtpCovered([{ status: 'ACTIVE', promiseDate: istDay('2026-11-05') }], NOW), true)
  assert.equal(isPtpCovered([{ status: 'ACTIVE', promiseDate: istDay('2026-11-20') }], NOW), true)
})

test('isPtpCovered: expired or non-active PTPs do not cover (reminders resume)', () => {
  assert.equal(isPtpCovered([{ status: 'ACTIVE', promiseDate: istDay('2026-11-04') }], NOW), false)
  assert.equal(isPtpCovered([{ status: 'FULFILLED', promiseDate: istDay('2026-11-20') }], NOW), false)
  assert.equal(isPtpCovered([{ status: 'BROKEN', promiseDate: istDay('2026-11-20') }], NOW), false)
  assert.equal(isPtpCovered([], NOW), false)
})

// ============================================================
// 3. Messages
// ============================================================

test('buildReminderMessage uses org name, first name, amount, due date', () => {
  const msg = buildReminderMessage({
    stage: 'DUE_SOON_1',
    orgName: 'Acme Finance',
    candidateName: 'Priya Sharma',
    loanNumber: 'LON-1',
    installmentNumber: 4,
    amountPaise: 625050,
    dueDate: istDay('2026-11-06'),
  })
  assert.ok(msg.includes('Acme Finance'), msg)
  assert.ok(msg.includes('Hello Priya,'), msg)
  assert.ok(!msg.includes('Sharma'), msg)
  assert.ok(msg.includes('₹6,250.5'), msg)
  assert.ok(msg.includes('6 Nov 2026'), msg)
  assert.equal(firstName('  Rahul  Verma '), 'Rahul')
})

test('buildReminderMessage picks the overdue wording for overdue stages', () => {
  const msg = buildReminderMessage({
    stage: 'OVERDUE_7',
    orgName: 'Acme Finance',
    candidateName: 'Rahul Verma',
    loanNumber: 'LON-2',
    installmentNumber: 2,
    amountPaise: 500000,
    dueDate: istDay('2026-10-29'),
  })
  assert.ok(msg.includes('OVERDUE'), msg)
})

test('buildReceiptMessage carries formatted amount and receipt number', () => {
  const built = buildReceiptMessage({
    orgName: 'Acme Finance',
    candidateName: 'Priya Sharma',
    loanNumber: 'LON-1',
    amountPaise: 250000,
    receiptNumber: 'RCPT-9',
  })
  assert.equal(built.title, 'Payment received')
  assert.ok(built.portalBody.includes('₹2,500'), built.portalBody)
  assert.ok(built.portalBody.includes('RCPT-9'), built.portalBody)
  assert.ok(built.whatsappText.includes('Acme Finance'), built.whatsappText)
  assert.ok(built.whatsappText.includes('Hello Priya,'), built.whatsappText)
})

test('buildWhatsAppLink builds an encoded wa.me draft URL', () => {
  const link = buildWhatsAppLink('9812345670', 'Hello Priya, a & b')
  assert.ok(link.startsWith('https://wa.me/919812345670?text='), link)
  assert.ok(link.includes('a%20%26%20b'), link)
})

// ============================================================
// 4. WhatsApp sender (fetch stubbed — no network)
// ============================================================

const savedEnv: Record<string, string | undefined> = {}
for (const k of ['WHATSAPP_API_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']) {
  savedEnv[k] = process.env[k]
}

function restoreEnv() {
  for (const k of Object.keys(savedEnv)) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
}

const savedFetch = globalThis.fetch

function stubFetch(impl: (url: string, init: any) => Promise<any>) {
  const calls: Array<{ url: string; init: any }> = []
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), init })
    return impl(String(url), init)
  }) as any
  return calls
}

test('sender reports unconfigured when env is absent', async () => {
  delete process.env.WHATSAPP_API_TOKEN
  delete process.env.WHATSAPP_PHONE_NUMBER_ID
  assert.equal(isWhatsAppApiConfigured(), false)
  const res = await sendWhatsAppText('9812345670', 'hi')
  assert.equal(res.ok, false)
  assert.ok((res.error ?? '').includes('not configured'))
  assert.equal(toWhatsAppNumber('9812345670'), '919812345670')
  assert.equal(toWhatsAppNumber('09812345670'), '919812345670')
  assert.equal(toWhatsAppNumber('919812345670'), '919812345670')
})

test('sender posts a text message to the Graph API when configured', async () => {
  process.env.WHATSAPP_API_TOKEN = 'test-token-value'
  process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890'
  assert.equal(isWhatsAppApiConfigured(), true)
  const calls = stubFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ messages: [{ id: 'wamid.1' }] }),
  }))
  const res = await sendWhatsAppText('9812345670', 'Hello')
  assert.equal(res.ok, true)
  assert.equal(res.providerMessageId, 'wamid.1')
  assert.equal(calls.length, 1)
  assert.ok(calls[0].url.includes('graph.facebook.com'), calls[0].url)
  assert.ok(calls[0].url.includes('/1234567890/messages'), calls[0].url)
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token-value')
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.to, '919812345670')
  assert.equal(body.type, 'text')
  assert.equal(body.text.body, 'Hello')
})

test('sender surfaces API errors and network failures as ok:false', async () => {
  process.env.WHATSAPP_API_TOKEN = 'test-token-value'
  process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890'
  stubFetch(async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: { message: 'Invalid phone number' } }),
  }))
  const apiErr = await sendWhatsAppText('9812345670', 'Hello')
  assert.equal(apiErr.ok, false)
  assert.ok((apiErr.error ?? '').includes('Invalid phone number'))

  stubFetch(async () => {
    throw new Error('socket hangup')
  })
  const netErr = await sendWhatsAppText('9812345670', 'Hello')
  assert.equal(netErr.ok, false)
  assert.ok((netErr.error ?? '').includes('socket hangup'))

  globalThis.fetch = savedFetch
  restoreEnv()
})

// ============================================================
// 5. DB integration — runner idempotency, PTP, kill switch, receipts
//    (runs only when DATABASE_URL_TEST is available; CI covers the
//    runner end-to-end via tests/reminders.spec.ts)
// ============================================================

const HAS_DB = Boolean(process.env.DATABASE_URL_TEST)

test('DB: runner sends, queues, skips on PTP, and never duplicates', async () => {
  if (!HAS_DB) {
    console.log('  (skipped — DATABASE_URL_TEST not set)')
    return
  }
  delete process.env.WHATSAPP_API_TOKEN
  delete process.env.WHATSAPP_PHONE_NUMBER_ID

  const raw = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST })
  const suffix = Math.random().toString(36).slice(2, 8)
  const orgName = `Reminder Test Org ${suffix}`
  let orgId = ''
  let orgBId = ''
  try {
    const org = await raw.organization.create({
      data: { name: orgName },
    })
    orgId = org.id
    const orgB = await raw.organization.create({
      data: { name: `Reminder Off Org ${suffix}`, remindersEnabled: false },
    })
    orgBId = orgB.id

    const candidate = await raw.candidate.create({
      data: {
        organizationId: orgId,
        fullName: 'Test Borrower',
        mobile: '9812345670',
      },
    })

    const mkLoan = async (loanNumber: string, status: LoanStatus) =>
      raw.loan.create({
        data: {
          organizationId: orgId,
          loanNumber,
          candidateId: candidate.id,
          principalAmount: 1200000,
          interestType: InterestType.PERCENTAGE,
          interestRate: 1200,
          frequency: RepaymentFrequency.MONTHLY,
          installments: 12,
          firstDueDate: istDay('2026-08-06'),
          finalDueDate: istDay('2027-07-06'),
          totalRepayable: 1350000,
          installmentAmount: 112500,
          termsSnapshot: {},
          status,
          outstandingPrincipal: 1200000,
        },
      })

    const mkInstallment = async (
      loanId: string,
      n: number,
      due: string,
      opts: { paid?: boolean } = {}
    ) =>
      raw.installment.create({
        data: {
          loanId,
          installmentNumber: n,
          dueDate: istDay(due),
          openingPrincipal: 1200000,
          principalComponent: 100000,
          interestComponent: 12500,
          feesComponent: 0,
          totalDue: 112500,
          closingPrincipal: 1100000,
          paidAmount: opts.paid ? 112500 : 0,
          paidPrincipal: opts.paid ? 100000 : 0,
          paidInterest: opts.paid ? 12500 : 0,
          status: opts.paid ? InstallmentStatus.PAID : InstallmentStatus.UPCOMING,
        },
      })

    const loan1 = await mkLoan(`LON-RT-${suffix}-1`, LoanStatus.ACTIVE)
    await mkInstallment(loan1.id, 1, '2026-11-06') // DUE_SOON_1 at NOW
    await mkInstallment(loan1.id, 2, '2026-10-29') // OVERDUE_7 at NOW
    await mkInstallment(loan1.id, 3, '2026-10-29', { paid: true }) // excluded

    const loanClosed = await mkLoan(`LON-RT-${suffix}-2`, LoanStatus.CLOSED)
    await mkInstallment(loanClosed.id, 1, '2026-10-29') // excluded (loan closed)

    const loanPtp = await mkLoan(`LON-RT-${suffix}-3`, LoanStatus.ACTIVE)
    await mkInstallment(loanPtp.id, 1, '2026-11-04') // would be OVERDUE_1
    const agentUser = await raw.user.create({
      data: {
        organizationId: orgId,
        email: `rt-agent-${suffix}@example.com`,
        passwordHash: 'x',
        name: 'RT Agent',
        role: UserRole.AGENT,
      },
    })
    await raw.ptp.create({
      data: {
        candidateId: candidate.id,
        loanId: loanPtp.id,
        agentId: agentUser.id,
        promisedAmount: 112500,
        promiseDate: istDay('2026-11-10'), // covers at NOW
        status: PtpStatus.ACTIVE,
      },
    })

    const loanPtpExpired = await mkLoan(`LON-RT-${suffix}-4`, LoanStatus.ACTIVE)
    await mkInstallment(loanPtpExpired.id, 1, '2026-11-04') // OVERDUE_1
    await raw.ptp.create({
      data: {
        candidateId: candidate.id,
        loanId: loanPtpExpired.id,
        agentId: agentUser.id,
        promisedAmount: 112500,
        promiseDate: istDay('2026-11-04'), // promise day passed at NOW
        status: PtpStatus.ACTIVE,
      },
    })

    // Org B: kill switch off — nothing may be created for it.
    const candidateB = await raw.candidate.create({
      data: { organizationId: orgBId, fullName: 'Off Borrower', mobile: '9812345671' },
    })
    const loanB = await raw.loan.create({
      data: {
        organizationId: orgBId,
        loanNumber: `LON-RT-${suffix}-B`,
        candidateId: candidateB.id,
        principalAmount: 1200000,
        interestType: InterestType.PERCENTAGE,
        interestRate: 1200,
        frequency: RepaymentFrequency.MONTHLY,
        installments: 12,
        firstDueDate: istDay('2026-08-06'),
        finalDueDate: istDay('2027-07-06'),
        totalRepayable: 1350000,
        installmentAmount: 112500,
        termsSnapshot: {},
        status: LoanStatus.ACTIVE,
      },
    })
    await mkInstallment(loanB.id, 1, '2026-11-06')

    const { runReminders, notifyPaymentReceipt } = await import(
      '../../src/lib/server/reminders'
    )

    // --- first run
    const s1 = await runReminders({ organizationId: orgId, now: NOW })
    assert.equal(s1.sent, 3, JSON.stringify(s1)) // portal: soon-1, overdue-7, ptp-expired
    assert.equal(s1.queued, 3, JSON.stringify(s1)) // whatsapp tasks for the same three
    assert.equal(s1.skippedPtp, 2, JSON.stringify(s1)) // PTP-covered loan, both channels
    assert.equal(s1.failed, 0, JSON.stringify(s1))

    const logs = await raw.reminderLog.findMany({ where: { organizationId: orgId } })
    assert.equal(logs.length, 8)
    const notifs = await raw.notification.findMany({
      where: { candidateId: candidate.id },
    })
    assert.equal(notifs.length, 3)
    assert.ok(notifs.every((n) => n.message.includes(orgName)))
    const tasks = await raw.collectionTask.findMany({
      where: { organizationId: orgId },
    })
    assert.equal(tasks.length, 3)
    assert.ok(tasks.every((t) => (t.description ?? '').includes('https://wa.me/919812345670')))

    // --- second run: full idempotency
    const s2 = await runReminders({ organizationId: orgId, now: NOW })
    assert.equal(s2.sent, 0, JSON.stringify(s2))
    assert.equal(s2.queued, 0, JSON.stringify(s2))
    assert.equal(s2.alreadyLogged, 8, JSON.stringify(s2))
    assert.equal((await raw.reminderLog.count({ where: { organizationId: orgId } })), 8)

    // --- dry run writes nothing
    const s3 = await runReminders({ organizationId: orgId, now: NOW, dryRun: true })
    assert.equal(s3.dryRun, true)
    assert.equal((await raw.reminderLog.count({ where: { organizationId: orgId } })), 8)

    // --- kill switch: org B produces nothing
    const sB = await runReminders({ organizationId: orgBId, now: NOW })
    assert.equal(sB.organizations, 0, JSON.stringify(sB))
    assert.equal(await raw.reminderLog.count({ where: { organizationId: orgBId } }), 0)

    // --- receipt: sends once, dedups on retry
    const payment = await raw.payment.create({
      data: {
        organizationId: orgId,
        paymentNumber: `PAY-RT-${suffix}`,
        loanId: loan1.id,
        candidateId: candidate.id,
        method: PaymentMethod.CASH,
        amount: 250000,
        status: PaymentStatus.VERIFIED,
        receiptNumber: `RCPT-RT-${suffix}`,
      },
    })
    const r1 = await notifyPaymentReceipt({
      paymentId: payment.id,
      organizationId: orgId,
      receiptNumber: payment.receiptNumber,
    })
    assert.deepEqual(r1, { sent: 1, queued: 1, skipped: false })
    const r2 = await notifyPaymentReceipt({
      paymentId: payment.id,
      organizationId: orgId,
      receiptNumber: payment.receiptNumber,
    })
    assert.deepEqual(r2, { sent: 0, queued: 0, skipped: false })
    const receiptLogs = await raw.reminderLog.findMany({
      where: { paymentId: payment.id },
    })
    assert.equal(receiptLogs.length, 2)
    const receiptNotif = await raw.notification.findFirst({
      where: { candidateId: candidate.id, type: NotificationType.RECEIPT },
    })
    assert.ok(receiptNotif)
    assert.ok(receiptNotif!.message.includes(`RCPT-RT-${suffix}`))
  } finally {
    for (const oid of [orgId, orgBId]) {
      if (!oid) continue
      await raw.reminderLog.deleteMany({ where: { organizationId: oid } })
      await raw.notification.deleteMany({ where: { organizationId: oid } })
      await raw.collectionTask.deleteMany({ where: { organizationId: oid } })
      await raw.payment.deleteMany({ where: { organizationId: oid } })
      await raw.ptp.deleteMany({ where: { candidate: { organizationId: oid } } })
      await raw.installment.deleteMany({ where: { loan: { organizationId: oid } } })
      await raw.loan.deleteMany({ where: { organizationId: oid } })
      await raw.candidate.deleteMany({ where: { organizationId: oid } })
      await raw.user.deleteMany({ where: { organizationId: oid } })
      await raw.organization.deleteMany({ where: { id: oid } })
    }
    await raw.$disconnect()
  }
})

// ============================================================
// RUNNER
// ============================================================

async function runTests() {
  console.log(`\nRunning ${tests.length} reminders unit tests...\n`)
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
  console.log(`\nAll ${passed}/${tests.length} reminders unit tests passed.`)
}
runTests()
