// POST /api/auth/candidate-login — candidate portal login (mobile + OTP-less for demo)
// In production: OTP-based. For now use mobile + password.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  verifyPassword, createSession, setSessionCookie,
  checkLoginRate, recordLoginFailure, clearLoginFailures, getClientIp,
  auditRaw,
} from '@/lib/server/auth'
import { apiHandler, success, badRequest, tooMany, unauthorized, validate } from '@/lib/server/api'

const schema = z.object({
  mobile: z.string().min(10).max(20),
  password: z.string().min(8).max(128),
})

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')

  const parsed = validate(schema, body)
  const ip = getClientIp(req)

  const rl = checkLoginRate(ip)
  if (!rl.ok) return tooMany(`Too many attempts. Retry after ${Math.ceil(rl.retryAfterMs! / 1000)}s`)

  // Candidate uses their linked User record. Find candidate by mobile, then user.
  const candidate = await db.candidate.findFirst({
    where: { mobile: parsed.mobile, status: 'ACTIVE' },
    include: { organization: true, assignedAgent: true },
  })

  if (!candidate || !candidate.userId) {
    recordLoginFailure(ip)
    return unauthorized('Invalid mobile or password')
  }

  const user = await db.user.findUnique({
    where: { id: candidate.userId },
  })

  if (!user || !user.isActive || user.role !== 'CANDIDATE') {
    recordLoginFailure(ip)
    return unauthorized('Invalid mobile or password')
  }

  const ok = await verifyPassword(parsed.password, user.passwordHash)
  if (!ok) {
    recordLoginFailure(ip)
    return unauthorized('Invalid mobile or password')
  }

  clearLoginFailures(ip)

  const token = await createSession(
    { id: user.id, organizationId: user.organizationId },
    { ip, userAgent: req.headers.get('user-agent') || undefined }
  )
  await setSessionCookie(token)

  await auditRaw(user.organizationId, user.id, 'LOGIN', 'Candidate', candidate.id, `Candidate ${candidate.mobile} logged in`, { ip })

  return success({
    id: user.id,
    name: user.name,
    email: user.email,
    role: 'CANDIDATE',
    organizationId: user.organizationId,
    organizationName: candidate.organization.name,
    candidateId: candidate.id,
  })
})
