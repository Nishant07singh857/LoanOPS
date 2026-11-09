// POST /api/agent/support/[id]/status — agent moves a ticket for an
// assigned candidate along the status walk (SUPPORT_TRANSITIONS in
// src/lib/support.ts). Illegal moves are a 422; the borrower is
// notified + the change is audit-logged.
import { NextRequest } from 'next/server'
import { requireAgent } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, unprocessable, validate } from '@/lib/server/api'
import { supportStatusChangeSchema } from '@/lib/support'
import { loadTicketForStaff, changeSupportStatus } from '@/lib/server/support'

export const POST = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireAgent()
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
