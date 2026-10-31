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
import { canonicalizeMobile } from '@/lib/mobile'
import { candidateRequiresClaimCode } from '@/lib/candidate-footprint'
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
    // Required when the mobile already belongs to a candidate that has a
    // sensitive footprint (applications / loans / KYC / payments, or any
    // staff-entered PII on the record), or when the same mobile exists in
    // more than one organization. The owner issues it via
    // POST /api/owner/candidates/[id]/claim-code.
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

  const rlResponse = await enforceRateLimit(req, 'auth_signup')
  if (rlResponse) return rlResponse

  const body = await req.json().catch(() => null)
  if (!body) {
    await recordLoginFailure(ip)
    return badRequest('Invalid JSON')
  }
  const input = validate(signupSchema, body)
  const safeName = sanitizeText(input.fullName)

  // Canonical form only: Devanagari/Arabic/fullwidth digit spellings
  // and 0 / 91 / 0091 prefixes fold to the stored 10-digit form.
  const cleanMobile = canonicalizeMobile(input.mobile)
  if (!cleanMobile) {
    await recordLoginFailure(ip)
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

  const existingUser = await db.user.findFirst({
    where: {
      OR: [{ email: cleanMobile }, { phone: cleanMobile }],
    },
  })
  if (existingUser) {
    await constantTimeDummyVerify(input.password)
    await recordLoginFailure(ip)
    return badRequest('Unable to complete registration with the provided details')
  }

  // Account-takeover guard: a pre-created candidate with NO sensitive
  // footprint may be claimed by whoever registers with that mobile. A
  // candidate WITH a footprint may only be claimed with a valid,
  // unexpired claim code issued by the owner — otherwise anyone who
  // knows the borrower's mobile could take over their record by
  // simply signing up. "Footprint" covers applications / loans / KYC
  // documents / payments AND any staff-entered PII on the record
  // (round 2, R4: PII-rich leads with no application were claimable
  // with the mobile alone).
  //
  // Candidates are per-organization while signup is global, so
  // resolve EVERY record carrying this canonical mobile (at most one
  // per org — the (organizationId, mobile) unique index enforces it):
  // - a presented claim code binds deterministically to the record
  //   whose stored hash matches (R4), which also disambiguates the
  //   same mobile existing in more than one org (round 2, N8);
  // - without a code, a mobile present in MORE THAN ONE org cannot
  //   be claimed at all — the code is what says which org's borrower
  //   is registering.
  const sameMobileCandidates = await db.candidate.findMany({
    where: { mobile: cleanMobile, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })

  const failRegistration = async () => {
    await constantTimeDummyVerify(input.password)
    await recordLoginFailure(ip)
    // Generic message — never reveal whether the mobile, the code, or
    // the candidate record was the problem.
    return badRequest('Unable to complete registration with the provided details')
  }

  let existingCandidate: (typeof sameMobileCandidates)[number] | null = null
  let claimCodeUsed = false

  if (input.claimCode) {
    const now = new Date()
    const match = sameMobileCandidates.find(
      (c) =>
        !!c.claimCodeHash &&
        !!c.claimCodeExpiresAt &&
        c.claimCodeExpiresAt > now &&
        claimCodeMatches(input.claimCode as string, c.claimCodeHash as string)
    )
    if (!match || match.userId) return failRegistration()
    existingCandidate = match
    claimCodeUsed = true
  } else if (sameMobileCandidates.length > 1) {
    return failRegistration()
  } else if (sameMobileCandidates.length === 1) {
    const candidate = sameMobileCandidates[0]
    if (candidate.userId) return failRegistration()
    const [applicationsCount, loansCount, kycDocsCount, paymentsCount] = await Promise.all([
      db.application.count({ where: { candidateId: candidate.id } }),
      db.loan.count({ where: { candidateId: candidate.id } }),
      db.kycDocument.count({ where: { candidateId: candidate.id } }),
      db.payment.count({ where: { candidateId: candidate.id } }),
    ])
    const needsCode = candidateRequiresClaimCode(candidate, {
      applications: applicationsCount,
      loans: loansCount,
      kycDocuments: kycDocsCount,
      payments: paymentsCount,
    })
    if (needsCode) return failRegistration()
    existingCandidate = candidate
  }

  const hashedPassword = await hashPassword(input.password)
  const now = new Date()
  // A claimed candidate's login belongs to THAT candidate's
  // organization (which may differ from the default org when the same
  // mobile exists in several orgs and a claim code disambiguated).
  const targetOrgId = existingCandidate?.organizationId ?? org.id

  const created = await db.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: targetOrgId,
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
            organizationId: targetOrgId,
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
    targetOrgId,
    created.user.id,
    'CREATE',
    'Candidate',
    created.candidate.id,
    'Candidate registered account and recorded DPDP consents',
    { ipAddress: ip, userAgent, policyVersion: '2026.1' }
  )

  return success({ message: 'Account created successfully' }, 201)
})
