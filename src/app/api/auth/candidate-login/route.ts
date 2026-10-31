// POST /api/auth/candidate-login — candidate portal login
// Hardened for Phase 2 & 4:
// - Central rate limiting keyed by IP + mobile
// - Constant-time dummy bcrypt check on missing candidate (no timing enumeration)
// - Identical error message for unknown mobile vs wrong password
// - Locked-account response is intentionally identical to invalid credentials
//   (returning a distinct locked message would confirm the account exists)
// - Failed login audit log + lockout after 5 attempts

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
  auditRaw,
} from '@/lib/server/auth'
import { apiHandler, success, badRequest, tooMany, unauthorized, validate } from '@/lib/server/api'
import { enforceRateLimit } from '@/lib/server/rate-limit'
import { canonicalizeMobile } from '@/lib/mobile'

const schema = z
  .object({
    mobile: z.string().trim().min(10).max(20),
    password: z.string().min(6).max(128),
  })
  .strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = validate(schema, body)
  // Canonicalize like every other path: any spelling of the number
  // (prefixes, spaces, non-ASCII digit glyphs) resolves to the stored
  // 10-digit form. An unparseable mobile simply matches nothing.
  const cleanMobile = canonicalizeMobile(parsed.mobile) ?? ''
  const ip = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || undefined
  const rateKey = `${ip}:${cleanMobile}`

  const rlResponse = await enforceRateLimit(req, 'auth_login', cleanMobile)
  if (rlResponse) return rlResponse

  const rl = await checkLoginRate(rateKey)
  if (!rl.ok) {
    return tooMany(`Too many login attempts. Please try again in ${Math.ceil(rl.retryAfterMs! / 1000)} seconds.`)
  }

  // Resolve the candidate BY userId first: find the CANDIDATE user for this
  // mobile (their login email/phone IS the mobile), then load the candidate
  // linked to that user. This avoids the old first-mobile-match behaviour,
  // which could pick another organisation's candidate sharing the mobile.
  // The mobile lookup is kept only as a fallback for legacy records whose
  // user has no matching email/phone.
  const loadCandidateByMobile = () =>
    db.candidate.findFirst({
      where: {
        mobile: { in: [parsed.mobile, cleanMobile] },
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: { organization: true, assignedAgent: true },
    })
  type CandidateWithOrg = NonNullable<Awaited<ReturnType<typeof loadCandidateByMobile>>>
  let candidate: CandidateWithOrg | null = null
  let user: Awaited<ReturnType<typeof db.user.findUnique>> = null

  const userMatch = await db.user.findFirst({
    where: {
      role: 'CANDIDATE',
      OR: [{ email: cleanMobile }, { phone: cleanMobile }],
    },
  })
  if (userMatch) {
    const linked = await db.candidate.findUnique({
      where: { userId: userMatch.id },
      include: { organization: true, assignedAgent: true },
    })
    if (linked && linked.status === 'ACTIVE' && !linked.deletedAt) {
      candidate = linked
      user = userMatch
    }
  }

  if (!candidate) {
    candidate = await loadCandidateByMobile()

    if (candidate?.userId) {
      user = await db.user.findUnique({
        where: { id: candidate.userId },
      })
    }
  }

  if (!candidate || !candidate.userId) {
    await constantTimeDummyVerify(parsed.password)
    await recordLoginFailure(rateKey)
    return unauthorized('Invalid credentials')
  }

  if (!user || !user.isActive || user.role !== 'CANDIDATE') {
    await constantTimeDummyVerify(parsed.password)
    await recordLoginFailure(rateKey)
    return unauthorized('Invalid credentials')
  }

  // Locked account: respond exactly as for invalid credentials so a locked
  // account cannot be distinguished from a wrong password / unknown mobile
  // (no account-enumeration oracle).
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await constantTimeDummyVerify(parsed.password)
    return unauthorized('Invalid credentials')
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
    await recordLoginFailure(rateKey)
    await auditRaw(
      user.organizationId,
      user.id,
      'LOGIN_FAILED',
      'Candidate',
      candidate.id,
      `Failed candidate login attempt (${nextAttempts})`,
      { ipAddress: ip, userAgent }
    )
    return unauthorized('Invalid credentials')
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })

  await clearLoginFailures(rateKey)

  const token = await createSession(
    { id: user.id, organizationId: user.organizationId },
    { ip, userAgent }
  )
  await setSessionCookie(token)

  await auditRaw(user.organizationId, user.id, 'LOGIN', 'Candidate', candidate.id, 'Candidate logged in', {
    ipAddress: ip,
    userAgent,
  })

  return success({
    id: user.id,
    name: user.name,
    email: user.email,
    role: 'CANDIDATE',
    organizationId: user.organizationId,
    organizationName: candidate.organization.name,
    phone: user.phone ?? candidate.mobile,
    candidateId: candidate.id,
  })
})
