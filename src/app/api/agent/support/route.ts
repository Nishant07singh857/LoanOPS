// POST /api/agent/support — agent raises a support ticket on behalf of an assigned candidate
// GET  /api/agent/support — list support tickets for candidates assigned to this agent
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgent, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, notFound, forbidden, validate, paginate, paginationSchema, genNumber } from '@/lib/server/api'

const listSchema = paginationSchema.extend({
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED']).optional(),
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
    candidate: { assignedAgentId: agentProfile.id },
    ...(status ? { status: status as any } : {}),
  }

  const [items, total] = await Promise.all([
    db.supportTicket.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: { candidate: { select: { id: true, fullName: true, mobile: true } } },
    }),
    db.supportTicket.count({ where }),
  ])

  return success({
    items: items.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      category: t.category,
      subject: t.subject,
      description: t.description,
      status: t.status,
      resolution: t.resolution,
      attachmentUrl: t.attachmentUrl,
      candidate: t.candidate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
    total, page, pageSize,
  })
})

const createSchema = z.object({
  candidateId: z.string().min(1),
  category: z.string().min(1).max(100),
  subject: z.string().min(1).max(300),
  description: z.string().min(1).max(10000),
  attachmentUrl: z.string().max(2000).optional().nullable(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return forbidden('Agent profile not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(createSchema, body)

  // SupportTicket.candidateId is required: the ticket is raised for a
  // candidate assigned to this agent (same assignment check siblings use).
  const candidate = await db.candidate.findFirst({
    where: { id: data.candidateId, organizationId: ctx.user.organizationId },
  })
  if (!candidate) return notFound('Candidate not found')
  if (candidate.assignedAgentId && candidate.assignedAgentId !== agentProfile.id) {
    return forbidden('You do not have access to this candidate')
  }

  const ticketNumber = genNumber('SUP')
  const ticket = await db.supportTicket.create({
    data: {
      organizationId: ctx.user.organizationId,
      candidateId: candidate.id,
      ticketNumber,
      category: data.category,
      subject: data.subject,
      description: data.description,
      attachmentUrl: data.attachmentUrl ?? null,
      status: 'OPEN',
    },
  })

  // Notify owners (same pattern as POST /api/candidate/support)
  const owners = await db.user.findMany({
    where: { organizationId: ctx.user.organizationId, role: 'OWNER', isActive: true },
    select: { id: true }
  })
  if (owners.length > 0) {
    await db.notification.createMany({
      data: owners.map(owner => ({
        organizationId: ctx.user.organizationId,
        userId: owner.id,
        type: 'AI_INSIGHT',
        title: 'New support ticket',
        message: `Ticket ${ticketNumber} for ${candidate.fullName} (via agent ${ctx.user.name}): ${data.subject}`,
        isRead: false,
        metadata: { ticketId: ticket.id, candidateId: candidate.id },
      }))
    })
  }

  await audit(ctx, 'CREATE', 'SupportTicket', ticket.id, `Created support ticket ${ticketNumber} for ${candidate.fullName}: ${data.subject}`)

  return created({
    id: ticket.id,
    ticketNumber,
    subject: ticket.subject,
    status: ticket.status,
  })
})
