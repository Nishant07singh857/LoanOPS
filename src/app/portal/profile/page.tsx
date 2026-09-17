'use client'

import * as React from 'react'
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

// Static candidate profile data
const PROFILE = {
  fullName: 'Priya Sharma',
  mobile: '+91 98202 77889',
  email: 'priya.sharma@example.com',
  dob: '14 March 1992',
  address: '14, SeaView Apartments, Bandra West, Mumbai 400050',
  // KYC
  aadhaarMasked: 'XXXX-XXXX-4521',
  pan: 'AKJPS9214H',
  kycStatus: 'VERIFIED',
  kycVerifiedAt: '12 Aug 2024',
  // Bank
  bankName: 'Axis Bank',
  accountMasked: 'XXXX5678',
  ifsc: 'AXIS0001234',
  upiId: 'priya@okhdfcbank',
  // Employment
  occupation: 'Salaried',
  employer: 'Tata Consultancy Services',
  monthlyIncome: 850000, // paise → ₹8,500
  existingObligations: 0,
}

export default function ProfilePage() {
  const { user, logout } = useSession()
  const [editOpen, setEditOpen] = React.useState(false)

  const initials = (PROFILE.fullName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase())

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

      {/* Profile card */}
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
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{PROFILE.fullName}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{PROFILE.mobile} · {PROFILE.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge variant="VERIFIED" dot>KYC Verified</StatusBadge>
                    <StatusBadge variant="ACTIVE">Active Loan</StatusBadge>
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

      {/* Personal details */}
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
              <DetailRow label="Full Name" value={PROFILE.fullName} icon={<UserCircle className="h-4 w-4" />} />
              <DetailRow label="Mobile" value={PROFILE.mobile} icon={<Phone className="h-4 w-4" />} />
              <DetailRow label="Email" value={PROFILE.email} icon={<Mail className="h-4 w-4" />} />
              <DetailRow label="Date of Birth" value={PROFILE.dob} icon={<Calendar className="h-4 w-4" />} />
              <DetailRow label="Address" value={PROFILE.address} icon={<MapPin className="h-4 w-4" />} full />
            </dl>
          </CardContent>
        </Card>
      </FadeIn>

      {/* KYC details */}
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
                  <CardDescription className="text-xs">Verified {PROFILE.kycVerifiedAt}</CardDescription>
                </div>
              </div>
              <StatusBadge variant={PROFILE.kycStatus}>Verified</StatusBadge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <DetailRow label="Aadhaar Number" value={PROFILE.aadhaarMasked} icon={<IdCard className="h-4 w-4" />} mono />
              <DetailRow label="PAN Number" value={PROFILE.pan} icon={<FileText className="h-4 w-4" />} mono />
              <DetailRow label="KYC Status" value="Verified" icon={<CheckCircle2 className="h-4 w-4" />} />
              <DetailRow label="Verified On" value={PROFILE.kycVerifiedAt} icon={<Calendar className="h-4 w-4" />} />
            </dl>
            <div className="rounded-xl bg-info/5 border border-info/15 p-3 mt-4 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">Your sensitive IDs are stored encrypted and never shared. To update KYC, please contact your agent.</p>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Bank + Employment */}
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
                <DetailRow label="Bank Name" value={PROFILE.bankName} icon={<Building2 className="h-4 w-4" />} />
                <DetailRow label="Account Number" value={PROFILE.accountMasked} icon={<Banknote className="h-4 w-4" />} mono />
                <DetailRow label="IFSC Code" value={PROFILE.ifsc} icon={<Banknote className="h-4 w-4" />} mono />
                <DetailRow label="UPI ID" value={PROFILE.upiId} icon={<Wallet className="h-4 w-4" />} mono />
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
                <DetailRow label="Occupation" value={PROFILE.occupation} icon={<Briefcase className="h-4 w-4" />} />
                <DetailRow label="Employer" value={PROFILE.employer} icon={<Building2 className="h-4 w-4" />} />
                <DetailRow label="Monthly Income" value={`₹${(PROFILE.monthlyIncome / 100).toLocaleString('en-IN')}`} icon={<Wallet className="h-4 w-4" />} />
                <DetailRow label="Existing Obligations" value={`₹${(PROFILE.existingObligations / 100).toLocaleString('en-IN')}`} icon={<Banknote className="h-4 w-4" />} />
              </dl>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Logout button at bottom */}
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
