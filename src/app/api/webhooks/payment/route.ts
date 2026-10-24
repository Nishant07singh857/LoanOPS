// POST /api/webhooks/payment — PUBLIC webhook from payment provider
// Validates HMAC signature over the canonical string
// `${providerEventId}.${paymentId}.${status}`, idempotent via the
// WebhookEvent @@unique([provider, eventId]) constraint.
// On CAPTURED: calls capturePayment() (allocates against installments + ledger + receipt).
// On FAILED: only INITIATED / PENDING_VERIFICATION payments transition to
// FAILED. An ALLOCATED payment is never stranded by a late FAILED event.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { auditRaw } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, serverError, validate } from '@/lib/server/api'
import { capturePayment } from '@/lib/server/payments'
import { createHmac, timingSafeEqual } from 'crypto'

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET
const SIGNATURE_REQUIRED = true
const PROVIDER = 'mock'

const schema = z.object({
  paymentId: z.string(),
  providerEventId: z.string(),
  signature: z.string().optional(),
  status: z.enum(['CAPTURED', 'FAILED']),
  reason: z.string().optional(),
}).strict()

/** Canonical string that the provider signs — covers the full payload that
 *  matters (event, target payment, and outcome), so a captured signature
 *  cannot be re-targeted to another payment or flipped to another status. */
export function webhookCanonicalString(providerEventId: string, paymentId: string, status: string): string {
  return `${providerEventId}.${paymentId}.${status}`
}

function verifySignature(
  providerEventId: string,
  paymentId: string,
  status: string,
  signature: string | undefined,
): boolean {
  if (!SIGNATURE_REQUIRED) return true // dev mode — accept any payload
  if (!signature) return false
  try {
    const expected = createHmac('sha256', WEBHOOK_SECRET as string)
      .update(webhookCanonicalString(providerEventId, paymentId, status))
      .digest('hex')
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

  if (!verifySignature(data.providerEventId, data.paymentId, data.status, data.signature)) {
    return badRequest('Invalid signature')
  }

  // Find payment
  const payment = await db.payment.findUnique({
    where: { id: data.paymentId },
    include: { loan: { include: { candidate: true } } },
  })
  if (!payment) return notFound('Payment not found')

  // Fast-path duplicate check (the DB unique constraint below is the real
  // guard; this just avoids re-creating rows in the common retry case).
  const existing = await db.webhookEvent.findFirst({
    where: { provider: PROVIDER, eventId: data.providerEventId },
  })
  if (existing && existing.processed) {
    return success({ processed: true, duplicate: true, message: 'Event already processed', paymentId: payment.id, status: payment.status })
  }

  // Record webhook event. Concurrent duplicate deliveries race here; the
  // @@unique([provider, eventId]) constraint makes exactly one of them win
  // and the loser gets P2002 -> duplicate response.
  let webhookEvent
  try {
    webhookEvent = await db.webhookEvent.create({
      data: {
        organizationId: payment.organizationId,
        provider: PROVIDER,
        eventId: data.providerEventId,
        signature: data.signature,
        rawPayload: body,
        processed: false,
      },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return success({ processed: true, duplicate: true, message: 'Event already received', paymentId: payment.id, status: payment.status })
    }
    throw e
  }

  const markProcessed = () =>
    db.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processed: true, processedAt: new Date() },
    })

  try {
    if (data.status === 'CAPTURED') {
      if (payment.status === 'ALLOCATED') {
        await markProcessed()
        return success({ processed: true, message: 'Payment already allocated', paymentId: payment.id, status: payment.status })
      }

      const result = await capturePayment({
        paymentId: payment.id,
        organizationId: payment.organizationId,
        userId: null,
        channel: 'WEBHOOK',
        providerEventId: data.providerEventId,
      })

      await markProcessed()

      if (result.noop) {
        return success({ processed: true, message: 'Payment already allocated', paymentId: payment.id, status: 'ALLOCATED', receiptNumber: result.receiptNumber })
      }

      return success({
        processed: true,
        paymentId: payment.id,
        status: 'ALLOCATED',
        receiptNumber: result.receiptNumber,
        allocatedFees: String(result.allocatedFees),
        allocatedInterest: String(result.allocatedInterest),
        allocatedPrincipal: String(result.allocatedPrincipal),
        unallocated: String(result.unallocated),
      })
    }

    // FAILED — never strand an allocation. Only payments that have not been
    // allocated yet may transition to FAILED.
    if (payment.status === 'ALLOCATED' || payment.status === 'VERIFIED') {
      await markProcessed()
      return success({
        processed: false,
        reason: 'already-allocated',
        message: `Payment already ${payment.status}; FAILED event ignored to protect its allocation`,
        paymentId: payment.id,
        status: payment.status,
      })
    }

    if (payment.status === 'INITIATED' || payment.status === 'PENDING_VERIFICATION') {
      // Guarded transition: if a concurrent capture won the race, this
      // matches 0 rows and the payment keeps its allocated state.
      const transitioned = await db.payment.updateMany({
        where: { id: payment.id, status: { in: ['INITIATED', 'PENDING_VERIFICATION'] } },
        data: { status: 'FAILED' },
      })
      if (transitioned.count === 0) {
        await markProcessed()
        return success({
          processed: false,
          reason: 'already-allocated',
          message: 'Payment changed state concurrently; FAILED event ignored',
          paymentId: payment.id,
          status: payment.status,
        })
      }

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

      await markProcessed()
      return success({ processed: true, paymentId: payment.id, status: 'FAILED' })
    }

    // FAILED / REJECTED already — idempotent no-op.
    await markProcessed()
    return success({ processed: true, message: `Payment already ${payment.status}`, paymentId: payment.id, status: payment.status })
  } catch (e: any) {
    await db.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processingError: e?.message ?? 'Unknown error' },
    })
    if (e?.status && e?.code) throw e // HttpError (e.g. 409 from capture) — surface as-is
    console.error('[WEBHOOK CAPTURE ERROR]', e)
    return serverError('Payment capture failed')
  }
})
