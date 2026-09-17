// GET /api/candidate/loans — list candidate's own loans
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
    include: {
      schedule: { orderBy: { installmentNumber: 'asc' } },
      disbursements: { orderBy: { initiatedAt: 'desc' }, take: 5 },
      _count: { select: { payments: true } },
    },
  })

  return success({
    items: loans.map((l) => ({
      id: l.id,
      loanNumber: l.loanNumber,
      principalAmount: String(l.principalAmount),
      interestType: l.interestType,
      interestRate: l.interestRate,
      fixedInterest: l.fixedInterest ? String(l.fixedInterest) : null,
      frequency: l.frequency,
      installments: l.installments,
      installmentAmount: String(l.installmentAmount),
      totalRepayable: String(l.totalRepayable),
      outstandingPrincipal: String(l.outstandingPrincipal),
      outstandingInterest: String(l.outstandingInterest),
      outstandingFees: String(l.outstandingFees),
      totalCollected: String(l.totalCollected),
      firstDueDate: l.firstDueDate,
      finalDueDate: l.finalDueDate,
      status: l.status,
      disbursedAt: l.disbursedAt,
      closedAt: l.closedAt,
      createdAt: l.createdAt,
      paidInstallments: l.schedule.filter((s) => s.status === 'PAID').length,
      overdueInstallments: l.schedule.filter((s) => s.status === 'OVERDUE').length,
      nextDue: l.schedule.find((s) => s.status !== 'PAID' && s.status !== 'UPCOMING') ?? l.schedule.find((s) => s.status === 'UPCOMING') ?? null,
    })),
  })
})
