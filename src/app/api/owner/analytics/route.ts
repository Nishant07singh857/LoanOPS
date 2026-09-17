// GET /api/owner/analytics — chart data: disbursementTrend, collectionTrend, etc.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const orgId = ctx.user.organizationId
  const url = new URL(req.url)
  const trend = url.searchParams.get('trend') || 'monthly'

  // Build last 6 month buckets
  const now = new Date()
  const buckets: { label: string; start: Date; end: Date }[] = []
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const label = start.toLocaleString('en-IN', { month: 'short' })
    buckets.push({ label, start, end })
  }

  // Disbursement + collection trend
  const disbursementTrend: { label: string; value: number }[] = []
  const collectionTrend: { label: string; value: number }[] = []
  const outstandingTrend: { label: string; value: number }[] = []
  const overdueTrend: { label: string; value: number }[] = []

  for (const b of buckets) {
    // Disbursed in this month
    const disbursed = await db.loan.aggregate({
      where: {
        organizationId: orgId,
        disbursedAt: { gte: b.start, lt: b.end },
      },
      _sum: { principalAmount: true },
    })
    disbursementTrend.push({ label: b.label, value: disbursed._sum.principalAmount ?? 0 })

    // Collected (payments allocated) in this month
    const collected = await db.payment.aggregate({
      where: {
        organizationId: orgId,
        status: 'ALLOCATED',
        allocatedAt: { gte: b.start, lt: b.end },
      },
      _sum: { amount: true },
    })
    collectionTrend.push({ label: b.label, value: collected._sum.amount ?? 0 })

    // Outstanding at end of month (sum of outstandingPrincipal of loans that existed by then)
    const outstandingLoans = await db.loan.findMany({
      where: {
        organizationId: orgId,
        disbursedAt: { lt: b.end },
        status: { in: ['ACTIVE', 'CLOSED'] },
      },
      select: { outstandingPrincipal: true },
    })
    outstandingTrend.push({ label: b.label, value: outstandingLoans.reduce((s, l) => s + l.outstandingPrincipal, 0) })

    // Overdue at end of month (sum of overdue installments where due date < end of bucket)
    const overdueInsts = await db.installment.aggregate({
      where: {
        dueDate: { lt: b.end },
        status: 'OVERDUE',
        loan: { organizationId: orgId },
      },
      _sum: { totalDue: true, paidAmount: true },
    })
    overdueTrend.push({
      label: b.label,
      value: Math.max(0, (overdueInsts._sum.totalDue ?? 0) - (overdueInsts._sum.paidAmount ?? 0)),
    })
  }

  // Repayment frequency distribution
  const freqDist = await db.loan.groupBy({
    by: ['frequency'],
    where: { organizationId: orgId },
    _count: true,
  })

  // Collection by method
  const methodAgg = await db.payment.groupBy({
    by: ['method'],
    where: { organizationId: orgId, status: 'ALLOCATED' },
    _sum: { amount: true },
    _count: true,
  })

  // Agent workload
  const agents = await db.agentProfile.findMany({
    where: { organizationId: orgId },
    include: {
      user: { select: { name: true } },
      _count: {
        select: {
          tasks: { where: { status: { in: ['OPEN', 'ASSIGNED'] } } } as any,
        },
      },
    },
  })

  // PTP fulfillment
  const ptpFulfillment = await db.ptp.groupBy({
    by: ['status'],
    where: { agent: { organizationId: orgId } },
    _count: true,
  })

  return success({
    trend,
    disbursementTrend,
    collectionTrend,
    outstandingTrend,
    overdueTrend,
    repaymentFrequency: freqDist.map((f) => ({ frequency: f.frequency, count: f._count })),
    collectionByMethod: methodAgg.map((m) => ({
      method: m.method,
      amount: String(m._sum.amount ?? 0),
      count: m._count,
    })),
    agentWorkload: agents.map((a) => ({
      id: a.id,
      name: a.user.name,
      zone: a.zone,
      activeTasks: (a._count as any).tasks ?? 0,
      assignedCandidates: 0, // filled below
    })),
    ptpFulfillment: ptpFulfillment.map((p) => ({ status: p.status, count: p._count })),
  })
})
