'use client'

import * as React from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import {
  Banknote, TrendingUp, Wallet, AlertTriangle, Landmark, Activity,
  FileText, Clock, ArrowRight, Sparkles, Plus, QrCode, FileCheck,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { StatusBadge, formatStatus, statusToVariant } from '@/components/ui/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

const PortfolioTrendChart = dynamic(() => import('@/components/charts/portfolio-trend-chart'), { ssr: false, loading: () => (<div className="h-full w-full animate-pulse rounded-xl bg-muted/40" aria-hidden="true" />) })
const OverdueAgingChart = dynamic(() => import('@/components/charts/overdue-aging-chart'), { ssr: false, loading: () => (<div className="h-full w-full animate-pulse rounded-xl bg-muted/40" aria-hidden="true" />) })

interface DashboardKPIs {
  totalDisbursed: string
  outstandingPrincipal: string
  totalCollected: string
  totalOverdue: string
  activeLoans: number
  completedLoans: number
  pendingApplications: number
  overdueLoans: number
  collectionRate: number
  appsWaitingReview: number
  loansReadyForDisbursement: number
  paymentsDueToday: number
  paymentsOverdue: number
  ptpDueToday: number
  brokenPtp: number
  pendingCashVerification: number
  totalLoans: number
  overdueInstallmentsCount: number
  dueTodayAmount: string
}

interface AIInsight {
  id: string
  signalType: string
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  candidateId?: string
  candidateName?: string
  loanId?: string
  loanNumber?: string
  reasons: string[]
  suggestedAction?: string
}

interface AnalyticsData {
  disbursementTrend: { label: string; value: number }[]
  collectionTrend: { label: string; value: number }[]
  outstandingTrend: { label: string; value: number }[]
  overdueTrend: { label: string; value: number }[]
  overdueAging: { bucket: string; count: number; amount: number }[]
}

interface AuditItem {
  id: string
  action: string
  entityType: string
  entityId?: string
  description: string
  user?: { name: string; email: string } | null
  createdAt: string
}

const alertColor: Record<string, string> = {
  HIGH: 'bg-destructive text-destructive',
  MEDIUM: 'bg-warning text-warning',
  LOW: 'bg-info text-info',
}

const activityIcon: Record<string, React.ReactNode> = {
  Application: <FileText className="h-3.5 w-3.5" />,
  Loan: <Landmark className="h-3.5 w-3.5" />,
  Payment: <Wallet className="h-3.5 w-3.5" />,
  Ptp: <Clock className="h-3.5 w-3.5" />,
  Escalation: <AlertTriangle className="h-3.5 w-3.5" />,
  CashCollection: <Banknote className="h-3.5 w-3.5" />,
  Disbursement: <Banknote className="h-3.5 w-3.5" />,
  User: <Activity className="h-3.5 w-3.5" />,
}

const activityTint: Record<string, string> = {
  Application: 'bg-info/15 text-info',
  Loan: 'bg-primary/15 text-primary',
  Payment: 'bg-success/15 text-success',
  Ptp: 'bg-warning/15 text-warning',
  Escalation: 'bg-destructive/15 text-destructive',
  CashCollection: 'bg-warning/15 text-warning',
  Disbursement: 'bg-success/15 text-success',
  User: 'bg-muted text-muted-foreground',
  CREATE: 'bg-info/15 text-info',
  APPROVE: 'bg-success/15 text-success',
  REJECT: 'bg-destructive/15 text-destructive',
  DISBURSE: 'bg-success/15 text-success',
  ALLOCATE: 'bg-primary/15 text-primary',
  LOGIN: 'bg-muted text-muted-foreground',
  REFUND: 'bg-warning/15 text-warning',
  CORRECT: 'bg-warning/15 text-warning',
  PTP_CREATE: 'bg-warning/15 text-warning',
  PTP_UPDATE: 'bg-warning/15 text-warning',
  ESCALATE: 'bg-destructive/15 text-destructive',
  REVOKE: 'bg-warning/15 text-warning',
  SUBMIT: 'bg-info/15 text-info',
  VERIFY: 'bg-success/15 text-success',
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

// Real agent assignment for a dashboard alert: pick an active agent and
// PATCH the candidate (PATCH /api/owner/candidates/[id]). Assignment is
// what every agent-side ownership check keys off, so this has immediate
// effect — the previous button only showed a success toast and did nothing.
function AssignAgentControl({ candidateId, candidateName }: { candidateId: string; candidateName?: string }) {
  const [agentId, setAgentId] = React.useState('')
  const queryClient = useQueryClient()
  const { data: agentsData } = useQuery({
    queryKey: ['owner-agents-list'],
    queryFn: () => api.get<{ items: { id: string; name: string; isActive: boolean }[] }>('/api/owner/agents'),
    staleTime: 60 * 1000,
  })
  const agents = (agentsData?.items ?? []).filter((a) => a.isActive)
  const mutation = useMutation({
    mutationFn: () => api.patch(`/api/owner/candidates/${candidateId}`, { assignedAgentId: agentId }),
    onSuccess: () => {
      toast.success('Agent assigned', { description: `${candidateName ?? 'Candidate'} has been assigned.` })
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['owner-analytics'] })
    },
    onError: (e: Error) => toast.error('Assignment failed', { description: e.message }),
  })

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={`Assign an agent to ${candidateName ?? 'candidate'}`}
        value={agentId}
        onChange={(e) => setAgentId(e.target.value)}
        className="h-8 max-w-[150px] rounded-lg border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">Select agent…</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <Button
        size="sm"
        className="min-h-[44px] sm:min-h-8"
        disabled={!agentId || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Assigning…' : 'Assign agent'}
      </Button>
    </div>
  )
}

export default function AdminDashboardPage() {

  const { data: kpis, isLoading: kpiLoading, isError: kpiError, refetch: refetchKpis } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.get<DashboardKPIs>('/api/owner/dashboard'),
  })

  const { data: aiData, isLoading: aiLoading, isError: aiError, refetch: refetchAi } = useQuery({
    queryKey: ['owner-ai-insights'],
    queryFn: () => api.get<{ items: AIInsight[]; total: number; highCount: number; mediumCount: number; lowCount: number }>('/api/owner/ai-insights'),
  })

  const { data: analyticsData, isLoading: analyticsLoading, isError: analyticsError, refetch: refetchAnalytics } = useQuery({
    queryKey: ['owner-analytics'],
    queryFn: () => api.get<AnalyticsData>('/api/owner/analytics'),
  })

  const { data: auditData, isLoading: auditLoading, isError: auditError, refetch: refetchAudit } = useQuery({
    queryKey: ['owner-audit-recent'],
    queryFn: () => api.get<{ items: AuditItem[]; total: number }>('/api/owner/audit?page=1&pageSize=8'),
  })

  const aiAlerts = aiData?.items ?? []
  const recentActivity = (auditData?.items ?? [])
    .filter((a) => a.action !== 'LOGIN')
    .slice(0, 6).map((a) => ({
    id: a.id,
    type: a.entityType,
    action: a.action,
    title: a.description.split(' ').slice(0, 6).join(' '),
    description: a.description,
    actor: a.user?.name ?? 'System',
    timestamp: timeAgo(a.createdAt),
  }))

  // Portfolio trend chart data (combine three trends)
  const portfolioTrend = (analyticsData?.disbursementTrend ?? []).map((d, i) => ({
    label: d.label,
    disbursed: d.value,
    collected: analyticsData?.collectionTrend[i]?.value ?? 0,
    outstanding: analyticsData?.outstandingTrend[i]?.value ?? 0,
  }))

  // Overdue aging — real buckets from /api/owner/analytics (computed
  // server-side from open OVERDUE installments). The zero array is only
  // the loading placeholder before analytics arrive.
  const overdueAging = analyticsData?.overdueAging ?? [
    { bucket: '1-7 days', count: 0, amount: 0 },
    { bucket: '8-15 days', count: 0, amount: 0 },
    { bucket: '16-30 days', count: 0, amount: 0 },
    { bucket: '31-60 days', count: 0, amount: 0 },
    { bucket: '60+ days', count: 0, amount: 0 },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <SectionHeading
        title="Owner Dashboard"
        description="Portfolio pulse, disbursement & collections health, AI signals and recent activity."
        icon={<Activity className="h-5 w-5" />}
        action={
          <Button asChild variant="outline" size="sm" className="min-h-[44px] sm:min-h-8">
            <Link href="/admin/reports"><FileCheck className="h-4 w-4" /> Reports</Link>
          </Button>
        }
      />

      {/* Quick actions strip */}
      <FadeIn>
        <Card className="overflow-hidden border-border shadow-premium">
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
                <Button asChild size="sm" className="min-h-[44px] sm:min-h-8">
                  <Link href="/admin/create-loan"><Plus className="h-4 w-4" /> Create Loan</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="min-h-[44px] sm:min-h-8">
                  <Link href="/admin/create-loan"><QrCode className="h-4 w-4" /> Generate QR Link</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="min-h-[44px] sm:min-h-8">
                  <Link href="/admin/applications"><FileText className="h-4 w-4" /> Review Applications</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* KPI grid */}
      {kpiError ? (
        <Card className="border-destructive/40 bg-destructive/5 shadow-premium">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">Failed to load dashboard metrics</p>
                <p className="text-xs text-muted-foreground">Please check your connection and try again.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchKpis()} className="min-h-[44px] sm:min-h-8">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4" role={kpiLoading ? 'status' : undefined} aria-label={kpiLoading ? 'Loading dashboard KPIs' : undefined}>
        {kpiLoading || !kpis ? (
          Array.from({ length: 8 }).map((_, i) => (
            <StaggerItem key={i}>
              <Card className="shadow-premium"><CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-7 w-20" /><Skeleton className="h-3 w-16" /></CardContent></Card>
            </StaggerItem>
          ))
        ) : (
          <>
            <StaggerItem>
              <KPICard
                label="Total Disbursed"
                value={formatPaiseToINRShort(Number(kpis.totalDisbursed))}
                delta={{ value: 'live', positive: true }}
                icon={<Banknote className="h-5 w-5" />}
                variant="default"
               
              />
            </StaggerItem>
            <StaggerItem>
              <KPICard
                label="Outstanding Principal"
                value={formatPaiseToINRShort(Number(kpis.outstandingPrincipal))}
                delta={{ value: 'live', positive: false }}
                icon={<Wallet className="h-5 w-5" />}
                variant="info"
               
              />
            </StaggerItem>
            <StaggerItem>
              <KPICard
                label="Total Collected"
                value={formatPaiseToINRShort(Number(kpis.totalCollected))}
                delta={{ value: 'live', positive: true }}
                icon={<TrendingUp className="h-5 w-5" />}
                variant="success"
               
              />
            </StaggerItem>
            <StaggerItem>
              <KPICard
                label="Total Overdue"
                value={formatPaiseToINRShort(Number(kpis.totalOverdue))}
                delta={{ value: 'live', positive: false }}
                icon={<AlertTriangle className="h-5 w-5" />}
                variant="destructive"
               
              />
            </StaggerItem>
            <StaggerItem>
              <KPICard
                label="Active Loans"
                value={String(kpis.activeLoans)}
                delta={{ value: 'live', positive: true }}
                icon={<Landmark className="h-5 w-5" />}
                variant="default"
               
              />
            </StaggerItem>
            <StaggerItem>
              <KPICard
                label="Collection Rate"
                value={`${kpis.collectionRate.toFixed(1)}%`}
                delta={{ value: 'live', positive: true }}
                icon={<Activity className="h-5 w-5" />}
                variant="success"
               
              />
            </StaggerItem>
            <StaggerItem>
              <KPICard
                label="Pending Applications"
                value={String(kpis.pendingApplications)}
                delta={{ value: 'live', positive: false }}
                icon={<FileText className="h-5 w-5" />}
                variant="warning"
               
              />
            </StaggerItem>
            <StaggerItem>
              <KPICard
                label="Overdue Loans"
                value={String(kpis.overdueLoans)}
                delta={{ value: 'live', positive: false }}
                icon={<AlertTriangle className="h-5 w-5" />}
                variant="destructive"
               
              />
            </StaggerItem>
          </>
        )}
      </StaggerContainer>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <FadeIn className="lg:col-span-2">
          <Card className="border-border shadow-premium">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 space-y-0 pb-2">
              <div>
                <CardTitle className="text-base sm:text-lg">Portfolio Trend</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Disbursed vs Collected vs Outstanding (₹)</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-xs">
                <Legend4 color="var(--chart-1)" label="Disbursed" />
                <Legend4 color="var(--chart-2)" label="Collected" />
                <Legend4 color="var(--chart-3)" label="Outstanding" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] sm:h-[300px]">
                {analyticsLoading ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground" role="status" aria-label="Loading portfolio trend chart">
                    Loading chart…
                  </div>
                ) : analyticsError ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                    <p className="text-sm text-destructive font-medium">Failed to load analytics</p>
                    <Button variant="outline" size="sm" onClick={() => refetchAnalytics()} className="min-h-[44px] sm:min-h-8">
                      Retry
                    </Button>
                  </div>
                ) : portfolioTrend.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No trend data available yet</div>
                ) : (
                  <PortfolioTrendChart data={portfolioTrend} />
                )}
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
                <OverdueAgingChart data={overdueAging} />
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
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
              {aiLoading ? (
                <div className="space-y-3" role="status" aria-label="Loading AI alerts">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                  ))}
                </div>
              ) : aiError ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm text-destructive font-medium">Failed to load AI insights</p>
                  <Button variant="outline" size="sm" onClick={() => refetchAi()} className="min-h-[44px] sm:min-h-8">
                    Retry
                  </Button>
                </div>
              ) : aiAlerts.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-6 w-6" />}
                  title="No AI alerts"
                  description="All loans are healthy. Insights appear when overdue loans, broken PTPs, or repeated missed installments are detected."
                />
              ) : (
                aiAlerts.map((a) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <StatusBadge variant={statusToVariant(a.level) as any} dot={false}>{a.level}</StatusBadge>
                          <p className="text-sm font-semibold truncate">{a.title}</p>
                        </div>
                        {(a.candidateName || a.loanNumber) && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {a.candidateName && <span className="font-medium text-foreground">{a.candidateName}</span>}
                            {a.candidateName && a.loanNumber && ' · '}
                            {a.loanNumber}
                          </p>
                        )}
                        <ul className="space-y-1 mb-3">
                          {a.reasons.map((r, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0', alertColor[a.level] || 'bg-muted-foreground')} />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                        {a.suggestedAction && (
                          <div className="rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                            <span className="text-muted-foreground">Suggested: </span>
                            <span className="font-medium text-foreground">{a.suggestedAction}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {a.loanId && (
                        <Button size="sm" variant="outline" asChild className="min-h-[44px] sm:min-h-8">
                          <Link href={`/admin/loans/${a.loanId}`}>View loan</Link>
                        </Button>
                      )}
                      {a.candidateId && (
                        <AssignAgentControl candidateId={a.candidateId} candidateName={a.candidateName} />
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="border-border shadow-premium h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Live audit log across the platform</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[440px] overflow-y-auto no-scrollbar">
              {auditLoading ? (
                <div className="space-y-3" role="status" aria-label="Loading recent activity">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : auditError ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm text-destructive font-medium">Failed to load recent activity</p>
                  <Button variant="outline" size="sm" onClick={() => refetchAudit()} className="min-h-[44px] sm:min-h-8">
                    Retry
                  </Button>
                </div>
              ) : recentActivity.length === 0 ? (
                <EmptyState icon={<Activity className="h-6 w-6" />} title="No activity yet" description="Audit log events will appear here as actions occur." />
              ) : (
                <div className="relative">
                  <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />
                  <ul className="space-y-3">
                    {recentActivity.map((a) => (
                      <li key={a.id} className="flex items-start gap-3">
                        <div className={cn('relative z-10 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-background', activityTint[a.action] || activityTint[a.type] || 'bg-muted text-muted-foreground')}>
                          {activityIcon[a.type] || <Activity className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{a.title}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[8px] bg-muted">{a.actor.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{a.actor}</span>
                            <span>·</span>
                            <span className="whitespace-nowrap">{a.timestamp}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Apps awaiting review', value: kpis?.appsWaitingReview ?? 0, href: '/admin/applications', tint: 'text-warning' },
                { label: 'Loans ready for disb.', value: kpis?.loansReadyForDisbursement ?? 0, href: '/admin/loans?status=PENDING_DISBURSEMENT', tint: 'text-info' },
                { label: 'Payments due today', value: kpis?.paymentsDueToday ?? 0, href: '/admin/payments', tint: 'text-info' },
                { label: 'PTP due today', value: kpis?.ptpDueToday ?? 0, href: '/admin/collections', tint: 'text-warning' },
                { label: 'Broken PTPs', value: kpis?.brokenPtp ?? 0, href: '/admin/collections', tint: 'text-destructive' },
                { label: 'Pending cash verify', value: kpis?.pendingCashVerification ?? 0, href: '/admin/collections', tint: 'text-warning' },
              ].map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all group flex flex-col justify-between min-h-[44px]"
                >
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={cn('text-2xl font-bold tabular-nums mt-1', s.tint)}>{s.value}</p>
                  <div className="flex items-center gap-1 mt-3 text-xs font-medium text-primary group-hover:underline">
                    View <ArrowRight className="h-3.5 w-3.5" />
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
