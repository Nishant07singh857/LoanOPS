// GET /api/owner/reconciliation/exceptions — list open exceptions
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const exceptions = await db.reconciliationException.findMany({
    where: {
      organizationId: ctx.user.organizationId,
      resolvedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  // Fetch run numbers for any exceptions that have a runId
  const runIds = Array.from(new Set(exceptions.map((e) => e.runId).filter(Boolean) as string[]))
  const runs = runIds.length > 0
    ? await db.reconciliationRun.findMany({ where: { id: { in: runIds } }, select: { id: true, runNumber: true } })
    : []
  const runMap = new Map(runs.map((r) => [r.id, r.runNumber]))

  return success({
    items: exceptions.map((e) => ({
      id: e.id,
      runId: e.runId,
      runNumber: e.runId ? runMap.get(e.runId) ?? null : null,
      type: e.type,
      severity: e.severity,
      description: e.description,
      reference: e.reference,
      resolvedAt: e.resolvedAt,
      resolutionNotes: e.resolutionNotes,
      createdAt: e.createdAt,
    })),
  })
})
