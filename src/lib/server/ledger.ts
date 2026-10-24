// Double-entry ledger service.
// Every financial event creates a balanced pair of entries.
// Append-only — never edit/delete ledger entries.
// Use reversal entries for corrections.

import { db } from '@/lib/db'
import { AuditAction } from '@prisma/client'

export type LedgerType =
  | 'DISBURSEMENT'
  | 'PAYMENT_PRINCIPAL'
  | 'PAYMENT_INTEREST'
  | 'PAYMENT_FEES'
  | 'REFUND'
  | 'CORRECTION'
  | 'REVERSAL'
  | 'FEE'

export interface PostEntry {
  organizationId: string
  loanId?: string
  paymentId?: string
  type: LedgerType
  debitAccount: string
  creditAccount: string
  amount: bigint // paise
  description: string
  reference?: string
}

let ledgerSeq = 0

// Posts a balanced double-entry. Throws if invalid.
export async function postLedger(entry: PostEntry, tx: any = db): Promise<{ entryNumber: string; id: string }> {
  if (entry.amount <= BigInt(0)) {
    throw new Error('Ledger entries must be positive')
  }
  if (!entry.debitAccount || !entry.creditAccount) {
    throw new Error('Both debit and credit accounts required')
  }
  if (entry.debitAccount === entry.creditAccount) {
    throw new Error('Debit and credit accounts must differ')
  }

  ledgerSeq = (ledgerSeq + 1) % 100000
  const entryNumber = `LED-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 0xffff).toString(36).toUpperCase()}${ledgerSeq.toString(36).toUpperCase()}`

  const created = await tx.ledgerEntry.create({
    data: {
      organizationId: entry.organizationId,
      // Persist the loan/payment linkage — LedgerEntry.loanId/paymentId exist
      // so entries can be joined back to the loan/payment they belong to
      // instead of relying only on the mutable free-text `reference` string.
      loanId: entry.loanId ?? null,
      paymentId: entry.paymentId ?? null,
      entryNumber,
      type: entry.type,
      debitAccount: entry.debitAccount,
      creditAccount: entry.creditAccount,
      amount: Number(entry.amount),
      description: entry.description,
      reference: entry.reference,
    },
  })

  return { entryNumber: created.entryNumber, id: created.id }
}

export type ReversalInput =
  | {
      organizationId: string
      loanId?: string
      paymentId?: string
      originalEntryNumber: string
      reason: string
      amount: bigint
      debitAccount: string
      creditAccount: string
    }
  | {
      originalEntryId: string
      userId?: string | null
      reason: string
    }

// Reverse a previous entry (creates a mirror entry with swapped debit/credit)
export async function postReversal(original: ReversalInput, tx: any = db): Promise<{ entryNumber: string; id: string }> {
  if ('originalEntryId' in original) {
    const entry = await tx.ledgerEntry.findUnique({
      where: { id: original.originalEntryId },
    })
    if (!entry) {
      throw new Error(`Original ledger entry ${original.originalEntryId} not found`)
    }
    return postLedger({
      organizationId: entry.organizationId,
      loanId: (entry as any).loanId ?? undefined,
      paymentId: (entry as any).paymentId ?? undefined,
      type: 'REVERSAL',
      debitAccount: entry.creditAccount,
      creditAccount: entry.debitAccount,
      amount: BigInt(entry.amount),
      description: `Reversal of ${entry.entryNumber}: ${original.reason}`,
      reference: entry.entryNumber,
    }, tx)
  }

  return postLedger({
    organizationId: original.organizationId,
    loanId: original.loanId,
    paymentId: original.paymentId,
    type: 'REVERSAL',
    // Callers already pass the reversed accounts (e.g. Debit Income, Credit Bank)
    debitAccount: original.debitAccount,
    creditAccount: original.creditAccount,
    amount: original.amount,
    description: `Reversal of ${original.originalEntryNumber}: ${original.reason}`,
    reference: original.originalEntryNumber,
  }, tx)
}

// Standard account names for the demo org
export const ACCOUNTS = {
  CASH: 'Cash in Hand',
  BANK: 'Bank Account',
  LOANS_RECEIVABLE: 'Loans Receivable',
  INTEREST_INCOME: 'Interest Income',
  FEE_INCOME: 'Fee Income',
  PROCESSING_FEE_INCOME: 'Processing Fee Income',
  UNALLOCATED: 'Unallocated Payments',
  REFUND_PAYABLE: 'Refund Payable',
  CASH_CLEARING: 'Cash Clearing',
} as const
