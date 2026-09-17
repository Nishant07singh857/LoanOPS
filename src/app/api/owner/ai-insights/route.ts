// GET /api/owner/ai-insights — deterministic AI insights from real DB signals (READ-ONLY)
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const orgId = ctx.user.organizationId
  const insights: any[] = []

  // 1. Overdue loans — risk insight
  const overdueLoans = await db.loan.findMany({
    where: { organizationId: orgId, status: 'ACTIVE', schedule: { some: { status: 'OVERDUE' } } },
    include: {
      candidate: { select: { id: true, fullName: true, mobile: true } },
      schedule: { where: { status: 'OVERDUE' }, orderBy: { dueDate: 'asc' } },
    },
  })
  for (const l of overdueLoans) {
    const firstOverdue = l.schedule[0]
    if (!firstOverdue) continue
    const daysOverdue = Math.floor((Date.now() - new Date(firstOverdue.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    const overdueAmount = l.schedule.reduce((s, i) => s + Math.max(0, i.totalDue - i.paidAmount), 0)
    const level = daysOverdue > 30 || overdueAmount > 5000000 ? 'HIGH' : daysOverdue > 7 ? 'MEDIUM' : 'LOW'
    insights.push({
      id: `ins-overdue-${l.id}`,
      signalType: 'OVERDUE',
      level,
      title: `${l.candidate.fullName} is overdue on loan ${l.loanNumber}`,
      candidateId: l.candidateId,
      candidateName: l.candidate.fullName,
      loanId: l.id,
      loanNumber: l.loanNumber,
      reasons: [
        `${daysOverdue} days overdue`,
        `${l.schedule.length} overdue installment(s)`,
        `Overdue amount: ₹${(overdueAmount / 100).toLocaleString('en-IN')}`,
      ],
      suggestedAction: daysOverdue > 30
        ? 'Escalate to senior agent and consider field visit'
        : 'Send WhatsApp reminder and schedule call',
    })
  }

  // 2. Broken PTPs — broken promise insight
  const brokenPtps = await db.ptp.findMany({
    where: { status: 'BROKEN', agent: { organizationId: orgId } },
    include: { candidate: { select: { fullName: true } }, loan: { select: { loanNumber: true, outstandingPrincipal: true } } },
  })
  for (const p of brokenPtps) {
    insights.push({
      id: `ins-broken-ptp-${p.id}`,
      signalType: 'BROKEN_PTP',
      level: p.loan.outstandingPrincipal > 5000000 ? 'HIGH' : 'MEDIUM',
      title: `${p.candidate.fullName} has a broken promise-to-pay`,
      candidateId: p.candidateId,
      candidateName: p.candidate.fullName,
      loanId: p.loanId,
      loanNumber: p.loan.loanNumber,
      reasons: [
        `PTP broken on ${new Date(p.promiseDate).toLocaleDateString()}`,
        `Promised ₹${(p.promisedAmount / 100).toLocaleString('en-IN')}`,
        `Outstanding: ₹${(p.loan.outstandingPrincipal / 100).toLocaleString('en-IN')}`,
      ],
      suggestedAction: 'Schedule call + assess willingness to pay',
    })
  }

  // 3. Candidates with 2+ missed installments
  const candidates = await db.candidate.findMany({
    where: { organizationId: orgId, status: 'ACTIVE' },
    include: {
      loans: {
        where: { status: 'ACTIVE' },
        include: { schedule: { where: { status: { in: ['OVERDUE'] } } } },
      },
    },
  })
  for (const c of candidates) {
    const totalOverdueInst = c.loans.reduce((s, l) => s + l.schedule.length, 0)
    if (totalOverdueInst >= 2) {
      insights.push({
        id: `ins-missed-${c.id}`,
        signalType: 'REPEATED_MISSED_INSTALLMENTS',
        level: totalOverdueInst >= 4 ? 'HIGH' : 'MEDIUM',
        title: `${c.fullName} has ${totalOverdueInst} missed installment(s)`,
        candidateId: c.id,
        candidateName: c.fullName,
        reasons: [
          `${totalOverdueInst} installment(s) overdue across ${c.loans.length} loan(s)`,
          `Mobile: ${c.mobile}`,
        ],
        suggestedAction: 'Escalate and consider repayment plan modification',
      })
    }
  }

  // Sort by level: HIGH → MEDIUM → LOW
  const levelOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  insights.sort((a, b) => (levelOrder[a.level as keyof typeof levelOrder] ?? 3) - (levelOrder[b.level as keyof typeof levelOrder] ?? 3))

  return success({
    items: insights,
    total: insights.length,
    highCount: insights.filter((i) => i.level === 'HIGH').length,
    mediumCount: insights.filter((i) => i.level === 'MEDIUM').length,
    lowCount: insights.filter((i) => i.level === 'LOW').length,
  })
})
