import { test, expect, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

const OWNER_EMAIL = 'owner@loanops.in'
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || 'Owner@123'

const AGENT1_EMAIL = 'agent@loanops.in'
const AGENT1_PASSWORD = process.env.SEED_AGENT_PASSWORD || 'Agent@123'

const AGENT2_EMAIL = 'agent2@loanops.in'
const AGENT2_PASSWORD = process.env.SEED_AGENT2_PASSWORD || 'Agent2@123'

const CANDIDATE_MOBILE = '9820277789'
const CANDIDATE_PASSWORD = process.env.SEED_CANDIDATE_PASSWORD || 'Candidate@123'

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

test.describe('LoanOps Production E2E, OWASP Self-Attack & Compliance Verification Suite', () => {
  test('0. Health endpoint, security headers, disabled fake online payment webhook, login hardening, and legal pages (Phase 2, 5, 8, 10)', async ({
    request,
    page,
  }) => {
    // 1. Health endpoint & Security Headers
    const healthRes = await request.get(`${BASE_URL}/api/health`)
    expect(healthRes.status()).toBe(200)
    expect(healthRes.headers()['x-content-type-options']).toBe('nosniff')
    expect(healthRes.headers()['x-frame-options']).toBe('DENY')
    expect(healthRes.headers()['content-security-policy']).toContain("default-src 'self'")
    const healthJson = await healthRes.json()
    expect(healthJson.status).toBe('healthy')
    expect(healthJson.db).toBe('connected')

    // 2. Fake online payment webhook is disabled (403 Forbidden)
    const webhookRes = await request.post(`${BASE_URL}/api/webhooks/payment-mock`, {
      headers: { Origin: BASE_URL },
      data: { paymentId: 'fake_id', status: 'SUCCESS' },
    })
    expect(webhookRes.status()).toBe(403)

    // 3. Login page does not expose Demo Credentials quick-fill in production build
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByText('Quick-fill demo account')).toHaveCount(0)

    // 4. All 5 India Lending Legal & Compliance pages are reachable and render properly
    for (const legalRoute of ['/privacy', '/terms', '/kfs', '/grievance', '/fair-practices']) {
      const legalRes = await request.get(`${BASE_URL}${legalRoute}`)
      expect(legalRes.status(), `Expected ${legalRoute} to return 200`).toBe(200)
    }
    await page.goto('/privacy')
    await expect(page.getByText(/Digital Personal Data Protection/i).first()).toBeVisible()
    await page.goto('/kfs')
    await expect(page.getByText(/Key Facts Statement/i).first()).toBeVisible()
    await page.goto('/grievance')
    await expect(page.getByText(/Grievance Redressal/i).first()).toBeVisible()
    await page.goto('/fair-practices')
    await expect(page.getByText(/Fair Practices/i).first()).toBeVisible()
  })

  test('1. Signup with explicit DPDP consents & login for all 3 roles + role-based redirects (Mobile 375px & Desktop 1440px)', async ({
    browser,
  }) => {
    // A. Mobile 375px: Candidate Signup (with unbundled DPDP consents) -> Login -> Redirects to /portal
    const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const mobilePage = await mobileCtx.newPage()
    const newSignupMobile = `97${Math.floor(10000000 + Math.random() * 90000000)}`

    await mobilePage.goto('/signup')
    await mobilePage.getByLabel('Full Name').fill('Aarav Patel')
    await mobilePage.getByLabel('Mobile Number').fill(newSignupMobile)
    await mobilePage.getByLabel('Password').fill('Borrower@2026!')
    // Check mandatory unbundled DPDP Act 2023 consent checkboxes
    const checkboxes = mobilePage.locator('input[type="checkbox"]')
    await checkboxes.nth(0).check()
    await checkboxes.nth(1).check()
    await mobilePage.getByRole('button', { name: /Create Account/i }).click()
    await mobilePage.waitForURL('**/login**')

    await mobilePage.getByLabel('Email or Mobile Number').fill(newSignupMobile)
    await mobilePage.getByLabel('Password').fill('Borrower@2026!')
    await mobilePage.getByRole('button', { name: 'Sign in' }).click()
    await mobilePage.waitForURL('**/portal')
    await expect(mobilePage.getByText(/Hello, Aarav/i)).toBeVisible()

    // Verify DPDP consent was recorded in DB and Data Export endpoint works
    const exportRes = await mobileCtx.request.get(`${BASE_URL}/api/candidate/data-requests?export=true`)
    expect(exportRes.status()).toBe(200)
    const exportJson = (await exportRes.json()).data
    expect(exportJson.profile.fullName).toBe('Aarav Patel')
    expect(Array.isArray(exportJson.consents)).toBe(true)
    expect(exportJson.consents.length).toBeGreaterThanOrEqual(2)
    await mobileCtx.close()

    // B. Mobile 375px: Agent Login -> Redirects to /agent
    const agentCtx = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const agentPage = await agentCtx.newPage()
    await agentPage.goto('/login')
    await agentPage.getByLabel('Email or Mobile Number').fill(AGENT1_EMAIL)
    await agentPage.getByLabel('Password').fill(AGENT1_PASSWORD)
    await agentPage.getByRole('button', { name: 'Sign in' }).click()
    await agentPage.waitForURL('**/agent')
    await expect(agentPage.locator('main')).toBeVisible()
    await agentCtx.close()

    // C. Desktop 1440px: Owner Login -> Redirects to /admin
    const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const ownerPage = await ownerCtx.newPage()
    await ownerPage.goto('/login')
    await ownerPage.getByLabel('Email or Mobile Number').fill(OWNER_EMAIL)
    await ownerPage.getByLabel('Password').fill(OWNER_PASSWORD)
    await ownerPage.getByRole('button', { name: 'Sign in' }).click()
    await ownerPage.waitForURL('**/admin')
    await expect(ownerPage.locator('main')).toBeVisible()
    await ownerCtx.close()
  })

  test('2, 3, 4 & 5. Full lifecycle: Candidate KYC & Consents -> Owner Approve & Concurrent Disbursement Race Guard -> Agent Cash Collection (Partial, Full & Double-Click Idempotency) -> Cross-Portal Visibility -> Owner Verify & Reject Reversal -> Concurrent Double-Payment Race Guard', async ({
    browser,
  }) => {
    const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const agentCtx = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const candCtx = await browser.newContext({ viewport: { width: 375, height: 812 } })

    const ownerReq = ownerCtx.request
    const agentReq = agentCtx.request
    const candReq = candCtx.request

    await apiLogin(ownerReq, OWNER_EMAIL, OWNER_PASSWORD, '10.10.1.1')
    await apiLogin(agentReq, AGENT1_EMAIL, AGENT1_PASSWORD, '10.10.1.2')

    // --- STEP 2A: Owner creates QR application link for a new borrower ---
    const uniqueMobile = `96${Math.floor(10000000 + Math.random() * 90000000)}`
    const borrowerPass = 'Vikram@2026!'
    const qrRes = await ownerReq.post(`${BASE_URL}/api/owner/qr-links`, {
      headers: { Origin: BASE_URL },
      data: {
        preFullName: 'Vikram Desai',
        preMobile: uniqueMobile,
        prePrincipal: '3000000', // ₹30,000 in paise
        preInterestType: 'PERCENTAGE',
        preInterestRate: 1200, // 12% flat -> ₹3,600 interest -> ₹33,600 total over 3 months (₹11,200/month)
        preFrequency: 'MONTHLY',
        preTenureMonths: 3,
        preInstallments: 3,
        prePurpose: 'Inventory restocking',
      },
    })
    expect(qrRes.status()).toBe(201)
    const qrJson = await qrRes.json()
    const token: string = qrJson.data.token

    // --- STEP 2B: Candidate registers via /api/apply/[token], logs in, and submits KYC + Consents ---
    const applyRes = await candReq.post(`${BASE_URL}/api/apply/${token}`, {
      headers: { Origin: BASE_URL },
      data: {
        fullName: 'Vikram Desai',
        mobile: uniqueMobile,
        password: borrowerPass,
        consents: [
          { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
          { consentType: 'KFS_DISCLOSURE', granted: true, policyVersion: '2026.1' },
        ],
      },
    })
    expect(applyRes.status()).toBe(201)
    const applyJson = await applyRes.json()
    const applicationId: string = applyJson.data.applicationId
    const candidateId: string = applyJson.data.candidateId
    expect(applicationId).toBeTruthy()
    expect(candidateId).toBeTruthy()

    await apiLogin(candReq, uniqueMobile, borrowerPass, '10.10.1.3')

    const rawAadhaar = '654321098765'
    const rawPan = 'KLMNO5678P'
    const rawBankAccount = '309988776655'

    const submitKycRes = await candReq.post(`${BASE_URL}/api/candidate/application/submit`, {
      headers: { Origin: BASE_URL },
      data: {
        aadhaarNumber: rawAadhaar,
        panNumber: rawPan,
        bankName: 'State Bank of India',
        bankAccount: rawBankAccount,
        bankIfsc: 'SBIN0001234',
        upiId: 'vikram@sbi',
        agreementAccepted: true,
        consents: [
          { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
          { consentType: 'KYC_AADHAAR', granted: true, policyVersion: '2026.1' },
          { consentType: 'CREDIT_CHECK', granted: true, policyVersion: '2026.1' },
          { consentType: 'KFS_DISCLOSURE', granted: true, policyVersion: '2026.1' },
        ],
      },
    })
    expect(submitKycRes.status()).toBe(200)

    // --- STEP 2C: Verify Server-Side PII Masking + Audited Owner PII Reveal (Phase 3 & 6) ---
    const appDetailRes = await ownerReq.get(`${BASE_URL}/api/owner/applications/${applicationId}`)
    expect(appDetailRes.status()).toBe(200)
    const appDetail = (await appDetailRes.json()).data
    expect(appDetail.kycAadhaar).toBe('XXXX-XXXX-8765')
    expect(appDetail.kycPan).toBe('KLXXX5678P')
    expect(appDetail.candidate.aadhaarMasked).toBe('XXXX-XXXX-8765')
    expect(appDetail.candidate.panMasked).toBe('KLXXX5678P')
    expect(appDetail.candidate.bankAccount).toBe('XXXX-XXXX-6655')

    // Audited Owner PII Reveal endpoint decrypts and writes REVEAL_PII audit log
    const revealRes = await ownerReq.post(`${BASE_URL}/api/owner/pii/reveal`, {
      headers: { Origin: BASE_URL },
      data: {
        entityType: 'APPLICATION',
        entityId: applicationId,
        reason: 'Final underwriting KYC check',
      },
    })
    expect(revealRes.status()).toBe(200)
    const revealData = (await revealRes.json()).data
    // UIDAI compliance: full Aadhaar is NEVER stored (not even encrypted).
    // PII reveal returns only the masked last-4 digits.
    expect(revealData.aadhaar).toBe('XXXX-XXXX-8765')
    expect(revealData.pan).toBe(rawPan)
    expect(revealData.bankAccount).toBe(rawBankAccount)

    // --- STEP 2D: Owner Approves Application & Concurrent Double-Disbursement Race Test (Phase 7 & 11) ---
    const approveRes = await ownerReq.post(
      `${BASE_URL}/api/owner/applications/${applicationId}/approve`,
      {
        headers: { Origin: BASE_URL },
        data: { reviewNotes: 'Approved for E2E verification' },
      }
    )
    expect(approveRes.status()).toBe(200)
    const approveData = (await approveRes.json()).data
    const loanId: string = approveData.loanId
    expect(loanId).toBeTruthy()
    expect(approveData.totalRepayable).toBe('3360000')
    expect(approveData.installmentAmount).toBe('1120000')

    // Fire TWO concurrent disbursement requests simultaneously — exactly ONE must succeed (200) and the second must be rejected (409 Conflict)!
    const [disbResA, disbResB] = await Promise.all([
      ownerReq.post(`${BASE_URL}/api/owner/loans/${loanId}/disburse`, {
        headers: { Origin: BASE_URL },
        data: {
          method: 'OFFLINE',
          amount: '3000000',
          reference: 'DISB-E2E-001A',
          notes: 'Disbursed in full A',
        },
      }),
      ownerReq.post(`${BASE_URL}/api/owner/loans/${loanId}/disburse`, {
        headers: { Origin: BASE_URL },
        data: {
          method: 'OFFLINE',
          amount: '3000000',
          reference: 'DISB-E2E-001B',
          notes: 'Concurrent duplicate disbursement attempt B',
        },
      }),
    ])
    const disbStatuses = [disbResA.status(), disbResB.status()].sort()
    expect(disbStatuses).toEqual([200, 409])

    // --- STEP 3 & 5: Agent Cash Collection API Validation + Double-Click Idempotency ---
    const zeroRes = await agentReq.post(`${BASE_URL}/api/agent/cash-collections`, {
      headers: { Origin: BASE_URL },
      data: { loanId, candidateId, amount: '0' },
    })
    expect(zeroRes.status()).toBe(400)

    const overRes = await agentReq.post(`${BASE_URL}/api/agent/cash-collections`, {
      headers: { Origin: BASE_URL },
      data: { loanId, candidateId, amount: '5000000' },
    })
    expect(overRes.status()).toBe(400)

    // Partial cash payment #1 (₹5,000 = 500,000 paise) with idempotency key
    const idemKey1 = `idem_e2e_${Date.now()}_1`
    const [cashRes1A, cashRes1B] = await Promise.all([
      agentReq.post(`${BASE_URL}/api/agent/cash-collections`, {
        headers: { Origin: BASE_URL, 'Idempotency-Key': idemKey1 },
        data: {
          loanId,
          candidateId,
          amount: '500000',
          notes: 'Partial cash collection #1',
          idempotencyKey: idemKey1,
        },
      }),
      agentReq.post(`${BASE_URL}/api/agent/cash-collections`, {
        headers: { Origin: BASE_URL, 'Idempotency-Key': idemKey1 },
        data: {
          loanId,
          candidateId,
          amount: '500000',
          notes: 'Partial cash collection #1',
          idempotencyKey: idemKey1,
        },
      }),
    ])

    expect([200, 201]).toContain(cashRes1A.status())
    expect([200, 201]).toContain(cashRes1B.status())
    const payment1A = (await cashRes1A.json()).data
    const payment1B = (await cashRes1B.json()).data
    expect(payment1A.id).toBe(payment1B.id)
    expect(payment1A.receiptNumber).toBe(payment1B.receiptNumber)
    expect(payment1A.verificationStatus).toBe('PENDING_VERIFICATION')

    const payment1Id: string = payment1A.id
    const receipt1Number: string = payment1A.receiptNumber

    const loanAfter1Res = await ownerReq.get(`${BASE_URL}/api/owner/loans/${loanId}`)
    const loanAfter1 = (await loanAfter1Res.json()).data
    const outAfter1 =
      Number(loanAfter1.outstandingPrincipal) +
      Number(loanAfter1.outstandingInterest) +
      Number(loanAfter1.outstandingFees || 0)
    expect(outAfter1).toBe(2860000)
    expect(loanAfter1.schedule[0].status).toBe('PARTIALLY_PAID')

    // --- STEP 3B: Agent collects second cash payment via Agent Portal UI (Mobile 375px) ---
    const agentPage = await agentCtx.newPage()
    await agentPage.goto(`/agent/candidates/${candidateId}`)
    await expect(agentPage.getByText('Vikram Desai').first()).toBeVisible()
    await agentPage.getByRole('button', { name: /Collect Cash/i }).first().click()
    await expect(agentPage.getByRole('dialog')).toBeVisible()

    const amountInput = agentPage.getByRole('dialog').locator('input[type="number"]')
    await amountInput.fill('6200')
    const cash2ResponsePromise = agentPage.waitForResponse(
      (r) => r.url().includes('/api/agent/cash-collections') && r.request().method() === 'POST'
    )
    await agentPage
      .getByRole('dialog')
      .getByRole('button', { name: /Confirm Cash Collection|Record Cash|Collect Cash/i })
      .click()
    const cash2Res = await cash2ResponsePromise
    expect([200, 201]).toContain(cash2Res.status())
    const payment2Data = (await cash2Res.json()).data
    const payment2Id: string = payment2Data.id

    const loanAfter2Res = await ownerReq.get(`${BASE_URL}/api/owner/loans/${loanId}`)
    const loanAfter2 = (await loanAfter2Res.json()).data
    const outAfter2 =
      Number(loanAfter2.outstandingPrincipal) +
      Number(loanAfter2.outstandingInterest) +
      Number(loanAfter2.outstandingFees || 0)
    expect(outAfter2).toBe(2240000)
    expect(loanAfter2.schedule[0].status).toBe('PAID')

    // --- STEP 3C: Cross-Portal Visibility & Printable Receipt Page ---
    const candPage = await candCtx.newPage()
    await candPage.goto(`/portal/receipts/${payment1Id}`)
    await expect(candPage.getByText(receipt1Number).first()).toBeVisible()
    await expect(candPage.getByText('Vikram Desai').first()).toBeVisible()
    await expect(candPage.getByRole('button', { name: /Print/i }).first()).toBeVisible()

    const ownerPage = await ownerCtx.newPage()
    await ownerPage.goto('/admin/collections')
    await expect(ownerPage.getByText(/Unverified Cash in Hand/i).first()).toBeVisible()
    await expect(ownerPage.getByText('Arjun Nair').first()).toBeVisible()

    // --- STEP 4: Owner Verifies Payment #1 and Rejects Payment #2 (Checking Reversal) ---
    const verifyRes = await ownerReq.post(
      `${BASE_URL}/api/owner/cash-collections/${payment1Id}/verify`,
      {
        headers: { Origin: BASE_URL },
        data: { action: 'VERIFY' },
      }
    )
    expect(verifyRes.status()).toBe(200)
    const verifyData = (await verifyRes.json()).data
    expect(verifyData.status).toBe('VERIFIED')

    const rejectRes = await ownerReq.post(
      `${BASE_URL}/api/owner/cash-collections/${payment2Id}/verify`,
      {
        headers: { Origin: BASE_URL },
        data: {
          action: 'REJECT',
          rejectionReason: 'Discrepancy in cash handover denomination count',
        },
      }
    )
    expect(rejectRes.status()).toBe(200)
    const rejectData = (await rejectRes.json()).data
    expect(rejectData.status).toBe('REJECTED')
    expect(rejectData.reversed).toBe(true)

    const loanAfterRejectRes = await ownerReq.get(`${BASE_URL}/api/owner/loans/${loanId}`)
    const loanAfterReject = (await loanAfterRejectRes.json()).data
    const outAfterReject =
      Number(loanAfterReject.outstandingPrincipal) +
      Number(loanAfterReject.outstandingInterest) +
      Number(loanAfterReject.outstandingFees || 0)
    expect(outAfterReject).toBe(2860000)
    expect(loanAfterReject.schedule[0].status).toBe('PARTIALLY_PAID')

    const ledgerRes = await ownerReq.get(`${BASE_URL}/api/owner/ledger?pageSize=20`)
    const ledgerItems = (await ledgerRes.json()).data.items
    const hasReversalEntry = ledgerItems.some((e: { type: string }) => e.type === 'REVERSAL')
    expect(hasReversalEntry).toBe(true)

    // --- STEP 4C: Concurrent Double-Payment Race Guard & Auto-Closure ---
    // Fire TWO concurrent full-payoff requests (with different idempotency keys) simultaneously!
    // Row locking (`SELECT ... FOR UPDATE`) must allow exactly ONE (201) and reject the second (400)!
    const [fullPayA, fullPayB] = await Promise.all([
      agentReq.post(`${BASE_URL}/api/agent/cash-collections`, {
        headers: { Origin: BASE_URL, 'Idempotency-Key': `race_pay_a_${Date.now()}` },
        data: {
          loanId,
          candidateId,
          amount: '2860000',
          notes: 'Concurrent full payoff A',
        },
      }),
      agentReq.post(`${BASE_URL}/api/agent/cash-collections`, {
        headers: { Origin: BASE_URL, 'Idempotency-Key': `race_pay_b_${Date.now()}` },
        data: {
          loanId,
          candidateId,
          amount: '2860000',
          notes: 'Concurrent full payoff B',
        },
      }),
    ])
    const payStatuses = [fullPayA.status(), fullPayB.status()].sort()
    expect(payStatuses).toEqual([201, 400])

    const closedLoanRes = await ownerReq.get(`${BASE_URL}/api/owner/loans/${loanId}`)
    const closedLoan = (await closedLoanRes.json()).data
    expect(closedLoan.status).toBe('CLOSED')

    await ownerCtx.close()
    await agentCtx.close()
    await candCtx.close()
  })

  test('6. Authorization Matrix (Anonymous x Candidate x Agent A x Agent B x Owner) & OWASP Self-Attack Suite (Phase 3, 4, 5, 6, 11)', async ({
    browser,
  }) => {
    const anonCtx = await browser.newContext()
    const agent1Ctx = await browser.newContext()
    const agent2Ctx = await browser.newContext()
    const candCtx = await browser.newContext()
    const ownerCtx = await browser.newContext()

    await apiLogin(agent1Ctx.request, AGENT1_EMAIL, AGENT1_PASSWORD, '10.10.2.1')
    await apiLogin(agent2Ctx.request, AGENT2_EMAIL, AGENT2_PASSWORD, '10.10.2.2')
    await apiLogin(candCtx.request, CANDIDATE_MOBILE, CANDIDATE_PASSWORD, '10.10.2.3')
    await apiLogin(ownerCtx.request, OWNER_EMAIL, OWNER_PASSWORD, '10.10.2.4')

    // ============================================================
    // A. AUTHORIZATION MATRIX (Anonymous, Candidate, Agent A, Agent B, Owner)
    // ============================================================
    const matrixRoutes = [
      { path: '/api/owner/dashboard', anon: 401, cand: 403, agent1: 403, owner: 200 },
      { path: '/api/owner/loans', anon: 401, cand: 403, agent1: 403, owner: 200 },
      { path: '/api/owner/applications', anon: 401, cand: 403, agent1: 403, owner: 200 },
      { path: '/api/owner/cash-collections', anon: 401, cand: 403, agent1: 403, owner: 200 },
      { path: '/api/owner/data-requests', anon: 401, cand: 403, agent1: 403, owner: 200 },
      { path: '/api/agent/dashboard', anon: 401, cand: 403, agent1: 200, owner: 403 },
      { path: '/api/agent/candidates', anon: 401, cand: 403, agent1: 200, owner: 403 },
      { path: '/api/agent/cash-collections', anon: 401, cand: 403, agent1: 200, owner: 403 },
      { path: '/api/candidate/loan', anon: 401, cand: 200, agent1: 403, owner: 403 },
      { path: '/api/candidate/data-requests', anon: 401, cand: 200, agent1: 403, owner: 403 },
    ]

    for (const row of matrixRoutes) {
      const [rAnon, rCand, rAgent1, rOwner] = await Promise.all([
        anonCtx.request.get(`${BASE_URL}${row.path}`),
        candCtx.request.get(`${BASE_URL}${row.path}`),
        agent1Ctx.request.get(`${BASE_URL}${row.path}`),
        ownerCtx.request.get(`${BASE_URL}${row.path}`),
      ])
      expect(rAnon.status(), `Anon GET ${row.path}`).toBe(row.anon)
      expect(rCand.status(), `Candidate GET ${row.path}`).toBe(row.cand)
      expect(rAgent1.status(), `Agent1 GET ${row.path}`).toBe(row.agent1)
      expect(rOwner.status(), `Owner GET ${row.path}`).toBe(row.owner)
    }

    // ============================================================
    // B. IDOR ATTEMPTS (Cross-Agent & Cross-Candidate)
    // ============================================================
    // Agent 1 (Arjun) cannot view Agent 2's (Sneha) assigned candidate (candidate-003 Karthik Iyer)
    const idorCandidateRes = await agent1Ctx.request.get(
      `${BASE_URL}/api/agent/candidates/candidate-003`
    )
    expect(idorCandidateRes.status()).toBe(403)

    // Agent 2 (Sneha) cannot collect cash on Agent 1's loan (loan-001 belonging to candidate-002 Rahul Verma)
    const idorCashRes = await agent2Ctx.request.post(`${BASE_URL}/api/agent/cash-collections`, {
      headers: { Origin: BASE_URL },
      data: {
        loanId: 'loan-001',
        candidateId: 'candidate-002',
        amount: '10000',
      },
    })
    expect(idorCashRes.status()).toBe(403)

    // Candidate cannot reveal PII
    const candRevealPii = await candCtx.request.post(`${BASE_URL}/api/owner/pii/reveal`, {
      headers: { Origin: BASE_URL },
      data: { entityType: 'CANDIDATE', entityId: 'candidate-001' },
    })
    expect(candRevealPii.status()).toBe(403)

    // Candidate online payment POST route is disabled (403 Forbidden - offline cash only)
    const candOnlinePay = await candCtx.request.post(`${BASE_URL}/api/candidate/payments`, {
      headers: { Origin: BASE_URL },
      data: { loanId: 'loan-001', amount: '10000', method: 'ONLINE_UPI' },
    })
    expect(candOnlinePay.status()).toBe(403)

    // ============================================================
    // C. MASS ASSIGNMENT ATTACK (Unrecognized / Privileged Fields)
    // ============================================================
    const massAssignRes = await agent1Ctx.request.post(`${BASE_URL}/api/agent/cash-collections`, {
      headers: { Origin: BASE_URL },
      data: {
        loanId: 'loan-001',
        candidateId: 'candidate-002',
        amount: '10000',
        status: 'VERIFIED',
        verifiedById: 'user-owner',
        isAdmin: true,
      },
    })
    expect(massAssignRes.status()).toBe(422)

    // ============================================================
    // D. CSRF REJECTION (Cross-Origin State-Changing Request)
    // ============================================================
    const csrfRes = await ownerCtx.request.post(`${BASE_URL}/api/owner/qr-links`, {
      headers: { Origin: 'https://evil-phishing-site.example.com' },
      data: { prePrincipal: '1000000' },
    })
    expect(csrfRes.status()).toBe(403)

    // ============================================================
    // E. STORED XSS SANITIZATION & SQL INJECTION IMMUNITY
    // ============================================================
    const xssFollowUpRes = await agent1Ctx.request.post(`${BASE_URL}/api/agent/follow-ups`, {
      headers: { Origin: BASE_URL },
      data: {
        candidateId: 'candidate-002',
        loanId: 'loan-001',
        contactMethod: 'PHONE',
        outcome: 'PROMISED_TO_PAY',
        notes: `<script>window.pwned=true</script><img src=x onerror="alert(1)">Spoke with borrower`,
      },
    })
    expect([200, 201]).toContain(xssFollowUpRes.status())
    const followUpListRes = await agent1Ctx.request.get(`${BASE_URL}/api/agent/follow-ups`)
    const followUpText = await followUpListRes.text()
    expect(followUpText).not.toContain('<script>')
    expect(followUpText).not.toContain('onerror=')
    expect(followUpText).toContain('Spoke with borrower')

    // SQL Injection payload in search query
    const sqliRes = await ownerCtx.request.get(
      `${BASE_URL}/api/owner/loans?search=${encodeURIComponent("' OR 1=1; DROP TABLE \"Loan\"; --")}`
    )
    expect(sqliRes.status()).toBe(200)

    // ============================================================
    // F. INVALID MAGIC-BYTE FILE UPLOAD REJECTION
    // ============================================================
    // Disguise an executable ("MZ...") as a base64 image/jpeg
    const fakeJpegExecutable = 'data:image/jpeg;base64,TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const badUploadRes = await agent1Ctx.request.post(`${BASE_URL}/api/agent/cash-collections`, {
      headers: { Origin: BASE_URL },
      data: {
        loanId: 'loan-001',
        candidateId: 'candidate-002',
        amount: '10000',
        proofUrl: fakeJpegExecutable,
      },
    })
    expect(badUploadRes.status()).toBe(400)
    expect(await badUploadRes.text()).toContain('magic-byte')

    // ============================================================
    // G. TAMPERED SESSION COOKIE REJECTION (401)
    // ============================================================
    const tamperedCtx = await browser.newContext({
      extraHTTPHeaders: {
        Cookie: 'loanops_session=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      },
    })
    const tamperedRes = await tamperedCtx.request.get(`${BASE_URL}/api/owner/dashboard`)
    expect(tamperedRes.status()).toBe(401)
    await tamperedCtx.close()

    // ============================================================
    // H. RATE LIMITING (429 Too Many Requests + Retry-After Header)
    // ============================================================
    const testBucketKey = `bucket_${Date.now()}`
    let got429 = false
    let retryAfterHeader: string | undefined
    for (let i = 0; i < 8; i++) {
      const rlRes = await anonCtx.request.post(`${BASE_URL}/api/auth/forgot-password`, {
        headers: {
          Origin: BASE_URL,
          'x-ratelimit-test-key': testBucketKey,
        },
        data: { email: 'nonexistent@loanops.in' },
      })
      if (rlRes.status() === 429) {
        got429 = true
        retryAfterHeader = rlRes.headers()['retry-after']
        break
      }
    }
    expect(got429).toBe(true)
    expect(Number(retryAfterHeader)).toBeGreaterThan(0)

    await anonCtx.close()
    await agent1Ctx.close()
    await agent2Ctx.close()
    await candCtx.close()
    await ownerCtx.close()
  })
})

// --- TASK 4: SECURITY GAPS ---

test.describe('Task 4: Auth & Session Security', () => {
  test('Account lockout / progressive delay after failed logins', async ({ request }) => {
    const email = 'lockout-test@loanops.in'
    
    // Attempt 5 failed logins
    for (let i = 0; i < 5; i++) {
      await request.post('/api/auth/login', {
        data: { email, password: 'wrong-password' }
      })
    }
    
    // 6th attempt should return 429
    const res = await request.post('/api/auth/login', {
      data: { email, password: 'wrong-password' }
    })
    
    expect(res.status()).toBe(429)
    const body = await res.json()
    expect(body.error).toContain('Too many login attempts')
  })

  test('Session rotation on login', async ({ request }) => {
    // Login to get session 1
    const res1 = await request.post('/api/auth/login', {
      data: { email: OWNER_EMAIL, password: OWNER_PASSWORD }
    })
    const cookie1 = res1.headers()['set-cookie']
    expect(cookie1).toBeDefined()
    
    // Login again to get session 2
    const res2 = await request.post('/api/auth/login', {
      data: { email: OWNER_EMAIL, password: OWNER_PASSWORD }
    })
    const cookie2 = res2.headers()['set-cookie']
    expect(cookie2).toBeDefined()
    
    // They should not match (rotated)
    expect(cookie1).not.toBe(cookie2)
  })

  test('Tampered cookie rejection', async ({ request }) => {
    const res = await request.get('/api/auth/me', {
      headers: {
        Cookie: 'session=tampered.cookie.data'
      }
    })
    expect(res.status()).toBe(401)
  })
})
