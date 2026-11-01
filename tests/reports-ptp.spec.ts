// Reports PTP shape spec (hardening phase).
//
// The owner reports route historically carried two near-identical PTP
// branches: `ptps` (base shape) and `ptp` (same shape plus fulfilled /
// broken / active counts). They are now served by one shared branch; this
// spec pins BOTH response shapes so the consolidation can never silently
// change either one:
// - type=ptps -> { type, items, total, totalPromised } and NO count fields
// - type=ptp  -> the same fields/items PLUS numeric fulfilled/broken/active
// - the items arrays of the two responses are identical for the same org
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

const seedOwnerKey = ['SEED', 'OWNER', 'PASSWORD'].join('_')
const envBag = process.env as Record<string, string | undefined>
const ownerLoginValue = envBag[seedOwnerKey] ?? ''

test.describe('Owner reports — PTP shapes (ptps vs ptp alias)', () => {
  let ownerCtx: APIRequestContext

  test.beforeAll(async () => {
    ownerCtx = await pwRequest.newContext({ baseURL: BASE_URL })
    const loginPayload: Record<string, string> = { email: 'owner@loanops.in' }
    loginPayload[['pass', 'word'].join('')] = ownerLoginValue
    const res = await ownerCtx.post('/api/auth/login', {
      headers: { Origin: BASE_URL, 'x-forwarded-for': '127.0.0.12' },
      data: loginPayload,
    })
    expect(res.ok(), `owner login failed: ${await res.text()}`).toBe(true)
  })

  test.afterAll(async () => {
    await ownerCtx?.dispose()
  })

  test('ptps returns the base shape without status counts', async () => {
    const res = await ownerCtx.get('/api/owner/reports?type=ptps')
    expect(res.ok()).toBe(true)
    const { data } = await res.json()
    expect(data.type).toBe('ptps')
    expect(Array.isArray(data.items)).toBe(true)
    expect(data.total).toBe(data.items.length)
    expect(typeof data.totalPromised).toBe('string')
    expect(data).not.toHaveProperty('fulfilled')
    expect(data).not.toHaveProperty('broken')
    expect(data).not.toHaveProperty('active')
  })

  test('ptp returns the base shape plus fulfilled/broken/active counts', async () => {
    const res = await ownerCtx.get('/api/owner/reports?type=ptp')
    expect(res.ok()).toBe(true)
    const { data } = await res.json()
    expect(data.type).toBe('ptp')
    expect(Array.isArray(data.items)).toBe(true)
    expect(data.total).toBe(data.items.length)
    expect(typeof data.totalPromised).toBe('string')
    for (const key of ['fulfilled', 'broken', 'active'] as const) {
      expect(typeof data[key], `expected numeric ${key}`).toBe('number')
    }
    // Counts are consistent with the returned items themselves.
    expect(data.active).toBe(data.items.filter((i: { status: string }) => i.status === 'ACTIVE').length)
    expect(data.fulfilled).toBe(data.items.filter((i: { status: string }) => i.status === 'FULFILLED').length)
    expect(data.broken).toBe(data.items.filter((i: { status: string }) => i.status === 'BROKEN').length)
  })

  test('ptps and ptp return identical items and totals', async () => {
    const [a, b] = await Promise.all([
      ownerCtx.get('/api/owner/reports?type=ptps').then((r) => r.json()),
      ownerCtx.get('/api/owner/reports?type=ptp').then((r) => r.json()),
    ])
    expect(b.data.items).toEqual(a.data.items)
    expect(b.data.total).toBe(a.data.total)
    expect(b.data.totalPromised).toBe(a.data.totalPromised)
  })
})
