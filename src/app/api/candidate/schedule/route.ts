// GET /api/candidate/schedule — fetch the candidate's active loan's installment schedule
// Returns installment list + summary stats (paid / upcoming / overdue / total)
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireCandidate } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  // Find the primary active loan; fallback to most-recent loan
  let loan = await db.loan.findFirst({
    where: { candidateId: ctx.user.candidateId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: { schedule: { orderBy: { installmentNumber: 'asc' } } },
  })

  if (!loan) {
    loan = await db.loan.findFirst({
      where: { candidateId: ctx.user.candidateId },
      orderBy: { createdAt: 'desc' },
      include: { schedule: { orderBy: { installmentNumber: 'asc' } } },
    })
  }
  if (!loan) return notFound('No loans found for your account')

  const schedule = loan.schedule
  const paid = schedule.filter((s) => s.status === 'PAID').length
  const overdue = schedule.filter((s) => s.status === 'OVERDUE').length
  const due = schedule.filter((s) => s.status === 'DUE').length
  const upcoming = schedule.filter((s) => s.status === 'UPCOMING').length
  const partiallyPaid = schedule.filter((s) => s.status === 'PARTIALLY_PAID').length
  const totalPaidAmount = schedule.reduce((s, i) => s + i.paidAmount, 0)
  const totalDueAmount = schedule.reduce((s, i) => s + i.totalDue, 0)
  const nextDue = schedule.find((s) => s.status === 'DUE' || s.status === 'OVERDUE' || s.status === 'PARTIALLY_PAID')
    ?? schedule.find((s) => s.status === 'UPCOMING')
    ?? null

  return success({
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    status: loan.status,
    installmentAmount: String(loan.installmentAmount),
    totalRepayable: String(loan.totalRepayable),
    outstandingPrincipal: String(loan.outstandingPrincipal),
    outstandingInterest: String(loan.outstandingInterest),
    outstandingFees: String(loan.outstandingFees),
    installments: schedule.map((s) => ({
      id: s.id,
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
    })),
    summary: {
      total: schedule.length,
      paid,
      overdue,
      due,
      upcoming,
      partiallyPaid,
      progressPercent: schedule.length > 0 ? Math.round((paid / schedule.length) * 1000) / 10 : 0,
      totalPaidAmount: String(totalPaidAmount),
      totalDueAmount: String(totalDueAmount),
      outstandingAmount: String(Math.max(0, totalDueAmount - totalPaidAmount)),
    },
    nextDue: nextDue ? {
      id: nextDue.id,
      installmentNumber: nextDue.installmentNumber,
      dueDate: nextDue.dueDate,
      totalDue: String(nextDue.totalDue),
      paidAmount: String(nextDue.paidAmount),
      status: nextDue.status,
    } : null,
  })
})
