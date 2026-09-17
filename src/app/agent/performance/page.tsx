'use client'

import * as React from 'react'
import {
  Trophy, TrendingUp, ListTodo, Handshake, Banknote, Wallet,
  Target, Award, Flame, Medal, ArrowUpRight, BarChart3, Users,
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
import { StatusBadge } from '@/components/ui/status-badge'
import { useSession } from '@/lib/session'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

const collectionTrend = [
  { label: 'Apr', amount: 3200000 },
  { label: 'May', amount: 3800000 },
  { label: 'Jun', amount: 4100000 },
  { label: 'Jul', amount: 3900000 },
  { label: 'Aug', amount: 4500000 },
  { label: 'Sep', amount: 4280000 },
]

const ptpData = [
  { name: 'Fulfilled', value: 14, color: 'var(--success)' },
  { name: 'Active', value: 4, color: 'var(--info)' },
  { name: 'Broken', value: 3, color: 'var(--destructive)' },
]

const taskCompletion = [
  { label: 'Mon', completed: 8, total: 10 },
  { label: 'Tue', completed: 12, total: 12 },
  { label: 'Wed', completed: 9, total: 11 },
  { label: 'Thu', completed: 11, total: 11 },
  { label: 'Fri', completed: 7, total: 9 },
  { label: 'Sat', completed: 4, total: 5 },
]

const teamCompare = [
  { name: 'You', value: 87.5 },
  { name: 'Team Avg', value: 82.1 },
]

const badges = [
  { icon: <Trophy className="h-5 w-5" />, label: 'Top Collector', desc: 'Highest collection this month', tint: 'bg-warning/15 text-warning' },
  { icon: <Flame className="h-5 w-5" />, label: '5-Day Streak', desc: 'Met daily target 5 days in a row', tint: 'bg-destructive/15 text-destructive' },
  { icon: <Medal className="h-5 w-5" />, label: 'PTP Master', desc: 'Lowest broken-PTP rate (8%)', tint: 'bg-success/15 text-success' },
  { icon: <Target className="h-5 w-5" />, label: 'Target Met', desc: 'Achieved 90% of monthly target', tint: 'bg-info/15 text-info' },
]

export default function AgentPerformancePage() {
  const { user } = useSession()
  const agentName = user?.name || 'Arjun Nair'

  const tasksAssigned = 48
  const tasksCompleted = 42
  const completionRate = (tasksCompleted / tasksAssigned) * 100
  const ptpCreated = 21
  const ptpFulfilled = 14
  const ptpBroken = 3
  const fulfillmentRate = (ptpFulfilled / (ptpFulfilled + ptpBroken)) * 100
  const monthCollection = 42800000 // paise
  const outstandingAssigned = 84200000 // paise

  return (
    <div className="space-y-6 sm:space-y-8">
      <SectionHeading
        title="My Performance"
        description="Your individual stats, trends, badges and team comparison."
        icon={<Trophy className="h-5 w-5" />}
      />

      {/* KPI grid */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard label="Tasks Assigned" value={String(tasksAssigned)} icon={<ListTodo className="h-5 w-5" />} variant="default" spark={[6, 7, 8, 7, 8, 9, 8]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Tasks Completed" value={String(tasksCompleted)} icon={<ListTodo className="h-5 w-5" />} variant="success" spark={[5, 6, 7, 6, 8, 9, 8]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Completion Rate" value={`${completionRate.toFixed(1)}%`} icon={<TrendingUp className="h-5 w-5" />} variant="success" spark={[75, 80, 82, 85, 87, 88, 87]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Follow-ups" value="124" icon={<PhoneCall className="h-5 w-5" />} variant="info" spark={[80, 90, 100, 110, 115, 120, 124]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="This Month Collected" value={formatPaiseToINRShort(monthCollection)} icon={<Banknote className="h-5 w-5" />} variant="success" delta={{ value: '8.7%', positive: true }} spark={[300, 340, 380, 410, 420, 440, 428]} />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Outstanding Assigned" value={formatPaiseToINRShort(outstandingAssigned)} icon={<Wallet className="h-5 w-5" />} variant="warning" spark={[800, 810, 820, 830, 840, 845, 842]} />
        </StaggerItem>
      </StaggerContainer>

      {/* PTP cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <FadeIn><Card className="shadow-premium border-info/15"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PTP Created</p><p className="text-2xl font-bold tabular-nums mt-1">{ptpCreated}</p></CardContent></Card></FadeIn>
        <FadeIn delay={0.05}><Card className="shadow-premium border-success/15"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PTP Fulfilled</p><p className="text-2xl font-bold tabular-nums mt-1 text-success">{ptpFulfilled}</p></CardContent></Card></FadeIn>
        <FadeIn delay={0.1}><Card className="shadow-premium border-destructive/15"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PTP Broken</p><p className="text-2xl font-bold tabular-nums mt-1 text-destructive">{ptpBroken}</p><p className="text-[11px] text-muted-foreground mt-1">Fulfillment rate: <span className="font-semibold text-success">{fulfillmentRate.toFixed(1)}%</span></p></CardContent></Card></FadeIn>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <FadeIn>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Collection Trend</CardTitle>
              <CardDescription className="text-xs">Last 6 months (₹)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={collectionTrend} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="amtG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => formatPaiseToINRShort(v as number)} />
                    <Tooltip
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px' }}
                      formatter={(v: number) => [formatPaiseToINR(v as number), 'Collected']}
                    />
                    <Area type="monotone" dataKey="amount" stroke="var(--chart-1)" strokeWidth={2} fill="url(#amtG)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4" /> PTP Fulfillment</CardTitle>
              <CardDescription className="text-xs">{ptpCreated} total PTPs created</CardDescription>
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
      </div>

      {/* Task completion + team compare */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <FadeIn className="lg:col-span-2">
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Task Completion (Daily)</CardTitle>
              <CardDescription className="text-xs">Completed vs total tasks per day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
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

        <FadeIn delay={0.05}>
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
      </div>

      {/* Performance badges */}
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

