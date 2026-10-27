'use client'

import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatPaiseToINR } from '@/lib/money'

export default function OverdueAgingChart({ data }: { data: { bucket: string; count: number; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          contentStyle={{
            background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12,
            color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px',
          }}
          formatter={(v: number, n: string) => [n === 'amount' ? formatPaiseToINR(v as number) : v, n === 'amount' ? 'Amount' : 'Count']}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={`oklch(${60 - i * 8}% 0.18 ${30 + i * 4})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
