// GET & POST /api/auth/totp — Owner/Admin optional TOTP 2FA enrollment and verification
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiHandler, success, badRequest, validate } from '@/lib/server/api'
import {
  requireOwner,
  generateTotpSecret,
  encryptTotpSecret,
  matchTotpStep,
  isTotpStepReplay,
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
  const rlResponse = await enforceRateLimit(req, 'auth_otp', ctx.user.id)
  if (rlResponse) return rlResponse

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const { action, totpCode } = validate(actionSchema, body)
  const ip = getClientIp(req)

  const user = await db.user.findUnique({ where: { id: ctx.user.id } })
  if (!user) return badRequest('User not found')

  if (action === 'SETUP') {
    // Re-running SETUP on an ENROLLED account REPLACES the secret
    // and turns 2FA off until re-enabled — so it must prove
    // possession of the CURRENT authenticator first (red-team
    // round 2, N1: this previously flipped totpEnabled off
    // silently, with no code asked). A pending, never-enabled
    // secret may still be replaced freely — 2FA is off either way.
    if (user.totpEnabled && user.totpSecret) {
      const step = totpCode ? matchTotpStep(user.totpSecret, totpCode) : null
      if (step === null || isTotpStepReplay(step, user.totpLastStep)) {
        return badRequest(
          'A valid current 6-digit TOTP code from the existing authenticator is required to replace the 2FA setup'
        )
      }
    }
    const rawSecret = generateTotpSecret()
    const encryptedSecret = encryptTotpSecret(rawSecret)
    await db.user.update({
      where: { id: user.id },
      // New secret → the accepted-step counter starts over.
      data: { totpSecret: encryptedSecret, totpEnabled: false, totpLastStep: 0 },
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
    const step = totpCode ? matchTotpStep(user.totpSecret, totpCode) : null
    if (step === null || isTotpStepReplay(step, user.totpLastStep)) {
      return badRequest('Invalid 6-digit TOTP verification code')
    }
    await db.user.update({
      where: { id: user.id },
      // Consume the step: the enabling code cannot be replayed at login.
      data: { totpEnabled: true, totpLastStep: step },
    })
    await audit(ctx, 'SETTINGS_CHANGE', 'User', user.id, 'Enabled TOTP 2FA on Owner account', {
      ipAddress: ip,
    })
    return success({ totpEnabled: true })
  }

  // DISABLE
  if (user.totpEnabled && user.totpSecret) {
    const step = totpCode ? matchTotpStep(user.totpSecret, totpCode) : null
    if (step === null || isTotpStepReplay(step, user.totpLastStep)) {
      return badRequest('Valid current 6-digit TOTP code is required to disable 2FA')
    }
  }
  await db.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, totpLastStep: 0 },
  })
  await audit(ctx, 'SETTINGS_CHANGE', 'User', user.id, 'Disabled TOTP 2FA on Owner account', {
    ipAddress: ip,
  })
  return success({ totpEnabled: false })
})
