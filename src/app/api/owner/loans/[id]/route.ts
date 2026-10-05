// GET /api/owner/loans/[id] — loan detail with schedule, payments, candidate
import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'
import { decryptPII } from '@/lib/server/crypto'
import { maskAadhaar, maskPan, maskBankAccount } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params

  const loan = await ctx.db.loan.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: {
      candidate: true,
      application: true,
      schedule: { orderBy: { installmentNumber: 'asc' } },
      payments: { orderBy: { createdAt: 'desc' } },
      ptps: { orderBy: { createdAt: 'desc' } },
      escalations: { orderBy: { createdAt: 'desc' } },
      disbursements: { orderBy: { initiatedAt: 'desc' } },
      documents: true,
      followUps: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })

  if (!loan) return notFound('Loan not found')

  const maskedCandidate = loan.candidate
    ? {
        ...loan.candidate,
        aadhaarMasked: loan.candidate.aadhaarMasked
          ? maskAadhaar(decryptPII(loan.candidate.aadhaarMasked))
          : loan.application?.kycAadhaar
            ? maskAadhaar(decryptPII(loan.application.kycAadhaar))
            : null,
        panMasked: loan.candidate.panMasked
          ? maskPan(decryptPII(loan.candidate.panMasked))
          : loan.application?.kycPan
            ? maskPan(decryptPII(loan.application.kycPan))
            : null,
        bankAccount: loan.candidate.bankAccount ? maskBankAccount(decryptPII(loan.candidate.bankAccount)) : null,
      }
    : loan.candidate

  const maskedApplication = loan.application
    ? {
        ...loan.application,
        kycAadhaar: loan.application.kycAadhaar ? maskAadhaar(decryptPII(loan.application.kycAadhaar)) : null,
        kycPan: loan.application.kycPan ? maskPan(decryptPII(loan.application.kycPan)) : null,
      }
    : null

  return success({
    id: loan.id,
    loanNumber: loan.loanNumber,
    candidateId: loan.candidateId,
    candidate: maskedCandidate,
    application: maskedApplication,
    principalAmount: String(loan.principalAmount),
    interestType: loan.interestType,
    interestRate: loan.interestRate,
    fixedInterest: loan.fixedInterest ? String(loan.fixedInterest) : null,
    frequency: loan.frequency,
    installments: loan.installments,
    installmentAmount: String(loan.installmentAmount),
    totalRepayable: String(loan.totalRepayable),
    outstandingPrincipal: String(loan.outstandingPrincipal),
    outstandingInterest: String(loan.outstandingInterest),
    outstandingFees: String(loan.outstandingFees),
    totalCollected: String(loan.totalCollected),
    processingFee: loan.processingFee ? String(loan.processingFee) : null,
    otherFees: loan.otherFees ? String(loan.otherFees) : null,
    firstDueDate: loan.firstDueDate,
    finalDueDate: loan.finalDueDate,
    status: loan.status,
    disbursedAt: loan.disbursedAt,
    closedAt: loan.closedAt,
    termsSnapshot: loan.termsSnapshot,
    schedule: loan.schedule.map(i => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      dueDate: i.dueDate,
      openingPrincipal: String(i.openingPrincipal),
      principalComponent: String(i.principalComponent),
      interestComponent: String(i.interestComponent),
      feesComponent: String(i.feesComponent),
      totalDue: String(i.totalDue),
      closingPrincipal: String(i.closingPrincipal),
      paidFees: String(i.paidFees),
      paidInterest: String(i.paidInterest),
      paidPrincipal: String(i.paidPrincipal),
      paidAmount: String(i.paidAmount),
      status: i.status,
      paidAt: i.paidAt,
    })),
    payments: loan.payments.map(p => ({
      ...p,
      amount: String(p.amount),
      allocatedFees: String(p.allocatedFees),
      allocatedInterest: String(p.allocatedInterest),
      allocatedPrincipal: String(p.allocatedPrincipal),
      unallocated: String(p.unallocated),
    })),
    disbursements: loan.disbursements.map(d => ({
      ...d,
      amount: String(d.amount),
    })),
    ptps: loan.ptps,
    escalations: loan.escalations,
    documents: loan.documents,
    followUps: loan.followUps,
  })
})
