// POST /api/owner/loans/[id]/restructure — restructure a loan's remaining schedule
//
// Hardening rules:
// - Real validation schema (frequency enum + tenure 1..60 months).
// - If ANY installment is PARTIALLY_PAID the restructure is refused (409):
//   paid history is never deleted or rewritten.
// - The new schedule is built with the SERVER engine
//   (src/lib/server/financial.ts generateSchedule) from the loan's CURRENT
//   outstanding totals: principal = outstandingPrincipal, interest = the
//   outstanding interest carried as FIXED interest (the original interest
//   is NOT re-charged), fees = outstandingFees. The generated schedule's
//   totals therefore equal the outstanding totals exactly.
// - Only unpaid (UPCOMING/DUE/OVERDUE) installments are deleted/replaced.
// - Loan installmentAmount/frequency/installments/finalDueDate are updated
//   and totalRepayable is kept consistent:
//   totalCollected + outstandingPrincipal + outstandingInterest + outstandingFees.
// - Everything runs in one transaction with the loan row locked + re-read.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, conflict, validate } from '@/lib/server/api'
import { generateSchedule } from '@/lib/server/financial'

const restructureSchema = z.object({
  newFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  tenureMonths: z.number().int().min(1).max(60),
}).strict()

/** Installment count for a tenure, matching the codebase convention
 *  (MONTHLY: months, WEEKLY: months×4, DAILY: months×30). */
function installmentsFromTenure(tenureMonths: number, frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'): number {
  if (frequency === 'DAILY') return tenureMonths * 30
  if (frequency === 'WEEKLY') return tenureMonths * 4
  return tenureMonths
}

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = validate(restructureSchema, body)
  const frequency = parsed.newFrequency
  const installmentsCount = installmentsFromTenure(parsed.tenureMonths, frequency)

  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${id} FOR UPDATE`

    const loan = await tx.loan.findUnique({
      where: { id, organizationId: ctx.user.organizationId },
      include: { schedule: { orderBy: { installmentNumber: 'asc' } } },
    })
    if (!loan) return { error: 'not-found' as const }
    if (loan.status !== 'ACTIVE' && loan.status !== 'DEFAULTED') {
      return { error: 'state' as const }
    }

    // Paid history is untouchable.
    if (loan.schedule.some((i) => i.status === 'PARTIALLY_PAID')) {
      return { error: 'partially-paid' as const }
    }

    const unpaid = loan.schedule.filter(
      (i) => i.status === 'UPCOMING' || i.status === 'DUE' || i.status === 'OVERDUE',
    )
    if (unpaid.length === 0) return { error: 'no-unpaid' as const }

    const outstandingPrincipal = BigInt(loan.outstandingPrincipal)
    const outstandingInterest = BigInt(loan.outstandingInterest)
    const outstandingFees = BigInt(loan.outstandingFees)
    if (outstandingPrincipal + outstandingInterest + outstandingFees <= BigInt(0)) {
      return { error: 'no-unpaid' as const }
    }

    // Build the replacement schedule from CURRENT outstanding totals only.
    // Interest is carried as FIXED = outstandingInterest (no re-charge of
    // the original rate); outstanding fees go in as the processing fee so
    // the engine's totalFees equals outstandingFees exactly.
    const schedule = generateSchedule({
      principalPaise: outstandingPrincipal,
      interestType: 'FIXED',
      interestRateBps: BigInt(0),
      fixedInterestPaise: outstandingInterest,
      frequency,
      installments: installmentsCount,
      firstDueDate: new Date(unpaid[0].dueDate),
      processingFeePaise: outstandingFees,
      otherFeesPaise: BigInt(0),
    })

    // Invariant: the new schedule must sum to the outstanding totals.
    const sumPrincipal = schedule.installments.reduce((s, i) => s + i.principalComponent, BigInt(0))
    const sumInterest = schedule.installments.reduce((s, i) => s + i.interestComponent, BigInt(0))
    const sumFees = schedule.installments.reduce((s, i) => s + i.feesComponent, BigInt(0))
    if (sumPrincipal !== outstandingPrincipal || sumInterest !== outstandingInterest || sumFees !== outstandingFees) {
      return { error: 'schedule-mismatch' as const }
    }

    const firstUnpaidNumber = unpaid[0].installmentNumber
    const keptCount = loan.schedule.length - unpaid.length

    // Delete ONLY the unpaid installments being replaced.
    await tx.installment.deleteMany({
      where: { loanId: loan.id, id: { in: unpaid.map((i) => i.id) } },
    })

    for (const [idx, inst] of schedule.installments.entries()) {
      await tx.installment.create({
        data: {
          loanId: loan.id,
          installmentNumber: firstUnpaidNumber + idx,
          dueDate: inst.dueDate,
          openingPrincipal: Number(inst.openingPrincipal),
          principalComponent: Number(inst.principalComponent),
          interestComponent: Number(inst.interestComponent),
          feesComponent: Number(inst.feesComponent),
          totalDue: Number(inst.totalDue),
          closingPrincipal: Number(inst.closingPrincipal),
          status: 'UPCOMING' as const,
        },
      })
    }

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        installmentAmount: Number(schedule.installmentAmount),
        frequency,
        installments: keptCount + schedule.installments.length,
        finalDueDate: schedule.finalDueDate,
        // Keep totalRepayable consistent with what has been collected plus
        // everything still outstanding under the new schedule.
        totalRepayable:
          loan.totalCollected +
          loan.outstandingPrincipal +
          loan.outstandingInterest +
          loan.outstandingFees,
        version: { increment: 1 },
      },
    })

    return { ok: true as const, loan }
  }, { maxWait: 15000, timeout: 30000 })

  if ('error' in outcome) {
    if (outcome.error === 'not-found') return notFound('Loan not found')
    if (outcome.error === 'partially-paid') {
      return conflict('Loan has partially paid installments — restructure refused to protect paid history. Settle or reverse the partial payment first.')
    }
    if (outcome.error === 'state') return badRequest('Only active or defaulted loans can be restructured')
    if (outcome.error === 'schedule-mismatch') return badRequest('Failed to generate a restructure schedule matching outstanding totals')
    return badRequest('No unpaid installments left to restructure')
  }

  await audit(ctx, 'RESTRUCTURE', 'Loan', outcome.loan.id, `Restructured loan ${outcome.loan.loanNumber} to new tenure ${parsed.tenureMonths} months (${frequency}), outstanding principal=${outcome.loan.outstandingPrincipal} interest=${outcome.loan.outstandingInterest} fees=${outcome.loan.outstandingFees} carried without re-charging interest`)

  return success({ message: 'Loan successfully restructured' })
})
