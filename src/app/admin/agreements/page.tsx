'use client'

import * as React from 'react'
import { FileSignature, Plus, Calendar, Eye, CheckCircle2 } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { agreementTemplates } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export default function AgreementsPage() {
  const [templates, setTemplates] = React.useState(agreementTemplates)
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [version, setVersion] = React.useState('')
  const [body, setBody] = React.useState('')
  const [effectiveDate, setEffectiveDate] = React.useState('')

  const toggleActive = (id: string) => {
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, isActive: !t.isActive } : t))
    const t = templates.find((x) => x.id === id)
    if (t) toast.success(t.isActive ? 'Template deactivated' : 'Template activated', { description: `${t.name} v${t.version}` })
  }

  const create = () => {
    if (!name || !version || !body || !effectiveDate) {
      toast.error('All fields required')
      return
    }
    const newT = {
      id: `ag${templates.length + 1}`,
      name, version, body, effectiveDate, isActive: true,
    }
    setTemplates([newT, ...templates])
    toast.success('Template created', { description: `${name} v${version} is now active.` })
    setOpen(false); setName(''); setVersion(''); setBody(''); setEffectiveDate('')
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
                        <Calendar className="h-3 w-3" /> Effective {t.effectiveDate}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{t.body.slice(0, 120)}...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toast.info(`Opening ${t.name} v${t.version}`)}>
                      <Eye className="h-4 w-4" /> Preview
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t.isActive ? 'Active' : 'Inactive'}</span>
                      <Switch checked={t.isActive} onCheckedChange={() => toggleActive(t.id)} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>

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
            <Button onClick={create}><CheckCircle2 className="h-4 w-4" /> Create & Activate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
