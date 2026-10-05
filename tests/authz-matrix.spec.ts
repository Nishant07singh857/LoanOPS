import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

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

    const realRes = await request.post('/api/webhooks/payment', {
      data: { paymentId: 'dummy', providerEventId: 'evt_123', status: 'CAPTURED' }
    })
    expect(realRes.status()).toBe(400)
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
