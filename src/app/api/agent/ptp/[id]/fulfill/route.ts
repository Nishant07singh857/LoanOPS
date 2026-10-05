// POST /api/agent/ptp/[id]/fulfill — mark a PTP as FULFILLED
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAgent, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound, forbidden } from '@/lib/server/api'

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireAgent()
  const { id } = await params
  const ptp = await db.ptp.findUnique({
    where: { id },
    include: { candidate: true, loan: true },
  })
  if (!ptp) return notFound('PTP not found')
  if (ptp.agentId !== ctx.user.id) return forbidden('You can only update your own PTPs')
  if (ptp.status !== 'ACTIVE') return forbidden('PTP is not active')

  await db.ptp.update({
    where: { id: ptp.id },
    data: { status: 'FULFILLED', fulfilledAt: new Date() },
  })

  await audit(ctx, 'PTP_UPDATE', 'Ptp', ptp.id, `PTP fulfilled for ${ptp.candidate.fullName} (loan ${ptp.loan.loanNumber})`)

  return success({ id: ptp.id, status: 'FULFILLED', fulfilledAt: new Date() })
})
