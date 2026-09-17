'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FileText, Search, Eye, Filter, X, Plus } from 'lucide-react'
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
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'

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

  const { data, isLoading } = useQuery({
    queryKey: ['owner-applications', search, chip],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100' })
      if (search) params.set('search', search)
      if (chip !== 'ALL') params.set('status', chip)
      return api.get<{ items: AppRow[]; total: number }>(`/api/owner/applications?${params.toString()}`)
    },
  })

  const apps = data?.items ?? []

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Applications"
        description="Review loan applications submitted via QR links or agent-assisted onboarding."
        icon={<FileText className="h-5 w-5" />}
        action={
          <Button asChild size="sm">
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
                <Input placeholder="Search application #, candidate, mobile..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Filter className="h-3 w-3" /> Quick filter:</span>
              {CHIPS.map((c) => {
                const active = chip === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => setChip(c.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium border transition-all',
                      active ? 'bg-primary text-primary-foreground border-primary shadow-glow' : 'bg-card hover:bg-muted border-border text-muted-foreground'
                    )}
                  >
                    {active && <X className="h-3 w-3" />}
                    {c.label}
                  </button>
                )
              })}
              {(chip !== 'ALL' || search) && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setChip('ALL'); setSearch('') }}>
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
        <Card className="shadow-premium hidden md:block"><CardContent className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
      ) : apps.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No applications match these filters" />
      ) : (
        <>
          <Card className="shadow-premium hidden md:block overflow-hidden">
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
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => { window.location.href = `/admin/applications/${a.id}` }}>
                    <TableCell className="pl-6 font-mono font-semibold text-primary">{a.applicationNumber}</TableCell>
                    <TableCell className="font-medium">{a.candidateName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.candidateMobile}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPaiseToINR(Number(a.principalAmount))}</TableCell>
                    <TableCell><span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{a.frequency}</span></TableCell>
                    <TableCell className="text-center tabular-nums">{a.installments}</TableCell>
                    <TableCell><StatusBadge variant={a.kycStatus ?? 'PENDING'}>{formatStatus(a.kycStatus ?? 'PENDING')}</StatusBadge></TableCell>
                    <TableCell><StatusBadge variant={a.status}>{formatStatus(a.status)}</StatusBadge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(a.submittedAt)}</TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/applications/${a.id}`}><Eye className="h-4 w-4" /> Review</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <StaggerContainer className="md:hidden space-y-3">
            {apps.map((a) => (
              <StaggerItem key={a.id}>
                <Link href={`/admin/applications/${a.id}`}>
                  <Card className="shadow-premium hover:border-primary/40 transition-all active:scale-[0.99]">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono font-semibold text-primary text-sm">{a.applicationNumber}</p>
                          <p className="text-sm font-medium mt-0.5">{a.candidateName}</p>
                          <p className="text-xs text-muted-foreground">{a.candidateMobile}</p>
                        </div>
                        <StatusBadge variant={a.status}>{formatStatus(a.status)}</StatusBadge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</p><p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(Number(a.principalAmount))}</p></div>
                        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Terms</p><p className="text-sm">{a.frequency} · {a.installments} inst.</p></div>
                        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">KYC</p><StatusBadge variant={a.kycStatus ?? 'PENDING'}>{formatStatus(a.kycStatus ?? 'PENDING')}</StatusBadge></div>
                        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Submitted</p><p className="text-sm">{fmtDate(a.submittedAt)}</p></div>
                      </div>
                      <div className="flex items-center justify-end gap-1 text-xs text-primary font-medium pt-2 border-t border-border">
                        Review <Eye className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </>
      )}
    </div>
  )
}
