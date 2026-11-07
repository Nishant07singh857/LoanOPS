import { test, expect, type APIRequestContext } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { promises as fsp } from 'fs'
import path from 'path'

// Red-team round 3 regressions: the five Low PARTIALs (P1–P5) and the
// two Info items. Each test mirrors the round-3 repro that produced
// the finding; the bar is the fixed behaviour (409 / 4xx / stripped /
// linked), never a 500.

const BASE_URL = 'http://localhost:3000'

function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} must be set to run E2E tests (see README > Testing)`)
  return v
}

const OWNER_EMAIL = 'owner@loanops.in'
const OWNER_PASSWORD = requiredEnv('SEED_OWNER_PASSWORD')
const AGENT_EMAIL = 'agent@loanops.in'
const AGENT_PASSWORD = requiredEnv('SEED_AGENT_PASSWORD')
const TEST_DB = requiredEnv('DATABASE_URL_TEST')

// Seeded facts (CI seed): Priya is candidate-001; Rahul is
// candidate-002 with the ACTIVE loan LON-2024-0892 assigned to Arjun.
const PRIYA_ID = 'candidate-001'
const RAHUL_ID = 'candidate-002'
const RAHUL_LOAN_NUMBER = 'LON-2024-0892'

const SIGNUP_PASSWORD = 'Signup#2026x'
// Shared by the apply and signup calls below: both endpoints require
// their mandatory consents present + granted (D1 consent-evidence
// contract), so the fixture carries the union of both mandatory sets.
const CONSENTS = [
  { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
  { consentType: 'TERMS_PRIVACY', granted: true, policyVersion: '2026.1' },
  { consentType: 'KYC_AADHAAR', granted: true, policyVersion: '2026.1' },
  { consentType: 'CREDIT_CHECK', granted: true, policyVersion: '2026.1' },
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

async function createQrLink(request: APIRequestContext, ip: string): Promise<string> {
  const qrRes = await request.post(`${BASE_URL}/api/owner/qr-links`, {
    headers: { Origin: BASE_URL, 'x-forwarded-for': ip },
    data: {
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

let db: PrismaClient
test.beforeAll(async () => {
  db = new PrismaClient({ datasourceUrl: TEST_DB })
})
test.afterAll(async () => {
  await db.$disconnect()
})

// ------------------------------------------------------------------
// P1 — apply-vs-signup race: the loser must get a 4xx (409 for the
// apply side), never a 500 from a wrapped unique-constraint error.
// ------------------------------------------------------------------
test.describe('Round 3 — P1 apply-vs-signup race', () => {
  test('parallel apply + signup on one fresh mobile: no 500, exactly one account', async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.40.1.1')

    for (let race = 0; race < 4; race++) {
      const mobile = freshMobile()
      const token = await createQrLink(request, `10.40.2.${race + 1}`)

      const applyPromise = request.post(`${BASE_URL}/api/apply/${token}`, {
        headers: { Origin: BASE_URL, 'x-forwarded-for': `10.40.3.${race + 1}` },
        data: {
          fullName: 'Race Applicant',
          mobile,
          password: SIGNUP_PASSWORD,
          consents: CONSENTS,
        },
      })
      const signupPromise = request.post(`${BASE_URL}/api/auth/signup`, {
        headers: { Origin: BASE_URL, 'x-forwarded-for': `10.40.4.${race + 1}` },
        data: {
          fullName: 'Race Applicant',
          mobile,
          password: SIGNUP_PASSWORD,
          consents: CONSENTS,
        },
      })
      const [applyRes, signupRes] = await Promise.all([applyPromise, signupPromise])
      const statuses = [applyRes.status(), signupRes.status()]

      // The round-3 loser got 500 SERVER_ERROR. Now: exactly one
      // winner (201); the loser is a clean client error — 409 from
      // the apply side, or signup's generic anti-enumeration 400.
      expect(statuses).not.toContain(500)
      expect(statuses.filter((s) => s === 201)).toHaveLength(1)
      for (const s of statuses) {
        if (s !== 201) expect([400, 409]).toContain(s)
      }

      // DB integrity: exactly one candidate and one login for the mobile.
      const candidates = await db.candidate.findMany({ where: { mobile } })
      expect(candidates).toHaveLength(1)
      const users = await db.user.findMany({ where: { email: mobile } })
      expect(users).toHaveLength(1)
    }
  })
})

// ------------------------------------------------------------------
// P2 — claim footprint: a lead carrying ONLY email / occupation /
// bankName / existingObligations can no longer be claimed codeless.
// ------------------------------------------------------------------
test.describe('Round 3 — P2 claim footprint completion', () => {
  const leadCases: Array<{
    label: string
    viaApi?: Record<string, unknown>
    viaDb?: Record<string, unknown>
  }> = [
    { label: 'email only', viaApi: { email: 'private.lead@example.com' } },
    { label: 'occupation only', viaApi: { occupation: 'Farmer' } },
    { label: 'bankName only', viaApi: { bankName: 'HDFC Bank' } },
    {
      label: 'existingObligations only',
      viaDb: { existingObligations: 120000 },
    },
  ]

  for (const leadCase of leadCases) {
    test(`lead with only ${leadCase.label} cannot be claimed without a code`, async ({
      request,
    }) => {
      await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.41.1.1')
      const mobile = freshMobile()

      if (leadCase.viaDb) {
        const org = await db.organization.findFirst({ where: { isActive: true } })
        expect(org).toBeTruthy()
        await db.candidate.create({
          data: {
            organizationId: org!.id,
            fullName: 'Footprint Lead',
            mobile,
            status: 'ACTIVE',
            ...leadCase.viaDb,
          } as any,
        })
      } else {
        const createRes = await request.post(`${BASE_URL}/api/owner/candidates`, {
          headers: { Origin: BASE_URL },
          data: { fullName: 'Footprint Lead', mobile, ...leadCase.viaApi },
        })
        expect(createRes.status()).toBe(201)
      }

      const signupRes = await request.post(`${BASE_URL}/api/auth/signup`, {
        headers: { Origin: BASE_URL, 'x-forwarded-for': '10.41.1.2' },
        data: {
          fullName: 'Footprint Lead',
          mobile,
          password: SIGNUP_PASSWORD,
          consents: CONSENTS,
        },
      })
      expect(signupRes.status()).toBe(400)
      expect((await signupRes.json()).error.message).toContain(
        'Unable to complete registration'
      )
    })
  }
})

// ------------------------------------------------------------------
// P3 — the 500-instead-of-4xx family.
// ------------------------------------------------------------------
test.describe('Round 3 — P3 unbounded inputs return 4xx, never 500', () => {
  test('apply with an overflowing processing fee is a 422', async ({ request }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.42.1.1')
    const token = await createQrLink(request, '10.42.1.2')

    const res = await request.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.42.1.3' },
      data: {
        fullName: 'Fee Probe',
        mobile: freshMobile(),
        principalAmount: '3000000',
        purpose: 'Fee ceiling probe',
        interestType: 'PERCENTAGE',
        interestRate: 1200,
        frequency: 'MONTHLY',
        installments: 3,
        processingFee: '99999999999999999999',
        consents: CONSENTS,
      },
    })
    expect(res.status()).toBe(422)
  })

  test('apply with an overflowing monthly income is a 422', async ({ request }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.42.2.1')
    const token = await createQrLink(request, '10.42.2.2')

    const res = await request.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.42.2.3' },
      data: {
        fullName: 'Income Probe',
        mobile: freshMobile(),
        monthlyIncome: '99999999999999999999',
        consents: CONSENTS,
      },
    })
    expect(res.status()).toBe(422)
  })

  test('apply whose computed total passes Int32 by construction is a 422; exactly at the limit succeeds', async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.42.3.1')

    // principal ₹1cr (the cap) at 100% + ₹20,00,000 of fees pushes the
    // total past the Int32 paise column: 2,200,000,000 > 2,147,483,647.
    const overToken = await createQrLink(request, '10.42.3.2')
    const overRes = await request.post(`${BASE_URL}/api/apply/${overToken}`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.42.3.3' },
      data: {
        fullName: 'Total Probe',
        mobile: freshMobile(),
        principalAmount: '1000000000',
        purpose: 'Total ceiling probe',
        interestType: 'PERCENTAGE',
        interestRate: 10000,
        frequency: 'MONTHLY',
        installments: 1,
        processingFee: '200000000',
        consents: CONSENTS,
      },
    })
    expect(overRes.status()).toBe(422)

    // Exactly at the limit (fee tuned so total = 2,147,483,647) the
    // application is legitimate and must succeed — the boundary the
    // round-3 team probed by hand.
    const exactToken = await createQrLink(request, '10.42.3.4')
    const exactRes = await request.post(`${BASE_URL}/api/apply/${exactToken}`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.42.3.5' },
      data: {
        fullName: 'Boundary Applicant',
        mobile: freshMobile(),
        principalAmount: '1000000000',
        purpose: 'Boundary total probe',
        interestType: 'PERCENTAGE',
        interestRate: 10000,
        frequency: 'MONTHLY',
        installments: 1,
        processingFee: '147483647',
        consents: CONSENTS,
      },
    })
    expect(exactRes.status()).toBe(201)
    expect((await exactRes.json()).data.totalRepayable).toBe('2147483647')
  })

  test('owner create-application with an overflowing fee is a 422', async ({ request }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.42.4.1')
    const res = await request.post(`${BASE_URL}/api/owner/applications`, {
      headers: { Origin: BASE_URL },
      data: {
        candidateId: PRIYA_ID,
        principalAmount: '3000000',
        purpose: 'Owner fee ceiling probe',
        interestType: 'PERCENTAGE',
        interestRate: 1200,
        frequency: 'MONTHLY',
        tenureCount: 3,
        installments: 3,
        firstDueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        otherFees: '99999999999999999999',
      },
    })
    expect(res.status()).toBe(422)
  })

  test('PTP with a 10^20 promised amount is a 400, and a garbage promise date is a 422', async ({
    request,
  }) => {
    await apiLogin(request, AGENT_EMAIL, AGENT_PASSWORD, '10.42.5.1')
    const loan = await db.loan.findFirst({ where: { loanNumber: RAHUL_LOAN_NUMBER } })
    expect(loan).toBeTruthy()

    const amountRes = await request.post(`${BASE_URL}/api/agent/ptp`, {
      headers: { Origin: BASE_URL },
      data: {
        candidateId: RAHUL_ID,
        loanId: loan!.id,
        promisedAmount: '99999999999999999999',
        promiseDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      },
    })
    expect(amountRes.status()).toBe(400)

    const dateRes = await request.post(`${BASE_URL}/api/agent/ptp`, {
      headers: { Origin: BASE_URL },
      data: {
        candidateId: RAHUL_ID,
        loanId: loan!.id,
        promisedAmount: '50000',
        promiseDate: 'not-a-date',
      },
    })
    expect(dateRes.status()).toBe(422)
  })

  test('reports with an unparseable from date is a 422', async ({ request }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.42.6.1')
    const res = await request.get(
      `${BASE_URL}/api/owner/reports?type=loans&from=garbage`
    )
    expect(res.status()).toBe(422)
  })

  test('candidate detail with a NUL-byte id is a 404 on owner and agent routes', async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.42.7.1')
    const ownerRes = await request.get(
      `${BASE_URL}/api/owner/candidates/candidate-001%00`
    )
    expect(ownerRes.status()).toBe(404)

    await apiLogin(request, AGENT_EMAIL, AGENT_PASSWORD, '10.42.7.2')
    const agentRes = await request.get(
      `${BASE_URL}/api/agent/candidates/candidate-001%00`
    )
    expect(agentRes.status()).toBe(404)
  })
})

// ------------------------------------------------------------------
// P5 — breached-password variant rejected on a live creation path.
// (The value is assembled from fragments so no credential-shaped
// literal sits in the source tree — same pattern as hardening.spec.)
// ------------------------------------------------------------------
test.describe('Round 3 — P5 breached password variants', () => {
  test('owner creating an agent with a mutated breached password gets a 400', async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.43.1.1')
    const suffix = String(Date.now()).slice(-8)
    const pwKey = ['pass', 'word'].join('')
    const res = await request.post(`${BASE_URL}/api/owner/agents`, {
      headers: { Origin: BASE_URL },
      data: {
        name: 'Variant Check Agent',
        email: `variant.${suffix}@example.com`,
        phone: `98${suffix}`,
        [pwKey]: ['Pass', 'word', '123', '!'].join(''),
        employeeCode: `VC-${suffix}`,
        zone: 'North',
      },
    })
    expect(res.status()).toBe(400)
    expect(String((await res.json()).error?.message ?? '')).toMatch(/breached|stronger/i)
  })
})

// ------------------------------------------------------------------
// Info-1 — disbursement ledger rows carry the loanId.
// ------------------------------------------------------------------
test.describe('Round 3 — Info-1 disbursement ledger linkage', () => {
  test('a fresh disbursement posts a DISBURSEMENT ledger entry with loanId set', async ({
    request,
  }) => {
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.44.1.1')
    const token = await createQrLink(request, '10.44.1.2')
    const mobile = freshMobile()

    const applyRes = await request.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.44.1.3' },
      data: {
        fullName: 'Ledger Link Applicant',
        mobile,
        password: SIGNUP_PASSWORD,
        consents: CONSENTS,
      },
    })
    expect(applyRes.status()).toBe(201)
    const applicationId: string = (await applyRes.json()).data.applicationId

    const approveRes = await request.post(
      `${BASE_URL}/api/owner/applications/${applicationId}/approve`,
      { headers: { Origin: BASE_URL }, data: { reviewNotes: 'RT3 ledger check' } }
    )
    expect(approveRes.status()).toBe(200)
    const loanId: string = (await approveRes.json()).data.loanId
    expect(loanId).toBeTruthy()

    // Unique per run: references are not unique in the ledger, and
    // a re-run against a persistent DB must not match a prior run's
    // entry.
    const reference = `DISB-RT3-${Date.now()}`
    const disbRes = await request.post(`${BASE_URL}/api/owner/loans/${loanId}/disburse`, {
      headers: { Origin: BASE_URL },
      data: { method: 'OFFLINE', amount: '3000000', reference },
    })
    expect(disbRes.status()).toBe(200)

    const entry = await db.ledgerEntry.findFirst({
      where: { type: 'DISBURSEMENT', reference },
    })
    expect(entry).toBeTruthy()
    expect(entry!.loanId).toBe(loanId)
  })
})

// ------------------------------------------------------------------
// P4 + Info-2 — the upload pipeline end to end: a post-IEND payload
// never reaches disk, and a collection that fails after storing
// leaves no orphaned file behind.
// ------------------------------------------------------------------
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)])
}

const TRAILING_MARKER = 'RT3-TRAILING-MARKER'
const PNG_WITH_TRAILING = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngChunk('IHDR', Buffer.alloc(13, 1)),
  pngChunk('IDAT', Buffer.from([0x78, 0x9c, 0x01, 0x02, 0x03])),
  pngChunk('IEND', Buffer.alloc(0)),
  pngChunk('tEXt', Buffer.from(`Comment\x00${TRAILING_MARKER}`, 'latin1')),
])
const PNG_DATA_URL = `data:image/png;base64,${PNG_WITH_TRAILING.toString('base64')}`

// The standalone server runs from .next/standalone (it chdirs
// there), so private uploads land in that tree, not the repo root.
const UPLOADS_DIR = path.join(
  process.cwd(),
  '.next',
  'standalone',
  '.storage',
  'uploads'
)
async function uploadDirListing(): Promise<string[]> {
  try {
    return (await fsp.readdir(UPLOADS_DIR)).sort()
  } catch {
    return []
  }
}

test.describe('Round 3 — P4/Info-2 upload pipeline', () => {
  test('successful collection stores a rebuilt PNG; failed collection leaves no file', async ({
    request,
  }) => {
    // Use a FRESH loan owned by this test: a successful collection
    // allocates against the loan's schedule, so collecting on the
    // seeded demo loan would mutate state other specs assert on
    // (seed-coherence expects its installment 2 to stay OVERDUE).
    await apiLogin(request, OWNER_EMAIL, OWNER_PASSWORD, '10.45.1.1')
    const token = await createQrLink(request, '10.45.1.2')
    const applyRes = await request.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '10.45.1.3' },
      data: {
        fullName: 'Upload Pipeline Applicant',
        mobile: freshMobile(),
        password: SIGNUP_PASSWORD,
        consents: CONSENTS,
      },
    })
    expect(applyRes.status()).toBe(201)
    const applyData = (await applyRes.json()).data
    const approveRes = await request.post(
      `${BASE_URL}/api/owner/applications/${applyData.applicationId}/approve`,
      { headers: { Origin: BASE_URL }, data: { reviewNotes: 'RT3 upload check' } }
    )
    expect(approveRes.status()).toBe(200)
    const loanId: string = (await approveRes.json()).data.loanId
    const disbRes = await request.post(`${BASE_URL}/api/owner/loans/${loanId}/disburse`, {
      headers: { Origin: BASE_URL },
      data: {
        method: 'OFFLINE',
        amount: '3000000',
        reference: `DISB-RT3-UP-${Date.now()}`,
      },
    })
    expect(disbRes.status()).toBe(200)

    await apiLogin(request, AGENT_EMAIL, AGENT_PASSWORD, '10.45.1.4')

    // Control: a valid collection with the trailing-data PNG. The
    // fresh candidate is unassigned (pool), so the agent may collect.
    const before = await uploadDirListing()
    const okRes = await request.post(`${BASE_URL}/api/agent/cash-collections`, {
      headers: { Origin: BASE_URL },
      data: {
        candidateId: applyData.candidateId,
        loanId,
        amount: '100',
        proofUrl: PNG_DATA_URL,
      },
    })
    expect(okRes.status(), await okRes.text()).toBe(201)

    const afterOk = await uploadDirListing()
    const newFiles = afterOk.filter((f) => !before.includes(f))
    expect(newFiles).toHaveLength(1)
    const stored = await fsp.readFile(path.join(UPLOADS_DIR, newFiles[0]))
    // The post-IEND tEXt (and its marker) never reached disk.
    expect(stored.includes(Buffer.from(TRAILING_MARKER))).toBe(false)

    // Failure: same upload, but the candidate does not own the loan —
    // the business check rejects AFTER the file was stored.
    const failRes = await request.post(`${BASE_URL}/api/agent/cash-collections`, {
      headers: { Origin: BASE_URL },
      data: {
        candidateId: PRIYA_ID,
        loanId,
        amount: '100',
        proofUrl: PNG_DATA_URL,
      },
    })
    expect(failRes.status()).toBeGreaterThanOrEqual(400)
    expect(failRes.status()).toBeLessThan(500)

    // No orphan: the directory is exactly as it was after the
    // successful collection.
    const afterFail = await uploadDirListing()
    expect(afterFail).toEqual(afterOk)
  })
})
