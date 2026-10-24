// POST /api/owner/corrections/[id]/approve — apply a financial correction
//
// A correction is a PARTIAL reversal of one specific payment, for the
// amount recorded on the correction. Everything runs in ONE transaction:
// claim the correction (status guard), reverse min(amount, payment's total
// allocated) proportionally across fees/interest/principal, post the ledger
// reversal inside the tx, reduce the payment's allocated*, restore the
// loan's outstanding by component, and rebuild the installments by
// re-running allocation over the remaining payments. The correction is
// marked APPLIED in the same tx — a failure anywhere leaves nothing
// half-applied and unretryable.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound, conflict, badRequest } from '@/lib/server/api'
import { postReversal, postLedger, ACCOUNTS } from '@/lib/server/ledger'
import { recomputeInstallmentsFromPayments } from '@/lib/server/payments'

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const orgId = ctx.user.organizationId

  const peek = await db.financialCorrection.findFirst({
    where: { id, loan: { organizationId: orgId } },
    select: { id: true },
  })
  if (!peek) return notFound('Correction not found')

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "FinancialCorrection" WHERE id = ${id} FOR UPDATE`

    const correction = await tx.financialCorrection.findFirst({
      where: { id, loan: { organizationId: orgId } },
      include: {
        loan: {
          include: { schedule: { orderBy: { installmentNumber: 'asc' } }, candidate: true },
        },
      },
    })
    if (!correction) throw new Error('NOT_FOUND')
    if (correction.status === 'APPLIED') throw new Error('ALREADY_APPLIED')

    const correctionAmount = (correction as any).amount as number | null | undefined
    if (correctionAmount === null || correctionAmount === undefined) {
      throw new Error('NO_AMOUNT')
    }
    if (!correction.paymentId) throw new Error('NO_PAYMENT')

    const payment = await tx.payment.findUnique({ where: { id: correction.paymentId } })
    if (!payment || payment.loanId !== correction.loanId) throw new Error('NO_PAYMENT')

    // Claim the correction inside the tx — the status flip to APPLIED is
    // part of the same atomic unit as the money movement below.
    const claimed = await tx.financialCorrection.updateMany({
      where: { id: correction.id, status: { not: 'APPLIED' } },
      data: {
        status: 'APPLIED',
        appliedAt: new Date(),
        reviewedById: ctx.user.id,
        reviewNotes: 'Applied',
      },
    })
    if (claimed.count === 0) throw new Error('ALREADY_APPLIED')

    const allocFees = BigInt(payment.allocatedFees)
    const allocInterest = BigInt(payment.allocatedInterest)
    const allocPrincipal = BigInt(payment.allocatedPrincipal)
    const allocTotal = allocFees + allocInterest + allocPrincipal
    if (allocTotal <= BigInt(0)) throw new Error('NO_ALLOCATION')

    const wanted = BigInt(correctionAmount)
    const effective = wanted > allocTotal ? allocTotal : wanted

    // Proportional split across components (largest-remainder, exact sum).
    const share = (part: bigint) => (effective * part) / allocTotal
    let revFees = share(allocFees)
    let revInterest = share(allocInterest)
    let revPrincipal = share(allocPrincipal)
    let remainder = effective - (revFees + revInterest + revPrincipal)
    const slots = [
      { cap: allocFees, get: () => revFees, set: (v: bigint) => { revFees = v } },
      { cap: allocInterest, get: () => revInterest, set: (v: bigint) => { revInterest = v } },
      { cap: allocPrincipal, get: () => revPrincipal, set: (v: bigint) => { revPrincipal = v } },
    ].sort((a, b) => (b.cap > a.cap ? 1 : b.cap < a.cap ? -1 : 0))
    for (const slot of slots) {
      if (remainder <= BigInt(0)) break
      const add = remainder > slot.cap - slot.get() ? slot.cap - slot.get() : remainder
      slot.set(slot.get() + add)
      remainder -= add
    }

    const debitAccount = payment.method === 'CASH' ? ACCOUNTS.CASH : ACCOUNTS.BANK

    // Ledger reversal INSIDE the tx, against the payment's real entries
    // where findable; otherwise referenced by the payment number.
    const components = [
      { amount: revFees, type: 'PAYMENT_FEES' as const, debit: ACCOUNTS.FEE_INCOME, label: 'fees' },
      { amount: revInterest, type: 'PAYMENT_INTEREST' as const, debit: ACCOUNTS.INTEREST_INCOME, label: 'interest' },
      { amount: revPrincipal, type: 'PAYMENT_PRINCIPAL' as const, debit: ACCOUNTS.LOANS_RECEIVABLE, label: 'principal' },
    ]
    for (const comp of components) {
      if (comp.amount <= BigInt(0)) continue
      const realEntries = await tx.ledgerEntry.findMany({
        where: { organizationId: orgId, reference: payment.paymentNumber, type: comp.type },
        orderBy: { createdAt: 'asc' },
      })
      let left = comp.amount
      for (const entry of realEntries) {
        if (left <= BigInt(0)) break
        const priorReversals = await tx.ledgerEntry.aggregate({
          where: { organizationId: orgId, type: 'REVERSAL', reference: entry.entryNumber },
          _sum: { amount: true },
        })
        const headroom = BigInt(entry.amount) - BigInt(priorReversals._sum.amount ?? 0)
        if (headroom <= BigInt(0)) continue
        const take = left > headroom ? headroom : left
        if (take === BigInt(entry.amount) && (priorReversals._sum.amount ?? 0) === 0) {
          await postReversal({ originalEntryId: entry.id, reason: `Correction ${correction.id}: ${correction.reason}` }, tx)
        } else {
          await postLedger({
            organizationId: orgId,
            loanId: correction.loanId,
            paymentId: payment.id,
            type: 'REVERSAL',
            debitAccount: comp.debit,
            creditAccount: debitAccount,
            amount: take,
            description: `Partial reversal of ${entry.entryNumber} for correction ${correction.id} (${comp.label})`,
            reference: entry.entryNumber,
          }, tx)
        }
        left -= take
      }
      if (left > BigInt(0)) {
        await postReversal({
          organizationId: orgId,
          loanId: correction.loanId,
          paymentId: payment.id,
          originalEntryNumber: payment.paymentNumber,
          reason: `Correction ${correction.id}: ${correction.reason} (${comp.label})`,
          amount: left,
          debitAccount: comp.debit,
          creditAccount: debitAccount,
        }, tx)
      }
    }

    // Reduce the payment's allocation by the reversed components.
    const fullyReversed =
      allocFees - revFees === BigInt(0) &&
      allocInterest - revInterest === BigInt(0) &&
      allocPrincipal - revPrincipal === BigInt(0)
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        allocatedFees: Number(allocFees - revFees),
        allocatedInterest: Number(allocInterest - revInterest),
        allocatedPrincipal: Number(allocPrincipal - revPrincipal),
        ...(fullyReversed ? { status: 'REJECTED' as const } : {}),
      },
    })

    // Restore loan outstanding by component; reopen a CLOSED loan.
    const loan = correction.loan
    const newOutstandingTotal =
      loan.outstandingPrincipal + Number(revPrincipal) +
      loan.outstandingInterest + Number(revInterest) +
      loan.outstandingFees + Number(revFees)
    await tx.loan.update({
      where: { id: correction.loanId },
      data: {
        outstandingPrincipal: { increment: Number(revPrincipal) },
        outstandingInterest: { increment: Number(revInterest) },
        outstandingFees: { increment: Number(revFees) },
        totalCollected: { decrement: Number(effective) },
        version: { increment: 1 },
        ...(loan.status === 'CLOSED' && newOutstandingTotal > 0
          ? { status: 'ACTIVE', closedAt: null }
          : {}),
      },
    })

    // Rebuild installments by re-running allocation over remaining payments
    // (the corrected payment now contributes its reduced allocation). The
    // schedule being rebuilt was built from the payment's OLD allocation,
    // so pass it as a known allocation for correct baseline math.
    await recomputeInstallmentsFromPayments(tx, loan, {
      now: new Date(),
      knownAllocations: { [payment.id]: allocTotal },
    })

    return {
      correction,
      loanNumber: loan.loanNumber,
      reversedFees: revFees,
      reversedInterest: revInterest,
      reversedPrincipal: revPrincipal,
    }
  }, { maxWait: 15000, timeout: 30000 }).catch((err: any) => {
    if (err?.message === 'ALREADY_APPLIED') return { error: 'applied' as const }
    if (err?.message === 'NO_AMOUNT') return { error: 'no-amount' as const }
    if (err?.message === 'NO_PAYMENT') return { error: 'no-payment' as const }
    if (err?.message === 'NO_ALLOCATION') return { error: 'no-allocation' as const }
    if (err?.message === 'NOT_FOUND') return { error: 'not-found' as const }
    throw err
  })

  if ('error' in result) {
    if (result.error === 'applied') return conflict('Correction already applied')
    if (result.error === 'no-amount') return badRequest('Correction amount not recorded')
    if (result.error === 'not-found') return notFound('Correction not found')
    return badRequest('Correction cannot be applied against this payment')
  }

  await audit(ctx, 'CORRECT', 'FinancialCorrection', result.correction.id, `Applied correction for loan ${result.loanNumber}: ${result.correction.reason} (reversed fees=${result.reversedFees} interest=${result.reversedInterest} principal=${result.reversedPrincipal})`)

  return success({ id: result.correction.id, status: 'APPLIED' })
})
