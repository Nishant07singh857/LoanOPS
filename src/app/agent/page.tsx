'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Home, ListTodo, Banknote, Handshake, AlertTriangle, PhoneCall,
  MessageCircle, CheckCircle2, ArrowRight, Clock, MapPin, Sun,
  Sparkles, ChevronRight, Users,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'

interface AgentDashboard {
  agent: { id: string; name: string; employeeCode?: string | null; zone?: string | null }
  todayTasksCount: number
  todayFollowUpsCount: number
  ptpDueCount: number
  overdueCandidatesCount: number
  pendingCashVerificationsCount: number
  todaysTasks: Array<{
    id: string
    title: string
    description?: string | null
    amount: string | null
    dueDate: string
    priority: string
    status: string
    candidate: { id: string; fullName: string; mobile: string }
    loan: { id: string; loanNumber: string } | null
  }>
  todaysFollowUps: Array<{
    id: string
    contactMethod: string
    outcome?: string | null
    notes?: string | null
    nextFollowUp?: string | null
    candidate: { id: string; fullName: string; mobile: string }
  }>
  ptpDue: Array<{
    id: string
    promisedAmount: string
    promiseDate: string
    notes?: string | null
    candidate: { fullName: string; mobile: string }
    loan: { loanNumber: string }
  }>
  overdueCandidates: Array<{
    id: string
    fullName: string
    mobile: string
    overdueInstallments: number
    loanNumbers: string[]
  }>
  pendingCashVerifications: Array<{
    id: string
    amount: string
    collectionDate: string
    collectionTime: string
    reference?: string | null
    notes?: string | null
    candidate: { fullName: string; mobile: string }
    loan: { loanNumber: string }
  }>
  recentCashCollections: Array<{
    id: string
    amount: string
    candidateName: string
    loanNumber: string
    collectionDate: string
    status: string
  }>
}

const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

function fmtTime(d?: string | null) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(d?: string | null) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function AgentDashboardPage() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const agentName = user?.name || 'Agent'

  const { data, isLoading } = useQuery({
    queryKey: ['agent-dashboard'],
    queryFn: () => api.get<AgentDashboard>('/api/agent/dashboard'),
  })

  const completeMutation = useMutation({
    mutationFn: (taskId: string) => api.post(`/api/agent/tasks/${taskId}/complete`, { outcome: 'Resolved' }),
    onSuccess: () => {
      toast.success('Task completed', { description: 'Marked as RESOLVED.' })
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] })
    },
    onError: (e: Error) => toast.error('Failed to complete task', { description: e.message }),
  })

  const todaysTasks = data?.todaysTasks ?? []
  const todaysFollowups = data?.todaysFollowUps ?? []
  const ptpDue = data?.ptpDue ?? []
  const overdueCandidates = data?.overdueCandidates ?? []
  const recentCash = data?.recentCashCollections ?? []

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  const onCall = (name: string) => toast.info(`Calling ${name}…`, { description: 'Opening your phone dialer — the call is placed by your device.' })
  const onWhatsApp = (name: string, mobile: string, loanNumber: string, amountPaise: string, dueDate: string) => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PAYMENT_REMINDER, {
      candidateName: name,
      loanNumber,
      amount: (Number(amountPaise) / 100).toLocaleString('en-IN'),
      dueDate,
    })
    openWhatsApp(mobile, msg)
    toast.success('WhatsApp draft opened', { description: `Press Send in WhatsApp to deliver the reminder to ${name}.` })
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome banner */}
      <FadeIn>
        <Card className="overflow-hidden border-info/15 bg-gradient-to-br from-info/10 via-primary/5 to-transparent">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-info/15 text-info flex items-center justify-center flex-shrink-0">
                  <Home className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <Sun className="h-3.5 w-3.5" /> {today}
                  </p>
                  <h1 className="text-lg sm:text-2xl font-bold tracking-tight mt-0.5">
                    Welcome back, {agentName.split(' ')[0]}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    You have <span className="font-semibold text-info">{data?.todayTasksCount ?? 0} tasks</span> and{' '}
                    <span className="font-semibold text-warning">{data?.todayFollowUpsCount ?? 0} follow-ups</span> today.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/agent/candidates"><Users className="h-4 w-4" /> My Candidates</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/agent/tasks"><ListTodo className="h-4 w-4" /> Today's Tasks</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* KPI grid */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard
            label="Today's Collection"
            value={formatPaiseToINRShort(recentCash.reduce((s, c) => s + Number(c.amount), 0))}
            icon={<Banknote className="h-5 w-5" />}
            variant="success"
            spark={recentCash.length > 0 ? [80, 110, 130, 140, 165, 180, 195] : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Tasks Today"
            value={String(data?.todayTasksCount ?? 0)}
            icon={<ListTodo className="h-5 w-5" />}
            variant="info"
            spark={(data?.todayTasksCount ?? 0) > 0 ? [2, 3, 4, 5, 5, 4, 5] : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="PTP Due Today"
            value={String(data?.ptpDueCount ?? 0)}
            icon={<Handshake className="h-5 w-5" />}
            variant="warning"
            spark={(data?.ptpDueCount ?? 0) > 0 ? [1, 1, 2, 3, 2, 3, 3] : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Overdue Candidates"
            value={String(data?.overdueCandidatesCount ?? 0)}
            icon={<AlertTriangle className="h-5 w-5" />}
            variant="destructive"
            spark={(data?.overdueCandidatesCount ?? 0) > 0 ? [3, 3, 4, 5, 4, 5, 5] : undefined}
          />
        </StaggerItem>
      </StaggerContainer>

      {/* Quick Actions row */}
      <FadeIn>
        <Card className="shadow-premium border-success/15">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-success/15 text-success flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Quick Actions</CardTitle>
                <CardDescription className="text-xs">One-tap shortcuts for the field</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Record Cash', icon: <Banknote className="h-5 w-5" />, tint: 'bg-success/15 text-success', href: '/agent/cash' },
                { label: 'New PTP', icon: <Handshake className="h-5 w-5" />, tint: 'bg-warning/15 text-warning', href: '/agent/ptp' },
                { label: 'WhatsApp Broadcast', icon: <MessageCircle className="h-5 w-5" />, tint: 'bg-info/15 text-info', href: '/agent/whatsapp' },
                { label: 'Escalate', icon: <AlertTriangle className="h-5 w-5" />, tint: 'bg-destructive/15 text-destructive', href: '/agent/escalations' },
              ].map((q) => (
                <Link
                  key={q.label}
                  href={q.href}
                  className="group rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all min-h-[80px]"
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${q.tint}`}>
                    {q.icon}
                  </div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {q.label}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Today's Tasks + Today's Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Today's Tasks */}
        <FadeIn>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <ListTodo className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Today's Tasks</CardTitle>
                    <CardDescription className="text-xs">{todaysTasks.length} tasks</CardDescription>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/agent/tasks">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[460px] overflow-y-auto no-scrollbar">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : todaysTasks.length === 0 ? (
                <EmptyState icon={<ListTodo className="h-6 w-6" />} title="No tasks today" description="You're all caught up." />
              ) : (
                <StaggerContainer className="space-y-3">
                  {todaysTasks.map((t) => (
                    <StaggerItem key={t.id}>
                      <div className="rounded-2xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-premium transition-all">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {initials(t.candidate.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <Link href={`/agent/candidates/${t.candidate.id}`} className="text-sm font-semibold truncate block hover:text-primary transition-colors">
                                  {t.candidate.fullName}
                                </Link>
                                <p className="font-mono text-[11px] text-muted-foreground">{t.loan?.loanNumber ?? '—'}</p>
                              </div>
                              <StatusBadge variant={t.priority}>{t.priority}</StatusBadge>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                              {t.amount && (
                                <span className="inline-flex items-center gap-1">
                                  <Banknote className="h-3 w-3" /> {formatPaiseToINR(Number(t.amount))}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {fmtDateShort(t.dueDate)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              <Button asChild size="sm" variant="outline" className="h-8 px-2.5">
                                <a href={`tel:${t.candidate.mobile.replace(/\s/g, '')}`} onClick={() => onCall(t.candidate.fullName)}>
                                  <PhoneCall className="h-3.5 w-3.5" /> Call
                                </a>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-info border-info/40 hover:bg-info/10"
                                onClick={() => onWhatsApp(t.candidate.fullName, t.candidate.mobile, t.loan?.loanNumber ?? '', t.amount ?? '0', fmtDateShort(t.dueDate))}
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 px-2.5 ml-auto"
                                disabled={completeMutation.isPending}
                                onClick={() => completeMutation.mutate(t.id)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Done
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Today's Follow-ups */}
        <FadeIn delay={0.05}>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Today's Follow-ups</CardTitle>
                    <CardDescription className="text-xs">{todaysFollowups.length} scheduled</CardDescription>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/agent/followups">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[460px] overflow-y-auto no-scrollbar">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : todaysFollowups.length === 0 ? (
                <EmptyState icon={<PhoneCall className="h-6 w-6" />} title="No follow-ups today" description="No calls scheduled." />
              ) : (
                <StaggerContainer className="space-y-3">
                  {todaysFollowups.map((f) => (
                    <StaggerItem key={f.id}>
                      <Link
                        href={`/agent/candidates/${f.candidate.id}`}
                        className="block rounded-2xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-premium transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9 flex-shrink-0">
                            <AvatarFallback className="bg-warning/10 text-warning text-xs font-semibold">
                              {initials(f.candidate.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{f.candidate.fullName}</p>
                                <p className="font-mono text-[11px] text-muted-foreground">{f.contactMethod}</p>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning whitespace-nowrap">
                                <Clock className="h-3 w-3" /> {fmtTime(f.nextFollowUp)}
                              </span>
                            </div>
                            {f.outcome && (
                              <p className="text-[11px] text-muted-foreground mt-1.5">Last outcome: {f.outcome}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 ml-auto text-info border-info/40 hover:bg-info/10"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  onWhatsApp(f.candidate.fullName, f.candidate.mobile, '', '0', fmtDateShort(f.nextFollowUp))
                                }}
                              >
                                <MessageCircle className="h-3 w-3" /> WhatsApp
                              </Button>
                            </div>
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
      </div>

      {/* PTP Due Today & Recent Cash Collections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* PTP Due Today */}
        <FadeIn>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
                    <Handshake className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">PTP Due Today</CardTitle>
                    <CardDescription className="text-xs">{ptpDue.length} promises due</CardDescription>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/agent/ptp">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[460px] overflow-y-auto no-scrollbar">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : ptpDue.length === 0 ? (
                <EmptyState icon={<Handshake className="h-6 w-6" />} title="No PTPs due" description="No promises to pay scheduled for today." />
              ) : (
                <StaggerContainer className="space-y-2.5">
                  {ptpDue.map((p) => (
                    <StaggerItem key={p.id}>
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-premium transition-all">
                        <div className="h-9 w-9 rounded-xl bg-warning/10 text-warning flex items-center justify-center flex-shrink-0">
                          <Handshake className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.candidate.fullName}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{p.loan.loanNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums">{formatPaiseToINR(Number(p.promisedAmount))}</p>
                          <p className="text-[11px] text-muted-foreground">{fmtDateShort(p.promiseDate)}</p>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Recent Cash Collections */}
        <FadeIn delay={0.05}>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-success/15 text-success flex items-center justify-center">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Recent Cash Collections</CardTitle>
                    <CardDescription className="text-xs">{recentCash.length} most recent</CardDescription>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/agent/cash">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[460px] overflow-y-auto no-scrollbar">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : recentCash.length === 0 ? (
                <EmptyState icon={<Banknote className="h-6 w-6" />} title="No cash collections yet" description="Record your first cash pickup from the Cash page." />
              ) : (
                <StaggerContainer className="space-y-2.5">
                  {recentCash.map((c) => (
                    <StaggerItem key={c.id}>
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-premium transition-all">
                        <div className="h-9 w-9 rounded-xl bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                          <Banknote className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{c.candidateName}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{c.loanNumber}</p>
                          <p className="text-[11px] text-muted-foreground">{fmtDateShort(c.collectionDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums">{formatPaiseToINR(Number(c.amount))}</p>
                          <StatusBadge variant={c.status} className="mt-0.5">{formatStatus(c.status)}</StatusBadge>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
