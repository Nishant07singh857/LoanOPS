// GET /api/owner/candidates/[id] — single candidate detail
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'
import { decryptPII } from '@/lib/server/crypto'
import { maskAadhaar, maskPan, maskBankAccount } from '@/lib/utils'

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

  const rawKyc = c.kycDocs[0] ?? null

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
    bankAccount: c.bankAccount ? maskBankAccount(decryptPII(c.bankAccount)) : null,
    bankIfsc: c.bankIfsc,
    upiId: c.upiId,
    aadhaarMasked: c.aadhaarMasked
      ? maskAadhaar(decryptPII(c.aadhaarMasked))
      : rawKyc?.aadhaarNumber
        ? maskAadhaar(decryptPII(rawKyc.aadhaarNumber))
        : null,
    panMasked: c.panMasked
      ? maskPan(decryptPII(c.panMasked))
      : rawKyc?.panNumber
        ? maskPan(decryptPII(rawKyc.panNumber))
        : null,
    status: c.status,
    assignedAgent: c.assignedAgent ? {
      id: c.assignedAgent.id,
      name: c.assignedAgent.user.name,
      phone: c.assignedAgent.user.phone,
    } : null,
    kyc: rawKyc
      ? {
          ...rawKyc,
          aadhaarNumber: rawKyc.aadhaarNumber ? maskAadhaar(decryptPII(rawKyc.aadhaarNumber)) : null,
          panNumber: rawKyc.panNumber ? maskPan(decryptPII(rawKyc.panNumber)) : null,
        }
      : null,
    loans: c.loans,
    applications: c.applications.map((a) => ({
      ...a,
      kycAadhaar: a.kycAadhaar ? maskAadhaar(decryptPII(a.kycAadhaar)) : null,
      kycPan: a.kycPan ? maskPan(decryptPII(a.kycPan)) : null,
    })),
    recentPayments: c.payments,
    counts: c._count,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  })
})
