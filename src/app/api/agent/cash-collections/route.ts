// POST /api/agent/cash-collections — agent records cash collection
// GET /api/agent/cash-collections — list cash collections (agent view)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgent, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, notFound, validate, paginate, paginationSchema } from '@/lib/server/api'
import { parsePaise } from '@/lib/server/financial'

const listSchema = paginationSchema.extend({
  status: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status } = validate(listSchema, params)
  const { skip, take } = paginate(page, pageSize)

  // Show cash collections recorded by this agent OR by other agents in the org (for visibility)
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

const schema = z.object({
  loanId: z.string(),
  candidateId: z.string(),
  amount: z.union([z.string(), z.number()]),
  collectionDate: z.string(),
  collectionTime: z.string(),
  installmentNumber: z.number().int().positive().optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  proofUrl: z.string().optional().nullable(),
})

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(schema, body)

  const loan = await db.loan.findFirst({
    where: { id: data.loanId, candidateId: data.candidateId, organizationId: ctx.user.organizationId },
    include: { candidate: true },
  })
  if (!loan) return notFound('Loan not found')

  const amountPaise = parsePaise(data.amount)
  if (amountPaise <= BigInt(0)) return badRequest('Amount must be positive')

  const cashCollection = await db.cashCollection.create({
    data: {
      loanId: data.loanId,
      candidateId: data.candidateId,
      recordedById: ctx.user.id,
      amount: Number(amountPaise),
      collectionDate: new Date(data.collectionDate),
      collectionTime: data.collectionTime,
      installmentNumber: data.installmentNumber ?? null,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
      proofUrl: data.proofUrl ?? null,
      status: 'PENDING_VERIFICATION',
    },
  })

  await audit(ctx, 'CREATE', 'CashCollection', cashCollection.id, `Recorded cash collection ₹${Number(amountPaise) / 100} for ${loan.candidate.fullName} (${loan.loanNumber}) — pending verification`)

  return created({
    id: cashCollection.id,
    amount: String(amountPaise),
    status: cashCollection.status,
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    candidateId: loan.candidateId,
  })
})
