'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Users, Search, Phone, Mail, MapPin, Eye } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { api } from '@/lib/api-client'

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
  email?: string | null
  occupation?: string | null
  employer?: string | null
  monthlyIncome?: number | null
  aadhaarMasked?: string | null
  panMasked?: string | null
  bankAccount?: string | null
  status: string
  loansCount: number
  applicationsCount: number
  assignedAgent?: { id: string; name: string } | null
  createdAt: string
}

function maskAadhaar(val?: string | null) {
  if (!val) return null
  const clean = val.replace(/\s|-/g, '')
  if (clean.length < 4) return 'XXXX-XXXX'
  return `XXXX-XXXX-${clean.slice(-4)}`
}

function maskPan(val?: string | null) {
  if (!val) return null
  const clean = val.trim().toUpperCase()
  if (clean.length >= 10) return `${clean.slice(0, 5)}****${clean.slice(-1)}`
  if (clean.length > 4) return `••••${clean.slice(-4)}`
  return '••••••••••'
}

function maskBankAccount(val?: string | null) {
  if (!val) return null
  const clean = val.trim()
  if (clean.length <= 4) return `••••••${clean}`
  return `••••••${clean.slice(-4)}`
}

function CandidatesPageInner() {
  const searchParams = useSearchParams()
  const [search, setSearch] = React.useState(() => searchParams.get('q') ?? '')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-candidates', search],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100' })
      if (search) params.set('search', search)
      return api.get<{ items: CandidateRow[]; total: number }>(`/api/owner/candidates?${params.toString()}`)
    },
  })

  const candidates = data?.items ?? []

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Candidates"
        description="All candidates across the platform — borrowers with active, pending, or closed loans."
        icon={<Users className="h-5 w-5" />}
      />

      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Candidates</p><p className="text-2xl font-bold tabular-nums">{candidates.length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">With Loans</p><p className="text-2xl font-bold tabular-nums text-success">{candidates.filter((c) => c.loansCount > 0).length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">With Applications</p><p className="text-2xl font-bold tabular-nums text-warning">{candidates.filter((c) => c.applicationsCount > 0).length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active</p><p className="text-2xl font-bold tabular-nums text-success">{candidates.filter((c) => c.status === 'ACTIVE').length}</p></CardContent></Card></StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search candidates"
                placeholder="Search candidate name, mobile, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 min-h-[44px] sm:min-h-9"
              />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="Loading candidates">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : isError ? (
        <Card className="border-destructive/40 bg-destructive/5 shadow-premium">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-destructive">Failed to load candidates</p>
              <p className="text-xs text-muted-foreground mt-0.5">Could not fetch candidate directory. Please try again.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="min-h-[44px] sm:min-h-8">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : candidates.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No candidates found" description="Try adjusting your search." />
      ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {candidates.map((c) => (
            <StaggerItem key={c.id}>
              <Card className="shadow-premium hover:border-primary/40 hover:shadow-glow transition-all h-full">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="h-11 w-11 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">{c.fullName.split(' ').map(p => p[0]).join('').slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{c.fullName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><MapPin className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{c.occupation ?? '—'} · {c.employer ?? '—'}</span></p>
                      </div>
                    </div>
                    <StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loans</p>
                      <p className="text-sm font-semibold">{c.loansCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Applications</p>
                      <p className="text-sm font-semibold">{c.applicationsCount}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3 flex-shrink-0" /> {c.mobile}</p>
                    {c.email && <p className="text-muted-foreground flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{c.email}</span></p>}
                    {c.assignedAgent && <p className="text-muted-foreground">Agent: {c.assignedAgent.name}</p>}
                    {(c.aadhaarMasked || c.panMasked || c.bankAccount) && (
                      <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px] text-muted-foreground">
                        {c.aadhaarMasked && <span>Aadhaar: {maskAadhaar(c.aadhaarMasked)}</span>}
                        {c.panMasked && <span>PAN: {maskPan(c.panMasked)}</span>}
                        {c.bankAccount && <span>A/C: {maskBankAccount(c.bankAccount)}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button asChild variant="outline" size="sm" className="flex-1 min-h-[44px] sm:min-h-8" aria-label={`Call ${c.fullName}`}>
                      <a href={`tel:${c.mobile.replace(/\s/g, '')}`}>
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                    </Button>
                    {c.email ? (
                      <Button asChild variant="ghost" size="sm" className="flex-1 min-h-[44px] sm:min-h-8" aria-label={`Email ${c.fullName}`}>
                        <a href={`mailto:${c.email}`}>
                          <Mail className="h-3.5 w-3.5" /> Email
                        </a>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="flex-1 min-h-[44px] sm:min-h-8" aria-label={`Email ${c.fullName}`} disabled>
                        <Mail className="h-3.5 w-3.5" /> No email
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </div>
  )
}

export default function CandidatesPage() {
  return (
    <React.Suspense fallback={null}>
      <CandidatesPageInner />
    </React.Suspense>
  )
}
