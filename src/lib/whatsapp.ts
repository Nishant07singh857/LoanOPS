// WhatsApp helper - opens wa.me links with pre-filled messages

export interface WhatsAppContext {
  candidateName?: string
  loanNumber?: string
  amount?: string
  dueDate?: string
  agentName?: string
  ownerName?: string
  orgName?: string
}

// Neutral fallback when the caller has no organisation name to pass —
// the same convention as the org/legal config (compliance-config
// defaults the company name to 'LoanOps'). An organisation's real name
// is DATA (callers pass the session's organizationName as ctx.orgName),
// never a constant baked into the message builder: the demo org's name
// used to sit here, so every tenant's drafts introduced that org.
const FALLBACK_ORG_NAME = 'LoanOps'

export function buildWhatsAppMessage(template: string, ctx: WhatsAppContext): string {
  // The display name comes from the caller's variables: orgName fills
  // the {orgName} slot and ownerName the {ownerName} slot, and each
  // stands in for the other before the neutral fallback is reached —
  // a name the caller DID provide must never be overridden by the
  // constant just because the template used the other slot.
  const orgName = ctx.orgName || ctx.ownerName || FALLBACK_ORG_NAME
  const ownerName = ctx.ownerName || ctx.orgName || FALLBACK_ORG_NAME
  const replacements: Record<string, string> = {
    '{candidateName}': ctx.candidateName || '',
    '{loanNumber}': ctx.loanNumber || '',
    '{amount}': ctx.amount || '',
    '{dueDate}': ctx.dueDate || '',
    '{agentName}': ctx.agentName || '',
    '{ownerName}': ownerName,
    '{orgName}': orgName,
  }
  let msg = template
  for (const [k, v] of Object.entries(replacements)) {
    msg = msg.replaceAll(k, v)
  }
  return msg
}

export const WHATSAPP_TEMPLATES = {
  PAYMENT_REMINDER:
    'Hello {candidateName}, a reminder from {orgName}: your installment of ₹{amount} for loan {loanNumber} is due on {dueDate}.',
  DUE_TODAY:
    'Hi {candidateName}, your payment of ₹{amount} for loan {loanNumber} is due today ({dueDate}). Please contact us if you need help. - {orgName}',
  OVERDUE:
    'Hello {candidateName}, your payment of ₹{amount} for loan {loanNumber} was due on {dueDate} and is now overdue. Please contact us to arrange payment. - {orgName}',
  PTP_REMINDER:
    'Hello {candidateName}, a reminder that your promised payment of ₹{amount} for loan {loanNumber} is due tomorrow ({dueDate}). - {orgName}',
  RECEIPT:
    'Hello {candidateName}, we have received your payment of ₹{amount} for loan {loanNumber}. - {orgName}',
  DOCUMENT_REQUEST:
    'Hello {candidateName}, we need a few more documents for your loan application with {orgName}: {amount}. Reply here if you have questions.',
  APPLICATION_REMINDER:
    'Hi {candidateName}, your loan application with {orgName} is not complete yet. Please finish it using the link we shared. - {orgName}',
  GENERAL_FOLLOW_UP:
    'Hello {candidateName}, this is {agentName} from {orgName} about your loan {loanNumber}. Please call back when you can.',
  CANDIDATE_TO_AGENT:
    'Hello, I need assistance with my loan {loanNumber} from {orgName}. Please contact me back. - {candidateName}',
  CANDIDATE_TO_OWNER:
    'Hello, I have a query regarding my loan {loanNumber} with {orgName}. - {candidateName}',
}

/** Pure wa.me draft URL for a phone + pre-filled message (server-safe). */
export function buildWhatsAppLink(phone: string, message: string): string {
  let cleaned = (phone || '').replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1)
  }
  const final = cleaned.length === 10 ? `91${cleaned}` : cleaned
  return final
    ? `https://wa.me/${final}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
}

export function openWhatsApp(phone: string, message: string) {
  // Sanitize phone - remove everything except digits
  let cleaned = (phone || '').replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1)
  }
  // Ensure country code prefix (default +91 if 10 digits)
  const final = cleaned.length === 10 ? `91${cleaned}` : cleaned
  const url = final
    ? `https://wa.me/${final}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

