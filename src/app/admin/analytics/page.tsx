'use client'

import * as React from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { LineChart as LineIcon } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import {
  portfolioTrend, overdueAging, agentPerformance, ownerKPIs,
} from '@/lib/mock-data'
import { formatPaiseToINRShort } from '@/lib/money'

const tooltipStyle = {
  background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12,
  color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px',
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

const repaymentByFreq = [
  { name: 'Daily', value: 38, color: 'var(--chart-1)' },
  { name: 'Weekly', value: 42, color: 'var(--chart-2)' },
  { name: 'Monthly', value: 20, color: 'var(--chart-3)' },
]

const collectionByMethod = [
  { name: 'UPI', value: 48, color: 'var(--chart-1)' },
  { name: 'Cash', value: 28, color: 'var(--chart-3)' },
  { name: 'Netbanking', value: 14, color: 'var(--chart-2)' },
  { name: 'Card', value: 6, color: 'var(--chart-4)' },
  { name: 'Bank Transfer', value: 4, color: 'var(--chart-5)' },
]

const ptpFulfillment = [
  { label: 'Mumbai South', fulfilled: 14, broken: 3 },
  { label: 'Mumbai West', fulfilled: 15, broken: 5 },
  { label: 'Pune', fulfilled: 12, broken: 1 },
  { label: 'Thane', fulfilled: 13, broken: 2 },
  { label: 'Nashik', fulfilled: 7, broken: 4 },
]

const agentWorkload = agentPerformance.map((a) => ({
  name: a.agentName.split(' ')[0],
  tasks: a.tasksCompleted,
  followUps: a.followUps,
}))

export default function AnalyticsPage() {
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
            <p className="text-xl font-bold tabular-nums">{formatPaiseToINRShort(ownerKPIs.totalDisbursed)}</p>
          </CardContent></Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Collection Rate</p>
            <p className="text-xl font-bold tabular-nums text-success">{ownerKPIs.collectionRate}%</p>
          </CardContent></Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Overdue Loans</p>
            <p className="text-xl font-bold tabular-nums text-destructive">{ownerKPIs.overdueLoans}</p>
          </CardContent></Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">PTP Fulfillment</p>
            <p className="text-xl font-bold tabular-nums">71%</p>
          </CardContent></Card>
        </StaggerItem>
      </StaggerContainer>

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
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatPaiseToINRShort(v), 'Disbursed']} />
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
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatPaiseToINRShort(v), 'Collected']} />
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
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatPaiseToINRShort(v), 'Outstanding']} />
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
            <CardHeader className="pb-2"><CardTitle className="text-base">Overdue Aging</CardTitle><CardDescription>Loans by days past due</CardDescription></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overdueAging} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {overdueAging.map((_, i) => (
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
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v}%`, n]} />
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
            <CardHeader className="pb-2"><CardTitle className="text-base">Agent Workload</CardTitle><CardDescription>Tasks completed vs follow-ups</CardDescription></CardHeader>
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

        {/* PTP fulfillment stacked bar */}
        <FadeIn delay={0.05}>
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">PTP Fulfillment by Zone</CardTitle><CardDescription>Fulfilled vs broken promises</CardDescription></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ptpFulfillment} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
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
    </div>
  )
}
