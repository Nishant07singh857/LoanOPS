// Client-side typed fetch helpers for API calls
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Wrapper around fetch that handles errors and returns typed data
export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const r = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  })

  if (!r.ok) {
    const json = await r.json().catch(() => ({ error: { message: 'Request failed' } }))
    const err = new Error(json?.error?.message || `Request failed: ${r.status}`) as any
    err.status = r.status
    err.code = json?.error?.code
    err.details = json?.error?.details
    throw err
  }

  const json = await r.json()
  return json.data as T
}

export function useApi<T = any>(
  key: string | string[],
  path: string,
  options?: { enabled?: boolean }
) {
  return useQuery<T>({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: () => apiFetch<T>(path),
    enabled: options?.enabled,
  })
}

export function useApiMutation<T = any, V = any>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST') {
  const qc = useQueryClient()
  return useMutation<T, Error, V>({
    mutationFn: (vars: V) =>
      apiFetch<T>(path, {
        method,
        body: JSON.stringify(vars),
      }),
  })
}

// Helper to invalidate queries after a mutation
export function useInvalidate() {
  const qc = useQueryClient()
  return (keys: string[] | string[][]) => {
    if (Array.isArray(keys[0])) {
      // Multiple keys
      for (const k of keys as string[][]) qc.invalidateQueries({ queryKey: k })
    } else {
      qc.invalidateQueries({ queryKey: keys as string[] })
    }
  }
}

// Format money in paise for display (client formatter only — backend remains source of truth)
export function fmtPaise(paise: number | string | null | undefined): string {
  if (paise === null || paise === undefined) return '—'
  const n = typeof paise === 'string' ? parseInt(paise, 10) : paise
  if (isNaN(n)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n / 100)
}

export function fmtPaiseShort(paise: number | string | null | undefined): string {
  if (paise === null || paise === undefined) return '—'
  const n = typeof paise === 'string' ? parseInt(paise, 10) : paise
  if (isNaN(n)) return '—'
  const r = n / 100
  if (r >= 10000000) return `₹${(r / 10000000).toFixed(2)} Cr`
  if (r >= 100000) return `₹${(r / 100000).toFixed(2)} L`
  if (r >= 1000) return `₹${(r / 1000).toFixed(1)}K`
  return `₹${r.toFixed(0)}`
}

export function fmtBps(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return '—'
  return `${(bps / 100).toFixed(2)}%`
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
