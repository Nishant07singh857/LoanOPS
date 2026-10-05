import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiHandler, success, badRequest, validate } from '@/lib/server/api'
import { getSessionCookie, getSession, getClientIp, auditRaw } from '@/lib/server/auth'
import { COMPLIANCE_CONFIG, REQUIRED_CONSENTS } from '@/lib/compliance-config'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(async () => {
  const token = await getSessionCookie()
  const user = await getSession(token)

  if (!user) {
    return success({
      policyVersion: COMPLIANCE_CONFIG.policyVersion,
      lastUpdated: COMPLIANCE_CONFIG.lastUpdated,
      requiredConsents: REQUIRED_CONSENTS,
      consents: [],
      needsReconsent: true,
    })
  }

  const records = await db.consentRecord.findMany({
    where: {
      organizationId: user.organizationId,
      OR: [
        ...(user.id ? [{ userId: user.id }] : []),
        ...(user.candidateId ? [{ candidateId: user.candidateId }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Determine latest state per consentType
  const latestByType = new Map<string, (typeof records)[number]>()
  for (const r of records) {
    if (!latestByType.has(r.consentType)) {
      latestByType.set(r.consentType, r)
    }
  }

  const dataProcessingConsent = latestByType.get('DATA_PROCESSING')
  const needsReconsent =
    !dataProcessingConsent ||
    !dataProcessingConsent.granted ||
    dataProcessingConsent.policyVersion !== COMPLIANCE_CONFIG.policyVersion

  return success({
    policyVersion: COMPLIANCE_CONFIG.policyVersion,
    lastUpdated: COMPLIANCE_CONFIG.lastUpdated,
    requiredConsents: REQUIRED_CONSENTS,
    consents: Array.from(latestByType.values()),
    needsReconsent,
  })
})

const postConsentSchema = z.object({
  consents: z
    .array(
      z.object({
        consentType: z.string(),
        granted: z.boolean(),
      }).strict()
    )
    .min(1)
    .max(20),
  applicationId: z.string().optional().nullable(),
  candidateId: z.string().optional().nullable(),
  policyVersion: z.string().optional(),
}).strict()

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON payload')
  const input = validate(postConsentSchema, body)

  const ipAddress = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || 'unknown'
  const token = await getSessionCookie()
  const sessionUser = await getSession(token)

  let organizationId = sessionUser?.organizationId ?? null
  let userId = sessionUser?.id ?? null
  let candidateId = sessionUser?.candidateId ?? input.candidateId ?? null

  if (!organizationId && candidateId) {
    const cand = await db.candidate.findUnique({
      where: { id: candidateId },
      select: { organizationId: true, userId: true },
    })
    if (cand) {
      organizationId = cand.organizationId
      userId = userId ?? cand.userId ?? null
    }
  }

  if (!organizationId && input.applicationId) {
    const app = await db.application.findUnique({
      where: { id: input.applicationId },
      select: { organizationId: true, candidateId: true },
    })
    if (app) {
      organizationId = app.organizationId
      candidateId = candidateId ?? app.candidateId
    }
  }

  if (!organizationId) {
    const defaultOrg = await db.organization.findFirst({
      where: { isActive: true },
      select: { id: true },
    })
    if (!defaultOrg) return badRequest('Organization not initialized')
    organizationId = defaultOrg.id
  }

  const version = input.policyVersion || COMPLIANCE_CONFIG.policyVersion

  const createdRecords = await db.$transaction(
    input.consents.map((item) =>
      db.consentRecord.create({
        data: {
          organizationId: organizationId!,
          userId,
          candidateId,
          applicationId: input.applicationId ?? null,
          consentType: item.consentType,
          policyVersion: version,
          granted: item.granted,
          ipAddress,
          userAgent,
        },
      })
    )
  )

  await auditRaw(
    organizationId,
    userId,
    'CONSENT_GIVEN',
    'ConsentRecord',
    candidateId ?? userId ?? null,
    `Recorded ${createdRecords.length} DPDP consent preference(s) under policy v${version}`,
    {
      ipAddress,
      userAgent,
      policyVersion: version,
      consents: input.consents,
      applicationId: input.applicationId ?? null,
    }
  )

  return success(
    {
      recorded: createdRecords.length,
      policyVersion: version,
      consents: createdRecords,
    },
    201
  )
})
