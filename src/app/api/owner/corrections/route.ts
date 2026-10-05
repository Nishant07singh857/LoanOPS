// POST /api/owner/corrections — create correction request
// GET /api/owner/corrections — list corrections
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, notFound, validate, paginate, paginationSchema } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize } = validate(paginationSchema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    loan: { organizationId: ctx.user.organizationId },
  }
  const [items, total] = await Promise.all([
    db.financialCorrection.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        loan: { select: { loanNumber: true, candidate: { select: { fullName: true, mobile: true } } } },
        requestedBy: { select: { name: true } },
      },
    }),
    db.financialCorrection.count({ where }),
  ])

  return success({
    items: items.map((c) => ({
      id: c.id,
      loanId: c.loanId,
      loanNumber: c.loan.loanNumber,
      candidateName: c.loan.candidate.fullName,
      candidateMobile: c.loan.candidate.mobile,
      paymentId: c.paymentId,
      reason: c.reason,
      evidenceUrl: c.evidenceUrl,
      status: c.status,
      reviewNotes: c.reviewNotes,
      appliedAt: c.appliedAt,
      requestedBy: c.requestedBy.name,
      createdAt: c.createdAt,
    })),
    total, page, pageSize,
  })
})

const schema = z.object({}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(schema, body)

  const loan = await db.loan.findFirst({
    where: { id: data.loanId, organizationId: ctx.user.organizationId },
  })
  if (!loan) return notFound('Loan not found')

  const correction = await db.financialCorrection.create({
    data: {
      loanId: data.loanId,
      paymentId: data.paymentId ?? null,
      requestedById: ctx.user.id,
      reason: data.reason,
      evidenceUrl: data.evidenceUrl ?? null,
      status: 'REQUESTED',
    },
  })

  await audit(ctx, 'CORRECT', 'FinancialCorrection', correction.id, `Correction requested for loan ${loan.loanNumber}: ${data.reason}`)

  return created({
    id: correction.id,
    loanId: loan.id,
    status: correction.status,
  })
})
