// GET /api/apply/[token] — PUBLIC. Returns org name + pre-config loan params if any.
// POST /api/apply/[token] — PUBLIC submit. Creates Candidate + Application (status=SUBMITTED).
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiHandler, success, badRequest, notFound, validate, genNumber } from '@/lib/server/api'
import { generateSchedule } from '@/lib/server/financial'
import { encryptPII, hashPII } from '@/lib/server/crypto'
import { getClientIp } from '@/lib/server/auth'
import { maskAadhaar, maskPan, PAN_REGEX } from '@/lib/utils'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'

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
  // Optional portal password: when the applicant supplies one (QR-link
  // registration flow), a CANDIDATE login account is created in the same
  // transaction so they can log in and complete KYC. When absent (the
  // full apply form), account creation stays with the claim-code signup.
  password: z.string().min(8).max(128).optional(),
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
  // Loan — every term is optional at the API boundary: QR links carry
  // pre-configured terms (prePrincipal, preInterestRate, …) and a
  // registration-style submission may omit them all, in which case the
  // link's values are used. The full apply form sends them explicitly.
  // The handler resolves effective terms and rejects the request only
  // when neither source provides a required term.
  principalAmount: z.string().regex(/^\d+$/).optional(),
  purpose: z.string().min(3).max(500).optional(),
  interestType: z.enum(['PERCENTAGE', 'FIXED', 'NONE']).optional(),
  interestRate: z.number().int().min(0).optional(),
  fixedInterest: z.string().regex(/^\d+$/).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  installments: z.number().int().min(1).max(360).optional(),
  firstDueDate: z.string().datetime().optional(),
  processingFee: z.string().regex(/^\d+$/).optional(),
  otherFees: z.string().regex(/^\d+$/).optional(),
  // Agreement
  agreementTemplateId: z.string().optional(),
  agreementVersion: z.string().optional(),
  agreementAccepted: z.boolean().optional(),
  // DPDP consents — recorded inside this transaction (see below), so the
  // applicant never needs a separate unauthenticated consent call.
  consents: z
    .array(
      z
        .object({
          consentType: z.string().min(1).max(64),
          granted: z.boolean(),
          policyVersion: z.string().optional(),
        })
        .strict()
    )
    .min(1)
    .max(20)
    .optional(),
}).strict()

/**
 * Derives the ONLY Aadhaar representations that may be stored from a posted
 * value (which may be a full 12-digit number or an already-masked string):
 * masked form + last4 + keyed hash. The full Aadhaar is NEVER stored —
 * same pattern as src/app/api/candidate/application/submit/route.ts.
 */
function deriveAadhaar(posted?: string | null) {
  if (!posted) return { masked: undefined, last4: undefined, hash: undefined }
  const digits = posted.replace(/\D/g, '')
  if (digits.length === 12) {
    return {
      masked: maskAadhaar(digits),
      last4: digits.slice(-4),
      hash: hashPII(digits),
    }
  }
  // Already-masked input (e.g. XXXX-XXXX-1234): keep only the masked form.
  return {
    masked: maskAadhaar(posted),
    last4: digits.length === 4 ? digits : undefined,
    hash: undefined,
  }
}

/**
 * Derives the storable PAN representations from a posted value: masked form
 * for display + AES-encrypted full PAN for the KYC document. An
 * already-masked PAN cannot be encrypted (the full value is unknown), so
 * only the masked form is kept in that case.
 */
function derivePan(posted?: string | null) {
  if (!posted) return { masked: undefined, encrypted: undefined }
  const cleaned = posted.trim().toUpperCase().replace(/\s+/g, '')
  if (PAN_REGEX.test(cleaned)) {
    return { masked: maskPan(cleaned), encrypted: encryptPII(cleaned) }
  }
  return { masked: cleaned, encrypted: undefined }
}

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
  const { enforceRateLimit } = await import('@/lib/server/rate-limit')
  const rlResponse = enforceRateLimit(req, 'public_api')
  if (rlResponse) return rlResponse

  const { token } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const input = validate(submitSchema, body)

  const ipAddress = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || undefined

  // SECURITY: never persist a full Aadhaar or PAN from this public endpoint.
  const aadhaar = deriveAadhaar(input.aadhaarMasked)
  const pan = derivePan(input.panMasked)

  // Find and validate link
  const link = await db.qrLink.findUnique({
    where: { token },
    include: { organization: true },
  })
  if (!link) return notFound('Invalid application link')
  if (link.isRevoked) return badRequest('This link has been revoked', 410)
  if (link.expiresAt && link.expiresAt < new Date()) return badRequest('This link has expired', 410)
  if (link.isUsed) return badRequest('This link has already been used', 410)

  // Resolve effective loan terms: explicit request values win; anything
  // omitted falls back to the QR link's pre-configured terms.
  const principalAmount =
    input.principalAmount ?? (link.prePrincipal != null ? String(link.prePrincipal) : undefined)
  const interestType = input.interestType ?? link.preInterestType ?? undefined
  const interestRate = input.interestRate ?? link.preInterestRate ?? undefined
  const fixedInterest =
    input.fixedInterest ?? (link.preFixedInterest != null ? String(link.preFixedInterest) : undefined)
  const frequency = input.frequency ?? link.preFrequency ?? undefined
  const installments = input.installments ?? link.preInstallments ?? link.preTenure ?? undefined
  const purpose = input.purpose ?? link.prePurpose ?? undefined
  const processingFee =
    input.processingFee ?? (link.preProcessingFee != null ? String(link.preProcessingFee) : undefined)
  const otherFees =
    input.otherFees ?? (link.preOtherFees != null ? String(link.preOtherFees) : undefined)
  const agreementAccepted = input.agreementAccepted ?? false

  if (!principalAmount || !interestType || !frequency || !installments || !purpose) {
    return badRequest(
      'Loan terms are incomplete: provide principalAmount, interestType, frequency, installments and purpose, or use a QR link with pre-configured terms'
    )
  }

  // First due date: explicit > link's pre-configured > one period from today.
  const firstDueDate = input.firstDueDate
    ? new Date(input.firstDueDate)
    : link.preFirstDueDate
      ? new Date(link.preFirstDueDate)
      : (() => {
          const d = new Date()
          if (frequency === 'DAILY') d.setDate(d.getDate() + 1)
          else if (frequency === 'WEEKLY') d.setDate(d.getDate() + 7)
          else d.setMonth(d.getMonth() + 1)
          return d
        })()

  // Compute schedule on backend
  const schedule = generateSchedule({
    principalPaise: BigInt(principalAmount),
    interestType,
    interestRateBps: BigInt(interestRate || 0),
    fixedInterestPaise: BigInt(fixedInterest || 0),
    frequency,
    installments,
    firstDueDate,
    processingFeePaise: BigInt(processingFee || 0),
    otherFeesPaise: BigInt(otherFees || 0),
  })

  // Transaction: upsert candidate + create application + create KYC doc + agreement snapshot + audit
  const result = await db.$transaction(async (tx) => {
    // Upsert candidate by mobile + organizationId
    const existing = await tx.candidate.findFirst({
      where: { organizationId: link.organizationId, mobile: input.mobile },
    })

    // An existing candidate that has already been claimed (userId set) or
    // already has a KYC document is PROTECTED: a public link holder must not
    // be able to overwrite their bank/KYC/contact details (disbursement
    // diversion risk). For protected records only currently-empty fields
    // are filled; unprotected records keep the normal update behaviour.
    const existingKyc = existing
      ? await tx.kycDocument.findFirst({ where: { candidateId: existing.id } })
      : null
    const isProtected = !!existing && (!!existing.userId || !!existingKyc)
    const fillOnly = <T,>(current: T | null | undefined, next: T | null | undefined): T | null | undefined =>
      isProtected ? (current ?? next) : (next || current)

    let candidate = existing
      ? await tx.candidate.update({
          where: { id: existing.id },
          data: {
            fullName: isProtected ? existing.fullName : input.fullName,
            email: fillOnly(existing.email, input.email),
            dob: input.dob ? new Date(input.dob) : existing.dob,
            address: fillOnly(existing.address, input.address),
            occupation: fillOnly(existing.occupation, input.occupation),
            employer: fillOnly(existing.employer, input.employer),
            monthlyIncome: input.monthlyIncome ? Number(input.monthlyIncome) : existing.monthlyIncome,
            existingObligations: input.existingObligations ? Number(input.existingObligations) : existing.existingObligations,
            bankName: fillOnly(existing.bankName, input.bankName),
            bankAccount: isProtected
              ? fillOnly(existing.bankAccount, input.bankAccount)
              : input.bankAccount || existing.bankAccount,
            bankIfsc: isProtected
              ? fillOnly(existing.bankIfsc, input.bankIfsc)
              : input.bankIfsc || existing.bankIfsc,
            upiId: fillOnly(existing.upiId, input.upiId),
            aadhaarMasked: isProtected
              ? fillOnly(existing.aadhaarMasked, aadhaar.masked)
              : aadhaar.masked || existing.aadhaarMasked,
            aadhaarLast4: isProtected
              ? fillOnly(existing.aadhaarLast4, aadhaar.last4)
              : aadhaar.last4 || existing.aadhaarLast4,
            aadhaarHash: isProtected
              ? fillOnly(existing.aadhaarHash, aadhaar.hash)
              : aadhaar.hash || existing.aadhaarHash,
            panMasked: isProtected
              ? fillOnly(existing.panMasked, pan.masked)
              : pan.masked || existing.panMasked,
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
            aadhaarMasked: aadhaar.masked,
            aadhaarLast4: aadhaar.last4,
            aadhaarHash: aadhaar.hash,
            panMasked: pan.masked,
          },
        })

    // Portal account: when the applicant supplied a password and this
    // candidate has no linked login yet, create the CANDIDATE user in the
    // same transaction (same shape as the claim-code signup: the login
    // email IS the mobile number). An already-claimed candidate's password
    // is NEVER overwritten from a public link, and if a user with this
    // mobile-as-email already exists (e.g. claimed via signup in another
    // flow) linking is skipped rather than failing the application.
    if (input.password && !candidate.userId) {
      const existingUser = await tx.user.findUnique({ where: { email: input.mobile } })
      if (!existingUser) {
        const { hashPassword } = await import('@/lib/server/auth')
        const portalUser = await tx.user.create({
          data: {
            organizationId: link.organizationId,
            email: input.mobile,
            passwordHash: await hashPassword(input.password),
            passwordChangedAt: new Date(),
            name: input.fullName,
            phone: input.mobile,
            role: 'CANDIDATE',
          },
        })
        candidate = await tx.candidate.update({
          where: { id: candidate.id },
          data: { userId: portalUser.id },
        })
      }
    }

    // Create KYC record (find-or-create — candidateId is not unique in KycDocument)
    // SECURITY: aadhaarNumber is NEVER written here (full Aadhaar is not
    // stored anywhere); panNumber holds only the AES-encrypted PAN.
    if (existingKyc) {
      if (!isProtected) {
        await tx.kycDocument.update({
          where: { id: existingKyc.id },
          data: {
            panNumber: pan.encrypted ?? existingKyc.panNumber,
            status: 'PENDING',
          },
        })
      } else if (!existingKyc.panNumber && pan.encrypted) {
        await tx.kycDocument.update({
          where: { id: existingKyc.id },
          data: { panNumber: pan.encrypted },
        })
      }
    } else {
      await tx.kycDocument.create({
        data: {
          candidateId: candidate.id,
          aadhaarNumber: null,
          panNumber: pan.encrypted ?? null,
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
        principalAmount: Number(principalAmount),
        purpose: purpose,
        interestType: interestType,
        interestRate: interestRate || null,
        fixedInterest: fixedInterest ? Number(fixedInterest) : null,
        frequency: frequency,
        tenureCount: installments,
        installments: installments,
        firstDueDate: firstDueDate,
        processingFee: processingFee ? Number(processingFee) : null,
        otherFees: otherFees ? Number(otherFees) : null,
        totalRepayable: Number(schedule.totalRepayable),
        installmentAmount: Number(schedule.installmentAmount),
        finalDueDate: schedule.finalDueDate,
        status: 'SUBMITTED',
        // Only masked Aadhaar / encrypted PAN snapshots — never raw values.
        kycAadhaar: aadhaar.masked ?? null,
        kycPan: pan.encrypted ?? null,
        kycStatus: 'PENDING',
        agreementTemplateId: input.agreementTemplateId,
        agreementVersion: input.agreementVersion,
        agreementAcceptedAt: agreementAccepted ? new Date() : null,
        submittedAt: new Date(),
      },
    })

    // Record the applicant's DPDP consents in THIS transaction, linked to
    // the candidate + application just created — no separate (previously
    // unauthenticated) POST /api/consents call is needed for public applies.
    const consentEntries =
      input.consents && input.consents.length > 0
        ? input.consents
        : [
            { consentType: 'DATA_PROCESSING', granted: agreementAccepted, policyVersion: COMPLIANCE_CONFIG.policyVersion },
            { consentType: 'KYC_AADHAAR', granted: agreementAccepted, policyVersion: COMPLIANCE_CONFIG.policyVersion },
            { consentType: 'CREDIT_CHECK', granted: agreementAccepted, policyVersion: COMPLIANCE_CONFIG.policyVersion },
            { consentType: 'KFS_DISCLOSURE', granted: agreementAccepted, policyVersion: COMPLIANCE_CONFIG.policyVersion },
          ]
    for (const c of consentEntries) {
      await tx.consentRecord.create({
        data: {
          organizationId: link.organizationId,
          userId: candidate.userId ?? null,
          candidateId: candidate.id,
          applicationId: application.id,
          consentType: c.consentType,
          policyVersion: c.policyVersion || COMPLIANCE_CONFIG.policyVersion,
          granted: c.granted,
          ipAddress,
          userAgent: userAgent ?? null,
        },
      })
    }

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
          message: `${candidate.fullName} submitted ${application.applicationNumber} for ₹${Number(principalAmount) / 100}.`,
        },
      })
    }

    return { application, candidate }
  }, { maxWait: 15000, timeout: 30000 })

  return success({
    applicationId: result.application.id,
    applicationNumber: result.application.applicationNumber,
    candidateId: result.candidate.id,
    totalRepayable: String(schedule.totalRepayable),
    installmentAmount: String(schedule.installmentAmount),
    finalDueDate: schedule.finalDueDate,
  }, 201)
})
