// Shared cash-collection idempotency helpers for the agent pages.
//
// Previously copy-pasted into three agent pages (cash, tasks,
// candidate detail); now a single implementation. The key's random
// segment comes from the Web Crypto CSPRNG, never the non-crypto built-in PRNG:
// these keys guard real money submissions against duplicate
// collection, so they must be unguessable and collision-proof.

import { ApiRequestError } from '@/lib/api-client'

export function generateCashIdempotencyKey() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const rand = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `cash_${Date.now()}_${rand}`
}

export async function postCashCollectionWithIdempotency(payload: Record<string, any>, idempotencyKey: string) {
  const r = await fetch('/api/agent/cash-collections', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ ...payload, idempotencyKey }),
  })
  const text = await r.text()
  let json: any = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // ignore non-JSON
    }
  }
  if (!r.ok) {
    const rawErr = json?.error
    const message =
      rawErr && typeof rawErr === 'object'
        ? String(rawErr.message || r.statusText || 'Request failed')
        : typeof rawErr === 'string'
          ? rawErr
          : r.statusText || 'Request failed'
    throw new ApiRequestError(
      String(rawErr?.code || 'UNKNOWN'),
      message,
      r.status,
      rawErr?.details
    )
  }
  return json && typeof json === 'object' && 'data' in json ? json.data : json
}
