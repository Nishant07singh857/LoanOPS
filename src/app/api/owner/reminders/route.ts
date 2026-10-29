// GET /api/owner/reminders — owner view of the auto-reminder log:
// today's delivery counts + paginated ReminderLog entries for the org,
// filterable by status / channel / stage.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate, paginationSchema } from '@/lib/server/api'
import { calendarDay } from '@/lib/reminders'

const schema = paginationSchema.extend({
  status: z.enum(['SENT', 'QUEUED', 'SKIPPED_PTP', 'FAILED']).optional(),
  channel: z.enum(['PORTAL', 'WHATSAPP']).optional(),
  stage: z
    .enum([
      'DUE_SOON_3',
      'DUE_SOON_1',
      'DUE_TODAY',
      'OVERDUE_1',
      'OVERDUE_3',
      'OVERDUE_7',
      'OVERDUE_15',
      'OVERDUE_30',
      'RECEIPT',
    ])
    .optional(),
})

/** Start of the current calendar day in the reminder timezone (IST). */
function startOfTodayIst(): Date {
  const { y, m, d } = calendarDay(new Date())
  return new Date(Date.UTC(y, m - 1, d) - 5.5 * 3_600_000)
}

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const orgId = ctx.user.organizationId
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status, channel, stage } = validate(schema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    organizationId: orgId,
    ...(status ? { status: status as any } : {}),
    ...(channel ? { channel: channel as any } : {}),
    ...(stage ? { stage: stage as any } : {}),
  }

  const todayStart = startOfTodayIst()
  const [items, total, org, todayGroups] = await Promise.all([
    db.reminderLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        candidate: { select: { id: true, fullName: true, mobile: true } },
        loan: { select: { id: true, loanNumber: true } },
        installment: { select: { installmentNumber: true } },
      },
    }),
    db.reminderLog.count({ where }),
    db.organization.findUnique({
      where: { id: orgId },
      select: { remindersEnabled: true },
    }),
    db.reminderLog.groupBy({
      by: ['status'],
      where: { organizationId: orgId, createdAt: { gte: todayStart } },
      _count: { _all: true },
    }),
  ])

  const todayCounts: Record<string, number> = {
    SENT: 0,
    QUEUED: 0,
    SKIPPED_PTP: 0,
    FAILED: 0,
  }
  for (const g of todayGroups) todayCounts[g.status] = g._count._all

  return success({
    remindersEnabled: org?.remindersEnabled ?? true,
    todayCounts,
    items: items.map((r) => ({
      id: r.id,
      candidateId: r.candidateId,
      candidateName: r.candidate.fullName,
      candidateMobile: r.candidate.mobile,
      loanId: r.loanId,
      loanNumber: r.loan.loanNumber,
      installmentNumber: r.installment?.installmentNumber ?? null,
      paymentId: r.paymentId,
      stage: r.stage,
      channel: r.channel,
      status: r.status,
      message: r.message,
      error: r.error,
      createdAt: r.createdAt,
    })),
    total,
    page,
    pageSize,
  })
})
