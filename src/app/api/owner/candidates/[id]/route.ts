// GET /api/owner/candidates/[id] — single candidate detail
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, notFound, badRequest, validateBody } from '@/lib/server/api'
import { z } from 'zod'
import { auditRaw } from '@/lib/server/auth'
import { decryptPIIForMask } from '@/lib/server/crypto'
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
    bankAccount: c.bankAccount ? maskBankAccount(decryptPIIForMask(c.bankAccount)) : null,
    bankIfsc: c.bankIfsc,
    upiId: c.upiId,
    aadhaarMasked: c.aadhaarMasked
      ? maskAadhaar(decryptPIIForMask(c.aadhaarMasked))
      : rawKyc?.aadhaarNumber
        ? maskAadhaar(decryptPIIForMask(rawKyc.aadhaarNumber))
        : null,
    panMasked: c.panMasked
      ? maskPan(decryptPIIForMask(c.panMasked))
      : rawKyc?.panNumber
        ? maskPan(decryptPIIForMask(rawKyc.panNumber))
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
          aadhaarNumber: rawKyc.aadhaarNumber ? maskAadhaar(decryptPIIForMask(rawKyc.aadhaarNumber)) : null,
          panNumber: rawKyc.panNumber ? maskPan(decryptPIIForMask(rawKyc.panNumber)) : null,
        }
      : null,
    loans: c.loans,
    applications: c.applications.map((a) => ({
      ...a,
      kycAadhaar: a.kycAadhaar ? maskAadhaar(decryptPIIForMask(a.kycAadhaar)) : null,
      kycPan: a.kycPan ? maskPan(decryptPIIForMask(a.kycPan)) : null,
    })),
    recentPayments: c.payments,
    counts: c._count,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  })
})

const assignSchema = z.object({
  // AgentProfile id to assign this candidate to, or null to unassign.
  assignedAgentId: z.string().trim().min(1).nullable(),
}).strict()

// PATCH /api/owner/candidates/[id] — (re)assign the collection agent.
// This is the write path behind the dashboard "Assign agent" action and
// the candidates workspace; assignment drives every agent-side ownership
// check (agent routes compare candidate.assignedAgentId to the agent's
// profile id).
export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validateBody(assignSchema, body)

  const candidate = await db.candidate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    select: { id: true, fullName: true, assignedAgentId: true },
  })
  if (!candidate) return notFound('Candidate not found')

  if (data.assignedAgentId) {
    const agent = await db.agentProfile.findFirst({
      where: { id: data.assignedAgentId, organizationId: ctx.user.organizationId },
      select: { id: true },
    })
    if (!agent) return badRequest('Agent not found in your organization')
  }

  const updated = await db.candidate.update({
    where: { id: candidate.id },
    data: { assignedAgentId: data.assignedAgentId },
    select: { id: true, assignedAgentId: true },
  })

  await auditRaw(ctx.user.organizationId, ctx.user.id, 'UPDATE', 'Candidate', candidate.id,
    data.assignedAgentId ? `Assigned candidate ${candidate.fullName} to agent ${data.assignedAgentId}` : `Unassigned agent from candidate ${candidate.fullName}`,
    { previousAgentId: candidate.assignedAgentId, newAgentId: data.assignedAgentId })

  return success(updated)
})
