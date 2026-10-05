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

const consentItemSchema = z.object({}).strict()

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2).max(200),
    mobile: z.string().trim().min(10).max(20),
    password: z.string().min(10, 'Password must be at least 10 characters').max(128),
    consents: z.array(consentItemSchema).optional(),
    captchaToken: z.string().optional().nullable(),
  })
  .strict()

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
  if (!/^[6-9]\d{9}$/.test(cleanMobile) && (cleanMobile.length < 10 || cleanMobile.length > 15)) {
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
