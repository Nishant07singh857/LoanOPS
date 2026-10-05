// GET /api/agent/candidates/[id] — candidate detail (agent RBAC: assigned to agent or in org)
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAgent } from '@/lib/server/auth'
import { apiHandler, success, notFound, forbidden } from '@/lib/server/api'
import { decryptPII } from '@/lib/server/crypto'
import { maskAadhaar, maskPan, maskBankAccount } from '@/lib/utils'

export const GET = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAgent()
  const { id } = await params
  const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
  if (!agentProfile) return notFound('Agent profile not found')

  const c = await db.candidate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: {
      assignedAgent: { include: { user: true } },
      loans: {
        orderBy: { createdAt: 'desc' },
        include: {
          schedule: { orderBy: { installmentNumber: 'asc' } },
          ptps: { where: { agentId: ctx.user.id }, orderBy: { createdAt: 'desc' } },
          followUps: { where: { agentId: ctx.user.id }, orderBy: { contactDate: 'desc' }, take: 10 },
          payments: { orderBy: { createdAt: 'desc' }, take: 10 },
          escalations: { where: { agentId: ctx.user.id }, orderBy: { createdAt: 'desc' }, take: 10 },
        },
      },
      kycDocs: true,
      ptps: { where: { agentId: ctx.user.id }, orderBy: { createdAt: 'desc' } },
      followUps: { where: { agentId: ctx.user.id }, orderBy: { contactDate: 'desc' }, take: 20, include: { loan: { select: { loanNumber: true } } } },
      escalations: { where: { agentId: ctx.user.id }, orderBy: { createdAt: 'desc' }, take: 20 },
      payments: { where: { method: 'CASH', recordedById: ctx.user.id }, orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
  if (!c) return notFound('Candidate not found')

  // Strict IDOR protection: agent must be assigned to the candidate OR have an assigned CollectionTask for this candidate
  if (c.assignedAgentId !== agentProfile.id) {
    const taskCount = await db.collectionTask.count({
      where: {
        candidateId: c.id,
        assignedToId: agentProfile.id,
        organizationId: ctx.user.organizationId,
      },
    })
    if (taskCount === 0) {
      return forbidden('You do not have access to this candidate')
    }
  }

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
    bankName: c.bankName,
    bankAccount: c.bankAccount ? maskBankAccount(decryptPII(c.bankAccount)) : null,
    bankIfsc: c.bankIfsc,
    upiId: c.upiId,
    aadhaarMasked: c.aadhaarMasked || rawKyc?.aadhaarNumber || null,
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
    loans: c.loans.map((l) => ({
      id: l.id,
      loanNumber: l.loanNumber,
      principalAmount: String(l.principalAmount),
      installmentAmount: String(l.installmentAmount),
      totalRepayable: String(l.totalRepayable),
      outstandingPrincipal: String(l.outstandingPrincipal),
      outstandingInterest: String(l.outstandingInterest),
      status: l.status,
      frequency: l.frequency,
      installments: l.installments,
      firstDueDate: l.firstDueDate,
      overdueInstallmentsCount: l.schedule.filter((s) => s.status === 'OVERDUE').length,
      schedule: l.schedule.map((s) => ({
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        totalDue: String(s.totalDue),
        paidAmount: String(s.paidAmount),
        status: s.status,
      })),
    })),
    ptps: c.ptps.map((p) => ({
      id: p.id,
      promisedAmount: String(p.promisedAmount),
      promiseDate: p.promiseDate,
      status: p.status,
      notes: p.notes,
      loanNumber: p.loanId,
      createdAt: p.createdAt,
    })),
    followUps: c.followUps.map((f) => ({
      id: f.id,
      contactDate: f.contactDate,
      contactMethod: f.contactMethod,
      outcome: f.outcome,
      notes: f.notes,
      nextFollowUp: f.nextFollowUp,
      loanNumber: f.loan?.loanNumber,
    })),
    escalations: c.escalations.map((e) => ({
      id: e.id,
      reason: e.reason,
      description: e.description,
      status: e.status,
      createdAt: e.createdAt,
    })),
    cashCollections: c.payments.map((cc) => ({
      id: cc.id,
      amount: String(cc.amount),
      collectionDate: cc.createdAt,
      status: cc.status,
      reference: cc.reference,
    })),
    kyc: rawKyc
      ? {
          ...rawKyc,
          aadhaarNumber: rawKyc.aadhaarNumber,
          panNumber: rawKyc.panNumber ? maskPan(decryptPII(rawKyc.panNumber)) : null,
        }
      : null,
    createdAt: c.createdAt,
  })
})
