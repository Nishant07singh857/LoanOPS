// POST /api/owner/reconciliation/run — run reconciliation for a period
// Compares expected payments (sum of due installments) vs captured vs allocated vs ledger
// Detects exceptions (duplicate provider events, missing ledger, mismatch)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, validate, genNumber } from '@/lib/server/api'

const dateString = z.string().trim().min(1).refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Invalid date',
})

const schema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  periodStart: dateString.optional(),
  periodEnd: dateString.optional(),
}).strict().refine((d) => (d.from && d.to) || (d.periodStart && d.periodEnd), {
  message: 'Provide either (from, to) or (periodStart, periodEnd)',
})

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const body = await req.json().catch(() => ({}))
  const data = validate(schema, body as any)
  const fromStr = data.from ?? data.periodStart!
  const toStr = data.to ?? data.periodEnd!
  const from = new Date(fromStr)
  const to = new Date(toStr)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return badRequest('Invalid from/to date')
  }
  if (from.getTime() > to.getTime()) {
    return badRequest('from must be on or before to')
  }

  // Aggregation window is [from, periodEnd). The stored periodEnd is exactly the
  // window end used by every aggregate below — no silent drift between the two.
  // A date-only `to` (what the admin page sends) means "the whole of that day",
  // so its exclusive end is the following midnight; a full datetime `to` is used as-is.
  const isDateOnlyTo = /^\d{4}-\d{2}-\d{2}$/.test(toStr.trim())
  const periodEnd = isDateOnlyTo ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : to

  const run = await db.reconciliationRun.create({
    data: {
      organizationId: ctx.user.organizationId,
      runNumber: genNumber('RECON'),
      periodStart: from,
      periodEnd,
      totalExpected: 0,
      totalCaptured: 0,
      totalAllocated: 0,
      exceptionsCount: 0,
      status: 'RUNNING',
    },
  })

  try {

  // Expected: sum of installments due in period
  const expectedAgg = await db.installment.aggregate({
    where: {
      loan: { organizationId: ctx.user.organizationId },
      dueDate: { gte: from, lt: periodEnd },
    },
    _sum: { totalDue: true },
  })
  const totalExpected = expectedAgg._sum.totalDue ?? 0

  // Captured: only payments that actually captured money count — ALLOCATED or
  // VERIFIED. INITIATED/FAILED/REJECTED payments never captured anything.
  const capturedAgg = await db.payment.aggregate({
    where: {
      organizationId: ctx.user.organizationId,
      status: { in: ['ALLOCATED', 'VERIFIED'] },
      createdAt: { gte: from, lt: periodEnd },
    },
    _sum: { amount: true },
  })
  const totalCaptured = capturedAgg._sum.amount ?? 0

  // Allocated: sum of the allocation breakdown only. The full payment `amount`
  // must NOT be used — it includes the unallocated (excess) portion.
  const allocatedAgg = await db.payment.aggregate({
    where: {
      organizationId: ctx.user.organizationId,
      status: 'ALLOCATED',
      allocatedAt: { gte: from, lt: periodEnd },
    },
    _sum: { allocatedFees: true, allocatedInterest: true, allocatedPrincipal: true },
  })
  const totalAllocated =
    (allocatedAgg._sum.allocatedFees ?? 0) +
    (allocatedAgg._sum.allocatedInterest ?? 0) +
    (allocatedAgg._sum.allocatedPrincipal ?? 0)

  // Ledger: sum of PAYMENT_PRINCIPAL + PAYMENT_INTEREST + PAYMENT_FEES in period
  const ledgerAgg = await db.ledgerEntry.aggregate({
    where: {
      organizationId: ctx.user.organizationId,
      type: { in: ['PAYMENT_PRINCIPAL', 'PAYMENT_INTEREST', 'PAYMENT_FEES'] },
      createdAt: { gte: from, lt: periodEnd },
    },
    _sum: { amount: true },
  })
  const totalLedger = ledgerAgg._sum.amount ?? 0

  // Detect duplicate providerEvents
  const events = await db.webhookEvent.findMany({
    where: {
      organizationId: ctx.user.organizationId,
      receivedAt: { gte: from, lt: periodEnd },
    },
    orderBy: { receivedAt: 'desc' },
  })
  const eventMap = new Map<string, number>()
  for (const ev of events) {
    if (ev.eventId) eventMap.set(ev.eventId, (eventMap.get(ev.eventId) ?? 0) + 1)
  }
  const duplicateExceptions = Array.from(eventMap.entries()).filter(([, n]) => n > 1)

  const exceptions: any[] = []

  for (const [eventId, count] of duplicateExceptions) {
    exceptions.push({
      type: 'DUPLICATE_PROVIDER_EVENT',
      severity: 'HIGH',
      description: `Provider event ${eventId} received ${count} times`,
      reference: eventId,
    })
  }

  if (Math.abs(totalAllocated - totalLedger) > 1) {
    exceptions.push({
      type: 'LEDGER_MISMATCH',
      severity: 'HIGH',
      description: `Allocated payments (${totalAllocated}) do not match ledger entries (${totalLedger})`,
      reference: `${totalAllocated} vs ${totalLedger}`,
    })
  }

  const allocatedPayments = await db.payment.findMany({
    where: {
      organizationId: ctx.user.organizationId,
      status: 'ALLOCATED',
      allocatedAt: { gte: from, lt: periodEnd },
    },
    select: { id: true, paymentNumber: true },
  })

  if (allocatedPayments.length > 0) {
    const paymentNumbers = allocatedPayments.map(p => p.paymentNumber)
    const ledgerCounts = await db.ledgerEntry.groupBy({
      by: ['reference'],
      where: {
        organizationId: ctx.user.organizationId,
        reference: { in: paymentNumbers as string[] }
      },
      _count: { _all: true }
    })
    
    const countMap = new Map(ledgerCounts.map(l => [l.reference, l._count._all]))
    
    for (const p of allocatedPayments) {
      if (!countMap.has(p.paymentNumber) || countMap.get(p.paymentNumber) === 0) {
        exceptions.push({
          type: 'MISSING_LEDGER',
          severity: 'HIGH',
          description: `Payment ${p.paymentNumber} is allocated but has no ledger entries`,
          reference: p.paymentNumber,
        })
      }
    }
  }

  if (exceptions.length > 0) {
    await db.reconciliationException.createMany({
      data: exceptions.map((e) => ({
        organizationId: ctx.user.organizationId,
        runId: run.id,
        type: e.type,
        severity: e.severity,
        description: e.description,
        reference: e.reference,
      })),
    })
  }

  await db.reconciliationRun.update({
    where: { id: run.id },
    data: {
      totalExpected,
      totalCaptured,
      totalAllocated,
      exceptionsCount: exceptions.length,
      status: 'COMPLETED',
    },
  })

  await audit(ctx, 'CREATE', 'ReconciliationRun', run.id, `Reconciliation run ${run.runNumber} for ${from.toISOString()} → ${periodEnd.toISOString()}: ${exceptions.length} exception(s)`)

  return success({
    runNumber: run.runNumber,
    periodStart: from,
    periodEnd,
    totalExpected: String(totalExpected),
    totalCaptured: String(totalCaptured),
    totalAllocated: String(totalAllocated),
    totalLedger: String(totalLedger),
    exceptionsCount: exceptions.length,
    exceptions,
  })
  } catch (err) {
    await db.reconciliationRun.update({
      where: { id: run.id },
      data: { status: 'FAILED' },
    }).catch(() => null)
    throw err
  }
})
