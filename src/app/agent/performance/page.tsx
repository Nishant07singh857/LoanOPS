'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Trophy, TrendingUp, ListTodo, Handshake, Banknote, Wallet,
  PhoneCall,
} from 'lucide-react'
import {
  ResponsiveContainer,
  Tooltip, Legend, Cell, Pie, PieChart,
} from 'recharts'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'

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

export default function AgentPerformancePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agent-performance'],
    queryFn: () => api.get<Performance>('/api/agent/performance'),
  })

  const p = data

  const ptpData = p ? [
    { name: 'Fulfilled', value: p.ptpFulfilled, color: 'var(--success)' },
    { name: 'Active', value: p.ptpActive, color: 'var(--info)' },
    { name: 'Broken', value: p.ptpBroken, color: 'var(--destructive)' },
  ] : ptpDataFallback

  return (
    <div className="space-y-6 sm:space-y-8">
      <SectionHeading
        title="My Performance"
        description="Your real task, follow-up and collection statistics."
        icon={<Trophy className="h-5 w-5" />}
      />

      {isError ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium text-destructive">Could not load your performance data.</p>
            <p className="text-xs text-muted-foreground mt-1">This is a loading error — please try again.</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : p ? (
        <>
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <StaggerItem>
              <KPICard label="Tasks Assigned" value={String(p.tasksAssigned)} icon={<ListTodo className="h-5 w-5" />} variant="default" />
            </StaggerItem>
            <StaggerItem>
              <KPICard label="Tasks Completed" value={String(p.tasksCompleted)} icon={<ListTodo className="h-5 w-5" />} variant="success" />
            </StaggerItem>
            <StaggerItem>
              <KPICard label="Completion Rate" value={`${p.successRate.toFixed(1)}%`} icon={<TrendingUp className="h-5 w-5" />} variant="success" />
            </StaggerItem>
            <StaggerItem>
              <KPICard label="Follow-ups" value={String(p.followUpsCount)} icon={<PhoneCall className="h-5 w-5" />} variant="info" />
            </StaggerItem>
            <StaggerItem>
              <KPICard label="Cash Collected" value={formatPaiseToINRShort(Number(p.cashAmount))} icon={<Banknote className="h-5 w-5" />} variant="success" />
            </StaggerItem>
            <StaggerItem>
              <KPICard label="Outstanding Assigned" value={formatPaiseToINRShort(Number(p.outstandingAssigned))} icon={<Wallet className="h-5 w-5" />} variant="warning" />
            </StaggerItem>
          </StaggerContainer>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <FadeIn><Card className="shadow-premium border-info/15"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PTP Created</p><p className="text-2xl font-bold tabular-nums mt-1">{p.ptpCreated}</p></CardContent></Card></FadeIn>
            <FadeIn delay={0.05}><Card className="shadow-premium border-success/15"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PTP Fulfilled</p><p className="text-2xl font-bold tabular-nums mt-1 text-success">{p.ptpFulfilled}</p></CardContent></Card></FadeIn>
            <FadeIn delay={0.1}><Card className="shadow-premium border-destructive/15"><CardContent className="p-4"><p className="text-xs text-muted-foreground">PTP Broken</p><p className="text-2xl font-bold tabular-nums mt-1 text-destructive">{p.ptpBroken}</p><p className="text-[11px] text-muted-foreground mt-1">Fulfillment rate: <span className="font-semibold text-success">{p.ptpFulfillmentRate}%</span></p></CardContent></Card></FadeIn>
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:gap-6">
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
      </div>
    </div>
  )
}
