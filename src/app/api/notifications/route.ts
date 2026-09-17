// GET /api/notifications — list notifications for current user
// POST /api/notifications/[id]/read — mark as read
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server/auth'
import { apiHandler, success, notFound, validate, paginate, paginationSchema } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAuth()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize } = validate(paginationSchema, params)
  const { skip, take } = paginate(page, pageSize)

  // Candidate sees own; agent sees own; owner sees org-wide
  const where = ctx.user.role === 'CANDIDATE'
    ? { candidateId: ctx.user.candidateId }
    : ctx.user.role === 'OWNER'
      ? { organizationId: ctx.user.organizationId }
      : { userId: ctx.user.id, organizationId: ctx.user.organizationId }

  const [items, total] = await Promise.all([
    db.notification.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
    }),
    db.notification.count({ where }),
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
    total, page, pageSize,
    unreadCount: items.filter((n) => !n.isRead).length,
  })
})
