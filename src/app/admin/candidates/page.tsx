'use client'

import * as React from 'react'
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
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
  email?: string | null
  occupation?: string | null
  employer?: string | null
  monthlyIncome?: number | null
  status: string
  loansCount: number
  applicationsCount: number
  assignedAgent?: { id: string; name: string } | null
  createdAt: string
}

export default function CandidatesPage() {
  const [search, setSearch] = React.useState('')

  const { data, isLoading } = useQuery({
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

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
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
              <Input placeholder="Search candidate name, mobile, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
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
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {c.occupation ?? '—'} · {c.employer ?? '—'}</p>
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
                    <p className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.mobile}</p>
                    {c.email && <p className="text-muted-foreground flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" /> {c.email}</p>}
                    {c.assignedAgent && <p className="text-muted-foreground">Agent: {c.assignedAgent.name}</p>}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => toast.info(`Calling ${c.fullName}...`)}>
                      <Phone className="h-3.5 w-3.5" /> Call
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => toast.info(`Emailing ${c.email ?? c.fullName}...`)}>
                      <Mail className="h-3.5 w-3.5" /> Email
                    </Button>
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
