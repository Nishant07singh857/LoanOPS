'use client'

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatPaiseToINR, formatPaiseToINRShort } from '@/lib/money'

export default function PortfolioTrendChart({ data }: { data: { label: string; disbursed: number; collected: number; outstanding: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="dG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="oG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          axisLine={false} tickLine={false} width={50}
          tickFormatter={(v: number) => formatPaiseToINRShort(v as number)}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12,
            color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px',
          }}
          formatter={(v: number, n: string) => [formatPaiseToINR(v as number), n]}
        />
        <Area type="monotone" dataKey="disbursed" stroke="var(--chart-1)" strokeWidth={2} fill="url(#dG)" />
        <Area type="monotone" dataKey="collected" stroke="var(--chart-2)" strokeWidth={2} fill="url(#cG)" />
        <Area type="monotone" dataKey="outstanding" stroke="var(--chart-3)" strokeWidth={2} fill="url(#oG)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
