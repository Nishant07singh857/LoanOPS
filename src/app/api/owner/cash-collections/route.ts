// GET /api/owner/cash-collections — list all cash collections across the org
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate, paginationSchema } from '@/lib/server/api'

const schema = paginationSchema.extend({
  status: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status } = validate(schema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    organizationId: ctx.user.organizationId,
    method: 'CASH' as const,
    ...(status
      ? status === 'VERIFIED'
        ? { status: { in: ['VERIFIED', 'ALLOCATED'] as any } }
        : { status: status as any }
      : {}),
  }

  const [items, total, unverifiedPayments] = await Promise.all([
    db.payment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { fullName: true, mobile: true } },
        loan: { select: { loanNumber: true } },
        recordedBy: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
      },
    }),
    db.payment.count({ where }),
    db.payment.findMany({
      where: {
        organizationId: ctx.user.organizationId,
        method: 'CASH',
        status: 'PENDING_VERIFICATION',
      },
      select: {
        amount: true,
        recordedById: true,
        recordedBy: { select: { id: true, name: true } },
      },
    }),
  ])

  const agentMap = new Map<
    string,
    { agentId: string; agentName: string; unverifiedAmount: number; count: number }
  >()
  let totalUnverifiedPaise = 0

  for (const p of unverifiedPayments) {
    totalUnverifiedPaise += p.amount
    const agentId = p.recordedById ?? 'unassigned'
    const agentName = p.recordedBy?.name ?? 'Field Agent'
    const existing = agentMap.get(agentId)
    if (existing) {
      existing.unverifiedAmount += p.amount
      existing.count += 1
    } else {
      agentMap.set(agentId, {
        agentId,
        agentName,
        unverifiedAmount: p.amount,
        count: 1,
      })
    }
  }

  const agentCashInHand = Array.from(agentMap.values())
    .sort((a, b) => b.unverifiedAmount - a.unverifiedAmount)
    .map((a) => ({
      agentId: a.agentId,
      agentName: a.agentName,
      unverifiedAmount: String(a.unverifiedAmount),
      count: a.count,
    }))

  return success({
    items: items.map((c) => ({
      id: c.id,
      paymentNumber: c.paymentNumber,
      receiptNumber: c.receiptNumber,
      amount: String(c.amount),
      allocatedFees: String(c.allocatedFees),
      allocatedInterest: String(c.allocatedInterest),
      allocatedPrincipal: String(c.allocatedPrincipal),
      collectionDate: c.createdAt,
      collectionTime: c.createdAt,
      reference: c.reference,
      notes: c.notes,
      proofUrl: c.proofUrl,
      status: c.status,
      verificationStatus:
        c.status === 'VERIFIED' || c.verifiedAt
          ? 'VERIFIED'
          : c.status === 'REJECTED'
            ? 'REJECTED'
            : 'PENDING_VERIFICATION',
      rejectionReason: c.rejectionReason,
      recordedById: c.recordedById,
      recordedBy: c.recordedBy?.name,
      verifiedBy: c.verifiedBy?.name ?? null,
      candidate: c.candidate,
      loan: c.loan,
      createdAt: c.createdAt,
      allocatedAt: c.allocatedAt,
      verifiedAt: c.verifiedAt,
    })),
    total,
    page,
    pageSize,
    agentCashInHand,
    totalUnverifiedCash: String(totalUnverifiedPaise),
  })
})

