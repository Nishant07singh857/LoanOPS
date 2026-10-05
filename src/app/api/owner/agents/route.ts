// GET /api/owner/agents — list agents + compute performance from real tasks/PTP/collections
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { apiHandler, success, validate } from '@/lib/server/api'
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
      db.payment.aggregate({
        where: { recordedById: a.user.id, status: 'ALLOCATED', method: 'CASH' },
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

const createAgentSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone'),
  password: z.string().min(10),
  employeeCode: z.string().min(2),
  zone: z.string().min(2),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const body = await req.json().catch(() => ({}))
  const input = validate(createAgentSchema, body)

  const passwordHash = await bcrypt.hash(input.password, 12)

  const newAgent = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organizationId: ctx.user.organizationId,
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        phone: input.phone,
        role: 'AGENT',
      },
    })
    const agent = await tx.agentProfile.create({
      data: {
        userId: user.id,
        organizationId: ctx.user.organizationId,
        employeeCode: input.employeeCode,
        zone: input.zone,
        isActive: true,
      },
    })
    return { user, agent }
  })

  return success({ id: newAgent.agent.id, userId: newAgent.user.id })
})
