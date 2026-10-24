// POST /api/owner/candidates/[id]/claim-code — issue a one-time claim code
// for a pre-created candidate. The borrower needs this code (in addition to
// their mobile) to register when the candidate already has a sensitive
// footprint (applications / loans / KYC / payments), which prevents account
// takeover via public signup. Only the hash is stored; the plaintext code is
// returned exactly once so the owner can share it with the borrower.
import { NextRequest } from 'next/server'
import { randomInt } from 'crypto'
import { requireOwner, audit, getClientIp } from '@/lib/server/auth'
import { apiHandler, success, notFound, badRequest } from '@/lib/server/api'
import { hashPII } from '@/lib/server/crypto'

const CLAIM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I ambiguity
const CLAIM_CODE_LENGTH = 8
const CLAIM_CODE_TTL_MS = 72 * 60 * 60 * 1000 // 72 hours

function generateClaimCode(): string {
  let code = ''
  for (let i = 0; i < CLAIM_CODE_LENGTH; i++) {
    code += CLAIM_CODE_ALPHABET[randomInt(CLAIM_CODE_ALPHABET.length)]
  }
  return code
}

export const POST = apiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireOwner()
    const { id } = await params

    const candidate = await ctx.db.candidate.findFirst({
      where: { id, organizationId: ctx.user.organizationId },
      select: { id: true, userId: true, fullName: true },
    })
    if (!candidate) return notFound('Candidate not found')
    if (candidate.userId) {
      return badRequest('Candidate has already claimed their account')
    }

    const claimCode = generateClaimCode()
    const expiresAt = new Date(Date.now() + CLAIM_CODE_TTL_MS)

    await ctx.db.candidate.update({
      where: { id: candidate.id },
      data: {
        claimCodeHash: hashPII(claimCode),
        claimCodeExpiresAt: expiresAt,
      },
    })

    await audit(
      ctx,
      'CREATE',
      'Candidate',
      candidate.id,
      `Issued account claim code for candidate ${candidate.fullName} (expires ${expiresAt.toISOString()})`,
      { ipAddress: getClientIp(req), claimCodeExpiresAt: expiresAt.toISOString() }
    )

    // Plaintext is returned ONCE — it is never stored or logged.
    return success({ claimCode, expiresAt }, 201)
  }
)
