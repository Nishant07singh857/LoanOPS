'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Search, Eye, Filter, X, Plus, MoreVertical, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type ChipKey = 'ALL' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'INFORMATION_REQUESTED'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'INFORMATION_REQUESTED', label: 'Info Requested' },
]

interface AppRow {
  id: string
  applicationNumber: string
  candidateName: string
  candidateMobile: string
  principalAmount: string
  frequency: string
  installments: number
  status: string
  kycStatus?: string | null
  submittedAt?: string | null
}

function fmtDate(date?: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ApplicationsPage() {
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [search, chip])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-applications', search, chip, page],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100', page: String(page) })
      if (search) params.set('search', search)
      if (chip !== 'ALL') params.set('status', chip)
      return api.get<{ items: AppRow[]; total: number }>(`/api/owner/applications?${params.toString()}`)
    },
  })

  const apps = data?.items ?? []
  const router = useRouter()
  const queryClient = useQueryClient()

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' | 'DELETE' }) => {
      if (action === 'DELETE') {
        return api.delete(`/api/owner/applications/${id}`)
      } else if (action === 'APPROVE') {
        return api.post(`/api/owner/applications/${id}/approve`, { reviewNotes: 'Directly approved' })
      } else if (action === 'REJECT') {
        return api.post(`/api/owner/applications/${id}/reject`, { rejectionReason: 'Directly rejected' })
      }
    },
    onSuccess: (_, { action }) => {
      const verb = action === 'REJECT' ? 'rejected' : action === 'APPROVE' ? 'approved' : 'deleted'
      toast.success(`Application ${verb} successfully`)
      queryClient.invalidateQueries({ queryKey: ['owner-applications'] })
      queryClient.invalidateQueries({ queryKey: ['owner-loans'] })
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard'] })
    },
    onError: (err) => {
      toast.error('Action failed', { description: err.message })
    }
  })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Applications"
        description="Review loan applications submitted via QR links or agent-assisted onboarding."
        icon={<FileText className="h-5 w-5" />}
        action={
          <Button asChild size="sm" className="min-h-[44px] sm:min-h-8">
            <Link href="/admin/create-loan"><Plus className="h-4 w-4" /> Create Loan</Link>
          </Button>
        }
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Search applications"
                  placeholder="Search application #, candidate, mobile..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 min-h-[44px] sm:min-h-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Filter className="h-3 w-3" /> Quick filter:</span>
              {CHIPS.map((c) => {
                const active = chip === c.key
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setChip(c.key)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 min-h-[44px] sm:min-h-7 sm:h-7 rounded-full text-xs font-medium border transition-all',
                      active ? 'bg-primary text-primary-foreground border-primary shadow-glow' : 'bg-card hover:bg-muted border-border text-muted-foreground'
                    )}
                  >
                    {active && <X className="h-3 w-3" />}
                    {c.label}
                  </button>
                )
              })}
              {(chip !== 'ALL' || search) && (
                <Button variant="ghost" size="sm" className="min-h-[44px] sm:min-h-7 sm:h-7 text-xs" onClick={() => { setChip('ALL'); setSearch('') }}>
                  Clear all
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading…' : <>Showing <span className="font-semibold text-foreground">{apps.length}</span> applications</>}
        </p>
      </div>

      {isLoading ? (
        <StaggerContainer className="space-y-3" role="status" aria-label="Loading applications">
          {Array.from({ length: 5 }).map((_, i) => (
            <StaggerItem key={i}>
              <Card><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      ) : isError ? (
        <Card className="border-destructive/40 bg-destructive/5 shadow-premium">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-destructive">Failed to load applications</p>
              <p className="text-xs text-muted-foreground mt-0.5">Could not fetch application records. Please try again.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="min-h-[44px] sm:min-h-8">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : apps.length === 0 ? (
        <FadeIn>
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No applications found"
            description={search ? 'Try adjusting your search or filters.' : 'No loan applications have been submitted yet.'}
          />
        </FadeIn>
      ) : (
        <>
          <Card className="shadow-premium hidden md:block overflow-hidden">
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-6">App No.</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead className="text-center">Inst.</TableHead>
                    <TableHead>KYC</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => { router.push(`/admin/applications/${a.id}`) }}>
                      <TableCell className="pl-6 font-mono font-semibold text-primary">{a.applicationNumber}</TableCell>
                      <TableCell className="font-medium">{a.candidateName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.candidateMobile}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(a.principalAmount))}</TableCell>
                      <TableCell><span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{a.frequency}</span></TableCell>
                      <TableCell className="text-center tabular-nums">{a.installments}</TableCell>
                      <TableCell><StatusBadge variant={a.kycStatus ?? 'PENDING'}>{formatStatus(a.kycStatus ?? 'PENDING')}</StatusBadge></TableCell>
                      <TableCell><StatusBadge variant={a.status}>{formatStatus(a.status)}</StatusBadge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(a.submittedAt)}</TableCell>
                      <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for application ${a.applicationNumber}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/admin/applications/${a.id}`)}>
                              <Eye className="mr-2 h-4 w-4" /> Review
                            </DropdownMenuItem>
                            {(a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW') && (
                              <>
                                <DropdownMenuItem onClick={() => actionMutation.mutate({ id: a.id, action: 'APPROVE' })}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-success" /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => actionMutation.mutate({ id: a.id, action: 'REJECT' })}>
                                  <XCircle className="mr-2 h-4 w-4 text-destructive" /> Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => {
                              if(window.confirm('Are you sure you want to delete this application?')) {
                                actionMutation.mutate({ id: a.id, action: 'DELETE' })
                              }
                            }}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <StaggerContainer className="md:hidden space-y-3">
            {apps.map((a) => (
              <StaggerItem key={a.id}>
                <Card className="shadow-premium hover:border-primary/40 transition-all cursor-pointer active:scale-[0.99]" onClick={() => router.push(`/admin/applications/${a.id}`)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-primary text-sm truncate">{a.applicationNumber}</p>
                        <p className="text-sm font-medium mt-0.5 truncate">{a.candidateName}</p>
                        <p className="text-xs text-muted-foreground">{a.candidateMobile}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0" aria-label={`Actions for application ${a.applicationNumber}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/admin/applications/${a.id}`)}>
                              <Eye className="mr-2 h-4 w-4" /> Review
                            </DropdownMenuItem>
                            {(a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW') && (
                              <>
                                <DropdownMenuItem onClick={() => actionMutation.mutate({ id: a.id, action: 'APPROVE' })}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-success" /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => actionMutation.mutate({ id: a.id, action: 'REJECT' })}>
                                  <XCircle className="mr-2 h-4 w-4 text-destructive" /> Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => {
                              if(window.confirm('Are you sure you want to delete this application?')) {
                                actionMutation.mutate({ id: a.id, action: 'DELETE' })
                              }
                            }}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <StatusBadge variant={a.status}>{formatStatus(a.status)}</StatusBadge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(a.principalAmount))}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Terms</p><p className="text-sm">{a.frequency} · {a.installments} inst.</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">KYC</p><StatusBadge variant={a.kycStatus ?? 'PENDING'}>{formatStatus(a.kycStatus ?? 'PENDING')}</StatusBadge></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Submitted</p><p className="text-sm">{fmtDate(a.submittedAt)}</p></div>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
          <PaginationControls page={page} pageSize={100} total={data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
 
