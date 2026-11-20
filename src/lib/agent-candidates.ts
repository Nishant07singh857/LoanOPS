// AGENT CANDIDATE LIST — pool scoping core for GET /api/agent/candidates.
//
// Kept as a pure lib module (no Next/DB imports) so the unit suite can
// pin the contract directly — the same split as src/lib/enquiries.ts
// (pure core) vs the route that consumes it.
//
// Pool semantics — the product rule the candidate DETAIL route has
// enforced since it landed (see src/app/api/agent/candidates/[id]):
// within the agent's own organisation, an agent's candidate list shows
//   - candidates assigned to the requesting agent, and
//   - UNASSIGNED candidates (assignedAgentId = null) — the pool: work
//     any agent in the org may discover, open and take up (e.g. QR
//     self-apply borrowers land in the pool).
// Candidates assigned to a DIFFERENT agent never appear (the detail
// route 403s them too, CollectionTask holders aside), and nothing
// outside the agent's organisation ever appears.
//
// The list route previously filtered `assignedAgentId = <own profile>`
// only, so pool candidates were invisible in the list even though the
// detail route and collection tasks treated them as pool work (Nov 19
// full-check finding M2). This builder is the single source of the
// scoping rule so the two routes cannot drift apart again.

import type { Prisma } from '@prisma/client'

export function agentCandidateListWhere(args: {
  organizationId: string
  agentProfileId: string
  search?: string
}): Prisma.CandidateWhereInput {
  const { organizationId, agentProfileId, search } = args
  return {
    organizationId,
    AND: [
      // Assignment scope: mine + the unassigned pool.
      {
        OR: [{ assignedAgentId: agentProfileId }, { assignedAgentId: null }],
      },
      // Optional search, ANDed with the scope (never widening it).
      ...(search
        ? [
            {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' as const } },
                { mobile: { contains: search } },
              ],
            },
          ]
        : []),
    ],
  }
}
