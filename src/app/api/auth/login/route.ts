// POST /api/auth/login — owner/agent login
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  verifyPassword, createSession, setSessionCookie,
  checkLoginRate, recordLoginFailure, clearLoginFailures, getClientIp,
  auditRaw, AuthError,
} from '@/lib/server/auth'
import { apiHandler, success, badRequest, tooMany, unauthorized, serverError, validate } from '@/lib/server/api'

const loginSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(128),
})

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = validate(loginSchema, body)
  const ip = getClientIp(req)

  // Rate limit
  const rl = checkLoginRate(ip)
  if (!rl.ok) {
    return tooMany(`Too many attempts. Retry after ${Math.ceil(rl.retryAfterMs! / 1000)}s`)
  }

  // Find user (only OWNER or AGENT — candidate has its own endpoint)
  const user = await db.user.findFirst({
    where: { email: parsed.email, isActive: true, role: { in: ['OWNER', 'AGENT'] } },
    include: { organization: true },
  })

  if (!user) {
    recordLoginFailure(ip)
    return unauthorized('Invalid email or password')
  }

  // Check if account is locked (DB-level)
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return tooMany('Account temporarily locked due to failed attempts')
  }

  const ok = await verifyPassword(parsed.password, user.passwordHash)
  if (!ok) {
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: { increment: 1 },
        lockedUntil: user.failedLoginAttempts + 1 >= 5
          ? new Date(Date.now() + 15 * 60 * 1000)
          : null,
      },
    })
    recordLoginFailure(ip)
    return unauthorized('Invalid email or password')
  }

  // Success — reset failed attempts
  await db.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })
  clearLoginFailures(ip)

  // Create session
  const token = await createSession(
    { id: user.id, organizationId: user.organizationId },
    { ip, userAgent: req.headers.get('user-agent') || undefined }
  )
  await setSessionCookie(token)

  // Audit
  await auditRaw(user.organizationId, user.id, 'LOGIN', 'User', user.id, `User ${user.email} logged in`, { ip })

  return success({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
  })
})
