// Shared payment capture logic — used by the webhook handler and the cash verification flow.
//
// MONEY-INTEGRITY RULES (industry hardening):
// - capturePayment / verifyCashPayment do EVERYTHING inside ONE transaction,
//   row-locking the Payment (then the Loan) and re-reading status inside the tx.
//   Nothing is allocated from a stale snapshot read outside the transaction.
// - A payment is capturable ONLY from INITIATED / PENDING_VERIFICATION / VERIFIED,
//   only against an ACTIVE loan, and only for amount > 0. ALLOCATED is an
//   idempotent no-op; FAILED / REJECTED are a hard conflict — never re-allocated.
// - Allocation is capped at total outstanding; any excess is `unallocated` AND
//   gets a ledger entry into the Unallocated Payments suspense account.
// - Ledger debit account follows the payment method: CASH -> Cash in Hand,
//   everything else -> Bank Account.
// - Cash collections allocate IMMEDIATELY when recorded (collectCashPayment):
//   allocation happens inside the creation transaction and the payment sits
//   in PENDING_VERIFICATION with outstanding already reduced. Owner verify
//   (verifyCashPayment) is a confirmation only — no money moves. Owner reject
//   (reverseCashPayment) fully reverses the allocation.

import { db } from '@/lib/db'
import { auditRaw } from '@/lib/server/auth'
import {
  allocatePayment, parsePaise, serializePaise,
} from '@/lib/server/financial'
import { postLedger, postReversal, ACCOUNTS } from '@/lib/server/ledger'
import { genNumber, HttpError } from '@/lib/server/api'

const CAPTURABLE_STATUSES = ['INITIATED', 'PENDING_VERIFICATION', 'VERIFIED'] as const

function debitAccountForMethod(method: string): string {
  return method === 'CASH' ? ACCOUNTS.CASH : ACCOUNTS.BANK
}

async function lockPaymentRow(tx: any, paymentId: string) {
  await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`
}

async function lockLoanRow(tx: any, loanId: string) {
  await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loanId} FOR UPDATE`
}

export interface AllocationOutcome {
  receiptNumber: string
  allocatedFees: bigint
  allocatedInterest: bigint
  allocatedPrincipal: bigint
  unallocated: bigint
  perInstallment: Array<{ installmentNumber: number; fees: bigint; interest: bigint; principal: bigint }>
  loanClosed: boolean
}

/**
 * Applies a payment allocation inside an ALREADY-OPEN transaction whose
 * caller has locked the payment + loan rows and re-read them.
 * Updates installments, the payment row, loan totals, and posts ledger
 * entries (including a suspense entry for any unallocated excess).
 */
async function applyAllocationInTx(
  tx: any,
  args: {
    organizationId: string
    payment: any
    loan: any // loan with schedule (asc) + candidate
    amount: bigint
    finalStatus: 'ALLOCATED' | 'VERIFIED' | 'PENDING_VERIFICATION'
    verifiedById?: string | null
    providerEventId?: string | null
    ledgerDescriptionPrefix: string
  },
): Promise<AllocationOutcome> {
  const { payment, loan } = args
  const now = new Date()
  const debitAccount = debitAccountForMethod(payment.method)

  const installments = loan.schedule.map((i: any) => ({
    installmentNumber: i.installmentNumber,
    fees: BigInt(i.feesComponent),
    interest: BigInt(i.interestComponent),
    principal: BigInt(i.principalComponent),
    paidFees: BigInt(i.paidFees),
    paidInterest: BigInt(i.paidInterest),
    paidPrincipal: BigInt(i.paidPrincipal),
  }))

  const allocation = allocatePayment(installments, args.amount)
  const receiptNumber =
    payment.receiptNumber ||
    `RCP-${genNumber('').split('-')[1] || Date.now().toString(36).toUpperCase()}`

  for (const alloc of allocation.perInstallment) {
    const inst = loan.schedule.find((i: any) => i.installmentNumber === alloc.installmentNumber)
    if (!inst) continue

    const newPaidFees = BigInt(inst.paidFees) + alloc.fees
    const newPaidInterest = BigInt(inst.paidInterest) + alloc.interest
    const newPaidPrincipal = BigInt(inst.paidPrincipal) + alloc.principal
    const newPaidAmount = newPaidFees + newPaidInterest + newPaidPrincipal

    const fullyPaid =
      newPaidFees >= BigInt(inst.feesComponent) &&
      newPaidInterest >= BigInt(inst.interestComponent) &&
      newPaidPrincipal >= BigInt(inst.principalComponent)
    const partiallyPaid = newPaidAmount > BigInt(0) && !fullyPaid
    const newStatus = fullyPaid ? 'PAID' : partiallyPaid ? 'PARTIALLY_PAID' : inst.status

    await tx.installment.update({
      where: { id: inst.id },
      data: {
        paidFees: Number(newPaidFees),
        paidInterest: Number(newPaidInterest),
        paidPrincipal: Number(newPaidPrincipal),
        paidAmount: Number(newPaidAmount),
        status: newStatus as any,
        paidAt: fullyPaid ? now : inst.paidAt,
      },
    })
  }

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: args.finalStatus,
      allocatedFees: Number(allocation.allocatedFees),
      allocatedInterest: Number(allocation.allocatedInterest),
      allocatedPrincipal: Number(allocation.allocatedPrincipal),
      unallocated: Number(allocation.unallocated),
      allocatedAt: now,
      receiptNumber,
      providerEventId: args.providerEventId ?? payment.providerEventId,
      ...(args.finalStatus === 'VERIFIED'
        ? { verifiedById: args.verifiedById ?? payment.verifiedById, verifiedAt: now }
        : {}),
    },
  })

  const nextPrincipal = Math.max(0, loan.outstandingPrincipal - Number(allocation.allocatedPrincipal))
  const nextInterest = Math.max(0, loan.outstandingInterest - Number(allocation.allocatedInterest))
  const nextFees = Math.max(0, loan.outstandingFees - Number(allocation.allocatedFees))
  const isFullyRepaid = nextPrincipal === 0 && nextInterest === 0 && nextFees === 0

  await tx.loan.update({
    where: { id: loan.id },
    data: {
      outstandingPrincipal: nextPrincipal,
      outstandingInterest: nextInterest,
      outstandingFees: nextFees,
      totalCollected: { increment: Number(args.amount) - Number(allocation.unallocated) },
      version: { increment: 1 },
      ...(isFullyRepaid && loan.status === 'ACTIVE' ? { status: 'CLOSED', closedAt: now } : {}),
    },
  })

  // Ledger — one entry per allocation component, debited from the account
  // that matches how the money actually arrived (cash vs bank).
  if (allocation.allocatedFees > BigInt(0)) {
    await postLedger({
      organizationId: args.organizationId,
      loanId: loan.id,
      paymentId: payment.id,
      type: 'PAYMENT_FEES',
      debitAccount,
      creditAccount: ACCOUNTS.FEE_INCOME,
      amount: allocation.allocatedFees,
      description: `${args.ledgerDescriptionPrefix} fee allocation for payment ${payment.paymentNumber}`,
      reference: payment.paymentNumber,
    }, tx)
  }
  if (allocation.allocatedInterest > BigInt(0)) {
    await postLedger({
      organizationId: args.organizationId,
      loanId: loan.id,
      paymentId: payment.id,
      type: 'PAYMENT_INTEREST',
      debitAccount,
      creditAccount: ACCOUNTS.INTEREST_INCOME,
      amount: allocation.allocatedInterest,
      description: `${args.ledgerDescriptionPrefix} interest allocation for payment ${payment.paymentNumber}`,
      reference: payment.paymentNumber,
    }, tx)
  }
  if (allocation.allocatedPrincipal > BigInt(0)) {
    await postLedger({
      organizationId: args.organizationId,
      loanId: loan.id,
      paymentId: payment.id,
      type: 'PAYMENT_PRINCIPAL',
      debitAccount,
      creditAccount: ACCOUNTS.LOANS_RECEIVABLE,
      amount: allocation.allocatedPrincipal,
      description: `${args.ledgerDescriptionPrefix} principal allocation for payment ${payment.paymentNumber}`,
      reference: payment.paymentNumber,
    }, tx)
  }
  // Excess over total outstanding is real money received — it MUST appear in
  // the ledger. Park it in the Unallocated Payments suspense account.
  // (Type 'FEE' is the generic non-PAYMENT_* bucket in LedgerEntryType; the
  // suspense nature is carried by the credit account + description.)
  if (allocation.unallocated > BigInt(0)) {
    await postLedger({
      organizationId: args.organizationId,
      loanId: loan.id,
      paymentId: payment.id,
      type: 'FEE',
      debitAccount,
      creditAccount: ACCOUNTS.UNALLOCATED,
      amount: allocation.unallocated,
      description: `Unallocated (suspense) excess for payment ${payment.paymentNumber} — received but exceeds total outstanding, held in Unallocated Payments`,
      reference: payment.paymentNumber,
    }, tx)
  }

  if (loan.candidate?.userId) {
    await tx.notification.create({
      data: {
        organizationId: args.organizationId,
        userId: loan.candidate.userId,
        candidateId: payment.candidateId,
        type: 'PAYMENT_CONFIRMATION',
        title: 'Payment received',
        message: `₹${Number(args.amount) / 100} received for loan ${loan.loanNumber}. Receipt ${receiptNumber}.`,
        isRead: false,
        metadata: { paymentId: payment.id, loanId: loan.id, receiptNumber },
      },
    })
  }

  return {
    receiptNumber,
    allocatedFees: allocation.allocatedFees,
    allocatedInterest: allocation.allocatedInterest,
    allocatedPrincipal: allocation.allocatedPrincipal,
    unallocated: allocation.unallocated,
    perInstallment: allocation.perInstallment,
    loanClosed: isFullyRepaid,
  }
}

/**
 * Recomputes every installment's paid amounts from the payments that remain
 * valid for a loan, and persists them. Shared by reverseCashPayment and the
 * financial-correction approval flow.
 *
 * A payment contributes its ALLOCATED total (allocatedFees+Interest+Principal),
 * re-run through the FIFO allocation waterfall in payment order — so reducing
 * a payment's allocated* fields (correction) or excluding it (reversal)
 * flows through correctly. Baseline amounts paid before any Payment row
 * existed (seeded data) are preserved.
 */
export async function recomputeInstallmentsFromPayments(
  tx: any,
  loan: any, // loan with schedule (asc) + candidate?, disbursedAt, createdAt
  opts: {
    excludePaymentIds?: string[]
    now?: Date
    /**
     * Allocation totals the CURRENT schedule was built from, per payment id,
     * when they differ from what is stored now — e.g. a correction in the
     * same transaction has just reduced a payment's allocated* fields. The
     * baseline (seed-paid) computation must use these, or the reduced amount
     * would be mistaken for baseline and re-applied.
     */
    knownAllocations?: Record<string, bigint>
  } = {},
): Promise<void> {
  const now = opts.now ?? new Date()
  const excludeIds = opts.excludePaymentIds ?? []

  const remainingPayments = await tx.payment.findMany({
    where: {
      loanId: loan.id,
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      status: { in: ['PENDING_VERIFICATION', 'VERIFIED', 'ALLOCATED'] },
    },
    orderBy: [{ createdAt: 'asc' }],
  })

  // Only payments that actually allocated funds count. A cash payment in
  // PENDING_VERIFICATION allocated at collection time, so it counts via its
  // allocated* fields / allocatedAt; a payment with no allocation contributes 0.
  const allocatedRemaining = remainingPayments.filter(
    (p: any) =>
      p.allocatedAt !== null ||
      p.status === 'VERIFIED' ||
      p.status === 'ALLOCATED' ||
      p.allocatedPrincipal > 0 ||
      p.allocatedInterest > 0 ||
      p.allocatedFees > 0,
  )

  const excludedPayments = excludeIds.length
    ? await tx.payment.findMany({ where: { id: { in: excludeIds } } })
    : []
  const excludedAllocated = excludedPayments.reduce(
    (sum: bigint, p: any) => sum + BigInt(p.allocatedFees) + BigInt(p.allocatedInterest) + BigInt(p.allocatedPrincipal),
    BigInt(0),
  )
  const currentSchedulePaid = loan.schedule.reduce(
    (sum: bigint, inst: any) => sum + BigInt(inst.paidFees) + BigInt(inst.paidInterest) + BigInt(inst.paidPrincipal),
    BigInt(0),
  )
  const remainingAllocatedSum = allocatedRemaining.reduce(
    (sum: bigint, p: any) =>
      sum +
      (opts.knownAllocations?.[p.id] ??
        (BigInt(p.allocatedFees) + BigInt(p.allocatedInterest) + BigInt(p.allocatedPrincipal))),
    BigInt(0),
  )
  const baselineSeedPaid: bigint = BigInt(
    currentSchedulePaid > excludedAllocated + remainingAllocatedSum
      ? currentSchedulePaid - (excludedAllocated + remainingAllocatedSum)
      : BigInt(0),
  )

  const scheduleState = loan.schedule.map((inst: any) => ({
    id: inst.id,
    installmentNumber: inst.installmentNumber,
    dueDate: inst.dueDate,
    fees: BigInt(inst.feesComponent),
    interest: BigInt(inst.interestComponent),
    principal: BigInt(inst.principalComponent),
    paidFees: BigInt(0),
    paidInterest: BigInt(0),
    paidPrincipal: BigInt(0),
    paidAt: null as Date | null,
  }))

  const applyAmountToSchedule = (amt: bigint, paidDate: Date) => {
    if (amt <= BigInt(0)) return
    const alloc = allocatePayment(scheduleState, amt)
    for (const item of alloc.perInstallment) {
      const st = scheduleState.find((s) => s.installmentNumber === item.installmentNumber)
      if (!st) continue
      st.paidFees += item.fees
      st.paidInterest += item.interest
      st.paidPrincipal += item.principal
      const isFull =
        st.paidFees >= st.fees && st.paidInterest >= st.interest && st.paidPrincipal >= st.principal
      if (isFull && !st.paidAt) st.paidAt = paidDate
    }
  }

  if (baselineSeedPaid > BigInt(0)) {
    applyAmountToSchedule(baselineSeedPaid, loan.disbursedAt ?? loan.createdAt)
  }
  for (const vp of allocatedRemaining) {
    const allocatedTotal =
      BigInt(vp.allocatedFees) + BigInt(vp.allocatedInterest) + BigInt(vp.allocatedPrincipal)
    // Legacy rows with a status of VERIFIED/ALLOCATED but zeroed allocation
    // fields fall back to their full amount.
    const effective = allocatedTotal > BigInt(0) ? allocatedTotal : BigInt(vp.amount)
    applyAmountToSchedule(effective, vp.allocatedAt ?? vp.createdAt)
  }

  for (const st of scheduleState) {
    const paidAmount = st.paidFees + st.paidInterest + st.paidPrincipal
    const fullyPaid =
      st.paidFees >= st.fees && st.paidInterest >= st.interest && st.paidPrincipal >= st.principal

    let newStatus: 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'UPCOMING'
    if (fullyPaid) newStatus = 'PAID'
    else if (paidAmount > BigInt(0)) newStatus = 'PARTIALLY_PAID'
    else if (new Date(st.dueDate) < now) newStatus = 'OVERDUE'
    else newStatus = 'UPCOMING'

    await tx.installment.update({
      where: { id: st.id },
      data: {
        paidFees: Number(st.paidFees),
        paidInterest: Number(st.paidInterest),
        paidPrincipal: Number(st.paidPrincipal),
        paidAmount: Number(paidAmount),
        status: newStatus,
        paidAt: fullyPaid ? st.paidAt ?? now : null,
      },
    })
  }
}

export interface CaptureInput {
  paymentId: string
  organizationId: string
  userId?: string | null // who triggered the capture (system for webhook)
  channel: 'WEBHOOK' | 'CASH_VERIFICATION' | 'MANUAL'
  providerEventId?: string | null
}

export interface CaptureResult {
  receiptNumber: string
  allocatedFees: bigint
  allocatedInterest: bigint
  allocatedPrincipal: bigint
  unallocated: bigint
  perInstallment: any[]
  /** True when the payment was already ALLOCATED — nothing was re-allocated. */
  noop?: boolean
}

export async function capturePayment(input: CaptureInput): Promise<CaptureResult> {
  // Tenant pre-check (cheap, outside tx). ALL state decisions are re-made
  // inside the transaction below from locked, freshly-read rows.
  const preCheck = await db.payment.findUnique({
    where: { id: input.paymentId },
    select: { id: true, organizationId: true },
  })
  if (!preCheck) throw new Error('Payment not found')
  if (preCheck.organizationId !== input.organizationId) {
    throw new Error('Forbidden: tenant isolation violated')
  }

  const outcome = await db.$transaction(async (tx) => {
    await lockPaymentRow(tx, input.paymentId)

    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        loan: { include: { schedule: { orderBy: { installmentNumber: 'asc' } }, candidate: true } },
      },
    })
    if (!payment) throw new Error('Payment not found')
    if (payment.organizationId !== input.organizationId) {
      throw new Error('Forbidden: tenant isolation violated')
    }

    // Idempotent no-op: already allocated — never allocate twice.
    if (payment.status === 'ALLOCATED') {
      return { kind: 'noop' as const, payment }
    }
    if (!(CAPTURABLE_STATUSES as readonly string[]).includes(payment.status)) {
      throw new HttpError(
        'CONFLICT',
        `Payment in status ${payment.status} cannot be captured`,
        409,
      )
    }

    await lockLoanRow(tx, payment.loanId)
    const loan = await tx.loan.findUnique({
      where: { id: payment.loanId },
      include: { schedule: { orderBy: { installmentNumber: 'asc' } }, candidate: true },
    })
    if (!loan) throw new Error('Payment loan not found')
    if (loan.status !== 'ACTIVE') {
      throw new HttpError(
        'CONFLICT',
        `Loan is ${loan.status}; payments can only be captured against an ACTIVE loan`,
        409,
      )
    }

    const amount = parsePaise(payment.amount)
    if (amount <= BigInt(0)) {
      throw new HttpError('BAD_REQUEST', 'Payment amount must be positive', 400)
    }

    const applied = await applyAllocationInTx(tx, {
      organizationId: input.organizationId,
      payment,
      loan,
      amount,
      finalStatus: 'ALLOCATED',
      providerEventId: input.providerEventId ?? null,
      ledgerDescriptionPrefix: 'Payment',
    })
    return { kind: 'applied' as const, payment, applied }
  }, { maxWait: 15000, timeout: 30000 })

  if (outcome.kind === 'noop') {
    const p = outcome.payment
    return {
      receiptNumber: p.receiptNumber ?? '',
      allocatedFees: BigInt(p.allocatedFees),
      allocatedInterest: BigInt(p.allocatedInterest),
      allocatedPrincipal: BigInt(p.allocatedPrincipal),
      unallocated: BigInt(p.unallocated),
      perInstallment: [],
      noop: true,
    }
  }

  const { payment, applied } = outcome
  await auditRaw(
    input.organizationId,
    input.userId ?? null,
    'ALLOCATE',
    'Payment',
    payment.id,
    `Allocated payment ${payment.paymentNumber} via ${input.channel}: fees=${serializePaise(applied.allocatedFees)} interest=${serializePaise(applied.allocatedInterest)} principal=${serializePaise(applied.allocatedPrincipal)} unallocated=${serializePaise(applied.unallocated)} receipt=${applied.receiptNumber}`,
    { paymentId: payment.id, loanId: payment.loanId, channel: input.channel },
  )

  return {
    receiptNumber: applied.receiptNumber,
    allocatedFees: applied.allocatedFees,
    allocatedInterest: applied.allocatedInterest,
    allocatedPrincipal: applied.allocatedPrincipal,
    unallocated: applied.unallocated,
    perInstallment: applied.perInstallment.map((p) => ({
      installmentNumber: p.installmentNumber,
      fees: serializePaise(p.fees),
      interest: serializePaise(p.interest),
      principal: serializePaise(p.principal),
    })),
  }
}

export interface CollectCashInput {
  organizationId: string
  agentUserId: string
  loanId: string
  candidateId?: string
  amountPaise: bigint
  collectionDate?: string | null
  reference?: string | null
  notes?: string | null
  proofUrl?: string | null
  idempotencyKey?: string | null
}

function assertIdempotentReplayMatches(existing: any, input: CollectCashInput) {
  if (existing.loanId !== input.loanId) {
    throw new HttpError('CONFLICT', 'Idempotency key was already used for a different loan', 409)
  }
  if (input.candidateId && existing.candidateId !== input.candidateId) {
    throw new HttpError('CONFLICT', 'Idempotency key was already used for a different candidate', 409)
  }
  if (BigInt(existing.amount) !== input.amountPaise) {
    throw new HttpError('CONFLICT', 'Idempotency key was already used with a different amount', 409)
  }
}

function cashRecordResult(existing: any, loanNumber: string, candidateName: string, replay: boolean) {
  return {
    id: existing.id,
    paymentId: existing.id,
    paymentNumber: existing.paymentNumber,
    receiptNumber: existing.receiptNumber,
    amount: String(existing.amount),
    status: existing.status,
    verificationStatus:
      existing.status === 'VERIFIED' || existing.verifiedAt
        ? ('VERIFIED' as const)
        : ('PENDING_VERIFICATION' as const),
    allocatedFees: String(existing.allocatedFees),
    allocatedInterest: String(existing.allocatedInterest),
    allocatedPrincipal: String(existing.allocatedPrincipal),
    unallocated: String(existing.unallocated),
    loanId: existing.loanId,
    loanNumber,
    candidateId: existing.candidateId,
    candidateName,
    createdAt: existing.createdAt,
    allocatedAt: existing.allocatedAt,
    idempotentReplay: replay,
  }
}

/**
 * Records a cash collection AND allocates it immediately (installments,
 * loan balances, ledger — all inside the creation transaction, under the
 * loan row lock). This is the product's contract, encoded in the E2E
 * lifecycle spec: the borrower's outstanding drops when the agent collects,
 * the payment sits as PENDING_VERIFICATION, owner VERIFY confirms it, and
 * owner REJECT fully reverses the allocation (reverseCashPayment restores
 * installments, balances and ledger, and reopens a closed loan). The
 * earlier verify-time-allocation redesign broke that contract, so
 * allocation lives here again — with the hardening kept: row locks,
 * in-tx outstanding re-checks, idempotency, and a fully reversible trail.
 */
export async function collectCashPayment(input: CollectCashInput) {
  const cleanKey = input.idempotencyKey?.trim() || null

  if (cleanKey) {
    const existing = await db.payment.findUnique({
      where: { idempotencyKey: cleanKey },
      include: { loan: { include: { candidate: true } } },
    })
    if (existing && existing.organizationId === input.organizationId) {
      assertIdempotentReplayMatches(existing, input)
      return cashRecordResult(existing, existing.loan.loanNumber, existing.loan.candidate.fullName, true)
    }
  }

  const loan = await db.loan.findUnique({
    where: { id: input.loanId },
    include: { candidate: { include: { assignedAgent: true } } },
  })

  if (!loan || loan.organizationId !== input.organizationId) {
    throw new Error('NOT_FOUND: Loan not found')
  }
  if (input.candidateId && loan.candidateId !== input.candidateId) {
    throw new Error('BAD_REQUEST: Loan does not belong to the specified candidate')
  }
  if (loan.status !== 'ACTIVE') {
    throw new Error('BAD_REQUEST: Loan is not active')
  }

  // Agent assignment check (RBAC / IDOR)
  const agentProfile = await db.agentProfile.findUnique({
    where: { userId: input.agentUserId },
  })
  if (loan.candidate.assignedAgentId && loan.candidate.assignedAgentId !== agentProfile?.id) {
    const hasTask = agentProfile
      ? await db.collectionTask.findFirst({
          where: { loanId: loan.id, assignedToId: agentProfile.id },
        })
      : null
    if (!hasTask) {
      throw new Error('FORBIDDEN: You are not assigned to this loan')
    }
  }

  if (input.amountPaise <= BigInt(0)) {
    throw new Error('BAD_REQUEST: Amount must be positive')
  }

  const totalOutstanding =
    BigInt(loan.outstandingPrincipal) + BigInt(loan.outstandingInterest) + BigInt(loan.outstandingFees)
  if (input.amountPaise > totalOutstanding) {
    throw new Error('BAD_REQUEST: Amount exceeds total outstanding balance')
  }

  // Payment has no dedicated collectionDate column; the recorded collection
  // date is the row's createdAt (the agent list API maps collectionDate from
  // createdAt), so a valid supplied collectionDate is stored there.
  let collectionDate: Date | undefined
  if (input.collectionDate) {
    const parsed = new Date(input.collectionDate)
    if (!Number.isNaN(parsed.getTime())) collectionDate = parsed
  }

  const paymentNumber = genNumber('PAY')
  const receiptNumber = genNumber('RCP')

  try {
    const createdPayment = await db.$transaction(async (tx) => {
      // Lock the loan row and re-check status/outstanding inside the tx so
      // two concurrent recordings can't both validate against stale totals.
      await lockLoanRow(tx, loan.id)
      const lockedLoan = await tx.loan.findUnique({ where: { id: loan.id } })
      if (!lockedLoan || lockedLoan.status !== 'ACTIVE') {
        throw new Error('BAD_REQUEST: Loan is not active or has already been closed')
      }
      const lockedOutstanding =
        BigInt(lockedLoan.outstandingPrincipal) +
        BigInt(lockedLoan.outstandingInterest) +
        BigInt(lockedLoan.outstandingFees)
      if (input.amountPaise > lockedOutstanding) {
        throw new Error('BAD_REQUEST: Amount exceeds total outstanding balance')
      }

      const created = await tx.payment.create({
        data: {
          organizationId: input.organizationId,
          paymentNumber,
          loanId: loan.id,
          candidateId: loan.candidateId,
          method: 'CASH',
          recordedById: input.agentUserId,
          status: 'PENDING_VERIFICATION',
          verifiedById: null,
          verifiedAt: null,
          amount: Number(input.amountPaise),
          // Allocation fields are written by applyAllocationInTx below,
          // inside this same transaction.
          allocatedFees: 0,
          allocatedInterest: 0,
          allocatedPrincipal: 0,
          unallocated: 0,
          allocatedAt: null,
          receiptNumber,
          idempotencyKey: cleanKey,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          proofUrl: input.proofUrl ?? null,
          ...(collectionDate ? { createdAt: collectionDate } : {}),
        },
      })

      // Allocate immediately (product contract — see the function doc):
      // installments, loan balances and ledger move now; owner VERIFY
      // later only confirms, owner REJECT reverses via reverseCashPayment.
      const loanWithSchedule = await tx.loan.findUnique({
        where: { id: loan.id },
        include: { schedule: { orderBy: { installmentNumber: 'asc' } }, candidate: true },
      })
      if (!loanWithSchedule) {
        throw new Error('NOT_FOUND: Loan not found')
      }
      const applied = await applyAllocationInTx(tx, {
        organizationId: input.organizationId,
        payment: created,
        loan: loanWithSchedule,
        amount: input.amountPaise,
        finalStatus: 'PENDING_VERIFICATION',
        ledgerDescriptionPrefix: 'Cash collection',
      })

      // Notify owners that cash is awaiting verification.
      const owners = await tx.user.findMany({
        where: { organizationId: input.organizationId, role: 'OWNER', isActive: true },
        select: { id: true },
      })
      const amountRupeesStr = (Number(input.amountPaise) / 100).toLocaleString('en-IN')
      for (const owner of owners) {
        await tx.notification.create({
          data: {
            organizationId: input.organizationId,
            userId: owner.id,
            candidateId: loan.candidateId,
            type: 'PAYMENT_CONFIRMATION',
            title: 'Cash collection pending verification',
            message: `Cash payment of ₹${amountRupeesStr} collected for ${loan.candidate.fullName} (${loan.loanNumber}) is pending your verification.`,
            isRead: false,
            metadata: { paymentId: created.id, loanId: loan.id, receiptNumber },
          },
        })
      }

      const updated = await tx.payment.findUnique({ where: { id: created.id } })
      return { payment: updated!, loanClosed: applied.loanClosed }
    }, { maxWait: 15000, timeout: 30000 })

    await auditRaw(
      input.organizationId,
      input.agentUserId,
      'CREATE',
      'Payment',
      createdPayment.payment.id,
      `Recorded cash collection ₹${Number(input.amountPaise) / 100} for ${loan.candidate.fullName} (${loan.loanNumber}). Payment ${paymentNumber}, receipt ${receiptNumber} (allocated immediately; pending owner verification).`,
      { paymentId: createdPayment.payment.id, loanId: loan.id, receiptNumber },
    )

    return {
      ...cashRecordResult(createdPayment.payment, loan.loanNumber, loan.candidate.fullName, false),
      loanClosed: createdPayment.loanClosed,
    }
  } catch (err: any) {
    // P2002 race on idempotencyKey — another request recorded it first.
    if (err?.code === 'P2002' && cleanKey) {
      const existing = await db.payment.findUnique({
        where: { idempotencyKey: cleanKey },
        include: { loan: { include: { candidate: true } } },
      })
      if (existing && existing.organizationId === input.organizationId) {
        assertIdempotentReplayMatches(existing, input)
        return cashRecordResult(existing, existing.loan.loanNumber, existing.loan.candidate.fullName, true)
      }
    }
    throw err
  }
}

export interface VerifyCashInput {
  paymentId: string
  organizationId: string
  verifiedById: string
}

/**
 * Owner verification of a cash collection — confirmation only. No money
 * moves here: allocation to installments already happened at collection
 * time inside collectCashPayment's transaction. This flips the payment
 * PENDING_VERIFICATION → VERIFIED, stamps the verifier, and resolves open
 * collection tasks.
 */
export async function verifyCashPayment(input: VerifyCashInput) {
  const preCheck = await db.payment.findUnique({
    where: { id: input.paymentId },
    select: { id: true, organizationId: true },
  })
  if (!preCheck) throw new Error('NOT_FOUND: Cash collection not found')
  if (preCheck.organizationId !== input.organizationId) {
    throw new Error('NOT_FOUND: Cash collection not found')
  }

  const outcome = await db.$transaction(async (tx) => {
    await lockPaymentRow(tx, input.paymentId)

    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        loan: { include: { schedule: { orderBy: { installmentNumber: 'asc' } }, candidate: true } },
      },
    })
    if (!payment || payment.organizationId !== input.organizationId) {
      throw new Error('NOT_FOUND: Cash collection not found')
    }
    if (payment.method !== 'CASH') {
      throw new HttpError('BAD_REQUEST', 'Only cash payments are verified via this flow', 400)
    }
    if (payment.status !== 'PENDING_VERIFICATION') {
      throw new HttpError('CONFLICT', 'Cash collection is not pending verification', 409)
    }

    // Allocation already happened at collection time (product contract —
    // see collectCashPayment). Verification is a confirmation: flip the
    // status, stamp the verifier, settle the collection tasks. No money
    // moves here; owner REJECT (reverseCashPayment) is what moves it back.
    const now = new Date()
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'VERIFIED', verifiedById: input.verifiedById, verifiedAt: now },
    })

    const loan = await tx.loan.findUnique({
      where: { id: payment.loanId },
      select: { id: true, status: true },
    })
    if (!loan) throw new Error('NOT_FOUND: Loan not found')

    // Verification settles the collection work for this loan.
    await tx.collectionTask.updateMany({
      where: { loanId: loan.id, status: { in: ['OPEN', 'ASSIGNED'] } },
      data: { status: 'RESOLVED', outcome: 'Cash collected and verified' },
    })

    return { payment: updated, loan }
  }, { maxWait: 15000, timeout: 30000 })

  const { payment, loan } = outcome
  await auditRaw(
    input.organizationId,
    input.verifiedById,
    'ALLOCATE',
    'Payment',
    payment.id,
    `Verified cash collection ${payment.paymentNumber}: fees=${payment.allocatedFees} interest=${payment.allocatedInterest} principal=${payment.allocatedPrincipal} unallocated=${payment.unallocated} receipt=${payment.receiptNumber} (allocation was applied at collection time; verification confirms it)`,
    { paymentId: payment.id, loanId: payment.loanId, channel: 'CASH_VERIFICATION' },
  )

  return {
    id: payment.id,
    paymentId: payment.id,
    paymentNumber: payment.paymentNumber,
    receiptNumber: payment.receiptNumber,
    amount: String(payment.amount),
    status: 'VERIFIED' as const,
    allocatedFees: String(payment.allocatedFees),
    allocatedInterest: String(payment.allocatedInterest),
    allocatedPrincipal: String(payment.allocatedPrincipal),
    unallocated: String(payment.unallocated),
    loanId: payment.loanId,
    loanClosed: loan.status === 'CLOSED',
  }
}

export interface ReverseCashInput {
  paymentId: string
  organizationId: string
  ownerUserId: string
  rejectionReason: string
}

/**
 * Rejects a cash collection (or reverses a VERIFIED one).
 * Cash collections allocate at collection time, so a PENDING_VERIFICATION
 * payment already holds an allocation — rejecting it runs the full
 * reversal: ledger REVERSAL entries, installment recompute from remaining
 * payments, loan balances restored, CLOSED loan reopened. A VERIFIED
 * payment being reversed goes through the same path.
 * The status guard runs INSIDE the transaction (updateMany on the expected
 * status set, abort when 0 rows) so two concurrent rejects cannot both pass
 * a stale read and double-reverse.
 */
export async function reverseCashPayment(input: ReverseCashInput) {
  const now = new Date()

  const result = await db.$transaction(async (tx) => {
    await lockPaymentRow(tx, input.paymentId)

    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        loan: {
          include: {
            schedule: { orderBy: { installmentNumber: 'asc' } },
            candidate: true,
          },
        },
      },
    })

    if (!payment || payment.organizationId !== input.organizationId) {
      throw new Error('NOT_FOUND: Cash collection not found')
    }
    if (payment.method !== 'CASH') {
      throw new Error('BAD_REQUEST: Only cash payments can be reversed via this endpoint')
    }
    if (payment.status !== 'PENDING_VERIFICATION' && payment.status !== 'VERIFIED') {
      throw new HttpError(
        'CONFLICT',
        `Cash collection in status ${payment.status} cannot be rejected/reversed`,
        409,
      )
    }

    const wasAllocated =
      payment.allocatedAt !== null ||
      payment.allocatedPrincipal > 0 ||
      payment.allocatedInterest > 0 ||
      payment.allocatedFees > 0

    // Status guard inside the tx: only rows still in the expected status set
    // may transition. A concurrent reject that already committed makes this
    // match 0 rows and aborts the whole transaction.
    const guard = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING_VERIFICATION', 'VERIFIED'] } },
      data: {
        status: 'REJECTED',
        rejectionReason: input.rejectionReason,
        verifiedById: input.ownerUserId,
        verifiedAt: now,
      },
    })
    if (guard.count === 0) {
      throw new HttpError('CONFLICT', 'Cash collection was already processed', 409)
    }

    if (wasAllocated) {
      // Ledger reversals for this payment's real entries (no fabricated
      // entry numbers — reverse the rows that actually exist).
      const paymentLedgerEntries = await tx.ledgerEntry.findMany({
        where: {
          organizationId: input.organizationId,
          reference: payment.paymentNumber,
          type: { not: 'REVERSAL' },
        },
        orderBy: { createdAt: 'asc' },
      })

      if (paymentLedgerEntries.length > 0) {
        const existingReversals = await tx.ledgerEntry.findMany({
          where: {
            organizationId: input.organizationId,
            type: 'REVERSAL',
            reference: { in: paymentLedgerEntries.map((e: any) => e.entryNumber) },
          },
          select: { reference: true },
        })
        const reversedRefs = new Set(existingReversals.map((r: any) => r.reference))

        for (const entry of paymentLedgerEntries) {
          if (!reversedRefs.has(entry.entryNumber)) {
            await postReversal(
              { originalEntryId: entry.id, userId: input.ownerUserId, reason: input.rejectionReason },
              tx,
            )
          }
        }
      } else {
        // Allocated but no ledger rows carry this payment's reference
        // (legacy data): reverse by component against the cash account,
        // referencing the payment number — never an invented LED-* number.
        const comp = [
          { key: 'allocatedFees', amount: payment.allocatedFees, debit: ACCOUNTS.FEE_INCOME, label: 'fees' },
          { key: 'allocatedInterest', amount: payment.allocatedInterest, debit: ACCOUNTS.INTEREST_INCOME, label: 'interest' },
          { key: 'allocatedPrincipal', amount: payment.allocatedPrincipal, debit: ACCOUNTS.LOANS_RECEIVABLE, label: 'principal' },
        ] as const
        for (const c of comp) {
          if (c.amount > 0) {
            await postReversal({
              organizationId: input.organizationId,
              loanId: payment.loanId,
              paymentId: payment.id,
              originalEntryNumber: payment.paymentNumber,
              reason: `${input.rejectionReason} (${c.label})`,
              amount: BigInt(c.amount),
              debitAccount: c.debit,
              creditAccount: ACCOUNTS.CASH,
            }, tx)
          }
        }
      }

      // Rebuild the schedule from the payments that remain valid.
      await recomputeInstallmentsFromPayments(tx, payment.loan, {
        excludePaymentIds: [payment.id],
        now,
      })

      // Restore loan balances.
      const restoredPrincipal = payment.loan.outstandingPrincipal + payment.allocatedPrincipal
      const restoredInterest = payment.loan.outstandingInterest + payment.allocatedInterest
      const restoredFees = payment.loan.outstandingFees + payment.allocatedFees
      const restoredTotalCollected = Math.max(
        0,
        payment.loan.totalCollected -
          (payment.allocatedPrincipal + payment.allocatedInterest + payment.allocatedFees),
      )
      const totalRestoredOutstanding = restoredPrincipal + restoredInterest + restoredFees

      await tx.loan.update({
        where: { id: payment.loanId },
        data: {
          outstandingPrincipal: restoredPrincipal,
          outstandingInterest: restoredInterest,
          outstandingFees: restoredFees,
          totalCollected: restoredTotalCollected,
          version: { increment: 1 },
          ...(payment.loan.status === 'CLOSED' && totalRestoredOutstanding > 0
            ? { status: 'ACTIVE', closedAt: null }
            : {}),
        },
      })
    }

    const amountRupeesStr = (payment.amount / 100).toLocaleString('en-IN')

    if (payment.recordedById) {
      await tx.notification.create({
        data: {
          organizationId: input.organizationId,
          userId: payment.recordedById,
          candidateId: payment.candidateId,
          type: 'AI_INSIGHT',
          title: 'Cash collection rejected',
          message: `Cash collection of ₹${amountRupeesStr} for ${payment.loan.candidate.fullName} (${payment.loan.loanNumber}) was rejected${wasAllocated ? ' and reversed' : ''}: ${input.rejectionReason}`,
          isRead: false,
          metadata: { paymentId: payment.id, loanId: payment.loanId },
        },
      })
    }

    if (wasAllocated && payment.loan.candidate.userId) {
      await tx.notification.create({
        data: {
          organizationId: input.organizationId,
          userId: payment.loan.candidate.userId,
          candidateId: payment.candidateId,
          type: 'PAYMENT_CONFIRMATION',
          title: 'Cash payment reversed',
          message: `Cash payment of ₹${amountRupeesStr} for loan ${payment.loan.loanNumber} (Receipt ${payment.receiptNumber ?? payment.paymentNumber}) was rejected by verification: ${input.rejectionReason}`,
          isRead: false,
          metadata: { paymentId: payment.id, loanId: payment.loanId },
        },
      })
    }

    return { payment, wasAllocated }
  }, { maxWait: 15000, timeout: 30000 })

  return {
    id: result.payment.id,
    paymentNumber: result.payment.paymentNumber,
    receiptNumber: result.payment.receiptNumber,
    amount: result.payment.amount,
    loanNumber: result.payment.loan.loanNumber,
    candidateName: result.payment.loan.candidate.fullName,
    status: 'REJECTED' as const,
    reversed: result.wasAllocated,
  }
}
