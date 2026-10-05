'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LifeBuoy, Search, Eye, CheckCircle2, Filter, X, AlertTriangle, RefreshCw } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type ChipKey = 'ALL' | 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
]

interface SupportTicket {
  id: string
  ticketNumber: string
  category: string
  subject: string
  description: string
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
  resolution: string | null
  candidate: { id: string; fullName: string; mobile: string }
  createdAt: string
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

export default function SupportPage() {
  const queryClient = useQueryClient()
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [search, setSearch] = React.useState('')
  const [viewTicket, setViewTicket] = React.useState<SupportTicket | null>(null)
  const [resolveTicket, setResolveTicket] = React.useState<SupportTicket | null>(null)
  const [resolution, setResolution] = React.useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-support'],
    queryFn: () => api.get<{ items: SupportTicket[]; total: number }>('/api/owner/support?pageSize=100'),
  })

  const allTickets = data?.items ?? []

  const filtered = allTickets.filter((t) => {
    if (chip !== 'ALL' && t.status !== chip) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return t.ticketNumber.toLowerCase().includes(q)
        || t.subject.toLowerCase().includes(q)
        || t.category.toLowerCase().includes(q)
        || t.candidate.fullName.toLowerCase().includes(q)
        || t.candidate.mobile.toLowerCase().includes(q)
    }
    return true
  })

  const resolveMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/owner/support/${resolveTicket!.id}/resolve`, {
        resolution: resolution.trim() ? resolution.trim() : undefined,
      }),
    onSuccess: () => {
      toast.success('Ticket resolved', { description: `${resolveTicket?.ticketNumber} marked RESOLVED.` })
      queryClient.invalidateQueries({ queryKey: ['owner-support'] })
      setResolveTicket(null); setResolution('')
    },
    onError: (e: Error) => toast.error('Failed to resolve ticket', { description: e.message }),
  })

  const submitResolve = () => {
    if (!resolveTicket) return
    if (resolution.trim().length === 1) {
      toast.error('Resolution note must be at least 2 characters')
      return
    }
    resolveMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Support Tickets"
        description="Manage candidate support requests across repayment, KYC, disbursement, and more."
        icon={<LifeBuoy className="h-5 w-5" />}
      />

      {/* KPI strip */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Open Tickets</p><p className="text-2xl font-bold tabular-nums text-info">{allTickets.filter((t) => t.status === 'OPEN').length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">In Review</p><p className="text-2xl font-bold tabular-nums text-warning">{allTickets.filter((t) => t.status === 'IN_REVIEW').length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Resolved</p><p className="text-2xl font-bold tabular-nums text-success">{allTickets.filter((t) => t.status === 'RESOLVED').length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold tabular-nums">{allTickets.length}</p></CardContent></Card></StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search ticket #, candidate, subject, category..."
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
              <p className="font-semibold text-sm">Failed to load support tickets</p>
              <p className="text-xs text-muted-foreground mt-0.5">Please check your connection and try again.</p>
            </div>
            <Button variant="outline" size="sm" className="h-11" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="No tickets match these filters" description="Try adjusting your search or filters." />
      ) : (
        <FadeIn>
          <Card className="shadow-premium">
            <CardHeader className="pb-2"><CardTitle className="text-base">Tickets</CardTitle><CardDescription>{filtered.length} shown</CardDescription></CardHeader>
            <CardContent>
              <div className="hidden md:block overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">Ticket #</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resolution</TableHead>
                      <TableHead className="text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="pl-6 font-mono text-xs font-semibold text-primary">{t.ticketNumber}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{t.candidate.fullName}</p>
                          <p className="text-xs text-muted-foreground">{t.candidate.mobile}</p>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{t.category}</span>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{t.subject}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtTimestamp(t.createdAt)}</TableCell>
                        <TableCell><StatusBadge variant={t.status}>{formatStatus(t.status)}</StatusBadge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{t.resolution || '—'}</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex gap-1 justify-end items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0"
                              aria-label={`View ticket ${t.ticketNumber}`}
                              onClick={() => setViewTicket(t)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(t.status === 'OPEN' || t.status === 'IN_REVIEW') && (
                              <Button size="sm" className="h-9" onClick={() => { setResolveTicket(t); setResolution(t.resolution ?? '') }}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <StaggerContainer className="md:hidden space-y-3">
                {filtered.map((t) => (
                  <StaggerItem key={t.id}>
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs text-primary font-semibold">{t.ticketNumber}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.candidate.fullName} · {t.candidate.mobile}</p>
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium mt-1">{t.category}</span>
                        </div>
                        <StatusBadge variant={t.status}>{formatStatus(t.status)}</StatusBadge>
                      </div>
                      <p className="text-sm font-medium mt-2">{t.subject}</p>
                      {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1.5">{fmtTimestamp(t.createdAt)}{t.resolution ? ` · ${t.resolution}` : ''}</p>
                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" className="h-11 flex-1" onClick={() => setViewTicket(t)}>
                          <Eye className="h-3.5 w-3.5" /> Details
                        </Button>
                        {(t.status === 'OPEN' || t.status === 'IN_REVIEW') && (
                          <Button size="sm" className="h-11 flex-1" onClick={() => { setResolveTicket(t); setResolution(t.resolution ?? '') }}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* View Ticket Details Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={(o) => !o && setViewTicket(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{viewTicket?.ticketNumber}</span>
              {viewTicket && <StatusBadge variant={viewTicket.status}>{formatStatus(viewTicket.status)}</StatusBadge>}
            </DialogTitle>
            <DialogDescription>
              Submitted by {viewTicket?.candidate.fullName} ({viewTicket?.candidate.mobile}) · {viewTicket ? fmtTimestamp(viewTicket.createdAt) : ''}
            </DialogDescription>
          </DialogHeader>
          {viewTicket && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Category &amp; Subject</p>
                <p className="font-semibold mt-0.5">[{viewTicket.category}] {viewTicket.subject}</p>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-xs sm:text-sm whitespace-pre-wrap">{viewTicket.description || 'No description provided.'}</p>
              </div>
              {viewTicket.resolution && (
                <div className="rounded-lg bg-success/10 border border-success/20 p-3">
                  <p className="text-xs font-semibold text-success mb-1">Resolution Notes</p>
                  <p className="text-xs sm:text-sm whitespace-pre-wrap">{viewTicket.resolution}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={() => setViewTicket(null)}>Close</Button>
            {viewTicket && (viewTicket.status === 'OPEN' || viewTicket.status === 'IN_REVIEW') && (
              <Button
                className="h-11"
                onClick={() => {
                  const t = viewTicket
                  setViewTicket(null)
                  setResolveTicket(t)
                  setResolution(t.resolution ?? '')
                }}
              >
                <CheckCircle2 className="h-4 w-4" /> Resolve Ticket
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Ticket Dialog */}
      <Dialog open={!!resolveTicket} onOpenChange={(o) => { if (!o) { setResolveTicket(null); setResolution('') } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve {resolveTicket?.ticketNumber}</DialogTitle>
            <DialogDescription>Add resolution notes for this support ticket.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="resolution">Resolution notes</Label>
              <Textarea
                id="resolution"
                rows={4}
                className="mt-1 text-base sm:text-sm"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Describe how this ticket was resolved (optional, min 2 chars)"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={() => { setResolveTicket(null); setResolution('') }}>Cancel</Button>
            <Button className="h-11" onClick={submitResolve} disabled={resolveMutation.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
