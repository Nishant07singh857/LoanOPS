// GET /api/owner/enquiries — list website enquiries (owner view).
// Enquiries are platform-level leads (no organizationId), so the
// owner list spans all enquiries, newest first.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate, paginationSchema } from '@/lib/server/api'

const schema = paginationSchema.extend({
  status: z.enum(['NEW', 'CONTACTED', 'CLOSED']).optional(),
  search: z.string().trim().optional().default(''),
})

export const GET = apiHandler(async (req: NextRequest) => {
  await requireOwner()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, status, search } = validate(schema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    ...(status ? { status: status as any } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { businessName: { contains: search, mode: 'insensitive' as const } },
            { mobile: { contains: search } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    db.enquiry.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    db.enquiry.count({ where }),
  ])

  return success({
    items: items.map((e) => ({
      id: e.id,
      name: e.name,
      mobile: e.mobile,
      email: e.email,
      businessName: e.businessName,
      message: e.message,
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    total,
    page,
    pageSize,
  })
})
