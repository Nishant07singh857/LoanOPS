'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  QrCode, Plus, Copy, Download, RefreshCw, Ban, CheckCircle2, Clock, ExternalLink,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'

interface QrLinkRow {
  id: string
  token: string
  prePrincipal?: number | null
  preInterestType?: string | null
  preInterestRate?: number | null
  preFrequency?: string | null
  preInstallments?: number | null
  prePurpose?: string | null
  expiresAt?: string | null
  isRevoked: boolean
  isUsed: boolean
  submittedAt?: string | null
  createdAt: string
  createdBy: string | null
  application?: { applicationNumber: string; status: string; candidate: { fullName: string; mobile: string } } | null
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

export default function QrLinksPage() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['owner-qr-links'],
    queryFn: () => api.get<{ items: QrLinkRow[]; total: number }>('/api/owner/qr-links?pageSize=100'),
  })
  const links = data?.items ?? []
  const [open, setOpen] = React.useState(false)
  const [generated, setGenerated] = useStateOrNull<string | null>(null)

  const [prePrincipal, setPrePrincipal] = React.useState('')
  const [preFreq, setPreFreq] = React.useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | ''>('')
  const [preInstallments, setPreInstallments] = React.useState('')
  const [expiry, setExpiry] = React.useState('7')

  const fmtStatus = (l: QrLinkRow) => {
    if (l.isRevoked) return { variant: 'REJECTED', label: 'Revoked' }
    if (l.isUsed) return { variant: 'COMPLETED', label: 'Used' }
    if (isExpired(l.expiresAt)) return { variant: 'REJECTED', label: 'Expired' }
    return { variant: 'ACTIVE', label: 'Active' }
  }

  const createMutation = useMutation({
    mutationFn: (input: any) => api.post('/api/owner/qr-links', input),
    onSuccess: (data: any) => {
      toast.success('QR Link generated', { description: 'Link is ready to share with the candidate.' })
      const url = `${window.location.origin}/apply/${data.token}`
      setGenerated(url)
      queryClient.invalidateQueries({ queryKey: ['owner-qr-links'] })
      setOpen(false)
      setPrePrincipal(''); setPreFreq(''); setPreInstallments(''); setExpiry('7')
    },
    onError: (err: any) => toast.error('Generation failed', { description: err.message }),
  })

  const generate = () => {
    const expiryDate = new Date(Date.now() + Number(expiry || 7) * 24 * 60 * 60 * 1000).toISOString()
    createMutation.mutate({
      prePrincipal: prePrincipal ? Math.round(Number(prePrincipal) * 100) : null,
      preInterestType: 'PERCENTAGE',
      preInterestRate: 1800,
      preFrequency: preFreq || null,
      preInstallments: preInstallments ? Number(preInstallments) : null,
      expiresAt: expiryDate,
    })
  }

  const copyLink = (link: string) => {
    if (navigator.clipboard) navigator.clipboard.writeText(link)
    toast.success('Link copied', { description: link })
  }

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/owner/qr-links/${id}/revoke`, {}),
    onSuccess: () => {
      toast.error('Link revoked', { description: 'The candidate can no longer use this link.' })
      queryClient.invalidateQueries({ queryKey: ['owner-qr-links'] })
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/owner/qr-links/${id}/regenerate`, {}),
    onSuccess: (data: any) => {
      toast.success('Link regenerated', { description: `New token: ${data.token.slice(0, 8)}...` })
      queryClient.invalidateQueries({ queryKey: ['owner-qr-links'] })
    },
  })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="QR / Application Links"
        description="Generate pre-configured application links for new candidates. Each link has a unique token and optional expiry."
        icon={<QrCode className="h-5 w-5" />}
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Generate QR Link
          </Button>
        }
      />

      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Links</p><p className="text-2xl font-bold tabular-nums text-success">{links.filter((l) => !l.isRevoked && !l.isUsed && !isExpired(l.expiresAt)).length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Used</p><p className="text-2xl font-bold tabular-nums">{links.filter((l) => l.isUsed).length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revoked</p><p className="text-2xl font-bold tabular-nums text-destructive">{links.filter((l) => l.isRevoked).length}</p></CardContent></Card></StaggerItem>
        <StaggerItem><Card className="shadow-premium"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Generated</p><p className="text-2xl font-bold tabular-nums">{links.length}</p></CardContent></Card></StaggerItem>
      </StaggerContainer>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2"><CardTitle className="text-base">QR Links</CardTitle><CardDescription>{links.length} total</CardDescription></CardHeader>
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6">Token</TableHead>
                    <TableHead>Pre-config</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((l) => {
                    const s = fmtStatus(l)
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="pl-6 font-mono text-xs">{l.token.slice(0, 12)}...</TableCell>
                        <TableCell className="text-xs">
                          {l.prePrincipal || l.preFrequency || l.preInstallments ? (
                            <div className="space-y-0.5">
                              {l.prePrincipal ? <div>{formatPaiseToINR(l.prePrincipal)}</div> : null}
                              {l.preFrequency && <div className="text-muted-foreground">{l.preFrequency.toLowerCase()} · {l.preInstallments ?? '?'} inst.</div>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">— no pre-config</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{l.createdBy ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(l.createdAt)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(l.expiresAt)}</TableCell>
                        <TableCell><StatusBadge variant={s.variant as any}>{s.label}</StatusBadge></TableCell>
                        <TableCell className="text-xs font-mono">{l.application?.applicationNumber ?? '—'}</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => copyLink(`${window.location.origin}/apply/${l.token}`)} title="Copy">
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => regenerateMutation.mutate(l.id)} title="Regenerate">
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            {!l.isRevoked && (
                              <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate(l.id)} title="Revoke" className="text-destructive">
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <StaggerContainer className="md:hidden space-y-3">
              {links.map((l) => {
                const s = fmtStatus(l)
                return (
                  <StaggerItem key={l.id}>
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs">{l.token.slice(0, 16)}...</p>
                          <p className="text-xs text-muted-foreground mt-0.5">by {l.createdBy ?? '—'}</p>
                        </div>
                        <StatusBadge variant={s.variant as any}>{s.label}</StatusBadge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border text-xs">
                        {l.prePrincipal ? <div><p className="text-muted-foreground">Principal</p><p className="font-medium">{formatPaiseToINR(l.prePrincipal)}</p></div> : null}
                        {l.preFrequency && <div><p className="text-muted-foreground">Frequency</p><p className="font-medium">{l.preFrequency}</p></div>}
                        {l.preInstallments && <div><p className="text-muted-foreground">Installments</p><p className="font-medium">{l.preInstallments}</p></div>}
                        <div><p className="text-muted-foreground">Expires</p><p className="font-medium">{fmtDate(l.expiresAt)}</p></div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => copyLink(`${window.location.origin}/apply/${l.token}`)}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                        <Button size="sm" variant="outline" onClick={() => regenerateMutation.mutate(l.id)}><RefreshCw className="h-3.5 w-3.5" /></Button>
                        {!l.isRevoked && (
                          <Button size="sm" variant="outline" onClick={() => revokeMutation.mutate(l.id)} className="text-destructive border-destructive/40"><Ban className="h-3.5 w-3.5" /></Button>
                        )}
                      </div>
                    </div>
                  </StaggerItem>
                )
              })}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate QR Link</DialogTitle>
            <DialogDescription>Optionally pre-configure loan terms. The candidate can still adjust before submitting.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="principal">Principal (₹, optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input id="principal" value={prePrincipal} onChange={(e) => setPrePrincipal(e.target.value)} placeholder="0" className="pl-8" type="text" inputMode="numeric" />
                </div>
              </div>
              <div>
                <Label htmlFor="expiry">Expiry (days)</Label>
                <Input id="expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} type="number" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequency</Label>
                <Select value={preFreq} onValueChange={(v) => setPreFreq(v as any)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="inst">Installments</Label>
                <Input id="inst" value={preInstallments} onChange={(e) => setPreInstallments(e.target.value)} type="number" placeholder="e.g. 12" />
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Link will be valid for {expiry} days. Candidate can fill remaining fields if not pre-configured.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={generate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Generating…' : <><QrCode className="h-4 w-4" /> Generate Link</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!generated} onOpenChange={(o) => !o && setGenerated(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Link Ready</DialogTitle>
            <DialogDescription>Share this link with the candidate or print the QR code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="h-44 w-44 rounded-2xl border-2 border-dashed border-border p-3 bg-white">
                <QrPattern />
              </div>
            </div>
            <div>
              <Label>Application Link</Label>
              <div className="flex gap-2">
                <Input readOnly value={generated || ''} className="text-xs font-mono" />
                <Button size="sm" onClick={() => copyLink(generated || '')}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => toast.success('QR downloading...')}><Download className="h-4 w-4" /> Download QR</Button>
            <Button onClick={() => setGenerated(null)}><CheckCircle2 className="h-4 w-4" /> Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function useStateOrNull<T>(initial: T) {
  return React.useState<T>(initial)
}

function QrPattern() {
  const cells = Array.from({ length: 144 }, (_, i) => Math.random() > 0.5)
  return (
    <div className="grid grid-cols-12 gap-0 h-full w-full">
      {cells.map((on, i) => (
        <div key={i} className={cn('aspect-square', on ? 'bg-foreground' : 'bg-transparent')} />
      ))}
    </div>
  )
}
