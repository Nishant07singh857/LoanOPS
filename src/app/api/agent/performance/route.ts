// GET /api/agent/performance — agent's own performance stats
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAgent } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return notFound('Agent profile not found')

  const [tasksAssigned, tasksCompleted, followUpsCount, ptpCreated, ptpFulfilled, ptpBroken, cashCollections, cashAmount, outstandingAssigned, assignedCandidates] = await Promise.all([
    db.collectionTask.count({ where: { assignedToId: agentProfile.id } }),
    db.collectionTask.count({ where: { assignedToId: agentProfile.id, status: { in: ['RESOLVED', 'CLOSED'] } } }),
    db.followUp.count({ where: { agentId: ctx.user.id } }),
    db.ptp.count({ where: { agentId: ctx.user.id } }),
    db.ptp.count({ where: { agentId: ctx.user.id, status: 'FULFILLED' } }),
    db.ptp.count({ where: { agentId: ctx.user.id, status: 'BROKEN' } }),
    db.cashCollection.count({ where: { recordedById: ctx.user.id } }),
    db.cashCollection.aggregate({
      where: { recordedById: ctx.user.id, status: 'ALLOCATED' },
      _sum: { amount: true },
    }),
    db.loan.aggregate({
      where: { candidate: { assignedAgentId: agentProfile.id }, status: 'ACTIVE' },
      _sum: { outstandingPrincipal: true },
    }),
    db.candidate.count({ where: { assignedAgentId: agentProfile.id, status: 'ACTIVE' } }),
  ])

  const successRate = tasksAssigned > 0 ? (tasksCompleted / tasksAssigned) * 100 : 0
  const ptpFulfillmentRate = ptpCreated > 0 ? (ptpFulfilled / ptpCreated) * 100 : 0

  return success({
    id: agentProfile.id,
    name: ctx.user.name,
    employeeCode: agentProfile.employeeCode,
    zone: agentProfile.zone,
    tasksAssigned,
    tasksCompleted,
    tasksOpen: tasksAssigned - tasksCompleted,
    followUpsCount,
    ptpCreated,
    ptpFulfilled,
    ptpBroken,
    ptpActive: await db.ptp.count({ where: { agentId: ctx.user.id, status: 'ACTIVE' } }),
    ptpFulfillmentRate: Number(ptpFulfillmentRate.toFixed(1)),
    cashCollections,
    cashAmount: String(cashAmount._sum.amount ?? 0),
    outstandingAssigned: String(outstandingAssigned._sum.outstandingPrincipal ?? 0),
    assignedCandidates,
    successRate: Number(successRate.toFixed(1)),
  })
})
