// POST /api/owner/support/[id]/resolve — mark support ticket as RESOLVED with optional resolution notes
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validate } from '@/lib/server/api'

const schema = z.object({
  resolution: z.string().trim().min(1).max(2000).optional(),
}).strict()

export const POST = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data = validate(schema, body)

  const ticket = await db.supportTicket.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: { candidate: { select: { fullName: true } } },
  })
  if (!ticket) return notFound('Ticket not found')

  const updated = await db.supportTicket.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolution: data.resolution ?? ticket.resolution ?? 'Resolved by owner',
    },
  })

  await audit(
    ctx,
    'UPDATE',
    'SupportTicket',
    updated.id,
    `Resolved support ticket ${updated.ticketNumber} (${ticket.candidate?.fullName ?? 'unknown'})`
  )

  return success({
    id: updated.id,
    ticketNumber: updated.ticketNumber,
    status: updated.status,
    resolution: updated.resolution,
  })
})
