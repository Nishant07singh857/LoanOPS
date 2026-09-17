// GET /api/owner/cash-collections — list all cash collections across the org
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
    db.cashCollection.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { fullName: true, mobile: true } },
        loan: { select: { loanNumber: true } },
        recordedBy: { select: { name: true } },
        verifiedBy: { select: { name: true } },
      },
    }),
    db.cashCollection.count({ where }),
  ])

  return success({
    items: items.map((c) => ({
      id: c.id,
      amount: String(c.amount),
      collectionDate: c.collectionDate,
      collectionTime: c.collectionTime,
      installmentNumber: c.installmentNumber,
      reference: c.reference,
      notes: c.notes,
      proofUrl: c.proofUrl,
      status: c.status,
      rejectionReason: c.rejectionReason,
      recordedBy: c.recordedBy.name,
      verifiedBy: c.verifiedBy?.name ?? null,
      candidate: c.candidate,
      loan: c.loan,
      createdAt: c.createdAt,
      verifiedAt: c.verifiedAt,
    })),
    total, page, pageSize,
  })
})
