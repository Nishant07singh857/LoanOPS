'use client'

import * as React from 'react'
import {
  CalendarClock, CheckCircle2, Clock, CreditCard, IndianRupee,
  Banknote, Receipt, AlertCircle, Wallet,
} from 'lucide-react'
import { SectionHeading } from '@/components/ui/section-heading'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge, formatStatus } from '@/components/ui/status-badge'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion'
import { toast } from 'sonner'
import { candidateLoan, candidateInstallments, type CandidateInstallment } from '@/lib/mock-data'
import { formatPaiseToINR } from '@/lib/money'
import { cn } from '@/lib/utils'

// Extend candidateInstallments to show all 12 installments
const MONTHS = ['Aug 2024', 'Sep 2024', 'Oct 2024', 'Nov 2024', 'Dec 2024', 'Jan 2025', 'Feb 2025', 'Mar 2025', 'Apr 2025', 'May 2025', 'Jun 2025', 'Jul 2025']
const extendedInstallments: CandidateInstallment[] = (() => {
  const result: CandidateInstallment[] = [...candidateInstallments]
  for (let i = 6; i < candidateLoan.installments; i++) {
    result.push({
      number: i + 1,
      dueDate: `20 ${MONTHS[i]}`,
      principal: 500000,
      interest: 242500,
      fees: 0,
      totalDue: 742500,
      status: 'UPCOMING',
    })
  }
  return result
})()

export default function SchedulePage() {
  const installments = extendedInstallments
  const paid = installments.filter((i) => i.status === 'PAID').length
  const upcoming = installments.filter((i) => i.status === 'UPCOMING').length
  const due = installments.filter((i) => i.status === 'DUE').length
  const overdue = installments.filter((i) => i.status === 'OVERDUE').length
  const progress = Math.round((paid / installments.length) * 100)
  const nextDue = installments.find((i) => i.status === 'DUE')

  const onPay = (n: number) => toast.success('Pay Now opened', { description: `Redirecting to payment for installment #${n}…` })

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Repayment Schedule"
        description="Every installment, at a glance. Stay ahead — pay before the due date."
        icon={<CalendarClock className="h-5 w-5" />}
      />

      {/* KPI strip */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem>
          <KPICard label="Total Installments" value={String(installments.length)} icon={<CalendarClock className="h-5 w-5" />} variant="default" />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Paid" value={String(paid)} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Due / Upcoming" value={String(due + upcoming)} icon={<Clock className="h-5 w-5" />} variant="info" />
        </StaggerItem>
        <StaggerItem>
          <KPICard label="Overdue" value={String(overdue)} icon={<AlertCircle className="h-5 w-5" />} variant={overdue > 0 ? 'destructive' : 'default'} />
        </StaggerItem>
      </StaggerContainer>

      {/* Progress + Next due */}
      <FadeIn>
        <Card className="shadow-premium border-success/15">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-success/15 text-success flex items-center justify-center">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Repayment progress</p>
                  <p className="text-xs text-muted-foreground">{paid} of {installments.length} paid · {progress}% complete</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-bold tabular-nums">{formatPaiseToINR(candidateLoan.outstandingPrincipal + candidateLoan.outstandingInterest)}</p>
              </div>
            </div>
            <Progress value={progress} className="h-3" />
            {/* Timeline visual */}
            <div className="flex items-center gap-1 mt-1">
              {installments.map((i) => (
                <div
                  key={i.number}
                  className={cn(
                    'h-2 flex-1 rounded-full transition-all',
                    i.status === 'PAID' ? 'bg-success' :
                    i.status === 'DUE' ? 'bg-warning' :
                    i.status === 'OVERDUE' ? 'bg-destructive' :
                    i.status === 'PARTIALLY_PAID' ? 'bg-warning/60' : 'bg-muted'
                  )}
                  title={`Installment ${i.number}: ${formatStatus(i.status)}`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Aug 2024</span>
              <span>Jul 2025</span>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Next Due highlight */}
      {nextDue && (
        <FadeIn>
          <Card className="shadow-premium border-warning/20 bg-gradient-to-br from-warning/10 via-card to-card">
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-warning/15 text-warning flex items-center justify-center flex-shrink-0">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-warning uppercase tracking-wider font-semibold">Next Due</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-0.5 tabular-nums">{formatPaiseToINR(nextDue.totalDue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Installment #{nextDue.number} · {nextDue.dueDate}</p>
                </div>
              </div>
              <Button size="lg" onClick={() => onPay(nextDue.number)} className="min-h-[44px]">
                <CreditCard className="h-4 w-4" /> Pay Now
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Full installment list */}
      <FadeIn>
        <Card className="shadow-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Installments</CardTitle>
            <CardDescription className="text-xs">{installments.length} scheduled · {paid} paid</CardDescription>
          </CardHeader>
          <CardContent>
            <StaggerContainer className="space-y-2.5">
              {installments.map((inst) => (
                <StaggerItem key={inst.number}>
                  <div
                    className={cn(
                      'rounded-xl border bg-card p-3.5 transition-all',
                      inst.status === 'PAID' ? 'border-success/30 bg-success/5' :
                      inst.status === 'DUE' ? 'border-warning/30 bg-warning/5' :
                      inst.status === 'OVERDUE' ? 'border-destructive/30 bg-destructive/5' :
                      inst.status === 'PARTIALLY_PAID' ? 'border-warning/30 bg-warning/5' :
                      'border-border hover:border-primary/40 hover:shadow-premium'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Number badge */}
                      <div className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm',
                        inst.status === 'PAID' ? 'bg-success/15 text-success' :
                        inst.status === 'DUE' ? 'bg-warning/15 text-warning' :
                        inst.status === 'OVERDUE' ? 'bg-destructive/15 text-destructive' :
                        inst.status === 'PARTIALLY_PAID' ? 'bg-warning/15 text-warning' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {inst.status === 'PAID' ? <CheckCircle2 className="h-5 w-5" /> : `#${inst.number}`}
                      </div>
                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold">Installment #{inst.number}</p>
                            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                              <CalendarClock className="h-3 w-3" /> {inst.dueDate}
                            </p>
                          </div>
                          <StatusBadge variant={inst.status}>{formatStatus(inst.status)}</StatusBadge>
                        </div>
                        {/* Breakdown */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <IndianRupee className="h-3 w-3" /> Principal: {formatPaiseToINR(inst.principal)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Banknote className="h-3 w-3" /> Interest: {formatPaiseToINR(inst.interest)}
                          </span>
                          {inst.fees > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Receipt className="h-3 w-3" /> Fees: {formatPaiseToINR(inst.fees)}
                            </span>
                          )}
                        </div>
                        {/* Total + paidAt / pay button */}
                        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-border/60">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Due</p>
                            <p className="text-sm font-bold tabular-nums">{formatPaiseToINR(inst.totalDue)}</p>
                          </div>
                          {inst.status === 'PAID' && inst.paidAt && (
                            <p className="text-[11px] text-success inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Paid {inst.paidAt}
                            </p>
                          )}
                          {(inst.status === 'DUE' || inst.status === 'OVERDUE') && (
                            <Button size="sm" onClick={() => onPay(inst.number)}>
                              <CreditCard className="h-3.5 w-3.5" /> Pay Now
                            </Button>
                          )}
                          {inst.status === 'PARTIALLY_PAID' && (
                            <Button size="sm" variant="outline" onClick={() => onPay(inst.number)}>
                              <CreditCard className="h-3.5 w-3.5" /> Pay Balance
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}
