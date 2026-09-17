'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend, Cell,
} from 'recharts'
import { motion } from 'framer-motion'
import {
  Banknote, TrendingUp, Wallet, AlertTriangle, Landmark, Activity,
  FileText, Clock, ArrowRight, Sparkles, Plus, QrCode, FileCheck,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { StatusBadge, formatStatus, statusToVariant } from '@/components/ui/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  ownerKPIs, recentActivity, aiAlerts, portfolioTrend, overdueAging,
} from '@/lib/mock-data'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

const activityIcon: Record<string, React.ReactNode> = {
  APPLICATION: <FileText className="h-3.5 w-3.5" />,
  LOAN: <Landmark className="h-3.5 w-3.5" />,
  PAYMENT: <Wallet className="h-3.5 w-3.5" />,
  PTP: <Clock className="h-3.5 w-3.5" />,
  ESCALATION: <AlertTriangle className="h-3.5 w-3.5" />,
  CASH: <Banknote className="h-3.5 w-3.5" />,
  DISBURSEMENT: <Banknote className="h-3.5 w-3.5" />,
  AUDIT: <Activity className="h-3.5 w-3.5" />,
}

const activityTint: Record<string, string> = {
  APPLICATION: 'bg-info/15 text-info',
  LOAN: 'bg-primary/15 text-primary',
  PAYMENT: 'bg-success/15 text-success',
  PTP: 'bg-warning/15 text-warning',
  ESCALATION: 'bg-destructive/15 text-destructive',
  CASH: 'bg-warning/15 text-warning',
  DISBURSEMENT: 'bg-success/15 text-success',
  AUDIT: 'bg-muted text-muted-foreground',
}

const alertColor: Record<string, string> = {
  HIGH: 'text-destructive',
  MEDIUM: 'text-warning',
  LOW: 'text-info',
}

export default function AdminDashboardPage() {
  const spark = (arr: number[]) => arr
  const onAssign = (name: string) => toast.success(`Agent assignment queued for ${name}`, {
    description: 'A collection follow-up task has been created.',
  })

  return (
    <div className="space-y-6 sm:space-y-8">
      <SectionHeading
        title="Owner Dashboard"
        description="Portfolio pulse, disbursement & collections health, AI signals and recent activity."
        icon={<Activity className="h-5 w-5" />}
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/reports"><FileCheck className="h-4 w-4" /> Reports</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/create-loan"><Plus className="h-4 w-4" /> Create Loan</Link>
            </Button>
          </>
        }
      />

      {/* Quick actions strip */}
      <FadeIn>
        <Card className="overflow-hidden border-success/15 bg-gradient-to-br from-success/5 via-primary/5 to-transparent">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm sm:text-base">Quick actions</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Originate a loan, share an application link, or review pending applications.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/admin/create-loan"><Plus className="h-4 w-4" /> Create Loan</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/qr-links"><QrCode className="h-4 w-4" /> Generate QR Link</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/applications"><FileText className="h-4 w-4" /> Review Applications</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* KPI grid */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard
            label="Total Disbursed"
            value={formatPaiseToINRShort(ownerKPIs.totalDisbursed)}
            delta={{ value: '12.4%', positive: true }}
            icon={<Banknote className="h-5 w-5" />}
            variant="default"
            spark={spark([300, 340, 380, 410, 420, 460, 500, 560])}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Outstanding Principal"
            value={formatPaiseToINRShort(ownerKPIs.outstandingPrincipal)}
            delta={{ value: '4.2%', positive: false }}
            icon={<Wallet className="h-5 w-5" />}
            variant="info"
            spark={spark([980, 1020, 1060, 1100, 1150, 1190, 1210, 1240])}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Total Collected"
            value={formatPaiseToINRShort(ownerKPIs.totalCollected)}
            delta={{ value: '8.7%', positive: true }}
            icon={<TrendingUp className="h-5 w-5" />}
            variant="success"
            spark={spark([310, 340, 360, 390, 420, 460, 480, 502])}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Total Overdue"
            value={formatPaiseToINRShort(ownerKPIs.totalOverdue)}
            delta={{ value: '2.1%', positive: false }}
            icon={<AlertTriangle className="h-5 w-5" />}
            variant="destructive"
            spark={spark([60, 72, 78, 82, 80, 84, 86, 84])}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Active Loans"
            value={String(ownerKPIs.activeLoans)}
            delta={{ value: '3.5%', positive: true }}
            icon={<Landmark className="h-5 w-5" />}
            variant="default"
            spark={spark([560, 580, 590, 600, 605, 608, 610, 612])}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Collection Rate"
            value={`${ownerKPIs.collectionRate.toFixed(1)}%`}
            delta={{ value: '1.2%', positive: true }}
            icon={<Activity className="h-5 w-5" />}
            variant="success"
            spark={spark([88, 90, 91, 92, 93, 93.5, 94, 94.2])}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Pending Applications"
            value={String(ownerKPIs.pendingApplications)}
            delta={{ value: '4', positive: false }}
            icon={<FileText className="h-5 w-5" />}
            variant="warning"
            spark={spark([20, 24, 26, 30, 28, 25, 27, 27])}
          />
        </StaggerItem>
        <StaggerItem>
          <KPICard
            label="Overdue Loans"
            value={String(ownerKPIs.overdueLoans)}
            delta={{ value: '2', positive: false }}
            icon={<AlertTriangle className="h-5 w-5" />}
            variant="destructive"
            spark={spark([28, 32, 35, 40, 38, 36, 38, 38])}
          />
        </StaggerItem>
      </StaggerContainer>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <FadeIn className="lg:col-span-2">
          <Card className="border-border shadow-premium">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
              <div>
                <CardTitle className="text-base sm:text-lg">Portfolio Trend</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Disbursed vs Collected vs Outstanding (₹)</CardDescription>
              </div>
              <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                <Legend4 color="var(--chart-1)" label="Disbursed" />
                <Legend4 color="var(--chart-2)" label="Collected" />
                <Legend4 color="var(--chart-3)" label="Outstanding" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={portfolioTrend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="cG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="oG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      axisLine={false} tickLine={false} width={50}
                      tickFormatter={(v: number) => formatPaiseToINRShort(v as number)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12,
                        color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px',
                      }}
                      formatter={(v: number, n: string) => [formatPaiseToINR(v as number), n]}
                    />
                    <Area type="monotone" dataKey="disbursed" stroke="var(--chart-1)" strokeWidth={2} fill="url(#dG)" />
                    <Area type="monotone" dataKey="collected" stroke="var(--chart-2)" strokeWidth={2} fill="url(#cG)" />
                    <Area type="monotone" dataKey="outstanding" stroke="var(--chart-3)" strokeWidth={2} fill="url(#oG)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card className="border-border shadow-premium h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Overdue Aging</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Buckets by days past due</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overdueAging} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12,
                        color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px',
                      }}
                      formatter={(v: number, n: string) => [n === 'amount' ? formatPaiseToINR(v as number) : v, n === 'amount' ? 'Amount' : 'Count']}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {overdueAging.map((_, i) => (
                        <Cell key={i} fill={`oklch(${60 - i * 8}% 0.18 ${30 + i * 4})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* AI alerts + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <FadeIn>
          <Card className="border-border shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">AI Alerts</CardTitle>
                    <CardDescription className="text-xs">Risk signals requiring attention</CardDescription>
                  </div>
                </div>
                <StatusBadge variant="AI_HIGH">{aiAlerts.length} active</StatusBadge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[440px] overflow-y-auto no-scrollbar">
              {aiAlerts.map((a) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <StatusBadge variant={statusToVariant(a.level) as any} dot={false}>{a.level}</StatusBadge>
                        <p className="text-sm font-semibold truncate">{a.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        <span className="font-medium text-foreground">{a.candidateName}</span> · {a.loanNumber}
                      </p>
                      <ul className="space-y-1 mb-3">
                        {a.reasons.map((r, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className={cn('mt-1 h-1 w-1 rounded-full flex-shrink-0', alertColor[a.level] || 'bg-muted-foreground')} />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                        <span className="text-muted-foreground">Suggested: </span>
                        <span className="font-medium text-foreground">{a.suggestedAction}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/loans/${a.loanNumber.slice(-4).padStart(2, '0')}`}>View loan</Link>
                    </Button>
                    <Button size="sm" onClick={() => onAssign(a.candidateName)}>Assign agent</Button>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="border-border shadow-premium h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Live operational feed across the platform</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[440px] overflow-y-auto no-scrollbar">
              <div className="relative">
                <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />
                <ul className="space-y-4">
                  {recentActivity.map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <div className={cn('relative z-10 h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-background', activityTint[a.type])}>
                        {activityIcon[a.type]}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{a.title}</p>
                          {a.status && <StatusBadge variant={a.status as any} dot={false}>{formatStatus(a.status)}</StatusBadge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[8px] bg-muted">{a.actor.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{a.actor}</span>
                          <span>·</span>
                          <span className="whitespace-nowrap">{a.timestamp}</span>
                          {a.amount !== undefined && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-foreground whitespace-nowrap">{formatPaiseToINR(a.amount)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Operational summary */}
      <FadeIn>
        <Card className="border-border shadow-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Operational Snapshot</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Workflow counters across teams</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Apps awaiting review', value: ownerKPIs.appsWaitingReview, href: '/admin/applications', tint: 'text-warning' },
                { label: 'Loans ready for disb.', value: ownerKPIs.loansReadyForDisbursement, href: '/admin/disbursements', tint: 'text-info' },
                { label: 'Payments due today', value: ownerKPIs.paymentsDueToday, href: '/admin/payments', tint: 'text-info' },
                { label: 'PTP due today', value: ownerKPIs.ptpDueToday, href: '/admin/collections', tint: 'text-warning' },
                { label: 'Broken PTPs', value: ownerKPIs.brokenPtp, href: '/admin/collections', tint: 'text-destructive' },
                { label: 'Pending cash verify', value: ownerKPIs.pendingCashVerification, href: '/admin/collections', tint: 'text-warning' },
              ].map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all group"
                >
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={cn('text-2xl font-bold tabular-nums mt-1', s.tint)}>{s.value}</p>
                  <div className="flex items-center gap-1 mt-2 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    View <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

function Legend4({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
