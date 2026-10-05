// GET & POST /api/auth/totp — Owner/Admin optional TOTP 2FA enrollment and verification
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiHandler, success, badRequest, validate } from '@/lib/server/api'
import {
  requireOwner,
  generateTotpSecret,
  encryptTotpSecret,
  verifyTotpCode,
  buildTotpOtpAuthUri,
  getClientIp,
  audit,
} from '@/lib/server/auth'
import { enforceRateLimit } from '@/lib/server/rate-limit'

export const GET = apiHandler(async () => {
  const ctx = await requireOwner()
  const user = await db.user.findUnique({
    where: { id: ctx.user.id },
    select: { totpEnabled: true, email: true },
  })
  return success({
    totpEnabled: Boolean(user?.totpEnabled),
  })
})

const actionSchema = z
  .object({
    action: z.enum(['SETUP', 'ENABLE', 'DISABLE']),
    totpCode: z.string().trim().optional(),
  })
  .strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const rlResponse = enforceRateLimit(req, 'auth_otp', ctx.user.id)
  if (rlResponse) return rlResponse

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const { action, totpCode } = validate(actionSchema, body)
  const ip = getClientIp(req)

  const user = await db.user.findUnique({ where: { id: ctx.user.id } })
  if (!user) return badRequest('User not found')

  if (action === 'SETUP') {
    const rawSecret = generateTotpSecret()
    const encryptedSecret = encryptTotpSecret(rawSecret)
    await db.user.update({
      where: { id: user.id },
      data: { totpSecret: encryptedSecret, totpEnabled: false },
    })
    const otpauthUri = buildTotpOtpAuthUri(user.email, rawSecret)
    return success({
      secret: rawSecret,
      otpauthUri,
      totpEnabled: false,
    })
  }

  if (action === 'ENABLE') {
    if (!user.totpSecret) {
      return badRequest('Run SETUP first to generate a TOTP secret')
    }
    if (!totpCode || !verifyTotpCode(user.totpSecret, totpCode)) {
      return badRequest('Invalid 6-digit TOTP verification code')
    }
    await db.user.update({
      where: { id: user.id },
      data: { totpEnabled: true },
    })
    await audit(ctx, 'SETTINGS_CHANGE', 'User', user.id, 'Enabled TOTP 2FA on Owner account', {
      ipAddress: ip,
    })
    return success({ totpEnabled: true })
  }

  // DISABLE
  if (user.totpEnabled && user.totpSecret) {
    if (!totpCode || !verifyTotpCode(user.totpSecret, totpCode)) {
      return badRequest('Valid current 6-digit TOTP code is required to disable 2FA')
    }
  }
  await db.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null },
  })
  await audit(ctx, 'SETTINGS_CHANGE', 'User', user.id, 'Disabled TOTP 2FA on Owner account', {
    ipAddress: ip,
  })
  return success({ totpEnabled: false })
})
