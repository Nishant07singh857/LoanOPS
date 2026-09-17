// GET /api/owner/applications — list
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireOwner } from '@/lib/server/auth'
import { apiHandler, success, validate, paginate } from '@/lib/server/api'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = validate(querySchema, Object.fromEntries(url.searchParams))

  const where: any = { organizationId: ctx.user.organizationId }
  if (params.status) where.status = params.status
  if (params.search) {
    where.OR = [
      { applicationNumber: { contains: params.search, mode: 'insensitive' } },
      { candidate: { fullName: { contains: params.search, mode: 'insensitive' } } },
      { candidate: { mobile: { contains: params.search } } },
    ]
  }

  const { skip, take } = paginate(params.page, params.pageSize)
  const [apps, total] = await Promise.all([
    ctx.db.application.findMany({
      where,
      include: {
        candidate: { select: { id: true, fullName: true, mobile: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    ctx.db.application.count({ where }),
  ])

  return success({
    items: apps.map(a => ({
      id: a.id,
      applicationNumber: a.applicationNumber,
      candidateId: a.candidateId,
      candidateName: a.candidate.fullName,
      candidateMobile: a.candidate.mobile,
      candidateEmail: a.candidate.email,
      principalAmount: String(a.principalAmount),
      purpose: a.purpose,
      frequency: a.frequency,
      installments: a.installments,
      interestType: a.interestType,
      interestRate: a.interestRate,
      fixedInterest: a.fixedInterest ? String(a.fixedInterest) : null,
      status: a.status,
      kycStatus: a.kycStatus,
      submittedAt: a.submittedAt,
      createdAt: a.createdAt,
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
  })
})

// POST /api/owner/applications — create application
import { genNumber, genToken } from '@/lib/server/api'

const createSchema = z.object({
  candidateId: z.string().min(1),
  principalAmount: z.string().regex(/^\d+$/),
  currency: z.string().default('INR'),
  purpose: z.string().min(3).max(500),
  interestType: z.enum(['PERCENTAGE', 'FIXED', 'NONE']),
  interestRate: z.number().int().min(0).optional(),
  fixedInterest: z.string().regex(/^\d+$/).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  tenureCount: z.number().int().min(1),
  installments: z.number().int().min(1).max(360),
  firstDueDate: z.string().datetime(),
  processingFee: z.string().regex(/^\d+$/).optional(),
  otherFees: z.string().regex(/^\d+$/).optional(),
})

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const input = validate(createSchema, body)

  // Verify candidate belongs to org
  const candidate = await ctx.db.candidate.findFirst({
    where: { id: input.candidateId, organizationId: ctx.user.organizationId },
  })
  if (!candidate) return notFound('Candidate not found')

  // Compute schedule preview using backend financial engine
  const { generateSchedule } = await import('@/lib/server/financial')
  const schedule = generateSchedule({
    principalPaise: BigInt(input.principalAmount),
    interestType: input.interestType,
    interestRateBps: BigInt(input.interestRate || 0),
    fixedInterestPaise: BigInt(input.fixedInterest || 0),
    frequency: input.frequency,
    installments: input.installments,
    firstDueDate: new Date(input.firstDueDate),
    processingFeePaise: BigInt(input.processingFee || 0),
    otherFeesPaise: BigInt(input.otherFees || 0),
  })

  const app = await ctx.db.application.create({
    data: {
      organizationId: ctx.user.organizationId,
      candidateId: candidate.id,
      applicationNumber: genNumber('APP'),
      principalAmount: Number(input.principalAmount),
      currency: input.currency,
      purpose: input.purpose,
      interestType: input.interestType,
      interestRate: input.interestRate || null,
      fixedInterest: input.fixedInterest ? Number(input.fixedInterest) : null,
      frequency: input.frequency,
      tenureCount: input.tenureCount,
      installments: input.installments,
      firstDueDate: new Date(input.firstDueDate),
      processingFee: input.processingFee ? Number(input.processingFee) : null,
      otherFees: input.otherFees ? Number(input.otherFees) : null,
      totalRepayable: Number(schedule.totalRepayable),
      installmentAmount: Number(schedule.installmentAmount),
      finalDueDate: schedule.finalDueDate,
      status: 'SUBMITTED', // owner-created apps go straight to submitted
      submittedAt: new Date(),
    },
  })

  await audit(ctx, 'CREATE', 'Application', app.id, `Created application ${app.applicationNumber}`)

  return success({
    id: app.id,
    applicationNumber: app.applicationNumber,
    totalRepayable: String(schedule.totalRepayable),
    installmentAmount: String(schedule.installmentAmount),
    finalDueDate: schedule.finalDueDate,
  }, 201)
})

import { badRequest, notFound } from '@/lib/server/api'
