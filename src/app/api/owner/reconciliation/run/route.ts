// POST /api/owner/reconciliation/run — run reconciliation for a period
// Compares expected payments (sum of due installments) vs captured vs allocated vs ledger
// Detects exceptions (duplicate provider events, missing ledger, mismatch)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, validate, genNumber } from '@/lib/server/api'

const schema = z.object({}).strict().refine((d) => (d.from && d.to) || (d.periodStart && d.periodEnd), {
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

  const run = await db.reconciliationRun.create({
    data: {
      organizationId: ctx.user.organizationId,
      runNumber: genNumber('RECON'),
      periodStart: from,
      periodEnd: to,
      totalExpected: 0,
      totalCaptured: 0,
      totalAllocated: 0,
      exceptionsCount: 0,
      status: 'COMPLETED',
    },
  })

  const periodEnd = new Date(to.getTime() + 24 * 60 * 60 * 1000)

  // Expected: sum of installments due in period
  const expectedAgg = await db.installment.aggregate({
    where: {
      loan: { organizationId: ctx.user.organizationId },
      dueDate: { gte: from, lt: periodEnd },
    },
    _sum: { totalDue: true },
  })
  const totalExpected = expectedAgg._sum.totalDue ?? 0

  // Captured: payments created in period (INITIATED + ALLOCATED + FAILED)
  const capturedAgg = await db.payment.aggregate({
    where: {
      organizationId: ctx.user.organizationId,
      createdAt: { gte: from, lt: periodEnd },
    },
    _sum: { amount: true },
  })
  const totalCaptured = capturedAgg._sum.amount ?? 0

  // Allocated: payments with allocatedAt in period
  const allocatedAgg = await db.payment.aggregate({
    where: {
      organizationId: ctx.user.organizationId,
      status: 'ALLOCATED',
      allocatedAt: { gte: from, lt: periodEnd },
    },
    _sum: { amount: true },
  })
  const totalAllocated = allocatedAgg._sum.amount ?? 0

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

  await db.reconciliationRun.update({
    where: { id: run.id },
    data: {
      totalExpected,
      totalCaptured,
      totalAllocated,
      exceptionsCount: exceptions.length,
    },
  })

  await audit(ctx, 'CREATE', 'ReconciliationRun', run.id, `Reconciliation run ${run.runNumber} for ${from.toISOString()} → ${to.toISOString()}: ${exceptions.length} exception(s)`)

  return success({
    runNumber: run.runNumber,
    periodStart: from,
    periodEnd: to,
    totalExpected: String(totalExpected),
    totalCaptured: String(totalCaptured),
    totalAllocated: String(totalAllocated),
    totalLedger: String(totalLedger),
    exceptionsCount: exceptions.length,
    exceptions,
  })
})
