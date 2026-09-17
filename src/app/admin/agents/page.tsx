'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { UserCog, ArrowUpDown, Target, CheckCircle2, XCircle, Phone, ChevronRight } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

interface AgentRow {
  id: string
  userId: string
  name: string
  email: string
  phone?: string | null
  employeeCode?: string | null
  zone?: string | null
  isActive: boolean
  tasksAssigned: number
  tasksCompleted: number
  followUps: number
  ptpCreated: number
  ptpFulfilled: number
  ptpBroken: number
  collectionAmount: string
  outstandingAssigned: string
  assignedCandidatesCount: number
  successRate: number
}

type SortKey = 'name' | 'tasksCompleted' | 'collectionAmount' | 'successRate' | 'ptpFulfilled'

export default function AgentsPage() {
  const [sortKey, setSortKey] = React.useState<SortKey>('collectionAmount')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = React.useState<AgentRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['owner-agents'],
    queryFn: () => api.get<{ items: AgentRow[] }>('/api/owner/agents'),
  })

  const agents = data?.items ?? []

  const sorted = [...agents].sort((a, b) => {
    const av = a[sortKey] as number | string
    const bv = b[sortKey] as number | string
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const totalCollection = agents.reduce((s, a) => s + Number(a.collectionAmount), 0)
  const avgSuccess = agents.length ? agents.reduce((s, a) => s + a.successRate, 0) / agents.length : 0
  const totalPtpFulfilled = agents.reduce((s, a) => s + a.ptpFulfilled, 0)
  const totalPtpCreated = agents.reduce((s, a) => s + a.ptpCreated, 0)
  const ptpFulfillmentPct = totalPtpCreated > 0 ? Math.round((totalPtpFulfilled / totalPtpCreated) * 100) : 0

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Agent Performance"
        description="Track collection efficiency, PTP fulfillment, and zone-wise workload."
        icon={<UserCog className="h-5 w-5" />}
      />

      {/* Summary strip */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Agents</p>
            <p className="text-2xl font-bold tabular-nums">{agents.length}</p>
          </CardContent></Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Collected</p>
            <p className="text-2xl font-bold tabular-nums text-success">{formatPaiseToINRShort(totalCollection)}</p>
          </CardContent></Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avg Success Rate</p>
            <p className="text-2xl font-bold tabular-nums">{avgSuccess.toFixed(1)}%</p>
          </CardContent></Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="shadow-premium"><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">PTP Fulfillment</p>
            <p className="text-2xl font-bold tabular-nums">{ptpFulfillmentPct}%</p>
          </CardContent></Card>
        </StaggerItem>
      </StaggerContainer>

      {/* Table */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2"><CardTitle className="text-base">Agents</CardTitle><CardDescription>Click an agent to view detailed breakdown</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : agents.length === 0 ? (
              <EmptyState icon={<UserCog className="h-6 w-6" />} title="No agents found" description="No agent profiles exist for this organization." />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-6">
                          <SortBtn label="Agent" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                        </TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead className="text-center">
                          <SortBtn label="Tasks" active={sortKey === 'tasksCompleted'} dir={sortDir} onClick={() => toggleSort('tasksCompleted')} />
                        </TableHead>
                        <TableHead className="text-center">Follow-ups</TableHead>
                        <TableHead className="text-center">PTP</TableHead>
                        <TableHead className="text-center">
                          <SortBtn label="Fulfilled" active={sortKey === 'ptpFulfilled'} dir={sortDir} onClick={() => toggleSort('ptpFulfilled')} />
                        </TableHead>
                        <TableHead className="text-right">
                          <SortBtn label="Collected" active={sortKey === 'collectionAmount'} dir={sortDir} onClick={() => toggleSort('collectionAmount')} />
                        </TableHead>
                        <TableHead className="text-center">
                          <SortBtn label="Success" active={sortKey === 'successRate'} dir={sortDir} onClick={() => toggleSort('successRate')} />
                        </TableHead>
                        <TableHead className="text-center">Trend</TableHead>
                        <TableHead className="pr-6"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((a) => (
                        <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelected(a)}>
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{a.name.split(' ').map(p => p[0]).join('')}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{a.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{a.zone ?? '—'}</TableCell>
                          <TableCell className="text-center tabular-nums">{a.tasksCompleted}/{a.tasksAssigned}</TableCell>
                          <TableCell className="text-center tabular-nums">{a.followUps}</TableCell>
                          <TableCell className="text-center tabular-nums">{a.ptpCreated}</TableCell>
                          <TableCell className="text-center tabular-nums text-success">{a.ptpFulfilled}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(Number(a.collectionAmount))}</TableCell>
                          <TableCell className="text-center">
                            <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                              a.successRate >= 90 ? 'bg-success/15 text-success' : a.successRate >= 75 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive')}>
                              {a.successRate}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Sparkline data={Array.from({ length: 8 }, (_, i) => Math.sin(i + a.successRate / 10) * 10 + a.successRate)} className={a.successRate >= 90 ? 'stroke-success' : 'stroke-warning'} />
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <Button variant="ghost" size="sm"><ChevronRight className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <StaggerContainer className="md:hidden space-y-3">
                  {sorted.map((a) => (
                    <StaggerItem key={a.id}>
                      <button onClick={() => setSelected(a)} className="w-full text-left">
                        <Card className="shadow-premium hover:border-primary/40 active:scale-[0.99] transition-all">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{a.name.split(' ').map(p => p[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-semibold">{a.name}</p>
                                  <p className="text-xs text-muted-foreground">{a.zone ?? '—'}</p>
                                </div>
                              </div>
                              <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                                a.successRate >= 90 ? 'bg-success/15 text-success' : a.successRate >= 75 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive')}>
                                {a.successRate}%
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border text-center">
                              <div><p className="text-[10px] text-muted-foreground">Tasks</p><p className="text-sm font-semibold">{a.tasksCompleted}/{a.tasksAssigned}</p></div>
                              <div><p className="text-[10px] text-muted-foreground">PTP</p><p className="text-sm font-semibold">{a.ptpFulfilled}/{a.ptpCreated}</p></div>
                              <div><p className="text-[10px] text-muted-foreground">Collected</p><p className="text-sm font-semibold">{formatPaiseToINRShort(Number(a.collectionAmount))}</p></div>
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{selected.name.split(' ').map(p => p[0]).join('')}</AvatarFallback>
                  </Avatar>
                  {selected.name}
                </SheetTitle>
                <SheetDescription>{selected.zone ?? '—'} zone · {selected.tasksCompleted}/{selected.tasksAssigned} tasks completed</SheetDescription>
              </SheetHeader>

              <div className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Success Rate" value={`${selected.successRate}%`} tint={selected.successRate >= 90 ? 'text-success' : 'text-warning'} />
                  <Stat label="Collected" value={formatPaiseToINR(Number(selected.collectionAmount))} tint="text-success" />
                  <Stat label="Outstanding Assigned" value={formatPaiseToINR(Number(selected.outstandingAssigned))} tint="text-info" />
                  <Stat label="Follow-ups Done" value={String(selected.followUps)} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">PTP Performance</p>
                  <div className="rounded-xl border border-border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm"><Target className="h-3.5 w-3.5" /> Created</span>
                      <span className="font-medium tabular-nums">{selected.ptpCreated}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Fulfilled</span>
                      <span className="font-medium tabular-nums text-success">{selected.ptpFulfilled}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm text-destructive"><XCircle className="h-3.5 w-3.5" /> Broken</span>
                      <span className="font-medium tabular-nums text-destructive">{selected.ptpBroken}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-sm font-medium">Fulfillment Rate</span>
                      <span className="font-bold tabular-nums text-primary">{Math.round(selected.ptpFulfilled / Math.max(1, selected.ptpCreated) * 100)}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contact</p>
                  <div className="rounded-xl border border-border p-3 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Email: </span>{selected.email}</p>
                    <p><span className="text-muted-foreground">Phone: </span>{selected.phone ?? '—'}</p>
                    <p><span className="text-muted-foreground">Code: </span>{selected.employeeCode ?? '—'}</p>
                  </div>
                </div>
              </div>

              <SheetFooter>
                <Button className="w-full" onClick={() => toast.success(`Calling ${selected.name}...`)}>
                  <Phone className="h-4 w-4" /> Call Agent
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SortBtn({ label, active, dir, onClick }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('inline-flex items-center gap-1 hover:text-foreground transition-colors', active ? 'text-primary' : 'text-muted-foreground')}>
      {label}
      <ArrowUpDown className={cn('h-3 w-3', active && 'text-primary')} />
      {active && <span className="text-[10px]">{dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  )
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-base font-bold tabular-nums mt-1', tint)}>{value}</p>
    </div>
  )
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const w = 60, h = 20
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('w-16 h-5 fill-none', className)} preserveAspectRatio="none">
      <polyline points={points} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
