// POST /api/owner/support/[id]/status — move a ticket along the
// status walk (src/lib/support.ts SUPPORT_TRANSITIONS). Illegal
// moves — including any exit from terminal CLOSED — are a 422.
// Moving to RESOLVED stores the optional resolution note, exactly
// like the Resolve action. The borrower is notified + audit-logged.
import { NextRequest } from 'next/server'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, unprocessable, validate } from '@/lib/server/api'
import { supportStatusChangeSchema } from '@/lib/support'
import { loadTicketForStaff, changeSupportStatus } from '@/lib/server/support'

export const POST = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireOwner()
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(supportStatusChangeSchema, body)

  const ticket = await loadTicketForStaff(ctx, id)
  if (!ticket) return notFound('Ticket not found')

  const result = await changeSupportStatus(ctx, ticket, data.status, data.resolution)
  if (result.kind === 'invalid') {
    return unprocessable(`Cannot move a ${result.from} ticket to ${result.to}`)
  }

  return success({
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    status: result.status,
    resolution: result.resolution,
  })
})
