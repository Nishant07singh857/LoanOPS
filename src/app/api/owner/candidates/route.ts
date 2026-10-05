// GET /api/owner/candidates — paginated list of candidates for the owner's org
// POST /api/owner/candidates — create a new candidate
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import {
  apiHandler, success, created, paginate, validate, validateBody,
  paginationSchema, badRequest,
} from '@/lib/server/api'
import { encryptPII, decryptPII } from '@/lib/server/crypto'
import { maskAadhaar, maskPan, maskBankAccount } from '@/lib/utils'

const listSchema = paginationSchema.extend({
  search: z.string().trim().optional().default(''),
  status: z.string().optional(),
  assignedAgentId: z.string().optional(),
})

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const { page, pageSize, search, status, assignedAgentId } = validate(listSchema, params)
  const { skip, take } = paginate(page, pageSize)

  const where = {
    organizationId: ctx.user.organizationId,
    ...(search ? {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { mobile: { contains: search } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(status ? { status: status as any } : {}),
    ...(assignedAgentId ? { assignedAgentId } : {}),
  }

  const [items, total] = await Promise.all([
    db.candidate.findMany({
      where,
      skip, take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        mobile: true,
        email: true,
        dob: true,
        occupation: true,
        employer: true,
        monthlyIncome: true,
        aadhaarMasked: true,
        panMasked: true,
        bankAccount: true,
        status: true,
        createdAt: true,
        assignedAgent: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
        _count: { select: { loans: true, applications: true } },
      },
    }),
    db.candidate.count({ where }),
  ])

  return success({
    items: items.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      mobile: c.mobile,
      email: c.email,
      dob: c.dob,
      occupation: c.occupation,
      employer: c.employer,
      monthlyIncome: c.monthlyIncome,
      aadhaarMasked: c.aadhaarMasked ? maskAadhaar(decryptPII(c.aadhaarMasked)) : null,
      panMasked: c.panMasked ? maskPan(decryptPII(c.panMasked)) : null,
      bankAccount: c.bankAccount ? maskBankAccount(decryptPII(c.bankAccount)) : null,
      assignedAgent: c.assignedAgent ? {
        id: c.assignedAgent.id,
        name: c.assignedAgent.user.name,
      } : null,
      status: c.status,
      loansCount: c._count.loans,
      applicationsCount: c._count.applications,
      createdAt: c.createdAt,
    })),
    total,
    page,
    pageSize,
  })
})

const createSchema = z.object({}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validateBody(createSchema, body)

  if (data.assignedAgentId) {
    const agent = await db.agentProfile.findFirst({
      where: { id: data.assignedAgentId, organizationId: ctx.user.organizationId },
    })
    if (!agent) return badRequest('Agent not found in your organization')
  }

  // Best-effort: if mobile already exists in this org, return the existing record
  const existing = await db.candidate.findFirst({
    where: { mobile: data.mobile, organizationId: ctx.user.organizationId },
  })
  if (existing) {
    return success({
      id: existing.id,
      fullName: existing.fullName,
      mobile: existing.mobile,
      message: 'Candidate with this mobile already exists',
    })
  }

  const candidate = await db.candidate.create({
    data: {
      organizationId: ctx.user.organizationId,
      fullName: data.fullName,
      mobile: data.mobile,
      email: data.email ?? null,
      dob: data.dob ? new Date(data.dob) : null,
      address: data.address ?? null,
      occupation: data.occupation ?? null,
      employer: data.employer ?? null,
      monthlyIncome: data.monthlyIncome ?? null,
      bankName: data.bankName ?? null,
      bankAccount: data.bankAccount ? encryptPII(data.bankAccount) : null,
      bankIfsc: data.bankIfsc ?? null,
      upiId: data.upiId ?? null,
      aadhaarMasked: data.aadhaarMasked ? maskAadhaar(decryptPII(data.aadhaarMasked)) : null,
      panMasked: data.panMasked ? maskPan(decryptPII(data.panMasked)) : null,
      assignedAgentId: data.assignedAgentId ?? null,
      status: 'ACTIVE',
    },
  })

  await audit(ctx, 'CREATE', 'Candidate', candidate.id, `Created candidate ${candidate.fullName} (${candidate.mobile})`)

  return created({
    id: candidate.id,
    fullName: candidate.fullName,
    mobile: candidate.mobile,
  })
})
