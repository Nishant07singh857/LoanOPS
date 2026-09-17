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

// Posts a balanced double-entry. Throws if invalid.
export async function postLedger(entry: PostEntry): Promise<{ entryNumber: string; id: string }> {
  if (entry.amount <= BigInt(0)) {
    throw new Error('Ledger entries must be positive')
  }
  if (!entry.debitAccount || !entry.creditAccount) {
    throw new Error('Both debit and credit accounts required')
  }
  if (entry.debitAccount === entry.creditAccount) {
    throw new Error('Debit and credit accounts must differ')
  }

  const entryNumber = `LED-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString(36).toUpperCase()}`

  const created = await db.ledgerEntry.create({
    data: {
      organizationId: entry.organizationId,
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

// Reverse a previous entry (creates a mirror entry with swapped debit/credit)
export async function postReversal(original: {
  organizationId: string
  loanId?: string
  paymentId?: string
  originalEntryNumber: string
  reason: string
  amount: bigint
  debitAccount: string
  creditAccount: string
}): Promise<{ entryNumber: string; id: string }> {
  return postLedger({
    organizationId: original.organizationId,
    loanId: original.loanId,
    paymentId: original.paymentId,
    type: 'REVERSAL',
    // Swap debit and credit
    debitAccount: original.creditAccount,
    creditAccount: original.debitAccount,
    amount: original.amount,
    description: `Reversal of ${original.originalEntryNumber}: ${original.reason}`,
    reference: original.originalEntryNumber,
  })
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
