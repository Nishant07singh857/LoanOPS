// POST /api/auth/forgot-password — Request a single-use, hashed, expiring password reset token
// Enforces anti-enumeration (identical message & constant-time path whether account exists or not)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiHandler, success, badRequest, validate } from '@/lib/server/api'
import { createPasswordResetToken, getClientIp } from '@/lib/server/auth'
import { enforceRateLimit } from '@/lib/server/rate-limit'

const schema = z
  .object({
    email: z.string().trim().email().max(255).toLowerCase(),
  })
  .strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const { email } = validate(schema, body)

  const rlResponse = enforceRateLimit(req, 'auth_forgot_password', email)
  if (rlResponse) return rlResponse

  const ip = getClientIp(req)
  const { rawToken } = await createPasswordResetToken(email, ip)

  return success({
    message:
      'If an active account matches that email address, password reset instructions have been issued.',
    // Only expose devResetToken in non-production environments for automated testing
    ...(process.env.NODE_ENV !== 'production' && rawToken ? { devResetToken: rawToken } : {}),
  })
})
