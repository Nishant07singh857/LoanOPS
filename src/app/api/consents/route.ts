import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { apiHandler, success, badRequest, unauthorized, validate } from '@/lib/server/api'
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
  // Consent records are legal evidence — writing them requires an
  // authenticated session. Unauthenticated callers must never be able to
  // forge or revoke consent on behalf of a borrower. (Public applicants
  // record their consents inside the POST /api/apply/[token] transaction.)
  const token = await getSessionCookie()
  const sessionUser = await getSession(token)
  if (!sessionUser) return unauthorized('Authentication required to record consent')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON payload')
  const input = validate(postConsentSchema, body)

  const ipAddress = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || 'unknown'

  const organizationId: string = sessionUser.organizationId
  const userId: string = sessionUser.id
  // Client-supplied candidateId is honoured only when it is the session
  // user's OWN candidate profile — never a way to write consent for others.
  const candidateId: string | null =
    sessionUser.candidateId && input.candidateId === sessionUser.candidateId
      ? sessionUser.candidateId
      : (sessionUser.candidateId ?? null)

  // Same rule for applicationId: it must belong to the session user's own
  // candidate profile, otherwise it is ignored.
  let applicationId: string | null = null
  if (input.applicationId && candidateId) {
    const app = await db.application.findFirst({
      where: { id: input.applicationId, organizationId, candidateId },
      select: { id: true },
    })
    if (app) applicationId = app.id
  }

  const version = input.policyVersion || COMPLIANCE_CONFIG.policyVersion

  const createdRecords = await db.$transaction(
    input.consents.map((item) =>
      db.consentRecord.create({
        data: {
          organizationId,
          userId,
          candidateId,
          applicationId,
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
    candidateId ?? userId,
    `Recorded ${createdRecords.length} DPDP consent preference(s) under policy v${version}`,
    {
      ipAddress,
      userAgent,
      policyVersion: version,
      consents: input.consents,
      applicationId,
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
