'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

export interface KPICardProps {
  label: string
  value: string
  delta?: { value: string; positive: boolean }
  icon?: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info'
  className?: string
  spark?: number[]
}

const variantStyles = {
  default: 'bg-card text-foreground',
  success: 'bg-success/5 text-foreground border-success/20',
  warning: 'bg-warning/5 text-foreground border-warning/20',
  destructive: 'bg-destructive/5 text-foreground border-destructive/20',
  info: 'bg-info/5 text-foreground border-info/20',
}

const iconBg = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  info: 'bg-info/15 text-info',
}

const sparkColor = {
  default: 'stroke-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  destructive: 'stroke-destructive',
  info: 'stroke-info',
}

export function KPICard({ label, value, delta, icon, variant = 'default', className, spark }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('h-full', className)}
    >
      <Card
        className={cn(
          'relative overflow-hidden border rounded-2xl shadow-premium transition-all hover:shadow-glow sm:hover:-translate-y-0.5',
          variantStyles[variant]
        )}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] sm:text-xs font-medium text-muted-foreground tracking-wide">
                  {label}
                </p>
                <div className="text-[10px] flex items-center text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
                  View <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold tracking-tight mt-1.5 tabular-nums">{value}</p>
              {delta && (
                <div
                  className={cn(
                    'flex items-center gap-1 mt-2 text-xs font-medium',
                    delta.positive ? 'text-success' : 'text-destructive'
                  )}
                >
                  {delta.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  <span>{delta.value}</span>
                  <span className="text-muted-foreground font-normal">vs last month</span>
                </div>
              )}
            </div>
            {icon && (
              <div className={cn('flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center', iconBg[variant])}>
                {icon}
              </div>
            )}
          </div>
          {spark && spark.length > 1 && (
            <div className="mt-3 h-8">
              <Sparkline data={spark} className={sparkColor[variant]} />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const w = 100
  const h = 32
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const midY = h - ((data[0] - min) / range) * h
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn('w-full h-full fill-none', className)}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trend from ${min} to ${max}`}
    >
      <line x1="0" y1={midY} x2={w} y2={midY} stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
      <polyline points={points} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
