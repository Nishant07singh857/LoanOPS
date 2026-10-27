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

  // Outstanding loans fetched once: the per-bucket queries differ only in
  // the disbursedAt cutoff, so one fetch with the largest cutoff (the last
  // bucket's end) is a superset of every bucket's result set.
  const outstandingLoansAll = await db.loan.findMany({
    where: { organizationId: orgId, disbursedAt: { lt: buckets[buckets.length - 1].end }, status: { in: ['ACTIVE', 'CLOSED'] } },
    select: { disbursedAt: true, outstandingPrincipal: true },
  })

  // Process buckets in parallel
  const bucketResults = await Promise.all(buckets.map(async (b) => {
    const [disbursed, collected, overdueInsts] = await Promise.all([
      db.loan.aggregate({
        where: { organizationId: orgId, disbursedAt: { gte: b.start, lt: b.end } },
        _sum: { principalAmount: true },
      }),
      db.payment.aggregate({
        where: { organizationId: orgId, status: 'ALLOCATED', allocatedAt: { gte: b.start, lt: b.end } },
        _sum: { amount: true },
      }),
      db.installment.aggregate({
        where: { dueDate: { lt: b.end }, status: 'OVERDUE', loan: { organizationId: orgId } },
        _sum: { totalDue: true, paidAmount: true },
      })
    ])

    return {
      disbursement: { label: b.label, value: disbursed._sum.principalAmount ?? 0 },
      collection: { label: b.label, value: collected._sum.amount ?? 0 },
      outstanding: { label: b.label, value: outstandingLoansAll.reduce((s, l) => s + (l.disbursedAt !== null && l.disbursedAt.getTime() < b.end.getTime() ? l.outstandingPrincipal : 0), 0) },
      overdue: { label: b.label, value: Math.max(0, (overdueInsts._sum.totalDue ?? 0) - (overdueInsts._sum.paidAmount ?? 0)) }
    }
  }))

  for (const res of bucketResults) {
    disbursementTrend.push(res.disbursement)
    collectionTrend.push(res.collection)
    outstandingTrend.push(res.outstanding)
    overdueTrend.push(res.overdue)
  }

  // The five trailing queries are mutually independent, so run them in parallel.
  const [freqDist, methodAgg, agents, ptpFulfillment, overdueInstallments] = await Promise.all([
    // Repayment frequency distribution
    db.loan.groupBy({
      by: ['frequency'],
      where: { organizationId: orgId },
      _count: true,
    }),

    // Collection by method
    db.payment.groupBy({
      by: ['method'],
      where: { organizationId: orgId, status: 'ALLOCATED' },
      _sum: { amount: true },
      _count: true,
    }),

    // Agent workload
    db.agentProfile.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { name: true } },
        _count: {
          select: {
            tasks: { where: { status: { in: ['OPEN', 'ASSIGNED'] } } } as any,
            candidates: { where: { status: 'ACTIVE' } } as any,
          },
        },
      },
    }),

    // PTP fulfillment
    db.ptp.groupBy({
      by: ['status'],
      where: { agent: { organizationId: orgId } },
      _count: true,
    }),

    // Overdue aging (real buckets): open OVERDUE installments grouped by
    // days past due; amount is the outstanding paise (totalDue - paidAmount).
    // The dashboard's aging chart consumes exactly this shape — it previously
    // rendered a hardcoded all-zero array.
    db.installment.findMany({
      where: { status: 'OVERDUE', loan: { organizationId: orgId } },
      select: { dueDate: true, totalDue: true, paidAmount: true },
    }),
  ])
  const overdueAging = [
    { bucket: '1-7 days', count: 0, amount: 0 },
    { bucket: '8-15 days', count: 0, amount: 0 },
    { bucket: '16-30 days', count: 0, amount: 0 },
    { bucket: '31-60 days', count: 0, amount: 0 },
    { bucket: '60+ days', count: 0, amount: 0 },
  ]
  for (const inst of overdueInstallments) {
    const days = Math.floor((now.getTime() - inst.dueDate.getTime()) / 86400000)
    const idx = days <= 7 ? 0 : days <= 15 ? 1 : days <= 30 ? 2 : days <= 60 ? 3 : 4
    overdueAging[idx].count += 1
    overdueAging[idx].amount += Math.max(0, inst.totalDue - inst.paidAmount)
  }

  return success({
    trend,
    disbursementTrend,
    collectionTrend,
    outstandingTrend,
    overdueTrend,
    overdueAging,
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
      assignedCandidates: (a._count as any).candidates ?? 0,
    })),
    ptpFulfillment: ptpFulfillment.map((p) => ({ status: p.status, count: p._count })),
  })
})
