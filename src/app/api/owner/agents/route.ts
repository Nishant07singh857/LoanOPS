// GET /api/owner/agents — list agents + compute performance from real tasks/PTP/collections
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const orgId = ctx.user.organizationId

  const agents = await db.agentProfile.findMany({
    where: { organizationId: orgId },
    include: {
      user: { select: { id: true, name: true, phone: true, email: true } },
      candidates: { where: { status: 'ACTIVE' } },
    },
  })

  const items = await Promise.all(agents.map(async (a) => {
    const [tasksAssigned, tasksCompleted, followUps, ptpCreated, ptpFulfilled, ptpBroken, collectionAmount, outstandingAssigned] = await Promise.all([
      db.collectionTask.count({ where: { assignedToId: a.id } }),
      db.collectionTask.count({ where: { assignedToId: a.id, status: { in: ['RESOLVED', 'CLOSED'] } } }),
      db.followUp.count({ where: { agentId: a.user.id } }),
      db.ptp.count({ where: { agentId: a.user.id } }),
      db.ptp.count({ where: { agentId: a.user.id, status: 'FULFILLED' } }),
      db.ptp.count({ where: { agentId: a.user.id, status: 'BROKEN' } }),
      db.cashCollection.aggregate({
        where: { recordedById: a.user.id, status: 'ALLOCATED' },
        _sum: { amount: true },
      }),
      db.loan.aggregate({
        where: { candidate: { assignedAgentId: a.id }, status: 'ACTIVE' },
        _sum: { outstandingPrincipal: true },
      }),
    ])
    const successRate = tasksAssigned > 0 ? (tasksCompleted / tasksAssigned) * 100 : 0
    return {
      id: a.id,
      userId: a.user.id,
      name: a.user.name,
      email: a.user.email,
      phone: a.user.phone,
      employeeCode: a.employeeCode,
      zone: a.zone,
      isActive: a.isActive,
      tasksAssigned,
      tasksCompleted,
      followUps,
      ptpCreated,
      ptpFulfilled,
      ptpBroken,
      collectionAmount: String(collectionAmount._sum.amount ?? 0),
      outstandingAssigned: String(outstandingAssigned._sum.outstandingPrincipal ?? 0),
      assignedCandidatesCount: a.candidates.length,
      successRate: Number(successRate.toFixed(1)),
    }
  }))

  return success({ items })
})
