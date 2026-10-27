'use client'

import {
  ResponsiveContainer,
  Tooltip, Legend, Cell, Pie, PieChart,
} from 'recharts'

export default function PtpFulfillmentChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--popover-foreground)', fontSize: 12, padding: '8px 12px' }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
