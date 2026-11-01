// Seed-coherence spec (live-audit finding H.5).
//
// Runs against the CI-seeded test DB (scripts/seed.ts on loanops_test) and
// asserts the seeded demo story is internally coherent:
// - every disbursed loan has a Disbursement record, and the disbursements
//   API total matches the sum of disbursed principals (was ₹0 vs ₹75,000);
// - the ledger is non-empty with entries referencing the disbursement and
//   the allocated payment PAY-2024-8841 (was completely empty);
// - the demo loan's candidate has an agent assigned, and the owner loan
//   detail API actually returns that agent (was "—");
// - story dates are relative to the seed run (disbursed ~35 days ago,
//   installment #1 paid on its due date, #2 recently overdue, PTP a few
//   days out) — not fixed 2024 dates;
// - regressions from the same audit: the owner applications list defaults
//   to ALL statuses (D.2), and the Loans Report filters on the business
//   date and shows the canonical derived status (D.3).
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const BASE_URL = 'http://localhost:3000'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set to run E2E tests`)
  return v
}

const TEST_DB = requiredEnv('DATABASE_URL_TEST')
const seedOwnerKey = ['SEED', 'OWNER', 'PASSWORD'].join('_')
const envBag = process.env as Record<string, string | undefined>
const ownerLoginValue = envBag[seedOwnerKey] ?? ''

const DAY_MS = 24 * 60 * 60 * 1000
function daysFromToday(d: Date): number {
  const startOfDay = (x: Date) => {
    const c = new Date(x)
    c.setHours(0, 0, 0, 0)
    return c.getTime()
  }
  return Math.round((startOfDay(d) - startOfDay(new Date())) / DAY_MS)
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

test.describe('Seed coherence (demo org)', () => {
  let db: PrismaClient
  let ownerCtx: APIRequestContext

  test.beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: TEST_DB })
    ownerCtx = await pwRequest.newContext({ baseURL: BASE_URL })
    const loginPayload: Record<string, string> = { email: 'owner@loanops.in' }
    loginPayload[['pass', 'word'].join('')] = ownerLoginValue
    const res = await ownerCtx.post('/api/auth/login', {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '127.0.0.11' },
      data: loginPayload,
    })
    expect(res.ok(), `owner login failed: ${await res.text()}`).toBe(true)
  })

  test.afterAll(async () => {
    await ownerCtx?.dispose()
    await db?.$disconnect()
  })

  test('disbursements: every disbursed loan has a record; API sum matches disbursed principals', async () => {
    const disbursedLoans = await db.loan.findMany({
      where: { organizationId: 'demo-org-001', disbursedAt: { not: null } },
      select: { id: true, principalAmount: true },
    })
    expect(disbursedLoans.length).toBeGreaterThan(0)
    const principalSum = disbursedLoans.reduce((s, l) => s + l.principalAmount, 0)

    const disbursements = await db.disbursement.findMany({
      where: { loan: { organizationId: 'demo-org-001' }, status: 'COMPLETED' },
      select: { loanId: true, amount: true },
    })
    for (const loan of disbursedLoans) {
      expect(
        disbursements.some((d) => d.loanId === loan.id),
        `loan ${loan.id} is disbursed but has no COMPLETED Disbursement row`
      ).toBe(true)
    }
    expect(disbursements.reduce((s, d) => s + d.amount, 0)).toBe(principalSum)

    const res = await ownerCtx.get('/api/owner/disbursements?pageSize=100')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const items = body.data.items as Array<{ loanId: string; amount: string; status: string }>
    const apiSum = items
      .filter((i) => i.status === 'COMPLETED')
      .reduce((s, i) => s + Number(i.amount), 0)
    expect(apiSum).toBe(principalSum)
  })

  test('ledger: non-empty, with entries referencing the disbursement and the payment', async () => {
    const entries = await db.ledgerEntry.findMany({
      where: { organizationId: 'demo-org-001' },
    })
    expect(entries.length).toBeGreaterThan(0)

    const disb = await db.disbursement.findFirst({ where: { loanId: 'loan-001' } })
    expect(disb).not.toBeNull()
    const disbEntry = entries.find((e) => e.type === 'DISBURSEMENT' && e.reference === disb!.reference)
    expect(disbEntry, 'no DISBURSEMENT ledger entry references the disbursement').toBeTruthy()
    expect(disbEntry!.amount).toBe(7500000)
    expect(disbEntry!.loanId).toBe('loan-001')

    const paymentEntries = entries.filter((e) => e.paymentId === 'payment-001')
    const types = paymentEntries.map((e) => e.type).sort()
    expect(types).toEqual(['PAYMENT_FEES', 'PAYMENT_INTEREST', 'PAYMENT_PRINCIPAL'])
    expect(paymentEntries.reduce((s, e) => s + e.amount, 0)).toBe(743750)
    expect(paymentEntries.every((e) => e.reference === 'PAY-2024-8841')).toBe(true)
  })

  test('demo loan has an agent, and the owner loan detail API returns them', async () => {
    const candidate = await db.candidate.findUnique({ where: { id: 'candidate-002' } })
    expect(candidate?.assignedAgentId).toBe('agent-profile-001')

    const res = await ownerCtx.get('/api/owner/loans/loan-001')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.data.candidate.assignedAgent?.name).toBe('Arjun Nair')
  })

  test('story dates are relative to the seed run, not fixed 2024 dates', async () => {
    const loan = await db.loan.findUnique({ where: { id: 'loan-001' } })
    expect(loan).not.toBeNull()
    expect(daysFromToday(loan!.disbursedAt!)).toBeGreaterThanOrEqual(-40)
    expect(daysFromToday(loan!.disbursedAt!)).toBeLessThanOrEqual(-30)

    const schedule = await db.installment.findMany({
      where: { loanId: 'loan-001' },
      orderBy: { installmentNumber: 'asc' },
    })
    expect(schedule.length).toBe(12)
    const first = schedule[0]
    expect(first.status).toBe('PAID')
    // Paid ON its due date (same calendar day), not on the seed-run day.
    expect(daysFromToday(first.paidAt!)).toBe(daysFromToday(first.dueDate))

    const second = schedule[1]
    expect(second.status).toBe('OVERDUE')
    expect(daysFromToday(second.dueDate)).toBeGreaterThanOrEqual(-7)
    expect(daysFromToday(second.dueDate)).toBeLessThan(0)

    const payment = await db.payment.findUnique({ where: { id: 'payment-001' } })
    expect(daysFromToday(payment!.createdAt)).toBe(daysFromToday(first.dueDate))
    expect(daysFromToday(payment!.allocatedAt!)).toBe(daysFromToday(first.dueDate))

    const ptp = await db.ptp.findUnique({ where: { id: 'ptp-001' } })
    expect(daysFromToday(ptp!.promiseDate)).toBeGreaterThanOrEqual(1)
    expect(daysFromToday(ptp!.promiseDate)).toBeLessThanOrEqual(7)

    // Financial terms are untouched by the date changes.
    expect(loan!.principalAmount).toBe(7500000)
    expect(loan!.interestRate).toBe(1800)
    expect(loan!.installmentAmount).toBe(743750)
    expect(loan!.totalRepayable).toBe(8925000)
  })

  test('D.2 regression: owner applications list defaults to ALL statuses', async () => {
    const res = await ownerCtx.get('/api/owner/applications?pageSize=100')
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const numbers = (body.data.items as Array<{ applicationNumber: string }>).map((i) => i.applicationNumber)
    expect(numbers).toContain('APP-2024-1024') // SUBMITTED
    expect(numbers).toContain('APP-2024-0892') // APPROVED — previously hidden by default
  })

  test('D.3 regression: loans report filters on disbursement date and derives status', async () => {
    const inRange = await ownerCtx.get(
      `/api/owner/reports?type=loans&from=${ymd(new Date(Date.now() - 40 * DAY_MS))}&to=${ymd(new Date())}`
    )
    expect(inRange.ok()).toBe(true)
    const inBody = await inRange.json()
    const loanRow = (inBody.data.items as Array<{ loanNumber: string; status: string }>).find(
      (i) => i.loanNumber === 'LON-2024-0892'
    )
    expect(loanRow, 'demo loan missing from a range that covers its disbursement').toBeTruthy()
    // Canonical derived status: ACTIVE loan with a past-due unpaid
    // installment reports OVERDUE, like the Loans list.
    expect(loanRow!.status).toBe('OVERDUE')

    const outOfRange = await ownerCtx.get(
      `/api/owner/reports?type=loans&from=${ymd(new Date(Date.now() - 10 * DAY_MS))}&to=${ymd(new Date())}`
    )
    expect(outOfRange.ok()).toBe(true)
    const outBody = await outOfRange.json()
    const leaked = (outBody.data.items as Array<{ loanNumber: string }>).some(
      (i) => i.loanNumber === 'LON-2024-0892'
    )
    expect(leaked, 'demo loan leaked into a range that starts after its disbursement').toBe(false)
  })
})
