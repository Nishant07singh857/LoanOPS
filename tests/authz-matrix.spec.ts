import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { createHmac } from 'crypto'

/** Webhook signatures are HMAC-SHA256 over the canonical string
 *  `${providerEventId}.${paymentId}.${status}` — signing only the event id
 *  (the old scheme) must be rejected. */
function signWebhook(providerEventId: string, paymentId: string, status: string): string {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET as string
  return createHmac('sha256', secret).update(`${providerEventId}.${paymentId}.${status}`).digest('hex')
}

test.describe('Authorization & IDOR Matrix', () => {
  let db: PrismaClient
  
  test.beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_TEST })
  })
  
  test.afterAll(async () => {
    await db.$disconnect()
  })

  test('Webhook signature constraints', async ({ request }) => {
    const mockRes = await request.post('/api/webhooks/payment-mock', {
      data: { paymentId: 'dummy' }
    })
    expect(mockRes.status()).toBe(403)

    // No signature at all -> rejected.
    const realRes = await request.post('/api/webhooks/payment', {
      data: { paymentId: 'dummy', providerEventId: 'evt_123', status: 'CAPTURED' }
    })
    expect(realRes.status()).toBe(400)

    // The mock webhook no longer captures via GET.
    const mockGet = await request.get('/api/webhooks/payment-mock?paymentId=dummy&idempotencyKey=k1')
    expect(mockGet.status()).toBe(405)
  })

  test('Webhook signature covers paymentId and status (canonical string)', async ({ request }) => {
    test.skip(!process.env.PAYMENT_WEBHOOK_SECRET, 'PAYMENT_WEBHOOK_SECRET not set')

    // Old scheme — HMAC over the event id only — must now be rejected.
    const legacySignature = createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET as string)
      .update('evt_legacy')
      .digest('hex')
    const legacyRes = await request.post('/api/webhooks/payment', {
      data: { paymentId: 'dummy', providerEventId: 'evt_legacy', status: 'CAPTURED', signature: legacySignature }
    })
    expect(legacyRes.status()).toBe(400)

    // Correct canonical signature passes signature verification; the
    // request then fails later on the unknown payment (404), not on auth.
    const goodSignature = signWebhook('evt_good', 'dummy', 'CAPTURED')
    const goodRes = await request.post('/api/webhooks/payment', {
      data: { paymentId: 'dummy', providerEventId: 'evt_good', status: 'CAPTURED', signature: goodSignature }
    })
    expect(goodRes.status()).toBe(404)

    // A signature minted for CAPTURED cannot be flipped to FAILED.
    const flippedRes = await request.post('/api/webhooks/payment', {
      data: { paymentId: 'dummy', providerEventId: 'evt_good', status: 'FAILED', signature: goodSignature }
    })
    expect(flippedRes.status()).toBe(400)
  })

  test('Anonymous access to protected routes', async ({ request }) => {
    const routes = [
      '/api/auth/me',
      '/api/agent/dashboard',
      '/api/owner/dashboard',
      '/api/candidate/profile',
      '/api/receipts/123',
      '/api/files/123'
    ]

    for (const route of routes) {
      const res = await request.get(route)
      expect(res.status()).toBe(401)
    }
  })
})
