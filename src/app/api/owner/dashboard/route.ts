// GET /api/owner/dashboard - real KPIs computed from DB
import { NextRequest } from 'next/server'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success } from '@/lib/server/api'
import { db } from '@/lib/db'
import { withCache } from '@/lib/redis'
import { refreshOverdueStatuses } from '@/lib/server/overdue'

async function getDashboardData(orgId: string) {
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
    db.candidate.count({ where: { organizationId: orgId } }),
    db.candidate.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
    db.application.count({ where: { organizationId: orgId } }),
    db.application.count({ where: { organizationId: orgId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    db.application.count({ where: { organizationId: orgId, status: 'APPROVED' } }),
    db.application.count({ where: { organizationId: orgId, status: 'REJECTED' } }),
    db.loan.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
    db.loan.count({ where: { organizationId: orgId, status: 'CLOSED' } }),
    db.loan.count({ where: { organizationId: orgId, status: 'ACTIVE', schedule: { some: { status: 'OVERDUE' } } } }),
    db.loan.aggregate({ where: { organizationId: orgId, status: { in: ['ACTIVE', 'CLOSED'] } }, _sum: { principalAmount: true } }),
    db.loan.aggregate({ where: { organizationId: orgId, status: 'ACTIVE' }, _sum: { outstandingPrincipal: true, outstandingInterest: true } }),
    db.payment.aggregate({ where: { organizationId: orgId, status: 'ALLOCATED' }, _sum: { amount: true } }),
    db.installment.count({
      where: {
        loan: { organizationId: orgId },
        status: 'DUE',
        dueDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lte: new Date(new Date().setHours(23, 59, 59, 999)) },
      },
    }),
    db.installment.count({ where: { loan: { organizationId: orgId }, status: 'OVERDUE' } }),
    db.payment.count({
      where: {
        organizationId: orgId,
        method: 'CASH',
        status: 'PENDING_VERIFICATION',
      },
    }),
    db.ptp.count({ where: { candidate: { organizationId: orgId }, status: 'ACTIVE' } }),
    db.ptp.count({ where: { candidate: { organizationId: orgId }, status: 'BROKEN' } }),
    db.collectionTask.count({ where: { organizationId: orgId, status: { in: ['OPEN', 'ASSIGNED'] } } }),
    db.escalation.count({ where: { candidate: { organizationId: orgId }, status: 'OPEN' } }),
    db.application.count({ where: { organizationId: orgId, status: 'SUBMITTED' } }),
    db.loan.count({ where: { organizationId: orgId, status: 'PENDING_DISBURSEMENT' } }),
  ])

  // Total overdue amount (sum of overdue installment totalDue)
  const overdueAmountAgg = await db.installment.aggregate({
    where: { loan: { organizationId: orgId }, status: 'OVERDUE' },
    _sum: { totalDue: true },
  })

  // Total interest scheduled (sum of all installments' interestComponent)
  const interestScheduledAgg = await db.installment.aggregate({
    where: { loan: { organizationId: orgId } },
    _sum: { interestComponent: true },
  })

  // Collection rate
  const totalCollected = totalCollectedAgg._sum.amount || 0
  const totalDisbursed = totalDisbursedAgg._sum.principalAmount || 0
  const collectionRate = totalDisbursed > 0 ? Math.round((totalCollected / totalDisbursed) * 1000) / 10 : 0

  return {
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
    ptpDueToday: activePtpCount,
    brokenPtp: brokenPtpCount,
    openTasks: openTasksCount,
    openEscalations: openEscalationsCount,
    pendingCashVerification: pendingCashVerificationsCount,
  }
}

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const orgId = ctx.user.organizationId

  // Age this org's installments first so overdue KPIs below are truthful.
  // Best-effort: a sweep failure must not take the dashboard down.
  try {
    await refreshOverdueStatuses(orgId)
  } catch {
    // ignore — the standalone cron (scripts/mark-overdue.ts) is the backstop
  }

  // Cache dashboard data in Redis for 5 minutes (300 seconds)
  const data = await withCache(`dashboard-kpis:${orgId}`, 300, () => getDashboardData(orgId))
  
  return success(data)
})
