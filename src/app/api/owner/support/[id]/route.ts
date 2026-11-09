// GET /api/owner/support/[id] — one ticket in the owner's org with
// its full reply thread.
import { NextRequest } from 'next/server'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'
import { loadTicketForStaff, serializeTicketThread } from '@/lib/server/support'

export const GET = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireOwner()
  const { id } = await params

  const ticket = await loadTicketForStaff(ctx, id)
  if (!ticket) return notFound('Ticket not found')

  return success(serializeTicketThread(ticket, ctx.user.id))
})
