// GET /api/owner/payments — list all payments (paginated, filterable)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate, paginationSchema } from '@/lib/server/api'

const schema = paginationSchema.extend({
  status: z.enum(['INITIATED', 'PENDING_VERIFICATION', 'VERIFIED', 'ALLOCATED', 'FAILED', 'REJECTED']).optional(),
  method: z.enum(['ONLINE_UPI', 'ONLINE_NETBANKING', 'ONLINE_CARD', 'CASH', 'BANK_TRANSFER']).optional(),
  search: z.string().trim().optional().default(''),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status, method, search } = validate(schema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    organizationId: ctx.user.organizationId,
    ...(status ? { status: status as any } : {}),
    ...(method ? { method: method as any } : {}),
    ...(search ? {
      OR: [
        { paymentNumber: { contains: search, mode: 'insensitive' as const } },
        { reference: { contains: search, mode: 'insensitive' as const } },
        { receiptNumber: { contains: search, mode: 'insensitive' as const } },
        { candidate: { fullName: { contains: search, mode: 'insensitive' as const } } },
        { loan: { loanNumber: { contains: search, mode: 'insensitive' as const } } },
      ],
    } : {}),
  }

  const [items, total] = await Promise.all([
    db.payment.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        loan: { select: { id: true, loanNumber: true } },
        candidate: { select: { id: true, fullName: true, mobile: true } },
      },
    }),
    db.payment.count({ where }),
  ])

  return success({
    items: items.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      loanId: p.loanId,
      loanNumber: p.loan.loanNumber,
      candidateId: p.candidateId,
      candidateName: p.candidate.fullName,
      candidateMobile: p.candidate.mobile,
      amount: String(p.amount),
      method: p.method,
      status: p.status,
      reference: p.reference,
      receiptNumber: p.receiptNumber,
      allocatedFees: String(p.allocatedFees),
      allocatedInterest: String(p.allocatedInterest),
      allocatedPrincipal: String(p.allocatedPrincipal),
      allocatedAt: p.allocatedAt,
      createdAt: p.createdAt,
    })),
    total, page, pageSize,
  })
})
