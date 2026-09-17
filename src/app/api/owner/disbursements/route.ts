// GET /api/owner/disbursements — list disbursements
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
    db.disbursement.findMany({
      where,
      skip, take,
      orderBy: { initiatedAt: 'desc' },
      include: {
        loan: {
          select: { id: true, loanNumber: true, status: true, candidate: { select: { fullName: true, mobile: true } } },
        },
        initiatedBy: { select: { name: true } },
      },
    }),
    db.disbursement.count({ where }),
  ])

  return success({
    items: items.map((d) => ({
      id: d.id,
      loanId: d.loanId,
      loanNumber: d.loan.loanNumber,
      loanStatus: d.loan.status,
      candidateName: d.loan.candidate.fullName,
      candidateMobile: d.loan.candidate.mobile,
      method: d.method,
      amount: String(d.amount),
      status: d.status,
      reference: d.reference,
      notes: d.notes,
      proofUrl: d.proofUrl,
      initiatedAt: d.initiatedAt,
      completedAt: d.completedAt,
      initiatedBy: d.initiatedBy.name,
    })),
    total, page, pageSize,
  })
})
