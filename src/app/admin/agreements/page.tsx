'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSignature, Plus, Calendar, Eye, CheckCircle2, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react'
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

const DEFAULT_TRANSPARENT_BODY = `# Loan Agreement & Key Facts Statement

This Loan Agreement is entered into between the Lender and **{candidateName}** ("Borrower").

## 1. Transparent Loan Terms Summary (Zero Hidden Charges)
- **Principal Amount**: {principal}
- **Interest Rate**: {interestRate}
- **Repayment Frequency**: {frequency}
- **Number of Installments**: {installments}
- **Installment / EMI Amount**: {emiAmount}
- **Processing Fee**: {processingFee}
- **Total Amount Payable**: {totalPayable}

## 2. Repayment & Disclosures
The Borrower agrees to repay the Total Amount Payable across **{installments}** {frequency} installments of **{emiAmount}** each. No hidden charges or undisclosed fees apply beyond the schedule above.`

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

  const { data, isLoading, isError, refetch } = useQuery({
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
        name: name.trim(), version: version.trim(), body: body.trim(), effectiveDate, isActive: true,
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
    if (!name.trim() || !version.trim() || !body.trim() || !effectiveDate) {
      toast.error('All fields required')
      return
    }
    if (name.trim().length < 2) {
      toast.error('Template name must be at least 2 characters')
      return
    }
    if (body.trim().length < 20) {
      toast.error('Agreement body must be at least 20 characters')
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
          <Button size="sm" className="h-11 px-4" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Create Template
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : isError ? (
        <Card className="shadow-premium border-destructive/40">
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-semibold text-sm">Failed to load agreement templates</p>
              <p className="text-xs text-muted-foreground mt-0.5">Please check your connection and try again.</p>
            </div>
            <Button variant="outline" size="sm" className="h-11" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
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
                    <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                      <Button variant="ghost" size="sm" className="h-11 px-3" onClick={() => setPreview(t)}>
                        <Eye className="h-4 w-4" /> Preview
                      </Button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{t.isActive ? 'Active' : 'Inactive'}</span>
                        <Switch
                          aria-label={`Toggle ${t.name} v${t.version} active status`}
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
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Agreement Template</DialogTitle>
            <DialogDescription>Define a new template version. It will be activated immediately upon creation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input id="name" className="h-11 mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Personal Loan Agreement" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="version">Version</Label>
                <Input id="version" className="h-11 mt-1" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 3.2" />
              </div>
              <div>
                <Label htmlFor="effectiveDate">Effective Date</Label>
                <Input id="effectiveDate" className="h-11 mt-1" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <Label htmlFor="body">Body</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-primary"
                  onClick={() => setBody(DEFAULT_TRANSPARENT_BODY)}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Insert Transparent KFS Template
                </Button>
              </div>
              <Textarea id="body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="# Loan Agreement&#10;&#10;This agreement is entered into between..." className="font-mono text-base sm:text-xs" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Supports Markdown. Use {`{candidateName}`}, {`{principal}`}, {`{interestRate}`}, {`{emiAmount}`}, {`{processingFee}`}, {`{totalPayable}`}, {`{frequency}`}, {`{installments}`} placeholders.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="h-11" onClick={create} disabled={createMutation.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Create &amp; Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.name} v{preview?.version}</DialogTitle>
            <DialogDescription>Effective {preview ? fmtDate(preview.effectiveDate) : ''}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-success/10 border border-success/20 px-3 py-2 text-xs text-success flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Transparent Borrower Agreement — Discloses Principal, Interest, EMI, Fees &amp; Total Payable with zero hidden charges.</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border p-4">
            <pre className="text-xs whitespace-pre-wrap font-mono">{preview?.body}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
