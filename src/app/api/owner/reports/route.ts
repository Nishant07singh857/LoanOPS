// GET /api/owner/reports?type=&from=&to=&agent=&status= — report data
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, badRequest } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const orgId = ctx.user.organizationId
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'loans'
  const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : null
  const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')!) : null
  const agent = url.searchParams.get('agent') || null
  const status = url.searchParams.get('status') || null

  // Compute common date filter
  const dateFilter = (field: string) => {
    const f: any = {}
    if (from) f.gte = from
    if (to) f.lt = new Date(to.getTime() + 24 * 60 * 60 * 1000) // inclusive of 'to' day
    return Object.keys(f).length ? { [field]: f } : {}
  }

  if (type === 'loans') {
    const loans = await db.loan.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as any } : {}),
        ...dateFilter('createdAt'),
        ...(agent ? { candidate: { assignedAgentId: agent } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: {
          include: { assignedAgent: { include: { user: { select: { name: true } } } } },
        },
        _count: { select: { payments: true } },
      },
    })
    return success({
      type,
      items: loans.map((l) => ({
        id: l.id,
        loanNumber: l.loanNumber,
        candidateName: l.candidate.fullName,
        principalAmount: String(l.principalAmount),
        outstandingPrincipal: String(l.outstandingPrincipal),
        totalCollected: String(l.totalCollected),
        status: l.status,
        frequency: l.frequency,
        installments: l.installments,
        agent: l.candidate.assignedAgent?.user.name ?? null,
        disbursedAt: l.disbursedAt,
        createdAt: l.createdAt,
        paymentsCount: l._count.payments,
      })),
      total: loans.length,
      totalDisbursed: String(loans.reduce((s, l) => s + l.principalAmount, 0)),
      totalOutstanding: String(loans.reduce((s, l) => s + l.outstandingPrincipal, 0)),
    })
  }

  if (type === 'payments') {
    const payments = await db.payment.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as any } : {}),
        ...dateFilter('createdAt'),
        ...(agent ? { loan: { candidate: { assignedAgentId: agent } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        loan: { select: { loanNumber: true } },
        candidate: { select: { fullName: true, mobile: true } },
      },
    })
    return success({
      type,
      items: payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        amount: String(p.amount),
        method: p.method,
        status: p.status,
        receiptNumber: p.receiptNumber,
        allocatedPrincipal: String(p.allocatedPrincipal),
        allocatedInterest: String(p.allocatedInterest),
        allocatedFees: String(p.allocatedFees),
        loanNumber: p.loan.loanNumber,
        candidateName: p.candidate.fullName,
        candidateMobile: p.candidate.mobile,
        createdAt: p.createdAt,
        allocatedAt: p.allocatedAt,
      })),
      total: payments.length,
      totalAmount: String(payments.reduce((s, p) => s + p.amount, 0)),
    })
  }

  if (type === 'collections') {
    const ccs = await db.cashCollection.findMany({
      where: {
        loan: { organizationId: orgId },
        ...(status ? { status: status as any } : {}),
        ...dateFilter('createdAt'),
        ...(agent ? { recordedById: agent } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        loan: { select: { loanNumber: true } },
        candidate: { select: { fullName: true, mobile: true } },
        recordedBy: { select: { name: true } },
      },
    })
    return success({
      type,
      items: ccs.map((c) => ({
        id: c.id,
        amount: String(c.amount),
        collectionDate: c.collectionDate,
        collectionTime: c.collectionTime,
        status: c.status,
        reference: c.reference,
        recordedBy: c.recordedBy.name,
        loanNumber: c.loan.loanNumber,
        candidateName: c.candidate.fullName,
        candidateMobile: c.candidate.mobile,
      })),
      total: ccs.length,
      totalAmount: String(ccs.reduce((s, c) => s + c.amount, 0)),
    })
  }

  if (type === 'applications') {
    const apps = await db.application.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as any } : {}),
        ...dateFilter('createdAt'),
        ...(agent ? { candidate: { assignedAgentId: agent } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { candidate: { select: { fullName: true, mobile: true } } },
    })
    return success({
      type,
      items: apps.map((a) => ({
        id: a.id,
        applicationNumber: a.applicationNumber,
        candidateName: a.candidate.fullName,
        candidateMobile: a.candidate.mobile,
        principalAmount: String(a.principalAmount),
        purpose: a.purpose,
        status: a.status,
        submittedAt: a.submittedAt,
        createdAt: a.createdAt,
      })),
      total: apps.length,
      totalPrincipal: String(apps.reduce((s, a) => s + a.principalAmount, 0)),
    })
  }

  if (type === 'ptps') {
    const ptps = await db.ptp.findMany({
      where: {
        agent: { organizationId: orgId },
        ...(status ? { status: status as any } : {}),
        ...dateFilter('createdAt'),
        ...(agent ? { agentId: agent } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { fullName: true, mobile: true } },
        loan: { select: { loanNumber: true } },
      },
    })
    return success({
      type,
      items: ptps.map((p) => ({
        id: p.id,
        promisedAmount: String(p.promisedAmount),
        promiseDate: p.promiseDate,
        status: p.status,
        notes: p.notes,
        candidateName: p.candidate.fullName,
        loanNumber: p.loan.loanNumber,
        createdAt: p.createdAt,
      })),
      total: ptps.length,
      totalPromised: String(ptps.reduce((s, p) => s + p.promisedAmount, 0)),
    })
  }

  if (type === 'ptp') {
    // alias of ptps
    const ptps = await db.ptp.findMany({
      where: {
        agent: { organizationId: orgId },
        ...(status ? { status: status as any } : {}),
        ...dateFilter('createdAt'),
        ...(agent ? { agentId: agent } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { fullName: true, mobile: true } },
        loan: { select: { loanNumber: true } },
      },
    })
    return success({
      type,
      items: ptps.map((p) => ({
        id: p.id,
        promisedAmount: String(p.promisedAmount),
        promiseDate: p.promiseDate,
        status: p.status,
        notes: p.notes,
        candidateName: p.candidate.fullName,
        loanNumber: p.loan.loanNumber,
        createdAt: p.createdAt,
      })),
      total: ptps.length,
      totalPromised: String(ptps.reduce((s, p) => s + p.promisedAmount, 0)),
      fulfilled: ptps.filter((p) => p.status === 'FULFILLED').length,
      broken: ptps.filter((p) => p.status === 'BROKEN').length,
      active: ptps.filter((p) => p.status === 'ACTIVE').length,
    })
  }

  if (type === 'portfolio') {
    const [loans, totalDisbursedAgg, totalCollectedAgg, outstandingAgg] = await Promise.all([
      db.loan.findMany({
        where: {
          organizationId: orgId,
          ...(status ? { status: status as any } : {}),
          ...dateFilter('createdAt'),
          ...(agent ? { candidate: { assignedAgentId: agent } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          candidate: { select: { fullName: true, mobile: true, assignedAgent: { include: { user: { select: { name: true } } } } } },
          _count: { select: { payments: true, schedule: true } },
        },
      }),
      db.loan.aggregate({ where: { organizationId: orgId }, _sum: { principalAmount: true } }),
      db.payment.aggregate({ where: { organizationId: orgId, status: 'ALLOCATED' }, _sum: { amount: true } }),
      db.loan.aggregate({ where: { organizationId: orgId, status: 'ACTIVE' }, _sum: { outstandingPrincipal: true, outstandingInterest: true, outstandingFees: true } }),
    ])
    return success({
      type,
      summary: {
        totalLoans: loans.length,
        activeLoans: loans.filter((l) => l.status === 'ACTIVE').length,
        closedLoans: loans.filter((l) => l.status === 'CLOSED').length,
        defaultedLoans: loans.filter((l) => l.status === 'DEFAULTED').length,
        totalDisbursed: String(totalDisbursedAgg._sum.principalAmount || 0),
        totalCollected: String(totalCollectedAgg._sum.amount || 0),
        outstandingPrincipal: String(outstandingAgg._sum.outstandingPrincipal || 0),
        outstandingInterest: String(outstandingAgg._sum.outstandingInterest || 0),
        outstandingFees: String(outstandingAgg._sum.outstandingFees || 0),
        collectionRate: (totalDisbursedAgg._sum.principalAmount || 0) > 0
          ? Math.round((((totalCollectedAgg._sum.amount || 0) / (totalDisbursedAgg._sum.principalAmount || 0)) * 1000)) / 10
          : 0,
      },
      items: loans.map((l) => ({
        id: l.id,
        loanNumber: l.loanNumber,
        candidateName: l.candidate.fullName,
        candidateMobile: l.candidate.mobile,
        agent: l.candidate.assignedAgent?.user.name ?? null,
        principalAmount: String(l.principalAmount),
        totalRepayable: String(l.totalRepayable),
        outstandingPrincipal: String(l.outstandingPrincipal),
        outstandingInterest: String(l.outstandingInterest),
        totalCollected: String(l.totalCollected),
        status: l.status,
        frequency: l.frequency,
        installments: l.installments,
        paymentsCount: l._count.payments,
        scheduleCount: l._count.schedule,
        disbursedAt: l.disbursedAt,
        createdAt: l.createdAt,
      })),
    })
  }

  if (type === 'overdue') {
    const overdueInstallments = await db.installment.findMany({
      where: {
        status: 'OVERDUE',
        loan: {
          organizationId: orgId,
          ...(agent ? { candidate: { assignedAgentId: agent } } : {}),
          ...(status ? { status: status as any } : {}),
        },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        loan: {
          select: {
            id: true, loanNumber: true,
            candidate: { select: { id: true, fullName: true, mobile: true, assignedAgent: { include: { user: { select: { name: true } } } } } },
          },
        },
      },
    })
    const items = overdueInstallments.map((i) => {
      const daysOverdue = Math.floor((Date.now() - i.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      return {
        id: i.id,
        loanId: i.loanId,
        loanNumber: i.loan.loanNumber,
        candidateId: i.loan.candidate.id,
        candidateName: i.loan.candidate.fullName,
        candidateMobile: i.loan.candidate.mobile,
        agent: i.loan.candidate.assignedAgent?.user.name ?? null,
        installmentNumber: i.installmentNumber,
        dueDate: i.dueDate,
        daysOverdue,
        principalComponent: String(i.principalComponent),
        interestComponent: String(i.interestComponent),
        feesComponent: String(i.feesComponent),
        totalDue: String(i.totalDue),
        paidAmount: String(i.paidAmount),
        outstandingAmount: String(Math.max(0, i.totalDue - i.paidAmount)),
        status: i.status,
      }
    })
    const totalOutstanding = items.reduce((s, i) => s + Number(i.outstandingAmount), 0)
    const aging = {
      d0_7: items.filter((i) => i.daysOverdue <= 7).length,
      d8_30: items.filter((i) => i.daysOverdue > 7 && i.daysOverdue <= 30).length,
      d31_60: items.filter((i) => i.daysOverdue > 30 && i.daysOverdue <= 60).length,
      d61_90: items.filter((i) => i.daysOverdue > 60 && i.daysOverdue <= 90).length,
      d90_plus: items.filter((i) => i.daysOverdue > 90).length,
    }
    return success({
      type,
      items,
      total: items.length,
      totalOutstanding: String(totalOutstanding),
      aging,
    })
  }

  if (type === 'agent_performance') {
    const agents = await db.agentProfile.findMany({
      where: { organizationId: orgId, ...(agent ? { id: agent } : {}) },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        candidates: { select: { id: true } },
        tasks: { select: { id: true, status: true } },
      },
    })
    const items = []
    for (const a of agents) {
      const [tasksCompleted, ptpCreated, ptpFulfilled, ptpBroken, collectionAgg, outstandingAgg] = await Promise.all([
        db.collectionTask.count({ where: { assignedToId: a.id, status: 'RESOLVED' } }),
        db.ptp.count({ where: { agentId: a.user.id } }),
        db.ptp.count({ where: { agentId: a.user.id, status: 'FULFILLED' } }),
        db.ptp.count({ where: { agentId: a.user.id, status: 'BROKEN' } }),
        db.payment.aggregate({
          where: { loan: { candidate: { assignedAgentId: a.id } }, status: 'ALLOCATED' },
          _sum: { amount: true },
        }),
        db.loan.aggregate({
          where: { candidate: { assignedAgentId: a.id }, status: 'ACTIVE' },
          _sum: { outstandingPrincipal: true },
        }),
      ])
      items.push({
        id: a.id,
        name: a.user.name,
        email: a.user.email,
        employeeCode: a.employeeCode,
        zone: a.zone,
        assignedCandidates: a.candidates.length,
        tasksAssigned: a.tasks.length,
        tasksCompleted,
        ptpCreated,
        ptpFulfilled,
        ptpBroken,
        collectionAmount: String(collectionAgg._sum.amount || 0),
        outstandingAssigned: String(outstandingAgg._sum.outstandingPrincipal || 0),
        successRate: ptpCreated > 0 ? Math.round((ptpFulfilled / ptpCreated) * 1000) / 10 : 0,
      })
    }
    return success({
      type,
      items,
      total: items.length,
      totalCollected: String(items.reduce((s, i) => s + Number(i.collectionAmount), 0)),
      totalOutstanding: String(items.reduce((s, i) => s + Number(i.outstandingAssigned), 0)),
    })
  }

  if (type === 'reconciliation') {
    const runs = await db.reconciliationRun.findMany({
      where: { organizationId: orgId, ...dateFilter('createdAt') },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    const exceptions = await db.reconciliationException.findMany({
      where: { organizationId: orgId, resolvedAt: null, ...dateFilter('createdAt') },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return success({
      type,
      runs: runs.map((r) => ({
        id: r.id,
        runNumber: r.runNumber,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        totalExpected: String(r.totalExpected),
        totalCaptured: String(r.totalCaptured),
        totalAllocated: String(r.totalAllocated),
        exceptionsCount: r.exceptionsCount,
        status: r.status,
        createdAt: r.createdAt,
      })),
      exceptions: exceptions.map((e) => ({
        id: e.id,
        type: e.type,
        severity: e.severity,
        description: e.description,
        reference: e.reference,
        resolvedAt: e.resolvedAt,
        createdAt: e.createdAt,
      })),
      runsCount: runs.length,
      openExceptionsCount: exceptions.length,
    })
  }

  if (type === 'audit') {
    const where = {
      organizationId: orgId,
      ...(status ? { action: status as any } : {}),
      ...dateFilter('createdAt'),
      ...(agent ? { userId: agent } : {}),
    }
    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.auditLog.count({ where }),
    ])
    return success({
      type,
      items: items.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        description: a.description,
        metadata: a.metadata,
        ipAddress: a.ipAddress,
        user: a.user ? { name: a.user.name, email: a.user.email } : null,
        createdAt: a.createdAt,
      })),
      total,
    })
  }

  if (type === 'disbursement') {
    const disbursements = await db.disbursement.findMany({
      where: {
        loan: { organizationId: orgId, ...(status ? { status: status as any } : {}) },
        ...dateFilter('initiatedAt'),
      },
      orderBy: { initiatedAt: 'desc' },
      include: {
        loan: { select: { loanNumber: true, candidate: { select: { fullName: true, mobile: true } } } },
        initiatedBy: { select: { name: true, email: true } },
      },
    })
    return success({
      type,
      items: disbursements.map((d) => ({
        id: d.id,
        loanNumber: d.loan.loanNumber,
        candidateName: d.loan.candidate.fullName,
        candidateMobile: d.loan.candidate.mobile,
        method: d.method,
        amount: String(d.amount),
        reference: d.reference,
        notes: d.notes,
        proofUrl: d.proofUrl,
        status: d.status,
        initiatedBy: d.initiatedBy.name,
        initiatedAt: d.initiatedAt,
        completedAt: d.completedAt,
      })),
      total: disbursements.length,
      totalAmount: String(disbursements.reduce((s, d) => s + d.amount, 0)),
      completed: disbursements.filter((d) => d.status === 'COMPLETED').length,
      pending: disbursements.filter((d) => d.status === 'INITIATED').length,
    })
  }

  return badRequest(`Unknown report type: ${type}`)
})
