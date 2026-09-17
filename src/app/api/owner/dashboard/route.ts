// GET /api/owner/dashboard — real KPIs computed from DB
import { NextRequest } from 'next/server'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const orgId = ctx.user.organizationId

  // Run aggregations in parallel
  const [
    candidatesCount,
    activeCandidatesCount,
    applicationsCount,
    pendingApplicationsCount,
    approvedApplicationsCount,
    rejectedApplicationsCount,
    activeLoansCount,
    completedLoansCount,
    overdueLoansCount,
    totalDisbursedAgg,
    outstandingAgg,
    totalCollectedAgg,
    paymentsDueTodayCount,
    paymentsOverdueCount,
    pendingCashVerificationsCount,
    activePtpCount,
    brokenPtpCount,
    openTasksCount,
    openEscalationsCount,
    appsAwaitingReviewCount,
    loansReadyForDisbursementCount,
  ] = await Promise.all([
    ctx.db.candidate.count({ where: { organizationId: orgId } }),
    ctx.db.candidate.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
    ctx.db.application.count({ where: { organizationId: orgId } }),
    ctx.db.application.count({ where: { organizationId: orgId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    ctx.db.application.count({ where: { organizationId: orgId, status: 'APPROVED' } }),
    ctx.db.application.count({ where: { organizationId: orgId, status: 'REJECTED' } }),
    ctx.db.loan.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
    ctx.db.loan.count({ where: { organizationId: orgId, status: 'CLOSED' } }),
    ctx.db.loan.count({ where: { organizationId: orgId, status: 'ACTIVE', outstandingPrincipal: { gt: 0 } } }),
    ctx.db.loan.aggregate({ where: { organizationId: orgId, status: { in: ['ACTIVE', 'CLOSED'] } }, _sum: { principalAmount: true } }),
    ctx.db.loan.aggregate({ where: { organizationId: orgId, status: 'ACTIVE' }, _sum: { outstandingPrincipal: true, outstandingInterest: true } }),
    ctx.db.payment.aggregate({ where: { organizationId: orgId, status: 'ALLOCATED' }, _sum: { amount: true } }),
    ctx.db.installment.count({
      where: {
        loan: { organizationId: orgId },
        status: 'DUE',
        dueDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lte: new Date(new Date().setHours(23, 59, 59, 999)) },
      },
    }),
    ctx.db.installment.count({ where: { loan: { organizationId: orgId }, status: 'OVERDUE' } }),
    ctx.db.cashCollection.count({
      where: {
        loan: { organizationId: orgId },
        status: 'PENDING_VERIFICATION',
      },
    }),
    ctx.db.ptp.count({ where: { candidate: { organizationId: orgId }, status: 'ACTIVE' } }),
    ctx.db.ptp.count({ where: { candidate: { organizationId: orgId }, status: 'BROKEN' } }),
    ctx.db.collectionTask.count({ where: { organizationId: orgId, status: { in: ['OPEN', 'ASSIGNED'] } } }),
    ctx.db.escalation.count({ where: { candidate: { organizationId: orgId }, status: 'OPEN' } }),
    ctx.db.application.count({ where: { organizationId: orgId, status: 'SUBMITTED' } }),
    ctx.db.loan.count({ where: { organizationId: orgId, status: 'PENDING_DISBURSEMENT' } }),
  ])

  // Total overdue amount (sum of overdue installment totalDue)
  const overdueAmountAgg = await ctx.db.installment.aggregate({
    where: { loan: { organizationId: orgId }, status: 'OVERDUE' },
    _sum: { totalDue: true },
  })

  // Total interest scheduled (sum of all installments' interestComponent)
  const interestScheduledAgg = await ctx.db.installment.aggregate({
    where: { loan: { organizationId: orgId } },
    _sum: { interestComponent: true },
  })

  // Collection rate
  const totalCollected = totalCollectedAgg._sum.amount || 0
  const totalDisbursed = totalDisbursedAgg._sum.principalAmount || 0
  const collectionRate = totalDisbursed > 0 ? Math.round((totalCollected / totalDisbursed) * 1000) / 10 : 0

  return success({
    totalCandidates: candidatesCount,
    activeCandidates: activeCandidatesCount,
    totalApplications: applicationsCount,
    pendingApplications: pendingApplicationsCount,
    approvedApplications: approvedApplicationsCount,
    rejectedApplications: rejectedApplicationsCount,
    activeLoans: activeLoansCount,
    completedLoans: completedLoansCount,
    overdueLoans: overdueLoansCount,
    totalDisbursed: String(totalDisbursed),
    outstandingPrincipal: String(outstandingAgg._sum.outstandingPrincipal || 0),
    outstandingInterest: String(outstandingAgg._sum.outstandingInterest || 0),
    totalInterestScheduled: String(interestScheduledAgg._sum.interestComponent || 0),
    totalCollected: String(totalCollected),
    totalOverdue: String(overdueAmountAgg._sum.totalDue || 0),
    collectionRate,
    appsWaitingReview: appsAwaitingReviewCount,
    loansReadyForDisbursement: loansReadyForDisbursementCount,
    paymentsDueToday: paymentsDueTodayCount,
    paymentsOverdue: paymentsOverdueCount,
    ptpDueToday: 0, // computed below if needed
    brokenPtp: brokenPtpCount,
    openTasks: openTasksCount,
    openEscalations: openEscalationsCount,
    pendingCashVerification: pendingCashVerificationsCount,
  })
})
