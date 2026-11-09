// GET /api/agent/support/[id] — one ticket for a candidate assigned
// to this agent, with its full reply thread. Tickets for other
// agents' candidates are a 404 (same scope as the agent list).
import { NextRequest } from 'next/server'
import { requireAgent } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'
import { loadTicketForStaff, serializeTicketThread } from '@/lib/server/support'

export const GET = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireAgent()
  const { id } = await params

  const ticket = await loadTicketForStaff(ctx, id)
  if (!ticket) return notFound('Ticket not found')

  return success(serializeTicketThread(ticket, ctx.user.id))
})
