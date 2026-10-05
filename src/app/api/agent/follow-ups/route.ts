// POST /api/agent/follow-ups — record a follow-up
// GET /api/agent/follow-ups — list agent's follow-ups
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAgent, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, notFound, forbidden, validate, paginate, paginationSchema } from '@/lib/server/api'

const listSchema = paginationSchema.extend({
  candidateId: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return notFound('Agent profile not found')

  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, candidateId } = validate(listSchema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    agentId: ctx.user.id,
    ...(candidateId ? { candidateId } : {}),
  }

  const [items, total] = await Promise.all([
    db.followUp.findMany({
      where,
      skip, take,
      orderBy: { contactDate: 'desc' },
      include: {
        candidate: { select: { fullName: true, mobile: true } },
        loan: { select: { loanNumber: true } },
      },
    }),
    db.followUp.count({ where }),
  ])

  return success({
    items: items.map((f) => ({
      id: f.id,
      contactDate: f.contactDate,
      contactMethod: f.contactMethod,
      outcome: f.outcome,
      notes: f.notes,
      nextFollowUp: f.nextFollowUp,
      candidate: f.candidate,
      loan: f.loan,
      createdAt: f.createdAt,
    })),
    total, page, pageSize,
  })
})

const schema = z.object({}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return forbidden('Agent profile not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(schema, body)

  // Verify candidate is in org
  const candidate = await db.candidate.findFirst({
    where: { id: data.candidateId, organizationId: ctx.user.organizationId },
  })
  if (!candidate) return notFound('Candidate not found')

  if (candidate.assignedAgentId !== agentProfile.id) {
    const taskCount = await db.collectionTask.count({
      where: {
        candidateId: candidate.id,
        assignedToId: agentProfile.id,
        organizationId: ctx.user.organizationId,
      },
    })
    if (taskCount === 0) {
      return forbidden('You do not have access to this candidate')
    }
  }

  // If loanId provided, verify it belongs to the candidate
  if (data.loanId) {
    const loan = await db.loan.findFirst({
      where: { id: data.loanId, candidateId: data.candidateId, organizationId: ctx.user.organizationId },
    })
    if (!loan) return notFound('Loan not found for this candidate')
  }

  const followUp = await db.followUp.create({
    data: {
      candidateId: data.candidateId,
      loanId: data.loanId ?? null,
      agentId: ctx.user.id,
      contactDate: new Date(),
      contactMethod: data.contactMethod,
      outcome: data.outcome ?? null,
      notes: data.notes ?? null,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
    },
  })

  await audit(ctx, 'CREATE', 'FollowUp', followUp.id, `Follow-up with ${candidate.fullName} via ${data.contactMethod}${data.outcome ? ` (${data.outcome})` : ''}`)

  return created(followUp)
})
