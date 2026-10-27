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

// Seeded facts (CI seed): Karthik is candidate-003 and UNCLAIMED
// (userId null); Priya is candidate-001 and CLAIMED (has a login).
const KARTHIK_ID = 'candidate-003'
const KARTHIK_MOBILE = '9820922448'
const PRIYA_ID = 'candidate-001'
const PRIYA_MOBILE = '9820277789'

const ATTACKER_PASSWORD = 'AttackerOwn#555'
// NOTE: the attacker's email local part must NOT appear inside the
// password — the apply route validates the password policy (which
// rejects passwords containing the email username) before it reaches
// the duplicate-mobile check, so e.g. 'attacker@…' would 400 instead
// of exercising the 409 path under test.
const ATTACKER_EMAIL = 'impostor@example.com'

const CONSENTS = [
  { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
  { consentType: 'KFS_DISCLOSURE', granted: true, policyVersion: '2026.1' },
]

async function apiLogin(
  request: APIRequestContext,
  emailOrMobile: string,
  password: string,
  ip = '127.0.0.1'
) {
  const isEmail = emailOrMobile.includes('@')
  const endpoint = isEmail ? '/api/auth/login' : '/api/auth/candidate-login'
  const payload = isEmail
    ? { email: emailOrMobile, password }
    : { mobile: emailOrMobile, password }

  const res = await request.post(`${BASE_URL}${endpoint}`, {
    headers: {
      Origin: BASE_URL,
      'x-forwarded-for': ip,
    },
    data: payload,
  })
  expect(res.ok(), `API login failed for ${emailOrMobile}: ${await res.text()}`).toBe(true)
  return res.json()
}

// Same pre-config payload shape as e2e-full STEP 2A.
async function createQrLink(
  request: APIRequestContext,
  preFullName: string,
  preMobile: string
): Promise<string> {
  const qrRes = await request.post(`${BASE_URL}/api/owner/qr-links`, {
    headers: { Origin: BASE_URL },
    data: {
      preFullName,
      preMobile,
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
  const qrJson = await qrRes.json()
  const token: string = qrJson.data.token
  expect(token).toBeTruthy()
  return token
}

async function countApplicationsForCandidate(
  request: APIRequestContext,
  mobile: string,
  candidateId: string
): Promise<number> {
  const res = await request.get(
    `${BASE_URL}/api/owner/applications?search=${mobile}&pageSize=100`
  )
  expect(res.status()).toBe(200)
  const items = (await res.json()).data.items as Array<{ candidateId: string }>
  return items.filter((a) => a.candidateId === candidateId).length
}

test.describe('Public apply link cannot hijack an existing candidate (red-team E3 regression)', () => {
  test("apply with an existing unclaimed candidate's mobile is rejected and creates no login", async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.20.1.1')

    const token = await createQrLink(request, 'Karthik Iyer', KARTHIK_MOBILE)

    // Attacker submits the public link with the victim's mobile and
    // their OWN password — previously this created a login for the
    // unclaimed victim profile (full account takeover).
    const applyRes = await request.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL },
      data: {
        fullName: 'Karthik Impostor',
        mobile: KARTHIK_MOBILE,
        password: ATTACKER_PASSWORD,
        email: ATTACKER_EMAIL,
        consents: CONSENTS,
      },
    })
    expect(applyRes.status()).toBe(409)
    const applyJson = await applyRes.json()
    expect(applyJson.error.message).toContain('already registered')

    // No login was created: the attacker's password must not log in
    // as the victim. (Manual POST — apiLogin asserts success.)
    // Distinct x-forwarded-for: the login limiter is per IP+account.
    const loginRes = await request.post(`${BASE_URL}/api/auth/candidate-login`, {
      headers: {
        Origin: BASE_URL,
        'x-forwarded-for': '10.20.1.99',
      },
      data: { mobile: KARTHIK_MOBILE, password: ATTACKER_PASSWORD },
    })
    expect(loginRes.status()).toBe(401)

    // The victim profile is untouched. NOTE: GET
    // /api/owner/candidates/[id] does not expose userId / claimed
    // state, so assert on it only if present; the 401 above is the
    // proof that no login exists.
    const candRes = await request.get(`${BASE_URL}/api/owner/candidates/${KARTHIK_ID}`)
    expect(candRes.status()).toBe(200)
    const candidate = (await candRes.json()).data
    if ('userId' in candidate) {
      expect(candidate.userId).toBeNull()
    }
    expect(candidate.fullName).toBe('Karthik Iyer')
  })

  test("apply with a claimed candidate's mobile is rejected and adds no application", async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.20.2.1')

    const baseline = await countApplicationsForCandidate(request, PRIYA_MOBILE, PRIYA_ID)

    const token = await createQrLink(request, 'Priya Sharma', PRIYA_MOBILE)

    // Previously this silently attached a new application with
    // attacker-chosen terms to the claimed victim's profile.
    const applyRes = await request.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL },
      data: {
        fullName: 'Priya Impostor',
        mobile: PRIYA_MOBILE,
        password: ATTACKER_PASSWORD,
        email: ATTACKER_EMAIL,
        consents: CONSENTS,
      },
    })
    expect(applyRes.status()).toBe(409)
    const applyJson = await applyRes.json()
    expect(applyJson.error.message).toContain('already registered')

    const after = await countApplicationsForCandidate(request, PRIYA_MOBILE, PRIYA_ID)
    expect(after).toBe(baseline)
  })

  test('positive control: apply with a brand-new mobile still succeeds', async ({ request }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.20.3.1')

    const freshMobile = `96${Math.floor(10000000 + Math.random() * 90000000)}`
    const token = await createQrLink(request, 'Vikram Desai', freshMobile)

    const applyRes = await request.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL },
      data: {
        fullName: 'Vikram Desai',
        mobile: freshMobile,
        password: 'Vikram@2026!',
        consents: CONSENTS,
      },
    })
    expect(applyRes.status()).toBe(201)
    const applyJson = await applyRes.json()
    expect(applyJson.data.applicationId).toBeTruthy()
    expect(applyJson.data.candidateId).toBeTruthy()
  })
})
