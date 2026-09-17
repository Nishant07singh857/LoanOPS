// POST /api/owner/loans/[id]/disburse
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validate, genNumber } from '@/lib/server/api'
import { postLedger, ACCOUNTS } from '@/lib/server/ledger'

const schema = z.object({
  method: z.enum(['ONLINE', 'OFFLINE']),
  amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer string (paise)'),
  reference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  proofUrl: z.string().url().optional(),
})

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const input = validate(schema, body)

  const amount = BigInt(input.amount)

  // Verify the loan belongs to the org and is pending disbursement
  const loan = await ctx.db.loan.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  })
  if (!loan) return notFound('Loan not found')
  if (loan.status !== 'PENDING_DISBURSEMENT') return badRequest(`Loan is ${loan.status}, cannot disburse`)

  if (amount !== BigInt(loan.principalAmount)) {
    return badRequest(`Amount must equal loan principal (${loan.principalAmount} paise)`)
  }

  // Transaction: create disbursement record + post ledger + update loan status
  const result = await ctx.db.$transaction(async (tx) => {
    const status = input.method === 'ONLINE' ? 'INITIATED' : 'COMPLETED'
    const now = new Date()

    const disb = await tx.disbursement.create({
      data: {
        loanId: loan.id,
        method: input.method,
        amount: Number(amount),
        reference: input.reference || genNumber('DISB'),
        notes: input.notes,
        proofUrl: input.proofUrl,
        status,
        initiatedById: ctx.user.id,
        initiatedAt: now,
        completedAt: input.method === 'OFFLINE' ? now : null,
      },
    })

    // Post ledger: Debit LOANS_RECEIVABLE / Credit CASH or BANK
    const creditAcc = input.method === 'ONLINE' ? ACCOUNTS.BANK : ACCOUNTS.CASH
    await tx.ledgerEntry.create({
      data: {
        organizationId: ctx.user.organizationId,
        entryNumber: genNumber('LED'),
        type: 'DISBURSEMENT',
        debitAccount: ACCOUNTS.LOANS_RECEIVABLE,
        creditAccount: creditAcc,
        amount: Number(amount),
        description: `Disbursement for ${loan.loanNumber}`,
        reference: disb.reference || loan.loanNumber,
      },
    })

    // Update loan status if OFFLINE (ONLINE waits for webhook)
    if (input.method === 'OFFLINE') {
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: 'ACTIVE',
          disbursedAt: now,
        },
      })
    } else {
      // ONLINE: keep status as PENDING_DISBURSEMENT until webhook confirms
      // Just record the disbursement as INITIATED
    }

    // Notify candidate
    await tx.notification.create({
      data: {
        organizationId: ctx.user.organizationId,
        candidateId: loan.candidateId,
        type: 'DISBURSEMENT',
        title: input.method === 'OFFLINE' ? 'Loan disbursed' : 'Disbursement initiated',
        message: input.method === 'OFFLINE'
          ? `Your loan ${loan.loanNumber} has been disbursed.`
          : `Disbursement for ${loan.loanNumber} is being processed.`,
      },
    })

    return disb
  })

  await audit(ctx, 'DISBURSE', 'Loan', loan.id, `Disbursed ${input.method} for ${loan.loanNumber}`, {
    method: input.method,
    amount: input.amount,
    disbursementId: result.id,
  })

  return success({
    id: result.id,
    status: result.status,
    method: result.method,
    reference: result.reference,
  })
})
