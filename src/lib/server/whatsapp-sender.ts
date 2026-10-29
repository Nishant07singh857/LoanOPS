// WhatsApp Cloud API sender (Meta Graph API).
//
// The reminder engine uses this ONLY when both env vars are set:
//   WHATSAPP_API_TOKEN         — permanent access token for the app
//   WHATSAPP_PHONE_NUMBER_ID   — the sender phone number id (not the number)
// When they are absent the engine falls back to staff tasks carrying a
// wa.me draft link (see src/lib/server/reminders.ts) — it never pretends
// a message was sent. The HTTP call is isolated here so tests can stub
// global fetch and exercise every branch without network access.

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

export function isWhatsAppApiConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

export interface WhatsAppSendResult {
  ok: boolean
  providerMessageId?: string
  error?: string
}

/** E.164-ish digits for the Graph API: canonical 10-digit mobiles get +91. */
export function toWhatsAppNumber(mobile: string): string {
  const digits = (mobile || '').replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits
}

export async function sendWhatsAppText(
  toMobile: string,
  text: string
): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_API_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp Cloud API is not configured' }
  }

  const to = toWhatsAppNumber(toMobile)
  if (!to) return { ok: false, error: 'Recipient has no usable mobile number' }

  try {
    const res = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      }),
    })

    const payload: any = await res.json().catch(() => null)
    if (!res.ok) {
      const detail =
        payload?.error?.message || `WhatsApp API responded ${res.status}`
      return { ok: false, error: String(detail).slice(0, 500) }
    }
    return { ok: true, providerMessageId: payload?.messages?.[0]?.id }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 500) : 'WhatsApp send failed',
    }
  }
}
