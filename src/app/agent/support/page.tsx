'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LifeBuoy, Plus, Send } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api, ApiRequestError } from '@/lib/api-client'

interface Ticket {
  id: string
  ticketNumber?: string
  category: string
  subject: string
  description?: string | null
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED'
  resolution?: string | null
  candidate?: { id?: string; fullName?: string } | null
  createdAt: string
}

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
}

const CATEGORIES = [
  'App Bug', 'Repayment', 'Cash Verification', 'Reassignment', 'PTP', 'Other',
]

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AgentSupportPage() {
  const queryClient = useQueryClient()
  const [newOpen, setNewOpen] = React.useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agent-support'],
    queryFn: () => api.get<{ items: Ticket[]; total?: number }>('/api/agent/support'),
  })
  const tickets = data?.items ?? []
  const activeCount = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_REVIEW').length

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Support"
        description="Raise a ticket with the owner team. Tickets are saved on the server and visible to the owner."
        icon={<LifeBuoy className="h-5 w-5" />}
        action={
          <Button onClick={() => setNewOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        }
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><LifeBuoy className="h-4 w-4" /> My Support Tickets</CardTitle>
            <CardDescription className="text-xs">{tickets.length} tickets · {activeCount} active</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : isError ? (
              <div className="text-center py-8">
                <p className="text-sm font-medium text-destructive">Could not load your tickets.</p>
                <p className="text-xs text-muted-foreground mt-1">Please check your connection and try again.</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : tickets.length === 0 ? (
              <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="No tickets yet" description="Tickets you raise will appear here." />
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t.id} className="rounded-xl border border-border p-3.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{t.subject}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t.ticketNumber ? `${t.ticketNumber} · ` : ''}{t.category} · {fmtDate(t.createdAt)}
                          {t.candidate?.fullName ? ` · Borrower: ${t.candidate.fullName}` : ''}
                        </p>
                      </div>
                      <StatusBadge variant={t.status}>{formatStatus(t.status)}</StatusBadge>
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{t.description}</p>}
                    {t.resolution && (
                      <p className="text-xs rounded-lg bg-success/10 border border-success/20 px-2.5 py-2">
                        <span className="font-medium">Resolution:</span> {t.resolution}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <NewTicketDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['agent-support'] })
          setNewOpen(false)
        }}
      />
    </div>
  )
}

function NewTicketDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [candidateId, setCandidateId] = React.useState('')
  const [category, setCategory] = React.useState(CATEGORIES[0])
  const [subject, setSubject] = React.useState('')
  const [description, setDescription] = React.useState('')

  const { data: candData, isLoading: candLoading, isError: candError } = useQuery({
    queryKey: ['agent-candidates', 'support-select'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
    enabled: open,
  })
  const candidates = candData?.items ?? []

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/api/agent/support', {
        candidateId,
        category,
        subject: subject.trim(),
        description: description.trim(),
      }),
    onSuccess: () => {
      toast.success('Ticket raised', { description: 'The owner team can now see and respond to this ticket.' })
      setCandidateId('')
      setSubject('')
      setDescription('')
      setCategory(CATEGORIES[0])
      onCreated()
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.message : 'Could not raise the ticket. Please try again.'
      toast.error('Ticket not raised', { description: message })
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!candidateId) return toast.error('Select the borrower this ticket is about')
    if (subject.trim().length < 3) return toast.error('Enter a subject (at least 3 characters)')
    if (description.trim().length < 5) return toast.error('Describe the issue (at least 5 characters)')
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Raise a Support Ticket</DialogTitle>
          <DialogDescription>This goes to the owner team and is linked to the selected borrower.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="ticket-candidate">Borrower</Label>
            {candError ? (
              <p className="text-xs text-destructive mt-1.5">Could not load borrowers. Close and reopen this dialog to retry.</p>
            ) : (
              <Select value={candidateId} onValueChange={setCandidateId} disabled={candLoading}>
                <SelectTrigger id="ticket-candidate" className="mt-1.5">
                  <SelectValue placeholder={candLoading ? 'Loading borrowers…' : 'Select borrower'} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName} · {c.mobile}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label htmlFor="ticket-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="ticket-category" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className="mt-1.5" placeholder="Short summary of the issue" />
          </div>
          <div>
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea id="ticket-description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} className="mt-1.5" placeholder="Describe the issue in detail…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              <Send className="h-4 w-4" /> {createMutation.isPending ? 'Raising…' : 'Raise Ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
