// GET /api/owner/qr-links — list
// POST /api/owner/qr-links — create
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAgent, audit } from '@/lib/server/auth'
import { apiHandler, success, validate, genToken, paginate, paginationSchema } from '@/lib/server/api'

const querySchema = paginationSchema

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const url = new URL(req.url)
  const params = validate(querySchema, Object.fromEntries(url.searchParams))

  const { skip, take } = paginate(params.page, params.pageSize)
  const [links, total] = await Promise.all([
    ctx.db.qrLink.findMany({
      where: { organizationId: ctx.user.organizationId },
      include: { createdBy: { select: { name: true, email: true } }, application: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    ctx.db.qrLink.count({ where: { organizationId: ctx.user.organizationId } }),
  ])

  return success({
    items: links.map(l => ({
      id: l.id,
      token: l.token,
      prePrincipal: l.prePrincipal ? String(l.prePrincipal) : null,
      preInterestType: l.preInterestType,
      preInterestRate: l.preInterestRate,
      preFixedInterest: l.preFixedInterest ? String(l.preFixedInterest) : null,
      preFrequency: l.preFrequency,
      preInstallments: l.preInstallments,
      prePurpose: l.prePurpose,
      createdById: l.createdById,
      createdByName: l.createdBy?.name,
      createdAt: l.createdAt,
      expiresAt: l.expiresAt,
      isRevoked: l.isRevoked,
      isUsed: l.isUsed,
      submittedAt: l.submittedAt,
      applicationId: l.application?.id || null,
      publicUrl: `/apply/${l.token}`,
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
  })
})

const createSchema = z.object({
  prePrincipal: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional().nullable(),
  preInterestType: z.enum(['PERCENTAGE', 'FIXED', 'NONE']).optional().nullable(),
  preInterestRate: z.number().int().min(0).optional().nullable(),
  preFixedInterest: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional().nullable(),
  preFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
  preTenureMonths: z.number().int().min(1).max(360).optional().nullable(),
  preInstallments: z.number().int().min(1).max(360).optional().nullable(),
  prePurpose: z.string().min(1).max(500).optional().nullable(),
  processingFee: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional().nullable(),
  otherFees: z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).optional().nullable(),
  preFullName: z.string().min(1).max(100).optional().nullable(),
  preMobile: z.string().min(10).max(15).optional().nullable(),
  preAadhaar: z.string().max(20).optional().nullable(),
  prePan: z.string().max(20).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAgent()
  const body = await req.json().catch(() => ({}))
  const input = validate(createSchema, body)

  const token = genToken(32)
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // default 30 days

  const link = await ctx.db.qrLink.create({
    data: {
      organizationId: ctx.user.organizationId,
      token,
      createdById: ctx.user.id,
      prePrincipal: input.prePrincipal ? Number(input.prePrincipal) : null,
      preInterestType: input.preInterestType,
      preInterestRate: input.preInterestRate,
      preFixedInterest: input.preFixedInterest ? Number(input.preFixedInterest) : null,
      preFrequency: input.preFrequency,
      preTenure: input.preTenureMonths,
      preInstallments: input.preInstallments,
      prePurpose: input.prePurpose,
      preProcessingFee: input.processingFee ? Number(input.processingFee) : null,
      preOtherFees: input.otherFees ? Number(input.otherFees) : null,
      preFullName: input.preFullName,
      preMobile: input.preMobile,
      preAadhaar: input.preAadhaar,
      prePan: input.prePan,
      expiresAt,
    },
  })

  await audit(ctx, 'CREATE', 'QrLink', link.id, `Created QR link ${token.slice(0, 8)}...`, { token: token.slice(0, 8) })

  return success({
    id: link.id,
    token: link.token,
    publicUrl: `/apply/${link.token}`,
    expiresAt: link.expiresAt,
  }, 201)
})
