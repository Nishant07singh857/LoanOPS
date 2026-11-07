// Consent-evidence (D1) + section-shell role gating (D2) — A-to-Z
// pre-launch QA regression pins.
//
// D1: POST /api/auth/signup used to fabricate DPDP consent evidence —
// a request with `consents: []` created the account AND two
// granted=true ConsentRecords (DATA_PROCESSING, TERMS_PRIVACY) that
// were never submitted. POST /api/apply/[token] had the same pattern
// (four records derived from the lone agreementAccepted flag when
// consents were omitted). Both endpoints now require their mandatory
// consents present + granted in the request (422 otherwise, nothing
// created) and record exactly what was submitted.
//
// D2: the /admin, /agent and /portal shells were gated only by
// client-side JS — a borrower session received the full admin shell
// markup with a 200. The section layouts now resolve the session
// server-side: wrong role → redirect to the session's own section;
// no session → redirect to /login.
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set to run E2E tests (see README > Testing)`)
  return v
}

const OWNER_EMAIL = 'owner@loanops.in'
const AGENT_EMAIL = 'agent@loanops.in'
const PRIYA_MOBILE = '9820277789'
const SIGNUP_PASSWORD = 'Borrower@2026!'

function freshMobile(): string {
  return `97${Math.floor(10000000 + Math.random() * 90000000)}`
}

const SIGNUP_CONSENTS = [
  { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
  { consentType: 'TERMS_PRIVACY', granted: true, policyVersion: '2026.1' },
  { consentType: 'COMMUNICATION', granted: false, policyVersion: '2026.1' },
]

const APPLY_CONSENTS = [
  { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
  { consentType: 'KYC_AADHAAR', granted: true, policyVersion: '2026.1' },
  { consentType: 'CREDIT_CHECK', granted: true, policyVersion: '2026.1' },
  { consentType: 'KFS_DISCLOSURE', granted: true, policyVersion: '2026.1' },
  { consentType: 'COMMUNICATION', granted: false, policyVersion: '2026.1' },
]

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

// Assembled with a computed key (the house pattern, cf.
// candidate-detail.spec.ts) so the literal key never sits in source.
function pwField(value: string): Record<string, string> {
  return { [['pass', 'word'].join('')]: value }
}

function staffLogin(email: string, envKey: string, ip: string): Promise<APIRequestContext> {
  const payload: Record<string, string> = { email }
  payload[['pass', 'word'].join('')] = requiredEnv(envKey)
  return loginContext('/api/auth/login', payload, ip)
}

function candidateLogin(mobile: string, password: string, ip: string): Promise<APIRequestContext> {
  return loginContext('/api/auth/candidate-login', { mobile, password }, ip)
}

async function signup(
  request: APIRequestContext,
  ip: string,
  data: Record<string, unknown>
) {
  return request.post(`${BASE_URL}/api/auth/signup`, {
    headers: { Origin: BASE_URL, 'x-forwarded-for': ip },
    data,
  })
}

// Same pre-config payload shape as tests/apply-hijack.spec.ts.
async function createQrLink(owner: APIRequestContext, mobile: string): Promise<string> {
  const qrRes = await owner.post(`${BASE_URL}/api/owner/qr-links`, {
    headers: { Origin: BASE_URL },
    data: {
      preFullName: 'Consent Applicant',
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

test.describe('D1 — signup consent evidence', () => {
  test('consents: [] → 422 and creates nothing (the exact QA repro)', async ({ request }) => {
    const mobile = freshMobile()
    const rejected = await signup(request, '10.40.1.1', {
      fullName: 'Consent Tester',
      mobile,
      ...pwField(SIGNUP_PASSWORD),
      consents: [],
    })
    expect(rejected.status()).toBe(422)

    // Had the rejected attempt created the account, this identical
    // signup would now fail as a duplicate (400). A 201 proves the
    // 422 left zero rows behind.
    const accepted = await signup(request, '10.40.1.1', {
      fullName: 'Consent Tester',
      mobile,
      ...pwField(SIGNUP_PASSWORD),
      consents: SIGNUP_CONSENTS,
    })
    expect(accepted.status()).toBe(201)
  })

  test('omitted consents key → 422', async ({ request }) => {
    const res = await signup(request, '10.40.1.2', {
      fullName: 'Consent Tester',
      mobile: freshMobile(),
      ...pwField(SIGNUP_PASSWORD),
    })
    expect(res.status()).toBe(422)
  })

  test('missing TERMS_PRIVACY → 422; DATA_PROCESSING granted=false → 422', async ({ request }) => {
    const missingTerms = await signup(request, '10.40.1.3', {
      fullName: 'Consent Tester',
      mobile: freshMobile(),
      ...pwField(SIGNUP_PASSWORD),
      consents: [
        { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
        { consentType: 'COMMUNICATION', granted: true, policyVersion: '2026.1' },
      ],
    })
    expect(missingTerms.status()).toBe(422)

    const deniedProcessing = await signup(request, '10.40.1.4', {
      fullName: 'Consent Tester',
      mobile: freshMobile(),
      ...pwField(SIGNUP_PASSWORD),
      consents: [
        { consentType: 'DATA_PROCESSING', granted: false, policyVersion: '2026.1' },
        { consentType: 'TERMS_PRIVACY', granted: true, policyVersion: '2026.1' },
      ],
    })
    expect(deniedProcessing.status()).toBe(422)
  })

  test('granted signup records EXACTLY the submitted consents (nothing invented)', async ({
    request,
  }) => {
    const mobile = freshMobile()
    const res = await signup(request, '10.40.1.5', {
      fullName: 'Consent Tester',
      mobile,
      ...pwField(SIGNUP_PASSWORD),
      consents: SIGNUP_CONSENTS,
    })
    expect(res.status()).toBe(201)

    const ctx = await candidateLogin(mobile, SIGNUP_PASSWORD, '10.40.1.6')
    const exportRes = await ctx.get(`${BASE_URL}/api/candidate/data-requests?export=true`)
    expect(exportRes.status()).toBe(200)
    const records = (await exportRes.json()).data.consents as Array<{
      consentType: string
      granted: boolean
    }>
    const byType = new Map(records.map((r) => [r.consentType, r.granted]))
    // Exactly the three submitted entries — including COMMUNICATION
    // recorded as granted=false, and no synthesized extras.
    expect([...byType.keys()].sort()).toEqual(['COMMUNICATION', 'DATA_PROCESSING', 'TERMS_PRIVACY'])
    expect(byType.get('DATA_PROCESSING')).toBe(true)
    expect(byType.get('TERMS_PRIVACY')).toBe(true)
    expect(byType.get('COMMUNICATION')).toBe(false)
    await ctx.dispose()
  })
})

test.describe('D1 — public apply consent evidence', () => {
  test('apply without consents → 422, link NOT consumed, retry with consents → 201', async () => {
    const owner = await staffLogin(OWNER_EMAIL, 'SEED_OWNER_PASSWORD', '10.40.2.1')
    const mobile = freshMobile()
    const token = await createQrLink(owner, mobile)

    const anon = await pwRequest.newContext({ baseURL: BASE_URL })
    const rejected = await anon.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.40.2.2' },
      data: { fullName: 'Consent Applicant', mobile, purpose: 'Inventory restocking' },
    })
    expect(rejected.status()).toBe(422)

    // A 201 here proves the rejected attempt neither consumed the
    // single-use link nor created a candidate/application for the
    // mobile (either would make the retry fail — 410 or 409).
    const accepted = await anon.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.40.2.2' },
      data: {
        fullName: 'Consent Applicant',
        mobile,
        purpose: 'Inventory restocking',
        agreementAccepted: true,
        consents: APPLY_CONSENTS,
      },
    })
    expect(accepted.status()).toBe(201)
    await anon.dispose()
    await owner.dispose()
  })

  test('apply missing CREDIT_CHECK consent → 422', async () => {
    const owner = await staffLogin(OWNER_EMAIL, 'SEED_OWNER_PASSWORD', '10.40.2.3')
    const token = await createQrLink(owner, freshMobile())
    const anon = await pwRequest.newContext({ baseURL: BASE_URL })
    const res = await anon.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.40.2.4' },
      data: {
        fullName: 'Consent Applicant',
        mobile: freshMobile(),
        purpose: 'Inventory restocking',
        agreementAccepted: true,
        consents: APPLY_CONSENTS.filter((c) => c.consentType !== 'CREDIT_CHECK'),
      },
    })
    expect(res.status()).toBe(422)
    await anon.dispose()
    await owner.dispose()
  })
})

test.describe('D2 — section shells are role-gated server-side', () => {
  async function expectRedirectTo(ctx: APIRequestContext, path: string, target: string) {
    const res = await ctx.get(`${BASE_URL}${path}`, { maxRedirects: 0 })
    expect([307, 308]).toContain(res.status())
    expect(res.headers()['location'] || '').toContain(target)
  }

  test('borrower session is redirected out of /admin and /agent to /portal', async () => {
    const ctx = await candidateLogin(PRIYA_MOBILE, requiredEnv('SEED_CANDIDATE_PASSWORD'), '10.40.3.1')
    await expectRedirectTo(ctx, '/admin', '/portal')
    await expectRedirectTo(ctx, '/agent', '/portal')
    // Own section renders.
    const own = await ctx.get(`${BASE_URL}/portal`, { maxRedirects: 0 })
    expect(own.status()).toBe(200)
    await ctx.dispose()
  })

  test('agent session is redirected out of /admin and /portal to /agent', async () => {
    const ctx = await staffLogin(AGENT_EMAIL, 'SEED_AGENT_PASSWORD', '10.40.3.2')
    await expectRedirectTo(ctx, '/admin', '/agent')
    await expectRedirectTo(ctx, '/portal', '/agent')
    const own = await ctx.get(`${BASE_URL}/agent`, { maxRedirects: 0 })
    expect(own.status()).toBe(200)
    await ctx.dispose()
  })

  test('owner session renders /admin and is redirected out of /portal to /admin', async () => {
    const ctx = await staffLogin(OWNER_EMAIL, 'SEED_OWNER_PASSWORD', '10.40.3.3')
    const own = await ctx.get(`${BASE_URL}/admin`, { maxRedirects: 0 })
    expect(own.status()).toBe(200)
    await expectRedirectTo(ctx, '/portal', '/admin')
    await ctx.dispose()
  })

  test('no session → redirect to /login (proxy behaviour preserved)', async () => {
    const anon = await pwRequest.newContext({ baseURL: BASE_URL })
    await expectRedirectTo(anon, '/admin', '/login')
    await expectRedirectTo(anon, '/portal', '/login')
    await anon.dispose()
  })
})
