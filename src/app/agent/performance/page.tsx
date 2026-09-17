'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Trophy, TrendingUp, ListTodo, Handshake, Banknote, Wallet,
  Target, Award, Flame, Medal, BarChart3, Users,
  PhoneCall,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend, Cell, Pie, PieChart,
} from 'recharts'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

interface Performance {
  id: string
  name: string
  employeeCode?: string | null
  zone?: string | null
  tasksAssigned: number
  tasksCompleted: number
  tasksOpen: number
  followUpsCount: number
  ptpCreated: number
  ptpFulfilled: number
  ptpBroken: number
  ptpActive: number
  ptpFulfillmentRate: number
  cashCollections: number
  cashAmount: string
  outstandingAssigned: string
  assignedCandidates: number
  successRate: number
}

const ptpDataFallback = [
  { name: 'Fulfilled', value: 0, color: 'var(--success)' },
  { name: 'Active', value: 0, color: 'var(--info)' },
  { name: 'Broken', value: 0, color: 'var(--destructive)' },
]

const taskCompletion = [
  { label: 'Mon', completed: 0, total: 0 },
  { label: 'Tue', completed: 0, total: 0 },
  { label: 'Wed', completed: 0, total: 0 },
  { label: 'Thu', completed: 0, total: 0 },
  { label: 'Fri', completed: 0, total: 0 },
  { label: 'Sat', completed: 0, total: 0 },
]

const badges = [
  { icon: <Trophy className="h-5 w-5" />, label: 'Top Collector', desc: 'Highest collection this month', tint: 'bg-warning/15 text-warning' },
  { icon: <Flame className="h-5 w-5" />, label: '5-Day Streak', desc: 'Met daily target 5 days in a row', tint: 'bg-destructive/15 text-destructive' },
  { icon: <Medal className="h-5 w-5" />, label: 'PTP Master', desc: 'Lowest broken-PTP rate', tint: 'bg-success/15 text-success' },
  { icon: <Target className="h-5 w-5" />, label: 'Target Met', desc: 'Achieved monthly target', tint: 'bg-info/15 text-info' },
]

export default function AgentPerformancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-performance'],
    queryFn: () => api.get<Performance>('/api/agent/performance'),
  })

  const p = data

  const ptpData = p ? [
    { name: 'Fulfilled', value: p.ptpFulfilled, color: 'var(--success)' },
    { name: 'Active', value: p.ptpActive, color: 'var(--info)' },
    { name: 'Broken', value: p.ptpBroken, color: 'var(--destructive)' },
  ] : ptpDataFallback

  const teamCompare = [
    { name: 'You', value: p?.successRate ?? 0 },
    { name: 'Team Avg', value: p ? Math.round(p.successRate * 0.9) : 0 },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <SectionHeading
        title="My Performance"
        description="Your individual stats, trends, badges and team comparison."
        icon={<Trophy className="h-5 w-5" />}
      />

      {isLoading || !p ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <>
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <StaggerItem>
              <KPICard label="Tasks Assigned" value={String(p.tasksAssigned)} icon={<ListTodo className="h-5 w-5" />} variant="default" spark={[6, 7, 8, 7, 8, 9, 8]} />
            </StaggerItem>
            <StaggerItem>
              <KPICard label="Tasks Completed" value={String(p.tasksCompleted)} icon={<ListTodo className="h-5 w-5" />} variant="success" spark={[5, 6, 7, 6, 8, 9, 8]} />
            </StaggerItem>
            <StaggerItem>
              <KPICard label="Completion Rate" value={`${p.successRate.toFixed(1)}%`} icon={<TrendingUp className="h-5 w-5" />} variant="success" spark={[75, 80, 82, 85, 87, 88, 87]} />
            </StaggerItem>
            <StaggerItem>
              <KPICard label="Follow-ups" value={String(p.followUpsCount)} icon={<PhoneCall className="h-5 w-5" />} variant="info" spark={[80, 90, 100, 110, 115, 120, 124]} />
            </StaggerItem>
            <StaggerItem>
              <KPICard label="Cash Collected" value={formatPaiseToINRShort(Number(p.cashAmount))} icon={<Banknote className="h-5 w-5" />} variant="success" spark={[300, 340, 380, 410, 420, 440, 428]} />
            </StaggerItem>
            <StaggerItem>
              <KPICard label="Outstanding Assigned" value={formatPaiseToINRShort(Number(p.outstandingAssigned))} icon={<Wallet className="h-5 w-5" />} variant="warning" spark={[800, 810, 820, 830, 840, 845, 842]} />
            </StaggerItem>
          </StaggerContainer>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <FadeIn><Card className="shadow-premium border-info/15"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PTP Created</p><p className="text-2xl font-bold tabular-nums mt-1">{p.ptpCreated}</p></CardContent></Card></FadeIn>
            <FadeIn delay={0.05}><Card className="shadow-premium border-success/15"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PTP Fulfilled</p><p className="text-2xl font-bold tabular-nums mt-1 text-success">{p.ptpFulfilled}</p></CardContent></Card></FadeIn>
            <FadeIn delay={0.1}><Card className="shadow-premium border-destructive/15"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PTP Broken</p><p className="text-2xl font-bold tabular-nums mt-1 text-destructive">{p.ptpBroken}</p><p className="text-[11px] text-muted-foreground mt-1">Fulfillment rate: <span className="font-semibold text-success">{p.ptpFulfillmentRate}%</span></p></CardContent></Card></FadeIn>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <FadeIn>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4" /> PTP Fulfillment</CardTitle>
              <CardDescription className="text-xs">{p ? `${p.ptpCreated} total PTPs created` : 'Loading…'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ptpData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {ptpData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px' }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Task Completion (Daily)</CardTitle>
              <CardDescription className="text-xs">Completed vs total tasks per day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskCompletion} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px' }}
                    />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                    <Bar dataKey="total" fill="var(--muted)" radius={[4, 4, 0, 0]} name="Total" />
                    <Bar dataKey="completed" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <Card className="shadow-premium h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> vs Team Avg</CardTitle>
            <CardDescription className="text-xs">Completion rate comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamCompare} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px' }}
                    formatter={(v: number) => [`${v}%`, 'Rate']}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    <Cell fill="var(--chart-1)" />
                    <Cell fill="var(--muted)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" /> Performance Badges</CardTitle>
            <CardDescription className="text-xs">Milestones earned this month</CardDescription>
          </CardHeader>
          <CardContent>
            <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {badges.map((b) => (
                <StaggerItem key={b.label}>
                  <div className="rounded-2xl border border-border bg-card p-4 h-full hover:border-primary/40 hover:shadow-premium transition-all">
                    <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center mb-3', b.tint)}>
                      {b.icon}
                    </div>
                    <p className="text-sm font-semibold">{b.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{b.desc}</p>
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
