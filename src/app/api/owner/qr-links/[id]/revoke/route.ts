// POST /api/owner/qr-links/[id]/revoke
import { NextRequest } from 'next/server'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound } from '@/lib/server/api'

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params

  const link = await ctx.db.qrLink.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  })
  if (!link) return notFound('Link not found')

  await ctx.db.qrLink.update({
    where: { id: link.id },
    data: { isRevoked: true },
  })

  await audit(ctx, 'REVOKE', 'QrLink', link.id, `Revoked link ${link.token.slice(0, 8)}...`)
  return success({ ok: true })
})
