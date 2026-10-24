// POST /api/candidate/support — create a support ticket
// GET /api/candidate/support — list candidate's support tickets
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireCandidate, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, validate, genNumber } from '@/lib/server/api'

const schema = z.object({
  category: z.string().min(1).max(100),
  subject: z.string().min(1).max(300),
  description: z.string().min(1).max(10000),
  attachmentUrl: z.string().max(2000).optional().nullable(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(schema, body)

  const ticketNumber = genNumber('SUP')
  const ticket = await db.supportTicket.create({
    data: {
      organizationId: ctx.user.organizationId,
      candidateId: ctx.user.candidateId,
      ticketNumber,
      category: data.category,
      subject: data.subject,
      description: data.description,
      attachmentUrl: data.attachmentUrl ?? null,
      status: 'OPEN',
    },
  })

  // Notify owners
  const owners = await db.user.findMany({
    where: { organizationId: ctx.user.organizationId, role: 'OWNER', isActive: true },
    select: { id: true }
  })
  if (owners.length > 0) {
    await db.notification.createMany({
      data: owners.map(owner => ({
        organizationId: ctx.user.organizationId,
        userId: owner.id,
        type: 'AI_INSIGHT', // Note: maybe should be 'SUPPORT' but keeping it as is to preserve functionality
        title: 'New support ticket',
        message: `Ticket ${ticketNumber} from ${ctx.user.name}: ${data.subject}`,
        isRead: false,
        metadata: { ticketId: ticket.id },
      }))
    })
  }

  await audit(ctx, 'CREATE', 'SupportTicket', ticket.id, `Created support ticket ${ticketNumber}: ${data.subject}`)

  return created({
    id: ticket.id,
    ticketNumber,
    subject: ticket.subject,
    status: ticket.status,
  })
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  const tickets = await db.supportTicket.findMany({
    where: { candidateId: ctx.user.candidateId },
    orderBy: { createdAt: 'desc' },
  })

  return success({
    items: tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      category: t.category,
      subject: t.subject,
      description: t.description,
      status: t.status,
      resolution: t.resolution,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  })
})
