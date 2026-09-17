'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSignature, Plus, Calendar, Eye, CheckCircle2 } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { api, ApiRequestError } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface AgreementTemplate {
  id: string
  name: string
  version: string
  body: string
  effectiveDate: string
  isActive: boolean
  createdAt: string
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AgreementsPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [version, setVersion] = React.useState('')
  const [body, setBody] = React.useState('')
  const [effectiveDate, setEffectiveDate] = React.useState('')
  const [preview, setPreview] = React.useState<AgreementTemplate | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['owner-agreements'],
    queryFn: () => api.get<{ items: AgreementTemplate[] }>('/api/owner/agreements'),
  })

  const templates = data?.items ?? []

  const toggleMutation = useMutation({
    mutationFn: (t: AgreementTemplate) =>
      api.patch<{ id: string; isActive: boolean }>(`/api/owner/agreements/${t.id}`, { isActive: !t.isActive }),
    onSuccess: (res, t) => {
      toast.success(t.isActive ? 'Template deactivated' : 'Template activated', { description: `${t.name} v${t.version}` })
      queryClient.invalidateQueries({ queryKey: ['owner-agreements'] })
    },
    onError: (e: Error) => toast.error('Failed to update template', { description: e.message }),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/api/owner/agreements', {
        name, version, body, effectiveDate, isActive: true,
      }),
    onSuccess: () => {
      toast.success('Template created', { description: `${name} v${version} is now active.` })
      queryClient.invalidateQueries({ queryKey: ['owner-agreements'] })
      setOpen(false); setName(''); setVersion(''); setBody(''); setEffectiveDate('')
    },
    onError: (e: Error) => {
      const msg = e instanceof ApiRequestError ? e.message : 'Failed to create template'
      toast.error(msg)
    },
  })

  const create = () => {
    if (!name || !version || !body || !effectiveDate) {
      toast.error('All fields required')
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Agreement Templates"
        description="Manage lender-borrower loan agreement templates. Activate or deactivate versions."
        icon={<FileSignature className="h-5 w-5" />}
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Create Template
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="h-6 w-6" />}
          title="No agreement templates"
          description="Create your first agreement template to get started."
        />
      ) : (
        <StaggerContainer className="space-y-3">
          {templates.map((t) => (
            <StaggerItem key={t.id}>
              <Card className="shadow-premium hover:border-primary/40 transition-all">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0', t.isActive ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                        <FileSignature className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm sm:text-base font-semibold truncate">{t.name}</p>
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">v{t.version}</span>
                          <StatusBadge variant={t.isActive ? 'ACTIVE' : 'PASSIVE'} dot={false}>{t.isActive ? 'Active' : 'Inactive'}</StatusBadge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" /> Effective {fmtDate(t.effectiveDate)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.body.slice(0, 120)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setPreview(t)}>
                        <Eye className="h-4 w-4" /> Preview
                      </Button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{t.isActive ? 'Active' : 'Inactive'}</span>
                        <Switch
                          checked={t.isActive}
                          disabled={toggleMutation.isPending}
                          onCheckedChange={() => toggleMutation.mutate(t)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Agreement Template</DialogTitle>
            <DialogDescription>Define a new template version. It will be activated immediately upon creation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Personal Loan Agreement" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="version">Version</Label>
                <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 3.2" />
              </div>
              <div>
                <Label htmlFor="effectiveDate">Effective Date</Label>
                <Input id="effectiveDate" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="body">Body</Label>
              <Textarea id="body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="# Loan Agreement&#10;&#10;This agreement is entered into between..." className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground mt-1">Supports Markdown. Use {`{candidateName}`}, {`{principal}`}, {`{frequency}`}, {`{installments}`} placeholders.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={createMutation.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Create &amp; Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.name} v{preview?.version}</DialogTitle>
            <DialogDescription>Effective {preview ? fmtDate(preview.effectiveDate) : ''}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border p-4">
            <pre className="text-xs whitespace-pre-wrap font-mono">{preview?.body}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
