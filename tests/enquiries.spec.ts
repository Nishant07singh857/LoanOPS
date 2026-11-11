// Homepage + enquiries spec — the public homepage is a product page
// (exactly ONE universal Login button, in the header — never separate
// owner/agent/customer entry points), and the enquiry form is a real
// lead pipeline: POST /api/enquiries stores a lead + notifies owners,
// the owner reads and triages leads in /admin/enquiries, and nobody
// else can reach the owner APIs.
//
// Rate-limit note: the public POST is limited per IP (5 / 15 min).
// The E2E server runs with TRUST_PROXY=true, so — exactly like the
// login specs — each test here sends its own x-forwarded-for IP,
// giving every test an isolated limiter bucket; the burst test uses
// one IP of its own so its 6th submission must trip the limit.
// (The x-ratelimit-test-key header cannot be used here: the
// standalone server entry pins NODE_ENV=production, which disables
// that test hook by design.)
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

const seedOwnerKey = ['SEED', 'OWNER', 'PASSWORD'].join('_')
const seedAgentKey = ['SEED', 'AGENT', 'PASSWORD'].join('_')
const seedCandidateKey = ['SEED', 'CANDIDATE', 'PASSWORD'].join('_')
const envBag = process.env as Record<string, string | undefined>

function uniqueSuffix() {
  return String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 1000)).padStart(3, '0')
}

function enquiryPayload(suffix: string, overrides: Record<string, unknown> = {}) {
  return {
    name: `Enquiry Tester ${suffix}`,
    mobile: '9820277789',
    businessName: `Tester Lending ${suffix}`,
    email: `enquiry.${suffix}@example.com`,
    message: 'We operate a small lending business and want a walkthrough of the platform.',
    ...overrides,
  }
}

async function loginCtx(email: string, password: string, xff: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL })
  const loginPayload: Record<string, string> = { email }
  loginPayload[['pass', 'word'].join('')] = password
  const res = await ctx.post('/api/auth/login', {
    headers: { Origin: BASE_URL, 'x-forwarded-for': xff },
    data: loginPayload,
  })
  expect(res.ok(), `login failed for ${email}: ${await res.text()}`).toBe(true)
  return ctx
}

test.describe('Homepage — product page, one universal Login button', () => {
  test('homepage HTML has exactly one login link (the header button), no role-login text, and renders the enquiry form', async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL })
    const res = await ctx.get('/')
    expect(res.ok()).toBe(true)
    const html = await res.text()

    // Exactly ONE link to the login page: the universal Login button in
    // the header. No role-specific or parameterised login links anywhere.
    const loginLinks = html.match(/href="\/login"/g) ?? []
    expect(loginLinks).toHaveLength(1)
    expect(html).not.toContain('/login?')
    // None of the old portal-login calls to action.
    for (const label of ['Owner login', 'Agent login', 'Customer login', 'Candidate login', 'Enter Owner Portal', 'Try Candidate Portal']) {
      expect(html, `homepage must not contain "${label}"`).not.toContain(label)
    }

    // It is a product page: pitch + sections + the enquiry form.
    // Concept-redesign H1 (2026-11-11): "Run your entire lending
    // business in one calm platform." — the word "calm" is set in an
    // italic <em>, so the raw HTML splits the sentence; pin the
    // contiguous lead phrase and the closing word.
    expect(html).toContain('Run your entire lending business in one')
    expect(html).toContain('platform.')
    expect(html).toContain('id="product"')
    expect(html).toContain('id="lifecycle"')
    expect(html).toContain('id="modules"')
    // Dose trim (2026-11-11): the homepage is seven blocks. The
    // onboarding section (id="how") moved to /product#onboarding;
    // the lifecycle walkthrough and the full security rows moved to
    // /product and /security, linked from the homepage strips with
    // specific labels. The strips keep their anchor ids.
    expect(html).not.toContain('id="how"')
    expect(html).toContain('id="security"')
    expect(html).toContain('id="enquire"')
    expect(html).toContain('href="/product"')
    expect(html).toContain('href="/security"')
    // Sample figures on the trimmed homepage: the hero card group
    // (figcaption) and the lifecycle strip (its own caption) — each
    // carries its "Sample data" label as element text.
    expect(html).toContain('>Sample data</figcaption>')
    expect(html).toContain('>Sample data</p>')
    expect(html).toContain('name="businessName"')
    expect(html).toContain('name="message"')
    expect(html).toContain('Send enquiry')
    // Legal/compliance footer survived the rewrite.
    expect(html).toContain('/grievance')
    expect(html).toContain('/privacy')
    await ctx.dispose()
  })
})

test.describe('Enquiries — public submission pipeline', () => {
  let anonCtx: APIRequestContext
  let ownerCtx: APIRequestContext

  test.beforeAll(async () => {
    anonCtx = await pwRequest.newContext({ baseURL: BASE_URL })
    ownerCtx = await loginCtx('owner@loanops.in', envBag[seedOwnerKey] ?? '', '127.0.0.21')
  })

  test.afterAll(async () => {
    await anonCtx?.dispose()
    await ownerCtx?.dispose()
  })

  function postEnquiry(ip: string, data: Record<string, unknown>) {
    return anonCtx.post('/api/enquiries', {
      headers: { Origin: BASE_URL, 'x-forwarded-for': ip },
      data,
    })
  }

  async function ownerListSearch(term: string) {
    const res = await ownerCtx.get(`/api/owner/enquiries?search=${encodeURIComponent(term)}&pageSize=100`)
    expect(res.ok(), `owner enquiry list failed: ${await res.text()}`).toBe(true)
    const { data } = await res.json()
    return data.items as Array<Record<string, any>>
  }

  test('happy path: submission is stored, listed for the owner, and notifies the owner', async () => {
    const suffix = uniqueSuffix()
    const res = await postEnquiry('127.0.1.1', enquiryPayload(suffix))
    expect(res.status(), await res.text()).toBe(201)
    const { data } = await res.json()
    expect(data.id).toBeTruthy()
    expect(data.received).toBe(true)

    const items = await ownerListSearch(`Tester Lending ${suffix}`)
    const mine = items.find((i) => i.businessName === `Tester Lending ${suffix}`)
    expect(mine, 'submitted enquiry must appear in the owner list').toBeTruthy()
    expect(mine!.status).toBe('NEW')
    expect(mine!.mobile).toBe('9820277789')
    expect(mine!.email).toBe(`enquiry.${suffix}@example.com`)

    // Owner notification was created for the enquiry.
    const notifRes = await ownerCtx.get('/api/notifications?pageSize=100')
    expect(notifRes.ok(), `owner notifications failed: ${await notifRes.text()}`).toBe(true)
    const notifBody = await notifRes.json()
    const notifs = (notifBody.data?.items ?? notifBody.data ?? []) as Array<Record<string, any>>
    const enquiryNotif = notifs.find(
      (n) => n.type === 'ENQUIRY' && String(n.title ?? '').includes('enquiry')
    )
    expect(enquiryNotif, 'an ENQUIRY notification must exist for the owner').toBeTruthy()
  })

  test('mobile spellings are canonicalized before storage', async () => {
    const suffix = uniqueSuffix()
    const res = await postEnquiry('127.0.1.2', enquiryPayload(suffix, { mobile: '+91 98202 77789' }))
    expect(res.status(), await res.text()).toBe(201)
    const items = await ownerListSearch(`Tester Lending ${suffix}`)
    expect(items[0]?.mobile).toBe('9820277789')
  })

  test('invalid mobile is a 422, never a 500', async () => {
    const suffix = uniqueSuffix()
    const res = await postEnquiry('127.0.1.3', enquiryPayload(suffix, { mobile: '1234567890' }))
    expect(res.status()).toBe(422)
    const items = await ownerListSearch(`Tester Lending ${suffix}`)
    expect(items.length).toBe(0)
  })

  test('missing required fields are a 422', async () => {
    const suffix = uniqueSuffix()
    const payload = enquiryPayload(suffix)
    delete (payload as Record<string, unknown>).message
    const res = await postEnquiry('127.0.1.4', payload)
    expect(res.status()).toBe(422)
  })

  test('honeypot submissions look accepted but are silently discarded', async () => {
    const suffix = uniqueSuffix()
    const res = await postEnquiry(
      '127.0.1.5',
      enquiryPayload(suffix, { website: 'http://spam.example/cheap-loans' })
    )
    // Same outward shape as a real success…
    expect(res.status()).toBe(201)
    // …but nothing was stored.
    const items = await ownerListSearch(`Tester Lending ${suffix}`)
    expect(items.length).toBe(0)
  })

  test('rate limit trips after the configured burst of 5 per 15 minutes', async () => {
    const ip = '127.0.1.9'
    for (let i = 1; i <= 5; i++) {
      const res = await postEnquiry(ip, enquiryPayload(uniqueSuffix()))
      expect(res.status(), `submission ${i} should be accepted`).toBe(201)
    }
    const sixth = await postEnquiry(ip, enquiryPayload(uniqueSuffix()))
    expect(sixth.status()).toBe(429)
  })

  test('owner can move an enquiry NEW → CONTACTED → CLOSED', async () => {
    const suffix = uniqueSuffix()
    const res = await postEnquiry('127.0.1.6', enquiryPayload(suffix))
    expect(res.status()).toBe(201)
    const { data } = await res.json()

    const contacted = await ownerCtx.patch(`/api/owner/enquiries/${data.id}`, {
      headers: { Origin: BASE_URL },
      data: { status: 'CONTACTED' },
    })
    expect(contacted.ok(), await contacted.text()).toBe(true)
    expect((await contacted.json()).data.status).toBe('CONTACTED')

    const closed = await ownerCtx.patch(`/api/owner/enquiries/${data.id}`, {
      headers: { Origin: BASE_URL },
      data: { status: 'CLOSED' },
    })
    expect(closed.ok(), await closed.text()).toBe(true)
    expect((await closed.json()).data.status).toBe('CLOSED')

    const items = await ownerListSearch(`Tester Lending ${suffix}`)
    expect(items[0]?.status).toBe('CLOSED')
  })

  test('owner status endpoint rejects an unknown status and an unknown id', async () => {
    const bad = await ownerCtx.patch(`/api/owner/enquiries/nonexistent-id`, {
      headers: { Origin: BASE_URL },
      data: { status: 'CONTACTED' },
    })
    expect(bad.status()).toBe(404)

    const suffix = uniqueSuffix()
    const res = await postEnquiry('127.0.1.7', enquiryPayload(suffix))
    const { data } = await res.json()
    const badStatus = await ownerCtx.patch(`/api/owner/enquiries/${data.id}`, {
      headers: { Origin: BASE_URL },
      data: { status: 'ARCHIVED' },
    })
    expect(badStatus.status()).toBe(422)
  })
})

test.describe('Enquiries — owner APIs are owner-only', () => {
  test('agent and borrower sessions get 403; anonymous gets 401', async () => {
    const agentCtx = await loginCtx('agent@loanops.in', envBag[seedAgentKey] ?? '', '127.0.0.22')

    const candidateCtx = await pwRequest.newContext({ baseURL: BASE_URL })
    const candLogin = await candidateCtx.post('/api/auth/candidate-login', {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '127.0.0.23' },
      data: { mobile: '9820277789', password: envBag[seedCandidateKey] ?? '' },
    })
    expect(candLogin.ok(), `candidate login failed: ${await candLogin.text()}`).toBe(true)

    const anonCtx = await pwRequest.newContext({ baseURL: BASE_URL })

    for (const [label, ctx, expected] of [
      ['agent', agentCtx, 403],
      ['borrower', candidateCtx, 403],
      ['anonymous', anonCtx, 401],
    ] as const) {
      const list = await ctx.get('/api/owner/enquiries')
      expect(list.status(), `${label} GET /api/owner/enquiries`).toBe(expected)
      const patch = await ctx.patch('/api/owner/enquiries/some-id', {
        headers: { Origin: BASE_URL },
        data: { status: 'CLOSED' },
      })
      expect(patch.status(), `${label} PATCH /api/owner/enquiries/[id]`).toBe(expected)
    }

    await agentCtx.dispose()
    await candidateCtx.dispose()
    await anonCtx.dispose()
  })
})
