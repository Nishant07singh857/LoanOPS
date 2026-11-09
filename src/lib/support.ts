// SUPPORT TICKETS — shared pure core for the ticket conversation
// thread + status walk (feature gap D3).
//
// Kept as a pure lib module (no Next/DB imports) so the unit suite
// can pin the contracts directly — the same split as
// src/lib/enquiries.ts and src/lib/prune-logs.ts.
//
// Two contracts live here:
//  1. The status transition map — the ONLY legal moves a ticket's
//     status may make. Before D3, IN_REVIEW and CLOSED existed as
//     values/filter chips but no endpoint could ever set them; this
//     map is what the staff status endpoint enforces, and the UIs
//     render exactly these next-states (no dead controls).
//  2. The Zod schemas the reply / status routes validate with
//     (unknown fields rejected by apiHandler's validate()).

import { z } from 'zod'

export const SUPPORT_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'] as const
export type SupportStatusValue = (typeof SUPPORT_STATUSES)[number]

/**
 * Legal status transitions. CLOSED is terminal (no exits). RESOLVED
 * may be reopened to IN_REVIEW when a borrower comes back on the
 * same issue. A status never transitions to itself.
 */
export const SUPPORT_TRANSITIONS: Readonly<Record<SupportStatusValue, readonly SupportStatusValue[]>> = {
  OPEN: ['IN_REVIEW', 'RESOLVED'],
  IN_REVIEW: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_REVIEW'],
  CLOSED: [],
}

export function canTransitionSupportStatus(from: SupportStatusValue, to: SupportStatusValue): boolean {
  return SUPPORT_TRANSITIONS[from].includes(to)
}

/** The statuses `from` may move to next (empty for terminal CLOSED). */
export function nextSupportStatuses(from: SupportStatusValue): readonly SupportStatusValue[] {
  return SUPPORT_TRANSITIONS[from]
}

/**
 * Borrower-friendly wording for each status, shown in the portal.
 * Staff surfaces keep using formatStatus() from the status badge;
 * the portal explains what the state means for the borrower.
 */
export const SUPPORT_STATUS_BORROWER_LABELS: Readonly<Record<SupportStatusValue, string>> = {
  OPEN: 'Open — waiting for our team',
  IN_REVIEW: 'Being reviewed by our team',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export function supportStatusBorrowerLabel(status: SupportStatusValue): string {
  return SUPPORT_STATUS_BORROWER_LABELS[status]
}

/** POST body for a thread reply (borrower, owner and agent routes). */
export const supportReplySchema = z
  .object({
    body: z.string().trim().min(1, 'Please write a reply').max(5000),
  })
  .strict()

export type SupportReplyInput = z.infer<typeof supportReplySchema>

/**
 * POST body for the staff status-walk endpoint. `resolution` is
 * meaningful when moving to RESOLVED (it is stored on the ticket,
 * exactly like the long-standing Resolve action); it is ignored for
 * other target statuses.
 */
export const supportStatusChangeSchema = z
  .object({
    status: z.enum(SUPPORT_STATUSES),
    resolution: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()

export type SupportStatusChangeInput = z.infer<typeof supportStatusChangeSchema>
