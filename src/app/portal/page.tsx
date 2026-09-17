'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Wallet, CreditCard, CalendarClock, FileText, MessageCircle,
  Bell, ShieldCheck, Landmark, CheckCircle2, Clock, ChevronRight,
  ArrowRight, Sparkles, Sun, IndianRupee, Lock, LifeBuoy,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

const AGENT_PHONE = '+91 98201 44556'
const OWNER_PHONE = '+91 98200 11223'

const TRUST = [
  { icon: <ShieldCheck className="h-4 w-4" />, label: 'Bank-grade security' },
  { icon: <Landmark className="h-4 w-4" />, label: 'RBI compliant' },
  { icon: <Lock className="h-4 w-4" />, label: '256-bit encrypted' },
  { icon: <CheckCircle2 className="h-4 w-4" />, label: 'ISO 27001' },
]

interface CandidateLoan {
  id: string
  loanNumber?: string
  principalAmount: string
  installmentAmount: string
  totalRepayable: string
  outstandingPrincipal: string
  outstandingInterest: string
  outstandingFees: string
  totalCollected: string
  installments: number
  paidInstallments: number
  overdueInstallments: number
  status: string
  firstDueDate: string
  finalDueDate: string
  nextDue?: {
    installmentNumber: number
    dueDate: string
    totalDue: string
  } | null
}

interface NotificationRow {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CandidateHomePage() {
  const { user } = useSession()
  const candidateName = user?.name || 'Candidate'
  const firstName = candidateName.split(' ')[0]

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  // Loan data — gracefully handle no loan case
  const { data: loan, isLoading: loanLoading } = useQuery({
    queryKey: ['candidate-loan'],
    queryFn: () => api.get<CandidateLoan>('/api/candidate/loan'),
    retry: false,
  })

  const { data: notifData } = useQuery({
    queryKey: ['candidate-notifications'],
    queryFn: () => api.get<{ items: NotificationRow[]; total: number; unreadCount: number }>('/api/notifications?pageSize=10'),
  })
  const notifications = notifData?.items ?? []

  const paidCount = loan?.paidInstallments ?? 0
  const installmentsTotal = loan?.installments ?? 0
  const progress = installmentsTotal > 0 ? Math.round((paidCount / installmentsTotal) * 100) : 0
  const nextInstallment = loan?.nextDue

  const onWhatsAppAgent = () => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.CANDIDATE_TO_AGENT, {
      candidateName,
      loanNumber: loan?.loanNumber ?? '',
    })
    openWhatsApp(AGENT_PHONE, msg)
    toast.success('WhatsApp draft opened', { description: 'Your agent will respond shortly.' })
  }
  const onWhatsAppOwner = () => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.CANDIDATE_TO_OWNER, {
      candidateName,
      loanNumber: loan?.loanNumber ?? '',
    })
    openWhatsApp(OWNER_PHONE, msg)
    toast.success('WhatsApp draft opened', { description: 'Owner notified.' })
  }

  // Countdown to next due date
  const dueDate = nextInstallment?.dueDate ? new Date(nextInstallment.dueDate) : null
  const now = new Date()
  const daysLeft = dueDate ? Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Greeting hero */}
      <FadeIn>
        <Card className="overflow-hidden border-success/15 bg-gradient-to-br from-success/10 via-primary/5 to-transparent">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-success/15 text-success flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <Sun className="h-3.5 w-3.5" /> {today}
                  </p>
                  <h1 className="text-lg sm:text-2xl font-bold tracking-tight mt-0.5">
                    Hello, {firstName} <span className="inline-block">👋</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {loan ? (
                      <>Your loan is <span className="font-semibold text-success">on track</span>. {paidCount} of {installmentsTotal} installments paid.</>
                    ) : (
                      <>Welcome! No active loan yet — check back after your application is approved.</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/portal/loan"><Wallet className="h-4 w-4" /> My Loan</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/portal/payments"><CreditCard className="h-4 w-4" /> Pay Now</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {loanLoading ? (
        <Card className="shadow-premium"><CardContent className="p-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent></Card>
      ) : loan && loan.loanNumber ? (
        <>
          {/* Active loan card + next due */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <FadeIn className="lg:col-span-2">
              <Card className="shadow-premium h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-success/15 text-success flex items-center justify-center">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Active Loan</CardTitle>
                        <CardDescription className="text-xs font-mono">{loan.loanNumber}</CardDescription>
                      </div>
                    </div>
                    <StatusBadge variant={loan.status}>Active</StatusBadge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outstanding</p>
                      <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">
                        {formatPaiseToINR(Number(loan.outstandingPrincipal) + Number(loan.outstandingInterest))}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Next Due</p>
                      <p className="text-base sm:text-lg font-bold mt-1">{nextInstallment ? fmtDate(nextInstallment.dueDate) : '—'}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3 col-span-2 sm:col-span-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Installment</p>
                      <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">
                        {formatPaiseToINR(Number(loan.installmentAmount))}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Repayment progress</span>
                      <span className="font-medium">{paidCount} of {installmentsTotal} paid · {progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2.5" />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/portal/loan">View Details <ChevronRight className="h-3.5 w-3.5" /></Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/portal/schedule"><CalendarClock className="h-3.5 w-3.5" /> Schedule</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            <FadeIn delay={0.05}>
              <Card className="shadow-premium h-full border-warning/20 bg-gradient-to-br from-warning/10 via-card to-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-warning">
                    <Clock className="h-4 w-4" /> Next Payment Due
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums">
                      {nextInstallment ? formatPaiseToINR(Number(nextInstallment.totalDue)) : formatPaiseToINR(Number(loan.installmentAmount))}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Installment #{nextInstallment?.installmentNumber ?? 1} · {nextInstallment ? fmtDate(nextInstallment.dueDate) : fmtDate(loan.firstDueDate)}</p>
                  </div>
                  <div className="rounded-xl bg-warning/10 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Time remaining</p>
                    <p className="text-2xl font-bold text-warning mt-0.5">
                      {daysLeft} <span className="text-base font-medium">days</span>
                    </p>
                  </div>
                  <Button asChild className="w-full" size="sm">
                    <Link href="/portal/payments"><CreditCard className="h-4 w-4" /> Pay Now</Link>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          {/* Quick Actions */}
          <FadeIn>
            <Card className="shadow-premium border-primary/15">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                    <CardDescription className="text-xs">Everything you need, one tap away</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Pay Now', icon: <CreditCard className="h-5 w-5" />, tint: 'bg-success/15 text-success', href: '/portal/payments' },
                    { label: 'View Schedule', icon: <CalendarClock className="h-5 w-5" />, tint: 'bg-primary/10 text-primary', href: '/portal/schedule' },
                    { label: 'Download Receipt', icon: <FileText className="h-5 w-5" />, tint: 'bg-info/15 text-info', href: '/portal/receipts' },
                    { label: 'WhatsApp Support', icon: <MessageCircle className="h-5 w-5" />, tint: 'bg-warning/15 text-warning', onClick: onWhatsAppAgent },
                  ].map((q) => {
                    const inner = (
                      <>
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center mb-3', q.tint)}>
                          {q.icon}
                        </div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          {q.label}
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                        </p>
                      </>
                    )
                    return q.href ? (
                      <Link
                        key={q.label}
                        href={q.href}
                        className="group rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all min-h-[88px]"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        key={q.label}
                        onClick={q.onClick}
                        className="group rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all min-h-[88px] text-left"
                      >
                        {inner}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </>
      ) : null}

      {/* Notifications preview + Need Help */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <FadeIn className="lg:col-span-2">
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-info/15 text-info flex items-center justify-center">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Recent Notifications</CardTitle>
                    <CardDescription className="text-xs">{notifications.length} updates</CardDescription>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/portal/notifications">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="You'll see updates here." />
              ) : (
                <StaggerContainer className="space-y-2.5">
                  {notifications.slice(0, 3).map((n) => (
                    <StaggerItem key={n.id}>
                      <Link
                        href="/portal/notifications"
                        className={cn(
                          'block rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-premium transition-all',
                          !n.isRead && 'border-success/30 bg-success/5'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', n.isRead ? 'bg-muted text-muted-foreground' : 'bg-success/15 text-success')}>
                            {n.type === 'PAYMENT_REMINDER' ? <Clock className="h-4 w-4" /> : n.type === 'PAYMENT_CONFIRMATION' ? <CheckCircle2 className="h-4 w-4" /> : <IndianRupee className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">{n.title}</p>
                              {!n.isRead && <span className="h-2 w-2 rounded-full bg-success flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{fmtDate(n.createdAt)}</p>
                          </div>
                        </div>
                      </Link>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="shadow-premium h-full border-info/15">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4 text-info" /> Need Help?</CardTitle>
              <CardDescription className="text-xs">Reach out — we're here for you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-info/20 bg-info/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">Your Agent</p>
                <p className="text-sm font-semibold">Arjun Nair</p>
                <p className="text-[11px] text-muted-foreground font-mono">{AGENT_PHONE}</p>
                <Button size="sm" variant="outline" className="w-full mt-3 text-info border-info/40 hover:bg-info/10" onClick={onWhatsAppAgent}>
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Agent
                </Button>
              </div>
              <div className="rounded-xl border border-success/20 bg-success/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">Loan Owner</p>
                <p className="text-sm font-semibold">Ravi Mehta · Sterling Lending</p>
                <p className="text-[11px] text-muted-foreground font-mono">{OWNER_PHONE}</p>
                <Button size="sm" variant="outline" className="w-full mt-3 text-success border-success/40 hover:bg-success/10" onClick={onWhatsAppOwner}>
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Owner
                </Button>
              </div>
              <Button asChild size="sm" variant="ghost" className="w-full">
                <Link href="/portal/support"><LifeBuoy className="h-3.5 w-3.5" /> Open Support</Link>
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Trust strip */}
      <FadeIn>
        <Card className="border-border/60 bg-muted/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {TRUST.map((t) => (
                <div key={t.label} className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                    {t.icon}
                  </div>
                  <p className="text-xs sm:text-sm font-medium">{t.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
