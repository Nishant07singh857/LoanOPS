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

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body?: any
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }
  const r = await fetch(url, init)
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
    const err = (json?.error as ApiError) || { code: 'UNKNOWN', message: r.statusText }
    throw new ApiRequestError(err.code, err.message, r.status, err.details)
  }
  return (json?.data ?? json) as T
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: any) => request<T>('POST', url, body),
  patch: <T>(url: string, body?: any) => request<T>('PATCH', url, body),
  delete: <T>(url: string) => request<T>('DELETE', url),
}
