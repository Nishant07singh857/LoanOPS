'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Inbox, Search, Eye, Filter, X, AlertTriangle, RefreshCw, PhoneCall, CheckCircle2, RotateCcw } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type EnquiryStatus = 'NEW' | 'CONTACTED' | 'CLOSED'
type ChipKey = 'ALL' | EnquiryStatus

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'NEW', label: 'New' },
  { key: 'CONTACTED', label: 'Contacted' },
  { key: 'CLOSED', label: 'Closed' },
]

interface Enquiry {
  id: string
  name: string
  mobile: string
  email: string | null
  businessName: string
  message: string
  status: EnquiryStatus
  createdAt: string
  updatedAt: string
}

function fmtTimestamp(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function EnquiriesPage() {
  const queryClient = useQueryClient()
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [search, setSearch] = React.useState('')
  const [viewEnquiry, setViewEnquiry] = React.useState<Enquiry | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-enquiries'],
    queryFn: () => api.get<{ items: Enquiry[]; total: number }>('/api/owner/enquiries?pageSize=100'),
  })

  const allEnquiries = data?.items ?? []

  const filtered = allEnquiries.filter((e) => {
    if (chip !== 'ALL' && e.status !== chip) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return e.name.toLowerCase().includes(q)
        || e.businessName.toLowerCase().includes(q)
        || e.mobile.includes(q)
        || (e.email ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnquiryStatus }) =>
      api.patch(`/api/owner/enquiries/${id}`, { status }),
    onSuccess: (_data, variables) => {
      toast.success('Enquiry updated', { description: `Marked as ${formatStatus(variables.status)}.` })
      queryClient.invalidateQueries({ queryKey: ['owner-enquiries'] })
      setViewEnquiry((cur) => (cur && cur.id === variables.id ? { ...cur, status: variables.status } : cur))
    },
    onError: (e: Error) => toast.error('Failed to update enquiry', { description: e.message }),
  })

  const nextActions = (e: Enquiry): { status: EnquiryStatus; label: string; icon: React.ReactNode }[] => {
    if (e.status === 'NEW') {
      return [
        { status: 'CONTACTED', label: 'Mark Contacted', icon: <PhoneCall className="h-3.5 w-3.5" /> },
        { status: 'CLOSED', label: 'Close', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
      ]
    }
    if (e.status === 'CONTACTED') {
      return [
        { status: 'CLOSED', label: 'Close', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
        { status: 'NEW', label: 'Reopen', icon: <RotateCcw className="h-3.5 w-3.5" /> },
      ]
    }
    return [{ status: 'NEW', label: 'Reopen', icon: <RotateCcw className="h-3.5 w-3.5" /> }]
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Website Enquiries"
        description="Leads submitted through the public homepage enquiry form. New enquiries also arrive as in-app notifications."
        icon={<Inbox className="h-5 w-5" />}
      />

      {/* KPI strip — skeleton figures while the first fetch is in flight. */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">New</p>{isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl font-bold tabular-nums text-info">{allEnquiries.filter((e) => e.status === 'NEW').length}</p>}</CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Contacted</p>{isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl font-bold tabular-nums text-warning">{allEnquiries.filter((e) => e.status === 'CONTACTED').length}</p>}</CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Closed</p>{isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl font-bold tabular-nums text-success">{allEnquiries.filter((e) => e.status === 'CLOSED').length}</p>}</CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p>{isLoading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl font-bold tabular-nums">{allEnquiries.length}</p>}</CardContent></Card></StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, business, mobile, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Filter className="h-3 w-3" /> Filter:</span>
              {CHIPS.map((c) => {
                const active = chip === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => setChip(c.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-full text-xs font-medium border transition-all',
                      active ? 'bg-primary text-primary-foreground border-primary shadow-glow' : 'bg-card hover:bg-muted border-border text-muted-foreground'
                    )}
                  >
                    {active && <X className="h-3 w-3" />}
                    {c.label}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {isLoading ? (
        <Card className="shadow-premium"><CardContent className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
      ) : isError ? (
        <Card className="shadow-premium border-destructive/40">
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-semibold text-sm">Failed to load enquiries</p>
              <p className="text-xs text-muted-foreground mt-0.5">Please check your connection and try again.</p>
            </div>
            <Button variant="outline" size="sm" className="h-11" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />} title="No enquiries match these filters" description="New homepage enquiries will appear here as they arrive." />
      ) : (
        <FadeIn>
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Enquiries</CardTitle><CardDescription>{filtered.length} shown</CardDescription></CardHeader>
            <CardContent>
              <div className="hidden md:block overflow-x-auto table-scroll w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">Name</TableHead>
                      <TableHead>Business</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="pl-6">
                          <p className="font-medium text-sm">{e.name}</p>
                          {e.email && <p className="text-xs text-muted-foreground">{e.email}</p>}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{e.businessName}</TableCell>
                        <TableCell className="font-mono text-xs">{e.mobile}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtTimestamp(e.createdAt)}</TableCell>
                        <TableCell><StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge></TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex gap-1 justify-end items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0"
                              aria-label={`View enquiry from ${e.name}`}
                              onClick={() => setViewEnquiry(e)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {nextActions(e).map((a) => (
                              <Button
                                key={a.status}
                                size="sm"
                                variant={a.status === 'NEW' ? 'outline' : 'default'}
                                className="h-9"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: e.id, status: a.status })}
                              >
                                {a.icon} {a.label}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <StaggerContainer className="md:hidden space-y-3">
                {filtered.map((e) => (
                  <StaggerItem key={e.id}>
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{e.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{e.businessName} · {e.mobile}</p>
                        </div>
                        <StatusBadge variant={e.status}>{formatStatus(e.status)}</StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{e.message}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{fmtTimestamp(e.createdAt)}</p>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <Button variant="outline" size="sm" className="h-11 flex-1" onClick={() => setViewEnquiry(e)}>
                          <Eye className="h-3.5 w-3.5" /> Details
                        </Button>
                        {nextActions(e).map((a) => (
                          <Button
                            key={a.status}
                            size="sm"
                            variant={a.status === 'NEW' ? 'outline' : 'default'}
                            className="h-11 flex-1"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: e.id, status: a.status })}
                          >
                            {a.icon} {a.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* View Enquiry Details Dialog */}
      <Dialog open={!!viewEnquiry} onOpenChange={(o) => !o && setViewEnquiry(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{viewEnquiry?.name}</span>
              {viewEnquiry && <StatusBadge variant={viewEnquiry.status}>{formatStatus(viewEnquiry.status)}</StatusBadge>}
            </DialogTitle>
            <DialogDescription>
              {viewEnquiry?.businessName} · Received {viewEnquiry ? fmtTimestamp(viewEnquiry.createdAt) : ''}
            </DialogDescription>
          </DialogHeader>
          {viewEnquiry && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Mobile</p>
                  <p className="font-mono text-sm mt-0.5">{viewEnquiry.mobile}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm mt-0.5">{viewEnquiry.email || '—'}</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">Message</p>
                <p className="text-xs sm:text-sm whitespace-pre-wrap">{viewEnquiry.message}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={() => setViewEnquiry(null)}>Close</Button>
            {viewEnquiry && nextActions(viewEnquiry).map((a) => (
              <Button
                key={a.status}
                className="h-11"
                variant={a.status === 'NEW' ? 'outline' : 'default'}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: viewEnquiry.id, status: a.status })}
              >
                {a.icon} {a.label}
              </Button>
            ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
