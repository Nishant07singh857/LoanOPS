// GET /api/owner/ptps — promise-to-pay list for the owner panel.
//
// Added with the live-audit fixes: the Collections page's PTP counters had
// no list behind them (dead counters). This is the org-scoped list those
// counters link to. Defaults to ACTIVE promises, soonest promise first.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate, paginationSchema } from '@/lib/server/api'

const querySchema = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'FULFILLED', 'BROKEN', 'ALL']).optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = validate(querySchema, Object.fromEntries(url.searchParams))

  const status = params.status ?? 'ACTIVE'
  const where: any = { candidate: { organizationId: ctx.user.organizationId } }
  if (status !== 'ALL') where.status = status

  const { skip, take } = paginate(params.page, params.pageSize)
  const [ptps, total] = await Promise.all([
    ctx.db.ptp.findMany({
      where,
      include: {
        candidate: { select: { id: true, fullName: true, mobile: true } },
        loan: { select: { id: true, loanNumber: true } },
        agent: { select: { id: true, name: true } },
      },
      orderBy: { promiseDate: 'asc' },
      skip,
      take,
    }),
    ctx.db.ptp.count({ where }),
  ])

  return success({
    items: ptps.map((p) => ({
      id: p.id,
      candidateId: p.candidateId,
      candidateName: p.candidate.fullName,
      candidateMobile: p.candidate.mobile,
      loanId: p.loanId,
      loanNumber: p.loan.loanNumber,
      agentName: p.agent.name,
      promisedAmount: String(p.promisedAmount),
      promiseDate: p.promiseDate,
      status: p.status,
      notes: p.notes,
      createdAt: p.createdAt,
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
  })
})
