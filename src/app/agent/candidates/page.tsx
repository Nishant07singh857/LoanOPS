'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Users, Search, Filter, X, MessageCircle, PhoneCall, ChevronRight,
  Calendar, Clock,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINRShort } from '@/lib/money'
import { openWhatsApp, buildWhatsAppMessage, WHATSAPP_TEMPLATES } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

type ChipKey = 'ALL' | 'OVERDUE' | 'HAS_PTP' | 'RISK'

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'HAS_PTP', label: 'Has PTP' },
  { key: 'RISK', label: 'High Risk' },
]

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
  email?: string | null
  status: string
  loansCount: number
  outstanding: string
  overdueInstallments: number
  activeLoanNumbers: string[]
  activePtp: { id: string; promisedAmount: string; promiseDate: string } | null
  lastContact?: string | null
  nextFollowUp?: string | null
}

function fmtDateShort(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function AgentCandidatesPage() {
  const router = useRouter()
  const [chip, setChip] = React.useState<ChipKey>('ALL')
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('q')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (q) setSearch(q)
    }
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['agent-candidates', search],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100' })
      if (search) params.set('search', search)
      return api.get<{ items: CandidateRow[]; total: number }>(`/api/agent/candidates?${params.toString()}`)
    },
  })

  const allCandidates = data?.items ?? []

  const filtered = React.useMemo(() => {
    let rows = [...allCandidates]
    if (chip === 'OVERDUE') rows = rows.filter((c) => c.overdueInstallments > 0)
    else if (chip === 'HAS_PTP') rows = rows.filter((c) => !!c.activePtp)
    else if (chip === 'RISK') rows = rows.filter((c) => c.overdueInstallments >= 2)
    return rows
  }, [allCandidates, chip])

  const onWhatsApp = (c: CandidateRow) => {
    const msg = buildWhatsAppMessage(WHATSAPP_TEMPLATES.PAYMENT_REMINDER, {
      candidateName: c.fullName,
      loanNumber: c.activeLoanNumbers[0] ?? '',
      amount: (Number(c.outstanding) / 100).toLocaleString('en-IN'),
      dueDate: fmtDateShort(c.nextFollowUp),
    })
    openWhatsApp(c.mobile, msg)
    toast.success('WhatsApp draft opened', { description: `Reminder sent to ${c.fullName}` })
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="My Candidates"
        description="Field book — your assigned candidates with outstanding balances."
        icon={<Users className="h-5 w-5" />}
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or mobile..."
                aria-label="Search candidates by name or mobile"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filter:
              </span>
              {CHIPS.map((c) => {
                const active = chip === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => setChip(c.key)}
                    aria-pressed={active}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No candidates match these filters" description="Try adjusting your search or filter." />
      ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((c) => (
            <StaggerItem key={c.id}>
              <div
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/agent/candidates/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    router.push(`/agent/candidates/${c.id}`)
                  }
                }}
                className="block h-full rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-glow transition-all group cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {initials(c.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                      {c.fullName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{c.mobile}</p>
                    {c.activeLoanNumbers[0] && (
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{c.activeLoanNumbers[0]}</p>
                    )}
                  </div>
                  {c.overdueInstallments > 0 ? (
                    <StatusBadge variant="OVERDUE">{c.overdueInstallments} inst.</StatusBadge>
                  ) : (
                    <StatusBadge variant="ACTIVE">Current</StatusBadge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</p>
                    <p className="text-sm font-bold tabular-nums">{formatPaiseToINRShort(Number(c.outstanding))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Loans</p>
                    <p className="text-sm font-semibold tabular-nums">{c.loansCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Contact</p>
                    <p className="text-xs inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" /> {fmtDateShort(c.lastContact)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">PTP</p>
                    {c.activePtp ? (
                      <span className="text-[11px] font-medium text-success">
                        {fmtDateShort(c.activePtp.promiseDate)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">None</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Next: {fmtDateShort(c.nextFollowUp)}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 text-info border-info/40 hover:bg-info/10"
                      aria-label={`WhatsApp ${c.fullName}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWhatsApp(c) }}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    <a
                      href={`tel:${c.mobile.replace(/\s/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border hover:bg-muted transition-colors"
                      aria-label={`Call ${c.fullName}`}
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                    </a>
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground group-hover:text-primary transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </div>
  )
}
