// GET /api/agent/candidates — list candidates assigned to the agent
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgent } from '@/lib/server/auth'
import { apiHandler, success, notFound, validate, paginate, paginationSchema } from '@/lib/server/api'
import { decryptPIIForMask } from '@/lib/server/crypto'
import { maskAadhaar, maskPan, maskBankAccount } from '@/lib/utils'

const schema = paginationSchema.extend({
  search: z.string().trim().optional().default(''),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return notFound('Agent profile not found')

  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, search } = validate(schema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    organizationId: ctx.user.organizationId,
    assignedAgentId: agentProfile.id,
    ...(search ? {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { mobile: { contains: search } },
      ],
    } : {}),
  }

  const [items, total] = await Promise.all([
    db.candidate.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        loans: {
          where: { status: 'ACTIVE' },
          select: { id: true, loanNumber: true, outstandingPrincipal: true, schedule: { where: { status: 'OVERDUE' } } },
        },
        ptps: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 },
        followUps: { orderBy: { contactDate: 'desc' }, take: 1 },
        _count: { select: { loans: true, payments: true } },
      },
    }),
    db.candidate.count({ where }),
  ])

  return success({
    items: items.map((c) => {
      const overdueInstallments = c.loans.reduce((s, l) => s + l.schedule.length, 0)
      const totalOutstanding = c.loans.reduce((s, l) => s + l.outstandingPrincipal, 0)
      return {
        id: c.id,
        fullName: c.fullName,
        mobile: c.mobile,
        email: c.email,
        aadhaarMasked: c.aadhaarMasked ? maskAadhaar(decryptPIIForMask(c.aadhaarMasked)) : null,
        panMasked: c.panMasked ? maskPan(decryptPIIForMask(c.panMasked)) : null,
        bankAccount: c.bankAccount ? maskBankAccount(decryptPIIForMask(c.bankAccount)) : null,
        status: c.status,
        loansCount: c._count.loans,
        outstanding: String(totalOutstanding),
        overdueInstallments,
        activeLoanNumbers: c.loans.map((l) => l.loanNumber),
        activePtp: c.ptps[0] ? {
          id: c.ptps[0].id,
          promisedAmount: String(c.ptps[0].promisedAmount),
          promiseDate: c.ptps[0].promiseDate,
        } : null,
        lastContact: c.followUps[0]?.contactDate ?? null,
        nextFollowUp: c.followUps[0]?.nextFollowUp ?? null,
      }
    }),
    total, page, pageSize,
  })
})
