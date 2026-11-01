// Typed fetch helper used by all portal pages. Wraps fetch + JSON parsing + error normalisation.

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface ApiResponse<T> {
  data: T
  meta?: Record<string, unknown>
}

export class ApiRequestError extends Error {
  code: string
  status: number
  details?: unknown
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

export const SESSION_EXPIRED_MESSAGE = 'Session expired — please sign in again.'

// Central session-expiry handling (live-audit finding C.3): when the session
// cookie expires — or the account signs in with a different role in another
// tab — panel API calls start failing with 401 (no session) or with the
// auth guard's 403 (server serializes AuthError as code 'AUTH'; ordinary
// permission denials use code 'FORBIDDEN' and stay ordinary errors). Pages
// used to render those as "check your connection", which sent users chasing
// a network problem that did not exist. Instead: surface one clear message
// and route to /login (which explains the expiry via ?expired=1).
let sessionRedirectStarted = false

function isSessionFailure(status: number, code: string, url: string): boolean {
  if (url.includes('/api/auth/')) return false // login/me/logout handle their own 401s
  if (status === 401) return true
  return status === 403 && code === 'AUTH'
}

function handleSessionFailure(): void {
  if (typeof window === 'undefined' || sessionRedirectStarted) return
  const path = window.location.pathname
  // Only portal surfaces auto-redirect; public pages keep the plain error.
  if (!path.startsWith('/admin') && !path.startsWith('/agent') && !path.startsWith('/portal')) return
  sessionRedirectStarted = true
  try {
    sessionStorage.setItem('loanops-session-expired', '1')
  } catch {
    // storage unavailable — the ?expired=1 param still carries the message
  }
  // Full navigation on purpose: this module is not a component (no router),
  // and dropping all in-flight panel state is exactly right when the
  // session is gone or belongs to another role now.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/login?expired=1')
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: any
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }
  let r: Response
  try {
    r = await fetch(url, init)
  } catch (networkErr: any) {
    throw new ApiRequestError(
      'NETWORK_ERROR',
      networkErr?.message || 'Network request failed. Please check your connection.',
      0
    )
  }
  const text = await r.text()
  let json: any = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // not JSON
    }
  }
  if (!r.ok) {
    const rawErr = json?.error
    const err: ApiError =
      rawErr && typeof rawErr === 'object'
        ? {
            code: String(rawErr.code || 'UNKNOWN'),
            message: String(rawErr.message || r.statusText || 'Request failed'),
            details: rawErr.details,
          }
        : {
            code: 'UNKNOWN',
            message: typeof rawErr === 'string' ? rawErr : r.statusText || 'Request failed',
          }
    if (isSessionFailure(r.status, err.code, url)) {
      handleSessionFailure()
      throw new ApiRequestError('SESSION_EXPIRED', SESSION_EXPIRED_MESSAGE, r.status, err.details)
    }
    throw new ApiRequestError(err.code, err.message, r.status, err.details)
  }
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T
}


export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: any) => request<T>('POST', url, body),
  put: <T>(url: string, body?: any) => request<T>('PUT', url, body),
  patch: <T>(url: string, body?: any) => request<T>('PATCH', url, body),
  delete: <T>(url: string) => request<T>('DELETE', url),
}

