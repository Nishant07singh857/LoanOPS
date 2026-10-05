// GET /api/files/[fileKey] — Authorized Private File Endpoint (Phase 6)
// Serves files stored outside public/ in `.storage/uploads` only after
// verifying a short-lived HMAC signature OR authenticated RBAC + ownership.

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/server/auth'
import { resolvePrivateStoragePath, verifyPrivateFileSignature } from '@/lib/server/security'
import { enforceRateLimit } from '@/lib/server/rate-limit'

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ fileKey: string }> }
) {
  const { fileKey } = await context.params

  // Rate limit file access to prevent KYC document scraping
  const rlResponse = enforceRateLimit(req, 'file_access')
  if (rlResponse) return rlResponse

  const safePath = resolvePrivateStoragePath(fileKey)
  if (!safePath) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid file identifier' } },
      { status: 400 }
    )
  }

  const url = new URL(req.url)
  const exp = url.searchParams.get('exp')
  const sig = url.searchParams.get('sig')
  const hasValidSignature = exp && sig ? verifyPrivateFileSignature(fileKey, exp, sig) : false

  // Always require an authenticated session, and verify ownership unless Owner
  let ctx
  try {
    ctx = await requireAuth()
  } catch {
    if (!hasValidSignature) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required to access private files' } },
        { status: 401 }
      )
    }
    ctx = null
  }

  const fileUrlRef = `/api/files/${fileKey}`

  if (ctx && ctx.user.role !== 'OWNER') {
    // Check ownership in Payment, Document, or SupportTicket
    const [payment, doc, ticket] = await Promise.all([
      db.payment.findFirst({
        where: { proofUrl: fileUrlRef, organizationId: ctx.user.organizationId },
        include: { candidate: { select: { assignedAgentId: true } } },
      }),
      db.document.findFirst({
        where: { fileUrl: fileUrlRef, organizationId: ctx.user.organizationId },
        include: { candidate: { select: { assignedAgentId: true } } },
      }),
      db.supportTicket.findFirst({
        where: { attachmentUrl: fileUrlRef, organizationId: ctx.user.organizationId },
      }),
    ])

    if (ctx.user.role === 'CANDIDATE') {
      const candId = ctx.user.candidateId
      const ownsFile =
        (payment && payment.candidateId === candId) ||
        (doc && doc.candidateId === candId) ||
        (ticket && ticket.candidateId === candId)
      if (!ownsFile) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'You do not have permission to view this file' } },
          { status: 403 }
        )
      }
    } else if (ctx.user.role === 'AGENT') {
      const agentProfile = await db.agentProfile.findUnique({ where: { userId: ctx.user.id } })
      const isAuthorizedAgent =
        (payment &&
          (payment.recordedById === ctx.user.id ||
            (agentProfile && payment.candidate.assignedAgentId === agentProfile.id))) ||
        (doc && agentProfile && doc.candidate?.assignedAgentId === agentProfile.id)
      if (!isAuthorizedAgent) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'You are not assigned to the record associated with this file' } },
          { status: 403 }
        )
      }
    }
  }

  try {
    const fileBuf = await fs.readFile(safePath)
    const ext = fileKey.split('.').pop()?.toLowerCase() ?? 'jpg'
    const contentType = MIME_BY_EXT[ext] ?? 'application/octet-stream'

    return new NextResponse(new Uint8Array(fileBuf), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileBuf.length),
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="${fileKey}"`,
        'Cache-Control': 'private, max-age=300, must-revalidate',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'File not found' } },
      { status: 404 }
    )
  }
}
