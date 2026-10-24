'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StickyNote, Save, Clock, User } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api, ApiRequestError } from '@/lib/api-client'

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
}

interface FollowUpRow {
  id: string
  contactDate: string
  contactMethod: string
  outcome?: string | null
  notes?: string | null
  nextFollowUp?: string | null
  candidate?: { fullName: string; mobile: string } | null
  loan?: { loanNumber: string } | null
  createdAt: string
}

function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AgentNotesPage() {
  const queryClient = useQueryClient()
  const [candidateId, setCandidateId] = React.useState('')
  const [note, setNote] = React.useState('')
  const [nextFollowUp, setNextFollowUp] = React.useState('')

  const { data: candidatesData, isError: candError } = useQuery({
    queryKey: ['agent-candidates-for-notes'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = candidatesData?.items ?? []

  const { data: followUpsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['agent-follow-ups', candidateId || 'all'],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100' })
      if (candidateId) params.set('candidateId', candidateId)
      return api.get<{ items: FollowUpRow[]; total: number }>(`/api/agent/follow-ups?${params.toString()}`)
    },
  })
  const followUps = followUpsData?.items ?? []

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post('/api/agent/follow-ups', {
        candidateId,
        contactMethod: 'IN_APP',
        outcome: 'NOTE',
        notes: note.trim(),
        ...(nextFollowUp ? { nextFollowUp: new Date(nextFollowUp).toISOString() } : {}),
      }),
    onSuccess: () => {
      toast.success('Note saved', { description: 'Saved as a follow-up on the borrower record.' })
      setNote('')
      setNextFollowUp('')
      queryClient.invalidateQueries({ queryKey: ['agent-follow-ups'] })
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiRequestError ? err.message : 'Could not save the note. Please try again.'
      toast.error('Note not saved', { description: message })
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!candidateId) return toast.error('Select the borrower this note is about')
    if (!note.trim()) return toast.error('Write the note first')
    saveMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="My Notes"
        description="Field notes saved as follow-ups on the borrower record — stored on the server, not just this device."
        icon={<StickyNote className="h-5 w-5" />}
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><StickyNote className="h-4 w-4" /> New Note</CardTitle>
            <CardDescription className="text-xs">Pick the borrower, write the note, optionally set the next follow-up date.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="note-candidate">Borrower</Label>
                {candError ? (
                  <p className="text-xs text-destructive">Could not load borrowers. Refresh the page to retry.</p>
                ) : (
                  <Select value={candidateId} onValueChange={setCandidateId}>
                    <SelectTrigger id="note-candidate" className="w-full">
                      <SelectValue placeholder="Select borrower" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.fullName} · {c.mobile}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note-text">Note</Label>
                <Textarea
                  id="note-text"
                  placeholder="Write your note…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note-next">Next follow-up (optional)</Label>
                <Input
                  id="note-next"
                  type="date"
                  value={nextFollowUp}
                  onChange={(e) => setNextFollowUp(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                <Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving…' : 'Save Note'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> {candidateId ? 'Follow-ups for selected borrower' : 'Recent follow-ups & notes'}</CardTitle>
            <CardDescription className="text-xs">{followUps.length} record(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : isError ? (
              <div className="text-center py-8">
                <p className="text-sm font-medium text-destructive">Could not load follow-ups.</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : followUps.length === 0 ? (
              <EmptyState icon={<StickyNote className="h-6 w-6" />} title="No follow-ups yet" description="Notes and follow-ups you record will appear here." />
            ) : (
              <div className="space-y-3">
                {followUps.map((f) => (
                  <div key={f.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> {f.candidate?.fullName ?? 'Borrower'}
                      </p>
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtDateTime(f.contactDate ?? f.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {f.contactMethod}{f.outcome ? ` · ${f.outcome}` : ''}{f.loan?.loanNumber ? ` · Loan ${f.loan.loanNumber}` : ''}
                      {f.nextFollowUp ? ` · Next: ${fmtDateTime(f.nextFollowUp)}` : ''}
                    </p>
                    {f.notes && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{f.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
