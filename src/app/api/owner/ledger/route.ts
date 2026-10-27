// GET /api/owner/ledger — list ledger entries (paginated, filterable)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate, paginationSchema } from '@/lib/server/api'

const schema = paginationSchema.extend({
  type: z.enum(['DISBURSEMENT', 'PAYMENT_PRINCIPAL', 'PAYMENT_INTEREST', 'PAYMENT_FEES', 'REFUND', 'CORRECTION', 'REVERSAL', 'FEE']).optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, type } = validate(schema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    organizationId: ctx.user.organizationId,
    ...(type ? { type: type as any } : {}),
  }

  const [items, total] = await Promise.all([
    db.ledgerEntry.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
    }),
    db.ledgerEntry.count({ where }),
  ])

  return success({
    items: items.map((e) => ({
      id: e.id,
      entryNumber: e.entryNumber,
      type: e.type,
      debitAccount: e.debitAccount,
      creditAccount: e.creditAccount,
      amount: String(e.amount),
      description: e.description,
      reference: e.reference,
      createdAt: e.createdAt,
    })),
    total, page, pageSize,
  })
})
