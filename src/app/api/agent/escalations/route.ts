// POST /api/agent/escalations — create an escalation
// GET /api/agent/escalations — list agent's escalations
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgent, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, notFound, validate, paginate, paginationSchema } from '@/lib/server/api'

const listSchema = paginationSchema.extend({
  status: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status } = validate(listSchema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    agentId: ctx.user.id,
    ...(status ? { status: status as any } : {}),
  }
  const [items, total] = await Promise.all([
    db.escalation.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { fullName: true, mobile: true } },
        loan: { select: { loanNumber: true } },
      },
    }),
    db.escalation.count({ where }),
  ])

  return success({
    items: items.map((e) => ({
      id: e.id,
      reason: e.reason,
      description: e.description,
      status: e.status,
      resolvedAt: e.resolvedAt,
      resolutionNotes: e.resolutionNotes,
      candidate: e.candidate,
      loan: e.loan,
      createdAt: e.createdAt,
    })),
    total, page, pageSize,
  })
})

const schema = z.object({
  candidateId: z.string(),
  loanId: z.string(),
  reason: z.enum([
    'REPEATED_MISSED_PAYMENT', 'BROKEN_PTP', 'LONG_OVERDUE',
    'FAILED_CONTACT', 'HIGH_OUTSTANDING', 'OTHER',
  ]),
  description: z.string().optional().nullable(),
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

  const escalation = await db.escalation.create({
    data: {
      candidateId: data.candidateId,
      loanId: data.loanId,
      agentId: ctx.user.id,
      reason: data.reason,
      description: data.description ?? null,
      status: 'OPEN',
    },
  })

  // Notify owners
  const owners = await db.user.findMany({
    where: { organizationId: ctx.user.organizationId, role: 'OWNER', isActive: true },
  })
  for (const owner of owners) {
    await db.notification.create({
      data: {
        organizationId: ctx.user.organizationId,
        userId: owner.id,
        type: 'ESCALATION',
        title: 'New escalation',
        message: `${ctx.user.name} escalated ${loan.candidate.fullName} (${loan.loanNumber}): ${data.reason}`,
        isRead: false,
        metadata: { escalationId: escalation.id, loanId: loan.id, candidateId: loan.candidateId },
      },
    })
  }

  await audit(ctx, 'ESCALATE', 'Escalation', escalation.id, `Escalated ${loan.candidate.fullName} (${loan.loanNumber}): ${data.reason}`)

  return created(escalation)
})
