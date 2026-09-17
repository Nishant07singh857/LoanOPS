'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  UserCircle, Mail, Phone, MapPin, Calendar, ShieldCheck, IdCard,
  Building2, Banknote, Briefcase, Wallet, Edit, LogOut, CheckCircle2,
  AlertCircle, FileText,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useSession } from '@/lib/session'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'

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

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ProfilePage() {
  const { user, logout } = useSession()
  const [editOpen, setEditOpen] = React.useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidate-profile'],
    queryFn: () => api.get<Profile>('/api/candidate/profile'),
  })

  const fullName = profile?.fullName ?? user?.name ?? 'Candidate'
  const initials = fullName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

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
        description="Your personal, KYC, bank and employment details — all in one place."
        icon={<UserCircle className="h-5 w-5" />}
        action={
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="h-4 w-4" /> Edit Profile
          </Button>
        }
      />

      <FadeIn>
        <Card className="shadow-premium overflow-hidden border-success/15">
          <div className="h-24 bg-gradient-to-r from-success/15 via-primary/5 to-info/10" />
          <CardContent className="px-4 sm:px-6 pb-6 -mt-12">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex items-end gap-4">
                <Avatar className="h-24 w-24 border-4 border-background rounded-2xl">
                  <AvatarFallback className="bg-success/15 text-success text-3xl font-bold rounded-2xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="pb-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{fullName}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{profile?.mobile ?? '—'}{profile?.email ? ` · ${profile.email}` : ''}</p>
                  <div className="flex items-center gap-2 mt-2">
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-success/15 text-success flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">KYC Details</CardTitle>
                  <CardDescription className="text-xs">Verified {fmtDate(profile?.kyc?.verifiedAt)}</CardDescription>
                </div>
              </div>
              <StatusBadge variant={profile?.kyc?.status ?? 'PENDING'}>{profile?.kyc?.status ?? 'Pending'}</StatusBadge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <DetailRow label="Aadhaar Number" value={profile?.aadhaarMasked ?? profile?.kyc?.aadhaarNumber ?? '—'} icon={<IdCard className="h-4 w-4" />} mono />
              <DetailRow label="PAN Number" value={profile?.panMasked ?? profile?.kyc?.panNumber ?? '—'} icon={<FileText className="h-4 w-4" />} mono />
              <DetailRow label="KYC Status" value={profile?.kyc?.status ?? 'Pending'} icon={<CheckCircle2 className="h-4 w-4" />} />
              <DetailRow label="Verified On" value={fmtDate(profile?.kyc?.verifiedAt)} icon={<Calendar className="h-4 w-4" />} />
            </dl>
            <div className="rounded-xl bg-info/5 border border-info/15 p-3 mt-4 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">Your sensitive IDs are stored encrypted and never shared. To update KYC, please contact your agent.</p>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <FadeIn>
          <Card className="shadow-premium h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-info/15 text-info flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Bank Details</CardTitle>
                  <CardDescription className="text-xs">Where your loan is credited & debited</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <DetailRow label="Bank Name" value={profile?.bankName ?? '—'} icon={<Building2 className="h-4 w-4" />} />
                <DetailRow label="Account Number" value={profile?.bankAccount ?? '—'} icon={<Banknote className="h-4 w-4" />} mono />
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

      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} />
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

function EditProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>For security, KYC and bank details cannot be edited here. Please contact your agent.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl bg-info/5 border border-info/15 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">To update Aadhaar, PAN, or bank details, raise a support request with the KYC category.</p>
          </div>
          <p className="text-sm text-muted-foreground">Editable fields coming soon. For now, please contact your agent for any changes.</p>
        </div>
        <DialogFooter>
          <Button onClick={() => { toast.success('Request sent', { description: 'Your agent will reach out shortly.' }); onOpenChange(false) }}>
            Contact Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
