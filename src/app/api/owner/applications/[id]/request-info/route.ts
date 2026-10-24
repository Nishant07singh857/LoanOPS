// POST /api/owner/applications/[id]/request-info
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validate } from '@/lib/server/api'

const schema = z.object({
  message: z.string().trim().min(1).max(2000),
}).strict()

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const input = validate(schema, body)

  const app = await ctx.db.application.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  })
  if (!app) return notFound('Application not found')
  if (app.status === 'APPROVED') return badRequest('Cannot request info on approved application')

  await ctx.db.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: app.id },
      data: {
        status: 'INFORMATION_REQUESTED',
        reviewedById: ctx.user.id,
        reviewedAt: new Date(),
        infoRequested: input.message,
      },
    })
    await tx.notification.create({
      data: {
        organizationId: ctx.user.organizationId,
        candidateId: app.candidateId,
        type: 'INFORMATION_REQUESTED',
        title: 'Information requested',
        message: `More information required for ${app.applicationNumber}: ${input.message}`,
      },
    })
  })

  await audit(ctx, 'UPDATE', 'Application', app.id, `Requested info for ${app.applicationNumber}: ${input.message}`)
  return success({ ok: true })
})
