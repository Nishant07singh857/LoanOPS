// GET /api/owner/candidates — paginated list of candidates for the owner's org
// POST /api/owner/candidates — create a new candidate
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireOwner, audit } from '@/lib/server/auth'
import {
  apiHandler, success, created, paginate, validate, validateBody,
  paginationSchema, badRequest, fail, unprocessable,
} from '@/lib/server/api'
import { encryptPII, decryptPIIForMask } from '@/lib/server/crypto'
import {
  maskAadhaar, maskPan, maskBankAccount,
  AADHAAR_REGEX, PAN_REGEX, IFSC_REGEX, BANK_ACCOUNT_REGEX,
} from '@/lib/utils'
import { canonicalizeMobile } from '@/lib/mobile'

const listSchema = paginationSchema.extend({
  search: z.string().trim().optional().default(''),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).optional(),
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
      aadhaarMasked: c.aadhaarMasked ? maskAadhaar(decryptPIIForMask(c.aadhaarMasked)) : null,
      panMasked: c.panMasked ? maskPan(decryptPIIForMask(c.panMasked)) : null,
      bankAccount: c.bankAccount ? maskBankAccount(decryptPIIForMask(c.bankAccount)) : null,
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

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  // Any spelling is accepted at the boundary and canonicalized in the
  // handler (prefixes / separators / non-ASCII digit glyphs) — only
  // the canonical 10-digit form is stored.
  mobile: z.string().trim().min(10).max(20),
  email: z.string().trim().email('Invalid email').max(200).optional().nullable(),
  dob: z.string().trim().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'Invalid dob',
  }).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  occupation: z.string().trim().max(100).optional().nullable(),
  employer: z.string().trim().max(100).optional().nullable(),
  monthlyIncome: z.number().int().nonnegative().optional().nullable(),
  bankName: z.string().trim().min(2).max(100).optional().nullable(),
  bankAccount: z.string().trim().regex(BANK_ACCOUNT_REGEX, 'Invalid bank account number').optional().nullable(),
  bankIfsc: z.string().trim().toUpperCase().regex(IFSC_REGEX, 'Invalid IFSC format').optional().nullable(),
  upiId: z.string().trim().max(100).optional().nullable(),
  // Masked values (containing X/*) are accepted as-is; a raw value must match the full format.
  aadhaarMasked: z.string().trim().refine(
    (v) => /[X*]/.test(v) || AADHAAR_REGEX.test(v),
    { message: 'Invalid Aadhaar format' }
  ).optional().nullable(),
  panMasked: z.string().trim().toUpperCase().refine(
    (v) => /[X*]/.test(v) || PAN_REGEX.test(v),
    { message: 'Invalid PAN format' }
  ).optional().nullable(),
  assignedAgentId: z.string().trim().min(1).optional().nullable(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const ctx = await requireOwner()
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const data = validateBody(createSchema, body)

  const mobile = canonicalizeMobile(data.mobile)
  if (!mobile) return unprocessable('Invalid mobile number')

  if (data.assignedAgentId) {
    const agent = await db.agentProfile.findFirst({
      where: { id: data.assignedAgentId, organizationId: ctx.user.organizationId },
    })
    if (!agent) return badRequest('Agent not found in your organization')
  }

  // One record per mobile per org. A collision is a loud 409 carrying
  // the existing record's id + name, so staff SEE the duplicate
  // instead of silently creating a lookalike (red-team round 2, R3).
  const duplicateResponse = (existing: { id: string; fullName: string }) =>
    fail(
      'CONFLICT',
      'A candidate with this mobile number already exists in your organization',
      409,
      { existingCandidateId: existing.id, existingCandidateName: existing.fullName }
    )

  const existing = await db.candidate.findFirst({
    where: { mobile, organizationId: ctx.user.organizationId },
  })
  if (existing) return duplicateResponse(existing)

  let candidate
  try {
    candidate = await db.candidate.create({
    data: {
      organizationId: ctx.user.organizationId,
      fullName: data.fullName,
      mobile,
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
      aadhaarMasked: data.aadhaarMasked ? maskAadhaar(decryptPIIForMask(data.aadhaarMasked)) : null,
      panMasked: data.panMasked ? maskPan(decryptPIIForMask(data.panMasked)) : null,
      assignedAgentId: data.assignedAgentId ?? null,
      status: 'ACTIVE',
    },
    })
  } catch (err: any) {
    // Unique (organizationId, mobile) fired — a concurrent create won
    // the race after the check above. Same 409 + existing-record
    // details as the fast path.
    if (err?.code === 'P2002') {
      const winner = await db.candidate.findFirst({
        where: { mobile, organizationId: ctx.user.organizationId },
      })
      if (winner) return duplicateResponse(winner)
    }
    throw err
  }

  await audit(ctx, 'CREATE', 'Candidate', candidate.id, `Created candidate ${candidate.fullName} (${candidate.mobile})`)

  return created({
    id: candidate.id,
    fullName: candidate.fullName,
    mobile: candidate.mobile,
  })
})
