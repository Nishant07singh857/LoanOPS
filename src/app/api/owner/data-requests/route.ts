import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiHandler, success, badRequest, notFound, validate } from '@/lib/server/api'
import { requireOwner, getClientIp, audit } from '@/lib/server/auth'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(async () => {
  const { user, db } = await requireOwner()

  const requests = await db.dataSubjectRequest.findMany({
    where: { organizationId: user.organizationId },
    include: {
      candidate: {
        select: {
          id: true,
          fullName: true,
          mobile: true,
          email: true,
          status: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return success(requests)
})

const reviewSchema = z.object({}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const { user, db } = ctx

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const input = validate(reviewSchema, body)

  const dsr = await db.dataSubjectRequest.findFirst({
    where: { id: input.id, organizationId: user.organizationId },
    include: {
      candidate: {
        include: {
          loans: {
            where: {
              status: { in: ['PENDING_DISBURSEMENT', 'ACTIVE', 'DEFAULTED'] },
            },
            select: { id: true, loanNumber: true, status: true },
          },
        },
      },
    },
  })

  if (!dsr) return notFound('Data subject request not found')

  if (
    dsr.requestType === 'DELETION' &&
    input.status === 'COMPLETED' &&
    dsr.candidate.loans.length > 0
  ) {
    return badRequest(
      'Cannot complete PII erasure while borrower has an active or unpaid loan. Use REJECTED_LEGAL_RETENTION in accordance with RBI/PMLA statutory retention rules.'
    )
  }

  const ipAddress = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || 'unknown'

  const updated = await db.$transaction(async (tx) => {
    if (dsr.requestType === 'DELETION' && input.status === 'COMPLETED') {
      // Anonymize non-statutory optional PII on Candidate while preserving statutory financial & ledger records
      await tx.candidate.update({
        where: { id: dsr.candidateId },
        data: {
          secondaryMobile: null,
          email: null,
          address: null,
          occupation: null,
          employer: null,
          upiId: null,
          status: 'INACTIVE',
          deletedAt: new Date(),
        },
      })
    }

    const res = await tx.dataSubjectRequest.update({
      where: { id: dsr.id },
      data: {
        status: input.status,
        reviewNotes:
          input.reviewNotes ||
          (input.status === 'REJECTED_LEGAL_RETENTION'
            ? 'Retained under RBI / PMLA statutory financial record retention mandate.'
            : 'Completed by Nodal Officer / Owner.'),
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    })

    await tx.notification.create({
      data: {
        organizationId: user.organizationId,
        candidateId: dsr.candidateId,
        type: 'INFORMATION_REQUESTED',
        title: `Data Request (${dsr.requestType}) Updated`,
        message: `Your DPDP Act ${dsr.requestType} request status is now ${input.status}.`,
      },
    })

    return res
  })

  await audit(
    ctx,
    'DATA_REQUEST',
    'DataSubjectRequest',
    updated.id,
    `Owner reviewed DPDP data request (${dsr.requestType}) -> ${input.status}`,
    { ipAddress, userAgent, status: input.status, reviewNotes: input.reviewNotes }
  )

  return success(updated)
})
