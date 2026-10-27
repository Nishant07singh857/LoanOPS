import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireCandidate, audit, getClientIp } from '@/lib/server/auth'
import { apiHandler, success, badRequest, validate } from '@/lib/server/api'
import {
  AADHAAR_REGEX,
  PAN_REGEX,
  IFSC_REGEX,
  BANK_ACCOUNT_REGEX,
  maskAadhaar,
  maskPan,
} from '@/lib/utils'
import { encryptPII, hashPII } from '@/lib/server/crypto'
import { enforceRateLimit } from '@/lib/server/rate-limit'
import { resolvePrivateStoragePath, validateAndStoreDataUrlUpload } from '@/lib/server/security'

const MAX_LOAN_PAISE = 1_000_000_000 // ₹1 Crore in paise

const consentItemSchema = z.object({
  consentType: z.string(),
  granted: z.boolean(),
  policyVersion: z.string().optional(),
}).strict()

const submitSchema = z.object({
  principalAmount: z.number().int().positive().optional(),
  aadhaarNumber: z
    .string()
    .trim()
    .regex(AADHAAR_REGEX, 'Invalid Aadhaar format')
    .optional()
    .nullable(),
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN_REGEX, 'Invalid PAN format')
    .optional()
    .nullable(),
  bankName: z.string().trim().min(2).max(100).optional().nullable(),
  bankAccount: z
    .string()
    .trim()
    .regex(BANK_ACCOUNT_REGEX, 'Invalid bank account number')
    .optional()
    .nullable(),
  bankIfsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(IFSC_REGEX, 'Invalid IFSC format')
    .optional()
    .nullable(),
  upiId: z.string().trim().max(100).optional().nullable(),
  aadhaarBase64: z.string().optional().nullable(),
  panBase64: z.string().optional().nullable(),
  agreementAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and KFS disclosure to proceed',
  }),
  consents: z.array(consentItemSchema).min(1).max(20).optional(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  const rlResponse = enforceRateLimit(req, 'apply_submit', ctx.user.id)
  if (rlResponse) return rlResponse

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const input = validate(submitSchema, body)

  if (!input.agreementAccepted) {
    return badRequest('You must accept the agreement and KFS disclosure to continue')
  }

  // Validate uploaded KYC documents (magic-byte check + EXIF stripping + private storage)
  // SECURITY: Aadhaar images are no longer accepted or stored to comply with data minimization.
  let storedAadhaarUrl: string | undefined = undefined

  let storedPanUrl: string | undefined
  let validatedPanRef: string | undefined
  let panWasFreshUpload = false

  // Best-effort cleanup for a file newly stored by this request when a
  // later eligibility check rejects the submission (avoids orphans).
  const discardStored = async (ref: string | undefined) => {
    if (!ref) return
    try {
      const fileKey = ref.split('?')[0].replace('/api/files/', '')
      const safePath = resolvePrivateStoragePath(fileKey)
      if (safePath) await fs.unlink(safePath)
    } catch {
      // Ignore cleanup errors.
    }
  }

  // A panBase64 value that is already a private file reference bypasses
  // storage in validateAndStoreDataUrlUpload, so validate it here first:
  // it must resolve to an existing file on disk and belong to this candidate.
  if (input.panBase64) {
    const trimmedPan = input.panBase64.trim()
    if (trimmedPan.startsWith('/api/files/')) {
      const ref = trimmedPan.split('?')[0]
      const fileKey = ref.slice('/api/files/'.length)
      let refIsValid = false
      const safePath = resolvePrivateStoragePath(fileKey)
      if (safePath) {
        try {
          await fs.access(safePath)
          const [kycMatch, docMatch] = await Promise.all([
            db.kycDocument.findFirst({
              where: {
                candidateId: ctx.user.candidateId,
                OR: [{ panUrl: ref }, { aadhaarUrl: ref }],
              },
            }),
            db.document.findFirst({
              where: { candidateId: ctx.user.candidateId, fileUrl: ref },
            }),
          ])
          refIsValid = !!(kycMatch || docMatch)
        } catch {
          refIsValid = false
        }
      }
      if (!refIsValid) return badRequest('Invalid file reference')
      validatedPanRef = ref
    }
  }

  if (input.panBase64) {
    const check = await validateAndStoreDataUrlUpload(input.panBase64, {
      maxBytes: 5 * 1024 * 1024,
      allowPdf: true,
    })
    if (!check.ok) return badRequest(check.error)
    storedPanUrl = check.storedRef ?? undefined
    // Fresh upload iff the helper stored a new file: in the reference case
    // storedPanUrl is exactly the pre-validated reference and must not be
    // deleted by the orphan cleanup below.
    panWasFreshUpload = !!storedPanUrl && storedPanUrl !== validatedPanRef
  }

  const draftApplication = await db.application.findFirst({
    where: {
      candidateId: ctx.user.candidateId,
      organizationId: ctx.user.organizationId,
      OR: [
        // Owner/agent-created applications start as DRAFT for candidate
        // completion through this endpoint.
        { status: { in: ['DRAFT', 'INFORMATION_REQUESTED'] } },
        // QR self-apply creates a SUBMITTED application up front (terms +
        // agreement + consents are collected on the public form), but the
        // applicant still completes KYC afterwards here — until an
        // Aadhaar snapshot is on file.
        { status: 'SUBMITTED', kycAadhaar: null },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!draftApplication) {
    if (panWasFreshUpload) await discardStored(storedPanUrl)
    return badRequest('No pending application found')
  }

  const principalPaise = input.principalAmount ?? draftApplication.principalAmount
  if (!Number.isFinite(principalPaise) || principalPaise <= 0 || principalPaise > MAX_LOAN_PAISE) {
    if (panWasFreshUpload) await discardStored(storedPanUrl)
    return badRequest('Invalid loan principal amount on application')
  }
  if (!draftApplication.installments || draftApplication.installments < 1 || draftApplication.installments > 360) {
    if (panWasFreshUpload) await discardStored(storedPanUrl)
    return badRequest('Invalid installment count on application')
  }

  const cleanAadhaar = input.aadhaarNumber || undefined
  const cleanPan = input.panNumber || undefined
  const maskedAadhaar = cleanAadhaar ? maskAadhaar(cleanAadhaar) : undefined
  const aadhaarLast4 = cleanAadhaar ? cleanAadhaar.slice(-4) : undefined
  const aadhaarHash = cleanAadhaar ? hashPII(cleanAadhaar) : undefined
  const maskedPan = cleanPan ? maskPan(cleanPan) : undefined
  // SECURITY: Full Aadhaar is NEVER stored (not even encrypted) per UIDAI Aadhaar Act.
  // Only aadhaarLast4 + aadhaarHash are persisted on the Candidate model.
  const encryptedAadhaar: string | undefined = undefined
  const encryptedPan = cleanPan ? encryptPII(cleanPan) : undefined
  const encryptedBankAccount = input.bankAccount ? encryptPII(input.bankAccount) : undefined

  if (
    maskedAadhaar ||
    aadhaarLast4 ||
    aadhaarHash ||
    maskedPan ||
    input.bankName ||
    encryptedBankAccount ||
    input.bankIfsc ||
    input.upiId
  ) {
    await db.candidate.update({
      where: { id: ctx.user.candidateId },
      data: {
        ...(maskedAadhaar ? { aadhaarMasked: maskedAadhaar } : {}),
        ...(aadhaarLast4 ? { aadhaarLast4 } : {}),
        ...(aadhaarHash ? { aadhaarHash } : {}),
        ...(maskedPan ? { panMasked: maskedPan } : {}),
        ...(input.bankName ? { bankName: input.bankName } : {}),
        ...(encryptedBankAccount ? { bankAccount: encryptedBankAccount } : {}),
        ...(input.bankIfsc ? { bankIfsc: input.bankIfsc } : {}),
        ...(input.upiId ? { upiId: input.upiId } : {}),
      },
    })
  }

  const existingKyc = await db.kycDocument.findFirst({ where: { candidateId: ctx.user.candidateId } })
  if (existingKyc) {
    await db.kycDocument.update({
      where: { id: existingKyc.id },
      data: {
        aadhaarUrl: storedAadhaarUrl || existingKyc.aadhaarUrl,
        panUrl: storedPanUrl || existingKyc.panUrl,
        aadhaarNumber: encryptedAadhaar || existingKyc.aadhaarNumber,
        panNumber: encryptedPan || existingKyc.panNumber,
        status: 'PENDING',
      },
    })
  } else {
    await db.kycDocument.create({
      data: {
        candidateId: ctx.user.candidateId,
        aadhaarUrl: storedAadhaarUrl,
        panUrl: storedPanUrl,
        aadhaarNumber: encryptedAadhaar ?? null,
        panNumber: encryptedPan ?? null,
        status: 'PENDING',
      },
    })
  }

  const activeAgreement = await db.agreementTemplate.findFirst({
    where: { organizationId: draftApplication.organizationId, isActive: true },
    orderBy: { effectiveDate: 'desc' },
  })

  const updatedApp = await db.application.update({
    where: { id: draftApplication.id },
    data: {
      status: 'SUBMITTED',
      kycAadhaar: encryptedAadhaar ?? draftApplication.kycAadhaar,
      kycPan: encryptedPan ?? draftApplication.kycPan,
      kycStatus: 'PENDING',
      agreementTemplateId: activeAgreement?.id,
      agreementVersion: activeAgreement?.version,
      agreementAcceptedAt: new Date(),
      submittedAt: new Date(),
    },
  })

  // Record explicit KYC, Credit Check, and KFS Consents
  const ip = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || null
  const consentEntries =
    input.consents && input.consents.length > 0
      ? input.consents
      : [
          { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
          { consentType: 'KYC_AADHAAR', granted: true, policyVersion: '2026.1' },
          { consentType: 'CREDIT_CHECK', granted: true, policyVersion: '2026.1' },
          { consentType: 'KFS_DISCLOSURE', granted: true, policyVersion: '2026.1' },
        ]

  for (const c of consentEntries) {
    await db.consentRecord.create({
      data: {
        organizationId: draftApplication.organizationId,
        userId: ctx.user.id,
        candidateId: ctx.user.candidateId,
        applicationId: updatedApp.id,
        consentType: c.consentType,
        policyVersion: c.policyVersion || '2026.1',
        granted: c.granted,
        ipAddress: ip,
        userAgent,
      },
    })
  }

  const candidate = await db.candidate.findUnique({ where: { id: ctx.user.candidateId } })
  const owners = await db.user.findMany({
    where: { organizationId: draftApplication.organizationId, role: 'OWNER', isActive: true },
  })
  for (const o of owners) {
    await db.notification.create({
      data: {
        organizationId: draftApplication.organizationId,
        userId: o.id,
        type: 'APPLICATION_SUBMITTED',
        title: 'New application submitted',
        message: `${candidate?.fullName} submitted ${updatedApp.applicationNumber} for ₹${Number(updatedApp.principalAmount) / 100}.`,
      },
    })
  }

  await audit(
    ctx,
    'SUBMIT',
    'Application',
    updatedApp.id,
    `Candidate ${candidate?.fullName ?? ctx.user.name} submitted application ${updatedApp.applicationNumber}`,
    { ipAddress: ip, userAgent }
  )

  return success({ message: 'Application submitted successfully', applicationNumber: updatedApp.applicationNumber })
})
