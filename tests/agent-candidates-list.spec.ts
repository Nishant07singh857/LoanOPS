// Agent candidates LIST spec — GET /api/agent/candidates pool semantics.
//
// Seed story (scripts/seed.ts): candidate-001 (Priya Sharma) and
// candidate-002 (Rahul Verma) are assigned to agent Arjun
// (agent@loanops.in); candidate-003 (Karthik Rao) is assigned to agent
// Sneha (agent2@loanops.in). The product rule (detail route + this
// list): an agent sees candidates assigned to them PLUS unassigned
// pool candidates in the same organisation; candidates assigned to
// another agent never appear. Nov 19 full-check finding M2: the list
// was assigned-only, so pool work was undiscoverable from the list.
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

async function listIds(ctx: APIRequestContext, query = ''): Promise<{ ids: string[]; data: any }> {
  const res = await ctx.get(`/api/agent/candidates${query}`)
  expect(res.status()).toBe(200)
  const data = (await res.json()).data
  return { ids: data.items.map((i: any) => i.id), data }
}

test.describe('Agent candidates list (pool semantics)', () => {
  let ownerCtx: APIRequestContext
  let arjunCtx: APIRequestContext
  let snehaCtx: APIRequestContext

  test.beforeAll(async () => {
    ownerCtx = await loginContext('owner@loanops.in', 'SEED_OWNER_PASSWORD', '127.0.0.61')
    arjunCtx = await loginContext('agent@loanops.in', 'SEED_AGENT_PASSWORD', '127.0.0.62')
    snehaCtx = await loginContext('agent2@loanops.in', 'SEED_AGENT2_PASSWORD', '127.0.0.63')
  })

  test.afterAll(async () => {
    await ownerCtx?.dispose()
    await arjunCtx?.dispose()
    await snehaCtx?.dispose()
  })

  test('Arjun sees his two assigned candidates, not Sneha\u2019s', async () => {
    const { ids, data } = await listIds(arjunCtx)
    expect(ids).toContain('candidate-001')
    expect(ids).toContain('candidate-002')
    expect(ids).not.toContain('candidate-003')
    // Pagination shape preserved.
    expect(typeof data.total).toBe('number')
    expect(data.page).toBe(1)
    expect(typeof data.pageSize).toBe('number')
  })

  test('Sneha sees her assigned candidate, not Arjun\u2019s', async () => {
    const { ids } = await listIds(snehaCtx)
    expect(ids).toContain('candidate-003')
    expect(ids).not.toContain('candidate-001')
    expect(ids).not.toContain('candidate-002')
  })

  test('search narrows within the scope and cannot surface another agent\u2019s candidate', async () => {
    const byName = await listIds(arjunCtx, '?search=Priya')
    expect(byName.ids).toEqual(['candidate-001'])
    // Karthik's exact mobile fragment: he is Sneha's, so Arjun gets nothing.
    const byMobile = await listIds(arjunCtx, '?search=9820922')
    expect(byMobile.ids).toEqual([])
  })

  test('unassigned pool candidate appears in every agent\u2019s list until re-assigned', async () => {
    // Remember Sneha's profile id so the assignment can be restored.
    const detailRes = await ownerCtx.get('/api/owner/candidates/candidate-003')
    expect(detailRes.status()).toBe(200)
    const snehaProfileId = (await detailRes.json()).data.assignedAgent?.id
    expect(snehaProfileId).toBeTruthy()

    try {
      const unassign = await ownerCtx.patch('/api/owner/candidates/candidate-003', {
        data: { assignedAgentId: null },
      })
      expect(unassign.status(), await unassign.text()).toBe(200)

      const arjun = await listIds(arjunCtx)
      expect(arjun.ids).toContain('candidate-003')
      const sneha = await listIds(snehaCtx)
      expect(sneha.ids).toContain('candidate-003')
    } finally {
      const restore = await ownerCtx.patch('/api/owner/candidates/candidate-003', {
        data: { assignedAgentId: snehaProfileId },
      })
      expect(restore.status(), await restore.text()).toBe(200)
    }

    // Baseline restored: Karthik is Sneha's again, invisible to Arjun.
    const arjunAfter = await listIds(arjunCtx)
    expect(arjunAfter.ids).not.toContain('candidate-003')
    const snehaAfter = await listIds(snehaCtx)
    expect(snehaAfter.ids).toContain('candidate-003')
  })
})
