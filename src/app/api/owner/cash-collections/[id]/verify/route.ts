// POST /api/owner/cash-collections/[id]/verify — owner verifies or rejects a cash collection
// VERIFY: verifyCashPayment() — confirms a collection whose allocation was
//         applied at collection time (installments/loan/ledger already
//         reflect it) and marks the payment VERIFIED.
// REJECT: reverseCashPayment() — full reversal of the collection-time
//         allocation (installments recomputed, balances restored, ledger
//         REVERSAL entries, closed loan reopened), payment REJECTED.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, conflict, validate } from '@/lib/server/api'
import { verifyCashPayment, reverseCashPayment } from '@/lib/server/payments'
import { notifyPaymentReceipt } from '@/lib/server/reminders'

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

    const reversal = await reverseCashPayment({
      paymentId: cc.id,
      organizationId: ctx.user.organizationId,
      ownerUserId: ctx.user.id,
      rejectionReason: data.rejectionReason,
    })

    // Notify the agent who recorded it
    if (cc.recordedById) {
      await db.notification.create({
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
    }

    await audit(ctx, 'REJECT', 'Payment', cc.id, `Rejected cash collection ₹${cc.amount / 100} for ${cc.candidate.fullName} (${cc.loan.loanNumber}): ${data.rejectionReason}`)

    return success({ id: cc.id, status: 'REJECTED', reversed: reversal.reversed })
  }

  // VERIFY -> confirm the collection-time allocation (verifyCashPayment
  // flips the status, stamps the verifier, settles collection tasks).
  const result = await verifyCashPayment({
    paymentId: cc.id,
    organizationId: ctx.user.organizationId,
    verifiedById: ctx.user.id,
  })

  await audit(ctx, 'VERIFY', 'Payment', cc.id, `Verified cash collection ₹${cc.amount / 100} for ${cc.candidate.fullName} (${cc.loan.loanNumber}). Payment ${cc.paymentNumber}, allocated fees=${result.allocatedFees} interest=${result.allocatedInterest} principal=${result.allocatedPrincipal}.`)

  // Receipt notification to the borrower (portal + WhatsApp). Success
  // path only — never on collect, never on reject. Idempotent per
  // payment and internally guarded; it never throws, so a notification
  // problem can never fail the verification itself.
  await notifyPaymentReceipt({
    paymentId: cc.id,
    organizationId: ctx.user.organizationId,
    receiptNumber: result.receiptNumber,
  })

  return success({
    id: cc.id,
    status: 'VERIFIED',
    paymentId: cc.id,
    paymentNumber: cc.paymentNumber,
    receiptNumber: result.receiptNumber,
    allocatedFees: result.allocatedFees,
    allocatedInterest: result.allocatedInterest,
    allocatedPrincipal: result.allocatedPrincipal,
    unallocated: result.unallocated,
    loanClosed: result.loanClosed,
  })
})
