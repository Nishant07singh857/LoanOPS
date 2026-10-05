'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Wallet, ShieldCheck, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SessionProvider, useSession, type Role } from '@/lib/session'
import { LegalFooter } from '@/components/legal/legal-footer'

const DEMO_CREDENTIALS: Array<{
  role: Role
  label: string
  identifier: string
  password: string
}> = [
  { role: 'OWNER', label: 'Owner', identifier: 'owner@loanops.in', password: 'Owner@123' },
  { role: 'AGENT', label: 'Agent', identifier: 'agent@loanops.in', password: 'Agent@123' },
  { role: 'CANDIDATE', label: 'Candidate', identifier: '9820277789', password: 'Candidate@123' },
]

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const roleParam = params.get('role') as Role | null
  const requestedRole: Role =
    roleParam === 'AGENT' || roleParam === 'CANDIDATE' || roleParam === 'OWNER' ? roleParam : 'OWNER'
  const defaultRedirect =
    requestedRole === 'CANDIDATE' ? '/portal' : requestedRole === 'AGENT' ? '/agent' : '/admin'
  const explicitRedirect = params.get('redirect')
  const redirect = explicitRedirect || defaultRedirect
  const { user, loading, login, loginCandidate } = useSession()

  const [selectedRole, setSelectedRole] = React.useState<Role>(requestedRole)
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPass, setShowPass] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedRole(requestedRole)
  }, [requestedRole])

  // Redirect already-authenticated users away from /login.
  React.useEffect(() => {
    if (loading) return
    if (user) {
      const userHome = user.role === 'OWNER' ? '/admin' : user.role === 'AGENT' ? '/agent' : '/portal'
      const isCompatibleRedirect =
        explicitRedirect &&
        ((user.role === 'OWNER' && explicitRedirect.startsWith('/admin')) ||
          (user.role === 'AGENT' && explicitRedirect.startsWith('/agent')) ||
          (user.role === 'CANDIDATE' && explicitRedirect.startsWith('/portal')))
      const target = isCompatibleRedirect
        ? explicitRedirect
        : user.role === requestedRole
          ? redirect
          : userHome
      router.replace(target)
    }
  }, [user, loading, redirect, explicitRedirect, requestedRole, router])

  const fillDemo = (demo: (typeof DEMO_CREDENTIALS)[number]) => {
    setSelectedRole(demo.role)
    setIdentifier(demo.identifier)
    setPassword(demo.password)
    setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const idStr = identifier.trim()

    if (!idStr || !password) {
      setError('Please enter your email or mobile number and password')
      return
    }

    setBusy(true)
    try {
      let r
      const digitsOnly = idStr.replace(/\D/g, '')
      if (/^\d+$/.test(idStr) || (!idStr.includes('@') && digitsOnly.length >= 10)) {
        const cleanMobile = digitsOnly.replace(/^91(\d{10})$/, '$1')
        r = await loginCandidate(cleanMobile, password)
      } else {
        r = await login(idStr, password)
      }
      if (!r.ok) {
        setError(r.error || 'Login failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-background via-background to-muted/40">
      {/* Left panel (brand) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-fintech" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="relative flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary-foreground/15 backdrop-blur flex items-center justify-center">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold tracking-tight text-lg">LoanOps</p>
              <p className="text-xs text-primary-foreground/70 tracking-wider">Premium Loan Operations</p>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-tight">Bank-grade lending, end-to-end.</h2>
            <p className="mt-3 text-primary-foreground/80">
              Origination, KYC, agreement, disbursement, repayments, collections, ledger, reconciliation, AI insights & audit — unified.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ['Real auth', 'HTTP-only cookie sessions'],
                ['RBAC', 'Server-side authorization'],
                ['BigInt paise', 'No float math'],
                ['Audit trail', 'Every action logged'],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl bg-primary-foreground/20 border border-primary-foreground/10 backdrop-blur p-3">
                  <p className="font-semibold text-sm">{t}</p>
                  <p className="text-xs text-primary-foreground/80 mt-0.5">{d}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-primary-foreground/60 flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Multi-tenant · Neon PostgreSQL · Prisma</span>
          </div>
        </div>
      </div>

      {/* Right panel (form) */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2.5 mb-6 justify-center">
            <div className="h-10 w-10 rounded-xl bg-gradient-fintech flex items-center justify-center text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold leading-none">LoanOps</p>
              <p className="text-[10px] text-muted-foreground tracking-wider mt-0.5">Premium Loan Operations</p>
            </div>
          </div>

          <Card className="rounded-2xl shadow-premium">
            <CardContent className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
              <p className="text-sm text-muted-foreground mt-1.5">Enter your email or mobile number to continue.</p>

              {/* Demo credentials quick-fill (development only) */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 rounded-xl bg-muted/60 border border-border/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Quick-fill demo account</span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {DEMO_CREDENTIALS.find((d) => d.role === selectedRole)?.identifier}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DEMO_CREDENTIALS.map((demo) => {
                      const active = selectedRole === demo.role && identifier === demo.identifier
                      return (
                        <Button
                          key={demo.role}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          aria-label={`Fill ${demo.label} demo credentials`}
                          onClick={() => fillDemo(demo)}
                          className="h-9 text-xs rounded-lg"
                        >
                          {demo.label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}

              <form onSubmit={submit} className="mt-5 space-y-4" aria-describedby={error ? 'login-error' : undefined} noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="identifier">Email or Mobile Number</Label>
                  <Input
                    id="identifier"
                    type="text"
                    inputMode="email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="name@example.com or 9820277789"
                    autoComplete="username"
                    required
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? 'login-error' : undefined}
                    className="h-11 min-h-[44px] rounded-xl text-base"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      minLength={6}
                      aria-invalid={error ? 'true' : undefined}
                      aria-describedby={error ? 'login-error' : undefined}
                      className="h-11 min-h-[44px] rounded-xl pr-11 text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'Hide secret characters' : 'Show secret characters'}
                      className="absolute right-0 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-xl"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.div
                    id="login-error"
                    role="alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3 py-2"
                  >
                    {error}
                  </motion.div>
                )}

                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full h-11 min-h-[44px] rounded-xl text-base"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-5 space-y-2 text-center">
                <p className="text-xs text-muted-foreground">
                  New candidate?{' '}
                  <Link href="/signup" className="text-primary hover:underline underline-offset-2 font-medium">
                    Create an account
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  <Link href="/" className="hover:text-foreground underline underline-offset-2">&larr; Back to home</Link>
                </p>
              </div>
            </CardContent>
          </Card>

          <LegalFooter compact className="mt-6" />
        </motion.div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <SessionProvider>
      <React.Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }>
        <LoginInner />
      </React.Suspense>
    </SessionProvider>
  )
}
