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

    const { reverseCashPayment } = await import('@/lib/server/payments')
    await reverseCashPayment({
      paymentId: cc.id,
      organizationId: ctx.user.organizationId,
      ownerUserId: ctx.user.id,
      rejectionReason: data.rejectionReason,
    })

    // Notify the agent who recorded it
    await db.notification.create({
      data: {
        organizationId: ctx.user.organizationId,
        userId: cc.recordedById!,
        type: 'AI_INSIGHT',
        title: 'Cash collection rejected',
        message: `Cash collection of ₹${cc.amount / 100} for ${cc.candidate.fullName} (${cc.loan.loanNumber}) was rejected: ${data.rejectionReason}`,
        isRead: false,
        metadata: { cashCollectionId: cc.id },
      },
    })

    await audit(ctx, 'REJECT', 'Payment', cc.id, `Rejected cash collection ₹${cc.amount / 100} for ${cc.candidate.fullName} (${cc.loan.loanNumber}): ${data.rejectionReason}`)

    return success({ id: cc.id, status: 'REJECTED' })
  }

  // VERIFY -> just mark it as VERIFIED
  await db.payment.update({
    where: { id: cc.id },
    data: {
      status: 'VERIFIED',
      verifiedById: ctx.user.id,
      verifiedAt: new Date(),
    },
  })

  await audit(ctx, 'VERIFY', 'Payment', cc.id, `Verified cash collection ₹${cc.amount / 100} for ${cc.candidate.fullName} (${cc.loan.loanNumber}). Payment ${cc.paymentNumber}.`)

  return success({
    id: cc.id,
    status: 'VERIFIED',
    paymentId: cc.id,
    paymentNumber: cc.paymentNumber,
    receiptNumber: cc.receiptNumber,
    allocatedFees: String(cc.allocatedFees),
    allocatedInterest: String(cc.allocatedInterest),
    allocatedPrincipal: String(cc.allocatedPrincipal),
  })
})
