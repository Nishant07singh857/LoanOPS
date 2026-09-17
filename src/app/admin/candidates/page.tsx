'use client'

import * as React from 'react'
import { Users, Search, Phone, Mail, MapPin, Landmark, Wallet, Eye } from 'lucide-react'
import Link from 'next/link'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { loans, applications } from '@/lib/mock-data'
import { formatPaiseToINR } from '@/lib/money'

interface CandidateRow {
  id: string
  name: string
  mobile: string
  email: string
  location: string
  activeLoans: number
  outstanding: number
  status: 'ACTIVE' | 'PENDING' | 'CLOSED'
}

// Synthesize candidates from loans
const candidates: CandidateRow[] = Array.from(new Set(loans.map((l) => l.candidateName))).map((name, i) => {
  const ls = loans.filter((l) => l.candidateName === name)
  const totalOutstanding = ls.reduce((s, l) => s + l.outstandingPrincipal, 0)
  const active = ls.some((l) => l.status === 'ACTIVE')
  const closed = ls.every((l) => l.status === 'CLOSED' || l.status === 'WRITTEN_OFF')
  return {
    id: `c${i + 1}`,
    name,
    mobile: ls[0]?.mobile || '+91 98200 00000',
    email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`,
    location: ['Mumbai', 'Pune', 'Nashik', 'Thane'][i % 4],
    activeLoans: ls.filter((l) => l.status === 'ACTIVE' || l.status === 'PENDING_DISBURSEMENT').length,
    outstanding: totalOutstanding,
    status: closed ? 'CLOSED' : active ? 'ACTIVE' : 'PENDING',
  }
})

export default function CandidatesPage() {
  const [search, setSearch] = React.useState('')

  const filtered = candidates.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return c.name.toLowerCase().includes(q) || c.mobile.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Candidates"
        description="All candidates across the platform — borrowers with active, pending, or closed loans."
        icon={<Users className="h-5 w-5" />}
      />

      {/* Stats */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Candidates</p><p className="text-2xl font-bold tabular-nums">{candidates.length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Loans</p><p className="text-2xl font-bold tabular-nums text-success">{candidates.filter((c) => c.status === 'ACTIVE').length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold tabular-nums text-warning">{candidates.filter((c) => c.status === 'PENDING').length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Closed</p><p className="text-2xl font-bold tabular-nums text-muted-foreground">{candidates.filter((c) => c.status === 'CLOSED').length}</p></CardContent></Card></StaggerItem>
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

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No candidates found" description="Try adjusting your search." />
      ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((c) => (
            <StaggerItem key={c.id}>
              <Card className="shadow-premium hover:border-primary/40 hover:shadow-glow transition-all h-full">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="h-11 w-11 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">{c.name.split(' ').map(p => p[0]).join('').slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {c.location}</p>
                      </div>
                    </div>
                    <StatusBadge variant={c.status}>{formatStatus(c.status)}</StatusBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</p>
                      <p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(c.outstanding)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active Loans</p>
                      <p className="text-sm font-semibold">{c.activeLoans}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.mobile}</p>
                    <p className="text-muted-foreground flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" /> {c.email}</p>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => toast.info(`Calling ${c.name}...`)}>
                      <Phone className="h-3.5 w-3.5" /> Call
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => toast.info(`Emailing ${c.email}...`)}>
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
