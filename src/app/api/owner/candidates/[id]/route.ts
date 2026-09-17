// GET /api/owner/candidates/[id] — single candidate detail
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const c = await db.candidate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: {
      assignedAgent: { include: { user: true } },
      kycDocs: true,
      loans: { orderBy: { createdAt: 'desc' }, take: 50 },
      applications: { orderBy: { createdAt: 'desc' }, take: 50 },
      payments: { orderBy: { createdAt: 'desc' }, take: 20 },
      _count: { select: { loans: true, applications: true, payments: true, ptps: true, followUps: true, escalations: true } },
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
    existingObligations: c.existingObligations,
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
    loans: c.loans,
    applications: c.applications,
    recentPayments: c.payments,
    counts: c._count,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  })
})
