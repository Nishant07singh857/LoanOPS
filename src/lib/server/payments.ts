// Shared payment capture logic — used by the webhook handler and the cash verification flow.
// Allocates a payment against the loan's installments using the financial engine,
// updates installment + loan totals, posts ledger entries, generates a receipt number,
// and creates a notification + audit log. All in one transaction.

import { db } from '@/lib/db'
import { auditRaw } from '@/lib/server/auth'
import {
  allocatePayment, parsePaise, serializePaise,
} from '@/lib/server/financial'
import { postLedger, ACCOUNTS } from '@/lib/server/ledger'
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
  const receiptNumber = `RCP-${genNumber('').split('-')[1] || Date.now().toString(36).toUpperCase()}`
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

      const totalDue = BigInt(inst.feesComponent) + BigInt(inst.interestComponent) + BigInt(inst.principalComponent)
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

    // Update loan totals
    await tx.loan.update({
      where: { id: payment.loanId },
      data: {
        outstandingPrincipal: { decrement: Number(allocation.allocatedPrincipal) },
        outstandingInterest: { decrement: Number(allocation.allocatedInterest) },
        outstandingFees: { decrement: Number(allocation.allocatedFees) },
        totalCollected: { increment: Number(amount) - Number(allocation.unallocated) },
      },
    })

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

  // Post ledger entries (after tx commits) — one per allocation type
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
    })
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
    })
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
    })
  }

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
