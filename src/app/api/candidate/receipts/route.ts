// GET /api/candidate/receipts — list candidate's receipts
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireCandidate } from '@/lib/server/auth'
import { apiHandler, success, badRequest } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  const payments = await db.payment.findMany({
    where: {
      candidateId: ctx.user.candidateId,
      status: 'ALLOCATED',
      receiptNumber: { not: null },
    },
    orderBy: { allocatedAt: 'desc' },
    include: { loan: { select: { loanNumber: true } } },
  })

  return success({
    items: payments.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber,
      paymentNumber: p.paymentNumber,
      loanId: p.loanId,
      loanNumber: p.loan.loanNumber,
      amount: String(p.amount),
      method: p.method,
      allocatedFees: String(p.allocatedFees),
      allocatedInterest: String(p.allocatedInterest),
      allocatedPrincipal: String(p.allocatedPrincipal),
      allocatedAt: p.allocatedAt,
      reference: p.reference,
    })),
  })
})
