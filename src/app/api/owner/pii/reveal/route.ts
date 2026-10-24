// POST /api/owner/pii/reveal — audited PII reveal endpoint (Owner only)
// Hardened for Phase 4 & 6:
// - Strict rate limit (pii_reveal: 10/min per IP+Owner)
// - Optional reason recorded in append-only AuditLog (never logs decrypted PII values)

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit, getClientIp } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validateBody } from '@/lib/server/api'
import { decryptPIIForMask } from '@/lib/server/crypto'
import { maskAadhaar } from '@/lib/utils'

// Stored PII fields legitimately hold mixed formats: enc:v1 ciphertext,
// already-masked strings (XXXX-XXXX-8765), and legacy plaintext. Strict
// decryptPII throws on non-enc values in production, which made this
// audited reveal 500 for exactly the records owners need to inspect.
// Resolve tolerantly instead. Aadhaar is ALWAYS returned masked (UIDAI:
// a full Aadhaar number is never stored anywhere in this system); PAN and
// bank account return the full value when one exists, else the stored
// masked value.
const resolveMaskedAadhaar = (v?: string | null): string => {
  const r = decryptPIIForMask(v)
  return r ? maskAadhaar(r) : ''
}
const resolveRevealValue = (v?: string | null): string => decryptPIIForMask(v)
import { enforceRateLimit } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'

const revealSchema = z
  .object({
    entityType: z.enum(['CANDIDATE', 'APPLICATION', 'LOAN']),
    entityId: z.string().min(1).max(100),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()

  const rlResponse = enforceRateLimit(req, 'pii_reveal', ctx.user.id)
  if (rlResponse) return rlResponse

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validateBody(revealSchema, body)
  const revealReason = data.reason || 'KYC & compliance verification by Owner'

  let aadhaar: string | null = null
  let pan: string | null = null
  let bankAccount: string | null = null

  if (data.entityType === 'CANDIDATE') {
    const c = await db.candidate.findFirst({
      where: { id: data.entityId, organizationId: ctx.user.organizationId },
      include: {
        kycDocs: { orderBy: { createdAt: 'desc' }, take: 1 },
        applications: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (!c) return notFound('Candidate not found')

    aadhaar =
      resolveMaskedAadhaar(c.kycDocs[0]?.aadhaarNumber) ||
      resolveMaskedAadhaar(c.applications[0]?.kycAadhaar) ||
      resolveMaskedAadhaar(c.aadhaarMasked) ||
      (c.aadhaarLast4 ? `XXXX-XXXX-${c.aadhaarLast4}` : null)
    pan =
      resolveRevealValue(c.kycDocs[0]?.panNumber) ||
      resolveRevealValue(c.applications[0]?.kycPan) ||
      resolveRevealValue(c.panMasked) ||
      null
    bankAccount = resolveRevealValue(c.bankAccount) || null
  } else if (data.entityType === 'APPLICATION') {
    const app = await db.application.findFirst({
      where: { id: data.entityId, organizationId: ctx.user.organizationId },
      include: {
        candidate: {
          include: {
            kycDocs: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    })
    if (!app) return notFound('Application not found')

    aadhaar =
      resolveMaskedAadhaar(app.kycAadhaar) ||
      resolveMaskedAadhaar(app.candidate?.kycDocs[0]?.aadhaarNumber) ||
      resolveMaskedAadhaar(app.candidate?.aadhaarMasked) ||
      null
    pan =
      resolveRevealValue(app.kycPan) ||
      resolveRevealValue(app.candidate?.kycDocs[0]?.panNumber) ||
      resolveRevealValue(app.candidate?.panMasked) ||
      null
    bankAccount = resolveRevealValue(app.candidate?.bankAccount) || null
  } else if (data.entityType === 'LOAN') {
    const loan = await db.loan.findFirst({
      where: { id: data.entityId, organizationId: ctx.user.organizationId },
      include: {
        application: true,
        candidate: {
          include: {
            kycDocs: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    })
    if (!loan) return notFound('Loan not found')

    aadhaar =
      resolveMaskedAadhaar(loan.application?.kycAadhaar) ||
      resolveMaskedAadhaar(loan.candidate?.kycDocs[0]?.aadhaarNumber) ||
      resolveMaskedAadhaar(loan.candidate?.aadhaarMasked) ||
      null
    pan =
      resolveRevealValue(loan.application?.kycPan) ||
      resolveRevealValue(loan.candidate?.kycDocs[0]?.panNumber) ||
      resolveRevealValue(loan.candidate?.panMasked) ||
      null
    bankAccount = resolveRevealValue(loan.candidate?.bankAccount) || null
  }

  const ip = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || 'unknown'
  const when = new Date().toISOString()

  await audit(
    ctx,
    'REVEAL_PII',
    data.entityType,
    data.entityId,
    `Owner revealed PII for ${data.entityType} ${data.entityId} (Reason: ${revealReason})`,
    {
      who: { id: ctx.user.id, role: ctx.user.role },
      what: { entityType: data.entityType, entityId: data.entityId, fields: ['aadhaar', 'pan', 'bankAccount'] },
      reason: revealReason,
      when,
      ip,
      ipAddress: ip,
      userAgent,
    }
  )

  return success({
    aadhaar,
    pan,
    bankAccount,
    auditedAt: when,
  })
})
