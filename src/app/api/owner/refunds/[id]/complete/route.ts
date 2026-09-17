// POST /api/owner/refunds/[id]/complete — mark refund as COMPLETED
// Posts reversal ledger entry, reverses the original payment's allocation against the loan's installments
// (subtract from paidFees/paidInterest/paidPrincipal, recompute installment status), updates loan totals
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound, conflict, badRequest } from '@/lib/server/api'
import { postReversal, ACCOUNTS } from '@/lib/server/ledger'

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params

  const refund = await db.refund.findFirst({
    where: { id, loan: { organizationId: ctx.user.organizationId } },
    include: { loan: { include: { schedule: { orderBy: { installmentNumber: 'asc' } } } } },
  })
  if (!refund) return notFound('Refund not found')
  if (refund.status === 'COMPLETED') return conflict('Refund already completed')

  // Find the original payment (most recent ALLOCATED payment on this loan)
  const originalPayment = await db.payment.findFirst({
    where: { loanId: refund.loanId, status: 'ALLOCATED' },
    orderBy: { allocatedAt: 'desc' },
  })
  if (!originalPayment) return badRequest('No allocated payment to refund against')

  await db.$transaction(async (tx) => {
    // Mark refund as COMPLETED
    await tx.refund.update({
      where: { id: refund.id },
      data: { status: 'COMPLETED', processedAt: new Date() },
    })

    // Reverse the allocation against installments (in reverse chronological order — last paid first)
    const refundAmountPaise = BigInt(refund.amount)
    let remaining = refundAmountPaise
    const schedule = [...refund.loan.schedule].reverse() // newest first

    for (const inst of schedule) {
      if (remaining <= BigInt(0)) break
      const paidFees = BigInt(inst.paidFees)
      const paidInterest = BigInt(inst.paidInterest)
      const paidPrincipal = BigInt(inst.paidPrincipal)
      const paidAmount = paidFees + paidInterest + paidPrincipal

      if (paidAmount <= BigInt(0)) continue

      // Reverse in same order: fees → interest → principal
      const reverseFees = remaining > BigInt(0) ? (remaining > paidFees ? paidFees : remaining) : BigInt(0)
      remaining -= reverseFees
      const reverseInterest = remaining > BigInt(0) ? (remaining > paidInterest ? paidInterest : remaining) : BigInt(0)
      remaining -= reverseInterest
      const reversePrincipal = remaining > BigInt(0) ? (remaining > paidPrincipal ? paidPrincipal : remaining) : BigInt(0)
      remaining -= reversePrincipal

      const newPaidFees = paidFees - reverseFees
      const newPaidInterest = paidInterest - reverseInterest
      const newPaidPrincipal = paidPrincipal - reversePrincipal
      const newPaidAmount = newPaidFees + newPaidInterest + newPaidPrincipal

      const totalDue = BigInt(inst.feesComponent) + BigInt(inst.interestComponent) + BigInt(inst.principalComponent)
      const fullyPaid = newPaidFees >= BigInt(inst.feesComponent) && newPaidInterest >= BigInt(inst.interestComponent) && newPaidPrincipal >= BigInt(inst.principalComponent)
      const partiallyPaid = newPaidAmount > BigInt(0) && !fullyPaid
      const newStatus = fullyPaid ? 'PAID' : partiallyPaid ? 'PARTIALLY_PAID' : (new Date(inst.dueDate) <= new Date() ? 'DUE' : 'UPCOMING')

      await tx.installment.update({
        where: { id: inst.id },
        data: {
          paidFees: Number(newPaidFees),
          paidInterest: Number(newPaidInterest),
          paidPrincipal: Number(newPaidPrincipal),
          paidAmount: Number(newPaidAmount),
          status: newStatus as any,
          paidAt: fullyPaid ? inst.paidAt : null,
        },
      })
    }

    // Update loan totals — add back the refunded amount to outstanding
    await tx.loan.update({
      where: { id: refund.loanId },
      data: {
        outstandingPrincipal: { increment: Number(refundAmountPaise - remaining) },
        totalCollected: { decrement: Number(refundAmountPaise - remaining) },
      },
    })

    // Mark the original payment as REJECTED (refund supersedes it)
    await tx.payment.update({
      where: { id: originalPayment.id },
      data: { status: 'REJECTED' },
    })

    // Notify candidate
    if (refund.loan.candidateId) {
      const candidate = await db.candidate.findUnique({ where: { id: refund.loan.candidateId } })
      if (candidate?.userId) {
        await tx.notification.create({
          data: {
            organizationId: ctx.user.organizationId,
            userId: candidate.userId,
            candidateId: candidate.id,
            type: 'PAYMENT_CONFIRMATION',
            title: 'Refund processed',
            message: `Refund of ₹${refund.amount / 100} for loan ${refund.loan.loanNumber} has been processed.`,
            isRead: false,
            metadata: { refundId: refund.id, loanId: refund.loanId },
          },
        })
      }
    }
  })

  // Post reversal ledger entries — one per original allocation type
  if (originalPayment.allocatedFees > 0) {
    await postReversal({
      organizationId: ctx.user.organizationId,
      loanId: refund.loanId,
      paymentId: originalPayment.id,
      originalEntryNumber: `PAYMENT_FEES-${originalPayment.paymentNumber}`,
      reason: `Refund ${refund.id}`,
      amount: BigInt(originalPayment.allocatedFees),
      debitAccount: ACCOUNTS.FEE_INCOME,
      creditAccount: ACCOUNTS.BANK,
    })
  }
  if (originalPayment.allocatedInterest > 0) {
    await postReversal({
      organizationId: ctx.user.organizationId,
      loanId: refund.loanId,
      paymentId: originalPayment.id,
      originalEntryNumber: `PAYMENT_INTEREST-${originalPayment.paymentNumber}`,
      reason: `Refund ${refund.id}`,
      amount: BigInt(originalPayment.allocatedInterest),
      debitAccount: ACCOUNTS.INTEREST_INCOME,
      creditAccount: ACCOUNTS.BANK,
    })
  }
  if (originalPayment.allocatedPrincipal > 0) {
    await postReversal({
      organizationId: ctx.user.organizationId,
      loanId: refund.loanId,
      paymentId: originalPayment.id,
      originalEntryNumber: `PAYMENT_PRINCIPAL-${originalPayment.paymentNumber}`,
      reason: `Refund ${refund.id}`,
      amount: BigInt(originalPayment.allocatedPrincipal),
      debitAccount: ACCOUNTS.LOANS_RECEIVABLE,
      creditAccount: ACCOUNTS.BANK,
    })
  }

  await audit(ctx, 'REFUND', 'Refund', refund.id, `Refund ₹${refund.amount / 100} completed for loan ${refund.loan.loanNumber}`)

  return success({ id: refund.id, status: 'COMPLETED', processedAt: new Date() })
})
