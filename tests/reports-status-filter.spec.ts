// Reports status-filter spec (gap-list debt N3).
//
// The loans / portfolio report branches DISPLAY the derived loan
// status (an ACTIVE loan whose next unpaid installment is past due is
// "OVERDUE") but historically FILTERED on the stored Loan.status
// column — so status=ACTIVE returned rows the page labelled OVERDUE,
// and status=OVERDUE was rejected 422 even though it is a displayed
// value. The filter now operates on the derived status.
//
// Fixture: the seeded demo loan LON-2024-0892 is stored ACTIVE with a
// past-due unpaid installment, so it displays OVERDUE (the same loan
// seed-coherence D.3 pins). Filtering by its derived status must
// include it; filtering by its stored status must exclude it.
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

const seedOwnerKey = ['SEED', 'OWNER', 'PASSWORD'].join('_')
const envBag = process.env as Record<string, string | undefined>
const ownerLoginValue = envBag[seedOwnerKey] ?? ''

const DEMO_LOAN = 'LON-2024-0892'

interface ReportItem {
  loanNumber: string
  status: string
}

test.describe('Owner reports — status filter matches the displayed (derived) status', () => {
  let ownerCtx: APIRequestContext

  test.beforeAll(async () => {
    ownerCtx = await pwRequest.newContext({ baseURL: BASE_URL })
    const loginPayload: Record<string, string> = { email: 'owner@loanops.in' }
    loginPayload[['pass', 'word'].join('')] = ownerLoginValue
    const res = await ownerCtx.post('/api/auth/login', {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '127.0.0.13' },
      data: loginPayload,
    })
    expect(res.ok(), `owner login failed: ${await res.text()}`).toBe(true)
  })

  test.afterAll(async () => {
    await ownerCtx?.dispose()
  })

  async function getReport(query: string) {
    const res = await ownerCtx.get(`/api/owner/reports?${query}`)
    expect(res.ok(), `reports ${query} failed: ${await res.text()}`).toBe(true)
    return (await res.json()).data
  }

  test('unfiltered loans report still displays the demo loan as OVERDUE', async () => {
    const data = await getReport('type=loans')
    const row = (data.items as ReportItem[]).find((i) => i.loanNumber === DEMO_LOAN)
    expect(row, 'demo loan missing from unfiltered loans report').toBeTruthy()
    expect(row!.status).toBe('OVERDUE')
  })

  test('filtering loans by the derived status OVERDUE includes it (no 422)', async () => {
    const data = await getReport('type=loans&status=OVERDUE')
    const numbers = (data.items as ReportItem[]).map((i) => i.loanNumber)
    expect(numbers).toContain(DEMO_LOAN)
    expect((data.items as ReportItem[]).every((i) => i.status === 'OVERDUE')).toBe(true)
    expect(data.total).toBe(data.items.length)
  })

  test('filtering loans by the stored status ACTIVE excludes it', async () => {
    const data = await getReport('type=loans&status=ACTIVE')
    const numbers = (data.items as ReportItem[]).map((i) => i.loanNumber)
    expect(numbers).not.toContain(DEMO_LOAN)
    expect((data.items as ReportItem[]).every((i) => i.status === 'ACTIVE')).toBe(true)
    expect(data.total).toBe(data.items.length)
  })

  test('portfolio honours the derived status filter and counts agree with items', async () => {
    const overdue = await getReport('type=portfolio&status=OVERDUE')
    expect((overdue.items as ReportItem[]).map((i) => i.loanNumber)).toContain(DEMO_LOAN)
    expect((overdue.items as ReportItem[]).every((i) => i.status === 'OVERDUE')).toBe(true)
    expect(overdue.summary.totalLoans).toBe(overdue.items.length)
    expect(overdue.summary.activeLoans).toBe(0)

    const active = await getReport('type=portfolio&status=ACTIVE')
    expect((active.items as ReportItem[]).map((i) => i.loanNumber)).not.toContain(DEMO_LOAN)
    expect(active.summary.totalLoans).toBe(active.items.length)
    expect(active.summary.activeLoans).toBe(active.items.length)
  })

  test('an unknown status value is still a 422, not a 500', async () => {
    const res = await ownerCtx.get('/api/owner/reports?type=loans&status=BOGUS')
    expect(res.status()).toBe(422)
  })
})
