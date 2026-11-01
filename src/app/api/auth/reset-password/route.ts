// POST /api/auth/reset-password — Consume single-use password reset token & rotate credentials
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiHandler, success, badRequest, validate } from '@/lib/server/api'
import { consumePasswordResetToken, clearSessionCookie, getClientIp } from '@/lib/server/auth'
import { enforceRateLimit } from '@/lib/server/rate-limit'

const schema = z
  .object({
    token: z.string().trim().min(32).max(128),
    newPassword: z.string().min(10).max(128),
  })
  .strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const rlResponse = await enforceRateLimit(req, 'auth_forgot_password')
  if (rlResponse) return rlResponse

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const { token, newPassword } = validate(schema, body)

  const ip = getClientIp(req)
  const result = await consumePasswordResetToken(token, newPassword, ip)
  if (!result.ok) {
    return badRequest(result.error || 'Invalid or expired reset token')
  }

  await clearSessionCookie()

  return success({
    message: 'Password has been reset and all active sessions have been signed out.',
  })
})
