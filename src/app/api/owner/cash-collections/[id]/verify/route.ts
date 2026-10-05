// POST /api/owner/cash-collections/[id]/verify — owner verifies or rejects a cash collection
// VERIFY: creates a Payment with method=CASH, status=ALLOCATED, runs capturePayment()
// REJECT: updates status=REJECTED with reason
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, conflict, validate, genNumber } from '@/lib/server/api'
import { capturePayment } from '@/lib/server/payments'

const schema = z.object({
  action: z.enum(['VERIFY', 'REJECT']),
  rejectionReason: z.string().optional().nullable(),
})

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data = validate(schema, body)

  const cc = await db.payment.findFirst({
    where: { id, loan: { organizationId: ctx.user.organizationId } },
    include: { loan: true, candidate: true, recordedBy: true },
  })
  if (!cc) return notFound('Cash collection not found')
  if (cc.status !== 'PENDING_VERIFICATION') return conflict('Cash collection is not pending verification')

  if (data.action === 'REJECT') {
    if (!data.rejectionReason) return badRequest('rejectionReason is required when rejecting')

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: cc.id },
        data: {
          status: 'REJECTED',
          rejectionReason: data.rejectionReason,
          verifiedById: ctx.user.id,
          verifiedAt: new Date(),
        },
      })
      // Notify the agent who recorded it
      await tx.notification.create({
        data: {
          organizationId: ctx.user.organizationId,
          userId: cc.recordedById,
          type: 'AI_INSIGHT',
          title: 'Cash collection rejected',
          message: `Cash collection of ₹${cc.amount / 100} for ${cc.candidate.fullName} (${cc.loan.loanNumber}) was rejected: ${data.rejectionReason}`,
          isRead: false,
          metadata: { cashCollectionId: cc.id },
        },
      })
    })

    await audit(ctx, 'REJECT', 'CashCollection', cc.id, `Rejected cash collection ₹${cc.amount / 100} for ${cc.candidate.fullName} (${cc.loan.loanNumber}): ${data.rejectionReason}`)

    return success({ id: cc.id, status: 'REJECTED' })
  }

  // VERIFY → create a Payment (method=CASH, status=ALLOCATED), run capturePayment
  const paymentNumber = genNumber('PAY')
  const payment = await db.payment.create({
    data: {
      organizationId: ctx.user.organizationId,
      paymentNumber,
      loanId: cc.loanId,
      candidateId: cc.candidateId,
      method: 'CASH',
      amount: cc.amount,
      reference: cc.reference,
      status: 'PENDING_VERIFICATION',
      verifiedById: ctx.user.id,
      verifiedAt: new Date(),
    },
  })

  // Capture payment (allocates against installments + posts ledger + receipt)
  const capture = await capturePayment({
    paymentId: payment.id,
    organizationId: ctx.user.organizationId,
    userId: ctx.user.id,
    channel: 'CASH_VERIFICATION',
  })

  // Mark cash collection as verified/allocated
  await db.payment.update({
    where: { id: cc.id },
    data: {
      status: 'ALLOCATED',
      verifiedById: ctx.user.id,
      verifiedAt: new Date(),
    },
  })

  await audit(ctx, 'VERIFY', 'CashCollection', cc.id, `Verified cash collection ₹${cc.amount / 100} for ${cc.candidate.fullName} (${cc.loan.loanNumber}). Payment ${paymentNumber}, receipt ${capture.receiptNumber}.`)

  return success({
    id: cc.id,
    status: 'ALLOCATED',
    paymentId: payment.id,
    paymentNumber,
    receiptNumber: capture.receiptNumber,
    allocatedFees: String(capture.allocatedFees),
    allocatedInterest: String(capture.allocatedInterest),
    allocatedPrincipal: String(capture.allocatedPrincipal),
  })
})
