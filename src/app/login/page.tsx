'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Wallet, ShieldCheck, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SessionProvider, useSession, type Role } from '@/lib/session'

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/admin'
  const requestedRole = (params.get('role') || 'OWNER') as Role
  const { login, loginCandidate } = useSession()

  const [role, setRole] = React.useState<Role>(requestedRole)
  const [email, setEmail] = React.useState('')
  const [mobile, setMobile] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPass, setShowPass] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setRole(requestedRole)
  }, [requestedRole])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      let r
      if (role === 'CANDIDATE') {
        if (!mobile.trim()) {
          setError('Mobile number is required')
          setBusy(false)
          return
        }
        r = await loginCandidate(mobile.trim(), password)
      } else {
        if (!email.trim()) {
          setError('Email is required')
          setBusy(false)
          return
        }
        r = await login(email.trim(), password)
      }
      if (r.ok) {
        router.push(redirect)
      } else {
        setError(r.error || 'Login failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const fillDemo = () => {
    if (role === 'OWNER') {
      setEmail('owner@loanops.in')
      setPassword('Owner@123')
    } else if (role === 'AGENT') {
      setEmail('agent@loanops.in')
      setPassword('Agent@123')
    } else {
      setMobile('9820277789')
      setPassword('Candidate@123')
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
              <p className="text-xs text-primary-foreground/70 uppercase tracking-wider">Premium Loan Operations</p>
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
                <div key={t} className="rounded-xl bg-primary-foreground/10 backdrop-blur p-3">
                  <p className="font-semibold text-sm">{t}</p>
                  <p className="text-xs text-primary-foreground/70 mt-0.5">{d}</p>
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
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
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
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Premium Loan Operations</p>
            </div>
          </div>

          <Card className="rounded-2xl shadow-premium">
            <CardContent className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
              <p className="text-sm text-muted-foreground mt-1.5">Choose your portal and enter credentials.</p>

              {/* Role tabs */}
              <div className="mt-5 grid grid-cols-3 gap-1 p-1 bg-muted/50 rounded-xl">
                {(['OWNER', 'AGENT', 'CANDIDATE'] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setRole(r); setError(null) }}
                    className={
                      'relative py-2 px-3 rounded-lg text-sm font-medium transition-all ' +
                      (role === r
                        ? 'bg-card shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-5 space-y-4">
                {role === 'CANDIDATE' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="mobile">Mobile number</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="9820277789"
                      autoComplete="tel"
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={role === 'OWNER' ? 'owner@loanops.in' : 'agent@loanops.in'}
                      autoComplete="email"
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>
                )}

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
                      minLength={8}
                      className="h-11 rounded-xl pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.div
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
                  className="w-full h-11 rounded-xl text-base"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Sign in to {role.charAt(0) + role.slice(1).toLowerCase()} Portal
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {process.env.NODE_ENV !== 'production' && (
                <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Demo credentials</p>
                  <button
                    type="button"
                    onClick={fillDemo}
                    className="text-xs text-primary hover:underline"
                  >
                    Click to autofill demo credentials for {role}
                  </button>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                    {role === 'OWNER' && 'owner@loanops.in / Owner@123'}
                    {role === 'AGENT' && 'agent@loanops.in / Agent@123'}
                    {role === 'CANDIDATE' && 'Mobile 9820277789 / Candidate@123'}
                  </p>
                </div>
              )}

              <p className="text-center text-xs text-muted-foreground mt-5">
                <a href="/" className="hover:text-foreground underline underline-offset-2">← Back to home</a>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <SessionProvider>
      <LoginInner />
    </SessionProvider>
  )
}
