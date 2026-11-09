// POST /api/agent/support/[id]/reply — agent replies on a ticket for
// a candidate assigned to them; the borrower is notified. Tickets
// outside the agent's assignment scope are a 404; CLOSED is a 422.
import { NextRequest } from 'next/server'
import { requireAgent } from '@/lib/server/auth'
import { apiHandler, created, badRequest, notFound, unprocessable, validate } from '@/lib/server/api'
import { supportReplySchema } from '@/lib/support'
import { loadTicketForStaff, postSupportReply } from '@/lib/server/support'

export const POST = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireAgent()
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(supportReplySchema, body)

  const ticket = await loadTicketForStaff(ctx, id)
  if (!ticket) return notFound('Ticket not found')

  const result = await postSupportReply(ctx, ticket, data.body)
  if (result.kind === 'closed') {
    return unprocessable('This ticket is closed and cannot be replied to.')
  }

  return created({ id: result.messageId, ticketId: ticket.id })
})
