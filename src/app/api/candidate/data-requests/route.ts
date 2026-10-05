import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiHandler, success, badRequest, notFound, validate } from '@/lib/server/api'
import { requireCandidate, getClientIp, audit } from '@/lib/server/auth'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { maskAadhaar, maskPan, maskBankAccount } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  const { user, db } = ctx

  if (!user.candidateId) {
    return notFound('Candidate profile not found')
  }

  const isExport = req.nextUrl.searchParams.get('export') === 'true'
  const ipAddress = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || 'unknown'

  if (isExport) {
    const candidate = await db.candidate.findFirst({
      where: { id: user.candidateId, organizationId: user.organizationId },
      include: {
        kycDocs: {
          select: {
            id: true,
            status: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
        consentRecords: {
          orderBy: { createdAt: 'desc' },
        },
        applications: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            applicationNumber: true,
            principalAmount: true,
            purpose: true,
            interestType: true,
            interestRate: true,
            frequency: true,
            installments: true,
            totalRepayable: true,
            installmentAmount: true,
            status: true,
            agreementVersion: true,
            agreementAcceptedAt: true,
            submittedAt: true,
            createdAt: true,
          },
        },
        loans: {
          orderBy: { createdAt: 'desc' },
          include: {
            schedule: {
              orderBy: { installmentNumber: 'asc' },
              select: {
                installmentNumber: true,
                dueDate: true,
                totalDue: true,
                paidAmount: true,
                status: true,
                paidAt: true,
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            paymentNumber: true,
            method: true,
            amount: true,
            status: true,
            receiptNumber: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
        dataSubjectRequests: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!candidate) return notFound('Candidate not found')

    await audit(
      ctx,
      'DATA_REQUEST',
      'Candidate',
      candidate.id,
      'Candidate exported portable personal data package (DPDP Act Section 11)',
      { ipAddress, userAgent, requestType: 'EXPORT' }
    )

    return success({
      exportedAt: new Date().toISOString(),
      policyVersion: COMPLIANCE_CONFIG.policyVersion,
      dataFiduciary: COMPLIANCE_CONFIG.companyName,
      profile: {
        id: candidate.id,
        fullName: candidate.fullName,
        mobile: candidate.mobile,
        secondaryMobile: candidate.secondaryMobile,
        email: candidate.email,
        dob: candidate.dob,
        address: candidate.address,
        occupation: candidate.occupation,
        employer: candidate.employer,
        monthlyIncomePaise: candidate.monthlyIncome,
        bankName: candidate.bankName,
        bankAccountMasked: maskBankAccount(candidate.bankAccount),
        bankIfsc: candidate.bankIfsc,
        upiId: candidate.upiId,
        aadhaarMasked: maskAadhaar(candidate.aadhaarLast4 || candidate.aadhaarMasked),
        panMasked: maskPan(candidate.panMasked),
        status: candidate.status,
        createdAt: candidate.createdAt,
      },
      kycRecords: candidate.kycDocs,
      consents: candidate.consentRecords,
      applications: candidate.applications,
      loans: candidate.loans,
      payments: candidate.payments,
      dataSubjectRequests: candidate.dataSubjectRequests,
    })
  }

  const [requests, consents] = await Promise.all([
    db.dataSubjectRequest.findMany({
      where: {
        organizationId: user.organizationId,
        candidateId: user.candidateId,
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.consentRecord.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [{ candidateId: user.candidateId }, { userId: user.id }],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  return success({
    policyVersion: COMPLIANCE_CONFIG.policyVersion,
    requests,
    consents,
  })
})

const createDataRequestSchema = z.object({}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  const { user, db } = ctx

  if (!user.candidateId) {
    return badRequest('No linked candidate record found')
  }

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const input = validate(createDataRequestSchema, body)

  const ipAddress = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || 'unknown'

  const autoCompleted = input.requestType === 'EXPORT' || input.requestType === 'WITHDRAW_CONSENT'

  const created = await db.$transaction(async (tx) => {
    if (input.requestType === 'WITHDRAW_CONSENT') {
      await tx.consentRecord.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          candidateId: user.candidateId!,
          consentType: 'COMMUNICATION',
          policyVersion: COMPLIANCE_CONFIG.policyVersion,
          granted: false,
          ipAddress,
          userAgent,
        },
      })
    }

    const dsr = await tx.dataSubjectRequest.create({
      data: {
        organizationId: user.organizationId,
        candidateId: user.candidateId!,
        userId: user.id,
        requestType: input.requestType,
        status: autoCompleted ? 'COMPLETED' : 'PENDING',
        reason:
          input.reason ||
          (input.requestType === 'WITHDRAW_CONSENT'
            ? 'Withdrew optional promotional communication consent'
            : `DPDP Act ${input.requestType} request`),
        reviewedAt: autoCompleted ? new Date() : null,
        reviewNotes: autoCompleted
          ? 'Processed automatically via Candidate Self-Service Portal'
          : null,
      },
    })

    // Notify organization owners if manual review is needed (DELETION / CORRECTION)
    if (!autoCompleted) {
      const owners = await tx.user.findMany({
        where: { organizationId: user.organizationId, role: 'OWNER', isActive: true },
        select: { id: true },
      })
      for (const owner of owners) {
        await tx.notification.create({
          data: {
            organizationId: user.organizationId,
            userId: owner.id,
            candidateId: user.candidateId!,
            type: 'INFORMATION_REQUESTED',
            title: `DPDP Data Request: ${input.requestType}`,
            message: `${user.name} submitted a ${input.requestType} request under the DPDP Act, 2023.`,
          },
        })
      }
    }

    return dsr
  })

  await audit(
    ctx,
    'DATA_REQUEST',
    'DataSubjectRequest',
    created.id,
    `Candidate submitted DPDP data request: ${input.requestType}`,
    { ipAddress, userAgent, requestType: input.requestType, reason: input.reason }
  )

  return success(created, 201)
})
