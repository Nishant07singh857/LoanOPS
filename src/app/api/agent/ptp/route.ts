// POST /api/agent/ptp — create a PTP (Promise-to-Pay)
// GET /api/agent/ptp — list agent's PTPs
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgent, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, notFound, forbidden, validate, paginate, paginationSchema } from '@/lib/server/api'
import { parsePaise } from '@/lib/server/financial'

const listSchema = paginationSchema.extend({
  status: z.string().optional(),
  candidateId: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return notFound('Agent profile not found')

  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status, candidateId } = validate(listSchema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    agentId: ctx.user.id,
    ...(status ? { status: status as any } : {}),
    ...(candidateId ? { candidateId } : {}),
  }
  const [items, total] = await Promise.all([
    db.ptp.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { fullName: true, mobile: true } },
        loan: { select: { loanNumber: true } },
      },
    }),
    db.ptp.count({ where }),
  ])

  return success({
    items: items.map((p) => ({
      id: p.id,
      promisedAmount: String(p.promisedAmount),
      promiseDate: p.promiseDate,
      status: p.status,
      notes: p.notes,
      fulfilledAt: p.fulfilledAt,
      brokenAt: p.brokenAt,
      candidate: p.candidate,
      loan: p.loan,
      createdAt: p.createdAt,
    })),
    total, page, pageSize,
  })
})

const schema = z.object({
  candidateId: z.string().min(1),
  loanId: z.string().min(1),
  promisedAmount: z.union([z.string().min(1).max(40), z.number()]),
  promiseDate: z.string().min(1).max(40),
  notes: z.string().max(5000).optional().nullable(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return forbidden('Agent profile not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(schema, body)

  const loan = await db.loan.findFirst({
    where: { id: data.loanId, candidateId: data.candidateId, organizationId: ctx.user.organizationId },
    include: { candidate: true },
  })
  if (!loan) return notFound('Loan not found')

  if (loan.candidate.assignedAgentId && loan.candidate.assignedAgentId !== agentProfile.id) {
    const taskCount = await db.collectionTask.count({
      where: {
        candidateId: loan.candidateId,
        assignedToId: agentProfile.id,
        organizationId: ctx.user.organizationId,
      },
    })
    if (taskCount === 0) {
      return forbidden('You do not have access to this candidate')
    }
  }

  const promisedAmountPaise = parsePaise(data.promisedAmount)
  if (promisedAmountPaise <= BigInt(0)) return badRequest('Promised amount must be positive')

  const ptp = await db.ptp.create({
    data: {
      candidateId: data.candidateId,
      loanId: data.loanId,
      agentId: ctx.user.id,
      promisedAmount: Number(promisedAmountPaise),
      promiseDate: new Date(data.promiseDate),
      status: 'ACTIVE',
      notes: data.notes ?? null,
    },
  })

  await audit(ctx, 'PTP_CREATE', 'Ptp', ptp.id, `Created PTP for ${loan.candidate.fullName}: ₹${Number(promisedAmountPaise) / 100} by ${new Date(data.promiseDate).toLocaleDateString()}`)

  return created({
    id: ptp.id,
    promisedAmount: String(promisedAmountPaise),
    promiseDate: ptp.promiseDate,
    status: ptp.status,
    candidateId: loan.candidateId,
    loanId: loan.id,
  })
})
