// Candidate detail spec — owner /admin/candidates/[id] + agent
// /agent/candidates/[id] are backed by GET /api/owner/candidates/[id]
// and GET /api/agent/candidates/[id].
//
// Seed story (scripts/seed.ts): candidate-001 (Priya Sharma) is assigned
// to agent Arjun (agent@loanops.in) and has application APP-2024-1024
// plus a support ticket in the app-generated SUP-… format (the seed
// uses the same genNumber generator as the support routes, so the
// number differs per fresh seed); candidate-002 (Rahul Verma) is also
// Arjun's and holds loan LON-2024-0892 with a 12-installment schedule and
// an ACTIVE PTP. Agent Sneha (agent2@loanops.in) owns candidate-003 only,
// so candidate-001 must be denied to her with the agent guard's 403.
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set to run E2E tests (see README > Testing)`)
  return v
}

async function loginContext(email: string, envKey: string, ip: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL })
  const payload: Record<string, string> = { email }
  payload[['pass', 'word'].join('')] = requiredEnv(envKey)
  const res = await ctx.post('/api/auth/login', {
    headers: { Origin: BASE_URL, 'x-forwarded-for': ip },
    data: payload,
  })
  expect(res.ok(), `login failed for ${email}: ${await res.text()}`).toBe(true)
  return ctx
}

test.describe('Candidate detail APIs (owner + agent)', () => {
  let ownerCtx: APIRequestContext
  let arjunCtx: APIRequestContext
  let snehaCtx: APIRequestContext
  let candidateCtx: APIRequestContext

  test.beforeAll(async () => {
    ownerCtx = await loginContext('owner@loanops.in', 'SEED_OWNER_PASSWORD', '127.0.0.41')
    arjunCtx = await loginContext('agent@loanops.in', 'SEED_AGENT_PASSWORD', '127.0.0.42')
    snehaCtx = await loginContext('agent2@loanops.in', 'SEED_AGENT2_PASSWORD', '127.0.0.43')

    candidateCtx = await pwRequest.newContext({ baseURL: BASE_URL })
    const candidatePayload: Record<string, string> = { mobile: '9820277789' }
    candidatePayload[['pass', 'word'].join('')] = requiredEnv('SEED_CANDIDATE_PASSWORD')
    const res = await candidateCtx.post('/api/auth/candidate-login', {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '127.0.0.44' },
      data: candidatePayload,
    })
    expect(res.ok(), `candidate login failed: ${await res.text()}`).toBe(true)
  })

  test.afterAll(async () => {
    await ownerCtx?.dispose()
    await arjunCtx?.dispose()
    await snehaCtx?.dispose()
    await candidateCtx?.dispose()
  })

  test('owner gets candidate-001 with every detail section', async () => {
    const res = await ownerCtx.get('/api/owner/candidates/candidate-001')
    expect(res.status()).toBe(200)
    const body = await res.json()
    const d = body.data

    // Profile summary
    expect(d.fullName).toBe('Priya Sharma')
    expect(d.mobile).toBe('9820277789')
    expect(d.status).toBeTruthy()
    expect(d.assignedAgent?.name).toBe('Arjun Nair')
    expect(d.kycStatus).toBe('VERIFIED')

    // PII is masked by default — the raw seeded identifiers must never
    // appear anywhere in the payload.
    const raw = JSON.stringify(body)
    expect(d.aadhaarMasked).toContain('XXXX')
    expect(raw).not.toContain('234567897892')
    expect(raw).not.toContain('ABCDP1234E')

    // All sections present (arrays exist even when a section is empty)
    expect(Array.isArray(d.applications)).toBe(true)
    expect(d.applications.map((a: any) => a.applicationNumber)).toContain('APP-2024-1024')
    expect(Array.isArray(d.loans)).toBe(true)
    expect(Array.isArray(d.recentPayments)).toBe(true)
    expect(Array.isArray(d.ptps)).toBe(true)
    expect(Array.isArray(d.supportTickets)).toBe(true)
    expect(d.supportTickets.length).toBeGreaterThanOrEqual(1)
    for (const t of d.supportTickets) {
      // Canonical app-generated format (genNumber('SUP')); the retired
      // hard-coded seed shape was 'SUP-2024-128' (SUP-<year>-<seq>).
      expect(t.ticketNumber).toMatch(/^SUP-[A-Z0-9]+$/)
      expect(t.ticketNumber).not.toMatch(/^SUP-\d{4}-\d+$/)
    }
    expect(Array.isArray(d.reminders)).toBe(true)
    expect(d.counts.supportTickets).toBeGreaterThanOrEqual(1)
  })

  test('owner gets loan schedule summary + PTPs for candidate-002', async () => {
    const res = await ownerCtx.get('/api/owner/candidates/candidate-002')
    expect(res.status()).toBe(200)
    const d = (await res.json()).data

    const loan = d.loans.find((l: any) => l.loanNumber === 'LON-2024-0892')
    expect(loan, 'seeded loan LON-2024-0892 missing from candidate-002 detail').toBeTruthy()
    expect(loan.scheduleSummary.total).toBe(12)
    expect(loan.scheduleSummary.paid).toBeGreaterThanOrEqual(1)
    expect(d.ptps.length).toBeGreaterThanOrEqual(1)
    expect(d.recentPayments.length).toBeGreaterThanOrEqual(1)
  })

  test('owner gets 404 for a candidate id that does not exist in the org', async () => {
    const res = await ownerCtx.get('/api/owner/candidates/candidate-999')
    expect(res.status()).toBe(404)
  })

  test('agent Arjun gets 200 for his assigned candidate with the rich sections', async () => {
    const res = await arjunCtx.get('/api/agent/candidates/candidate-001')
    expect(res.status()).toBe(200)
    const d = (await res.json()).data
    expect(d.fullName).toBe('Priya Sharma')
    expect(Array.isArray(d.applications)).toBe(true)
    expect(d.applications.map((a: any) => a.applicationNumber)).toContain('APP-2024-1024')
    expect(Array.isArray(d.supportTickets)).toBe(true)
    expect(d.supportTickets.length).toBeGreaterThanOrEqual(1)
    for (const t of d.supportTickets) {
      expect(t.ticketNumber).toMatch(/^SUP-[A-Z0-9]+$/)
      expect(t.ticketNumber).not.toMatch(/^SUP-\d{4}-\d+$/)
    }
    expect(Array.isArray(d.reminders)).toBe(true)
    expect(JSON.stringify(d)).not.toContain('234567897892')
  })

  test('agent Sneha is denied Arjun\'s candidate (403, same agent-guard shape)', async () => {
    const res = await snehaCtx.get('/api/agent/candidates/candidate-001')
    expect(res.status()).toBe(403)
  })

  test('agent token cannot use the owner candidate API', async () => {
    const res = await arjunCtx.get('/api/owner/candidates/candidate-001')
    expect([401, 403]).toContain(res.status())
  })

  test('candidate role token is rejected by both candidate-detail APIs', async () => {
    const ownerRes = await candidateCtx.get('/api/owner/candidates/candidate-001')
    expect([401, 403]).toContain(ownerRes.status())
    const agentRes = await candidateCtx.get('/api/agent/candidates/candidate-001')
    expect([401, 403]).toContain(agentRes.status())
  })

  test('owner candidates page links to the detail route; detail page renders', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('/login')
    await page.getByLabel('Email or Mobile Number').fill('owner@loanops.in')
    await page.getByLabel('Password').fill(requiredEnv('SEED_OWNER_PASSWORD'))
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('**/admin**')

    // The seeded ticket number is generated per fresh seed — read the
    // actual value from the API instead of hard-coding it.
    const detailRes = await ownerCtx.get('/api/owner/candidates/candidate-001')
    expect(detailRes.status()).toBe(200)
    const ticketNumber = (await detailRes.json()).data.supportTickets[0].ticketNumber
    expect(ticketNumber).toMatch(/^SUP-[A-Z0-9]+$/)

    await page.goto('/admin/candidates')
    const viewLink = page.getByRole('link', { name: /View Priya Sharma details/i })
    await expect(viewLink).toBeVisible()
    await viewLink.click()
    await page.waitForURL('**/admin/candidates/candidate-001')
    await expect(page.getByRole('heading', { name: 'Priya Sharma' })).toBeVisible()
    await page.getByRole('tab', { name: 'Support & Activity' }).click()
    await expect(page.getByText(ticketNumber)).toBeVisible()
    await ctx.close()
  })
})
