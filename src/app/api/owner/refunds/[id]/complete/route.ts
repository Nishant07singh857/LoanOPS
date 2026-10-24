// POST /api/owner/refunds/[id]/complete — mark refund as COMPLETED
//
// Everything happens in ONE transaction:
// - The refund row is claimed with a status-guarded updateMany
//   (REQUESTED/PROCESSING only) — a concurrent complete aborts instead of
//   double-reversing.
// - The reversal amount is the REFUND amount, spread proportionally across
//   the target payment's allocated fees/interest/principal by their shares
//   and capped at what remains allocated on that payment.
// - Ledger reversals are posted INSIDE the tx against the payment's real
//   ledger entries where findable (reference = paymentNumber otherwise —
//   never a fabricated LED-* number).
// - Loan outstandingFees/Interest/Principal are each restored by the
//   reversed component; the payment's allocated* are reduced by the same
//   components; the payment is REJECTED only when fully reversed; a CLOSED
//   loan reopens to ACTIVE if outstanding is positive again.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound, conflict, badRequest } from '@/lib/server/api'
import { postReversal, postLedger, ACCOUNTS } from '@/lib/server/ledger'

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const orgId = ctx.user.organizationId

  const refundPeek = await db.refund.findFirst({
    where: { id, loan: { organizationId: orgId } },
    select: { id: true },
  })
  if (!refundPeek) return notFound('Refund not found')

  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Refund" WHERE id = ${id} FOR UPDATE`

    const refund = await tx.refund.findFirst({
      where: { id, loan: { organizationId: orgId } },
      include: { loan: { include: { schedule: { orderBy: { installmentNumber: 'asc' } } } } },
    })
    if (!refund) throw new Error('NOT_FOUND')

    // Claim the refund — only REQUESTED/PROCESSING may complete
    // (RefundStatus has no PENDING value).
    const claimed = await tx.refund.updateMany({
      where: { id: refund.id, status: { in: ['REQUESTED', 'PROCESSING'] } },
      data: { status: 'COMPLETED', processedAt: new Date() },
    })
    if (claimed.count === 0) {
      throw new Error(refund.status === 'COMPLETED' ? 'ALREADY_COMPLETED' : 'NOT_COMPLETABLE')
    }

    // Target payment: the refund's recorded paymentId; fall back to the
    // latest ALLOCATED payment on the loan only when paymentId is null.
    const originalPayment = (refund as any).paymentId
      ? await tx.payment.findUnique({ where: { id: (refund as any).paymentId } })
      : await tx.payment.findFirst({
          where: { loanId: refund.loanId, status: 'ALLOCATED' },
          orderBy: { allocatedAt: 'desc' },
        })
    if (!originalPayment || originalPayment.loanId !== refund.loanId) {
      throw new Error('NO_PAYMENT')
    }

    const debitAccount = originalPayment.method === 'CASH' ? ACCOUNTS.CASH : ACCOUNTS.BANK

    // Proportional reversal of the refund amount across the payment's
    // allocated components, capped at the remaining allocation.
    const refundAmount = BigInt(refund.amount)
    const allocFees = BigInt(originalPayment.allocatedFees)
    const allocInterest = BigInt(originalPayment.allocatedInterest)
    const allocPrincipal = BigInt(originalPayment.allocatedPrincipal)
    const allocTotal = allocFees + allocInterest + allocPrincipal
    if (allocTotal <= BigInt(0)) throw new Error('NO_ALLOCATION')

    const effective = refundAmount > allocTotal ? allocTotal : refundAmount
    // Largest-remainder proportional split so components sum exactly.
    const share = (part: bigint) => (effective * part) / allocTotal
    let revFees = share(allocFees)
    let revInterest = share(allocInterest)
    let revPrincipal = share(allocPrincipal)
    let remainder = effective - (revFees + revInterest + revPrincipal)
    // Hand the rounding remainder to the largest component with headroom.
    const bySize: Array<{ get: () => bigint; cap: bigint; set: (v: bigint) => void }> = [
      { get: () => revFees, cap: allocFees, set: (v) => { revFees = v } },
      { get: () => revInterest, cap: allocInterest, set: (v) => { revInterest = v } },
      { get: () => revPrincipal, cap: allocPrincipal, set: (v) => { revPrincipal = v } },
    ].sort((a, b) => (b.cap > a.cap ? 1 : b.cap < a.cap ? -1 : 0))
    for (const slot of bySize) {
      if (remainder <= BigInt(0)) break
      const add = remainder > slot.cap - slot.get() ? slot.cap - slot.get() : remainder
      slot.set(slot.get() + add)
      remainder -= add
    }

    // Reverse the allocation against installments (newest first), taking
    // exactly revFees/revInterest/revPrincipal in total.
    let remFees = revFees
    let remInterest = revInterest
    let remPrincipal = revPrincipal
    const schedule = [...refund.loan.schedule].reverse()
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)

    for (const inst of schedule) {
      if (remFees <= BigInt(0) && remInterest <= BigInt(0) && remPrincipal <= BigInt(0)) break
      const paidFees = BigInt(inst.paidFees)
      const paidInterest = BigInt(inst.paidInterest)
      const paidPrincipal = BigInt(inst.paidPrincipal)
      if (paidFees + paidInterest + paidPrincipal <= BigInt(0)) continue

      const takeFees = remFees > paidFees ? paidFees : remFees
      const takeInterest = remInterest > paidInterest ? paidInterest : remInterest
      const takePrincipal = remPrincipal > paidPrincipal ? paidPrincipal : remPrincipal
      remFees -= takeFees
      remInterest -= takeInterest
      remPrincipal -= takePrincipal

      const newPaidFees = paidFees - takeFees
      const newPaidInterest = paidInterest - takeInterest
      const newPaidPrincipal = paidPrincipal - takePrincipal
      const newPaidAmount = newPaidFees + newPaidInterest + newPaidPrincipal

      const fullyPaid =
        newPaidFees >= BigInt(inst.feesComponent) &&
        newPaidInterest >= BigInt(inst.interestComponent) &&
        newPaidPrincipal >= BigInt(inst.principalComponent)
      let newStatus: string
      if (fullyPaid) newStatus = 'PAID'
      else if (newPaidAmount > BigInt(0)) newStatus = 'PARTIALLY_PAID'
      else if (new Date(inst.dueDate) < startOfToday) newStatus = 'OVERDUE'
      else if (new Date(inst.dueDate) <= new Date()) newStatus = 'DUE'
      else newStatus = 'UPCOMING'

      await tx.installment.update({
        where: { id: inst.id },
        data: {
          paidFees: Number(newPaidFees),
          paidInterest: Number(newPaidInterest),
          paidPrincipal: Number(newPaidPrincipal),
          paidAmount: Number(newPaidAmount),
          status: newStatus as any,
          paidAt: fullyPaid ? inst.paidAt : null,
        },
      })
    }

    // Ledger reversals INSIDE the tx — prefer reversing the payment's real
    // ledger entries (matched by paymentNumber reference, capped per
    // component); fall back to component reversals referenced by the
    // payment number when no entries are findable.
    const components = [
      { amount: revFees, type: 'PAYMENT_FEES' as const, debit: ACCOUNTS.FEE_INCOME, label: 'fees' },
      { amount: revInterest, type: 'PAYMENT_INTEREST' as const, debit: ACCOUNTS.INTEREST_INCOME, label: 'interest' },
      { amount: revPrincipal, type: 'PAYMENT_PRINCIPAL' as const, debit: ACCOUNTS.LOANS_RECEIVABLE, label: 'principal' },
    ]
    for (const comp of components) {
      if (comp.amount <= BigInt(0)) continue
      const realEntries = await tx.ledgerEntry.findMany({
        where: {
          organizationId: orgId,
          reference: originalPayment.paymentNumber,
          type: comp.type,
        },
        orderBy: { createdAt: 'asc' },
      })
      const alreadyReversed = await tx.ledgerEntry.findMany({
        where: {
          organizationId: orgId,
          type: 'REVERSAL',
          reference: { in: realEntries.map((e: any) => e.entryNumber) },
        },
        select: { reference: true, amount: true },
      })
      const reversedByEntry = new Map<string, bigint>()
      // Map reversal rows back via their reference (original entryNumber).
      // A reversal row's own reference is the original entryNumber.
      for (const r of alreadyReversed) {
        if (r.reference) reversedByEntry.set(r.reference, (reversedByEntry.get(r.reference) ?? BigInt(0)) + BigInt(r.amount))
      }

      let left = comp.amount
      for (const entry of realEntries) {
        if (left <= BigInt(0)) break
        const entryAlready = reversedByEntry.get(entry.entryNumber) ?? BigInt(0)
        const entryHeadroom = BigInt(entry.amount) - entryAlready
        if (entryHeadroom <= BigInt(0)) continue
        const take = left > entryHeadroom ? entryHeadroom : left
        if (take === BigInt(entry.amount) && entryAlready === BigInt(0)) {
          await postReversal({ originalEntryId: entry.id, reason: `Refund ${refund.id}` }, tx)
        } else {
          await postLedger({
            organizationId: orgId,
            loanId: refund.loanId,
            paymentId: originalPayment.id,
            type: 'REVERSAL',
            debitAccount: comp.debit,
            creditAccount: debitAccount,
            amount: take,
            description: `Partial reversal of ${entry.entryNumber} for refund ${refund.id} (${comp.label})`,
            reference: entry.entryNumber,
          }, tx)
        }
        left -= take
      }
      if (left > BigInt(0)) {
        await postReversal({
          organizationId: orgId,
          loanId: refund.loanId,
          paymentId: originalPayment.id,
          originalEntryNumber: originalPayment.paymentNumber,
          reason: `Refund ${refund.id} (${comp.label})`,
          amount: left,
          debitAccount: comp.debit,
          creditAccount: debitAccount,
        }, tx)
      }
    }

    // Restore loan outstanding by component + reopen a CLOSED loan.
    const loan = refund.loan
    const newOutstandingTotal =
      loan.outstandingPrincipal + Number(revPrincipal) +
      loan.outstandingInterest + Number(revInterest) +
      loan.outstandingFees + Number(revFees)
    await tx.loan.update({
      where: { id: refund.loanId },
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

    // Reduce the payment's allocation; REJECTED only when fully reversed.
    const fullyReversed =
      allocFees - revFees === BigInt(0) &&
      allocInterest - revInterest === BigInt(0) &&
      allocPrincipal - revPrincipal === BigInt(0)
    await tx.payment.update({
      where: { id: originalPayment.id },
      data: {
        allocatedFees: Number(allocFees - revFees),
        allocatedInterest: Number(allocInterest - revInterest),
        allocatedPrincipal: Number(allocPrincipal - revPrincipal),
        ...(fullyReversed ? { status: 'REJECTED' as const } : {}),
      },
    })

    // Notify candidate
    if (refund.loan.candidateId) {
      const candidate = await tx.candidate.findUnique({ where: { id: refund.loan.candidateId } })
      if (candidate?.userId) {
        await tx.notification.create({
          data: {
            organizationId: orgId,
            userId: candidate.userId,
            candidateId: candidate.id,
            type: 'PAYMENT_CONFIRMATION',
            title: 'Refund processed',
            message: `Refund of ₹${refund.amount / 100} for loan ${refund.loan.loanNumber} has been processed.`,
            isRead: false,
            metadata: { refundId: refund.id, loanId: refund.loanId },
          },
        })
      }
    }

    return {
      refund,
      reversedFees: revFees,
      reversedInterest: revInterest,
      reversedPrincipal: revPrincipal,
      fullyReversed,
    }
  }, { maxWait: 15000, timeout: 30000 }).catch((err: any) => {
    if (err?.message === 'ALREADY_COMPLETED') return { error: 'completed' as const }
    if (err?.message === 'NOT_COMPLETABLE') return { error: 'state' as const }
    if (err?.message === 'NO_PAYMENT') return { error: 'no-payment' as const }
    if (err?.message === 'NO_ALLOCATION') return { error: 'no-allocation' as const }
    if (err?.message === 'NOT_FOUND') return { error: 'not-found' as const }
    throw err
  })

  if ('error' in result) {
    if (result.error === 'completed') return conflict('Refund already completed')
    if (result.error === 'state') return conflict('Refund is not in a completable state')
    if (result.error === 'not-found') return notFound('Refund not found')
    return badRequest('No allocated payment to refund against')
  }

  await audit(ctx, 'REFUND', 'Refund', result.refund.id, `Refund ₹${result.refund.amount / 100} completed for loan ${result.refund.loan.loanNumber} (reversed fees=${result.reversedFees} interest=${result.reversedInterest} principal=${result.reversedPrincipal})`)

  return success({ id: result.refund.id, status: 'COMPLETED', processedAt: new Date() })
})
