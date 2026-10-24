// GET  /api/candidate/notifications — list candidate's own notifications
// POST /api/candidate/notifications — mark one (body.id) or all (body.all=true) as read
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireCandidate, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, forbidden, validate, paginate, paginationSchema } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, ...rest } = validate(paginationSchema.extend({
    unreadOnly: z.string().optional().transform((v) => v === 'true' || v === '1'),
  }), params)
  const unreadOnly = rest.unreadOnly as boolean
  const { skip, take } = paginate(page, pageSize)

  const where = {
    candidateId: ctx.user.candidateId,
    organizationId: ctx.user.organizationId,
    ...(unreadOnly ? { isRead: false } : {}),
  }

  const [items, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where, skip, take,
      orderBy: { createdAt: 'desc' },
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { ...where, isRead: false } }),
  ])

  return success({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      metadata: n.metadata,
      createdAt: n.createdAt,
    })),
    total, page, pageSize, unreadCount,
  })
})

const markSchema = z.object({
  id: z.string().min(1).optional(),
  all: z.boolean().optional(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')
  const body = await req.json().catch(() => ({}))
  const data = validate(markSchema, body)

  if (data.all) {
    const result = await db.notification.updateMany({
      where: {
        candidateId: ctx.user.candidateId,
        organizationId: ctx.user.organizationId,
        isRead: false,
      },
      data: { isRead: true },
    })
    await audit(ctx, 'UPDATE', 'Notification', null, `Marked ${result.count} notifications as read`)
    return success({ marked: result.count, all: true })
  }

  if (!data.id) return badRequest('Provide id or all=true')
  const notif = await db.notification.findUnique({ where: { id: data.id } })
  if (!notif) return notFound('Notification not found')
  if (notif.candidateId !== ctx.user.candidateId) return forbidden('Not allowed')
  await db.notification.update({ where: { id: notif.id }, data: { isRead: true } })
  await audit(ctx, 'UPDATE', 'Notification', notif.id, 'Marked notification as read')
  return success({ id: notif.id, isRead: true })
})
