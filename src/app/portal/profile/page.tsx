'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserCircle, Mail, Phone, MapPin, Calendar, ShieldCheck, IdCard,
  Building2, Banknote, Briefcase, Wallet, Edit, LogOut, CheckCircle2,
  AlertCircle, FileText, Eye, EyeOff, Download, Trash2, Scale, BellOff, Loader2,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { Separator } from '@/components/ui/separator'
import { FadeIn } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useSession } from '@/lib/session'
import { formatPaiseToINR } from '@/lib/money'
import { cn, maskAadhaar, maskPan, maskBankAccount } from '@/lib/utils'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { LegalFooter } from '@/components/legal/legal-footer'

interface Profile {
  id: string
  fullName: string
  mobile: string
  email?: string | null
  dob?: string | null
  address?: string | null
  occupation?: string | null
  employer?: string | null
  monthlyIncome?: number | null
  bankName?: string | null
  bankAccount?: string | null
  bankIfsc?: string | null
  upiId?: string | null
  aadhaarMasked?: string | null
  panMasked?: string | null
  status: string
  assignedAgent?: { id: string; name: string; phone?: string | null } | null
  kyc?: {
    aadhaarNumber?: string | null
    panNumber?: string | null
    status: string
    verifiedAt?: string | null
  } | null
  counts: { loans: number; payments: number; supportTickets: number }
}

interface DataSubjectRequestRecord {
  id: string
  requestType: 'EXPORT' | 'DELETION' | 'CORRECTION' | 'WITHDRAW_CONSENT' | string
  status: 'PENDING' | 'COMPLETED' | 'REJECTED_LEGAL_RETENTION' | string
  reason?: string | null
  reviewNotes?: string | null
  createdAt: string
  reviewedAt?: string | null
}

interface ConsentRecordItem {
  id: string
  consentType: string
  policyVersion: string
  granted: boolean
  createdAt: string
}

interface DataRequestsResponse {
  policyVersion: string
  requests: DataSubjectRequestRecord[]
  consents: ConsentRecordItem[]
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ProfilePage() {
  const { user, logout } = useSession()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = React.useState(false)
  const [erasureOpen, setErasureOpen] = React.useState(false)
  const [erasureReason, setErasureReason] = React.useState('')
  const [exporting, setExporting] = React.useState(false)
  const [showSensitive, setShowSensitive] = React.useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidate-profile'],
    queryFn: () => api.get<Profile>('/api/candidate/profile'),
  })

  const { data: dsrData } = useQuery({
    queryKey: ['candidate-data-requests'],
    queryFn: () => api.get<DataRequestsResponse>('/api/candidate/data-requests'),
  })

  const dsrMutation = useMutation({
    mutationFn: (payload: { requestType: 'EXPORT' | 'DELETION' | 'CORRECTION' | 'WITHDRAW_CONSENT'; reason?: string }) =>
      api.post<DataSubjectRequestRecord>('/api/candidate/data-requests', payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['candidate-data-requests'] })
      if (vars.requestType === 'WITHDRAW_CONSENT') {
        toast.success('Optional communication consent withdrawn', {
          description: 'You will no longer receive promotional messages. Transactional loan notices will continue.',
        })
      } else if (vars.requestType === 'DELETION') {
        setErasureOpen(false)
        setErasureReason('')
        toast.success('Account / Data Erasure request submitted', {
          description: 'Our Nodal Officer will review your request in accordance with DPDP Act & RBI retention rules.',
        })
      } else {
        toast.success('Data request submitted')
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to submit data request')
    },
  })

  const handleExportData = async () => {
    setExporting(true)
    try {
      const exportPayload = await api.get<any>('/api/candidate/data-requests?export=true')
      await api.post('/api/candidate/data-requests', {
        requestType: 'EXPORT',
        reason: 'Self-service JSON data portability export (DPDP Act Section 11)',
      }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['candidate-data-requests'] })

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `loanops-dpdp-data-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Personal data exported (JSON)', {
        description: 'Your portable data package has been downloaded.',
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export personal data')
    } finally {
      setExporting(false)
    }
  }

  const fullName = profile?.fullName ?? user?.name ?? 'Candidate'
  const initials = fullName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  const rawAadhaar = profile?.aadhaarMasked ?? profile?.kyc?.aadhaarNumber
  const rawPan = profile?.panMasked ?? profile?.kyc?.panNumber
  const displayAadhaar = showSensitive ? (rawAadhaar ?? '—') : maskAadhaar(rawAadhaar)
  const displayPan = showSensitive ? (rawPan ?? '—') : maskPan(rawPan)
  const displayBankAccount = showSensitive ? (profile?.bankAccount ?? '—') : maskBankAccount(profile?.bankAccount)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="My Profile"
        description="Your personal, KYC, bank, employment, and DPDP Act 2023 data privacy rights — all in one place."
        icon={<UserCircle className="h-5 w-5" />}
        action={
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="h-4 w-4" /> Edit Profile
          </Button>
        }
      />

      <FadeIn>
        <Card className="shadow-premium overflow-hidden border-amber-400/30">
          <div className="h-20 sm:h-24 bg-gradient-fintech relative overflow-hidden" />
          <CardContent className="px-4 sm:px-6 pb-6 pt-0">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24 -mt-10 sm:-mt-12 border-4 border-background rounded-2xl shadow-glow relative z-10 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-fintech text-primary-foreground text-2xl sm:text-3xl font-bold rounded-2xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="pt-1 sm:pt-3 sm:pb-1 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{fullName}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 break-all sm:break-normal">{profile?.mobile ?? '—'}{profile?.email ? ` · ${profile.email}` : ''}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {profile?.kyc?.status === 'VERIFIED' && (
                      <StatusBadge variant="VERIFIED" dot>KYC Verified</StatusBadge>
                    )}
                    {(profile?.counts?.loans ?? 0) > 0 && (
                      <StatusBadge variant="ACTIVE">Active Loan</StatusBadge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:pb-2">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Edit className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => {
                    toast.success('Signed out', { description: 'You can sign back in any time.' })
                    setTimeout(() => logout(), 600)
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" /> Logout
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <Separator className="my-1 bg-border/60" />

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <UserCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Personal Details</CardTitle>
                <CardDescription className="text-xs">Read-only display</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <DetailRow label="Full Name" value={fullName} icon={<UserCircle className="h-4 w-4" />} />
              <DetailRow label="Mobile" value={profile?.mobile ?? '—'} icon={<Phone className="h-4 w-4" />} />
              <DetailRow label="Email" value={profile?.email ?? '—'} icon={<Mail className="h-4 w-4" />} />
              <DetailRow label="Date of Birth" value={fmtDate(profile?.dob)} icon={<Calendar className="h-4 w-4" />} />
              <DetailRow label="Address" value={profile?.address ?? '—'} icon={<MapPin className="h-4 w-4" />} full />
            </dl>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium border-success/15">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-success/15 text-success flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">KYC Details</CardTitle>
                  <CardDescription className="text-xs">Verified {fmtDate(profile?.kyc?.verifiedAt)}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSensitive((v) => !v)}
                  aria-label={showSensitive ? 'Mask sensitive numbers' : 'Show sensitive numbers'}
                  className="h-8 text-xs"
                >
                  {showSensitive ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  {showSensitive ? 'Mask' : 'Show'}
                </Button>
                <StatusBadge variant={profile?.kyc?.status ?? 'PENDING'}>{profile?.kyc?.status ?? 'Pending'}</StatusBadge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <DetailRow label="Aadhaar Number" value={displayAadhaar} icon={<IdCard className="h-4 w-4" />} mono />
              <DetailRow label="PAN Number" value={displayPan} icon={<FileText className="h-4 w-4" />} mono />
              <DetailRow label="KYC Status" value={profile?.kyc?.status ?? 'Pending'} icon={<CheckCircle2 className="h-4 w-4" />} />
              <DetailRow label="Verified On" value={fmtDate(profile?.kyc?.verifiedAt)} icon={<Calendar className="h-4 w-4" />} />
            </dl>
            <div className="rounded-xl bg-info/5 border border-info/15 p-3 mt-4 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">Your sensitive IDs are stored encrypted and masked by default. To update KYC, please contact your agent.</p>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <FadeIn>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-info/15 text-info flex items-center justify-center">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Bank Details</CardTitle>
                    <CardDescription className="text-xs">Where your loan is credited &amp; debited</CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSensitive((v) => !v)}
                  aria-label={showSensitive ? 'Mask account number' : 'Show account number'}
                  className="h-8 text-xs"
                >
                  {showSensitive ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  {showSensitive ? 'Mask' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <DetailRow label="Bank Name" value={profile?.bankName ?? '—'} icon={<Building2 className="h-4 w-4" />} />
                <DetailRow label="Account Number" value={displayBankAccount} icon={<Banknote className="h-4 w-4" />} mono />
                <DetailRow label="IFSC Code" value={profile?.bankIfsc ?? '—'} icon={<Banknote className="h-4 w-4" />} mono />
                <DetailRow label="UPI ID" value={profile?.upiId ?? '—'} icon={<Wallet className="h-4 w-4" />} mono />
              </dl>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Employment Details</CardTitle>
                  <CardDescription className="text-xs">Used for eligibility checks</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <DetailRow label="Occupation" value={profile?.occupation ?? '—'} icon={<Briefcase className="h-4 w-4" />} />
                <DetailRow label="Employer" value={profile?.employer ?? '—'} icon={<Building2 className="h-4 w-4" />} />
                <DetailRow label="Monthly Income" value={profile?.monthlyIncome ? formatPaiseToINR(profile.monthlyIncome) : '—'} icon={<Wallet className="h-4 w-4" />} />
              </dl>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* DPDP Act 2023 Privacy, Consents & Data Rights Section */}
      <FadeIn>
        <Card className="shadow-premium border-primary/25">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Privacy, Consents &amp; Data Rights (DPDP Act 2023)</CardTitle>
                  <CardDescription className="text-xs">
                    Exercise your rights under India&apos;s Digital Personal Data Protection Act, 2023 (Policy v{COMPLIANCE_CONFIG.policyVersion})
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                <Link href="/privacy">View Privacy Policy &rarr;</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting}
                onClick={handleExportData}
                className="h-9 text-xs"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                Export My Data (JSON)
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={dsrMutation.isPending}
                onClick={() => dsrMutation.mutate({ requestType: 'WITHDRAW_CONSENT' })}
                className="h-9 text-xs"
              >
                <BellOff className="h-3.5 w-3.5 mr-1.5" />
                Withdraw Optional Consents
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setErasureOpen(true)}
                className="h-9 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Request Account / Data Erasure
              </Button>
            </div>

            {dsrData?.requests && dsrData.requests.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-xs font-semibold text-foreground">Past Data Subject Requests</p>
                <div className="space-y-1.5">
                  {dsrData.requests.slice(0, 5).map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 border border-border/60 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-foreground">{r.requestType}</span>
                        <span className="text-muted-foreground ml-2">{fmtDate(r.createdAt)}</span>
                        {r.reviewNotes && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{r.reviewNotes}</p>
                        )}
                      </div>
                      <StatusBadge variant={r.status === 'COMPLETED' ? 'VERIFIED' : r.status === 'PENDING' ? 'PENDING' : 'REJECTED'}>
                        {r.status}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="border-destructive/15">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Sign out of your account</p>
              <p className="text-xs text-muted-foreground mt-0.5">You can sign back in any time with the same mobile number.</p>
            </div>
            <Button
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => {
                toast.success('Signed out', { description: 'See you soon!' })
                setTimeout(() => logout(), 600)
              }}
            >
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </CardContent>
        </Card>
      </FadeIn>

      <LegalFooter compact className="mt-4" />

      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} profile={profile ?? null} />

      <Dialog open={erasureOpen} onOpenChange={setErasureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Account / Personal Data Erasure</DialogTitle>
            <DialogDescription>
              Submit a formal erasure request under Section 12(3) of the DPDP Act, 2023. Please note that if you have an active loan or statutory RBI/PMLA financial retention applies, core loan and ledger records must be preserved by law while optional PII is erased.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label htmlFor="erasure-reason" className="text-xs font-medium text-foreground block">
              Reason / Details for Erasure or Correction Request
            </label>
            <textarea
              id="erasure-reason"
              rows={3}
              value={erasureReason}
              onChange={(e) => setErasureReason(e.target.value)}
              placeholder="E.g. My loan is closed and I wish to erase my non-statutory personal profile data."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setErasureOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={dsrMutation.isPending}
              onClick={() =>
                dsrMutation.mutate({
                  requestType: 'DELETION',
                  reason: erasureReason.trim() || 'Requested account / personal data erasure under DPDP Act 2023',
                })
              }
            >
              {dsrMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Submit Erasure Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailRow({ label, value, icon, mono, full }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean; full?: boolean }) {
  return (
    <div className={cn('flex items-start justify-between gap-3', full && 'sm:col-span-2')}>
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
        {label}
      </dt>
      <dd className={cn('text-sm font-medium text-right', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

function EditProfileDialog({ open, onOpenChange, profile }: { open: boolean; onOpenChange: (v: boolean) => void; profile: Profile | null }) {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [occupation, setOccupation] = React.useState('')
  const [employer, setEmployer] = React.useState('')
  const [monthlyIncome, setMonthlyIncome] = React.useState('')
  const [bankName, setBankName] = React.useState('')
  const [bankIfsc, setBankIfsc] = React.useState('')
  const [upiId, setUpiId] = React.useState('')

  // Prefill from the loaded profile each time the dialog opens.
  const [prevOpen, setPrevOpen] = React.useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open && profile) {
      setFullName(profile.fullName ?? '')
      setEmail(profile.email ?? '')
      setAddress(profile.address ?? '')
      setOccupation(profile.occupation ?? '')
      setEmployer(profile.employer ?? '')
      setMonthlyIncome(profile.monthlyIncome != null ? String(profile.monthlyIncome) : '')
      setBankName(profile.bankName ?? '')
      setBankIfsc(profile.bankIfsc ?? '')
      setUpiId(profile.upiId ?? '')
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        fullName: fullName.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        occupation: occupation.trim() || null,
        employer: employer.trim() || null,
        bankName: bankName.trim() || null,
        bankIfsc: bankIfsc.trim() || null,
        upiId: upiId.trim() || null,
      }
      if (monthlyIncome.trim()) payload.monthlyIncome = Number(monthlyIncome)
      return api.patch('/api/candidate/profile', payload)
    },
    onSuccess: () => {
      toast.success('Profile updated')
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error('Could not update profile', { description: err?.message || 'Please try again.' })
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (fullName.trim().length < 2) {
      toast.error('Enter your full name')
      return
    }
    if (monthlyIncome.trim() && Number.isNaN(Number(monthlyIncome))) {
      toast.error('Monthly income must be a number')
      return
    }
    saveMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your contact and employment details. Mobile number and KYC identity documents cannot be changed here — for those, raise a support request.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Full Name</Label>
            <Input id="ep-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-email">Email</Label>
            <Input id="ep-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-address">Address</Label>
            <Textarea id="ep-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-occupation">Occupation</Label>
              <Input id="ep-occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-employer">Employer</Label>
              <Input id="ep-employer" value={employer} onChange={(e) => setEmployer(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-income">Monthly Income (₹)</Label>
              <Input id="ep-income" type="number" min={0} value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-upi">UPI ID</Label>
              <Input id="ep-upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-bank">Bank Name</Label>
              <Input id="ep-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-ifsc">Bank IFSC</Label>
              <Input id="ep-ifsc" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} />
            </div>
          </div>
          <div className="rounded-xl bg-info/5 border border-info/15 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">To update Aadhaar, PAN, or bank account number, raise a support request with the KYC category so the team can verify your documents.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
