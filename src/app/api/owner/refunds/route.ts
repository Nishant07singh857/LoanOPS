// POST /api/owner/refunds — initiate a refund (REQUESTED)
// GET /api/owner/refunds — list refunds
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, notFound, conflict, validate, paginate, paginationSchema, genNumber } from '@/lib/server/api'
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

const createSchema = z.object({
  loanId: z.string().trim().min(1),
  // Admin refunds page sends amount as a digit-string in paise; a plain number is also accepted.
  amount: z.union([
    z.string().trim().regex(/^\d+$/, 'Amount must be a non-negative integer (paise)'),
    z.number().int().nonnegative(),
  ]),
  reason: z.string().trim().min(1).max(500),
  paymentId: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).strict()

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

  if (loan.status === 'PENDING_DISBURSEMENT' || loan.status === 'WRITTEN_OFF') {
    return badRequest(`Cannot refund a loan in status ${loan.status}`)
  }

  const amountPaise = parsePaise(data.amount)
  if (amountPaise <= BigInt(0)) return badRequest('Amount must be positive')

  if (amountPaise > BigInt(loan.totalCollected)) {
    return badRequest('Refund amount exceeds total collected for this loan')
  }

  // Resolve the payment this refund reverses: the caller-provided one (must
  // belong to this loan and be captured), else the latest captured payment.
  const payment = data.paymentId
    ? await db.payment.findFirst({
        where: { id: data.paymentId, loanId: loan.id, organizationId: ctx.user.organizationId },
      })
    : await db.payment.findFirst({
        where: {
          loanId: loan.id,
          organizationId: ctx.user.organizationId,
          status: { in: ['ALLOCATED', 'VERIFIED'] },
        },
        orderBy: { createdAt: 'desc' },
      })
  if (data.paymentId && !payment) return notFound('Payment not found for this loan')
  if (!payment) return badRequest('No captured payment available to refund against')
  if (payment.status !== 'ALLOCATED' && payment.status !== 'VERIFIED') {
    return badRequest(`Cannot refund against a payment in status ${payment.status}`)
  }

  // Block a second open refund against the same payment.
  const openRefund = await db.refund.findFirst({
    where: { paymentId: payment.id, status: { in: ['REQUESTED', 'PROCESSING'] } },
  })
  if (openRefund) {
    return conflict('An open refund already exists for this payment')
  }

  // Refund cannot exceed what this payment actually allocated, less refunds
  // already made against it (trackable via Refund.paymentId).
  const allocatedTotal =
    BigInt(payment.allocatedFees) + BigInt(payment.allocatedInterest) + BigInt(payment.allocatedPrincipal)
  const priorRefunds = await db.refund.aggregate({
    where: { paymentId: payment.id, status: { in: ['REQUESTED', 'PROCESSING', 'COMPLETED'] } },
    _sum: { amount: true },
  })
  const alreadyRefunded = BigInt(priorRefunds._sum.amount ?? 0)
  if (amountPaise > allocatedTotal - alreadyRefunded) {
    return badRequest('Refund amount exceeds the un-refunded allocated total of the target payment')
  }

  const refund = await db.refund.create({
    data: {
      loanId: data.loanId,
      paymentId: payment.id,
      amount: Number(amountPaise),
      reason: data.reason,
      status: 'REQUESTED',
      initiatedById: ctx.user.id,
      notes: data.notes ?? null,
    },
  })

  await audit(ctx, 'REFUND', 'Refund', refund.id, `Refund ₹${Number(amountPaise) / 100} requested for loan ${loan.loanNumber} (${loan.candidate.fullName}) against payment ${payment.paymentNumber}: ${data.reason}`)

  return created({
    id: refund.id,
    amount: String(amountPaise),
    status: refund.status,
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    paymentId: payment.id,
  })
})
