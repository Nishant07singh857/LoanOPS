// WEBSITE ENQUIRY — shared validation core for the public homepage
// enquiry form (POST /api/enquiries).
//
// Kept as a pure lib module (no Next/DB imports) so the unit suite
// can pin the contract directly — the same split as src/lib/prune-logs.ts
// (pure core) vs src/lib/server/prune-logs.ts (DB runner).
//
// Two defences live here:
//  1. The Zod schema the route validates with — unknown fields are
//     rejected by apiHandler's validate() via .strict().
//  2. The honeypot: the form renders an extra `website` field that
//     humans never see or fill. A submission with it filled is a
//     bot; the route answers with the normal success response but
//     stores nothing and notifies nobody (silently discarded), so
//     the bot cannot tell it was filtered.

import { z } from 'zod'
import { canonicalizeMobile } from '@/lib/mobile'

export const ENQUIRY_HONEYPOT_FIELD = 'website'

export const enquirySubmitSchema = z
  .object({
    name: z.string().trim().min(2, 'Please enter your full name').max(200),
    // Any spelling is accepted at the boundary; parseEnquirySubmission
    // canonicalizes to the stored 10-digit form and rejects the rest.
    mobile: z.string().trim().min(10).max(20),
    // Optional: omitted, empty, or a valid email address.
    email: z
      .string()
      .trim()
      .max(200)
      .email('Please enter a valid email address')
      .optional()
      .or(z.literal('')),
    businessName: z
      .string()
      .trim()
      .min(2, 'Please enter your business or organisation name')
      .max(200),
    message: z
      .string()
      .trim()
      .min(10, 'Please tell us a little more about what you need (at least 10 characters)')
      .max(2000),
    // Honeypot — must stay in the schema (validate() rejects unknown
    // keys) but carries no user data; see the header comment.
    website: z.string().max(200).optional(),
  })
  .strict()

export type EnquirySubmitInput = z.infer<typeof enquirySubmitSchema>

export interface ParsedEnquiry {
  name: string
  /** Canonical 10-digit Indian mobile (src/lib/mobile.ts). */
  mobile: string
  email: string | null
  businessName: string
  message: string
}

export type ParseEnquiryResult =
  | { kind: 'ok'; data: ParsedEnquiry }
  | { kind: 'honeypot' }
  | { kind: 'invalid-mobile' }

/**
 * Post-schema interpretation of one enquiry submission: honeypot
 * check first (a bot's payload is discarded before any other work),
 * then mobile canonicalization, then the storage shape.
 */
export function parseEnquirySubmission(input: EnquirySubmitInput): ParseEnquiryResult {
  if (input.website && input.website.trim().length > 0) {
    return { kind: 'honeypot' }
  }

  const mobile = canonicalizeMobile(input.mobile)
  if (!mobile) {
    return { kind: 'invalid-mobile' }
  }

  const email = input.email?.trim()
  return {
    kind: 'ok',
    data: {
      name: input.name,
      mobile,
      email: email ? email : null,
      businessName: input.businessName,
      message: input.message,
    },
  }
}
