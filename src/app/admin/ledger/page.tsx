'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen, Download, Search, Info, ArrowDownRight, ArrowUpRight,
  Banknote, Receipt, Undo2, FilePen, AlertTriangle,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FadeIn, EmptyState } from '@/components/ui/motion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'
import { cn } from '@/lib/utils'

interface LedgerRow {
  id: string
  entryNumber: string
  type: string
  debitAccount: string
  creditAccount: string
  amount: string
  description?: string | null
  reference?: string | null
  createdAt: string
}

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

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LedgerPage() {
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('all')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-ledger', typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: '100' })
      if (typeFilter !== 'all') params.set('type', typeFilter)
      return api.get<{ items: LedgerRow[]; total: number }>(`/api/owner/ledger?${params.toString()}`)
    },
  })

  const allEntries = data?.items ?? []
  const filtered = allEntries.filter((e) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      e.entryNumber.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      e.debitAccount.toLowerCase().includes(q) ||
      e.creditAccount.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q) ||
      (e.reference ?? '').toLowerCase().includes(q)
    )
  })
  const totalDebit = filtered.reduce((s, e) => s + Number(e.amount), 0)

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.error('No ledger entries to export')
      return
    }
    const headers = ['Entry Number', 'Type', 'Debit Account', 'Credit Account', 'Amount (INR)', 'Description', 'Reference', 'Date']
    const rows = filtered.map((e) => [
      e.entryNumber,
      e.type,
      e.debitAccount,
      e.creditAccount,
      (Number(e.amount) / 100).toFixed(2),
      `"${(e.description ?? '').replace(/"/g, '""')}"`,
      e.reference ?? '',
      fmtDate(e.createdAt),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ledger-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Exporting ledger...', { description: `${filtered.length} entries exported to CSV.` })
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Ledger"
        description="Append-only double-entry ledger. All entries are immutable — corrections go through the Corrections workflow."
        icon={<BookOpen className="h-5 w-5" />}
        action={
          <Button
            variant="outline"
            size="sm"
            className="h-11 px-4"
            aria-label="Export ledger entries as CSV"
            onClick={handleExportCsv}
          >
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <FadeIn>
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Entries</p>
              <p className="text-2xl font-bold tabular-nums">{allEntries.length}</p>
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
              <p className="text-2xl font-bold tabular-nums text-destructive">{allEntries.filter((e) => e.type === 'DISBURSEMENT').length}</p>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.15}>
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Collections</p>
              <p className="text-2xl font-bold tabular-nums text-success">{allEntries.filter((e) => e.type.startsWith('PAYMENT')).length}</p>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <Card className="shadow-premium">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  aria-label="Search ledger entries by entry number, type, account, or reference"
                  placeholder="Search entry #, type, account, reference..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-11" aria-label="Filter by ledger entry type">
                  <SelectValue placeholder="All entry types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entry types</SelectItem>
                  <SelectItem value="DISBURSEMENT">Disbursement</SelectItem>
                  <SelectItem value="PAYMENT_PRINCIPAL">Payment Principal</SelectItem>
                  <SelectItem value="PAYMENT_INTEREST">Payment Interest</SelectItem>
                  <SelectItem value="PAYMENT_FEES">Payment Fees</SelectItem>
                  <SelectItem value="REFUND">Refund</SelectItem>
                  <SelectItem value="CORRECTION">Correction</SelectItem>
                  <SelectItem value="REVERSAL">Reversal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-2"><CardTitle className="text-base">Ledger Entries</CardTitle><CardDescription>{filtered.length} entries shown</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2" role="status" aria-label="Loading ledger entries">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3" role="alert">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
                <p className="text-sm font-medium text-destructive">Failed to load ledger entries</p>
                <Button variant="outline" size="sm" className="h-11 px-4" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No ledger entries" description="Ledger entries are posted automatically when loans are disbursed or payments are allocated." />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto w-full">
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
                            <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', typeTint[e.type] || 'bg-muted text-muted-foreground')}>
                              {typeIcon[e.type]} {e.type.replace(/_/g, ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="inline-flex items-center gap-1 text-destructive"><ArrowDownRight className="h-3 w-3" />{e.debitAccount}</span>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="inline-flex items-center gap-1 text-success"><ArrowUpRight className="h-3 w-3" />{e.creditAccount}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatPaiseToINR(Number(e.amount))}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">{e.description ?? '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{e.reference ?? '—'}</TableCell>
                          <TableCell className="pr-6 text-sm">{fmtDate(e.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden space-y-3">
                  {filtered.map((e) => (
                    <div key={e.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold truncate">{e.entryNumber}</p>
                          <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium mt-1', typeTint[e.type] || 'bg-muted text-muted-foreground')}>{typeIcon[e.type]} {e.type.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm font-semibold tabular-nums flex-shrink-0">{formatPaiseToINR(Number(e.amount))}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border text-xs">
                        <div className="min-w-0"><p className="text-muted-foreground">Debit</p><p className="text-destructive font-medium truncate">{e.debitAccount}</p></div>
                        <div className="min-w-0"><p className="text-muted-foreground">Credit</p><p className="text-success font-medium truncate">{e.creditAccount}</p></div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 break-words">{e.description ?? '—'}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{fmtDate(e.createdAt)} · {e.reference ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
