'use client'

// Shared support-ticket conversation thread (feature gap D3), used by
// the portal, admin and agent support pages. The ticket description
// renders as the opening entry; SupportTicketMessage rows follow.
// The status control renders exactly the transitions the API
// enforces (SUPPORT_TRANSITIONS in src/lib/support.ts) — no dead
// controls: CLOSED offers no moves and no reply box.

import * as React from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { formatStatus } from '@/components/ui/status-badge'
import {
  nextSupportStatuses,
  type SupportStatusValue,
} from '@/lib/support'
import { cn } from '@/lib/utils'

export interface ThreadMessage {
  id: string
  body: string
  createdAt: string
  author: { id: string; name: string; role: string }
  mine: boolean
}

function fmtWhen(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

export function TicketThread({
  openingBody,
  openingAt,
  openingAuthorLabel,
  messages,
  status,
  resolution,
  viewerIsBorrower,
  replyPending,
  onReply,
}: {
  openingBody: string
  openingAt: string
  /** Who wrote the opening description — "You" for the borrower, the borrower's name for staff. */
  openingAuthorLabel: string
  messages: ThreadMessage[]
  status: SupportStatusValue
  resolution?: string | null
  viewerIsBorrower: boolean
  replyPending?: boolean
  onReply: (body: string) => void
}) {
  const [draft, setDraft] = React.useState('')
  const closed = status === 'CLOSED'

  const authorLabel = (m: ThreadMessage) => {
    if (m.mine) return 'You'
    if (m.author.role === 'CANDIDATE') return m.author.name
    return viewerIsBorrower ? 'Support team' : `${m.author.name} (${formatStatus(m.author.role)})`
  }

  const submit = () => {
    const body = draft.trim()
    if (!body) return
    onReply(body)
    setDraft('')
  }

  return (
    <div className="space-y-3">
      <div className="max-h-[45vh] overflow-y-auto space-y-3 pr-1">
        {/* Opening entry — the ticket description itself. */}
        <div className="rounded-lg bg-muted/40 border border-border p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {openingAuthorLabel} · {fmtWhen(openingAt)}
          </p>
          <p className="text-sm whitespace-pre-wrap mt-1">{openingBody || 'No description provided.'}</p>
        </div>

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'rounded-lg border p-3',
              m.mine ? 'bg-primary/5 border-primary/25' : 'bg-card border-border',
            )}
          >
            <p className="text-[11px] font-semibold text-muted-foreground">
              {authorLabel(m)} · {fmtWhen(m.createdAt)}
            </p>
            <p className="text-sm whitespace-pre-wrap mt-1">{m.body}</p>
          </div>
        ))}

        {resolution && (
          <div className="rounded-lg bg-success/10 border border-success/20 p-3">
            <p className="text-[11px] font-semibold text-success">Resolution notes</p>
            <p className="text-sm whitespace-pre-wrap mt-1">{resolution}</p>
          </div>
        )}
      </div>

      {closed ? (
        <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 border border-border p-3">
          This ticket is closed. {viewerIsBorrower ? 'Please raise a new ticket if you still need help.' : 'It cannot be replied to or moved to another status.'}
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="ticket-reply">Reply</Label>
          <Textarea
            id="ticket-reply"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={viewerIsBorrower ? 'Write a reply to the support team…' : 'Write a reply to the borrower…'}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={replyPending || !draft.trim()}>
              <Send className="h-3.5 w-3.5" /> Send Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Staff status control: a select of exactly the legal next statuses
 * for the ticket's current state, plus an optional resolution note
 * when the target is RESOLVED. Renders nothing actionable for
 * terminal CLOSED tickets.
 */
export function SupportStatusControl({
  status,
  pending,
  onApply,
}: {
  status: SupportStatusValue
  pending?: boolean
  onApply: (to: SupportStatusValue, resolution?: string) => void
}) {
  const options = nextSupportStatuses(status)
  const [target, setTarget] = React.useState<SupportStatusValue | ''>('')
  const [resolution, setResolution] = React.useState('')

  // Reset the picker whenever the ticket's status changes underneath
  // us (render-phase adjustment, per React's guidance — no effect).
  const [prevStatus, setPrevStatus] = React.useState(status)
  if (prevStatus !== status) {
    setPrevStatus(status)
    setTarget('')
    setResolution('')
  }

  if (options.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Status: <span className="font-semibold text-foreground">{formatStatus(status)}</span> — closed tickets cannot change status.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2.5">
      <p className="text-xs font-semibold">Change status <span className="font-normal text-muted-foreground">(currently {formatStatus(status)})</span></p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={target} onValueChange={(v) => setTarget(v as SupportStatusValue)}>
          <SelectTrigger className="sm:w-52"><SelectValue placeholder="Move to…" /></SelectTrigger>
          <SelectContent>
            {options.map((s) => <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-10"
          disabled={!target || pending}
          onClick={() => target && onApply(target, target === 'RESOLVED' && resolution.trim() ? resolution.trim() : undefined)}
        >
          Apply
        </Button>
      </div>
      {target === 'RESOLVED' && (
        <Textarea
          rows={2}
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="Resolution note (optional) — stored on the ticket and shown to the borrower"
        />
      )}
    </div>
  )
}
