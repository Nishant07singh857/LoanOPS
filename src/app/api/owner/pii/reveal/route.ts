// POST /api/owner/pii/reveal — audited PII reveal endpoint (Owner only)
// Hardened for Phase 4 & 6:
// - Strict rate limit (pii_reveal: 10/min per IP+Owner)
// - Optional reason recorded in append-only AuditLog (never logs decrypted PII values)

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit, getClientIp } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validateBody } from '@/lib/server/api'
import { decryptPII, decryptPIIForMask } from '@/lib/server/crypto'
import { logger } from '@/lib/server/logger'
import { maskAadhaar } from '@/lib/utils'
import { enforceRateLimit } from '@/lib/server/rate-limit'

// Stored PII fields legitimately hold mixed formats: enc:v1 ciphertext,
// already-masked strings (XXXX-XXXX-8765), and legacy plaintext. Strict
// decryptPII throws on non-enc values in production, which made this
// audited reveal 500 for exactly the records owners need to inspect.
// Resolution is therefore format-aware, but it must NEVER echo raw
// ciphertext to the owner's screen (G4-2): a non-enc value is returned
// as-is (masked or legacy display value); an enc:v1 value is returned
// only when strict decryptPII succeeds. When an enc:v1 value cannot be
// decrypted (bad/rotated key or corrupt row), the failure is logged
// value-free and resolution falls through to the next source. Aadhaar is
// ALWAYS returned masked (UIDAI: a full Aadhaar number is never stored
// anywhere in this system), and an undecryptable Aadhaar ciphertext is
// treated as unavailable. PAN and bank account return the full value
// when one exists, else the stored masked value; if every source was
// undecryptable ciphertext, they return DECRYPT_FAILURE_MARKER instead
// of the ciphertext.
const ENCRYPTED_PREFIX = 'enc:v1:'
const DECRYPT_FAILURE_MARKER = '[Unable to decrypt — encryption key mismatch]'

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

  const rlResponse = await enforceRateLimit(req, 'pii_reveal', ctx.user.id)
  if (rlResponse) return rlResponse

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validateBody(revealSchema, body)
  const revealReason = data.reason || 'KYC & compliance verification by Owner'

  // --- Never-echo-ciphertext resolvers (scoped to this request so log
  // lines can carry entityType/entityId without any PII value) ---
  type PiiSource = { source: string; value?: string | null }

  const logDecryptFailure = (field: string, source: string) => {
    logger.error(
      `PII reveal: unable to decrypt ${field} from ${source} for ${data.entityType} ${data.entityId} — encryption key mismatch or corrupt value`,
      { entityType: data.entityType, entityId: data.entityId, field, source }
    )
  }

  // Strictly decrypt an enc:v1: value; null when it cannot be decrypted.
  // decryptPII throws on failure in production but returns the raw stored
  // string outside production, so a result still carrying the enc:v1:
  // prefix counts as failure too — ciphertext is never a valid result.
  const tryStrictDecrypt = (value: string): string | null => {
    try {
      const plain = decryptPII(value)
      return plain && !plain.startsWith(ENCRYPTED_PREFIX) ? plain : null
    } catch {
      return null
    }
  }

  // PAN / bank account: first usable source wins; undecryptable enc:v1:
  // sources are logged and skipped. Returns the DECRYPT_FAILURE_MARKER
  // when no source yielded a value but at least one failed to decrypt.
  const resolveRevealField = (
    field: 'pan' | 'bankAccount',
    sources: PiiSource[]
  ): string | null => {
    let sawDecryptFailure = false
    for (const { source, value } of sources) {
      if (!value) continue
      const str = String(value)
      if (!str.startsWith(ENCRYPTED_PREFIX)) return str
      const plain = tryStrictDecrypt(str)
      if (plain !== null) return plain
      sawDecryptFailure = true
      logDecryptFailure(field, source)
    }
    return sawDecryptFailure ? DECRYPT_FAILURE_MARKER : null
  }

  // Aadhaar: masked-only. An enc:v1: value that fails strict decrypt is
  // treated as unavailable (logged, fall through to the next source)
  // instead of being masked as if it were a number — masking ciphertext
  // would leak the ciphertext's trailing characters as a fake last-4.
  const resolveMaskedAadhaarField = (sources: PiiSource[]): string | null => {
    for (const { source, value } of sources) {
      if (!value) continue
      const str = String(value)
      if (str.startsWith(ENCRYPTED_PREFIX)) {
        const plain = tryStrictDecrypt(str)
        if (plain === null) {
          logDecryptFailure('aadhaar', source)
          continue
        }
        return maskAadhaar(plain)
      }
      const resolved = decryptPIIForMask(str)
      if (resolved) return maskAadhaar(resolved)
    }
    return null
  }

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
      resolveMaskedAadhaarField([
        { source: 'kycDocument.aadhaarNumber', value: c.kycDocs[0]?.aadhaarNumber },
        { source: 'application.kycAadhaar', value: c.applications[0]?.kycAadhaar },
        { source: 'candidate.aadhaarMasked', value: c.aadhaarMasked },
      ]) ?? (c.aadhaarLast4 ? `XXXX-XXXX-${c.aadhaarLast4}` : null)
    pan = resolveRevealField('pan', [
      { source: 'kycDocument.panNumber', value: c.kycDocs[0]?.panNumber },
      { source: 'application.kycPan', value: c.applications[0]?.kycPan },
      { source: 'candidate.panMasked', value: c.panMasked },
    ])
    bankAccount = resolveRevealField('bankAccount', [
      { source: 'candidate.bankAccount', value: c.bankAccount },
    ])
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

    aadhaar = resolveMaskedAadhaarField([
      { source: 'application.kycAadhaar', value: app.kycAadhaar },
      { source: 'kycDocument.aadhaarNumber', value: app.candidate?.kycDocs[0]?.aadhaarNumber },
      { source: 'candidate.aadhaarMasked', value: app.candidate?.aadhaarMasked },
    ])
    pan = resolveRevealField('pan', [
      { source: 'application.kycPan', value: app.kycPan },
      { source: 'kycDocument.panNumber', value: app.candidate?.kycDocs[0]?.panNumber },
      { source: 'candidate.panMasked', value: app.candidate?.panMasked },
    ])
    bankAccount = resolveRevealField('bankAccount', [
      { source: 'candidate.bankAccount', value: app.candidate?.bankAccount },
    ])
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

    aadhaar = resolveMaskedAadhaarField([
      { source: 'application.kycAadhaar', value: loan.application?.kycAadhaar },
      { source: 'kycDocument.aadhaarNumber', value: loan.candidate?.kycDocs[0]?.aadhaarNumber },
      { source: 'candidate.aadhaarMasked', value: loan.candidate?.aadhaarMasked },
    ])
    pan = resolveRevealField('pan', [
      { source: 'application.kycPan', value: loan.application?.kycPan },
      { source: 'kycDocument.panNumber', value: loan.candidate?.kycDocs[0]?.panNumber },
      { source: 'candidate.panMasked', value: loan.candidate?.panMasked },
    ])
    bankAccount = resolveRevealField('bankAccount', [
      { source: 'candidate.bankAccount', value: loan.candidate?.bankAccount },
    ])
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
