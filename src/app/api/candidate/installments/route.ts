// GET /api/candidate/installments — fetch candidate's installments (across all their loans)
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireCandidate } from '@/lib/server/auth'
import { apiHandler, success, badRequest } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  const loans = await db.loan.findMany({
    where: { candidateId: ctx.user.candidateId },
    orderBy: { createdAt: 'desc' },
    include: { schedule: { orderBy: { installmentNumber: 'asc' } } },
  })

  // Flatten all installments across loans
  const items: any[] = []
  for (const l of loans) {
    for (const s of l.schedule) {
      items.push({
        id: s.id,
        loanId: l.id,
        loanNumber: l.loanNumber,
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        openingPrincipal: String(s.openingPrincipal),
        principalComponent: String(s.principalComponent),
        interestComponent: String(s.interestComponent),
        feesComponent: String(s.feesComponent),
        totalDue: String(s.totalDue),
        closingPrincipal: String(s.closingPrincipal),
        paidFees: String(s.paidFees),
        paidInterest: String(s.paidInterest),
        paidPrincipal: String(s.paidPrincipal),
        paidAmount: String(s.paidAmount),
        status: s.status,
        paidAt: s.paidAt,
      })
    }
  }

  return success({ items })
})
