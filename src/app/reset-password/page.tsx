'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Wallet, Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { api, ApiRequestError } from '@/lib/api-client'

function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [showPass, setShowPass] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('This reset link is missing its token. Please request a new reset link.')
      return
    }
    if (newPassword.length < 10) {
      setError('Password must be at least 10 characters, with uppercase, lowercase and a digit')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await api.post('/api/auth/reset-password', { token, newPassword })
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not reset your password. The link may be expired — request a new one.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/40">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="h-10 w-10 rounded-xl bg-gradient-fintech flex items-center justify-center text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="font-bold">Set New Password</p>
        </div>

        <Card className="rounded-2xl shadow-premium">
          <CardContent className="p-6 sm:p-8">
            {!token ? (
              <div className="text-center space-y-3">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                <h1 className="text-xl font-bold">Invalid reset link</h1>
                <p className="text-sm text-muted-foreground">This page needs a reset token. Request a fresh link from the forgot-password page.</p>
                <Button asChild className="w-full mt-2">
                  <Link href="/forgot-password">Request a New Link</Link>
                </Button>
              </div>
            ) : done ? (
              <div className="text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <h1 className="text-xl font-bold">Password reset</h1>
                <p className="text-sm text-muted-foreground">Your password has been reset and all active sessions have been signed out. Sign in with your new password.</p>
                <Button className="w-full mt-2" onClick={() => router.push('/login')}>
                  Go to Sign In
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
                <p className="text-sm text-muted-foreground mt-1.5">At least 10 characters, with uppercase, lowercase and a digit.</p>
                <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="newPassword"
                        type={showPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••"
                        autoComplete="new-password"
                        required
                        minLength={10}
                        className="pl-9 pr-11 h-11 rounded-xl text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                        className="absolute right-0 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-r-xl"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="confirmPassword"
                        type={showPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••"
                        autoComplete="new-password"
                        required
                        minLength={10}
                        className="pl-9 h-11 rounded-xl text-base"
                      />
                    </div>
                  </div>
                  {error && (
                    <div role="alert" className="rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3 py-2">
                      {error}
                    </div>
                  )}
                  <Button type="submit" disabled={busy} className="w-full h-11 rounded-xl text-base">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset Password'}
                  </Button>
                </form>
                <p className="text-sm text-muted-foreground text-center mt-5">
                  Link expired? <Link href="/forgot-password" className="text-primary hover:underline">Request a new one</Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordInner />
    </React.Suspense>
  )
}
