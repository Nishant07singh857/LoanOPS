// POST /api/owner/qr-links/[id]/regenerate
import { NextRequest } from 'next/server'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound, genToken } from '@/lib/server/api'

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireOwner()
  const { id } = await params

  const link = await ctx.db.qrLink.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  })
  if (!link) return notFound('Link not found')

  const newToken = genToken(32)
  await ctx.db.qrLink.update({
    where: { id: link.id },
    data: {
      token: newToken,
      isRevoked: false,
      isUsed: false,
      submittedAt: null,
    },
  })

  await audit(ctx, 'UPDATE', 'QrLink', link.id, `Regenerated link (new token ${newToken.slice(0, 8)}...)`)

  return success({
    id: link.id,
    token: newToken,
    publicUrl: `/apply/${newToken}`,
  })
})
