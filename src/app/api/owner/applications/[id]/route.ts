// GET /api/owner/applications/[id] — detail
import { NextRequest } from 'next/server'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params

  const app = await ctx.db.application.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
    include: {
      candidate: true,
      qrLink: true,
      loan: { select: { id: true, loanNumber: true, status: true } },
    },
  })
  if (!app) return notFound('Application not found')

  return success({
    ...app,
    principalAmount: String(app.principalAmount),
    fixedInterest: app.fixedInterest ? String(app.fixedInterest) : null,
    processingFee: app.processingFee ? String(app.processingFee) : null,
    otherFees: app.otherFees ? String(app.otherFees) : null,
    totalRepayable: app.totalRepayable ? String(app.totalRepayable) : null,
    installmentAmount: app.installmentAmount ? String(app.installmentAmount) : null,
  })
})
