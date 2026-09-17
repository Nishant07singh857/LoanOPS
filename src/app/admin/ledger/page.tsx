'use client'

import * as React from 'react'
import {
  BookOpen, Download, Search, Info, ArrowDownRight, ArrowUpRight,
  Banknote, Receipt, Undo2, FilePen, FileText,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { FadeIn } from '@/components/ui/motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { ledgerEntries } from '@/lib/mock-data'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

const typeIcon: Record<string, React.ReactNode> = {
  DISBURSEMENT: <Banknote className="h-3.5 w-3.5" />,
  PAYMENT_PRINCIPAL: <Receipt className="h-3.5 w-3.5" />,
  PAYMENT_INTEREST: <Receipt className="h-3.5 w-3.5" />,
  PAYMENT_FEES: <Receipt className="h-3.5 w-3.5" />,
  REFUND: <Undo2 className="h-3.5 w-3.5" />,
  CORRECTION: <FilePen className="h-3.5 w-3.5" />,
  REVERSAL: <Undo2 className="h-3.5 w-3.5" />,
  FEE: <Receipt className="h-3.5 w-3.5" />,
}

const typeTint: Record<string, string> = {
  DISBURSEMENT: 'bg-destructive/15 text-destructive',
  PAYMENT_PRINCIPAL: 'bg-success/15 text-success',
  PAYMENT_INTEREST: 'bg-success/15 text-success',
  PAYMENT_FEES: 'bg-info/15 text-info',
  REFUND: 'bg-warning/15 text-warning',
  CORRECTION: 'bg-warning/15 text-warning',
  REVERSAL: 'bg-warning/15 text-warning',
  FEE: 'bg-info/15 text-info',
}

export default function LedgerPage() {
  const [search, setSearch] = React.useState('')

  const filtered = ledgerEntries.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      e.entryNumber.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      e.debitAccount.toLowerCase().includes(q) ||
      e.creditAccount.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      (e.reference || '').toLowerCase().includes(q)
    )
  })

  const totalDebit = filtered.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Ledger"
        description="Append-only double-entry ledger. All entries are immutable — corrections go through the Corrections workflow."
        icon={<BookOpen className="h-5 w-5" />}
        action={
          <Button variant="outline" size="sm" onClick={() => toast.success('Exporting ledger...', { description: 'CSV export will download shortly.' })}>
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      <FadeIn>
        <div className="rounded-xl border border-info/30 bg-info/5 px-4 py-3 flex items-start gap-3 text-sm">
          <Info className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-info">Ledger is append-only</p>
            <p className="text-muted-foreground text-xs mt-0.5">No frontend balance editing. Corrections require approval and are recorded as separate entries with reversal references.</p>
          </div>
        </div>
      </FadeIn>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FadeIn>
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Entries</p>
              <p className="text-2xl font-bold tabular-nums">{ledgerEntries.length}</p>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.05}>
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold tabular-nums">{formatPaiseToINRShort(totalDebit)}</p>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.1}>
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Disbursements</p>
              <p className="text-2xl font-bold tabular-nums text-destructive">{ledgerEntries.filter((e) => e.type === 'DISBURSEMENT').length}</p>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.15}>
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Collections</p>
              <p className="text-2xl font-bold tabular-nums text-success">{ledgerEntries.filter((e) => e.type.startsWith('PAYMENT')).length}</p>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Search */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search entry #, type, account, reference..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Ledger table */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2"><CardTitle className="text-base">Ledger Entries</CardTitle><CardDescription>{filtered.length} entries shown</CardDescription></CardHeader>
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-6">Entry #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Debit Account</TableHead>
                    <TableHead>Credit Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="pr-6">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-6 font-mono text-xs font-semibold">{e.entryNumber}</TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', typeTint[e.type])}>
                          {typeIcon[e.type]} {e.type.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1 text-destructive"><ArrowDownRight className="h-3 w-3" />{e.debitAccount}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1 text-success"><ArrowUpRight className="h-3 w-3" />{e.creditAccount}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(e.amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">{e.description}</TableCell>
                      <TableCell className="font-mono text-xs">{e.reference || '—'}</TableCell>
                      <TableCell className="pr-6 text-sm">{e.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden space-y-3">
              {filtered.map((e) => (
                <div key={e.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs font-semibold">{e.entryNumber}</p>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium mt-1', typeTint[e.type])}>{typeIcon[e.type]} {e.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">{formatPaiseToINR(e.amount)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border text-xs">
                    <div><p className="text-muted-foreground">Debit</p><p className="text-destructive font-medium">{e.debitAccount}</p></div>
                    <div><p className="text-muted-foreground">Credit</p><p className="text-success font-medium">{e.creditAccount}</p></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{e.description}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{e.date} · {e.reference}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
