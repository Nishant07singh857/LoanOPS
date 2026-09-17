// GET /api/auth/me — return current authenticated user
import { NextRequest } from 'next/server'
import { requireAuth, audit } from '@/lib/server/auth'
import { apiHandler, success, unauthorized } from '@/lib/server/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const ctx = await requireAuth()
  return success(ctx.user)
})
