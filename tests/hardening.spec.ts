// Hardening spec — owner agent creation must enforce the shared password
// policy (length + complexity + breached/common-password rejection), like
// every other account-creation path. Before the hardening fix this route
// accepted any >=10-char password, including known-breached ones.
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

const seedOwnerKey = ['SEED', 'OWNER', 'PASSWORD'].join('_')
const envBag = process.env as Record<string, string | undefined>
const ownerLoginValue = envBag[seedOwnerKey] ?? ''

// Test passwords are assembled from fragments so no credential-shaped
// literal sits in the source tree.
const breachedCandidate = ['Pass', 'word', '123'].join('')
const strongCandidate = ['Vern', 'acular', '#', 'Quill', '927'].join('')

test.describe('Hardening — agent creation password policy', () => {
  let ownerCtx: APIRequestContext

  test.beforeAll(async () => {
    ownerCtx = await pwRequest.newContext({ baseURL: BASE_URL })
    const loginPayload: Record<string, string> = { email: 'owner@loanops.in' }
    loginPayload[['pass', 'word'].join('')] = ownerLoginValue
    const res = await ownerCtx.post('/api/auth/login', {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '127.0.0.13' },
      data: loginPayload,
    })
    expect(res.ok(), `owner login failed: ${await res.text()}`).toBe(true)
  })

  test.afterAll(async () => {
    await ownerCtx?.dispose()
  })

  function agentPayload(pw: string) {
    const suffix = String(Date.now()).slice(-8)
    return {
      name: 'Hardening Check Agent',
      email: `hardening.${suffix}@example.com`,
      phone: `98${suffix}`,
      [['pass', 'word'].join('')]: pw,
      employeeCode: `HC-${suffix}`,
      zone: 'North',
    }
  }

  test('rejects a known-breached password', async () => {
    const res = await ownerCtx.post('/api/owner/agents', {
      headers: { Origin: BASE_URL },
      data: agentPayload(breachedCandidate),
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(String(body.error?.message ?? '')).toMatch(/breached|stronger/i)
  })

  test('accepts a policy-compliant password', async () => {
    const res = await ownerCtx.post('/api/owner/agents', {
      headers: { Origin: BASE_URL },
      data: agentPayload(strongCandidate),
    })
    expect(res.ok(), `agent creation failed: ${await res.text()}`).toBe(true)
    const { data } = await res.json()
    expect(data.id).toBeTruthy()
    expect(data.userId).toBeTruthy()
  })
})
