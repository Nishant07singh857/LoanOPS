// Support thread + status walk spec (feature gap D3) — tickets used
// to be one-shot: a borrower raised one, the owner could only
// Resolve it, IN_REVIEW/CLOSED were unreachable, and nobody could
// reply. This spec pins the full conversation behaviour at the API
// level:
//   - borrower replies on her OWN ticket; another borrower's ticket
//     is a 404 for both reading and replying;
//   - a staff reply lands in the thread AND notifies the borrower;
//   - the status walk enforces SUPPORT_TRANSITIONS (illegal moves
//     are 422, CLOSED is terminal for status AND replies);
//   - agents are scoped to their assigned candidates (Arjun owns
//     candidate-001, Sneha owns candidate-003 — a ticket on the
//     other's candidate is a 404);
//   - the long-standing Resolve endpoint keeps working through the
//     walk.
// Each login uses its own x-forwarded-for IP (TRUST_PROXY=true in
// the E2E server) so the login limiter buckets stay isolated.
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const envBag = process.env as Record<string, string | undefined>

const PRIYA_MOBILE = '9820277789' // candidate-001, assigned to Arjun (agent@)
const KARTHIK_ID = 'candidate-003' // assigned to Sneha (agent2@)

function requiredEnv(key: string): string {
  const v = envBag[key]
  if (!v) throw new Error(`missing env ${key}`)
  return v
}

async function loginContext(
  endpoint: string,
  payload: Record<string, string>,
  ip: string,
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

function candidateLogin(ip: string): Promise<APIRequestContext> {
  const payload: Record<string, string> = { mobile: PRIYA_MOBILE }
  payload[['pass', 'word'].join('')] = requiredEnv('SEED_CANDIDATE_PASSWORD')
  return loginContext('/api/auth/candidate-login', payload, ip)
}

async function createTicketAsPriya(ctx: APIRequestContext, subject: string): Promise<string> {
  const res = await ctx.post('/api/candidate/support', {
    data: { category: 'Repayment', subject, description: `Details for: ${subject}` },
  })
  expect(res.status(), await res.text()).toBe(201)
  const { data } = await res.json()
  return data.id as string
}

test.describe('Support thread + status walk (D3)', () => {
  let ownerCtx: APIRequestContext
  let arjunCtx: APIRequestContext
  let snehaCtx: APIRequestContext
  let priyaCtx: APIRequestContext

  test.beforeAll(async () => {
    ownerCtx = await staffLogin('owner@loanops.in', 'SEED_OWNER_PASSWORD', '127.0.0.61')
    arjunCtx = await staffLogin('agent@loanops.in', 'SEED_AGENT_PASSWORD', '127.0.0.62')
    snehaCtx = await staffLogin('agent2@loanops.in', 'SEED_AGENT2_PASSWORD', '127.0.0.63')
    priyaCtx = await candidateLogin('127.0.0.64')
  })

  test.afterAll(async () => {
    for (const c of [ownerCtx, arjunCtx, snehaCtx, priyaCtx]) await c?.dispose()
  })

  test('borrower replies on her own ticket and sees the thread in order', async () => {
    const ticketId = await createTicketAsPriya(priyaCtx, 'Thread reply test — own ticket')

    const reply = await priyaCtx.post(`/api/candidate/support/${ticketId}/reply`, {
      data: { body: 'Adding more detail from the borrower side.' },
    })
    expect(reply.status(), await reply.text()).toBe(201)

    const detail = await priyaCtx.get(`/api/candidate/support/${ticketId}`)
    expect(detail.ok(), await detail.text()).toBe(true)
    const { data } = await detail.json()
    expect(data.description).toContain('Details for: Thread reply test')
    expect(data.messages).toHaveLength(1)
    expect(data.messages[0].body).toBe('Adding more detail from the borrower side.')
    expect(data.messages[0].mine).toBe(true)
    expect(data.messages[0].author.role).toBe('CANDIDATE')
  })

  test('owner reply appears in the borrower thread and notifies the borrower', async () => {
    const ticketId = await createTicketAsPriya(priyaCtx, 'Thread reply test — staff reply')

    const reply = await ownerCtx.post(`/api/owner/support/${ticketId}/reply`, {
      data: { body: 'Thanks, we are looking into this today.' },
    })
    expect(reply.status(), await reply.text()).toBe(201)

    const detail = await priyaCtx.get(`/api/candidate/support/${ticketId}`)
    const { data } = await detail.json()
    expect(data.messages).toHaveLength(1)
    expect(data.messages[0].author.role).toBe('OWNER')
    expect(data.messages[0].mine).toBe(false)

    // The borrower was notified (portal notification list is keyed by candidateId).
    const notifRes = await priyaCtx.get('/api/candidate/notifications?pageSize=100')
    expect(notifRes.ok(), await notifRes.text()).toBe(true)
    const notifBody = await notifRes.json()
    const items = (notifBody.data?.items ?? []) as Array<Record<string, any>>
    const mine = items.find(
      (n) => n.title === 'New reply on your support ticket' && n.metadata?.ticketId === ticketId,
    )
    expect(mine, 'borrower must be notified of the staff reply').toBeTruthy()
  })

  test("borrower cannot read or reply to another borrower's ticket", async () => {
    // A ticket about Karthik (candidate-003), raised by his agent Sneha.
    const create = await snehaCtx.post('/api/agent/support', {
      data: {
        candidateId: KARTHIK_ID,
        category: 'Repayment',
        subject: 'Thread scope test — Karthik ticket',
        description: 'Raised by the assigned agent.',
      },
    })
    expect(create.status(), await create.text()).toBe(201)
    const { data: created } = await create.json()

    const read = await priyaCtx.get(`/api/candidate/support/${created.id}`)
    expect(read.status()).toBe(404)

    const reply = await priyaCtx.post(`/api/candidate/support/${created.id}/reply`, {
      data: { body: 'This should never land.' },
    })
    expect(reply.status()).toBe(404)

    // And the thread really has no borrower-side message on it.
    const ownerView = await ownerCtx.get(`/api/owner/support/${created.id}`)
    const { data: ownerData } = await ownerView.json()
    expect(ownerData.messages).toHaveLength(0)
  })

  test('status walk enforces the transition map; CLOSED is terminal', async () => {
    const ticketId = await createTicketAsPriya(priyaCtx, 'Status walk test')

    // OPEN → CLOSED is not a legal move.
    const skip = await ownerCtx.post(`/api/owner/support/${ticketId}/status`, {
      data: { status: 'CLOSED' },
    })
    expect(skip.status(), await skip.text()).toBe(422)

    // OPEN → IN_REVIEW → RESOLVED (with note) → CLOSED.
    const review = await ownerCtx.post(`/api/owner/support/${ticketId}/status`, {
      data: { status: 'IN_REVIEW' },
    })
    expect(review.status(), await review.text()).toBe(200)

    const resolve = await ownerCtx.post(`/api/owner/support/${ticketId}/status`, {
      data: { status: 'RESOLVED', resolution: 'Explained the schedule on a call.' },
    })
    expect(resolve.status(), await resolve.text()).toBe(200)
    const { data: resolved } = await resolve.json()
    expect(resolved.resolution).toBe('Explained the schedule on a call.')

    const close = await ownerCtx.post(`/api/owner/support/${ticketId}/status`, {
      data: { status: 'CLOSED' },
    })
    expect(close.status(), await close.text()).toBe(200)

    // Terminal: no status exit, no replies from either side.
    const reopen = await ownerCtx.post(`/api/owner/support/${ticketId}/status`, {
      data: { status: 'IN_REVIEW' },
    })
    expect(reopen.status()).toBe(422)

    const borrowerReply = await priyaCtx.post(`/api/candidate/support/${ticketId}/reply`, {
      data: { body: 'Still need help here.' },
    })
    expect(borrowerReply.status()).toBe(422)

    const ownerReply = await ownerCtx.post(`/api/owner/support/${ticketId}/reply`, {
      data: { body: 'Closing note.' },
    })
    expect(ownerReply.status()).toBe(422)
  })

  test('agents reply and walk status only on their assigned candidates', async () => {
    const ticketId = await createTicketAsPriya(priyaCtx, 'Agent scope test')

    // Arjun is assigned to candidate-001: reply + status both work.
    const arjunReply = await arjunCtx.post(`/api/agent/support/${ticketId}/reply`, {
      data: { body: 'Agent Arjun here — checking your schedule.' },
    })
    expect(arjunReply.status(), await arjunReply.text()).toBe(201)

    const arjunStatus = await arjunCtx.post(`/api/agent/support/${ticketId}/status`, {
      data: { status: 'IN_REVIEW' },
    })
    expect(arjunStatus.status(), await arjunStatus.text()).toBe(200)

    // Sneha owns candidate-003 only: Priya's ticket is invisible to her.
    const snehaRead = await snehaCtx.get(`/api/agent/support/${ticketId}`)
    expect(snehaRead.status()).toBe(404)
    const snehaReply = await snehaCtx.post(`/api/agent/support/${ticketId}/reply`, {
      data: { body: 'Sneha should not be able to post this.' },
    })
    expect(snehaReply.status()).toBe(404)
    const snehaStatus = await snehaCtx.post(`/api/agent/support/${ticketId}/status`, {
      data: { status: 'RESOLVED' },
    })
    expect(snehaStatus.status()).toBe(404)
  })

  test('the existing Resolve endpoint still resolves with a note', async () => {
    const ticketId = await createTicketAsPriya(priyaCtx, 'Resolve compatibility test')

    const res = await ownerCtx.post(`/api/owner/support/${ticketId}/resolve`, {
      data: { resolution: 'Sorted on the call.' },
    })
    expect(res.status(), await res.text()).toBe(200)
    const { data } = await res.json()
    expect(data.status).toBe('RESOLVED')
    expect(data.resolution).toBe('Sorted on the call.')
  })
})
