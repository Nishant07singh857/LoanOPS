// GET /api/owner/escalations — list all escalations across the org
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate, paginationSchema } from '@/lib/server/api'

const schema = paginationSchema.extend({
  status: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status } = validate(schema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    loan: { organizationId: ctx.user.organizationId },
    ...(status ? { status: status as any } : {}),
  }

  const [items, total] = await Promise.all([
    db.escalation.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { fullName: true, mobile: true } },
        loan: { select: { loanNumber: true } },
        agent: { select: { name: true } },
      },
    }),
    db.escalation.count({ where }),
  ])

  return success({
    items: items.map((e) => ({
      id: e.id,
      reason: e.reason,
      description: e.description,
      status: e.status,
      resolvedAt: e.resolvedAt,
      resolutionNotes: e.resolutionNotes,
      candidate: e.candidate,
      loan: e.loan,
      agent: e.agent,
      createdAt: e.createdAt,
    })),
    total, page, pageSize,
  })
})
