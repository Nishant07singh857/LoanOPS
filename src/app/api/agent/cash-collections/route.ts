// POST /api/agent/cash-collections — agent records cash collection
// GET /api/agent/cash-collections — list cash collections (agent view)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgent } from '@/lib/server/auth'
import {
  apiHandler, success, created, badRequest, notFound, forbidden,
  validate, paginate, paginationSchema,
} from '@/lib/server/api'
import { parsePaise } from '@/lib/server/financial'
import { collectCashPayment } from '@/lib/server/payments'

const listSchema = paginationSchema.extend({
  status: z.enum(['INITIATED', 'PENDING_VERIFICATION', 'VERIFIED', 'ALLOCATED', 'FAILED', 'REJECTED']).optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status } = validate(listSchema, params)
  const { skip, take } = paginate(page, pageSize)

  const baseAgentWhere = {
    organizationId: ctx.user.organizationId,
    recordedById: ctx.user.id,
    method: 'CASH' as const,
  }

  const where = {
    ...baseAgentWhere,
    ...(status ? { status: status as any } : {}),
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [items, total, unverifiedAgg, todayAgg] = await Promise.all([
    db.payment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { fullName: true, mobile: true } },
        loan: { select: { loanNumber: true } },
        recordedBy: { select: { name: true } },
        verifiedBy: { select: { name: true } },
      },
    }),
    db.payment.count({ where }),
    db.payment.aggregate({
      where: {
        ...baseAgentWhere,
        status: 'PENDING_VERIFICATION',
      },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: {
        ...baseAgentWhere,
        createdAt: { gte: startOfToday },
        status: { notIn: ['REJECTED', 'FAILED'] },
      },
      _sum: { amount: true },
    }),
  ])

  const unverifiedCashInHand = String(unverifiedAgg._sum.amount ?? 0)
  const todayTotal = String(todayAgg._sum.amount ?? 0)

  return success({
    items: items.map((c) => ({
      id: c.id,
      paymentNumber: c.paymentNumber,
      receiptNumber: c.receiptNumber,
      amount: String(c.amount),
      allocatedFees: String(c.allocatedFees),
      allocatedInterest: String(c.allocatedInterest),
      allocatedPrincipal: String(c.allocatedPrincipal),
      collectionDate: c.createdAt,
      collectionTime: c.createdAt,
      reference: c.reference,
      notes: c.notes,
      proofUrl: c.proofUrl,
      status: c.status,
      verificationStatus:
        c.status === 'VERIFIED' || c.verifiedAt
          ? 'VERIFIED'
          : c.status === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING_VERIFICATION',
      rejectionReason: c.rejectionReason,
      recordedBy: c.recordedBy?.name,
      verifiedBy: c.verifiedBy?.name ?? null,
      candidate: c.candidate,
      loan: c.loan,
      createdAt: c.createdAt,
      allocatedAt: c.allocatedAt,
      verifiedAt: c.verifiedAt,
    })),
    total,
    page,
    pageSize,
    unverifiedCashInHand,
    todayTotal,
  })
})

import { enforceRateLimit } from '@/lib/server/rate-limit'
import { validateAndStoreDataUrlUpload } from '@/lib/server/security'

const schema = z.object({
  candidateId: z.string().min(1),
  loanId: z.string().min(1),
  amount: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]),
  method: z.enum(['CASH']).optional(),
  proofUrl: z.string().max(10_000_000).optional().nullable(),
  idempotencyKey: z.string().min(1).max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  collectionDate: z.string().min(1).max(40).optional().nullable(),
  // Sent by the agent frontends but not persisted by collectCashPayment:
  collectionTime: z.string().max(40).optional().nullable(),
  installmentNumber: z.number().int().positive().optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()

  const rlResponse = enforceRateLimit(req, 'cash_collection', ctx.user.id)
  if (rlResponse) return rlResponse

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(schema, body)

  const amountPaise = parsePaise(data.amount)
  if (amountPaise <= BigInt(0)) return badRequest('Amount must be positive')

  let validatedProofUrl: string | null = null
  if (data.proofUrl) {
    const uploadCheck = await validateAndStoreDataUrlUpload(data.proofUrl, {
      maxBytes: 5 * 1024 * 1024,
      allowPdf: false,
    })
    if (!uploadCheck.ok) {
      return badRequest(uploadCheck.error)
    }
    validatedProofUrl = uploadCheck.storedRef
  }

  const headerIdempotencyKey =
    req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key') || null
  const idempotencyKey = data.idempotencyKey || headerIdempotencyKey || null

  try {
    const result = await collectCashPayment({
      organizationId: ctx.user.organizationId,
      agentUserId: ctx.user.id,
      loanId: data.loanId,
      candidateId: data.candidateId,
      amountPaise,
      collectionDate: data.collectionDate ?? null,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
      proofUrl: validatedProofUrl,
      idempotencyKey,
    })

    if (result.idempotentReplay) {
      return success(result, 200)
    }

    return created(result)
  } catch (err: any) {
    const msg: string = err?.message || ''
    if (msg.startsWith('FORBIDDEN:')) {
      return forbidden(msg.replace(/^FORBIDDEN:\s*/, ''))
    }
    if (msg.startsWith('BAD_REQUEST:')) {
      return badRequest(msg.replace(/^BAD_REQUEST:\s*/, ''))
    }
    if (msg.startsWith('NOT_FOUND:')) {
      return notFound(msg.replace(/^NOT_FOUND:\s*/, ''))
    }
    throw err
  }
})


