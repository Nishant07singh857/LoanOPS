// POST /api/owner/applications/[id]/approve
// Transaction: create Loan + immutable termsSnapshot + Installment rows + audit + notification
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validate, genNumber } from '@/lib/server/api'
import { generateSchedule } from '@/lib/server/financial'

const schema = z.object({
  reviewNotes: z.string().max(2000).optional().nullable(),
}).strict()

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const input = validate(schema, body)

  const app = await ctx.db.application.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: { candidate: true },
  })
  if (!app) return notFound('Application not found')
  if (app.status !== 'SUBMITTED' && app.status !== 'UNDER_REVIEW' && app.status !== 'INFORMATION_REQUESTED') {
    return badRequest(`Application is ${app.status}, cannot approve`)
  }

  // Compute schedule on backend (authoritative)
  const schedule = generateSchedule({
    principalPaise: BigInt(app.principalAmount),
    interestType: app.interestType,
    interestRateBps: BigInt(app.interestRate || 0),
    fixedInterestPaise: BigInt(app.fixedInterest || 0),
    frequency: app.frequency,
    installments: app.installments,
    firstDueDate: app.firstDueDate,
    processingFeePaise: BigInt(app.processingFee || 0),
    otherFeesPaise: BigInt(app.otherFees || 0),
  })

  const loanNumber = genNumber('LON')
  const termsSnapshot = {
    applicationId: app.id,
    applicationNumber: app.applicationNumber,
    principalAmount: Number(app.principalAmount),
    interestType: app.interestType,
    interestRate: app.interestRate,
    fixedInterest: app.fixedInterest,
    frequency: app.frequency,
    installments: app.installments,
    firstDueDate: app.firstDueDate.toISOString(),
    finalDueDate: schedule.finalDueDate.toISOString(),
    processingFee: app.processingFee,
    otherFees: app.otherFees,
    totalRepayable: Number(schedule.totalRepayable),
    installmentAmount: Number(schedule.installmentAmount),
    approvedAt: new Date().toISOString(),
    approvedBy: ctx.user.id,
  }

  // Transaction: update application + create loan + create installments
  const loan = await ctx.db.$transaction(async (tx) => {
    // Update application
    await tx.application.update({
      where: { id: app.id },
      data: {
        status: 'APPROVED',
        reviewedById: ctx.user.id,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes,
      },
    })

    // Create loan
    const newLoan = await tx.loan.create({
      data: {
        organizationId: ctx.user.organizationId,
        loanNumber,
        candidateId: app.candidateId,
        applicationId: app.id,
        principalAmount: app.principalAmount,
        interestType: app.interestType,
        interestRate: app.interestRate,
        fixedInterest: app.fixedInterest,
        frequency: app.frequency,
        installments: app.installments,
        firstDueDate: app.firstDueDate,
        finalDueDate: schedule.finalDueDate,
        processingFee: app.processingFee,
        otherFees: app.otherFees,
        totalRepayable: Number(schedule.totalRepayable),
        installmentAmount: Number(schedule.installmentAmount),
        termsSnapshot,
        status: 'PENDING_DISBURSEMENT',
        outstandingPrincipal: app.principalAmount,
        outstandingInterest: Number(schedule.totalInterest),
        outstandingFees: Number(schedule.totalFees),
      },
    })

    // Create installments
    for (const inst of schedule.installments) {
      await tx.installment.create({
        data: {
          loanId: newLoan.id,
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate,
          openingPrincipal: Number(inst.openingPrincipal),
          principalComponent: Number(inst.principalComponent),
          interestComponent: Number(inst.interestComponent),
          feesComponent: Number(inst.feesComponent),
          totalDue: Number(inst.totalDue),
          closingPrincipal: Number(inst.closingPrincipal),
          status: 'UPCOMING',
        },
      })
    }

    // Notify candidate
    await tx.notification.create({
      data: {
        organizationId: ctx.user.organizationId,
        userId: app.candidate.userId ?? null,
        candidateId: app.candidateId,
        type: 'APPLICATION_APPROVED',
        title: 'Application approved',
        message: `Your loan application ${app.applicationNumber} has been approved. Loan ${loanNumber} created.`,
      },
    })

    return newLoan
  })

  await audit(ctx, 'APPROVE', 'Application', app.id, `Approved ${app.applicationNumber}, created ${loanNumber}`, {
    loanId: loan.id,
  })

  return success({
    loanId: loan.id,
    loanNumber,
    termsSnapshot,
    installmentAmount: String(schedule.installmentAmount),
    totalRepayable: String(schedule.totalRepayable),
    finalDueDate: schedule.finalDueDate,
    installmentsCount: schedule.installments.length,
  })
})
