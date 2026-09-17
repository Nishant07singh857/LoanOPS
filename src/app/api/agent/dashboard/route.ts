// GET /api/agent/dashboard — returns agent's operational view
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAgent } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const agentProfile = await db.agentProfile.findUnique({
    where: { userId: ctx.user.id },
  })
  if (!agentProfile) return notFound('Agent profile not found')

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

  // Tasks assigned to me
  const tasks = await db.collectionTask.findMany({
    where: {
      assignedToId: agentProfile.id,
      status: { in: ['OPEN', 'ASSIGNED'] },
    },
    include: {
      candidate: { select: { fullName: true, mobile: true } },
      loan: { select: { loanNumber: true, installmentAmount: true } },
    },
    orderBy: { dueDate: 'asc' },
  })
  const todaysTasks = tasks.filter((t) => {
    const dd = new Date(t.dueDate)
    return dd >= startOfToday && dd < endOfToday
  })

  // Follow-ups where nextFollowUp is today
  const followUps = await db.followUp.findMany({
    where: {
      agentId: ctx.user.id,
      nextFollowUp: { gte: startOfToday, lt: endOfToday },
    },
    include: { candidate: { select: { fullName: true, mobile: true } } },
    orderBy: { nextFollowUp: 'asc' },
  })

  // PTP due today (or earlier) and ACTIVE
  const ptps = await db.ptp.findMany({
    where: {
      agentId: ctx.user.id,
      status: 'ACTIVE',
      promiseDate: { lt: endOfToday },
    },
    include: { candidate: { select: { fullName: true, mobile: true } }, loan: { select: { loanNumber: true } } },
    orderBy: { promiseDate: 'asc' },
  })

  // Candidates assigned to me with overdue installments
  const myCandidates = await db.candidate.findMany({
    where: { assignedAgentId: agentProfile.id, status: 'ACTIVE' },
    include: {
      loans: {
        where: { status: 'ACTIVE' },
        include: { schedule: { where: { status: 'OVERDUE' } } },
      },
    },
  })
  const overdueCandidates = myCandidates
    .filter((c) => c.loans.some((l) => l.schedule.length > 0))
    .map((c) => ({
      id: c.id,
      fullName: c.fullName,
      mobile: c.mobile,
      overdueInstallments: c.loans.reduce((s, l) => s + l.schedule.length, 0),
      loanNumbers: c.loans.map((l) => l.loanNumber),
    }))

  // Pending cash verifications (recorded by me, awaiting owner verify)
  const pendingCash = await db.cashCollection.findMany({
    where: {
      recordedById: ctx.user.id,
      status: 'PENDING_VERIFICATION',
    },
    include: { candidate: { select: { fullName: true, mobile: true } }, loan: { select: { loanNumber: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return success({
    agent: {
      id: agentProfile.id,
      name: ctx.user.name,
      employeeCode: agentProfile.employeeCode,
      zone: agentProfile.zone,
    },
    todayTasksCount: todaysTasks.length,
    todayFollowUpsCount: followUps.length,
    ptpDueCount: ptps.length,
    overdueCandidatesCount: overdueCandidates.length,
    pendingCashVerificationsCount: pendingCash.length,
    todaysTasks: todaysTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      amount: t.amount ? String(t.amount) : null,
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
      candidate: {
        id: t.candidate.id,
        fullName: t.candidate.fullName,
        mobile: t.candidate.mobile,
      },
      loan: t.loan ? {
        id: t.loan.id,
        loanNumber: t.loan.loanNumber,
      } : null,
    })),
    todaysFollowUps: followUps.map((f) => ({
      id: f.id,
      contactMethod: f.contactMethod,
      outcome: f.outcome,
      notes: f.notes,
      nextFollowUp: f.nextFollowUp,
      candidate: {
        id: f.candidate.id,
        fullName: f.candidate.fullName,
        mobile: f.candidate.mobile,
      },
    })),
    ptpDue: ptps.map((p) => ({
      id: p.id,
      promisedAmount: String(p.promisedAmount),
      promiseDate: p.promiseDate,
      notes: p.notes,
      candidate: {
        id: p.candidate.id,
        fullName: p.candidate.fullName,
        mobile: p.candidate.mobile,
      },
      loan: { id: p.loan.id, loanNumber: p.loan.loanNumber },
    })),
    overdueCandidates: overdueCandidates.slice(0, 20),
    pendingCashVerifications: pendingCash.map((c) => ({
      id: c.id,
      amount: String(c.amount),
      collectionDate: c.collectionDate,
      collectionTime: c.collectionTime,
      reference: c.reference,
      notes: c.notes,
      candidate: {
        id: c.candidate.id,
        fullName: c.candidate.fullName,
        mobile: c.candidate.mobile,
      },
      loan: { id: c.loan.id, loanNumber: c.loan.loanNumber },
    })),
    recentCashCollections: pendingCash.slice(0, 5).map((c) => ({
      id: c.id,
      amount: String(c.amount),
      candidateName: c.candidate.fullName,
      loanNumber: c.loan.loanNumber,
      collectionDate: c.collectionDate,
      status: c.status,
    })),
  })
})
