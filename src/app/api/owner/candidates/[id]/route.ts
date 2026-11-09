// GET /api/owner/candidates/[id] — single candidate detail
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, notFound, badRequest, validateBody } from '@/lib/server/api'
import { z } from 'zod'
import { auditRaw } from '@/lib/server/auth'
import { decryptPIIForMask, encryptPII } from '@/lib/server/crypto'
import { maskAadhaar, maskPan, maskBankAccount, BANK_ACCOUNT_REGEX, IFSC_REGEX } from '@/lib/utils'

export const GET = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const c = await db.candidate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: {
      assignedAgent: { include: { user: true } },
      kycDocs: true,
      loans: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { schedule: { select: { status: true, dueDate: true }, orderBy: { installmentNumber: 'asc' } } },
      },
      applications: { orderBy: { createdAt: 'desc' }, take: 50 },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { loan: { select: { loanNumber: true } } },
      },
      ptps: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { loan: { select: { loanNumber: true } } },
      },
      supportTickets: { orderBy: { createdAt: 'desc' }, take: 20 },
      reminderLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { loan: { select: { loanNumber: true } } },
      },
      _count: { select: { loans: true, applications: true, payments: true, ptps: true, followUps: true, escalations: true, supportTickets: true, reminderLogs: true } },
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
    kycStatus: rawKyc?.status ?? null,
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
    loans: c.loans.map((l) => {
      const nextDue = l.schedule.find((s) => s.status !== 'PAID')
      return {
        id: l.id,
        loanNumber: l.loanNumber,
        applicationId: l.applicationId,
        principalAmount: String(l.principalAmount),
        interestType: l.interestType,
        interestRate: l.interestRate,
        installmentAmount: String(l.installmentAmount),
        totalRepayable: String(l.totalRepayable),
        outstandingPrincipal: String(l.outstandingPrincipal),
        outstandingInterest: String(l.outstandingInterest),
        outstandingFees: String(l.outstandingFees),
        totalCollected: String(l.totalCollected),
        status: l.status,
        frequency: l.frequency,
        installments: l.installments,
        firstDueDate: l.firstDueDate,
        finalDueDate: l.finalDueDate,
        disbursedAt: l.disbursedAt,
        createdAt: l.createdAt,
        scheduleSummary: {
          total: l.schedule.length,
          paid: l.schedule.filter((s) => s.status === 'PAID').length,
          overdue: l.schedule.filter((s) => s.status === 'OVERDUE').length,
          nextDueDate: nextDue?.dueDate ?? null,
        },
      }
    }),
    applications: c.applications.map((a) => ({
      ...a,
      principalAmount: String(a.principalAmount),
      fixedInterest: a.fixedInterest != null ? String(a.fixedInterest) : null,
      processingFee: a.processingFee != null ? String(a.processingFee) : null,
      otherFees: a.otherFees != null ? String(a.otherFees) : null,
      totalRepayable: a.totalRepayable != null ? String(a.totalRepayable) : null,
      installmentAmount: a.installmentAmount != null ? String(a.installmentAmount) : null,
      kycAadhaar: a.kycAadhaar ? maskAadhaar(decryptPIIForMask(a.kycAadhaar)) : null,
      kycPan: a.kycPan ? maskPan(decryptPIIForMask(a.kycPan)) : null,
    })),
    recentPayments: c.payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      loanId: p.loanId,
      loanNumber: p.loan.loanNumber,
      method: p.method,
      amount: String(p.amount),
      status: p.status,
      receiptNumber: p.receiptNumber,
      reference: p.reference,
      allocatedAt: p.allocatedAt,
      createdAt: p.createdAt,
    })),
    ptps: c.ptps.map((p) => ({
      id: p.id,
      loanId: p.loanId,
      loanNumber: p.loan.loanNumber,
      promisedAmount: String(p.promisedAmount),
      promiseDate: p.promiseDate,
      status: p.status,
      notes: p.notes,
      createdAt: p.createdAt,
    })),
    supportTickets: c.supportTickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      category: t.category,
      subject: t.subject,
      description: t.description,
      status: t.status,
      resolution: t.resolution,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
    reminders: c.reminderLogs.map((r) => ({
      id: r.id,
      loanId: r.loanId,
      loanNumber: r.loan.loanNumber,
      installmentId: r.installmentId,
      stage: r.stage,
      channel: r.channel,
      status: r.status,
      createdAt: r.createdAt,
    })),
    counts: c._count,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  })
})

const assignSchema = z.object({
  // AgentProfile id to assign this candidate to, or null to unassign.
  assignedAgentId: z.string().trim().min(1).nullable(),
}).strict()

// Profile-edit schema: the ordinary record fields the create form
// collects (POST /api/owner/candidates), with the same validation.
// Deliberately NOT editable here (strict mode rejects them with 422):
// - mobile — it is the borrower's portal-login identity, bound to the
//   @@unique([organizationId, mobile]) constraint and the claim flow;
//   changing it would strand the borrower's login and invite duplicates.
// - aadhaarMasked / panMasked — identity-document PII owned by the KYC
//   + consent + audited-reveal machinery, never free-form record edits.
// - organizationId / status / userId / claim fields — tenancy and
//   lifecycle state, each with its own flow.
// - assignedAgentId — assignment has its own branch of this PATCH.
const editSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email('Invalid email').max(200).optional().nullable(),
  dob: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'Invalid dob',
  }).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  occupation: z.string().trim().max(100).optional().nullable(),
  employer: z.string().trim().max(100).optional().nullable(),
  monthlyIncome: z.number().int().nonnegative().optional().nullable(),
  bankName: z.string().trim().min(2).max(100).optional().nullable(),
  bankAccount: z.string().trim().regex(BANK_ACCOUNT_REGEX, 'Invalid bank account number').optional().nullable(),
  bankIfsc: z.string().trim().toUpperCase().regex(IFSC_REGEX, 'Invalid IFSC format').optional().nullable(),
  upiId: z.string().trim().max(100).optional().nullable(),
}).strict()

// PATCH /api/owner/candidates/[id] — two owner write paths, dispatched
// on the body shape:
// - { assignedAgentId } → (re)assign the collection agent. This is the
//   write path behind the dashboard "Assign agent" action and the
//   candidates workspace; assignment drives every agent-side ownership
//   check (agent routes compare candidate.assignedAgentId to the
//   agent's profile id).
// - any profile field → edit the candidate's record (see editSchema).
export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  if (!Object.prototype.hasOwnProperty.call(body, 'assignedAgentId')) {
    return editCandidateProfile(ctx, id, body)
  }

  const data = validateBody(assignSchema, body)

  const candidate = await db.candidate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    select: { id: true, fullName: true, assignedAgentId: true },
  })
  if (!candidate) return notFound('Candidate not found')

  if (data.assignedAgentId) {
    const agent = await db.agentProfile.findFirst({
      where: { id: data.assignedAgentId, organizationId: ctx.user.organizationId },
      select: { id: true, isActive: true },
    })
    if (!agent) return badRequest('Agent not found in your organization')
    // Deactivated agents keep their existing book but take no new work.
    if (!agent.isActive) return badRequest('Agent is deactivated and cannot take new assignments')
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

// Profile-edit branch of the PATCH above. Org-scoping matches the rest
// of this route: a candidate outside the owner's org is a 404, never a
// 403 (no cross-org existence leak). The audit entry records WHICH
// fields changed — never the values (the create/assign audit patterns
// record identifiers, not PII payloads; bankAccount above all is
// write-only here and stored encrypted exactly as at creation).
async function editCandidateProfile(
  ctx: Awaited<ReturnType<typeof import('@/lib/server/auth').requireOwner>>,
  id: string,
  body: unknown
) {
  const data = validateBody(editSchema, body)

  const candidate = await db.candidate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  })
  if (!candidate) return notFound('Candidate not found')

  const update: Prisma.CandidateUpdateInput = {}
  const changedFields: string[] = []
  const consider = (field: keyof typeof data, value: unknown, current: unknown) => {
    if (value === undefined) return
    const same =
      value instanceof Date && current instanceof Date
        ? value.getTime() === current.getTime()
        : value === current
    if (!same) {
      ;(update as Record<string, unknown>)[field] = value
      changedFields.push(field)
    }
  }

  consider('fullName', data.fullName, candidate.fullName)
  consider('email', data.email, candidate.email)
  consider('dob', data.dob === undefined ? undefined : data.dob === null ? null : new Date(data.dob), candidate.dob)
  consider('address', data.address, candidate.address)
  consider('occupation', data.occupation, candidate.occupation)
  consider('employer', data.employer, candidate.employer)
  consider('monthlyIncome', data.monthlyIncome, candidate.monthlyIncome)
  consider('bankName', data.bankName, candidate.bankName)
  consider('bankIfsc', data.bankIfsc, candidate.bankIfsc)
  consider('upiId', data.upiId, candidate.upiId)
  // Bank account is compared/stored only in encrypted form (as at
  // creation); any submitted value counts as a change by construction —
  // the stored ciphertext is never decrypted just to diff it.
  if (data.bankAccount !== undefined) {
    update.bankAccount = data.bankAccount === null ? null : encryptPII(data.bankAccount)
    changedFields.push('bankAccount')
  }

  if (changedFields.length === 0) {
    return success({ id: candidate.id, changedFields: [] as string[] })
  }

  await db.candidate.update({ where: { id: candidate.id }, data: update })

  await auditRaw(
    ctx.user.organizationId,
    ctx.user.id,
    'UPDATE',
    'Candidate',
    candidate.id,
    `Edited candidate ${candidate.fullName} record — changed: ${changedFields.join(', ')}`,
    { changedFields }
  )

  return success({ id: candidate.id, changedFields })
}
