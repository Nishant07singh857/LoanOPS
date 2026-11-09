// POST /api/owner/support/[id]/reply — owner replies on a ticket in
// their org; the borrower is notified. CLOSED tickets refuse (422).
import { NextRequest } from 'next/server'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, created, badRequest, notFound, unprocessable, validate } from '@/lib/server/api'
import { supportReplySchema } from '@/lib/support'
import { loadTicketForStaff, postSupportReply } from '@/lib/server/support'

export const POST = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireOwner()
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
