'use client'

import * as React from 'react'
import Link from 'next/link'
import { FileText, Info, ShieldCheck, Clock, Banknote } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatPaiseToINR } from '@/lib/money'
import { COMPLIANCE_CONFIG } from '@/lib/compliance-config'
import { cn } from '@/lib/utils'

export interface KfsDisclosureProps {
  principalPaise: number | string | bigint
  interestType?: 'PERCENTAGE' | 'FIXED' | 'NONE' | string | null
  interestRateBps?: number | string | null // 100 = 1%
  fixedInterestPaise?: number | string | bigint | null
  processingFeePaise?: number | string | bigint | null
  otherFeesPaise?: number | string | bigint | null
  totalRepayablePaise?: number | string | bigint | null
  installmentAmountPaise?: number | string | bigint | null
  installments: number
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | string
  borrowerName?: string
  lenderName?: string
  compact?: boolean
  className?: string
}

function toSafePaise(v: number | string | bigint | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'bigint' ? Number(v) : Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

export function KfsDisclosure({
  principalPaise,
  interestType = 'PERCENTAGE',
  interestRateBps = 0,
  fixedInterestPaise = 0,
  processingFeePaise = 0,
  otherFeesPaise = 0,
  totalRepayablePaise,
  installmentAmountPaise,
  installments,
  frequency,
  borrowerName,
  lenderName = COMPLIANCE_CONFIG.companyName,
  compact = false,
  className,
}: KfsDisclosureProps) {
  const principal = toSafePaise(principalPaise)
  const procFee = toSafePaise(processingFeePaise)
  const otherFee = toSafePaise(otherFeesPaise)
  const totalFees = procFee + otherFee
  const bps = toSafePaise(interestRateBps)
  const fixedInt = toSafePaise(fixedInterestPaise)
  const instCount = Math.max(1, Number(installments) || 1)
  const freq = String(frequency || 'MONTHLY').toUpperCase()

  // Compute total interest if not derived from totalRepayablePaise
  let totalInterest = 0
  if (interestType === 'NONE') {
    totalInterest = 0
  } else if (interestType === 'FIXED') {
    totalInterest = fixedInt
  } else {
    totalInterest = Math.trunc((principal * bps) / 10000)
  }

  const totalRepayable =
    totalRepayablePaise !== undefined && totalRepayablePaise !== null
      ? toSafePaise(totalRepayablePaise)
      : principal + totalInterest + totalFees

  const installmentAmount =
    installmentAmountPaise !== undefined && installmentAmountPaise !== null
      ? toSafePaise(installmentAmountPaise)
      : Math.trunc(totalRepayable / instCount)

  // Net disbursed amount (Principal less any upfront deducted fees; in this platform fees are part of schedule, so both Gross Principal and Total Cost of Credit are clearly disclosed)
  const netDisbursed = Math.max(0, principal)
  const totalCostOfCredit = totalInterest + totalFees

  // Compute tenure in days for annualized APR estimate
  const tenureDays =
    freq === 'DAILY'
      ? instCount
      : freq === 'WEEKLY'
        ? instCount * 7
        : instCount * 30

  // Effective Annualized Percentage Rate (APR %) = (Total Cost of Credit / Principal) * (365 / TenureDays) * 100
  const effectiveAprPct =
    principal > 0 && tenureDays > 0
      ? ((totalCostOfCredit / principal) * (365 / tenureDays) * 100).toFixed(2)
      : '0.00'

  const nominalRateDisplay =
    interestType === 'NONE'
      ? '0.00% (Zero Interest)'
      : interestType === 'FIXED'
        ? `Fixed (${formatPaiseToINR(fixedInt)})`
        : `${(bps / 100).toFixed(2)}% flat for tenure`

  return (
    <Card className={cn('rounded-2xl border-primary/25 shadow-sm overflow-hidden', className)}>
      <CardHeader className={cn('bg-primary/5 border-b border-border/60', compact ? 'p-4' : 'p-5 sm:p-6')}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">
                Key Facts Statement (KFS) — RBI Format
              </CardTitle>
              <CardDescription className="text-xs">
                Mandatory standardized loan disclosure under RBI Digital Lending &amp; KFS Guidelines
              </CardDescription>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" /> APR: {effectiveAprPct}% p.a.
          </span>
        </div>
      </CardHeader>

      <CardContent className={cn('space-y-4', compact ? 'p-4' : 'p-5 sm:p-6')}>
        {borrowerName && (
          <div className="text-xs text-muted-foreground flex flex-wrap justify-between gap-2 pb-2 border-b border-border/50">
            <span>
              Borrower: <strong className="text-foreground">{borrowerName}</strong>
            </span>
            <span>
              Lender / Platform: <strong className="text-foreground">{lenderName}</strong>
            </span>
          </div>
        )}

        <div className="overflow-x-auto table-scroll rounded-xl border border-border/70">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-muted/60 text-left border-b border-border/70">
                <th className="py-2.5 px-3 font-semibold text-muted-foreground w-10">#</th>
                <th className="py-2.5 px-3 font-semibold">Parameter</th>
                <th className="py-2.5 px-3 font-semibold text-right">Details / Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr>
                <td className="py-2 px-3 text-muted-foreground font-mono">1</td>
                <td className="py-2 px-3 font-medium">Sanctioned Loan Principal Amount</td>
                <td className="py-2 px-3 text-right font-semibold">{formatPaiseToINR(principal)}</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-muted-foreground font-mono">2</td>
                <td className="py-2 px-3">
                  Total Interest Chargeable
                  <span className="block text-[11px] text-muted-foreground">{nominalRateDisplay}</span>
                </td>
                <td className="py-2 px-3 text-right font-medium">{formatPaiseToINR(totalInterest)}</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-muted-foreground font-mono">3</td>
                <td className="py-2 px-3">
                  Upfront / Scheduled Fees &amp; Charges
                  <span className="block text-[11px] text-muted-foreground">
                    Processing Fee: {formatPaiseToINR(procFee)} · Other Fees: {formatPaiseToINR(otherFee)}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-medium">{formatPaiseToINR(totalFees)}</td>
              </tr>
              <tr className="bg-emerald-500/5">
                <td className="py-2 px-3 text-muted-foreground font-mono">4</td>
                <td className="py-2 px-3 font-semibold text-emerald-700 dark:text-emerald-300">
                  Net Disbursed Amount to Borrower
                </td>
                <td className="py-2 px-3 text-right font-bold text-emerald-700 dark:text-emerald-300">
                  {formatPaiseToINR(netDisbursed)}
                </td>
              </tr>
              <tr className="bg-primary/5">
                <td className="py-2.5 px-3 text-muted-foreground font-mono">5</td>
                <td className="py-2.5 px-3 font-bold">Total Amount to be Paid by Borrower (1 + 2 + 3)</td>
                <td className="py-2.5 px-3 text-right font-bold text-primary text-sm sm:text-base">
                  {formatPaiseToINR(totalRepayable)}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-muted-foreground font-mono">6</td>
                <td className="py-2 px-3 font-semibold">
                  Effective Annual Percentage Rate (APR)
                  <span className="block text-[11px] text-muted-foreground font-normal">
                    All-inclusive annualized cost (Interest + Fees) over {tenureDays} days
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-bold font-mono">{effectiveAprPct}% p.a.</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-muted-foreground font-mono">7</td>
                <td className="py-2 px-3">Repayment Tenure &amp; Frequency</td>
                <td className="py-2 px-3 text-right font-medium">
                  {instCount} {freq.toLowerCase()} installment{instCount > 1 ? 's' : ''}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-muted-foreground font-mono">8</td>
                <td className="py-2 px-3">Installment Amount (EPI)</td>
                <td className="py-2 px-3 text-right font-semibold">{formatPaiseToINR(installmentAmount)}</td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-muted-foreground font-mono">9</td>
                <td className="py-2 px-3">Cooling-Off / Look-Up Period</td>
                <td className="py-2 px-3 text-right font-medium">
                  {COMPLIANCE_CONFIG.coolingOffDays} Calendar Days from Disbursement
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 text-muted-foreground font-mono">10</td>
                <td className="py-2 px-3">Contingent / Penal Charges on Overdue</td>
                <td className="py-2 px-3 text-right text-xs">
                  No hidden or compounding penal interest; any late fee is disclosed upfront &amp; charged as non-compounding penal charge only.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-muted/50 border border-border/60 p-3 flex items-start gap-2.5">
            <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">3-Day Cooling-Off Right</p>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                You may exit the loan within {COMPLIANCE_CONFIG.coolingOffDays} days of disbursement by repaying principal plus proportionate APR without any prepayment penalty.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-muted/50 border border-border/60 p-3 flex items-start gap-2.5">
            <Banknote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Offline Cash Collection &amp; Receipts</p>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                Cash repayments are collected only by authorized field agents ({COMPLIANCE_CONFIG.collectionHours}) and require an official digital receipt verified on your portal.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
          <span className="inline-flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-primary" />
            Grievance Officer: {COMPLIANCE_CONFIG.grievanceOfficer.name} ({COMPLIANCE_CONFIG.grievanceOfficer.email})
          </span>
          <Link href="/kfs" className="text-primary hover:underline font-medium">
            Full KFS &amp; APR Guide &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
