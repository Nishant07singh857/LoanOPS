// POST /api/enquiries — PUBLIC. Homepage enquiry form submission.
// Stores a platform-level Enquiry lead and notifies every owner user
// (mirroring how a public application submission notifies owners in
// /api/apply/[token]). Enquiries are read back in /admin/enquiries.
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler, success, badRequest, unprocessable, validate } from '@/lib/server/api'
import { enquirySubmitSchema, parseEnquirySubmission } from '@/lib/enquiries'

export const dynamic = 'force-dynamic'

export const POST = apiHandler(async (req: NextRequest) => {
  const { enforceRateLimit } = await import('@/lib/server/rate-limit')
  const rlResponse = await enforceRateLimit(req, 'enquiry_submit')
  if (rlResponse) return rlResponse

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const input = validate(enquirySubmitSchema, body)

  const parsed = parseEnquirySubmission(input)
  if (parsed.kind === 'honeypot') {
    // Bot trap tripped: answer exactly like a real success so the
    // submitter cannot tell it was filtered — but store nothing and
    // notify nobody.
    return success({ received: true }, 201)
  }
  if (parsed.kind === 'invalid-mobile') {
    return unprocessable('Please enter a valid 10-digit mobile number')
  }

  const enquiry = await db.$transaction(async (tx) => {
    const created = await tx.enquiry.create({ data: parsed.data })

    // Notify owner user(s) — enquiries are platform-level (about
    // LoanOPS itself), so every OWNER account gets the in-app
    // notification, each under its own organization like the
    // application-submitted notifications.
    const owners = await tx.user.findMany({ where: { role: 'OWNER' } })
    for (const o of owners) {
      await tx.notification.create({
        data: {
          organizationId: o.organizationId,
          userId: o.id,
          type: 'ENQUIRY',
          title: 'New website enquiry',
          message: `${parsed.data.name} from ${parsed.data.businessName} enquired via the homepage.`,
          metadata: { enquiryId: created.id },
        },
      })
    }

    return created
  })

  return success({ id: enquiry.id, received: true }, 201)
})
