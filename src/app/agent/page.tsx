'use client'

import * as React from 'react'
import Link from 'next/link'
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
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import { toast } from 'sonner'
import {
  agentTasks, agentCandidates, cashCollections, agentPtps,
} from '@/lib/mock-data'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

const todaysTasks = agentTasks.slice(0, 5)
const todaysFollowups = agentCandidates.filter((c) => c.nextFollowUp && c.nextFollowUp.includes('Today')).slice(0, 5)
const recentCash = cashCollections.slice(0, 5)

export default function AgentDashboardPage() {
  const { user } = useSession()
  const agentName = user?.name || 'Arjun Nair'

  const todaysCollection = cashCollections
    .filter((c) => c.collectionDate === 'Today')
    .reduce((s, c) => s + c.amount, 0)
  const tasksToday = agentTasks.filter((t) => t.dueDate === 'Today').length
  const ptpDueToday = agentPtps.filter((p) => p.promiseDate === '22 Sep 2024').length
  const overdueCandidates = agentCandidates.filter((c) => c.daysOverdue > 0).length

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  const initials = (name: string) =>
    name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  const onCall = (name: string) => toast.info(`Calling ${name}…`, { description: 'Connecting via IVR.' })
  const onWhatsApp = (name: string, mobile: string, loanNumber: string, amount: number, dueDate: string) => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PAYMENT_REMINDER, {
      candidateName: name,
      loanNumber,
      amount: (amount / 100).toLocaleString('en-IN'),
      dueDate,
    })
    openWhatsApp(mobile, msg)
    toast.success('WhatsApp draft opened', { description: `Reminder sent to ${name}` })
  }
  const onCompleteTask = (id: string) =>
    toast.success('Task completed', { description: `Task ${id} marked RESOLVED.` })

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
                    You have <span className="font-semibold text-info">{tasksToday} tasks</span> and{' '}
                    <span className="font-semibold text-warning">{todaysFollowups.length} follow-ups</span> today.
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
            value={formatPaiseToINRShort(todaysCollection)}
            icon={<Banknote className="h-5 w-5" />}
            variant="success"
            delta={{ value: '12.4%', positive: true }}
            spark={[80, 110, 130, 140, 165, 180, 195]}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Tasks Today"
            value={String(tasksToday)}
            icon={<ListTodo className="h-5 w-5" />}
            variant="info"
            delta={{ value: '2 new', positive: false }}
            spark={[2, 3, 4, 5, 5, 4, 5]}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="PTP Due Today"
            value={String(ptpDueToday)}
            icon={<Handshake className="h-5 w-5" />}
            variant="warning"
            spark={[1, 1, 2, 3, 2, 3, 3]}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Overdue Candidates"
            value={String(overdueCandidates)}
            icon={<AlertTriangle className="h-5 w-5" />}
            variant="destructive"
            delta={{ value: '1', positive: false }}
            spark={[3, 3, 4, 5, 4, 5, 5]}
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
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center mb-3', q.tint)}>
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
                    <CardDescription className="text-xs">{todaysTasks.length} top priority</CardDescription>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/agent/tasks">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[460px] overflow-y-auto no-scrollbar">
              {todaysTasks.map((t) => {
                const cand = agentCandidates.find((c) => c.name === t.candidateName)
                const mobile = cand?.mobile || ''
                return (
                  <StaggerItem key={t.id}>
                    <div className="rounded-2xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-premium transition-all">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initials(t.candidateName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{t.candidateName}</p>
                              <p className="font-mono text-[11px] text-muted-foreground">{t.loanNumber}</p>
                            </div>
                            <StatusBadge variant={t.priority}>{t.priority}</StatusBadge>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Banknote className="h-3 w-3" /> {formatPaiseToINR(t.amount)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {t.nextFollowUp}
                            </span>
                          </div>
                          <div className="flex gap-1.5 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5"
                              onClick={() => onCall(t.candidateName)}
                            >
                              <PhoneCall className="h-3.5 w-3.5" /> Call
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-info border-info/40 hover:bg-info/10"
                              onClick={() => onWhatsApp(t.candidateName, mobile, t.loanNumber, t.amount, t.dueDate)}
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 px-2.5 ml-auto"
                              onClick={() => onCompleteTask(t.id)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Done
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </StaggerItem>
                )
              })}
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
                    <CardDescription className="text-xs">{todaysFollowups.length} scheduled calls</CardDescription>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/agent/followups">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[460px] overflow-y-auto no-scrollbar">
              {todaysFollowups.map((c) => (
                <StaggerItem key={c.id}>
                  <Link
                    href={`/agent/candidates/${c.id}`}
                    className="block rounded-2xl border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-premium transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarFallback className="bg-warning/10 text-warning text-xs font-semibold">
                          {initials(c.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{c.name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{c.loanNumber}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning whitespace-nowrap">
                            <Clock className="h-3 w-3" /> {c.nextFollowUp}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                          <span>Last: {c.lastContact}</span>
                          {c.daysOverdue > 0 && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertTriangle className="h-3 w-3" /> {c.daysOverdue}d overdue
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MapPin className="h-3 w-3" /> Mumbai South
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 ml-auto text-info border-info/40 hover:bg-info/10"
                            onClick={(e) => {
                              e.preventDefault()
                              onWhatsApp(c.name, c.mobile, c.loanNumber, c.outstanding, c.nextPayment)
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
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Recent Cash Collections */}
      <FadeIn>
        <Card className="shadow-premium">
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
          <CardContent>
            <StaggerContainer className="space-y-2.5">
              {recentCash.map((c) => (
                <StaggerItem key={c.id}>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:shadow-premium transition-all">
                    <div className="h-9 w-9 rounded-xl bg-success/10 text-success flex items-center justify-center flex-shrink-0">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{c.candidateName}</p>
                        <span className="font-mono text-[10px] text-muted-foreground">{c.reference}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{c.collectionDate} · {c.collectionTime}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">{formatPaiseToINR(c.amount)}</p>
                      <StatusBadge variant={c.status} className="mt-0.5">{formatStatus(c.status)}</StatusBadge>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
