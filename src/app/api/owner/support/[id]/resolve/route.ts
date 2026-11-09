// POST /api/owner/support/[id]/resolve — mark support ticket as RESOLVED with optional resolution notes
// Now a thin wrapper over the shared status walk (D3): RESOLVED is
// reached through SUPPORT_TRANSITIONS, so resolving an OPEN or
// IN_REVIEW ticket behaves exactly as before (note stored, falling
// back to any existing note, then 'Resolved by owner'), and the
// borrower is notified like every other status change. Resolving a
// CLOSED ticket is refused (422) — CLOSED is terminal.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, notFound, unprocessable, validate } from '@/lib/server/api'
import { loadTicketForStaff, changeSupportStatus } from '@/lib/server/support'

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

  const ticket = await loadTicketForStaff(ctx, id)
  if (!ticket) return notFound('Ticket not found')

  const resolution = data.resolution ?? ticket.resolution ?? 'Resolved by owner'
  const result = await changeSupportStatus(ctx, ticket, 'RESOLVED', resolution)
  if (result.kind === 'invalid') {
    return unprocessable(`Cannot resolve a ${result.from} ticket`)
  }

  return success({
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    status: result.status,
    resolution: result.resolution,
  })
})
