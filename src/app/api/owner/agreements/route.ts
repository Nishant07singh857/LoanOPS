// GET /api/owner/agreements — list agreement templates
// POST /api/owner/agreements — create agreement template
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, created, badRequest, validate, conflict } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const items = await db.agreementTemplate.findMany({
    where: { organizationId: ctx.user.organizationId },
    orderBy: { effectiveDate: 'desc' },
  })
  return success({
    items: items.map((a) => ({
      id: a.id,
      name: a.name,
      version: a.version,
      body: a.body,
      effectiveDate: a.effectiveDate,
      isActive: a.isActive,
      createdAt: a.createdAt,
    })),
  })
})

const schema = z.object({
  name: z.string().trim().min(2).max(200),
  version: z.string().trim().min(1).max(50),
  body: z.string().trim().min(1).max(100000),
  effectiveDate: z.string().trim().min(1).refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'Invalid effectiveDate',
  }),
  isActive: z.boolean().optional().default(true),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validate(schema, body)

  // Check version uniqueness within org
  const existing = await db.agreementTemplate.findFirst({
    where: { organizationId: ctx.user.organizationId, version: data.version },
  })
  if (existing) return conflict('Agreement with this version already exists')

  const agreement = await db.agreementTemplate.create({
    data: {
      organizationId: ctx.user.organizationId,
      name: data.name,
      version: data.version,
      body: data.body,
      effectiveDate: new Date(data.effectiveDate),
      isActive: data.isActive,
    },
  })

  await audit(ctx, 'CREATE', 'AgreementTemplate', agreement.id, `Created agreement template ${data.name} v${data.version}`)

  return created({
    id: agreement.id,
    name: agreement.name,
    version: agreement.version,
  })
})
