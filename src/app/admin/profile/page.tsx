'use client'

import * as React from 'react'
import { User, Mail, ShieldCheck, Building2, LogOut, Moon, Sun } from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { FadeIn } from '@/components/ui/motion'
import { toast } from 'sonner'
import { useSession } from '@/lib/session'
import { useTheme } from 'next-themes'

// Minimal owner profile (live-audit finding D.5): account identity from the
// session (/api/auth/me), theme toggle, sign out. Mirrors the borrower
// profile's structure. No password-change UI — no such endpoint exists.
export default function OwnerProfilePage() {
  const { user, logout } = useSession()
  const { theme, setTheme } = useTheme()
  const initials = user?.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U'

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Profile"
        description="Your account details for this workspace."
        icon={<User className="h-5 w-5" />}
      />

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar className="h-16 w-16 border border-amber-300/30">
                <AvatarFallback className="bg-gradient-fintech text-primary-foreground text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold truncate">{user?.name ?? '—'}</p>
                <p className="text-sm text-muted-foreground truncate">{user?.email ?? '—'}</p>
                <Badge variant="secondary" className="mt-2 text-[10px]">{user?.role ?? 'OWNER'}</Badge>
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-6 text-sm">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="text-xs text-muted-foreground">Full name</dt>
                  <dd className="font-medium mt-0.5">{user?.name ?? '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="font-medium mt-0.5">{user?.email ?? '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="text-xs text-muted-foreground">Role</dt>
                  <dd className="font-medium mt-0.5">{user?.role ?? '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="text-xs text-muted-foreground">Organization</dt>
                  <dd className="font-medium mt-0.5">{user?.organizationName ?? '—'}</dd>
                </div>
              </div>
            </dl>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Appearance</p>
              <p className="text-xs text-muted-foreground mt-0.5">Switch between light and dark theme.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="border-destructive/15">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Sign out of your account</p>
              <p className="text-xs text-muted-foreground mt-0.5">You can sign back in any time.</p>
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
    </div>
  )
}
