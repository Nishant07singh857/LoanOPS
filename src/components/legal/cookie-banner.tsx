'use client'

import * as React from 'react'
import Link from 'next/link'
import { ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'

const STORAGE_KEY = `loanops_cookie_notice_v${COMPLIANCE_CONFIG.policyVersion}`

export function CookieBanner() {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const dismissed = window.localStorage.getItem(STORAGE_KEY)
        if (!dismissed) {
          setVisible(true)
        }
      } catch {
        setVisible(true)
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const acknowledge = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {
      // ignore storage errors
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside
      aria-label="Cookie and data privacy notice"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-md z-50 rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-4 shadow-premium"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              Essential Security Cookies &amp; DPDP Notice
            </p>
            <button
              type="button"
              onClick={acknowledge}
              aria-label="Dismiss cookie notice"
              className="text-muted-foreground hover:text-foreground rounded-lg p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            We use strictly necessary <code className="text-[11px] font-mono">httpOnly</code> session cookies for authentication, CSRF protection, and fraud prevention. We do not use third-party advertising trackers. Review our{' '}
            <Link href="/privacy" className="text-primary underline underline-offset-2 font-medium">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="text-primary underline underline-offset-2 font-medium">
              Terms of Use
            </Link>
            .
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" asChild className="h-8 text-xs rounded-lg">
              <Link href="/privacy">Privacy Rights</Link>
            </Button>
            <Button size="sm" onClick={acknowledge} className="h-8 text-xs rounded-lg">
              Got It
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}
