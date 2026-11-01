import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SECURITY_HEADERS } from './lib/security-headers'

const VALID_TOKEN_REGEX = /^[a-f0-9]{32,128}$/i

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const { key, value } of SECURITY_HEADERS) {
    response.headers.set(key, value)
  }
  return response
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('loanops_session')?.value

  const isOwnerRoute = pathname.startsWith('/admin')
  const isAgentRoute = pathname.startsWith('/agent')
  const isCandidateRoute = pathname.startsWith('/portal')

  const hasValidToken = Boolean(sessionToken && VALID_TOKEN_REGEX.test(sessionToken))

  if ((isOwnerRoute || isAgentRoute || isCandidateRoute) && !hasValidToken) {
    const loginUrl = new URL('/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    if (sessionToken) {
      response.cookies.delete('loanops_session')
    }
    return applySecurityHeaders(response)
  }

  return applySecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
