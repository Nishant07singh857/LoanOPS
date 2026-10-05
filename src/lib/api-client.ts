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

