// GET /api/candidate/loan — fetch the candidate's primary (active) loan
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireCandidate } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound } from '@/lib/server/api'
import { decryptPIIForMask } from '@/lib/server/crypto'
import { maskAadhaar, maskPan } from '@/lib/utils'

/**
 * Application rows carry kycPan as AES ciphertext (enc:v1:) and kycAadhaar
 * as a snapshot that must only ever be shown masked — never return either
 * raw to the client. Mirrors src/app/api/owner/candidates/[id]/route.ts.
 */
function maskApplicationKyc<T extends { kycAadhaar?: string | null; kycPan?: string | null }>(
  app: T | null
): T | null {
  if (!app) return app
  return {
    ...app,
    kycAadhaar: app.kycAadhaar ? maskAadhaar(decryptPIIForMask(app.kycAadhaar)) : null,
    kycPan: app.kycPan ? maskPan(decryptPIIForMask(app.kycPan)) : null,
  }
}

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  // Find the primary active loan (or the most recent loan if no active)
  const loan = await db.loan.findFirst({
    where: { candidateId: ctx.user.candidateId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: {
      schedule: { orderBy: { installmentNumber: 'asc' } },
      disbursements: { orderBy: { initiatedAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' }, take: 5 },
      application: true,
    },
  })

  // Check for any ongoing application
  const draftApplication = await db.application.findFirst({
    where: { 
      candidateId: ctx.user.candidateId, 
      status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFORMATION_REQUESTED'] } 
    },
    orderBy: { createdAt: 'desc' }
  })
  const existingKyc = await db.kycDocument.findFirst({
    where: { candidateId: ctx.user.candidateId, aadhaarUrl: { not: null }, panUrl: { not: null } }
  })
  const hasKyc = !!existingKyc

  if (!loan) {
    if (draftApplication) {
      return success({ draftApplication: maskApplicationKyc(draftApplication), hasKyc })
    }
    const anyLoan = await db.loan.findFirst({
      where: { candidateId: ctx.user.candidateId },
      orderBy: { createdAt: 'desc' },
    })
    if (!anyLoan) return notFound('No loans found for your account')
    return success({
      id: anyLoan.id,
      message: 'No active loan. Showing most recent loan.',
    })
  }

  // Fetch the active agreement template (so candidate can view the document)
  const agreementTemplate = loan.application?.agreementTemplateId
    ? await db.agreementTemplate.findUnique({ where: { id: loan.application.agreementTemplateId } })
    : await db.agreementTemplate.findFirst({ where: { isActive: true } })

  return success({
    id: loan.id,
    loanNumber: loan.loanNumber,
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
    firstDueDate: loan.firstDueDate,
    finalDueDate: loan.finalDueDate,
    processingFee: loan.processingFee ? String(loan.processingFee) : null,
    otherFees: loan.otherFees ? String(loan.otherFees) : null,
    termsSnapshot: loan.termsSnapshot,
    status: loan.status,
    disbursedAt: loan.disbursedAt,
    closedAt: loan.closedAt,
    createdAt: loan.createdAt,
    application: maskApplicationKyc(loan.application),
    draftApplication: maskApplicationKyc(draftApplication),
    agreement: agreementTemplate ? {
      id: agreementTemplate.id,
      name: agreementTemplate.name,
      version: agreementTemplate.version,
      body: agreementTemplate.body,
      isActive: agreementTemplate.isActive,
    } : null,
    paidInstallments: loan.schedule.filter((s) => s.status === 'PAID').length,
    overdueInstallments: loan.schedule.filter((s) => s.status === 'OVERDUE').length,
    nextDue: loan.schedule.find((s) => s.status !== 'PAID' && s.status !== 'UPCOMING')
      ?? loan.schedule.find((s) => s.status === 'UPCOMING') ?? null,
    recentPayments: loan.payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      amount: String(p.amount),
      method: p.method,
      status: p.status,
      receiptNumber: p.receiptNumber,
      createdAt: p.createdAt,
    })),
    disbursement: loan.disbursements[0] ? {
      method: loan.disbursements[0].method,
      amount: String(loan.disbursements[0].amount),
      status: loan.disbursements[0].status,
      reference: loan.disbursements[0].reference,
      initiatedAt: loan.disbursements[0].initiatedAt,
      completedAt: loan.disbursements[0].completedAt,
    } : null,
  })
})
