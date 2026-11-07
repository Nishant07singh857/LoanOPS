// PATCH /api/owner/enquiries/[id] — update an enquiry's status
// (NEW → CONTACTED → CLOSED; moving back to NEW reopens it).
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import { apiHandler, success, notFound, validate } from '@/lib/server/api'

const schema = z
  .object({
    status: z.enum(['NEW', 'CONTACTED', 'CLOSED']),
  })
  .strict()

export const PATCH = apiHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireOwner()
    const { id } = await params
    const body = await req.json().catch(() => null)
    const data = validate(schema, body)

    const existing = await db.enquiry.findFirst({ where: { id } })
    if (!existing) return notFound('Enquiry not found')

    const updated = await db.enquiry.update({
      where: { id },
      data: { status: data.status },
    })

    await audit(
      ctx,
      'UPDATE',
      'Enquiry',
      updated.id,
      `Marked enquiry from ${updated.name} (${updated.businessName}) as ${updated.status}`
    )

    return success({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    })
  }
)
