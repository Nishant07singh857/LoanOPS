// POST /api/owner/loans/[id]/disburse
// Hardened for Phase 7:
// - Row-level locking (`SELECT ... FOR UPDATE`) + atomic status guard (`PENDING_DISBURSEMENT` -> `ACTIVE`)
// - Unique constraint on Disbursement([loanId, status]) prevents concurrent double-disbursement race conditions

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOwner, audit, getClientIp } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, conflict, validate, genNumber } from '@/lib/server/api'
import { postLedger, ACCOUNTS } from '@/lib/server/ledger'

const schema = z
  .object({
    method: z.enum(['ONLINE', 'OFFLINE']),
    amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer string (paise)'),
    reference: z.string().max(200).optional(),
    notes: z.string().max(2000).optional(),
    proofUrl: z.string().url().optional(),
  })
  .strict()

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const input = validate(schema, body)

  const amount = BigInt(input.amount)
  const ip = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || undefined

  try {
    const result = await ctx.db.$transaction(
      async (tx) => {
        // 1. Acquire exclusive row lock on the Loan row
        await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${id} FOR UPDATE`

        const loan = await tx.loan.findFirst({
          where: { id, organizationId: ctx.user.organizationId },
        })
        if (!loan) {
          throw new Error('NOT_FOUND: Loan not found')
        }
        if (loan.status !== 'PENDING_DISBURSEMENT') {
          throw new Error(`CONFLICT: Loan is ${loan.status}, cannot disburse`)
        }
        if (amount !== BigInt(loan.principalAmount)) {
          throw new Error(`BAD_REQUEST: Amount must equal loan principal (${loan.principalAmount} paise)`)
        }

        const now = new Date()

        // 2. Atomic conditional transition: only 1 concurrent transaction can claim PENDING_DISBURSEMENT
        const claimed = await tx.loan.updateMany({
          where: {
            id: loan.id,
            organizationId: ctx.user.organizationId,
            status: 'PENDING_DISBURSEMENT',
            version: loan.version,
          },
          data: {
            status: 'ACTIVE',
            disbursedAt: now,
            version: { increment: 1 },
          },
        })
        if (claimed.count === 0) {
          throw new Error('CONFLICT: Loan was concurrently disbursed by another request')
        }

        const disb = await tx.disbursement.create({
          data: {
            loanId: loan.id,
            method: input.method,
            amount: Number(amount),
            reference: input.reference || genNumber('DISB'),
            notes: input.notes,
            proofUrl: input.proofUrl,
            status: 'COMPLETED',
            initiatedById: ctx.user.id,
            initiatedAt: now,
            completedAt: now,
          },
        })

        // Post ledger: Debit LOANS_RECEIVABLE / Credit CASH or BANK
        const creditAcc = input.method === 'ONLINE' ? ACCOUNTS.BANK : ACCOUNTS.CASH
        await postLedger(
          {
            organizationId: ctx.user.organizationId,
            type: 'DISBURSEMENT',
            debitAccount: ACCOUNTS.LOANS_RECEIVABLE,
            creditAccount: creditAcc,
            amount,
            description: `Disbursement for ${loan.loanNumber}`,
            reference: disb.reference || loan.loanNumber,
          },
          tx
        )

        // Notify candidate
        await tx.notification.create({
          data: {
            organizationId: ctx.user.organizationId,
            candidateId: loan.candidateId,
            type: 'DISBURSEMENT',
            title: 'Loan disbursed',
            message: `Your loan ${loan.loanNumber} has been disbursed.`,
          },
        })

        return { disb, loanNumber: loan.loanNumber }
      },
      { maxWait: 15000, timeout: 30000 }
    )

    await audit(ctx, 'DISBURSE', 'Loan', id, `Disbursed ${input.method} for ${result.loanNumber}`, {
      method: input.method,
      amount: input.amount,
      disbursementId: result.disb.id,
      ipAddress: ip,
      userAgent,
    })

    return success({
      id: result.disb.id,
      status: result.disb.status,
      method: result.disb.method,
      reference: result.disb.reference,
    })
  } catch (err: any) {
    const msg: string = err?.message || ''
    if (msg.startsWith('NOT_FOUND:')) return notFound(msg.replace(/^NOT_FOUND:\s*/, ''))
    if (msg.startsWith('CONFLICT:') || err?.code === 'P2002') {
      return conflict(msg.replace(/^CONFLICT:\s*/, '') || 'Loan is already disbursed')
    }
    if (msg.startsWith('BAD_REQUEST:')) return badRequest(msg.replace(/^BAD_REQUEST:\s*/, ''))
    throw err
  }
})
