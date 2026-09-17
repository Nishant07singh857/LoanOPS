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

const ORG = 'Sterling Lending'

export function buildWhatsAppMessage(template: string, ctx: WhatsAppContext): string {
  const replacements: Record<string, string> = {
    '{candidateName}': ctx.candidateName || '',
    '{loanNumber}': ctx.loanNumber || '',
    '{amount}': ctx.amount || '',
    '{dueDate}': ctx.dueDate || '',
    '{agentName}': ctx.agentName || '',
    '{ownerName}': ctx.ownerName || 'Sterling Lending',
    '{orgName}': ctx.orgName || ORG,
  }
  let msg = template
  for (const [k, v] of Object.entries(replacements)) {
    msg = msg.replaceAll(k, v)
  }
  return msg
}

export const WHATSAPP_TEMPLATES = {
  PAYMENT_REMINDER:
    'Hello {candidateName}, this is a friendly reminder from {orgName}. Your loan {loanNumber} installment of ₹{amount} is due on {dueDate}. Please pay on time to maintain good standing. Thank you.',
  DUE_TODAY:
    'Hi {candidateName}, your loan {loanNumber} payment of ₹{amount} is due TODAY ({dueDate}). Please complete payment via UPI or contact us. - {orgName}',
  OVERDUE:
    'Dear {candidateName}, your loan {loanNumber} payment of ₹{amount} is OVERDUE (was due {dueDate}). Please pay immediately to avoid late charges. Contact us for assistance. - {orgName}',
  PTP_REMINDER:
    'Hello {candidateName}, as promised, your payment of ₹{amount} for loan {loanNumber} is due tomorrow ({dueDate}). Kindly ensure payment. - {orgName}',
  DOCUMENT_REQUEST:
    'Hello {candidateName}, we need additional documents for your loan application with {orgName}. Please upload: {amount}. Reply here if you have questions.',
  APPLICATION_REMINDER:
    'Hi {candidateName}, your loan application with {orgName} is pending. Please complete the application using the link we shared. - {orgName}',
  GENERAL_FOLLOW_UP:
    'Hello {candidateName}, this is {agentName} from {orgName} regarding your loan {loanNumber}. Please give us a call back at your convenience.',
  CANDIDATE_TO_AGENT:
    'Hello, I need assistance with my loan {loanNumber} from {orgName}. Please contact me back. - {candidateName}',
  CANDIDATE_TO_OWNER:
    'Hello, I have a query regarding my loan {loanNumber} with {orgName}. - {candidateName}',
}

export function openWhatsApp(phone: string, message: string) {
  // Sanitize phone - remove everything except digits
  const cleaned = (phone || '').replace(/\D/g, '')
  // Ensure country code prefix (default +91 if 10 digits)
  const final = cleaned.length === 10 ? `91${cleaned}` : cleaned
  const url = `https://wa.me/${final}?text=${encodeURIComponent(message)}`
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
