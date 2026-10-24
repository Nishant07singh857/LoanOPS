// POST /api/candidate/payments — candidate initiates payment (disabled unless ENABLE_ONLINE_PAYMENTS === 'true')
// GET  /api/candidate/payments — list candidate's own payments
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireCandidate, audit } from '@/lib/server/auth'
import {
  apiHandler, success, created, badRequest, notFound, forbidden,
  validate, paginate, paginationSchema, genNumber, genToken,
} from '@/lib/server/api'
import { parsePaise } from '@/lib/server/financial'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize } = validate(paginationSchema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = { candidateId: ctx.user.candidateId }
  const [items, total] = await Promise.all([
    db.payment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        loan: { select: { loanNumber: true } },
        recordedBy: { select: { name: true } },
        verifiedBy: { select: { name: true } },
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
      amount: String(p.amount),
      method: p.method,
      status: p.status,
      verificationStatus:
        p.status === 'VERIFIED' || p.verifiedAt
          ? 'VERIFIED'
          : p.status === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING_VERIFICATION',
      recordedBy: p.recordedBy?.name ?? 'Field Agent',
      verifiedBy: p.verifiedBy?.name ?? null,
      verifiedAt: p.verifiedAt,
      reference: p.reference,
      notes: p.notes,
      rejectionReason: p.rejectionReason,
      receiptNumber: p.receiptNumber,
      allocatedFees: String(p.allocatedFees),
      allocatedInterest: String(p.allocatedInterest),
      allocatedPrincipal: String(p.allocatedPrincipal),
      createdAt: p.createdAt,
      allocatedAt: p.allocatedAt,
    })),
    total,
    page,
    pageSize,
  })
})

const schema = z.object({
  loanId: z.string().min(1),
  amount: z.union([z.string().min(1).max(40), z.number()]),
  method: z.enum(['ONLINE_UPI', 'ONLINE_NETBANKING', 'ONLINE_CARD', 'CASH', 'BANK_TRANSFER']),
  idempotencyKey: z.string().min(1).max(200).optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  if (process.env.ENABLE_ONLINE_PAYMENTS !== 'true') {
    return forbidden('Offline cash collection only. Please pay cash to your assigned field agent.')
  }

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(schema, body)

  // Verify the loan belongs to the candidate's org and is ACTIVE
  const loan = await db.loan.findFirst({
    where: { id: data.loanId, organizationId: ctx.user.organizationId, candidateId: ctx.user.candidateId },
  })
  if (!loan) return notFound('Loan not found')
  if (loan.status !== 'ACTIVE') return badRequest('Loan is not active')

  const amountPaise = parsePaise(data.amount)
  if (amountPaise <= BigInt(0)) return badRequest('Amount must be positive')

  const totalOutstandingPaise =
    BigInt(loan.outstandingPrincipal) + BigInt(loan.outstandingInterest) + BigInt(loan.outstandingFees)
  if (amountPaise > totalOutstandingPaise) {
    return badRequest('Amount exceeds total outstanding for this loan')
  }

  const paymentNumber = genNumber('PAY')
  // Prefer the client-supplied idempotency key so a retried submit dedupes
  // instead of creating a second INITIATED payment; mint one only if absent.
  const idempotencyKey = data.idempotencyKey || genToken(16)

  if (data.idempotencyKey) {
    const existingPayment = await db.payment.findUnique({ where: { idempotencyKey } })
    if (existingPayment) {
      if (existingPayment.candidateId !== ctx.user.candidateId || existingPayment.loanId !== loan.id) {
        return badRequest('Idempotency key already used for a different payment')
      }
      return success({
        id: existingPayment.id,
        paymentNumber: existingPayment.paymentNumber,
        loanId: existingPayment.loanId,
        loanNumber: loan.loanNumber,
        amount: String(existingPayment.amount),
        method: existingPayment.method,
        status: existingPayment.status,
        idempotencyKey,
        idempotentReplay: true,
      })
    }
  }

  const payment = await db.payment.create({
    data: {
      organizationId: ctx.user.organizationId,
      paymentNumber,
      loanId: loan.id,
      candidateId: ctx.user.candidateId,
      method: data.method,
      amount: Number(amountPaise),
      reference: data.reference ?? null,
      status: 'INITIATED',
      idempotencyKey,
    },
  })

  await audit(ctx, 'CREATE', 'Payment', payment.id, `Candidate initiated payment ${paymentNumber} of ₹${Number(amountPaise) / 100} for loan ${loan.loanNumber}`)

  // Provider-mock redirect info (the candidate portal can render a fake UPI deep link)
  const providerMock = {
    redirectUrl: `/api/webhooks/payment-mock?paymentId=${payment.id}&idempotencyKey=${idempotencyKey}`,
    upiId: loan.candidateId ? `${loan.loanNumber.toLowerCase()}@sterling` : null,
    method: data.method,
  }

  return created({
    id: payment.id,
    paymentNumber,
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    amount: String(amountPaise),
    method: data.method,
    status: 'INITIATED',
    idempotencyKey,
    providerMock,
  })
})

