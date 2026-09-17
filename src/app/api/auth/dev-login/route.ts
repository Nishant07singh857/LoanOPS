// POST /api/auth/dev-login — dev convenience: auto-login using seeded demo credentials.
// Only available when NODE_ENV !== 'production'.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createSession, setSessionCookie, auditRaw } from '@/lib/server/auth'
import { apiHandler, success, badRequest, unauthorized, forbidden, validate } from '@/lib/server/api'

const schema = z.object({
  role: z.enum(['OWNER', 'AGENT', 'CANDIDATE']),
})

const DEMO_CREDENTIALS = {
  OWNER: { email: 'owner@loanops.in', mobile: null },
  AGENT: { email: 'agent@loanops.in', mobile: null },
  CANDIDATE: { email: 'candidate@loanops.in', mobile: '9820277789' },
} as const

export const POST = apiHandler(async (req: NextRequest) => {
  if (process.env.NODE_ENV === 'production') {
    return forbidden('Dev login disabled in production')
  }

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = validate(schema, body)

  const cred = DEMO_CREDENTIALS[parsed.role]
  if (!cred) return badRequest('Invalid role')

  let user
  if (parsed.role === 'CANDIDATE') {
    const candidate = await db.candidate.findFirst({
      where: { mobile: cred.mobile! },
    })
    if (!candidate || !candidate.userId) return unauthorized('Demo candidate not seeded')
    user = await db.user.findUnique({ where: { id: candidate.userId }, include: { organization: true } })
  } else {
    user = await db.user.findUnique({
      where: { email: cred.email },
      include: { organization: true },
    })
  }

  if (!user || !user.isActive) return unauthorized('Demo user not seeded')

  const token = await createSession(
    { id: user.id, organizationId: user.organizationId },
    { ip: 'dev', userAgent: req.headers.get('user-agent') || undefined }
  )
  await setSessionCookie(token)

  await auditRaw(user.organizationId, user.id, 'LOGIN', 'User', user.id, `Dev login as ${parsed.role}`)

  const candidate = user.role === 'CANDIDATE'
    ? await db.candidate.findUnique({ where: { userId: user.id } })
    : null

  return success({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    phone: user.phone,
    candidateId: candidate?.id ?? null,
  })
})
