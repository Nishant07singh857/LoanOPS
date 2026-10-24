// Mock online-payment webhook — DEVELOPMENT ONLY.
// There is deliberately NO state-changing GET here: a GET that captures a
// payment can be triggered by link previews, retries and crawlers, and it
// carried no signature. GET returns 405. POST requires an explicit
// idempotencyKey so retries collapse onto the same payment attempt.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { capturePayment } from '@/lib/server/payments'
import { apiHandler, success, badRequest, forbidden, fail } from '@/lib/server/api'

function isOnlineMockEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ENABLE_ONLINE_PAYMENTS === 'true'
}

export const GET = apiHandler(async () => {
  return fail('METHOD_NOT_ALLOWED', 'Mock payment capture via GET is not supported. Use POST with an idempotencyKey.', 405)
})

export const POST = apiHandler(async (req: NextRequest) => {
  if (!isOnlineMockEnabled()) {
    return forbidden('Offline cash collection only. Mock online payment webhook is disabled.')
  }

  const body = await req.json().catch(() => null)
  if (!body || !body.paymentId) return badRequest('Missing paymentId')
  if (!body.idempotencyKey || typeof body.idempotencyKey !== 'string' || !body.idempotencyKey.trim()) {
    return badRequest('Missing idempotencyKey')
  }
  const idempotencyKey = body.idempotencyKey.trim()

  const payment = await db.payment.findUnique({ where: { id: body.paymentId } })
  if (!payment) return badRequest('Payment not found')

  // The key must belong to this payment attempt.
  if (payment.idempotencyKey && payment.idempotencyKey !== idempotencyKey) {
    return badRequest('Idempotency key mismatch')
  }

  if (payment.status === 'ALLOCATED') {
    return success({
      message: 'Payment already processed successfully',
      paymentId: payment.id,
      receiptNumber: payment.receiptNumber,
    })
  }

  // Deterministic provider event id derived from the idempotency key, so a
  // retried POST replays the SAME provider event instead of minting a new
  // one on every hit.
  const res = await capturePayment({
    paymentId: payment.id,
    organizationId: payment.organizationId,
    channel: 'WEBHOOK',
    providerEventId: `MOCK-${idempotencyKey}`,
  })

  return success({
    message: 'Payment processed successfully',
    paymentId: payment.id,
    receiptNumber: res.receiptNumber,
  })
})
