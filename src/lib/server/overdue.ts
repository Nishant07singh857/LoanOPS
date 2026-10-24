// Overdue transition service.
//
// Installments do not age by themselves: without this sweep, a past-due
// installment stays UPCOMING/DUE forever and every overdue KPI, escalation
// and report built on status='OVERDUE' silently understates reality.
//
// refreshOverdueStatuses flips installments that are past due and not fully
// paid to OVERDUE. It is idempotent and safe to call on every dashboard
// load (org-scoped) as well as from the standalone cron runner
// (scripts/mark-overdue.ts, all orgs).

import { db } from '@/lib/db'

/**
 * Marks past-due, not-fully-paid installments as OVERDUE.
 * @param organizationId when given, only that org's loans are swept.
 * @returns number of installments transitioned to OVERDUE.
 */
export async function refreshOverdueStatuses(organizationId?: string): Promise<number> {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  // InstallmentStatus includes both UPCOMING and DUE.
  // paidAmount is a column (not a Prisma-comparable expression against
  // totalDue), so fetch the candidates and filter paidAmount < totalDue
  // in memory, then flip them with a single updateMany by id.
  const candidates = await db.installment.findMany({
    where: {
      status: { in: ['UPCOMING', 'DUE'] },
      dueDate: { lt: startOfToday },
      ...(organizationId ? { loan: { organizationId } } : {}),
    },
    select: { id: true, paidAmount: true, totalDue: true },
  })

  const overdueIds = candidates
    .filter((i) => i.paidAmount < i.totalDue)
    .map((i) => i.id)

  if (overdueIds.length === 0) return 0

  const result = await db.installment.updateMany({
    where: { id: { in: overdueIds }, status: { in: ['UPCOMING', 'DUE'] } },
    data: { status: 'OVERDUE' },
  })

  return result.count
}
