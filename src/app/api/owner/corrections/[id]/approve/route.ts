// POST /api/owner/corrections/[id]/approve — apply correction
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound, conflict } from '@/lib/server/api'
import { postReversal, ACCOUNTS } from '@/lib/server/ledger'

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const correction = await db.financialCorrection.findFirst({
    where: { id, loan: { organizationId: ctx.user.organizationId } },
    include: { loan: { select: { loanNumber: true } } },
  })
  if (!correction) return notFound('Correction not found')
  if (correction.status === 'APPLIED') return conflict('Correction already applied')

  // Apply: post a reversal ledger entry, mark as APPLIED
  await db.$transaction(async (tx) => {
    await tx.financialCorrection.update({
      where: { id: correction.id },
      data: {
        status: 'APPLIED',
        appliedAt: new Date(),
        reviewedById: ctx.user.id,
        reviewNotes: 'Applied',
      },
    })
  })

  // If linked to a payment, post a reversal entry
  if (correction.paymentId) {
    const originalPayment = await db.payment.findUnique({ where: { id: correction.paymentId } })
    if (originalPayment) {
      if (originalPayment.allocatedPrincipal > 0) {
        await postReversal({
          organizationId: ctx.user.organizationId,
          loanId: correction.loanId,
          paymentId: originalPayment.id,
          originalEntryNumber: `PAYMENT_PRINCIPAL-${originalPayment.paymentNumber}`,
          reason: `Correction ${correction.id}: ${correction.reason}`,
          amount: BigInt(originalPayment.allocatedPrincipal),
          debitAccount: ACCOUNTS.LOANS_RECEIVABLE,
          creditAccount: ACCOUNTS.BANK,
        })
      }
    }
  }

  await audit(ctx, 'CORRECT', 'FinancialCorrection', correction.id, `Applied correction for loan ${correction.loan.loanNumber}: ${correction.reason}`)

  return success({ id: correction.id, status: 'APPLIED' })
})
