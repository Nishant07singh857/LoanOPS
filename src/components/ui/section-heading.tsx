'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface SectionHeadingProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  icon?: React.ReactNode
}

export function SectionHeading({ title, description, action, className, icon }: SectionHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {icon && (
            <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mt-0.5">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate leading-9">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
            )}
          </div>
        </div>
      </div>
      {action && <div className="flex-shrink-0 flex items-center gap-2 flex-wrap w-full sm:w-auto">{action}</div>}
    </motion.div>
  )
}
