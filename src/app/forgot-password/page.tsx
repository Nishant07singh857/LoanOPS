'use client'

import * as React from 'react'
import Link from 'next/link'
import { Wallet, Loader2, Mail, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { api, ApiRequestError } from '@/lib/api-client'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)
  const [devResetToken, setDevResetToken] = React.useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const value = identifier.trim()
    if (!value) {
      setError('Enter your registered email address or mobile number')
      return
    }
    setBusy(true)
    try {
      const res = await api.post<{ message: string; devResetToken?: string }>('/api/auth/forgot-password',
        value.includes('@') ? { email: value.toLowerCase() } : { mobile: value.replace(/\D/g, '') })
      setDevResetToken(res.devResetToken ?? null)
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not process your request. Please try again.')
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
          <p className="font-bold">Forgot Password</p>
        </div>

        <Card className="rounded-2xl shadow-premium">
          <CardContent className="p-6 sm:p-8">
            {done ? (
              <div className="text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <h1 className="text-xl font-bold">Check your email</h1>
                <p className="text-sm text-muted-foreground">
                  If an active account matches the details you entered, password reset instructions have been issued. The link expires shortly and can be used once.
                </p>
                {devResetToken && (
                  <p className="text-xs rounded-lg bg-warning/10 border border-warning/30 px-3 py-2">
                    Development only: <Link className="text-primary underline" href={`/reset-password?token=${encodeURIComponent(devResetToken)}`}>open your reset link</Link>
                  </p>
                )}
                <Button asChild className="w-full mt-2">
                  <Link href="/login">Back to Sign In</Link>
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
                <p className="text-sm text-muted-foreground mt-1.5">Enter the email address (or mobile number) on your account and we will issue reset instructions.</p>
                <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="identifier">Email or Mobile Number</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="identifier"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="you@example.com or 9876543210"
                        autoComplete="username"
                        required
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
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Reset Instructions'}
                  </Button>
                </form>
                <p className="text-sm text-muted-foreground text-center mt-5">
                  Remembered it? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
