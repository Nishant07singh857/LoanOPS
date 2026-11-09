// GET /api/candidate/support/[id] — one of the borrower's own tickets
// with its full reply thread (the ticket description is the opening
// entry; SupportTicketMessage rows follow in order).
import { NextRequest } from 'next/server'
import { requireCandidate } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'
import { loadTicketForBorrower, serializeTicketThread } from '@/lib/server/support'

export const GET = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireCandidate()
  const { id } = await params

  const ticket = await loadTicketForBorrower(ctx, id)
  if (!ticket) return notFound('Ticket not found')

  return success(serializeTicketThread(ticket, ctx.user.id))
})
