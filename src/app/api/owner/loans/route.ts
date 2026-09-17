// GET /api/owner/loans — list loans for org
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate } from '@/lib/server/api'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  frequency: z.string().optional(),
  search: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = validate(querySchema, Object.fromEntries(url.searchParams))

  const where: any = { organizationId: ctx.user.organizationId }
  if (params.status) where.status = params.status
  if (params.frequency) where.frequency = params.frequency
  if (params.search) {
    where.OR = [
      { loanNumber: { contains: params.search, mode: 'insensitive' } },
      { candidate: { fullName: { contains: params.search, mode: 'insensitive' } } },
    ]
  }

  const { skip, take } = paginate(params.page, params.pageSize)
  const [loans, total] = await Promise.all([
    ctx.db.loan.findMany({
      where,
      include: {
        candidate: {
          select: {
            id: true,
            fullName: true,
            mobile: true,
            assignedAgent: { select: { id: true, user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    ctx.db.loan.count({ where }),
  ])

  return success({
    items: loans.map(l => ({
      id: l.id,
      loanNumber: l.loanNumber,
      candidateId: l.candidateId,
      candidateName: l.candidate.fullName,
      candidateMobile: l.candidate.mobile,
      principalAmount: String(l.principalAmount),
      interestType: l.interestType,
      interestRate: l.interestRate,
      fixedInterest: l.fixedInterest ? String(l.fixedInterest) : null,
      frequency: l.frequency,
      installments: l.installments,
      installmentAmount: String(l.installmentAmount),
      totalRepayable: String(l.totalRepayable),
      outstandingPrincipal: String(l.outstandingPrincipal),
      outstandingInterest: String(l.outstandingInterest),
      totalCollected: String(l.totalCollected),
      status: l.status,
      disbursedAt: l.disbursedAt,
      createdAt: l.createdAt,
      agentName: l.candidate.assignedAgent?.user?.name || null,
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
  })
})
