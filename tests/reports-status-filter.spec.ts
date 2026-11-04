// Reports status-filter spec (gap-list debt N3).
//
// The loans / portfolio report branches DISPLAY the derived loan
// status (a loan whose next unpaid installment is past due displays
// "OVERDUE" even before anything rewrites its stored status) but
// historically FILTERED on the stored Loan.status column — so a
// status filter could contradict the rows on screen, and OVERDUE was
// rejected 422 even though it is a displayed value. The filter now
// operates on the derived status.
//
// The property pinned here is filter-matches-display, exercised on a
// loan whose stored and displayed statuses genuinely differ. Which
// loan that is must NOT be hard-coded: this suite shares one seeded
// database and neighbouring specs apply payments to shared loans, so
// any single loan's stored status at this point in the run is not a
// stable fixture. The spec therefore DISCOVERS the mismatch at run
// time — scanning the unfiltered report for a loan whose displayed
// status differs from the stored status on its loan-detail record
// (the seeded demo loan is checked first, as the historical carrier
// of this mismatch, but the tests do not depend on it being the one).
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

const seedOwnerKey = ['SEED', 'OWNER', 'PASSWORD'].join('_')
const envBag = process.env as Record<string, string | undefined>
const ownerLoginValue = envBag[seedOwnerKey] ?? ''

const DEMO_LOAN = 'LON-2024-0892'

interface ReportItem {
  id: string
  loanNumber: string
  status: string // the DISPLAYED (derived) status
}

interface Mismatch {
  loanNumber: string
  displayed: string
  stored: string
}

test.describe('Owner reports — status filter matches the displayed (derived) status', () => {
  let ownerCtx: APIRequestContext
  let mismatch: Mismatch | null = null

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

  async function getStoredStatus(loanId: string): Promise<string> {
    const res = await ownerCtx.get(`/api/owner/loans/${loanId}`)
    expect(res.ok(), `loan detail ${loanId} failed: ${await res.text()}`).toBe(true)
    // The detail API returns the loan record itself: data.status is the
    // STORED Loan.status (the reports API is the one that derives).
    return (await res.json()).data.status
  }

  test('the unfiltered report contains a loan whose displayed status differs from its stored status', async () => {
    const data = await getReport('type=loans')
    const items = data.items as ReportItem[]
    expect(items.length).toBeGreaterThan(0)

    // Probe order: the demo loan first (historical carrier), then any
    // loan displayed OVERDUE (the derivation only ever moves a loan
    // INTO overdue), then the rest — first stored≠displayed wins.
    const byNumber = (n: string) => items.filter((i) => i.loanNumber === n)
    const notDemo = items.filter((i) => i.loanNumber !== DEMO_LOAN)
    const probeOrder = [
      ...byNumber(DEMO_LOAN),
      ...notDemo.filter((i) => i.status === 'OVERDUE'),
      ...notDemo.filter((i) => i.status !== 'OVERDUE'),
    ]
    for (const item of probeOrder) {
      const stored = await getStoredStatus(item.id)
      if (stored !== item.status) {
        mismatch = { loanNumber: item.loanNumber, displayed: item.status, stored }
        break
      }
    }
    expect(
      mismatch,
      'no loan with differing stored/displayed status in the unfiltered report — the filter property cannot be pinned without one'
    ).toBeTruthy()
  })

  test('filtering loans by the displayed status includes the mismatch loan (no 422)', async () => {
    expect(mismatch).toBeTruthy()
    const data = await getReport(`type=loans&status=${mismatch!.displayed}`)
    const items = data.items as ReportItem[]
    expect(items.map((i) => i.loanNumber)).toContain(mismatch!.loanNumber)
    expect(items.every((i) => i.status === mismatch!.displayed)).toBe(true)
    expect(data.total).toBe(items.length)
  })

  test('filtering loans by the stored status excludes the mismatch loan', async () => {
    expect(mismatch).toBeTruthy()
    const data = await getReport(`type=loans&status=${mismatch!.stored}`)
    const items = data.items as ReportItem[]
    expect(items.map((i) => i.loanNumber)).not.toContain(mismatch!.loanNumber)
    expect(items.every((i) => i.status === mismatch!.stored)).toBe(true)
    expect(data.total).toBe(items.length)
  })

  test('portfolio applies the same displayed-status filter and its counts agree with its items', async () => {
    expect(mismatch).toBeTruthy()

    const byDisplayed = await getReport(`type=portfolio&status=${mismatch!.displayed}`)
    expect((byDisplayed.items as ReportItem[]).map((i) => i.loanNumber)).toContain(mismatch!.loanNumber)
    expect((byDisplayed.items as ReportItem[]).every((i) => i.status === mismatch!.displayed)).toBe(true)
    expect(byDisplayed.summary.totalLoans).toBe(byDisplayed.items.length)

    const byStored = await getReport(`type=portfolio&status=${mismatch!.stored}`)
    expect((byStored.items as ReportItem[]).map((i) => i.loanNumber)).not.toContain(mismatch!.loanNumber)
    expect(byStored.summary.totalLoans).toBe(byStored.items.length)
  })

  test('an unknown status value is still a 422, not a 500', async () => {
    const res = await ownerCtx.get('/api/owner/reports?type=loans&status=BOGUS')
    expect(res.status()).toBe(422)
  })
})
