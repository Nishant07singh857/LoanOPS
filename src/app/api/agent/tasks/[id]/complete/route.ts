// POST /api/agent/tasks/[id]/complete — mark a collection task as RESOLVED
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgent, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound, badRequest, validate, conflict } from '@/lib/server/api'

const schema = z.object({
  outcome: z.string().min(1).max(500).optional(),
  notes: z.string().max(5000).optional().nullable(),
}).strict()

export const POST = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireAgent()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data = validate(schema, body)

  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return notFound('Agent profile not found')

  const task = await db.collectionTask.findFirst({
    where: { id, assignedToId: agentProfile.id, organizationId: ctx.user.organizationId },
  })
  if (!task) return notFound('Task not found')
  if (task.status === 'RESOLVED' || task.status === 'CLOSED') return conflict('Task already resolved')

  const updated = await db.collectionTask.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      outcome: data.outcome ?? 'Resolved',
      notes: data.notes ?? task.notes,
    },
  })

  await audit(ctx, 'UPDATE', 'CollectionTask', updated.id, `Marked task ${task.title} as RESOLVED`)

  return success({ id: updated.id, status: updated.status })
})
