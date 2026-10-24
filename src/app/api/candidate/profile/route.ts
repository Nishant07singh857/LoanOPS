// GET   /api/candidate/profile — fetch candidate profile
// PATCH /api/candidate/profile — update candidate profile with server-side KYC/bank validation
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireCandidate, audit } from '@/lib/server/auth'
import { apiHandler, success, badRequest, notFound, validate } from '@/lib/server/api'
import {
  AADHAAR_REGEX,
  PAN_REGEX,
  IFSC_REGEX,
  BANK_ACCOUNT_REGEX,
  maskAadhaar,
  maskPan,
  maskBankAccount,
} from '@/lib/utils'
import { encryptPII, decryptPIIForMask } from '@/lib/server/crypto'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  const c = await db.candidate.findFirst({
    where: { id: ctx.user.candidateId, organizationId: ctx.user.organizationId },
    include: {
      assignedAgent: { include: { user: true } },
      kycDocs: true,
      _count: { select: { loans: true, payments: true, supportTickets: true } },
    },
  })
  if (!c) return notFound('Candidate not found')

  const rawKyc = c.kycDocs[0] ?? null
  const safeKyc = rawKyc
    ? {
        id: rawKyc.id,
        aadhaarNumber: rawKyc.aadhaarNumber,
        panNumber: rawKyc.panNumber ? maskPan(decryptPIIForMask(rawKyc.panNumber)) : null,
        status: rawKyc.status,
        verifiedAt: rawKyc.verifiedAt,
      }
    : null

  return success({
    id: c.id,
    fullName: c.fullName,
    mobile: c.mobile,
    email: c.email,
    dob: c.dob,
    address: c.address,
    occupation: c.occupation,
    employer: c.employer,
    monthlyIncome: c.monthlyIncome,
    bankName: c.bankName,
    bankAccount: c.bankAccount ? maskBankAccount(decryptPIIForMask(c.bankAccount)) : null,
    bankIfsc: c.bankIfsc,
    upiId: c.upiId,
    aadhaarMasked: c.aadhaarMasked || rawKyc?.aadhaarNumber || null,
    panMasked: c.panMasked
      ? maskPan(decryptPIIForMask(c.panMasked))
      : rawKyc?.panNumber
        ? maskPan(decryptPIIForMask(rawKyc.panNumber))
        : null,
    status: c.status,
    assignedAgent: c.assignedAgent ? {
      id: c.assignedAgent.id,
      name: c.assignedAgent.user.name,
      phone: c.assignedAgent.user.phone,
    } : null,
    kyc: safeKyc,
    counts: c._count,
    createdAt: c.createdAt,
  })
})

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().max(200).optional().nullable(),
  dob: z.string().min(1).max(40).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  occupation: z.string().max(200).optional().nullable(),
  employer: z.string().max(200).optional().nullable(),
  monthlyIncome: z.number().int().nonnegative().optional().nullable(),
  existingObligations: z.number().int().nonnegative().optional().nullable(),
  bankName: z.string().max(200).optional().nullable(),
  bankAccount: z.string().regex(BANK_ACCOUNT_REGEX, 'Invalid bank account number').optional().nullable(),
  bankIfsc: z.string().regex(IFSC_REGEX, 'Invalid IFSC code').optional().nullable(),
  upiId: z.string().max(100).optional().nullable(),
  aadhaarNumber: z.string().regex(AADHAAR_REGEX, 'Invalid Aadhaar number').optional().nullable(),
  panNumber: z.string().regex(PAN_REGEX, 'Invalid PAN').optional().nullable(),
}).strict()

export const PATCH = apiHandler(async (req: NextRequest) => {
  const ctx = await requireCandidate()
  if (!ctx.user.candidateId) return badRequest('No candidate profile linked to this account')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON body')
  const input = validate(updateProfileSchema, body)

  const existing = await db.candidate.findFirst({
    where: { id: ctx.user.candidateId, organizationId: ctx.user.organizationId },
  })
  if (!existing) return notFound('Candidate not found')

  const aadhaarMasked = input.aadhaarNumber ? maskAadhaar(input.aadhaarNumber) : undefined
  const panMasked = input.panNumber ? maskPan(input.panNumber) : undefined

  const updated = await db.candidate.update({
    where: { id: existing.id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.dob !== undefined ? { dob: input.dob ? new Date(input.dob) : null } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.occupation !== undefined ? { occupation: input.occupation } : {}),
      ...(input.employer !== undefined ? { employer: input.employer } : {}),
      ...(input.monthlyIncome !== undefined ? { monthlyIncome: input.monthlyIncome } : {}),
      ...(input.existingObligations !== undefined ? { existingObligations: input.existingObligations } : {}),
      ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
      ...(input.bankAccount !== undefined ? { bankAccount: input.bankAccount ? encryptPII(input.bankAccount) : null } : {}),
      ...(input.bankIfsc !== undefined ? { bankIfsc: input.bankIfsc } : {}),
      ...(input.upiId !== undefined ? { upiId: input.upiId } : {}),
      ...(aadhaarMasked !== undefined ? { aadhaarMasked } : {}),
      ...(panMasked !== undefined ? { panMasked } : {}),
    },
  })

  if (input.aadhaarNumber || input.panNumber) {
    const existingKyc = await db.kycDocument.findFirst({ where: { candidateId: existing.id } })
    if (existingKyc) {
      await db.kycDocument.update({
        where: { id: existingKyc.id },
        data: {
          ...(input.panNumber ? { panNumber: encryptPII(input.panNumber) } : {}),
        },
      })
    } else {
      await db.kycDocument.create({
        data: {
          candidateId: existing.id,
          panNumber: input.panNumber ? encryptPII(input.panNumber) : null,
          status: 'PENDING',
        },
      })
    }
  }

  await audit(ctx, 'UPDATE', 'Candidate', updated.id, 'Candidate updated profile details')

  return success({
    id: updated.id,
    fullName: updated.fullName,
    email: updated.email,
    address: updated.address,
    occupation: updated.occupation,
    employer: updated.employer,
    monthlyIncome: updated.monthlyIncome,
    bankName: updated.bankName,
    bankAccount: updated.bankAccount ? maskBankAccount(decryptPIIForMask(updated.bankAccount)) : null,
    bankIfsc: updated.bankIfsc,
    upiId: updated.upiId,
    aadhaarMasked: updated.aadhaarMasked ? maskAadhaar(decryptPIIForMask(updated.aadhaarMasked)) : null,
    panMasked: updated.panMasked ? maskPan(decryptPIIForMask(updated.panMasked)) : null,
  })
})

export const PUT = PATCH

