import type { ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatCOP, formatCOPShort } from '../lib/money';
import { formatMonth } from '../lib/dates';
import { Card } from './ui';

export function ChartCard({ title, badge, children, empty, height = 220 }: { title: string; badge?: ReactNode; children: ReactNode; empty?: string | false; height?: number }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {badge}
      </div>
      <div style={{ height }} className="text-slate-400">
        {empty ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-200 px-6 text-center text-sm dark:border-white/10">{empty}</div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

const tooltipStyle = {
  contentStyle: { borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.15)', background: '#0b1324', color: '#fff', fontSize: 12 },
  itemStyle: { color: '#fff' },
  labelStyle: { color: '#94a3b8', marginBottom: 4 },
};
const axis = { stroke: 'currentColor', fontSize: 11, tickLine: false, axisLine: false } as const;
const money = (v: unknown) => formatCOP(Number(v));
const monthTick = (v: string) => formatMonth(v);

export function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative h-full w-1/2 min-w-[140px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={2} stroke="none">
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={money} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wide">Total</div>
            <div className="amount text-sm text-ink dark:text-white">{formatCOPShort(total)}</div>
          </div>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5 overflow-y-auto text-xs">
        {data.slice(0, 7).map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="amount text-ink dark:text-white">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IncomeVsExpense({ data }: { data: { month: string; ingresos: number; gastos: number }[] }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} barGap={4}>
        <CartesianGrid vertical={false} strokeOpacity={0.12} />
        <XAxis dataKey="month" tickFormatter={monthTick} {...axis} />
        <YAxis tickFormatter={formatCOPShort} width={58} {...axis} />
        <Tooltip {...tooltipStyle} formatter={money} labelFormatter={(l) => formatMonth(String(l), true)} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ingresos" name="Ingresos" fill="#00a69a" radius={[6, 6, 0, 0]} />
        <Bar dataKey="gastos" name="Gastos y deudas" fill="#1771e6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaSeries({ data, dataKey, name, color, xKey = 'month', xFormatter = monthTick }: { data: object[]; dataKey: string; name: string; color: string; xKey?: string; xFormatter?: (v: string) => string }) {
  const id = `g-${dataKey}`;
  return (
    <ResponsiveContainer>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeOpacity={0.12} />
        <XAxis dataKey={xKey} tickFormatter={xFormatter} {...axis} />
        <YAxis tickFormatter={formatCOPShort} width={58} {...axis} />
        <Tooltip {...tooltipStyle} formatter={money} labelFormatter={(l) => xFormatter(String(l))} />
        <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.5} fill={`url(#${id})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({ data, lines, xKey, xFormatter }: { data: object[]; lines: { key: string; name: string; color: string; dashed?: boolean }[]; xKey: string; xFormatter: (v: string) => string }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data}>
        <CartesianGrid vertical={false} strokeOpacity={0.12} />
        <XAxis dataKey={xKey} tickFormatter={xFormatter} {...axis} />
        <YAxis tickFormatter={formatCOPShort} width={58} {...axis} />
        <Tooltip {...tooltipStyle} formatter={money} labelFormatter={(l) => xFormatter(String(l))} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2.5} dot={false} strokeDasharray={l.dashed ? '6 4' : undefined} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
