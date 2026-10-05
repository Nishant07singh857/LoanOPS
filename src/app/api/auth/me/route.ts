// GET /api/auth/me — return current authenticated user
import { requireAuth } from '@/lib/server/auth'
import { apiHandler, success } from '@/lib/server/api'

export const GET = apiHandler(async () => {
  const ctx = await requireAuth()
  return success(ctx.user)
})
