'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        // Status colors
        ACTIVE: 'bg-success/15 text-success border border-success/20',
        PASSIVE: 'bg-muted text-muted-foreground border border-border',
        PENDING: 'bg-warning/15 text-warning border border-warning/20',
        PENDING_DISBURSEMENT: 'bg-info/15 text-info border border-info/20',
        PENDING_VERIFICATION: 'bg-warning/15 text-warning border border-warning/20',
        RECORDED: 'bg-muted text-muted-foreground border border-border',
        DRAFT: 'bg-muted text-muted-foreground border border-border',
        SUBMITTED: 'bg-info/15 text-info border border-info/20',
        UNDER_REVIEW: 'bg-warning/15 text-warning border border-warning/20',
        APPROVED: 'bg-success/15 text-success border border-success/20',
        REJECTED: 'bg-destructive/15 text-destructive border border-destructive/20',
        INFORMATION_REQUESTED: 'bg-warning/15 text-warning border border-warning/20',
        INITIATED: 'bg-info/15 text-info border border-info/20',
        VERIFIED: 'bg-success/15 text-success border border-success/20',
        ALLOCATED: 'bg-success/15 text-success border border-success/20',
        FAILED: 'bg-destructive/15 text-destructive border border-destructive/20',
        CLOSED: 'bg-muted text-muted-foreground border border-border',
        COMPLETED: 'bg-success/15 text-success border border-success/20',
        DEFAULTED: 'bg-destructive/15 text-destructive border border-destructive/20',
        WRITTEN_OFF: 'bg-destructive/15 text-destructive border border-destructive/20',
        UPCOMING: 'bg-muted text-muted-foreground border border-border',
        DUE: 'bg-info/15 text-info border border-info/20',
        PARTIALLY_PAID: 'bg-warning/15 text-warning border border-warning/20',
        PAID: 'bg-success/15 text-success border border-success/20',
        OVERDUE: 'bg-destructive/15 text-destructive border border-destructive/20',
        FULFILLED: 'bg-success/15 text-success border border-success/20',
        BROKEN: 'bg-destructive/15 text-destructive border border-destructive/20',
        CANCELLED: 'bg-muted text-muted-foreground border border-border',
        OPEN: 'bg-info/15 text-info border border-info/20',
        IN_REVIEW: 'bg-warning/15 text-warning border border-warning/20',
        RESOLVED: 'bg-success/15 text-success border border-success/20',
        ASSIGNED: 'bg-info/15 text-info border border-info/20',
        DISPUTED: 'bg-destructive/15 text-destructive border border-destructive/20',
        UNVERIFIED: 'bg-warning/15 text-warning border border-warning/20',
        CASH: 'bg-warning/15 text-warning border border-warning/20',
        PHONE: 'bg-info/15 text-info border border-info/20',
        WHATSAPP: 'bg-success/15 text-success border border-success/20',
        IN_APP: 'bg-primary/15 text-primary border border-primary/20',
        FIELD_VISIT: 'bg-warning/15 text-warning border border-warning/20',
        // Priority
        LOW: 'bg-muted text-muted-foreground border border-border',
        MEDIUM: 'bg-info/15 text-info border border-info/20',
        HIGH: 'bg-warning/15 text-warning border border-warning/20',
        URGENT: 'bg-destructive/15 text-destructive border border-destructive/20',
        // AI levels
        AI_HIGH: 'bg-destructive/15 text-destructive border border-destructive/20',
        AI_MEDIUM: 'bg-warning/15 text-warning border border-warning/20',
        AI_LOW: 'bg-info/15 text-info border border-info/20',
      },
    },
    defaultVariants: {
      variant: 'PASSIVE',
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    Omit<VariantProps<typeof statusBadgeVariants>, 'variant'> {
  variant?: any

  dot?: boolean
}

export function StatusBadge({ variant, dot = true, className, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant: variant as any }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}

// Helper to normalize status strings to badge variant
export function statusToVariant(status: string): string {
  const map: Record<string, string> = {
    HIGH: 'AI_HIGH',
    MEDIUM: 'AI_MEDIUM',
    LOW: 'AI_LOW',
  }
  return map[status] || status
}

export function formatStatus(status?: string | null): string {
  if (!status) return '—'
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
