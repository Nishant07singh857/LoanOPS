// POST /api/owner/applications/[id]/reject
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validate } from '@/lib/server/api'

const schema = z.object({}).strict()

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
  if (app.status === 'APPROVED') return badRequest('Cannot reject approved application')

  await ctx.db.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: app.id },
      data: {
        status: 'REJECTED',
        reviewedById: ctx.user.id,
        reviewedAt: new Date(),
        rejectionReason: input.rejectionReason,
      },
    })
    await tx.notification.create({
      data: {
        organizationId: ctx.user.organizationId,
        candidateId: app.candidateId,
        type: 'APPLICATION_REJECTED',
        title: 'Application rejected',
        message: `Your application ${app.applicationNumber} was rejected. Reason: ${input.rejectionReason}`,
      },
    })
  })

  await audit(ctx, 'REJECT', 'Application', app.id, `Rejected ${app.applicationNumber}: ${input.rejectionReason}`)
  return success({ ok: true })
})
