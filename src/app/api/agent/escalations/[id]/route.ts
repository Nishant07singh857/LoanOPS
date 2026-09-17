// PATCH /api/agent/escalations/[id] — update escalation status (IN_REVIEW, RESOLVED, CLOSED)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgent, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound, badRequest, validate } from '@/lib/server/api'

const schema = z.object({
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED']),
  resolutionNotes: z.string().optional().nullable(),
})

export const PATCH = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireAgent()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data = validate(schema, body)

  const existing = await db.escalation.findFirst({
    where: { id, agentId: ctx.user.id },
  })
  if (!existing) return notFound('Escalation not found')

  const updated = await db.escalation.update({
    where: { id },
    data: {
      status: data.status,
      resolutionNotes: data.resolutionNotes ?? existing.resolutionNotes,
      resolvedAt: data.status === 'RESOLVED' || data.status === 'CLOSED' ? new Date() : existing.resolvedAt,
    },
  })

  await audit(ctx, 'UPDATE', 'Escalation', updated.id, `Escalation status updated to ${data.status}`)

  return success({ id: updated.id, status: updated.status })
})
