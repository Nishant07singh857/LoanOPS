import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const VALID_TOKEN_REGEX = /^[a-f0-9]{32,128}$/i

const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  )
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )
  response.headers.set('Content-Security-Policy', CSP_HEADER)
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
