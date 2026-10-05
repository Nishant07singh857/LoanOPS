// Shared payment capture logic — used by the webhook handler and the cash verification flow.
// Allocates a payment against the loan's installments using the financial engine,
// updates installment + loan totals, posts ledger entries, generates a receipt number,
// and creates a notification + audit log. All in one transaction.

import { db } from '@/lib/db'
import { auditRaw } from '@/lib/server/auth'
import {
  allocatePayment, parsePaise, serializePaise,
} from '@/lib/server/financial'
import { postLedger, postReversal, ACCOUNTS } from '@/lib/server/ledger'
import { genNumber } from '@/lib/server/api'

export interface CaptureInput {
  paymentId: string
  organizationId: string
  userId?: string | null  // who triggered the capture (system for webhook)
  channel: 'WEBHOOK' | 'CASH_VERIFICATION' | 'MANUAL'
  providerEventId?: string | null
}

export async function capturePayment(input: CaptureInput): Promise<{
  receiptNumber: string
  allocatedFees: bigint
  allocatedInterest: bigint
  allocatedPrincipal: bigint
  unallocated: bigint
  perInstallment: any[]
}> {
  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    include: {
      loan: { include: { schedule: { orderBy: { installmentNumber: 'asc' } }, candidate: true } },
    },
  })
  if (!payment) throw new Error('Payment not found')
  if (payment.organizationId !== input.organizationId) throw new Error('Forbidden: tenant isolation violated')
  if (payment.status === 'ALLOCATED') throw new Error('Payment already allocated')
  if (payment.status === 'FAILED') throw new Error('Cannot allocate a failed payment')

  const amount = parsePaise(payment.amount)
  const installments = payment.loan.schedule.map((i) => ({
    installmentNumber: i.installmentNumber,
    fees: BigInt(i.feesComponent),
    interest: BigInt(i.interestComponent),
    principal: BigInt(i.principalComponent),
    paidFees: BigInt(i.paidFees),
    paidInterest: BigInt(i.paidInterest),
    paidPrincipal: BigInt(i.paidPrincipal),
  }))

  const allocation = allocatePayment(installments, amount)
  const receiptNumber = payment.receiptNumber || `RCP-${genNumber('').split('-')[1] || Date.now().toString(36).toUpperCase()}`
  const now = new Date()

  // Update installment + loan + payment + ledger in a single transaction
  await db.$transaction(async (tx) => {
    // Apply allocation to installments
    for (const alloc of allocation.perInstallment) {
      const inst = payment.loan.schedule.find((i) => i.installmentNumber === alloc.installmentNumber)
      if (!inst) continue

      const newPaidFees = BigInt(inst.paidFees) + alloc.fees
      const newPaidInterest = BigInt(inst.paidInterest) + alloc.interest
      const newPaidPrincipal = BigInt(inst.paidPrincipal) + alloc.principal
      const newPaidAmount = newPaidFees + newPaidInterest + newPaidPrincipal

      const fullyPaid = newPaidFees >= BigInt(inst.feesComponent)
        && newPaidInterest >= BigInt(inst.interestComponent)
        && newPaidPrincipal >= BigInt(inst.principalComponent)
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

    // Update payment
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'ALLOCATED',
        allocatedFees: Number(allocation.allocatedFees),
        allocatedInterest: Number(allocation.allocatedInterest),
        allocatedPrincipal: Number(allocation.allocatedPrincipal),
        unallocated: Number(allocation.unallocated),
        allocatedAt: now,
        receiptNumber,
        providerEventId: input.providerEventId ?? payment.providerEventId,
      },
    })

    // Update loan totals (clamped to non-negative)
    const nextPrincipal = Math.max(0, payment.loan.outstandingPrincipal - Number(allocation.allocatedPrincipal))
    const nextInterest = Math.max(0, payment.loan.outstandingInterest - Number(allocation.allocatedInterest))
    const nextFees = Math.max(0, payment.loan.outstandingFees - Number(allocation.allocatedFees))
    const isFullyRepaid = nextPrincipal === 0 && nextInterest === 0 && nextFees === 0

    await tx.loan.update({
      where: { id: payment.loanId },
      data: {
        outstandingPrincipal: nextPrincipal,
        outstandingInterest: nextInterest,
        outstandingFees: nextFees,
        totalCollected: { increment: Number(amount) - Number(allocation.unallocated) },
        ...(isFullyRepaid && payment.loan.status === 'ACTIVE'
          ? { status: 'CLOSED', closedAt: now }
          : {}),
      },
    })

    // Post ledger entries inside transaction — one per allocation type
    if (allocation.allocatedFees > BigInt(0)) {
      await postLedger({
        organizationId: input.organizationId,
        loanId: payment.loanId,
        paymentId: payment.id,
        type: 'PAYMENT_FEES',
        debitAccount: ACCOUNTS.BANK,
        creditAccount: ACCOUNTS.FEE_INCOME,
        amount: allocation.allocatedFees,
        description: `Fee allocation for payment ${payment.paymentNumber}`,
        reference: payment.paymentNumber,
      }, tx)
    }
    if (allocation.allocatedInterest > BigInt(0)) {
      await postLedger({
        organizationId: input.organizationId,
        loanId: payment.loanId,
        paymentId: payment.id,
        type: 'PAYMENT_INTEREST',
        debitAccount: ACCOUNTS.BANK,
        creditAccount: ACCOUNTS.INTEREST_INCOME,
        amount: allocation.allocatedInterest,
        description: `Interest allocation for payment ${payment.paymentNumber}`,
        reference: payment.paymentNumber,
      }, tx)
    }
    if (allocation.allocatedPrincipal > BigInt(0)) {
      await postLedger({
        organizationId: input.organizationId,
        loanId: payment.loanId,
        paymentId: payment.id,
        type: 'PAYMENT_PRINCIPAL',
        debitAccount: ACCOUNTS.BANK,
        creditAccount: ACCOUNTS.LOANS_RECEIVABLE,
        amount: allocation.allocatedPrincipal,
        description: `Principal allocation for payment ${payment.paymentNumber}`,
        reference: payment.paymentNumber,
      }, tx)
    }

    // Notify candidate
    if (payment.loan.candidate.userId) {
      await tx.notification.create({
        data: {
          organizationId: input.organizationId,
          userId: payment.loan.candidate.userId,
          candidateId: payment.candidateId,
          type: 'PAYMENT_CONFIRMATION',
          title: 'Payment received',
          message: `₹${Number(amount) / 100} received for loan ${payment.loan.loanNumber}. Receipt ${receiptNumber}.`,
          isRead: false,
          metadata: { paymentId: payment.id, loanId: payment.loanId, receiptNumber },
        },
      })
    }
  })

  await auditRaw(
    input.organizationId,
    input.userId ?? null,
    'ALLOCATE',
    'Payment',
    payment.id,
    `Allocated payment ${payment.paymentNumber} via ${input.channel}: fees=${serializePaise(allocation.allocatedFees)} interest=${serializePaise(allocation.allocatedInterest)} principal=${serializePaise(allocation.allocatedPrincipal)} unallocated=${serializePaise(allocation.unallocated)} receipt=${receiptNumber}`,
    { paymentId: payment.id, loanId: payment.loanId, channel: input.channel }
  )

  return {
    receiptNumber,
    allocatedFees: allocation.allocatedFees,
    allocatedInterest: allocation.allocatedInterest,
    allocatedPrincipal: allocation.allocatedPrincipal,
    unallocated: allocation.unallocated,
    perInstallment: allocation.perInstallment.map((p) => ({
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

export async function collectCashPayment(input: CollectCashInput) {
  const cleanKey = input.idempotencyKey?.trim() || null

  // 1. Idempotency check before processing
  if (cleanKey) {
    const existing = await db.payment.findUnique({
      where: { idempotencyKey: cleanKey },
      include: { loan: { include: { candidate: true } } },
    })
    if (existing && existing.organizationId === input.organizationId) {
      return {
        id: existing.id,
        paymentId: existing.id,
        paymentNumber: existing.paymentNumber,
        receiptNumber: existing.receiptNumber,
        amount: String(existing.amount),
        status: existing.status,
        verificationStatus: existing.status === 'VERIFIED' || existing.verifiedAt ? 'VERIFIED' : 'PENDING_VERIFICATION',
        allocatedFees: String(existing.allocatedFees),
        allocatedInterest: String(existing.allocatedInterest),
        allocatedPrincipal: String(existing.allocatedPrincipal),
        unallocated: String(existing.unallocated),
        loanId: existing.loanId,
        loanNumber: existing.loan.loanNumber,
        candidateId: existing.candidateId,
        candidateName: existing.loan.candidate.fullName,
        createdAt: existing.createdAt,
        allocatedAt: existing.allocatedAt,
        idempotentReplay: true,
      }
    }
  }

  // 2. Server Validation
  const loan = await db.loan.findUnique({
    where: { id: input.loanId },
    include: {
      schedule: { orderBy: { installmentNumber: 'asc' } },
      candidate: { include: { assignedAgent: true } },
    },
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

  // Agent Assignment Check (RBAC / IDOR)
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
    BigInt(loan.outstandingPrincipal) +
    BigInt(loan.outstandingInterest) +
    BigInt(loan.outstandingFees)

  if (input.amountPaise > totalOutstanding) {
    throw new Error('BAD_REQUEST: Amount exceeds total outstanding balance')
  }

  const installments = loan.schedule.map((i) => ({
    installmentNumber: i.installmentNumber,
    fees: BigInt(i.feesComponent),
    interest: BigInt(i.interestComponent),
    principal: BigInt(i.principalComponent),
    paidFees: BigInt(i.paidFees),
    paidInterest: BigInt(i.paidInterest),
    paidPrincipal: BigInt(i.paidPrincipal),
  }))

  const paymentNumber = genNumber('PAY')
  const receiptNumber = genNumber('RCP')
  const now = new Date()

  try {
    const payment = await db.$transaction(async (tx) => {
      // Acquire row-level exclusive lock on the Loan row to serialize concurrent payments
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loan.id} FOR UPDATE`

      const lockedLoan = await tx.loan.findUnique({
        where: { id: loan.id },
        include: { schedule: { orderBy: { installmentNumber: 'asc' } } },
      })
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

      const installments = lockedLoan.schedule.map((i) => ({
        installmentNumber: i.installmentNumber,
        fees: BigInt(i.feesComponent),
        interest: BigInt(i.interestComponent),
        principal: BigInt(i.principalComponent),
        paidFees: BigInt(i.paidFees),
        paidInterest: BigInt(i.paidInterest),
        paidPrincipal: BigInt(i.paidPrincipal),
      }))

      const allocation = allocatePayment(installments, input.amountPaise)

      const createdPayment = await tx.payment.create({
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
          allocatedFees: Number(allocation.allocatedFees),
          allocatedInterest: Number(allocation.allocatedInterest),
          allocatedPrincipal: Number(allocation.allocatedPrincipal),
          unallocated: Number(allocation.unallocated),
          allocatedAt: now,
          receiptNumber,
          idempotencyKey: cleanKey,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          proofUrl: input.proofUrl ?? null,
        },
      })

      // Update each affected Installment
      for (const alloc of allocation.perInstallment) {
        const inst = lockedLoan.schedule.find((i) => i.installmentNumber === alloc.installmentNumber)
        if (!inst) continue

        const newPaidFees = BigInt(inst.paidFees) + alloc.fees
        const newPaidInterest = BigInt(inst.paidInterest) + alloc.interest
        const newPaidPrincipal = BigInt(inst.paidPrincipal) + alloc.principal
        const newPaidAmount = newPaidFees + newPaidInterest + newPaidPrincipal

        const fullyPaid =
          newPaidFees >= BigInt(inst.feesComponent) &&
          newPaidInterest >= BigInt(inst.interestComponent) &&
          newPaidPrincipal >= BigInt(inst.principalComponent)

        await tx.installment.update({
          where: { id: inst.id },
          data: {
            paidFees: Number(newPaidFees),
            paidInterest: Number(newPaidInterest),
            paidPrincipal: Number(newPaidPrincipal),
            paidAmount: Number(newPaidAmount),
            status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
            paidAt: fullyPaid ? now : inst.paidAt,
          },
        })
      }

      // Update Loan balances and auto-close if fully repaid
      const nextPrincipal = Math.max(0, lockedLoan.outstandingPrincipal - Number(allocation.allocatedPrincipal))
      const nextInterest = Math.max(0, lockedLoan.outstandingInterest - Number(allocation.allocatedInterest))
      const nextFees = Math.max(0, lockedLoan.outstandingFees - Number(allocation.allocatedFees))
      const isFullyRepaid = nextPrincipal === 0 && nextInterest === 0 && nextFees === 0

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          outstandingPrincipal: nextPrincipal,
          outstandingInterest: nextInterest,
          outstandingFees: nextFees,
          totalCollected: { increment: Number(input.amountPaise) - Number(allocation.unallocated) },
          version: { increment: 1 },
          ...(isFullyRepaid ? { status: 'CLOSED', closedAt: now } : {}),
        },
      })

      // Resolve any open/assigned CollectionTask for this loan
      await tx.collectionTask.updateMany({
        where: {
          loanId: loan.id,
          status: { in: ['OPEN', 'ASSIGNED'] },
        },
        data: {
          status: 'RESOLVED',
          outcome: 'Cash collected',
        },
      })

      // Create LedgerEntry records inside tx
      if (allocation.allocatedFees > BigInt(0)) {
        await postLedger({
          organizationId: input.organizationId,
          loanId: loan.id,
          paymentId: createdPayment.id,
          type: 'PAYMENT_FEES',
          debitAccount: ACCOUNTS.CASH,
          creditAccount: ACCOUNTS.FEE_INCOME,
          amount: allocation.allocatedFees,
          description: `Cash fee allocation for payment ${paymentNumber}`,
          reference: paymentNumber,
        }, tx)
      }
      if (allocation.allocatedInterest > BigInt(0)) {
        await postLedger({
          organizationId: input.organizationId,
          loanId: loan.id,
          paymentId: createdPayment.id,
          type: 'PAYMENT_INTEREST',
          debitAccount: ACCOUNTS.CASH,
          creditAccount: ACCOUNTS.INTEREST_INCOME,
          amount: allocation.allocatedInterest,
          description: `Cash interest allocation for payment ${paymentNumber}`,
          reference: paymentNumber,
        }, tx)
      }
      if (allocation.allocatedPrincipal > BigInt(0)) {
        await postLedger({
          organizationId: input.organizationId,
          loanId: loan.id,
          paymentId: createdPayment.id,
          type: 'PAYMENT_PRINCIPAL',
          debitAccount: ACCOUNTS.CASH,
          creditAccount: ACCOUNTS.LOANS_RECEIVABLE,
          amount: allocation.allocatedPrincipal,
          description: `Cash principal allocation for payment ${paymentNumber}`,
          reference: paymentNumber,
        }, tx)
      }

      const amountRupeesStr = (Number(input.amountPaise) / 100).toLocaleString('en-IN')

      // Notification for Candidate
      if (loan.candidate.userId) {
        await tx.notification.create({
          data: {
            organizationId: input.organizationId,
            userId: loan.candidate.userId,
            candidateId: loan.candidateId,
            type: 'PAYMENT_CONFIRMATION',
            title: 'Cash payment received',
            message: `Cash payment of ₹${amountRupeesStr} received for loan ${loan.loanNumber}. Receipt ${receiptNumber}.`,
            isRead: false,
            metadata: { paymentId: createdPayment.id, loanId: loan.id, receiptNumber },
          },
        })
      }

      // Notification for all active OWNER users in the organization
      const owners = await tx.user.findMany({
        where: { organizationId: input.organizationId, role: 'OWNER', isActive: true },
        select: { id: true },
      })
      for (const owner of owners) {
        await tx.notification.create({
          data: {
            organizationId: input.organizationId,
            userId: owner.id,
            candidateId: loan.candidateId,
            type: 'PAYMENT_CONFIRMATION',
            title: 'Cash collection recorded',
            message: `Cash payment of ₹${amountRupeesStr} collected for ${loan.candidate.fullName} (${loan.loanNumber}).`,
            isRead: false,
            metadata: { paymentId: createdPayment.id, loanId: loan.id, receiptNumber },
          },
        })
      }

      return { createdPayment, isFullyRepaid }
    }, { maxWait: 15000, timeout: 30000 })

    const { createdPayment, isFullyRepaid } = payment

    await auditRaw(
      input.organizationId,
      input.agentUserId,
      'CREATE',
      'Payment',
      createdPayment.id,
      `Recorded cash collection ₹${Number(input.amountPaise) / 100} for ${loan.candidate.fullName} (${loan.loanNumber}). Payment ${paymentNumber}, receipt ${receiptNumber} (pending owner verification).`,
      { paymentId: createdPayment.id, loanId: loan.id, receiptNumber }
    )

    return {
      id: createdPayment.id,
      paymentId: createdPayment.id,
      paymentNumber: createdPayment.paymentNumber,
      receiptNumber: createdPayment.receiptNumber,
      amount: String(createdPayment.amount),
      status: createdPayment.status,
      verificationStatus: 'PENDING_VERIFICATION' as const,
      allocatedFees: String(createdPayment.allocatedFees),
      allocatedInterest: String(createdPayment.allocatedInterest),
      allocatedPrincipal: String(createdPayment.allocatedPrincipal),
      unallocated: String(createdPayment.unallocated),
      loanId: loan.id,
      loanNumber: loan.loanNumber,
      loanClosed: isFullyRepaid,
      candidateId: loan.candidateId,
      candidateName: loan.candidate.fullName,
      createdAt: createdPayment.createdAt,
      allocatedAt: createdPayment.allocatedAt,
      idempotentReplay: false,
    }
  } catch (err: any) {
    // Handle P2002 race condition on idempotencyKey
    if (err?.code === 'P2002' && cleanKey) {
      const existing = await db.payment.findUnique({
        where: { idempotencyKey: cleanKey },
        include: { loan: { include: { candidate: true } } },
      })
      if (existing && existing.organizationId === input.organizationId) {
        return {
          id: existing.id,
          paymentId: existing.id,
          paymentNumber: existing.paymentNumber,
          receiptNumber: existing.receiptNumber,
          amount: String(existing.amount),
          status: existing.status,
          verificationStatus: existing.status === 'VERIFIED' || existing.verifiedAt ? 'VERIFIED' : 'PENDING_VERIFICATION',
          allocatedFees: String(existing.allocatedFees),
          allocatedInterest: String(existing.allocatedInterest),
          allocatedPrincipal: String(existing.allocatedPrincipal),
          unallocated: String(existing.unallocated),
          loanId: existing.loanId,
          loanNumber: existing.loan.loanNumber,
          candidateId: existing.candidateId,
          candidateName: existing.loan.candidate.fullName,
          createdAt: existing.createdAt,
          allocatedAt: existing.allocatedAt,
          idempotentReplay: true,
        }
      }
    }
    throw err
  }
}

export interface ReverseCashInput {
  paymentId: string
  organizationId: string
  ownerUserId: string
  rejectionReason: string
}

export async function reverseCashPayment(input: ReverseCashInput) {
  const now = new Date()

  const result = await db.$transaction(async (tx) => {
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
    if (payment.status !== 'PENDING_VERIFICATION') {
      throw new Error('CONFLICT: Cash collection is not pending verification')
    }

    // 1. Update payment to REJECTED
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REJECTED',
        rejectionReason: input.rejectionReason,
        verifiedById: input.ownerUserId,
        verifiedAt: now,
      },
    })

    // 2. Find all non-reversed LedgerEntry rows for this payment and post reversals
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
          reference: { in: paymentLedgerEntries.map((e) => e.entryNumber) },
        },
        select: { reference: true },
      })
      const reversedRefs = new Set(existingReversals.map((r) => r.reference))

      for (const entry of paymentLedgerEntries) {
        if (!reversedRefs.has(entry.entryNumber)) {
          await postReversal(
            {
              originalEntryId: entry.id,
              userId: input.ownerUserId,
              reason: input.rejectionReason,
            },
            tx
          )
        }
      }
    } else if (payment.allocatedAt !== null) {
      // Fallback for any payment that was allocated without matching reference ledger rows
      if (payment.allocatedFees > 0) {
        await postReversal({
          organizationId: input.organizationId,
          loanId: payment.loanId,
          paymentId: payment.id,
          originalEntryNumber: `PAYMENT_FEES-${payment.paymentNumber}`,
          reason: input.rejectionReason,
          amount: BigInt(payment.allocatedFees),
          debitAccount: ACCOUNTS.FEE_INCOME,
          creditAccount: ACCOUNTS.CASH,
        }, tx)
      }
      if (payment.allocatedInterest > 0) {
        await postReversal({
          organizationId: input.organizationId,
          loanId: payment.loanId,
          paymentId: payment.id,
          originalEntryNumber: `PAYMENT_INTEREST-${payment.paymentNumber}`,
          reason: input.rejectionReason,
          amount: BigInt(payment.allocatedInterest),
          debitAccount: ACCOUNTS.INTEREST_INCOME,
          creditAccount: ACCOUNTS.CASH,
        }, tx)
      }
      if (payment.allocatedPrincipal > 0) {
        await postReversal({
          organizationId: input.organizationId,
          loanId: payment.loanId,
          paymentId: payment.id,
          originalEntryNumber: `PAYMENT_PRINCIPAL-${payment.paymentNumber}`,
          reason: input.rejectionReason,
          amount: BigInt(payment.allocatedPrincipal),
          debitAccount: ACCOUNTS.LOANS_RECEIVABLE,
          creditAccount: ACCOUNTS.CASH,
        }, tx)
      }
    }

    // 3. Recompute loan's installment schedule paid amounts from remaining valid payments
    const wasAllocated =
      payment.allocatedAt !== null ||
      payment.allocatedPrincipal > 0 ||
      payment.allocatedInterest > 0 ||
      payment.allocatedFees > 0

    if (wasAllocated) {
      const remainingValidPayments = await tx.payment.findMany({
        where: {
          loanId: payment.loanId,
          id: { not: payment.id },
          status: { in: ['PENDING_VERIFICATION', 'VERIFIED', 'ALLOCATED'] },
        },
        orderBy: [{ createdAt: 'asc' }],
      })

      // Only include payments that actually allocated funds
      const allocatedRemainingPayments = remainingValidPayments.filter(
        (p) =>
          p.allocatedAt !== null ||
          p.status === 'VERIFIED' ||
          p.status === 'ALLOCATED' ||
          p.allocatedPrincipal > 0 ||
          p.allocatedInterest > 0 ||
          p.allocatedFees > 0
      )

      // Account for any baseline paid amounts seeded without Payment rows
      const currentSchedulePaid = payment.loan.schedule.reduce(
        (sum, inst) => sum + BigInt(inst.paidFees) + BigInt(inst.paidInterest) + BigInt(inst.paidPrincipal),
        BigInt(0)
      )
      const rejectedAllocated =
        BigInt(payment.allocatedFees) + BigInt(payment.allocatedInterest) + BigInt(payment.allocatedPrincipal)
      const remainingAllocatedSum = allocatedRemainingPayments.reduce(
        (sum, p) => sum + BigInt(p.allocatedFees) + BigInt(p.allocatedInterest) + BigInt(p.allocatedPrincipal),
        BigInt(0)
      )
      const baselineSeedPaid =
        currentSchedulePaid > rejectedAllocated + remainingAllocatedSum
          ? currentSchedulePaid - (rejectedAllocated + remainingAllocatedSum)
          : BigInt(0)

      // Reset all installments in memory to 0
      const scheduleState = payment.loan.schedule.map((inst) => ({
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
            st.paidFees >= st.fees &&
            st.paidInterest >= st.interest &&
            st.paidPrincipal >= st.principal
          if (isFull && !st.paidAt) {
            st.paidAt = paidDate
          }
        }
      }

      if (baselineSeedPaid > BigInt(0)) {
        applyAmountToSchedule(baselineSeedPaid, payment.loan.disbursedAt ?? payment.loan.createdAt)
      }

      for (const vp of allocatedRemainingPayments) {
        applyAmountToSchedule(BigInt(vp.amount), vp.allocatedAt ?? vp.createdAt)
      }

      // Persist updated installments in tx
      for (const st of scheduleState) {
        const paidAmount = st.paidFees + st.paidInterest + st.paidPrincipal
        const fullyPaid =
          st.paidFees >= st.fees &&
          st.paidInterest >= st.interest &&
          st.paidPrincipal >= st.principal

        let newStatus: 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'UPCOMING'
        if (fullyPaid) {
          newStatus = 'PAID'
        } else if (paidAmount > BigInt(0)) {
          newStatus = 'PARTIALLY_PAID'
        } else if (new Date(st.dueDate) < now) {
          newStatus = 'OVERDUE'
        } else {
          newStatus = 'UPCOMING'
        }

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

      // 4. Restore Loan balances
      const restoredPrincipal = payment.loan.outstandingPrincipal + payment.allocatedPrincipal
      const restoredInterest = payment.loan.outstandingInterest + payment.allocatedInterest
      const restoredFees = payment.loan.outstandingFees + payment.allocatedFees
      const restoredTotalCollected = Math.max(
        0,
        payment.loan.totalCollected - (payment.allocatedPrincipal + payment.allocatedInterest + payment.allocatedFees)
      )
      const totalRestoredOutstanding = restoredPrincipal + restoredInterest + restoredFees

      await tx.loan.update({
        where: { id: payment.loanId },
        data: {
          outstandingPrincipal: restoredPrincipal,
          outstandingInterest: restoredInterest,
          outstandingFees: restoredFees,
          totalCollected: restoredTotalCollected,
          ...(payment.loan.status === 'CLOSED' && totalRestoredOutstanding > 0
            ? { status: 'ACTIVE', closedAt: null }
            : {}),
        },
      })
    }

    const amountRupeesStr = (payment.amount / 100).toLocaleString('en-IN')

    // 5. Notify Agent and Candidate
    if (payment.recordedById) {
      await tx.notification.create({
        data: {
          organizationId: input.organizationId,
          userId: payment.recordedById,
          candidateId: payment.candidateId,
          type: 'AI_INSIGHT',
          title: 'Cash collection rejected',
          message: `Cash collection of ₹${amountRupeesStr} for ${payment.loan.candidate.fullName} (${payment.loan.loanNumber}) was rejected and reversed: ${input.rejectionReason}`,
          isRead: false,
          metadata: { paymentId: payment.id, loanId: payment.loanId },
        },
      })
    }

    if (payment.loan.candidate.userId) {
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

    return payment
  }, { maxWait: 15000, timeout: 30000 })

  return {
    id: result.id,
    paymentNumber: result.paymentNumber,
    receiptNumber: result.receiptNumber,
    amount: result.amount,
    loanNumber: result.loan.loanNumber,
    candidateName: result.loan.candidate.fullName,
    status: 'REJECTED' as const,
    reversed: true,
  }
}

