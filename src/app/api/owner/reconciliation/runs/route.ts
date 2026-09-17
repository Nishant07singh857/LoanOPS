// GET /api/owner/reconciliation/runs — list runs
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const runs = await db.reconciliationRun.findMany({
    where: { organizationId: ctx.user.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return success({
    items: runs.map((r) => ({
      id: r.id,
      runNumber: r.runNumber,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      totalExpected: String(r.totalExpected),
      totalCaptured: String(r.totalCaptured),
      totalAllocated: String(r.totalAllocated),
      exceptionsCount: r.exceptionsCount,
      status: r.status,
      createdAt: r.createdAt,
    })),
  })
})
