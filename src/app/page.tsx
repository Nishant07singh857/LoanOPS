'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Building2, Headphones, User, ShieldCheck, ArrowRight,
  Zap, Lock, Smartphone, BarChart3, Bot, MessageSquare,
  CheckCircle2, Wallet, FileText, Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SessionProvider, useSession, type Role } from '@/lib/session'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'

const PORTALS: Array<{
  role: Role
  title: string
  tagline: string
  description: string
  icon: React.ReactNode
  features: string[]
  gradient: string
  iconBg: string
}> = [
  {
    role: 'OWNER',
    title: 'Owner Portal',
    tagline: 'Complete business control',
    description: 'Origination, approval, disbursement, loans, finance, reconciliation, analytics & audit.',
    icon: <Building2 className="h-7 w-7" />,
    features: ['Portfolio KPIs', 'Loan origination', 'Reconciliation', 'AI insights', 'Audit trail', 'Reports'],
    gradient: 'from-primary/10 via-primary/5 to-transparent',
    iconBg: 'bg-primary/10 text-primary',
  },
  {
    role: 'AGENT',
    title: 'Agent Portal',
    tagline: 'Field collections & follow-ups',
    description: 'Tasks, candidates, follow-ups, PTP, WhatsApp, cash collection & escalations.',
    icon: <Headphones className="h-7 w-7" />,
    features: ['Today\'s tasks', 'Cash collection', 'WhatsApp follow-up', 'PTP tracking', 'Escalations', 'Notes'],
    gradient: 'from-info/10 via-info/5 to-transparent',
    iconBg: 'bg-info/10 text-info',
  },
  {
    role: 'CANDIDATE',
    title: 'Candidate Portal',
    tagline: 'Simple & trustworthy',
    description: 'Application, KYC, agreement, loan, schedule, payments, receipts & support.',
    icon: <User className="h-7 w-7" />,
    features: ['Onboarding via QR/link', 'KYC & agreement', 'Loan dashboard', 'Schedule & payments', 'Receipts', 'Support'],
    gradient: 'from-success/10 via-success/5 to-transparent',
    iconBg: 'bg-success/10 text-success',
  },
]

const FEATURES = [
  { icon: <ShieldCheck className="h-5 w-5" />, title: 'Bank-grade security', desc: 'RBAC, multi-tenant isolation, audit trail' },
  { icon: <Zap className="h-5 w-5" />, title: 'Real-time engine', desc: 'Schedule, allocation, ledger in real time' },
  { icon: <Bot className="h-5 w-5" />, title: 'AI advisory', desc: 'Risk signals, reminders, insights — no auto-decisions' },
  { icon: <MessageSquare className="h-5 w-5" />, title: 'WhatsApp built-in', desc: 'One-click reminders & follow-ups' },
  { icon: <BarChart3 className="h-5 w-5" />, title: 'Premium analytics', desc: 'Portfolio, collections, overdue aging' },
  { icon: <Smartphone className="h-5 w-5" />, title: 'All devices', desc: 'Mobile-first for agent & candidate, responsive for owner' },
]

function LandingInner() {
  const router = useRouter()
  const { loginAs, user } = useSession()

  const enter = async (role: Role) => {
    await loginAs(role)
    const target = role === 'OWNER' ? '/admin' : role === 'AGENT' ? '/agent' : '/portal'
    toast.success(`Entering ${role.toLowerCase()} portal`, { description: 'Loading your dashboard...' })
    setTimeout(() => router.push(target), 200)
  }

  React.useEffect(() => {
    // If user already logged in, route them on first mount
    if (user) {
      const target = user.role === 'OWNER' ? '/admin' : user.role === 'AGENT' ? '/agent' : '/portal'
      router.replace(target)
    }
  }, [user, router])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-fintech flex items-center justify-center text-primary-foreground shadow-glow">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold tracking-tight leading-none text-base">LoanOps</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Premium Loan Operations</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Demo accounts</span>
            <Button variant="ghost" size="sm" onClick={() => enter('OWNER')}>Owner</Button>
            <Button variant="ghost" size="sm" onClick={() => enter('AGENT')}>Agent</Button>
            <Button variant="ghost" size="sm" onClick={() => enter('CANDIDATE')}>Candidate</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-info/10 pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-10 sm:pb-14 relative">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium mb-5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Bank-grade multi-tenant platform
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Loan operations,
              <br className="hidden sm:block" />
              <span className="text-gradient-primary"> end-to-end.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Origination, KYC, agreement, disbursement, repayments, collections, ledger, reconciliation, AI insights & audit —
              unified across owner, agent & candidate.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" onClick={() => enter('OWNER')} className="w-full sm:w-auto h-12 text-base rounded-xl">
                Enter Owner Portal <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => enter('CANDIDATE')} className="w-full sm:w-auto h-12 text-base rounded-xl">
                Try Candidate Portal
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Portal cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {PORTALS.map((p, idx) => (
            <motion.div
              key={p.role}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + idx * 0.08, ease: 'easeOut' }}
              whileHover={{ y: -4 }}
              className="cursor-pointer"
              onClick={() => enter(p.role)}
            >
              <Card className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${p.gradient} h-full transition-shadow hover:shadow-glow`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`h-14 w-14 rounded-2xl ${p.iconBg} flex items-center justify-center shadow-sm`}>
                      {p.icon}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="mt-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{p.tagline}</p>
                    <h3 className="text-xl font-bold mt-1">{p.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{p.description}</p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {p.features.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1 rounded-md bg-card/80 border border-border/60 px-2 py-1 text-[11px] font-medium">
                        <CheckCircle2 className="h-3 w-3 text-success" /> {f}
                      </span>
                    ))}
                  </div>
                  <Button className="w-full mt-6 h-11 rounded-xl" onClick={(e) => { e.stopPropagation(); enter(p.role) }}>
                    Open {p.title} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold">Built for production lending</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Everything you need to run a modern lending operation, with safety by default.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
            >
              <Card className="rounded-xl border bg-card hover:shadow-premium transition-shadow h-full">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      {f.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base">{f.title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-snug">{f.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Lifecycle strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold">The complete lifecycle</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">From origination to closure — one platform, one ledger, one source of truth.</p>
        </div>
        <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-max sm:min-w-0 sm:justify-center">
            {[
              'Create', 'QR/Link', 'Application', 'KYC', 'Agreement', 'Approval',
              'Loan', 'Disbursement', 'Repayment', 'Collection', 'Ledger', 'Receipt', 'Closure'
            ].map((step, i, arr) => (
              <React.Fragment key={step}>
                <div className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-card border border-border text-xs sm:text-sm font-medium shadow-sm">
                  {step}
                </div>
                {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>All money calculations backend-only · BigInt paise · Audit by default</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> v3.1</span>
            <span className="inline-flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Notifications enabled</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function Page() {
  return (
    <SessionProvider>
      <LandingInner />
    </SessionProvider>
  )
}
