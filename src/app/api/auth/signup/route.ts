// POST /api/auth/signup — candidate registration with password policy & DPDP Act consent recording
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiHandler, success, badRequest, validate } from '@/lib/server/api'
import {
  hashPassword,
  validatePasswordPolicy,
  constantTimeDummyVerify,
  getClientIp,
  recordLoginFailure,
  auditRaw,
} from '@/lib/server/auth'
import { enforceRateLimit, verifyCaptchaToken } from '@/lib/server/rate-limit'
import { sanitizeText } from '@/lib/server/security'
import { hashPII } from '@/lib/server/crypto'
import { timingSafeEqual } from 'crypto'

const consentItemSchema = z
  .object({
    consentType: z.string().trim().min(1).max(64),
    granted: z.boolean(),
    policyVersion: z.string().trim().max(32).optional(),
  })
  .strict()

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2).max(200),
    mobile: z.string().trim().min(10).max(20),
    password: z.string().min(10, 'Password must be at least 10 characters').max(128),
    consents: z.array(consentItemSchema).optional(),
    // Required only when the mobile already belongs to a candidate that has a
    // sensitive footprint (applications / loans / KYC / payments). The owner
    // issues it via POST /api/owner/candidates/[id]/claim-code.
    claimCode: z.string().trim().min(4).max(32).optional(),
    captchaToken: z.string().optional().nullable(),
  })
  .strict()

function claimCodeMatches(provided: string, storedHash: string): boolean {
  const providedHash = hashPII(provided.trim().toUpperCase())
  const a = Buffer.from(providedHash, 'utf8')
  const b = Buffer.from(storedHash, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const POST = apiHandler(async (req: NextRequest) => {
  const ip = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || undefined

  const rlResponse = enforceRateLimit(req, 'auth_signup')
  if (rlResponse) return rlResponse

  const body = await req.json().catch(() => null)
  if (!body) {
    recordLoginFailure(ip)
    return badRequest('Invalid JSON')
  }
  const input = validate(signupSchema, body)
  const safeName = sanitizeText(input.fullName)

  const cleanMobile = input.mobile.replace(/\D/g, '').replace(/^91(\d{10})$/, '$1')
  if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
    recordLoginFailure(ip)
    return badRequest('Please enter a valid 10-digit mobile number')
  }

  const policy = validatePasswordPolicy(input.password, {
    name: safeName,
    mobile: cleanMobile,
  })
  if (!policy.ok) {
    return badRequest(policy.error || 'Password does not meet security policy')
  }

  const captcha = await verifyCaptchaToken(input.captchaToken, ip)
  if (!captcha.ok) {
    return badRequest(captcha.reason || 'CAPTCHA verification failed')
  }

  const org = await db.organization.findFirst({ where: { isActive: true } })
  if (!org) return badRequest('System not initialized')

  const [existingUser, existingCandidate] = await Promise.all([
    db.user.findFirst({
      where: {
        OR: [{ email: cleanMobile }, { phone: cleanMobile }],
      },
    }),
    db.candidate.findFirst({
      where: { organizationId: org.id, mobile: cleanMobile },
    }),
  ])

  if (existingUser || (existingCandidate && existingCandidate.userId)) {
    await constantTimeDummyVerify(input.password)
    recordLoginFailure(ip)
    return badRequest('Unable to complete registration with the provided details')
  }

  // Account-takeover guard: a pre-created candidate with NO sensitive
  // footprint (no applications, loans, KYC documents or payments) may be
  // claimed by whoever registers with that mobile. A candidate WITH a
  // footprint may only be claimed with a valid, unexpired claim code issued
  // by the owner — otherwise anyone who knows the borrower's mobile could
  // take over their loans/KYC by simply signing up.
  let claimCodeUsed = false
  if (existingCandidate) {
    const [applicationsCount, loansCount, kycDocsCount, paymentsCount] = await Promise.all([
      db.application.count({ where: { candidateId: existingCandidate.id } }),
      db.loan.count({ where: { candidateId: existingCandidate.id } }),
      db.kycDocument.count({ where: { candidateId: existingCandidate.id } }),
      db.payment.count({ where: { candidateId: existingCandidate.id } }),
    ])
    const hasSensitiveFootprint =
      applicationsCount + loansCount + kycDocsCount + paymentsCount > 0

    if (hasSensitiveFootprint) {
      const claimValid =
        !!input.claimCode &&
        !!existingCandidate.claimCodeHash &&
        !!existingCandidate.claimCodeExpiresAt &&
        existingCandidate.claimCodeExpiresAt > new Date() &&
        claimCodeMatches(input.claimCode, existingCandidate.claimCodeHash)

      if (!claimValid) {
        await constantTimeDummyVerify(input.password)
        recordLoginFailure(ip)
        // Generic message — never reveal whether the mobile, the code, or
        // the candidate record was the problem.
        return badRequest('Unable to complete registration with the provided details')
      }
      claimCodeUsed = true
    }
  }

  const hashedPassword = await hashPassword(input.password)
  const now = new Date()

  const created = await db.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: cleanMobile,
          passwordHash: hashedPassword,
          passwordChangedAt: now,
          name: safeName,
          phone: cleanMobile,
          role: 'CANDIDATE',
        },
      })

      const candidate = existingCandidate
        ? await tx.candidate.update({
            where: { id: existingCandidate.id },
            data: {
              userId: user.id,
              fullName: safeName,
              // Claim codes are single-use — clear them once consumed.
              ...(claimCodeUsed
                ? { claimCodeHash: null, claimCodeExpiresAt: null }
                : {}),
            },
          })
        : await tx.candidate.create({
            data: {
              organizationId: org.id,
              userId: user.id,
              fullName: safeName,
              mobile: cleanMobile,
            },
          })

      // Record explicit DPDP Act 2023 consents
      const consentEntries =
        input.consents && input.consents.length > 0
          ? input.consents
          : [
              { consentType: 'DATA_PROCESSING', granted: true, policyVersion: '2026.1' },
              { consentType: 'TERMS_PRIVACY', granted: true, policyVersion: '2026.1' },
            ]

      for (const c of consentEntries) {
        await tx.consentRecord.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            candidateId: candidate.id,
            consentType: c.consentType,
            policyVersion: c.policyVersion || '2026.1',
            granted: c.granted,
            ipAddress: ip,
            userAgent: userAgent ?? null,
          },
        })
      }

      return { user, candidate }
    },
    { maxWait: 15000, timeout: 30000 }
  )

  await auditRaw(
    org.id,
    created.user.id,
    'CREATE',
    'Candidate',
    created.candidate.id,
    'Candidate registered account and recorded DPDP consents',
    { ipAddress: ip, userAgent, policyVersion: '2026.1' }
  )

  return success({ message: 'Account created successfully' }, 201)
})
