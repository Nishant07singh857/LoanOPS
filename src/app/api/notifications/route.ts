// GET  /api/notifications — list notifications for current user (OWNER, AGENT, CANDIDATE)
// POST /api/notifications — mark one (body.id) or all (body.all=true) as read for current user
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth, AuthUser } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, forbidden, validate, paginate, paginationSchema } from '@/lib/server/api'

function buildRoleNotificationWhere(user: AuthUser) {
  if (user.role === 'CANDIDATE') {
    return user.candidateId
      ? {
          organizationId: user.organizationId,
          OR: [{ candidateId: user.candidateId }, { userId: user.id }],
        }
      : {
          organizationId: user.organizationId,
          userId: user.id,
        }
  }
  if (user.role === 'OWNER') {
    return {
      organizationId: user.organizationId,
    }
  }
  // AGENT
  return {
    organizationId: user.organizationId,
    userId: user.id,
  }
}

const listQuerySchema = paginationSchema.extend({
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAuth()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, unreadOnly } = validate(listQuerySchema, params)
  const { skip, take } = paginate(page, pageSize)

  const baseWhere = buildRoleNotificationWhere(ctx.user)
  const where = unreadOnly ? { ...baseWhere, isRead: false } : baseWhere

  const [items, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { ...baseWhere, isRead: false } }),
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
    total,
    page,
    pageSize,
    unreadCount,
  })
})

const markSchema = z.object({}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAuth()
  const body = await req.json().catch(() => ({}))
  const data = validate(markSchema, body)
  const baseWhere = buildRoleNotificationWhere(ctx.user)

  if (data.all) {
    const result = await db.notification.updateMany({
      where: { ...baseWhere, isRead: false },
      data: { isRead: true },
    })
    return success({ marked: result.count, all: true })
  }

  if (!data.id) return badRequest('Provide id or all=true')
  const notif = await db.notification.findUnique({ where: { id: data.id } })
  if (!notif) return notFound('Notification not found')
  if (notif.organizationId !== ctx.user.organizationId) return forbidden('Not allowed')

  if (ctx.user.role === 'CANDIDATE') {
    const ownsByCandidate = Boolean(ctx.user.candidateId && notif.candidateId === ctx.user.candidateId)
    const ownsByUser = notif.userId === ctx.user.id
    if (!ownsByCandidate && !ownsByUser) return forbidden('Not allowed')
  }
  if (ctx.user.role === 'AGENT' && notif.userId !== ctx.user.id) {
    return forbidden('Not allowed')
  }

  await db.notification.update({
    where: { id: notif.id },
    data: { isRead: true },
  })

  return success({ id: notif.id, isRead: true })
})

