// GET /api/owner/audit — list audit logs (paginated)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate, paginationSchema } from '@/lib/server/api'

const schema = paginationSchema.extend({
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'SUBMIT', 'VERIFY', 'ALLOCATE', 'DISBURSE', 'REFUND', 'RESTRUCTURE', 'CORRECT', 'REVOKE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_RESET', 'REVEAL_PII', 'ROLE_CHANGE', 'SETTINGS_CHANGE', 'CONSENT_GIVEN', 'DATA_REQUEST', 'FILE_UPLOAD', 'FILE_ACCESS', 'PTP_CREATE', 'PTP_UPDATE', 'ESCALATE', 'AGREE']).optional(),
  entityType: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, action, entityType } = validate(schema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    organizationId: ctx.user.organizationId,
    ...(action ? { action: action as any } : {}),
    ...(entityType ? { entityType } : {}),
  }

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ])

  return success({
    items: items.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      description: l.description,
      metadata: l.metadata,
      ipAddress: l.ipAddress,
      user: l.user ? { name: l.user.name, email: l.user.email } : null,
      createdAt: l.createdAt,
    })),
    total, page, pageSize,
  })
})
