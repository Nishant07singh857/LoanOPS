// GET /api/owner/loans — list loans for org
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate, paginationSchema } from '@/lib/server/api'

const querySchema = paginationSchema.extend({
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
  frequency: z.string().trim().optional(),
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
      select: {
        id: true,
        loanNumber: true,
        candidateId: true,
        principalAmount: true,
        interestType: true,
        interestRate: true,
        fixedInterest: true,
        frequency: true,
        installments: true,
        installmentAmount: true,
        totalRepayable: true,
        outstandingPrincipal: true,
        outstandingInterest: true,
        totalCollected: true,
        status: true,
        disbursedAt: true,
        createdAt: true,
        candidate: {
          select: {
            id: true,
            fullName: true,
            mobile: true,
            assignedAgent: { select: { id: true, user: { select: { name: true } } } },
          },
        },
        schedule: {
          where: { status: { in: ['UPCOMING', 'DUE', 'PARTIALLY_PAID', 'OVERDUE'] } },
          orderBy: { dueDate: 'asc' },
          take: 1,
          select: { dueDate: true, status: true, totalDue: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    ctx.db.loan.count({ where }),
  ])

  return success({
    items: loans.map(l => {
      const nextInstallment = l.schedule?.[0] || null
      const isOverdue = nextInstallment?.status === 'OVERDUE' ||
        (nextInstallment && new Date(nextInstallment.dueDate) < new Date() && nextInstallment.status !== 'PAID')
      return {
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
        agent: l.candidate.assignedAgent
          ? { id: l.candidate.assignedAgent.id, name: l.candidate.assignedAgent.user?.name || '' }
          : null,
        nextDueDate: nextInstallment?.dueDate || null,
        nextDueAmount: nextInstallment ? String(nextInstallment.totalDue) : null,
        overdue: isOverdue,
      }
    }),
    total,
    page: params.page,
    pageSize: params.pageSize,
  })
})
