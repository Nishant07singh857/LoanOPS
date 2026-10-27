// POST /api/auth/login — owner/agent (and email-based candidate) login
// Hardened for Phase 2 & 4:
// - Central rate limiter (429 + Retry-After) keyed by IP + email
// - Constant-time dummy bcrypt verification when user is missing (no timing enumeration)
// - Identical error messages for wrong email vs wrong password
// - Locked-account response is intentionally identical to invalid credentials
//   (returning a distinct locked message would confirm the account exists)
// - Account lockout after 5 failures + LOGIN_FAILED append-only audit log
// - Optional TOTP 2FA verification for Owner/Admin accounts
// - Session rotation on login

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  verifyPassword,
  constantTimeDummyVerify,
  createSession,
  setSessionCookie,
  checkLoginRate,
  recordLoginFailure,
  clearLoginFailures,
  getClientIp,
  verifyTotpCode,
  auditRaw,
} from '@/lib/server/auth'
import { apiHandler, success, badRequest, tooMany, unauthorized, validate } from '@/lib/server/api'
import { enforceRateLimit, verifyCaptchaToken } from '@/lib/server/rate-limit'

const loginSchema = z
  .object({
    email: z.string().trim().email().max(255).toLowerCase(),
    password: z.string().min(6).max(128),
    totpCode: z.string().trim().optional().nullable(),
    captchaToken: z.string().optional().nullable(),
  })
  .strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = validate(loginSchema, body)
  const ip = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || undefined
  const rateKey = `${ip}:${parsed.email}`

  const rlResponse = enforceRateLimit(req, 'auth_login', parsed.email)
  if (rlResponse) return rlResponse

  const rl = checkLoginRate(rateKey)
  if (!rl.ok) {
    return tooMany(`Too many login attempts. Please try again in ${Math.ceil(rl.retryAfterMs! / 1000)} seconds.`)
  }

  // Find active user by email
  const user = await db.user.findFirst({
    where: { email: parsed.email, isActive: true },
    include: { organization: true },
  })

  if (!user) {
    await constantTimeDummyVerify(parsed.password)
    recordLoginFailure(rateKey)
    return unauthorized('Invalid credentials')
  }

  // Check if account is locked (DB-level). Respond exactly as for invalid
  // credentials so a locked account cannot be distinguished from a wrong
  // password / unknown email (no account-enumeration oracle).
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await constantTimeDummyVerify(parsed.password)
    return unauthorized('Invalid credentials')
  }

  // Optional CAPTCHA hook after repeated failures
  if (user.failedLoginAttempts >= 3) {
    const captcha = await verifyCaptchaToken(parsed.captchaToken, ip)
    if (!captcha.ok) {
      return badRequest(captcha.reason || 'CAPTCHA verification required')
    }
  }

  const ok = await verifyPassword(parsed.password, user.passwordHash)
  if (!ok) {
    const nextAttempts = user.failedLoginAttempts + 1
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: { increment: 1 },
        lockedUntil: nextAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      },
    })
    recordLoginFailure(rateKey)
    await auditRaw(
      user.organizationId,
      user.id,
      'LOGIN_FAILED',
      'User',
      user.id,
      `Failed login attempt (${nextAttempts})`,
      { ipAddress: ip, userAgent }
    )
    return unauthorized('Invalid credentials')
  }

  // Optional TOTP 2FA check if enabled on account
  if (user.totpEnabled && user.totpSecret) {
    if (!parsed.totpCode) {
      return unauthorized('Two-factor authentication code (totpCode) is required')
    }
    if (!verifyTotpCode(user.totpSecret, parsed.totpCode)) {
      recordLoginFailure(rateKey)
      await auditRaw(
        user.organizationId,
        user.id,
        'LOGIN_FAILED',
        'User',
        user.id,
        'Failed TOTP 2FA verification during login',
        { ipAddress: ip, userAgent }
      )
      return unauthorized('Invalid two-factor authentication code')
    }
  }

  // Success — reset failed attempts
  await db.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })
  clearLoginFailures(rateKey)

  const candidate =
    user.role === 'CANDIDATE' ? await db.candidate.findUnique({ where: { userId: user.id } }) : null

  // Create rotated session
  const token = await createSession(
    { id: user.id, organizationId: user.organizationId },
    { ip, userAgent }
  )
  await setSessionCookie(token)

  await auditRaw(user.organizationId, user.id, 'LOGIN', 'User', user.id, 'User logged in', {
    ipAddress: ip,
    userAgent,
    role: user.role,
  })

  return success({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    phone: user.phone,
    candidateId: candidate?.id ?? null,
    totpEnabled: Boolean(user.totpEnabled),
  })
})
