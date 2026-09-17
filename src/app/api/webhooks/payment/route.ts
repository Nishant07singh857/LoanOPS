// POST /api/webhooks/payment — PUBLIC webhook from payment provider
// Validates HMAC signature, idempotent via providerEventId stored in WebhookEvent.
// On CAPTURED: calls capturePayment() (allocates against installments + ledger + receipt).
// On FAILED: updates payment.status=FAILED + notification + audit.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { auditRaw } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, conflict, serverError, validate } from '@/lib/server/api'
import { capturePayment } from '@/lib/server/payments'
import { createHmac, timingSafeEqual } from 'crypto'

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET
// Whether signature verification is required. If the secret is not set in env,
// we are in dev mode and accept any payload (per spec).
const SIGNATURE_REQUIRED = !!WEBHOOK_SECRET

const schema = z.object({
  providerEventId: z.string().min(1),
  paymentId: z.string(),
  status: z.enum(['CAPTURED', 'FAILED']),
  signature: z.string().optional(),
  reason: z.string().optional(),
})

function verifySignature(providerEventId: string, signature: string | undefined): boolean {
  if (!SIGNATURE_REQUIRED) return true // dev mode — accept any payload
  if (!signature) return false
  try {
    const expected = createHmac('sha256', WEBHOOK_SECRET as string).update(providerEventId).digest('hex')
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export const POST = apiHandler(async (req: NextRequest) => {
  const raw = await req.text()
  let body: any = null
  try { body = JSON.parse(raw) } catch { return badRequest('Invalid JSON') }
  const data = validate(schema, body)

  // Verify HMAC-SHA256 of providerEventId (dev mode: accept any payload when secret not set)
  if (!verifySignature(data.providerEventId, data.signature)) {
    return badRequest('Invalid signature')
  }

  // Find payment
  const payment = await db.payment.findUnique({
    where: { id: data.paymentId },
    include: { loan: { include: { candidate: true } } },
  })
  if (!payment) return notFound('Payment not found')

  // Idempotency: check providerEventId was already processed
  const existing = await db.webhookEvent.findFirst({
    where: { provider: 'mock', eventId: data.providerEventId },
  })
  if (existing && existing.processed) {
    return success({ processed: true, message: 'Event already processed', paymentId: payment.id, status: payment.status })
  }

  // Record webhook event (idempotent on eventId)
  let webhookEvent
  try {
    webhookEvent = await db.webhookEvent.create({
      data: {
        organizationId: payment.organizationId,
        provider: 'mock',
        eventId: data.providerEventId,
        signature: data.signature,
        rawPayload: body,
        processed: false,
      },
    })
  } catch (e: any) {
    // P2002 unique constraint → already processed
    if (e?.code === 'P2002') {
      return success({ processed: true, message: 'Event already received', paymentId: payment.id, status: payment.status })
    }
    throw e
  }

  try {
    if (data.status === 'CAPTURED') {
      if (payment.status === 'ALLOCATED') {
        // already allocated — mark webhook processed and return
        await db.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: { processed: true, processedAt: new Date() },
        })
        return success({ processed: true, message: 'Payment already allocated', paymentId: payment.id, status: payment.status })
      }

      const result = await capturePayment({
        paymentId: payment.id,
        organizationId: payment.organizationId,
        userId: null,
        channel: 'WEBHOOK',
        providerEventId: data.providerEventId,
      })

      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      })

      return success({
        processed: true,
        paymentId: payment.id,
        status: 'ALLOCATED',
        receiptNumber: result.receiptNumber,
        allocatedFees: String(result.allocatedFees),
        allocatedInterest: String(result.allocatedInterest),
        allocatedPrincipal: String(result.allocatedPrincipal),
      })
    } else {
      // FAILED
      await db.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      })
      if (payment.loan.candidate.userId) {
        await db.notification.create({
          data: {
            organizationId: payment.organizationId,
            userId: payment.loan.candidate.userId,
            candidateId: payment.candidateId,
            type: 'PAYMENT_CONFIRMATION',
            title: 'Payment failed',
            message: `Payment ${payment.paymentNumber} of ₹${payment.amount / 100} failed. Reason: ${data.reason ?? 'unknown'}. Please retry.`,
            isRead: false,
            metadata: { paymentId: payment.id, reason: data.reason },
          },
        })
      }
      await auditRaw(payment.organizationId, null, 'UPDATE', 'Payment', payment.id, `Payment ${payment.paymentNumber} FAILED via webhook`, { reason: data.reason })

      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      })
      return success({ processed: true, paymentId: payment.id, status: 'FAILED' })
    }
  } catch (e: any) {
    await db.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processingError: e?.message ?? 'Unknown error' },
    })
    return serverError(`Capture failed: ${e?.message}`)
  }
})
