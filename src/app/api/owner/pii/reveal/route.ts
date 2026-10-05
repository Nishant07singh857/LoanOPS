// POST /api/owner/pii/reveal — audited PII reveal endpoint (Owner only)
// Hardened for Phase 4 & 6:
// - Strict rate limit (pii_reveal: 10/min per IP+Owner)
// - Optional reason recorded in append-only AuditLog (never logs decrypted PII values)

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit, getClientIp } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validateBody } from '@/lib/server/api'
import { decryptPII } from '@/lib/server/crypto'
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
      decryptPII(c.kycDocs[0]?.aadhaarNumber) ||
      decryptPII(c.applications[0]?.kycAadhaar) ||
      decryptPII(c.aadhaarMasked) ||
      (c.aadhaarLast4 ? `XXXX-XXXX-${c.aadhaarLast4}` : null)
    pan =
      decryptPII(c.kycDocs[0]?.panNumber) ||
      decryptPII(c.applications[0]?.kycPan) ||
      decryptPII(c.panMasked) ||
      null
    bankAccount = decryptPII(c.bankAccount) || null
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
      decryptPII(app.kycAadhaar) ||
      decryptPII(app.candidate?.kycDocs[0]?.aadhaarNumber) ||
      decryptPII(app.candidate?.aadhaarMasked) ||
      null
    pan =
      decryptPII(app.kycPan) ||
      decryptPII(app.candidate?.kycDocs[0]?.panNumber) ||
      decryptPII(app.candidate?.panMasked) ||
      null
    bankAccount = decryptPII(app.candidate?.bankAccount) || null
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
      decryptPII(loan.application?.kycAadhaar) ||
      decryptPII(loan.candidate?.kycDocs[0]?.aadhaarNumber) ||
      decryptPII(loan.candidate?.aadhaarMasked) ||
      null
    pan =
      decryptPII(loan.application?.kycPan) ||
      decryptPII(loan.candidate?.kycDocs[0]?.panNumber) ||
      decryptPII(loan.candidate?.panMasked) ||
      null
    bankAccount = decryptPII(loan.candidate?.bankAccount) || null
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
