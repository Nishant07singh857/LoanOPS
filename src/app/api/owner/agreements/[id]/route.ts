// PATCH /api/owner/agreements/[id] — toggle/update an agreement template (isActive, name, body)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validate } from '@/lib/server/api'

const patchSchema = z.object({}).strict()

export const PATCH = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await requireOwner()
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(patchSchema, body)

  const existing = await db.agreementTemplate.findFirst({
    where: { id, organizationId: ctx.user.organizationId },
  })
  if (!existing) return notFound('Agreement template not found')

  const updated = await db.agreementTemplate.update({
    where: { id },
    data: {
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.name ? { name: data.name } : {}),
      ...(data.body ? { body: data.body } : {}),
    },
  })

  await audit(
    ctx,
    'UPDATE',
    'AgreementTemplate',
    updated.id,
    `Updated agreement template ${updated.name} v${updated.version} (isActive=${updated.isActive})`
  )

  return success({
    id: updated.id,
    name: updated.name,
    version: updated.version,
    isActive: updated.isActive,
  })
})
