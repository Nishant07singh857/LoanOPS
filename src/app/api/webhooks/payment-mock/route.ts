import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { capturePayment } from '@/lib/server/payments'
import { apiHandler, success, badRequest, forbidden } from '@/lib/server/api'

function isOnlineMockEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ENABLE_ONLINE_PAYMENTS === 'true'
}

export const GET = apiHandler(async (req: NextRequest) => {
  if (!isOnlineMockEnabled()) {
    return forbidden('Offline cash collection only. Mock online payment webhook is disabled.')
  }

  const url = new URL(req.url)
  const paymentId = url.searchParams.get('paymentId')
  const idempotencyKey = url.searchParams.get('idempotencyKey')

  if (!paymentId) return badRequest('Missing paymentId')

  const payment = await db.payment.findUnique({ where: { id: paymentId } })
  if (!payment) return badRequest('Payment not found')

  // If already allocated (idempotent success)
  if (payment.status === 'ALLOCATED') {
    return success({
      message: 'Payment already processed successfully',
      paymentId: payment.id,
      receiptNumber: payment.receiptNumber,
    })
  }

  // Idempotency mismatch check
  if (idempotencyKey && payment.idempotencyKey && payment.idempotencyKey !== idempotencyKey) {
    return badRequest('Idempotency key mismatch')
  }

  // Process the payment
  await capturePayment({
    paymentId: payment.id,
    organizationId: payment.organizationId,
    channel: 'WEBHOOK',
    providerEventId: `MOCK-${Date.now()}`,
  })

  return NextResponse.redirect(new URL('/portal/receipts', req.url))
})

export const POST = apiHandler(async (req: NextRequest) => {
  if (!isOnlineMockEnabled()) {
    return forbidden('Offline cash collection only. Mock online payment webhook is disabled.')
  }

  const body = await req.json().catch(() => null)
  if (!body || !body.paymentId) return badRequest('Missing paymentId')

  const payment = await db.payment.findUnique({ where: { id: body.paymentId } })
  if (!payment) return badRequest('Payment not found')

  if (payment.status === 'ALLOCATED') {
    return success({
      message: 'Payment already processed successfully',
      paymentId: payment.id,
      receiptNumber: payment.receiptNumber,
    })
  }

  const res = await capturePayment({
    paymentId: payment.id,
    organizationId: payment.organizationId,
    channel: 'WEBHOOK',
    providerEventId: `MOCK-${Date.now()}`,
  })

  return success({
    message: 'Payment processed successfully',
    paymentId: payment.id,
    receiptNumber: res.receiptNumber,
  })
})

