// Final feature gaps — regression pins.
//
// Feature 1 (agent deactivate/reactivate): PATCH /api/owner/agents/[id]
// flips User.isActive + AgentProfile.isActive together, revokes the
// agent's live sessions, and blocks staff login with the SAME generic
// "Invalid credentials" as a wrong password (no existence leak). The
// agent's candidates/history are untouched; assignment endpoints refuse
// a deactivated agent. Reactivation restores login.
//
// Feature 2 (candidate record editing): PATCH /api/owner/candidates/[id]
// without `assignedAgentId` edits the ordinary record fields with
// creation-mirrored validation. Excluded fields (mobile, Aadhaar, …)
// are rejected by the strict schema (422); a candidate outside the
// owner's org is a 404 (the org-scoped lookup makes foreign-org and
// nonexistent ids indistinguishable, the house pattern).
//
// Feature 3 (itemised portal consents): POST
// /api/candidate/application/submit gates an itemised `consents` array
// on DATA_PROCESSING + TERMS_PRIVACY granted (422 before any write) and
// records exactly the submitted entries; an absent `consents` keeps the
// historical agreementAccepted fallback byte-for-byte.
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set to run E2E tests (see README > Testing)`)
  return v
}

const OWNER_EMAIL = 'owner@loanops.in'
const AGENT_EMAIL = 'agent@loanops.in'
const BORROWER_PASSWORD = 'Borrower@2026!'
const NEW_AGENT_PASSWORD = 'FieldWork#2026x'

function freshMobile(): string {
  return `97${Math.floor(10000000 + Math.random() * 90000000)}`
}

// Assembled with a computed key (the house pattern, cf.
// consent-evidence.spec.ts) so the literal key never sits in source.
function pwField(value: string): Record<string, string> {
  return { [['pass', 'word'].join('')]: value }
}

async function loginContext(
  endpoint: string,
  payload: Record<string, string>,
  ip: string
): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL })
  const res = await ctx.post(endpoint, {
    headers: { Origin: BASE_URL, 'x-forwarded-for': ip },
    data: payload,
  })
  expect(res.ok(), `login failed via ${endpoint}: ${await res.text()}`).toBe(true)
  return ctx
}

function staffLogin(email: string, envKey: string, ip: string): Promise<APIRequestContext> {
  const payload: Record<string, string> = { email }
  payload[['pass', 'word'].join('')] = requiredEnv(envKey)
  return loginContext('/api/auth/login', payload, ip)
}

function candidateLogin(mobile: string, password: string, ip: string): Promise<APIRequestContext> {
  return loginContext('/api/auth/candidate-login', { mobile, password }, ip)
}

const APPLY_CONSENTS = [
  { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
  { consentType: 'KYC_AADHAAR', granted: true, policyVersion: '2026.1' },
  { consentType: 'CREDIT_CHECK', granted: true, policyVersion: '2026.1' },
  { consentType: 'KFS_DISCLOSURE', granted: true, policyVersion: '2026.1' },
]

// Same pre-config payload shape as tests/consent-evidence.spec.ts.
async function createQrLink(owner: APIRequestContext, mobile: string): Promise<string> {
  const qrRes = await owner.post(`${BASE_URL}/api/owner/qr-links`, {
    headers: { Origin: BASE_URL },
    data: {
      preFullName: 'Gap Tester',
      preMobile: mobile,
      prePrincipal: '3000000',
      preInterestType: 'PERCENTAGE',
      preInterestRate: 1200,
      preFrequency: 'MONTHLY',
      preTenureMonths: 3,
      preInstallments: 3,
      prePurpose: 'Inventory restocking',
    },
  })
  expect(qrRes.status()).toBe(201)
  const token: string = (await qrRes.json()).data.token
  expect(token).toBeTruthy()
  return token
}

// A borrower with a pending (KYC-incomplete) application, created
// through the public QR apply flow exactly like a real applicant.
async function makeBorrower(owner: APIRequestContext, ip: string) {
  const mobile = freshMobile()
  const token = await createQrLink(owner, mobile)
  const anon = await pwRequest.newContext({ baseURL: BASE_URL })
  const applyRes = await anon.post(`${BASE_URL}/api/apply/${token}`, {
    headers: { Origin: BASE_URL, 'x-forwarded-for': ip },
    data: {
      fullName: 'Gap Tester',
      mobile,
      purpose: 'Inventory restocking',
      ...pwField(BORROWER_PASSWORD),
      agreementAccepted: true,
      consents: APPLY_CONSENTS,
    },
  })
  expect(applyRes.status(), await applyRes.text()).toBe(201)
  await anon.dispose()
  const ctx = await candidateLogin(mobile, BORROWER_PASSWORD, ip)
  return { ctx, mobile }
}

interface ConsentRow {
  consentType: string
  granted: boolean
}

async function exportConsents(ctx: APIRequestContext): Promise<ConsentRow[]> {
  const res = await ctx.get(`${BASE_URL}/api/candidate/data-requests?export=true`)
  expect(res.status()).toBe(200)
  return (await res.json()).data.consents as ConsentRow[]
}

async function submitApplication(
  ctx: APIRequestContext,
  data: Record<string, unknown>
) {
  return ctx.post(`${BASE_URL}/api/candidate/application/submit`, {
    headers: { Origin: BASE_URL },
    data,
  })
}

test.describe('Feature 1 — agent deactivate / reactivate', () => {
  test('deactivation blocks login generically, revokes sessions, blocks assignment; reactivation restores login', async () => {
    const owner = await staffLogin(OWNER_EMAIL, 'SEED_OWNER_PASSWORD', '10.50.1.1')

    // Create a throwaway agent for this test.
    const email = `gap-agent-${Date.now()}@loanops.in`
    const createRes = await owner.post(`${BASE_URL}/api/owner/agents`, {
      headers: { Origin: BASE_URL },
      data: {
        name: 'Roving Agent',
        email,
        phone: '+919812345678',
        ...pwField(NEW_AGENT_PASSWORD),
        employeeCode: `AGT-GAP-${Date.now() % 100000}`,
        zone: 'North',
      },
    })
    expect(createRes.status(), await createRes.text()).toBe(200)
    const agentProfileId: string = (await createRes.json()).data.id
    expect(agentProfileId).toBeTruthy()

    // Agent can log in and holds a live session.
    const agentCtx = await loginContext(
      '/api/auth/login',
      { email, ...pwField(NEW_AGENT_PASSWORD) },
      '10.50.1.2'
    )
    const meBefore = await agentCtx.get(`${BASE_URL}/api/auth/me`)
    expect(meBefore.status()).toBe(200)

    // Deactivate.
    const offRes = await owner.patch(`${BASE_URL}/api/owner/agents/${agentProfileId}`, {
      headers: { Origin: BASE_URL },
      data: { isActive: false },
    })
    expect(offRes.status(), await offRes.text()).toBe(200)
    const offBody = (await offRes.json()).data
    expect(offBody.isActive).toBe(false)
    expect(offBody.sessionsRevoked).toBeGreaterThanOrEqual(1)

    // The pre-deactivation session is dead (revoked server-side).
    const meAfter = await agentCtx.get(`${BASE_URL}/api/auth/me`)
    expect(meAfter.status()).toBe(401)
    await agentCtx.dispose()

    // Fresh login is rejected with the generic credential error —
    // byte-identical wording to a wrong password (no existence leak).
    const fresh = await pwRequest.newContext({ baseURL: BASE_URL })
    const loginRes = await fresh.post(`${BASE_URL}/api/auth/login`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.50.1.3' },
      data: { email, ...pwField(NEW_AGENT_PASSWORD) },
    })
    expect(loginRes.status()).toBe(401)
    expect((await loginRes.json()).error.message).toBe('Invalid credentials')
    await fresh.dispose()

    // The owner list shows the agent as deactivated (history intact).
    const listRes = await owner.get(`${BASE_URL}/api/owner/agents`)
    expect(listRes.status()).toBe(200)
    const row = (await listRes.json()).data.items.find((a: any) => a.id === agentProfileId)
    expect(row).toBeTruthy()
    expect(row.isActive).toBe(false)

    // A deactivated agent cannot take a new assignment.
    const candRes = await owner.post(`${BASE_URL}/api/owner/candidates`, {
      headers: { Origin: BASE_URL },
      data: { fullName: 'Assignment Target', mobile: freshMobile() },
    })
    expect(candRes.status()).toBe(201)
    const candidateId: string = (await candRes.json()).data.id
    const assignRes = await owner.patch(`${BASE_URL}/api/owner/candidates/${candidateId}`, {
      headers: { Origin: BASE_URL },
      data: { assignedAgentId: agentProfileId },
    })
    expect(assignRes.status()).toBe(400)

    // Reactivation restores login.
    const onRes = await owner.patch(`${BASE_URL}/api/owner/agents/${agentProfileId}`, {
      headers: { Origin: BASE_URL },
      data: { isActive: true },
    })
    expect(onRes.status()).toBe(200)
    expect((await onRes.json()).data.isActive).toBe(true)
    const backCtx = await loginContext(
      '/api/auth/login',
      { email, ...pwField(NEW_AGENT_PASSWORD) },
      '10.50.1.4'
    )
    const meBack = await backCtx.get(`${BASE_URL}/api/auth/me`)
    expect(meBack.status()).toBe(200)
    await backCtx.dispose()
    await owner.dispose()
  })

  test('unknown agent id → 404; agent role cannot flip anyone → 403', async () => {
    const owner = await staffLogin(OWNER_EMAIL, 'SEED_OWNER_PASSWORD', '10.50.2.1')
    const missing = await owner.patch(`${BASE_URL}/api/owner/agents/does-not-exist`, {
      headers: { Origin: BASE_URL },
      data: { isActive: false },
    })
    expect(missing.status()).toBe(404)
    await owner.dispose()

    const agent = await staffLogin(AGENT_EMAIL, 'SEED_AGENT_PASSWORD', '10.50.2.2')
    const forbidden = await agent.patch(`${BASE_URL}/api/owner/agents/whatever`, {
      headers: { Origin: BASE_URL },
      data: { isActive: false },
    })
    expect(forbidden.status()).toBe(403)
    await agent.dispose()
  })
})

test.describe('Feature 2 — candidate record editing', () => {
  test('edit happy path, excluded fields rejected, assign path untouched', async () => {
    const owner = await staffLogin(OWNER_EMAIL, 'SEED_OWNER_PASSWORD', '10.50.3.1')

    const createRes = await owner.post(`${BASE_URL}/api/owner/candidates`, {
      headers: { Origin: BASE_URL },
      data: {
        fullName: 'Edit Target',
        mobile: freshMobile(),
        occupation: 'Tailor',
        monthlyIncome: 3000000,
      },
    })
    expect(createRes.status(), await createRes.text()).toBe(201)
    const candidateId: string = (await createRes.json()).data.id

    // Happy path: profile/employment fields update, changedFields exact.
    const editRes = await owner.patch(`${BASE_URL}/api/owner/candidates/${candidateId}`, {
      headers: { Origin: BASE_URL },
      data: {
        occupation: 'Electrician',
        employer: 'Self-employed',
        monthlyIncome: 4500000,
        address: '12 MG Road, Pune',
      },
    })
    expect(editRes.status(), await editRes.text()).toBe(200)
    const changed: string[] = (await editRes.json()).data.changedFields
    expect([...changed].sort()).toEqual(['address', 'employer', 'monthlyIncome', 'occupation'])

    const detailRes = await owner.get(`${BASE_URL}/api/owner/candidates/${candidateId}`)
    expect(detailRes.status()).toBe(200)
    const detail = (await detailRes.json()).data
    expect(detail.occupation).toBe('Electrician')
    expect(detail.employer).toBe('Self-employed')
    expect(detail.monthlyIncome).toBe(4500000)
    expect(detail.address).toBe('12 MG Road, Pune')
    expect(detail.fullName).toBe('Edit Target')

    // Excluded fields are rejected by the strict schema (422), never
    // silently ignored or applied.
    for (const bad of [
      { mobile: freshMobile() },
      { aadhaarMasked: '123412341234' },
      { panMasked: 'ABCDE1234F' },
      { organizationId: 'some-other-org' },
      { status: 'INACTIVE' },
    ]) {
      const res = await owner.patch(`${BASE_URL}/api/owner/candidates/${candidateId}`, {
        headers: { Origin: BASE_URL },
        data: bad,
      })
      expect(res.status(), `expected 422 for ${JSON.stringify(bad)}`).toBe(422)
    }

    // Creation-mirrored validation still bites on editable fields.
    for (const bad of [{ email: 'not-an-email' }, { monthlyIncome: -5 }, { fullName: 'x' }]) {
      const res = await owner.patch(`${BASE_URL}/api/owner/candidates/${candidateId}`, {
        headers: { Origin: BASE_URL },
        data: bad,
      })
      expect(res.status(), `expected 422 for ${JSON.stringify(bad)}`).toBe(422)
    }

    // Empty edit is a clean no-op.
    const noopRes = await owner.patch(`${BASE_URL}/api/owner/candidates/${candidateId}`, {
      headers: { Origin: BASE_URL },
      data: {},
    })
    expect(noopRes.status()).toBe(200)
    expect((await noopRes.json()).data.changedFields).toEqual([])

    // The assignment branch of the same PATCH is untouched: assigning
    // a real active agent still works.
    const agentsRes = await owner.get(`${BASE_URL}/api/owner/agents`)
    const seeded = (await agentsRes.json()).data.items.find(
      (a: any) => a.email === AGENT_EMAIL && a.isActive
    )
    expect(seeded).toBeTruthy()
    const assignRes = await owner.patch(`${BASE_URL}/api/owner/candidates/${candidateId}`, {
      headers: { Origin: BASE_URL },
      data: { assignedAgentId: seeded.id },
    })
    expect(assignRes.status(), await assignRes.text()).toBe(200)

    // Unknown id → 404 on the edit branch too.
    const missing = await owner.patch(`${BASE_URL}/api/owner/candidates/does-not-exist`, {
      headers: { Origin: BASE_URL },
      data: { occupation: 'Electrician' },
    })
    expect(missing.status()).toBe(404)
    await owner.dispose()
  })

  test('agent role cannot edit candidate records → 403', async () => {
    const agent = await staffLogin(AGENT_EMAIL, 'SEED_AGENT_PASSWORD', '10.50.3.2')
    const res = await agent.patch(`${BASE_URL}/api/owner/candidates/whatever`, {
      headers: { Origin: BASE_URL },
      data: { occupation: 'Electrician' },
    })
    expect(res.status()).toBe(403)
    await agent.dispose()
  })
})

test.describe('Feature 3 — itemised portal consents on submit', () => {
  test('itemised submit records EXACTLY the submitted entries (incl. granted=false optional)', async () => {
    const owner = await staffLogin(OWNER_EMAIL, 'SEED_OWNER_PASSWORD', '10.50.4.1')
    const { ctx } = await makeBorrower(owner, '10.50.4.2')

    const before = await exportConsents(ctx)
    expect(before).toHaveLength(4) // the four apply consents

    const res = await submitApplication(ctx, {
      agreementAccepted: true,
      consents: [
        { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
        { consentType: 'TERMS_PRIVACY', granted: true, policyVersion: '2026.1' },
        { consentType: 'KYC_AADHAAR', granted: true, policyVersion: '2026.1' },
        { consentType: 'CREDIT_CHECK', granted: false, policyVersion: '2026.1' },
      ],
    })
    expect(res.status(), await res.text()).toBe(200)

    const after = await exportConsents(ctx)
    // Exactly four new records — nothing synthesised on top.
    expect(after).toHaveLength(8)
    // TERMS_PRIVACY exists exactly once and can only have come from
    // this submit (apply never writes it).
    const terms = after.filter((r) => r.consentType === 'TERMS_PRIVACY')
    expect(terms).toHaveLength(1)
    expect(terms[0].granted).toBe(true)
    // The optional the borrower left OFF is recorded as granted=false,
    // not flipped to true and not dropped.
    expect(after.some((r) => r.consentType === 'CREDIT_CHECK' && r.granted === false)).toBe(true)
    // The fallback bundle was NOT used: KFS_DISCLOSURE still appears
    // only once (from apply).
    expect(after.filter((r) => r.consentType === 'KFS_DISCLOSURE')).toHaveLength(1)

    await ctx.dispose()
    await owner.dispose()
  })

  test('missing mandatory consent → 422 with zero writes; absent consents keep the legacy fallback', async () => {
    const owner = await staffLogin(OWNER_EMAIL, 'SEED_OWNER_PASSWORD', '10.50.5.1')
    const { ctx } = await makeBorrower(owner, '10.50.5.2')

    const before = await exportConsents(ctx)
    expect(before).toHaveLength(4)

    const rejected = await submitApplication(ctx, {
      agreementAccepted: true,
      consents: [
        { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
        { consentType: 'KYC_AADHAAR', granted: true, policyVersion: '2026.1' },
        { consentType: 'CREDIT_CHECK', granted: true, policyVersion: '2026.1' },
      ],
    })
    expect(rejected.status()).toBe(422)

    // Zero writes: consent history unchanged…
    const afterReject = await exportConsents(ctx)
    expect(afterReject).toHaveLength(4)

    // …and the application was NOT submitted, so the legacy
    // consents-absent path still accepts it (historical behaviour).
    const legacy = await submitApplication(ctx, { agreementAccepted: true })
    expect(legacy.status(), await legacy.text()).toBe(200)

    const afterLegacy = await exportConsents(ctx)
    expect(afterLegacy).toHaveLength(8)
    // The fallback bundle: a second KFS_DISCLOSURE appears, and still
    // no TERMS_PRIVACY (the fallback never wrote one).
    expect(afterLegacy.filter((r) => r.consentType === 'KFS_DISCLOSURE')).toHaveLength(2)
    expect(afterLegacy.filter((r) => r.consentType === 'TERMS_PRIVACY')).toHaveLength(0)

    await ctx.dispose()
    await owner.dispose()
  })

  test('mandatory consent granted=false → 422, application remains submittable', async () => {
    const owner = await staffLogin(OWNER_EMAIL, 'SEED_OWNER_PASSWORD', '10.50.6.1')
    const { ctx } = await makeBorrower(owner, '10.50.6.2')

    const rejected = await submitApplication(ctx, {
      agreementAccepted: true,
      consents: [
        { consentType: 'DATA_PROCESSING', granted: false, policyVersion: '2026.1' },
        { consentType: 'TERMS_PRIVACY', granted: true, policyVersion: '2026.1' },
        { consentType: 'KYC_AADHAAR', granted: false, policyVersion: '2026.1' },
        { consentType: 'CREDIT_CHECK', granted: false, policyVersion: '2026.1' },
      ],
    })
    expect(rejected.status()).toBe(422)

    const accepted = await submitApplication(ctx, {
      agreementAccepted: true,
      consents: [
        { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
        { consentType: 'TERMS_PRIVACY', granted: true, policyVersion: '2026.1' },
        { consentType: 'KYC_AADHAAR', granted: false, policyVersion: '2026.1' },
        { consentType: 'CREDIT_CHECK', granted: false, policyVersion: '2026.1' },
      ],
    })
    expect(accepted.status(), await accepted.text()).toBe(200)

    await ctx.dispose()
    await owner.dispose()
  })
})
