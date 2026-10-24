// GET /api/owner/applications/[id] — detail
import { NextRequest } from 'next/server'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'
import { decryptPIIForMask } from '@/lib/server/crypto'
import { maskAadhaar, maskPan, maskBankAccount } from '@/lib/utils'

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
    // kycAadhaar: full encrypted Aadhaar is no longer stored (UIDAI compliance).
    // Fall back to the candidate's already-masked value.
    kycAadhaar: app.kycAadhaar
      ? maskAadhaar(decryptPIIForMask(app.kycAadhaar))
      : app.candidate?.aadhaarMasked ?? null,
    kycPan: app.kycPan ? maskPan(decryptPIIForMask(app.kycPan)) : null,
    candidate: app.candidate
      ? {
          ...app.candidate,
          // aadhaarMasked is stored as already-masked plaintext (e.g. XXXX-XXXX-1234), not encrypted
          aadhaarMasked: app.candidate.aadhaarMasked ?? null,
          panMasked: app.candidate.panMasked ?? null,
          bankAccount: app.candidate.bankAccount ? maskBankAccount(decryptPIIForMask(app.candidate.bankAccount)) : null,
        }
      : app.candidate,
    qrLink: app.qrLink
      ? {
          ...app.qrLink,
          preAadhaar: app.qrLink.preAadhaar ? maskAadhaar(decryptPIIForMask(app.qrLink.preAadhaar)) : null,
          prePan: app.qrLink.prePan ? maskPan(decryptPIIForMask(app.qrLink.prePan)) : null,
        }
      : null,
    principalAmount: String(app.principalAmount),
    fixedInterest: app.fixedInterest ? String(app.fixedInterest) : null,
    processingFee: app.processingFee ? String(app.processingFee) : null,
    otherFees: app.otherFees ? String(app.otherFees) : null,
    totalRepayable: app.totalRepayable ? String(app.totalRepayable) : null,
    installmentAmount: app.installmentAmount ? String(app.installmentAmount) : null,
  })
})

export const DELETE = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params

  const app = await ctx.db.application.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  })
  if (!app) return notFound('Application not found')

  await audit(ctx, 'DELETE', 'Application', app.id, `Deleted application ${app.applicationNumber} (status: ${app.status})`)

  await ctx.db.application.delete({
    where: { id },
  })

  return success({ message: 'Application deleted successfully' })
})
