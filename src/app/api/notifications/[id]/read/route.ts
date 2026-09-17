// POST /api/notifications/[id]/read — mark a notification as read
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server/auth'
import { apiHandler, success, notFound, forbidden } from '@/lib/server/api'

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAuth()
  const { id } = await params
  const notif = await db.notification.findUnique({ where: { id } })
  if (!notif) return notFound('Notification not found')
  if (notif.organizationId !== ctx.user.organizationId) return forbidden('Not allowed')

  if (ctx.user.role === 'CANDIDATE' && notif.candidateId !== ctx.user.candidateId) return forbidden('Not allowed')
  if (ctx.user.role === 'AGENT' && notif.userId !== ctx.user.id) return forbidden('Not allowed')

  await db.notification.update({
    where: { id: notif.id },
    data: { isRead: true },
  })

  return success({ id: notif.id, isRead: true })
})
