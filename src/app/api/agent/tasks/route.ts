// GET  /api/agent/tasks — list tasks assigned to the agent
// POST /api/agent/tasks — create a new collection task assigned to current agent
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgent, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, notFound, forbidden, validate, paginate, paginationSchema } from '@/lib/server/api'

const listSchema = paginationSchema.extend({
  status: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return notFound('Agent profile not found')

  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status } = validate(listSchema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    organizationId: ctx.user.organizationId,
    assignedToId: agentProfile.id,
    ...(status ? { status: status as any } : {}),
  }
  const [items, total] = await Promise.all([
    db.collectionTask.findMany({
      where,
      skip, take,
      orderBy: { dueDate: 'asc' },
      include: {
        candidate: { select: { id: true, fullName: true, mobile: true } },
        loan: { select: { id: true, loanNumber: true } },
      },
    }),
    db.collectionTask.count({ where }),
  ])

  return success({
    items: items.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      amount: t.amount ? String(t.amount) : null,
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
      outcome: t.outcome,
      notes: t.notes,
      candidate: t.candidate,
      loan: t.loan,
      createdAt: t.createdAt,
    })),
    total, page, pageSize,
  })
})

const createSchema = z.object({
  candidateId: z.string().min(1),
  loanId: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  amount: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional().nullable(),
  dueDate: z.string().min(1).max(40),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  notes: z.string().max(5000).optional().nullable(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return forbidden('Agent profile not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(createSchema, body)

  // Validate candidate belongs to org & is assigned to this agent — or
  // unassigned (pool candidate, e.g. QR self-apply: any agent may work them).
  const candidate = await db.candidate.findFirst({
    where: {
      id: data.candidateId,
      organizationId: ctx.user.organizationId,
    },
  })
  if (!candidate) return notFound('Candidate not found')
  if (candidate.assignedAgentId && candidate.assignedAgentId !== agentProfile.id) {
    return forbidden('You do not have access to this candidate')
  }

  // Validate loan belongs to candidate
  const loan = await db.loan.findFirst({
    where: { id: data.loanId, candidateId: data.candidateId, organizationId: ctx.user.organizationId },
  })
  if (!loan) return notFound('Loan not found for this candidate')

  const task = await db.collectionTask.create({
    data: {
      organizationId: ctx.user.organizationId,
      candidateId: data.candidateId,
      loanId: data.loanId,
      assignedToId: agentProfile.id,
      title: data.title,
      description: data.description ?? null,
      amount: data.amount ? Number(data.amount) : null,
      dueDate: new Date(data.dueDate),
      priority: data.priority as any,
      status: 'ASSIGNED',
      notes: data.notes ?? null,
    },
    include: {
      candidate: { select: { id: true, fullName: true, mobile: true } },
      loan: { select: { id: true, loanNumber: true } },
    },
  })

  await audit(ctx, 'CREATE', 'CollectionTask', task.id, `Created task "${task.title}" for ${candidate.fullName} (${loan.loanNumber})`, {
    candidateId: data.candidateId, loanId: data.loanId,
  })

  return created({
    id: task.id,
    title: task.title,
    description: task.description,
    amount: task.amount ? String(task.amount) : null,
    dueDate: task.dueDate,
    priority: task.priority,
    status: task.status,
    candidate: task.candidate,
    loan: task.loan,
  })
})
