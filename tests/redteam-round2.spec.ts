import { test, expect, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// Credentials come from the environment — NO hardcoded password fallbacks.
function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set to run E2E tests (see README > Testing)`)
  return v
}

const OWNER_EMAIL = 'owner@loanops.in'
const OWNER_PASSWORD = requiredEnv('SEED_OWNER_PASSWORD')
const AGENT_EMAIL = 'agent@loanops.in'
const AGENT_PASSWORD = requiredEnv('SEED_AGENT_PASSWORD')

// Seeded facts (CI seed): Karthik is candidate-003, mobile 9820922448.
const KARTHIK_MOBILE = '9820922448'

const ATTACKER_PASSWORD = 'AttackerOwn#555'
const ATTACKER_EMAIL = 'impostor@example.com'

const CONSENTS = [
  { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
  { consentType: 'KFS_DISCLOSURE', granted: true, policyVersion: '2026.1' },
]

function freshMobile(): string {
  return `97${Math.floor(10000000 + Math.random() * 90000000)}`
}

async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
  ip: string
) {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    headers: { Origin: BASE_URL, 'x-forwarded-for': ip },
    data: { email, password },
  })
  expect(res.ok(), `API login failed for ${email}: ${await res.text()}`).toBe(true)
  return res.json()
}

// QR link with pre-configured terms (same shape as apply-hijack.spec.ts).
async function createQrLink(request: APIRequestContext, ip: string): Promise<string> {
  const qrRes = await request.post(`${BASE_URL}/api/owner/qr-links`, {
    headers: { Origin: BASE_URL, 'x-forwarded-for': ip },
    data: {
      prePrincipal: '3000000', // ₹30,000 in paise
      preInterestType: 'PERCENTAGE',
      preInterestRate: 1200, // 12%
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

// Owner candidate search matches on mobile "contains", so a stored
// shadow like 09820922448 would also surface for the canonical query.
async function countCandidatesMatching(request: APIRequestContext, mobile: string) {
  const res = await request.get(
    `${BASE_URL}/api/owner/candidates?search=${mobile}&pageSize=100`
  )
  expect(res.status()).toBe(200)
  const items = (await res.json()).data.items as Array<{ id: string; mobile: string }>
  return items
}

test.describe('Red-team round 2 regressions: canonical mobiles, claim gate, terms ceilings', () => {
  test('shadow spellings of an existing mobile hit the same 409 and create nothing', async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.30.1.1')

    const before = await countCandidatesMatching(request, KARTHIK_MOBILE)
    expect(before).toHaveLength(1)
    expect(before[0].mobile).toBe(KARTHIK_MOBILE)

    // Every spelling that round 2 used to mint a shadow candidate:
    // 0-prefix, 0091 international prefix, Devanagari digits.
    const spellings = ['09820922448', '00919820922448', '९८२०९२२४४८']
    for (const [i, spelling] of spellings.entries()) {
      const token = await createQrLink(request, `10.30.1.${10 + i}`)
      const applyRes = await request.post(`${BASE_URL}/api/apply/${token}`, {
        headers: { Origin: BASE_URL, 'x-forwarded-for': `10.30.2.${10 + i}` },
        data: {
          fullName: 'Karthik Impostor',
          mobile: spelling,
          password: ATTACKER_PASSWORD,
          email: ATTACKER_EMAIL,
          consents: CONSENTS,
        },
      })
      expect(applyRes.status(), `spelling ${spelling}`).toBe(409)
      expect((await applyRes.json()).error.message).toContain('already registered')
    }

    // No shadow records: the contains-search still finds exactly the
    // one real candidate.
    const after = await countCandidatesMatching(request, KARTHIK_MOBILE)
    expect(after).toHaveLength(1)
    expect(after[0].mobile).toBe(KARTHIK_MOBILE)
  })

  test('parallel duplicate applies yield exactly one candidate', async ({ request }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.30.3.1')

    const mobile = freshMobile()
    const tokenA = await createQrLink(request, '10.30.3.2')
    const tokenB = await createQrLink(request, '10.30.3.3')

    // The round-2 R2 race: two no-password applies for one fresh
    // mobile on two links, fired together. The (organizationId,
    // mobile) unique index must serialize them into 201 + 409.
    const apply = (token: string, ip: string) =>
      request.post(`${BASE_URL}/api/apply/${token}`, {
        headers: { Origin: BASE_URL, 'x-forwarded-for': ip },
        data: { fullName: 'Parallel Applicant', mobile, consents: CONSENTS },
      })
    const [resA, resB] = await Promise.all([
      apply(tokenA, '10.30.3.4'),
      apply(tokenB, '10.30.3.5'),
    ])
    const statuses = [resA.status(), resB.status()].sort()
    expect(statuses).toEqual([201, 409])

    const matches = await countCandidatesMatching(request, mobile)
    expect(matches.filter((c) => c.mobile === mobile)).toHaveLength(1)
  })

  test('a PII-rich staff lead cannot be claimed without a claim code', async ({ request }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.30.4.1')

    const leadMobile = freshMobile()
    const createRes = await request.post(`${BASE_URL}/api/owner/candidates`, {
      headers: { Origin: BASE_URL },
      data: {
        fullName: 'Meena Kumari',
        mobile: leadMobile,
        dob: '1990-05-15',
        address: '12 MG Road, Indore',
        employer: 'Acme Pvt Ltd',
        monthlyIncome: 4500000,
        bankName: 'HDFC Bank',
        bankAccount: '50100234567890',
        bankIfsc: 'HDFC0001234',
        upiId: 'meena@okhdfc',
        panMasked: 'ABCDE1234F',
      },
    })
    expect(createRes.status()).toBe(201)

    // Round 2 R4: this lead was claimable with the mobile alone.
    // Now the staff-entered PII is footprint — no code, no claim.
    const signupRes = await request.post(`${BASE_URL}/api/auth/signup`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.30.4.2' },
      data: {
        fullName: 'Meena Kumari',
        mobile: leadMobile,
        password: 'Signup#2026x',
        consents: CONSENTS,
      },
    })
    expect(signupRes.status()).toBe(400)
    expect((await signupRes.json()).error.message).toContain(
      'Unable to complete registration'
    )

    // A wrong code is rejected the same generic way.
    const wrongCodeRes = await request.post(`${BASE_URL}/api/auth/signup`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.30.4.3' },
      data: {
        fullName: 'Meena Kumari',
        mobile: leadMobile,
        password: 'Signup#2026x',
        claimCode: 'ZZZZ9999',
        consents: CONSENTS,
      },
    })
    expect(wrongCodeRes.status()).toBe(400)
  })

  test('an empty-shell lead (name + mobile only) can still claim without a code', async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.30.5.1')

    const shellMobile = freshMobile()
    const createRes = await request.post(`${BASE_URL}/api/owner/candidates`, {
      headers: { Origin: BASE_URL },
      data: { fullName: 'Shell Lead', mobile: shellMobile },
    })
    expect(createRes.status()).toBe(201)

    const signupRes = await request.post(`${BASE_URL}/api/auth/signup`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.30.5.2' },
      data: {
        fullName: 'Shell Lead',
        mobile: shellMobile,
        password: 'Signup#2026x',
        consents: CONSENTS,
      },
    })
    expect(signupRes.status()).toBe(201)
  })

  test('apply with a 10,000% interest rate is a 422, not a created application', async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.30.6.1')
    const token = await createQrLink(request, '10.30.6.2')

    const applyRes = await request.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.30.6.3' },
      data: {
        fullName: 'Terms Probe',
        mobile: freshMobile(),
        principalAmount: '5000000',
        purpose: 'Terms ceiling probe',
        interestType: 'PERCENTAGE',
        interestRate: 1000000, // 10,000% in basis points
        frequency: 'MONTHLY',
        installments: 12,
        consents: CONSENTS,
      },
    })
    expect(applyRes.status()).toBe(422)
  })

  test('an agent QR preset above 100% is a 422 (owner mint too)', async ({ request }) => {
    await apiLogin(request, AGENT_EMAIL, AGENT_PASSWORD, '10.30.7.1')

    const agentRes = await request.post(`${BASE_URL}/api/agent/qr-links`, {
      headers: { Origin: BASE_URL },
      data: { preInterestType: 'PERCENTAGE', preInterestRate: 1000000 },
    })
    expect(agentRes.status()).toBe(422)

    // Positive control: a sane preset still mints.
    const okRes = await request.post(`${BASE_URL}/api/agent/qr-links`, {
      headers: { Origin: BASE_URL },
      data: { preInterestType: 'PERCENTAGE', preInterestRate: 1200 },
    })
    expect(okRes.status()).toBe(201)

    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.30.7.2')
    const ownerRes = await request.post(`${BASE_URL}/api/owner/qr-links`, {
      headers: { Origin: BASE_URL },
      data: { preInterestType: 'PERCENTAGE', preInterestRate: 1000000 },
    })
    expect(ownerRes.status()).toBe(422)
  })

  test('owner candidate create with a duplicate mobile is a 409 naming the existing record', async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.30.8.1')

    const mobile = freshMobile()
    const first = await request.post(`${BASE_URL}/api/owner/candidates`, {
      headers: { Origin: BASE_URL },
      data: { fullName: 'First Record', mobile },
    })
    expect(first.status()).toBe(201)
    const firstId = (await first.json()).data.id

    // Same number, different spelling — canonicalization makes this
    // a collision, and staff are told WHICH record already exists.
    const dup = await request.post(`${BASE_URL}/api/owner/candidates`, {
      headers: { Origin: BASE_URL },
      data: { fullName: 'Second Record', mobile: `0${mobile}` },
    })
    expect(dup.status()).toBe(409)
    const dupJson = await dup.json()
    expect(dupJson.error.details.existingCandidateId).toBe(firstId)
    expect(dupJson.error.details.existingCandidateName).toBe('First Record')
  })
})
