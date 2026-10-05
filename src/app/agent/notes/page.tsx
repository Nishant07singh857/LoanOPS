'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  StickyNote, Save, Lock, Clock, Tag, Plus, Trash2,
  User, FileText,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

interface Note {
  id: string
  title: string
  content: string
  candidate?: string
  tags: string[]
  ts: string
}

const sampleNotes: Note[] = []

interface CandidateRow {
  id: string
  fullName: string
  mobile: string
}

export default function AgentNotesPage() {
  const [notes, setNotes] = React.useState<Note[]>(sampleNotes)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [candidate, setCandidate] = React.useState('')
  const [tags, setTags] = React.useState('')
  const [quickNote, setQuickNote] = React.useState('')

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('sterling_agent_notes')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setNotes(JSON.parse(saved))
    } catch {}
  }, [])

  const updateNotes = (next: Note[]) => {
    setNotes(next)
    try { localStorage.setItem('sterling_agent_notes', JSON.stringify(next)) } catch {}
  }

  const { data: candidatesData } = useQuery({
    queryKey: ['agent-candidates-for-notes'],
    queryFn: () => api.get<{ items: CandidateRow[] }>('/api/agent/candidates?pageSize=100'),
  })
  const candidates = candidatesData?.items ?? []

  const submit = () => {
    if (!title.trim() && !content.trim()) {
      toast.error('Add a title or content first')
      return
    }
    const newNote: Note = {
      id: `n_${Date.now()}`,
      title: title.trim() || 'Untitled',
      content: content.trim(),
      candidate: candidate && candidate !== 'none' ? candidate : undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      ts: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }
    updateNotes([newNote, ...notes])
    setTitle(''); setContent(''); setCandidate(''); setTags('')
    toast.success('Note saved', { description: 'Note saved — visible only to you.' })
  }

  const saveQuick = () => {
    if (!quickNote.trim()) return
    const newNote: Note = {
      id: `n_${Date.now()}`,
      title: 'Quick note',
      content: quickNote.trim(),
      tags: ['Quick'],
      ts: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }
    updateNotes([newNote, ...notes])
    setQuickNote('')
    toast.success('Quick note saved')
  }

  const onDelete = (id: string) => {
    updateNotes(notes.filter((n) => n.id !== id))
    toast.info('Note deleted')
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="My Notes"
        description="Personal scratchpad for the field. Private to you — not visible to owner or candidate."
        icon={<StickyNote className="h-5 w-5" />}
      />

      <FadeIn>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-3.5">
            <div className="flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
              <p className="text-xs text-success">
                <span className="font-semibold">Agent-private.</span> Notes here are visible only to you and are never shared with the candidate or owner.
              </p>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <FadeIn>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><StickyNote className="h-4 w-4" /> Quick Note</CardTitle>
              <CardDescription className="text-xs">Capture a fast thought</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Type a quick note..."
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                className="min-h-[120px]"
              />
              <Button className="w-full" onClick={saveQuick} disabled={!quickNote.trim()}>
                <Save className="h-4 w-4" /> Save Quick Note
              </Button>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05} className="lg:col-span-2">
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> New Note</CardTitle>
              <CardDescription className="text-xs">Title, content, optional candidate link and tags</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input placeholder="e.g. Karthik Iyer — field visit notes" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Content</Label>
                <Textarea placeholder="Write your note..." value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[120px]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Link Candidate (optional)</Label>
                  <Select value={candidate} onValueChange={setCandidate}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {candidates.map((c) => (
                        <SelectItem key={c.id} value={c.fullName}>{c.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tags (comma-separated)</Label>
                  <Input placeholder="e.g. Field, PTP, Cash" value={tags} onChange={(e) => setTags(e.target.value)} />
                </div>
              </div>
              <Button onClick={submit} className="w-full">
                <Plus className="h-4 w-4" /> Save Note
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Recent Notes</CardTitle>
            <CardDescription className="text-xs">{notes.length} notes saved</CardDescription>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <EmptyState icon={<StickyNote className="h-6 w-6" />} title="No notes yet" description="Capture your first note above." />
            ) : (
              <StaggerContainer className="space-y-3">
                {notes.map((n) => (
                  <StaggerItem key={n.id}>
                    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{n.title}</p>
                          {n.candidate && (
                            <p className="text-[11px] text-info inline-flex items-center gap-1 mt-0.5">
                              <User className="h-3 w-3" /> {n.candidate}
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" aria-label={`Delete note ${n.title}`} className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(n.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{n.content}</p>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {n.ts}
                        </span>
                        {n.tags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium">
                            <Tag className="h-2.5 w-2.5" /> {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
