// POST /api/owner/refunds — initiate a refund (REQUESTED)
// GET /api/owner/refunds — list refunds
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, notFound, validate, paginate, paginationSchema, genNumber } from '@/lib/server/api'
import { parsePaise } from '@/lib/server/financial'

const schema = paginationSchema.extend({
  loanId: z.string().optional(),
  status: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, loanId, status } = validate(schema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    loan: { organizationId: ctx.user.organizationId },
    ...(loanId ? { loanId } : {}),
    ...(status ? { status: status as any } : {}),
  }
  const [items, total] = await Promise.all([
    db.refund.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        loan: { select: { id: true, loanNumber: true, candidate: { select: { fullName: true, mobile: true } } } },
        initiatedBy: { select: { name: true } },
      },
    }),
    db.refund.count({ where }),
  ])

  return success({
    items: items.map((r) => ({
      id: r.id,
      loanId: r.loanId,
      loanNumber: r.loan.loanNumber,
      candidateName: r.loan.candidate.fullName,
      candidateMobile: r.loan.candidate.mobile,
      amount: String(r.amount),
      reason: r.reason,
      status: r.status,
      notes: r.notes,
      processedAt: r.processedAt,
      initiatedBy: r.initiatedBy.name,
      createdAt: r.createdAt,
    })),
    total, page, pageSize,
  })
})

const createSchema = z.object({}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(createSchema, body)

  const loan = await db.loan.findFirst({
    where: { id: data.loanId, organizationId: ctx.user.organizationId },
    include: { candidate: true },
  })
  if (!loan) return notFound('Loan not found')

  const amountPaise = parsePaise(data.amount)
  if (amountPaise <= BigInt(0)) return badRequest('Amount must be positive')

  const refund = await db.refund.create({
    data: {
      loanId: data.loanId,
      amount: Number(amountPaise),
      reason: data.reason,
      status: 'REQUESTED',
      initiatedById: ctx.user.id,
      notes: data.notes ?? null,
    },
  })

  await audit(ctx, 'REFUND', 'Refund', refund.id, `Refund ₹${Number(amountPaise) / 100} requested for loan ${loan.loanNumber} (${loan.candidate.fullName}): ${data.reason}`)

  return created({
    id: refund.id,
    amount: String(amountPaise),
    status: refund.status,
    loanId: loan.id,
    loanNumber: loan.loanNumber,
  })
})
