// Money formatting utilities - all amounts in paise (1 INR = 100 paise)
// We NEVER use Number/parseFloat/parseInt for authoritative money math on the frontend.
// These helpers are display-only formatters over backend-provided paise values.

export function formatPaiseToINR(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—'
  const safe = Math.max(0, Math.trunc(paise))
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(safe / 100)
}

export function formatPaiseToINRShort(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—'
  const safe = Math.max(0, Math.trunc(paise))
  const rupees = safe / 100
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)} L`
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`
  return `₹${rupees.toFixed(0)}`
}

export function formatPaiseToPlain(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—'
  return (paise / 100).toFixed(2)
}

export function formatBpsToPercent(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return '—'
  return `${(bps / 100).toFixed(2)}%`
}

// Safe parse for display-only use (NOT for money calculations)
export function parseDisplayPaise(input: string): number {
  // Strip non-numeric, treat input as rupees and convert to paise
  const cleaned = input.replace(/[^0-9.]/g, '')
  if (!cleaned) return 0
  const rupees = Number(cleaned)
  if (!isFinite(rupees)) return 0
  return Math.round(rupees * 100)
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}
