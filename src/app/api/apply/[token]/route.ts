// GET /api/apply/[token] — PUBLIC. Returns org name + pre-config loan params if any.
// POST /api/apply/[token] — PUBLIC submit. Creates Candidate + Application (status=SUBMITTED).
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiHandler, success, badRequest, notFound, validate, genNumber } from '@/lib/server/api'
import { generateSchedule } from '@/lib/server/financial'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params
  const link = await db.qrLink.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!link) return notFound('Invalid application link')
  if (link.isRevoked) return badRequest('This link has been revoked', 410)
  if (link.expiresAt && link.expiresAt < new Date()) return badRequest('This link has expired', 410)
  if (link.isUsed) return badRequest('This link has already been used', 410)

  // Get the latest active agreement for the org
  const agreement = await db.agreementTemplate.findFirst({
    where: { organizationId: link.organizationId, isActive: true },
    orderBy: { effectiveDate: 'desc' },
  })

  return success({
    organizationName: link.organization.name,
    preConfig: link.prePrincipal ? {
      principalAmount: String(link.prePrincipal),
      interestType: link.preInterestType,
      interestRate: link.preInterestRate,
      fixedInterest: link.preFixedInterest ? String(link.preFixedInterest) : null,
      frequency: link.preFrequency,
      installments: link.preInstallments,
      purpose: link.prePurpose,
    } : null,
    agreement: agreement ? {
      id: agreement.id,
      name: agreement.name,
      version: agreement.version,
      body: agreement.body,
    } : null,
  })
})

const submitSchema = z.object({
  // Personal
  fullName: z.string().min(2).max(200),
  mobile: z.string().min(10).max(20),
  email: z.string().email().optional(),
  dob: z.string().datetime().optional(),
  address: z.string().max(2000).optional(),
  // KYC
  aadhaarMasked: z.string().optional(),
  panMasked: z.string().optional(),
  // Financial
  occupation: z.string().max(200).optional(),
  employer: z.string().max(200).optional(),
  monthlyIncome: z.string().regex(/^\d+$/).optional(),
  existingObligations: z.string().regex(/^\d+$/).optional(),
  // Bank
  bankName: z.string().max(200).optional(),
  bankAccount: z.string().max(50).optional(),
  bankIfsc: z.string().max(20).optional(),
  upiId: z.string().max(100).optional(),
  // Loan
  principalAmount: z.string().regex(/^\d+$/),
  purpose: z.string().min(3).max(500),
  interestType: z.enum(['PERCENTAGE', 'FIXED', 'NONE']),
  interestRate: z.number().int().min(0).optional(),
  fixedInterest: z.string().regex(/^\d+$/).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  installments: z.number().int().min(1).max(360),
  firstDueDate: z.string().datetime(),
  processingFee: z.string().regex(/^\d+$/).optional(),
  otherFees: z.string().regex(/^\d+$/).optional(),
  // Agreement
  agreementTemplateId: z.string().optional(),
  agreementVersion: z.string().optional(),
  agreementAccepted: z.boolean(),
})

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const input = validate(submitSchema, body)

  // Find and validate link
  const link = await db.qrLink.findUnique({
    where: { token },
    include: { organization: true },
  })
  if (!link) return notFound('Invalid application link')
  if (link.isRevoked) return badRequest('This link has been revoked', 410)
  if (link.expiresAt && link.expiresAt < new Date()) return badRequest('This link has expired', 410)
  if (link.isUsed) return badRequest('This link has already been used', 410)

  // Compute schedule on backend
  const schedule = generateSchedule({
    principalPaise: BigInt(input.principalAmount),
    interestType: input.interestType,
    interestRateBps: BigInt(input.interestRate || 0),
    fixedInterestPaise: BigInt(input.fixedInterest || 0),
    frequency: input.frequency,
    installments: input.installments,
    firstDueDate: new Date(input.firstDueDate),
    processingFeePaise: BigInt(input.processingFee || 0),
    otherFeesPaise: BigInt(input.otherFees || 0),
  })

  // Transaction: upsert candidate + create application + create KYC doc + agreement snapshot + audit
  const result = await db.$transaction(async (tx) => {
    // Upsert candidate by mobile + organizationId
    const existing = await tx.candidate.findFirst({
      where: { organizationId: link.organizationId, mobile: input.mobile },
    })

    const candidate = existing
      ? await tx.candidate.update({
          where: { id: existing.id },
          data: {
            fullName: input.fullName,
            email: input.email,
            dob: input.dob ? new Date(input.dob) : existing.dob,
            address: input.address || existing.address,
            occupation: input.occupation || existing.occupation,
            employer: input.employer || existing.employer,
            monthlyIncome: input.monthlyIncome ? Number(input.monthlyIncome) : existing.monthlyIncome,
            existingObligations: input.existingObligations ? Number(input.existingObligations) : existing.existingObligations,
            bankName: input.bankName || existing.bankName,
            bankAccount: input.bankAccount || existing.bankAccount,
            bankIfsc: input.bankIfsc || existing.bankIfsc,
            upiId: input.upiId || existing.upiId,
            aadhaarMasked: input.aadhaarMasked || existing.aadhaarMasked,
            panMasked: input.panMasked || existing.panMasked,
          },
        })
      : await tx.candidate.create({
          data: {
            organizationId: link.organizationId,
            fullName: input.fullName,
            mobile: input.mobile,
            email: input.email,
            dob: input.dob ? new Date(input.dob) : null,
            address: input.address,
            occupation: input.occupation,
            employer: input.employer,
            monthlyIncome: input.monthlyIncome ? Number(input.monthlyIncome) : null,
            existingObligations: input.existingObligations ? Number(input.existingObligations) : null,
            bankName: input.bankName,
            bankAccount: input.bankAccount,
            bankIfsc: input.bankIfsc,
            upiId: input.upiId,
            aadhaarMasked: input.aadhaarMasked,
            panMasked: input.panMasked,
          },
        })

    // Create KYC record (find-or-create — candidateId is not unique in KycDocument)
    const existingKyc = await tx.kycDocument.findFirst({ where: { candidateId: candidate.id } })
    if (existingKyc) {
      await tx.kycDocument.update({
        where: { id: existingKyc.id },
        data: {
          aadhaarNumber: input.aadhaarMasked,
          panNumber: input.panMasked,
          status: 'PENDING',
        },
      })
    } else {
      await tx.kycDocument.create({
        data: {
          candidateId: candidate.id,
          aadhaarNumber: input.aadhaarMasked,
          panNumber: input.panMasked,
          status: 'PENDING',
        },
      })
    }

    // Create application
    const application = await tx.application.create({
      data: {
        organizationId: link.organizationId,
        candidateId: candidate.id,
        qrLinkId: link.id,
        applicationNumber: genNumber('APP'),
        principalAmount: Number(input.principalAmount),
        purpose: input.purpose,
        interestType: input.interestType,
        interestRate: input.interestRate || null,
        fixedInterest: input.fixedInterest ? Number(input.fixedInterest) : null,
        frequency: input.frequency,
        tenureCount: input.installments,
        installments: input.installments,
        firstDueDate: new Date(input.firstDueDate),
        processingFee: input.processingFee ? Number(input.processingFee) : null,
        otherFees: input.otherFees ? Number(input.otherFees) : null,
        totalRepayable: Number(schedule.totalRepayable),
        installmentAmount: Number(schedule.installmentAmount),
        finalDueDate: schedule.finalDueDate,
        status: 'SUBMITTED',
        kycAadhaar: input.aadhaarMasked,
        kycPan: input.panMasked,
        kycStatus: 'PENDING',
        agreementTemplateId: input.agreementTemplateId,
        agreementVersion: input.agreementVersion,
        agreementAcceptedAt: input.agreementAccepted ? new Date() : null,
        submittedAt: new Date(),
      },
    })

    // Mark link as used + link application
    await tx.qrLink.update({
      where: { id: link.id },
      data: {
        isUsed: true,
        submittedAt: new Date(),
        application: { connect: { id: application.id } },
      },
    })

    // Audit
    await tx.auditLog.create({
      data: {
        organizationId: link.organizationId,
        userId: null, // public submission
        action: 'SUBMIT',
        entityType: 'Application',
        entityId: application.id,
        description: `Candidate ${candidate.fullName} submitted ${application.applicationNumber} via link ${token.slice(0, 8)}...`,
      },
    })

    // Notify owner (find OWNER users in this org)
    const owners = await tx.user.findMany({
      where: { organizationId: link.organizationId, role: 'OWNER' },
    })
    for (const o of owners) {
      await tx.notification.create({
        data: {
          organizationId: link.organizationId,
          userId: o.id,
          type: 'APPLICATION_SUBMITTED',
          title: 'New application submitted',
          message: `${candidate.fullName} submitted ${application.applicationNumber} for ₹${Number(input.principalAmount) / 100}.`,
        },
      })
    }

    return { application, candidate }
  })

  return success({
    applicationNumber: result.application.applicationNumber,
    candidateId: result.candidate.id,
    totalRepayable: String(schedule.totalRepayable),
    installmentAmount: String(schedule.installmentAmount),
    finalDueDate: schedule.finalDueDate,
  }, 201)
})
