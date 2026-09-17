// GET /api/candidate/profile — fetch candidate profile
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireCandidate } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  const c = await db.candidate.findFirst({
    where: { id: ctx.user.candidateId, organizationId: ctx.user.organizationId },
    include: {
      assignedAgent: { include: { user: true } },
      kycDocs: true,
      _count: { select: { loans: true, payments: true, supportTickets: true } },
    },
  })
  if (!c) return notFound('Candidate not found')

  return success({
    id: c.id,
    fullName: c.fullName,
    mobile: c.mobile,
    email: c.email,
    dob: c.dob,
    address: c.address,
    occupation: c.occupation,
    employer: c.employer,
    monthlyIncome: c.monthlyIncome,
    bankName: c.bankName,
    bankAccount: c.bankAccount,
    bankIfsc: c.bankIfsc,
    upiId: c.upiId,
    aadhaarMasked: c.aadhaarMasked,
    panMasked: c.panMasked,
    status: c.status,
    assignedAgent: c.assignedAgent ? {
      id: c.assignedAgent.id,
      name: c.assignedAgent.user.name,
      phone: c.assignedAgent.user.phone,
    } : null,
    kyc: c.kycDocs[0] ?? null,
    counts: c._count,
    createdAt: c.createdAt,
  })
})
