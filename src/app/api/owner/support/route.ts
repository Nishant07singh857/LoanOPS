// GET /api/owner/support — list support tickets (owner view)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate, paginationSchema } from '@/lib/server/api'

const schema = paginationSchema.extend({
  status: z.string().optional(),
  search: z.string().trim().optional().default(''),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status, search } = validate(schema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    organizationId: ctx.user.organizationId,
    ...(status ? { status: status as any } : {}),
    ...(search ? {
      OR: [
        { ticketNumber: { contains: search, mode: 'insensitive' as const } },
        { subject: { contains: search, mode: 'insensitive' as const } },
        { candidate: { fullName: { contains: search, mode: 'insensitive' as const } } },
      ],
    } : {}),
  }

  const [items, total] = await Promise.all([
    db.supportTicket.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: { candidate: { select: { id: true, fullName: true, mobile: true } } },
    }),
    db.supportTicket.count({ where }),
  ])

  return success({
    items: items.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      category: t.category,
      subject: t.subject,
      description: t.description,
      status: t.status,
      resolution: t.resolution,
      attachmentUrl: t.attachmentUrl,
      candidate: t.candidate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
    total, page, pageSize,
  })
})
