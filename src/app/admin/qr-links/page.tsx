'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  QrCode, Plus, Copy, Download, RefreshCw, Ban, CheckCircle2, AlertTriangle, ExternalLink, Calculator,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
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
import { formatPaiseToINR, formatBpsToPercent, parseDisplayPaise } from '@/lib/money'
import { generateSchedulePreview, type RepaymentFrequency } from '@/lib/financial-engine'
import { cn } from '@/lib/utils'

interface QrLinkRow {
  id: string
  token: string
  prePrincipal?: string | number | null
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
  createdByName?: string | null
  createdBy?: string | null
  applicationId?: string | null
  application?: { applicationNumber: string; status: string; candidate: { fullName: string; mobile: string } } | null
  publicUrl?: string
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
  const qrContainerRef = React.useRef<HTMLDivElement>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-qr-links'],
    queryFn: () => api.get<{ items: QrLinkRow[]; total: number }>('/api/owner/qr-links?pageSize=100'),
  })
  const links = data?.items ?? []
  const [open, setOpen] = React.useState(false)
  const [generated, setGenerated] = React.useState<string | null>(null)

  const [prePrincipal, setPrePrincipal] = React.useState('50000')
  const [preRatePercent, setPreRatePercent] = React.useState('18')
  const [preFreq, setPreFreq] = React.useState<RepaymentFrequency>('MONTHLY')
  const [preInstallments, setPreInstallments] = React.useState('12')
  const [prePurpose, setPrePurpose] = React.useState('Personal Loan')
  const [expiry, setExpiry] = React.useState('7')

  const fmtStatus = (l: QrLinkRow) => {
    if (l.isRevoked) return { variant: 'REJECTED', label: 'Revoked' }
    if (l.isUsed) return { variant: 'COMPLETED', label: 'Used' }
    if (isExpired(l.expiresAt)) return { variant: 'REJECTED', label: 'Expired' }
    return { variant: 'ACTIVE', label: 'Active' }
  }

  const principalPaise = parseDisplayPaise(prePrincipal || '0')
  const rateBps = Math.round((Number(preRatePercent) || 0) * 100)
  const installmentsCount = Math.max(1, parseInt(preInstallments, 10) || 12)

  const livePreview = React.useMemo(() => {
    if (principalPaise <= 0 || installmentsCount <= 0) return null
    try {
      const firstDue = new Date()
      firstDue.setDate(firstDue.getDate() + 7)
      return generateSchedulePreview({
        principalPaise: BigInt(principalPaise),
        interestType: 'PERCENTAGE',
        interestRateBps: BigInt(rateBps),
        fixedInterestPaise: BigInt(0),
        frequency: preFreq,
        installments: installmentsCount,
        firstDueDate: firstDue,
        processingFeePaise: BigInt(0),
        otherFeesPaise: BigInt(0),
      })
    } catch {
      return null
    }
  }, [principalPaise, rateBps, preFreq, installmentsCount])

  const createMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<{ id: string; token: string; publicUrl: string }>('/api/owner/qr-links', input),
    onSuccess: (res) => {
      toast.success('QR Link generated', { description: 'Link is ready to share with the candidate.' })
      const url = `${window.location.origin}/apply/${res.token}`
      setGenerated(url)
      queryClient.invalidateQueries({ queryKey: ['owner-qr-links'] })
      setOpen(false)
    },
    onError: (err: Error) => toast.error('Generation failed', { description: err.message }),
  })

  const generate = () => {
    const days = Math.min(365, Math.max(1, parseInt(expiry, 10) || 7))
    const payload: Record<string, unknown> = {
      preInterestType: 'PERCENTAGE',
      preInterestRate: rateBps,
      expiresInDays: days,
    }
    if (principalPaise > 0) payload.prePrincipal = String(principalPaise)
    if (preFreq) payload.preFrequency = preFreq
    if (installmentsCount > 0) payload.preInstallments = installmentsCount
    if (prePurpose.trim()) payload.prePurpose = prePurpose.trim()

    createMutation.mutate(payload)
  }

  const copyLink = (link: string) => {
    if (navigator.clipboard) navigator.clipboard.writeText(link)
    toast.success('Link copied', { description: link })
  }

  const downloadQrSvg = () => {
    const svgEl = qrContainerRef.current?.querySelector('svg')
    if (!svgEl) {
      toast.error('QR code not ready to download')
      return
    }
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svgEl)
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loan-qr-link-${Date.now()}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('QR Code downloaded')
  }

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/owner/qr-links/${id}/revoke`, {}),
    onSuccess: () => {
      toast.error('Link revoked', { description: 'The candidate can no longer use this link.' })
      queryClient.invalidateQueries({ queryKey: ['owner-qr-links'] })
    },
    onError: (err: Error) => toast.error('Failed to revoke link', { description: err.message }),
  })

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => api.post<{ token: string }>(`/api/owner/qr-links/${id}/regenerate`, {}),
    onSuccess: (res) => {
      toast.success('Link regenerated', { description: `New token: ${res.token.slice(0, 8)}...` })
      queryClient.invalidateQueries({ queryKey: ['owner-qr-links'] })
    },
    onError: (err: Error) => toast.error('Failed to regenerate link', { description: err.message }),
  })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="QR / Application Links"
        description="Generate pre-configured application links for new candidates. Each link has a unique token and optional expiry."
        icon={<QrCode className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-11 px-3" asChild>
              <Link href="/admin/create-loan">
                <Calculator className="h-4 w-4" /> Full Loan Creator
              </Link>
            </Button>
            <Button size="sm" className="h-11 px-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Generate QR Link
            </Button>
          </div>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-base">QR Links</CardTitle>
            <CardDescription>{links.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="py-8 flex flex-col items-center text-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-sm">Failed to load QR links</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Please check your connection and try again.</p>
                </div>
                <Button variant="outline" size="sm" className="h-11" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              </div>
            ) : links.length === 0 ? (
              <EmptyState
                icon={<QrCode className="h-6 w-6" />}
                title="No QR links generated yet"
                description="Generate your first pre-configured QR link to share with a borrower."
              />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto table-scroll w-full">
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
                        const creator = l.createdByName ?? l.createdBy ?? '—'
                        const appRef = l.application?.applicationNumber ?? (l.applicationId ? `${l.applicationId.slice(0, 8)}...` : '—')
                        return (
                          <TableRow key={l.id}>
                            <TableCell className="pl-6 font-mono text-xs">{l.token.slice(0, 12)}...</TableCell>
                            <TableCell className="text-xs">
                              {l.prePrincipal || l.preFrequency || l.preInstallments ? (
                                <div className="space-y-0.5">
                                  {l.prePrincipal ? <div className="font-medium tabular-nums">{formatPaiseToINR(Number(l.prePrincipal))}</div> : null}
                                  <div className="text-muted-foreground">
                                    {l.preFrequency ? l.preFrequency.toLowerCase() : '—'} · {l.preInstallments ?? '?'} inst.
                                    {l.preInterestRate != null ? ` · ${formatBpsToPercent(l.preInterestRate)}` : ''}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">— no pre-config</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{creator}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fmtDate(l.createdAt)}</TableCell>
                            <TableCell className="text-xs">{fmtDate(l.expiresAt)}</TableCell>
                            <TableCell><StatusBadge variant={s.variant as any}>{s.label}</StatusBadge></TableCell>
                            <TableCell className="text-xs font-mono">{appRef}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0"
                                  aria-label={`View QR code for token ${l.token.slice(0, 8)}`}
                                  title="Show QR"
                                  onClick={() => setGenerated(`${window.location.origin}/apply/${l.token}`)}
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0"
                                  aria-label={`Copy link for token ${l.token.slice(0, 8)}`}
                                  title="Copy"
                                  onClick={() => copyLink(`${window.location.origin}/apply/${l.token}`)}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0"
                                  aria-label={`Regenerate link for token ${l.token.slice(0, 8)}`}
                                  title="Regenerate"
                                  onClick={() => regenerateMutation.mutate(l.id)}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                                {!l.isRevoked && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 text-destructive"
                                    aria-label={`Revoke link for token ${l.token.slice(0, 8)}`}
                                    title="Revoke"
                                    onClick={() => revokeMutation.mutate(l.id)}
                                  >
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
                    const creator = l.createdByName ?? l.createdBy ?? '—'
                    return (
                      <StaggerItem key={l.id}>
                        <div className="rounded-xl border border-border p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-mono text-xs">{l.token.slice(0, 16)}...</p>
                              <p className="text-xs text-muted-foreground mt-0.5">by {creator}</p>
                            </div>
                            <StatusBadge variant={s.variant as any}>{s.label}</StatusBadge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border text-xs">
                            {l.prePrincipal ? <div><p className="text-muted-foreground">Principal</p><p className="font-medium tabular-nums">{formatPaiseToINR(Number(l.prePrincipal))}</p></div> : null}
                            {l.preFrequency && <div><p className="text-muted-foreground">Frequency</p><p className="font-medium">{l.preFrequency}</p></div>}
                            {l.preInstallments && <div><p className="text-muted-foreground">Installments</p><p className="font-medium">{l.preInstallments}</p></div>}
                            <div><p className="text-muted-foreground">Expires</p><p className="font-medium">{fmtDate(l.expiresAt)}</p></div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-11 flex-1"
                              onClick={() => copyLink(`${window.location.origin}/apply/${l.token}`)}
                            >
                              <Copy className="h-3.5 w-3.5" /> Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-11 w-11 p-0"
                              aria-label={`Show QR for token ${l.token.slice(0, 8)}`}
                              onClick={() => setGenerated(`${window.location.origin}/apply/${l.token}`)}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-11 w-11 p-0"
                              aria-label={`Regenerate token ${l.token.slice(0, 8)}`}
                              onClick={() => regenerateMutation.mutate(l.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            {!l.isRevoked && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-11 w-11 p-0 text-destructive border-destructive/40"
                                aria-label={`Revoke token ${l.token.slice(0, 8)}`}
                                onClick={() => revokeMutation.mutate(l.id)}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </StaggerItem>
                    )
                  })}
                </StaggerContainer>
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate QR Link</DialogTitle>
            <DialogDescription>Pre-configure transparent loan terms so the borrower sees their exact EMI and total payable upfront.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="principal">Principal (₹)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input id="principal" value={prePrincipal} onChange={(e) => setPrePrincipal(e.target.value)} placeholder="50000" className="pl-8 h-11" type="text" inputMode="decimal" />
                </div>
              </div>
              <div>
                <Label htmlFor="ratePercent">Interest Rate (% per period)</Label>
                <div className="relative mt-1">
                  <Input id="ratePercent" value={preRatePercent} onChange={(e) => setPreRatePercent(e.target.value)} placeholder="18" className="pr-8 h-11" type="text" inputMode="decimal" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Frequency</Label>
                <Select value={preFreq} onValueChange={(v) => setPreFreq(v as RepaymentFrequency)}>
                  <SelectTrigger className="w-full h-11 mt-1"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="inst">Installments</Label>
                <Input id="inst" className="h-11 mt-1" value={preInstallments} onChange={(e) => setPreInstallments(e.target.value)} type="number" min={1} max={360} placeholder="e.g. 12" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="purpose">Purpose</Label>
                <Input id="purpose" className="h-11 mt-1" value={prePurpose} onChange={(e) => setPrePurpose(e.target.value)} placeholder="e.g. Business expansion" />
              </div>
              <div>
                <Label htmlFor="expiry">Expiry (days)</Label>
                <Input id="expiry" className="h-11 mt-1" value={expiry} onChange={(e) => setExpiry(e.target.value)} type="number" min={1} max={365} />
              </div>
            </div>

            {livePreview && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-semibold text-primary">
                  <span>Estimated {preFreq.toLowerCase()} EMI</span>
                  <span className="text-sm tabular-nums">{formatPaiseToINR(Number(livePreview.installmentAmount))}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Total Interest ({preRatePercent}%)</span>
                  <span className="tabular-nums">{formatPaiseToINR(Number(livePreview.totalInterest))}</span>
                </div>
                <div className="flex items-center justify-between font-medium pt-1 border-t border-border">
                  <span>Total Payable (Zero Hidden Fees)</span>
                  <span className="tabular-nums">{formatPaiseToINR(Number(livePreview.totalRepayable))}</span>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Link will be valid for {expiry || 7} days. Borrower will see full EMI and schedule transparency before submitting.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="h-11" onClick={generate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Generating…' : <><QrCode className="h-4 w-4" /> Generate Link</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!generated} onOpenChange={(o) => !o && setGenerated(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Link Ready</DialogTitle>
            <DialogDescription>Share this link with the candidate or download the QR code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center" ref={qrContainerRef}>
              <div className="rounded-2xl border-2 border-dashed border-border p-4 bg-white inline-flex items-center justify-center">
                {generated && <QRCodeSVG value={generated} size={168} />}
              </div>
            </div>
            <div>
              <Label htmlFor="generated-link-input">Application Link</Label>
              <div className="flex gap-2 mt-1">
                <Input id="generated-link-input" readOnly value={generated || ''} className="text-xs font-mono h-11" />
                <Button
                  size="sm"
                  className="h-11 px-3"
                  aria-label="Copy generated application link"
                  onClick={() => copyLink(generated || '')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-11" onClick={downloadQrSvg}>
              <Download className="h-4 w-4" /> Download QR
            </Button>
            <Button className="h-11" onClick={() => setGenerated(null)}>
              <CheckCircle2 className="h-4 w-4" /> Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
