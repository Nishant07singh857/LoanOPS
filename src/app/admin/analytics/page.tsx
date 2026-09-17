'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { LineChart as LineIcon } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { formatPaiseToINRShort } from '@/lib/money'

const tooltipStyle = {
  background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12,
  color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px',
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

interface AnalyticsData {
  trend: string
  disbursementTrend: { label: string; value: number }[]
  collectionTrend: { label: string; value: number }[]
  outstandingTrend: { label: string; value: number }[]
  overdueTrend: { label: string; value: number }[]
  repaymentFrequency: { frequency: string; count: number }[]
  collectionByMethod: { method: string; amount: string; count: number }[]
  agentWorkload: { id: string; name: string; zone?: string | null; activeTasks: number; assignedCandidates: number }[]
  ptpFulfillment: { status: string; count: number }[]
}

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
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['owner-analytics'],
    queryFn: () => api.get<AnalyticsData>('/api/owner/analytics'),
  })

  const { data: kpis } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.get<DashboardKPIs>('/api/owner/dashboard'),
  })

  // Build chart-friendly data
  const portfolioTrend = (data?.disbursementTrend ?? []).map((d, i) => ({
    label: d.label,
    disbursed: d.value,
    collected: data?.collectionTrend[i]?.value ?? 0,
    outstanding: data?.outstandingTrend[i]?.value ?? 0,
    overdue: data?.overdueTrend[i]?.value ?? 0,
  }))

  const overdueAging = (data?.overdueTrend ?? []).map((t, i) => ({
    bucket: t.label,
    count: t.value > 0 ? 1 : 0, // simplified — each month overdue was nonzero
    label: t.label,
    value: t.value,
  }))

  const repaymentByFreq = (data?.repaymentFrequency ?? []).map((f, i) => ({
    name: f.frequency,
    value: f.count,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const totalCollectedByMethod = (data?.collectionByMethod ?? []).reduce((s, m) => s + Number(m.amount), 0) || 1
  const collectionByMethod = (data?.collectionByMethod ?? []).map((m, i) => ({
    name: m.method.replace('ONLINE_', '').replace('_', ' '),
    value: Math.round((Number(m.amount) / totalCollectedByMethod) * 100),
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  const ptpFulfillmentByZone = (data?.ptpFulfillment ?? []).map((p) => ({
    label: p.status.charAt(0) + p.status.slice(1).toLowerCase(),
    fulfilled: p.status === 'FULFILLED' ? p.count : 0,
    broken: p.status === 'BROKEN' ? p.count : 0,
  }))

  const agentWorkload = (data?.agentWorkload ?? []).map((a) => ({
    name: a.name.split(' ')[0],
    tasks: a.activeTasks,
    followUps: a.assignedCandidates,
  }))

  const totalPtpCreated = (data?.ptpFulfillment ?? []).reduce((s, p) => s + p.count, 0)
  const totalPtpFulfilled = (data?.ptpFulfillment ?? []).find((p) => p.status === 'FULFILLED')?.count ?? 0
  const ptpFulfillmentPct = totalPtpCreated > 0 ? Math.round((totalPtpFulfilled / totalPtpCreated) * 100) : 0

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Analytics"
        description="Deep-dive into portfolio trends, collection efficiency, agent performance, and PTP fulfillment."
        icon={<LineIcon className="h-5 w-5" />}
      />

      {/* KPI strip */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Disbursed</p>
            <p className="text-xl font-bold tabular-nums">{kpis ? formatPaiseToINRShort(Number(kpis.totalDisbursed)) : '—'}</p>
          </CardContent></Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Collection Rate</p>
            <p className="text-xl font-bold tabular-nums text-success">{kpis ? kpis.collectionRate : 0}%</p>
          </CardContent></Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Overdue Loans</p>
            <p className="text-xl font-bold tabular-nums text-destructive">{kpis?.overdueLoans ?? 0}</p>
          </CardContent></Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">PTP Fulfillment</p>
            <p className="text-xl font-bold tabular-nums">{ptpFulfillmentPct}%</p>
          </CardContent></Card>
        </StaggerItem>
      </StaggerContainer>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[300px] w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Disbursement trend */}
          <FadeIn>
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-base">Disbursement Trend</CardTitle><CardDescription>Monthly disbursed amount</CardDescription></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={portfolioTrend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="disbG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => formatPaiseToINRShort(v)} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatPaiseToINRShort(Number(v)), 'Disbursed']} />
                      <Area type="monotone" dataKey="disbursed" stroke="var(--chart-1)" strokeWidth={2} fill="url(#disbG)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Collection trend */}
          <FadeIn delay={0.05}>
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-base">Collection Trend</CardTitle><CardDescription>Monthly collected amount</CardDescription></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={portfolioTrend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => formatPaiseToINRShort(v)} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatPaiseToINRShort(Number(v)), 'Collected']} />
                      <Line type="monotone" dataKey="collected" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--chart-2)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Outstanding trend */}
          <FadeIn>
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-base">Outstanding Trend</CardTitle><CardDescription>Outstanding principal over time</CardDescription></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={portfolioTrend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="outG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => formatPaiseToINRShort(v)} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatPaiseToINRShort(Number(v)), 'Outstanding']} />
                      <Area type="monotone" dataKey="outstanding" stroke="var(--chart-3)" strokeWidth={2} fill="url(#outG)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Overdue trend */}
          <FadeIn delay={0.05}>
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-base">Overdue Trend</CardTitle><CardDescription>Overdue amount over time</CardDescription></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={portfolioTrend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => formatPaiseToINRShort(v)} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatPaiseToINRShort(Number(v)), 'Overdue']} />
                      <Bar dataKey="overdue" radius={[6, 6, 0, 0]}>
                        {portfolioTrend.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Repayment by frequency */}
          <FadeIn>
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-base">Repayment by Frequency</CardTitle><CardDescription>Distribution of loans by frequency</CardDescription></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={repaymentByFreq} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {repaymentByFreq.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v} loans`, n]} />
                      <Legend iconType="circle" formatter={(v) => <span className="text-xs">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Collection by method */}
          <FadeIn delay={0.05}>
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-base">Collection by Method</CardTitle><CardDescription>% of collections by channel</CardDescription></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={collectionByMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                        {collectionByMethod.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v}%`, n]} />
                      <Legend iconType="circle" formatter={(v) => <span className="text-xs">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Agent workload */}
          <FadeIn>
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-base">Agent Workload</CardTitle><CardDescription>Active tasks vs assigned candidates</CardDescription></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agentWorkload} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend iconType="circle" formatter={(v) => <span className="text-xs">{v}</span>} />
                      <Bar dataKey="tasks" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="followUps" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* PTP fulfillment */}
          <FadeIn delay={0.05}>
            <Card className="shadow-premium">
              <CardHeader className="pb-2"><CardTitle className="text-base">PTP Fulfillment</CardTitle><CardDescription>Fulfilled vs broken vs active promises</CardDescription></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ptpFulfillmentByZone} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend iconType="circle" formatter={(v) => <span className="text-xs">{v}</span>} />
                      <Bar dataKey="fulfilled" stackId="a" fill="var(--chart-2)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="broken" stackId="a" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      )}
    </div>
  )
}
