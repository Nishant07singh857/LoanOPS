// POST /api/candidate/support/[id]/reply — borrower replies on their
// OWN ticket. Another borrower's ticket is a 404 (scope loader), and
// a CLOSED ticket refuses new replies (422 — terminal state).
import { NextRequest } from 'next/server'
import { requireCandidate } from '@/lib/server/auth'
import { apiHandler, created, badRequest, notFound, unprocessable, validate } from '@/lib/server/api'
import { supportReplySchema } from '@/lib/support'
import { loadTicketForBorrower, postSupportReply } from '@/lib/server/support'

export const POST = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireCandidate()
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(supportReplySchema, body)

  const ticket = await loadTicketForBorrower(ctx, id)
  if (!ticket) return notFound('Ticket not found')

  const result = await postSupportReply(ctx, ticket, data.body)
  if (result.kind === 'closed') {
    return unprocessable('This ticket is closed. Please raise a new ticket if you still need help.')
  }

  return created({ id: result.messageId, ticketId: ticket.id })
})
