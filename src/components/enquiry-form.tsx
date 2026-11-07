'use client'

// Homepage enquiry form — posts to POST /api/enquiries.
// Plain controlled form + fetch (not the portal api-client: this is a
// public, unauthenticated surface). On success the form swaps to a
// confirmation panel in place — no navigation, no reload.

import * as React from 'react'
import { CheckCircle2, Send, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ENQUIRY_HONEYPOT_FIELD } from '@/lib/enquiries'

interface FormState {
  name: string
  mobile: string
  businessName: string
  email: string
  message: string
  website: string
}

const EMPTY: FormState = { name: '', mobile: '', businessName: '', email: '', message: '', website: '' }

export function EnquiryForm() {
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submitted, setSubmitted] = React.useState(false)

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          mobile: form.mobile.trim(),
          businessName: form.businessName.trim(),
          email: form.email.trim() ? form.email.trim() : undefined,
          message: form.message.trim(),
          [ENQUIRY_HONEYPOT_FIELD]: form.website,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const details = (json?.error?.details as Array<{ message?: string }> | undefined)?.[0]?.message
        setError(details || json?.error?.message || 'Something went wrong. Please try again.')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Could not submit your enquiry. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-6 sm:p-8 text-center" role="status">
        <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
        <h3 className="text-lg font-semibold mt-3">Enquiry received</h3>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
          Thank you — your enquiry has been recorded and our team will get back to you on the mobile
          number you shared.
        </p>
        <Button
          variant="outline"
          className="mt-5 h-11 rounded-xl"
          onClick={() => {
            setForm(EMPTY)
            setSubmitted(false)
          }}
        >
          Send another enquiry
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="enquiry-name">Full name</Label>
          <Input
            id="enquiry-name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={200}
            placeholder="e.g. Priya Sharma"
            value={form.name}
            onChange={set('name')}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enquiry-mobile">Mobile number</Label>
          <Input
            id="enquiry-mobile"
            name="mobile"
            autoComplete="tel"
            inputMode="tel"
            required
            minLength={10}
            maxLength={20}
            placeholder="10-digit mobile number"
            value={form.mobile}
            onChange={set('mobile')}
            className="h-11"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="enquiry-business">Business / organisation name</Label>
          <Input
            id="enquiry-business"
            name="businessName"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={200}
            placeholder="e.g. Sharma Micro Finance"
            value={form.businessName}
            onChange={set('businessName')}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enquiry-email">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="enquiry-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={200}
            placeholder="you@example.com"
            value={form.email}
            onChange={set('email')}
            className="h-11"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="enquiry-message">What do you need?</Label>
        <Textarea
          id="enquiry-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          placeholder="Tell us about your lending business — how many borrowers and agents you have, and what you want to manage better."
          value={form.message}
          onChange={set('message')}
          className="text-base sm:text-sm"
        />
      </div>

      {/* Honeypot: invisible to humans, tempting to bots. Any value
          here means the submission is silently discarded server-side. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name={ENQUIRY_HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={set('website')}
          />
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full sm:w-auto h-12 px-8 rounded-xl shadow-glow" disabled={submitting}>
        {submitting ? 'Sending…' : (<>Send enquiry <Send className="ml-2 h-4 w-4" /></>)}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Your details are used only to respond to this enquiry.
      </p>
    </form>
  )
}
