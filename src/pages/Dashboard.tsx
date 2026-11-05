import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, Landmark, ShieldCheck, Bike, CalendarRange, ShoppingBag, Briefcase, LineChart,
  ChevronRight, CheckCircle2, Circle, Trophy, PiggyBank, CalendarCheck, Ban,
} from 'lucide-react';
import { useData } from '../store/data';
import { overview, monthlySeries } from '../lib/selectors';
import { expensesByCategory, monthTotals } from '../lib/calc/budget';
import { simulatePayoff } from '../lib/calc/simulator';
import { isActiveDebt } from '../lib/calc/debts';
import { addMonths, firstOfMonth, formatDate, formatMonth, monthKey, today } from '../lib/dates';
import { formatCOP } from '../lib/money';
import { categoryColor, categoryLabel } from '../lib/constants';
import { Badge, Card, DataBadge, Money, Progress, SectionTitle, Stat, cx } from '../components/ui';
import { AreaSeries, ChartCard, DonutChart, IncomeVsExpense, MultiLine } from '../components/charts';
import { debtRows } from '../lib/selectors';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function Dashboard() {
  const { data, profile } = useData();
  const on = today();
  const o = useMemo(() => overview(data, on), [data, on]);
  const series = useMemo(() => monthlySeries(data, on, 6), [data, on]);
  const name = profile?.displayName?.split(' ')[0] || '';

  const thisMonth = monthTotals(data.transactions, monthKey(on));
  const fixedByCat = expensesByCategory(data.expenses);
  const realByCat = Object.entries(
    data.transactions.filter((t) => t.kind === 'gasto' && monthKey(t.occurredOn) === monthKey(on)).reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.category]: (acc[t.category] ?? 0) + t.amount }), {}),
  ).map(([category, amount]) => ({ category, amount }));
  const donutSource = realByCat.length ? realByCat : fixedByCat;
  const donut = donutSource.map((d) => ({ name: categoryLabel(d.category, data.expenseCategories), value: d.amount, color: categoryColor(d.category, data.expenseCategories) }));

  // Proyección 12 meses: saldo libre (capacidad − cuotas) y deuda pagando las cuotas actuales.
  const projection = useMemo(() => {
    const monthlyFree = o.monthlyCapacity - o.debtInstallments;
    const sim = simulatePayoff(
      debtRows(data).filter((r) => isActiveDebt(r.debt)).map((r) => ({ id: r.debt.id, name: r.debt.creditor, balance: r.summary.balance, rateEA: r.debt.interestRateEa, estimate: r.debt.isEstimate })),
      { name: 'actual', monthlyPayment: o.debtInstallments },
      12,
    );
    return Array.from({ length: 13 }, (_, m) => ({
      month: monthKey(addMonths(firstOfMonth(on), m)),
      saldo: o.available + monthlyFree * m,
      deuda: sim.series[Math.min(m, sim.series.length - 1)] ?? 0,
    }));
  }, [data, o, on]);

  const missions = [
    { done: data.income.length > 0, label: 'Configura tus ingresos', to: '/movimientos?tab=ingresos' },
    { done: data.expenses.length > 0, label: 'Agrega tus gastos fijos', to: '/movimientos?tab=gastos' },
    { done: data.debts.length > 0, label: 'Registra tus deudas (si tienes)', to: '/deudas' },
    { done: data.savingsGoals.length > 0, label: 'Crea tu primera meta', to: '/metas' },
    { done: data.budgets.length > 0, label: 'Distribuye tu primera quincena', to: '/quincena' },
  ];
  const missionsDone = missions.filter((m) => m.done).length;
  const noActivity = data.transactions.length === 0;

  const motoPct = o.moto?.progress.pct ?? 0;
  const emergencyPct = o.emergencyTarget ? Math.min(100, (o.emergencySaved / o.emergencyTarget) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <p className="muted text-sm font-medium">{greeting()} · {formatDate(on)}</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight sm:text-3xl">Hola{name ? `, ${name}` : ''} 👋</h1>
        <p className="muted mt-1">Este es tu estado financiero actual</p>
      </div>

      {missionsDone < missions.length && (
        <Card className="mb-6 overflow-hidden !border-0 bg-navy p-0 text-white dark:bg-navy-3">
          <div className="flex items-stretch">
            <div className="hidden w-36 shrink-0 items-end justify-center bg-gradient-to-b from-retro/60 to-transparent sm:flex">
              <img src="tutor/pixel.png" alt="" className="pixelated h-36 translate-y-2" />
            </div>
            <div className="flex-1 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-pixel text-[10px] text-coin">MISIONES INICIALES</p>
                <span className="font-pixel text-[9px] text-slate-300">{missionsDone}/{missions.length}</span>
              </div>
              <div className="mt-2 flex h-2.5 gap-[2px] border-2 border-white/80 p-[1px]">
                {missions.map((m, i) => (
                  <span key={i} className="flex-1" style={{ background: m.done ? '#22c55e' : 'transparent' }} />
                ))}
              </div>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {missions.map((m) => (
                  <li key={m.label}>
                    <Link to={m.to} className={cx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-white/10', m.done && 'text-slate-400 line-through')}>
                      {m.done ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} className="text-coin" />}
                      {m.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" data-tour="stats">
        <Stat label="Ingresos mensuales" icon={<TrendingUp size={17} />} accent="#00a69a" value={<Money value={o.income.total} />} sub={o.income.estimated > 0 ? <DataBadge kind="estimado" /> : o.extraordinary.length > 0 ? `+ ${formatCOP(o.extraordinary.reduce((s, i) => s + i.amount, 0))} extra pendiente` : 'Recurrentes, sin extras'} />
        <Stat label="Gastos mensuales" icon={<TrendingDown size={17} />} accent="#1771e6" value={<Money value={o.expenses.base} />} sub={o.expenses.min !== o.expenses.max ? `Rango ${formatCOP(o.expenses.min)} – ${formatCOP(o.expenses.max)}` : 'Gastos fijos'} />
        <Stat label="Dinero disponible" icon={<Wallet size={17} />} accent="#8b5cf6" value={<Money value={o.available} className={o.available < 0 ? 'text-red-600' : ''} />} sub="Según tus movimientos registrados" />
        <Stat label="Deuda total" icon={<Landmark size={17} />} accent="#ef4444" value={<Money value={o.debtTotal} />} sub={o.activeDebtCount ? <span className="flex items-center gap-1.5">{o.activeDebtCount} activa{o.activeDebtCount > 1 ? 's' : ''} {o.debtHasEstimates && <DataBadge kind="estimado" />}</span> : 'Sin deudas registradas'} />
        <Stat label="Fondo de emergencia" icon={<ShieldCheck size={17} />} accent="#f59e0b" value={<Money value={o.emergencySaved} />} sub={o.emergencyTarget ? `Meta ${formatCOP(o.emergencyTarget)}` : 'Crea tu fondo en Metas'}>
          {o.emergencyTarget > 0 && <Progress value={emergencyPct} color="#f59e0b" className="mt-2" />}
        </Stat>
        <Stat label={o.moto ? o.moto.goal.name : 'Meta principal'} icon={<Bike size={17} />} accent="#8b5cf6" value={<span className="amount">{o.moto ? `${motoPct.toLocaleString('es-CO')} %` : '—'}</span>} sub={o.moto ? `Faltan ${formatCOP(o.moto.progress.remaining)}` : 'Configura tu moto en Metas'}>
          {o.moto && <Progress value={motoPct} color="#8b5cf6" className="mt-2" />}
        </Stat>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" data-tour="quick-actions">
        {[
          { to: '/quincena', label: 'Distribuir mi quincena', icon: CalendarRange, color: '#1771e6', primary: true },
          { to: '/compras', label: '¿Realmente lo necesito?', icon: ShoppingBag, color: '#14b8a6' },
          { to: '/freelance', label: 'Ingresos freelance', icon: Briefcase, color: '#f59e0b' },
          { to: '/simulador', label: 'Simulador', icon: LineChart, color: '#8b5cf6' },
        ].map((a) => (
          <Link key={a.to} to={a.to} className={cx('card group flex items-center gap-3 p-3.5 transition hover:-translate-y-0.5 hover:shadow-md', a.primary && '!border-brand/30 bg-brand/[.04] dark:bg-brand/10')}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: a.color }}>
              <a.icon size={19} />
            </span>
            <span className="text-[13px] font-semibold leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>

      <SectionTitle>Gráficos</SectionTitle>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Distribución de gastos" badge={<Badge>{realByCat.length ? 'Este mes' : 'Gastos fijos'}</Badge>} empty={!donut.length && 'Agrega gastos fijos o registra gastos para ver su distribución.'}>
          <DonutChart data={donut} />
        </ChartCard>
        <ChartCard title="Ingresos frente a gastos" badge={<Badge>Últimos 6 meses</Badge>} empty={noActivity && 'Registra movimientos con el botón + para ver tu historial.'}>
          <IncomeVsExpense data={series} />
        </ChartCard>
        <ChartCard title="Evolución de deudas" badge={o.debtHasEstimates ? <DataBadge kind="estimado" /> : undefined} empty={!data.debts.length && 'Cuando registres deudas y abonos verás cómo bajan.'}>
          <AreaSeries data={series} dataKey="deuda" name="Deuda" color="#ef4444" />
        </ChartCard>
        <ChartCard title="Ahorro acumulado" empty={!data.savingsGoals.length && 'Crea una meta y registra aportes para ver crecer tu ahorro.'}>
          <AreaSeries data={series} dataKey="ahorro" name="Ahorro" color="#00a69a" />
        </ChartCard>
        <div className="lg:col-span-2">
          <ChartCard title="Proyección financiera (12 meses)" badge={<DataBadge kind="hipotetico" />} empty={o.income.total === 0 && 'Configura tus ingresos para proyectar tu futuro financiero.'} height={240}>
            <MultiLine
              data={projection}
              xKey="month"
              xFormatter={(v) => formatMonth(v)}
              lines={[
                { key: 'saldo', name: 'Saldo libre proyectado', color: '#00a69a' },
                { key: 'deuda', name: 'Deuda pagando cuotas actuales', color: '#ef4444', dashed: true },
              ]}
            />
          </ChartCard>
          <p className="muted mt-2 px-1 text-xs">Proyección = dinero disponible + (ingresos − gastos fijos − cuotas de deuda) × meses. Supone que nada cambia; es una guía, no un dato confirmado.</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <SectionTitle action={<Link to="/quincena" className="text-xs font-semibold text-brand">Planear</Link>}>Próximos movimientos</SectionTitle>
          <Card className="divide-y divide-slate-100 dark:divide-white/5">
            {o.upcoming.length === 0 ? (
              <p className="muted p-5 text-center text-sm">Sin vencimientos en los próximos 30 días. Agrega el día de pago a tus gastos fijos y la fecha del próximo pago a tus deudas.</p>
            ) : (
              o.upcoming.slice(0, 8).map((u, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-center leading-none', u.kind === 'deuda' ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : u.kind === 'ingreso' || u.kind === 'freelance' ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300')}>
                    <div>
                      <div className="text-sm font-bold">{Number(u.date.slice(8))}</div>
                      <div className="text-[9px] font-semibold uppercase">{formatDate(u.date, false).split(' ')[1]}</div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{u.label}</p>
                    <p className="muted text-xs">{u.kind === 'deuda' ? 'Pago de deuda' : u.kind === 'gasto' ? 'Gasto fijo' : u.kind === 'freelance' ? 'Por cobrar' : 'Ingreso esperado'}{u.estimate ? ' · estimado' : ''}</p>
                  </div>
                  <Money value={u.amount} className={cx('text-sm', (u.kind === 'ingreso' || u.kind === 'freelance') && 'text-teal-600 dark:text-teal-300')} />
                </div>
              ))
            )}
          </Card>
        </div>
        <div>
          <SectionTitle>Tu progreso</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Landmark, label: 'Deuda reducida', value: formatCOP(o.progress.debtReduced), color: '#ef4444' },
              { icon: PiggyBank, label: 'Dinero ahorrado', value: formatCOP(o.progress.saved), color: '#00a69a' },
              { icon: CalendarCheck, label: 'Meses en positivo', value: String(o.progress.monthsOk), color: '#1771e6' },
              { icon: Trophy, label: 'Metas alcanzadas', value: String(o.progress.goalsReached), color: '#f59e0b' },
              { icon: Ban, label: 'Compras evitadas', value: formatCOP(o.progress.avoided), color: '#8b5cf6' },
              { icon: Wallet, label: 'Movido este mes', value: formatCOP(thisMonth.gastos + thisMonth.deudas), color: '#64748b' },
            ].map((p) => (
              <Card key={p.label} className="p-4">
                <p.icon size={18} style={{ color: p.color }} />
                <p className="amount mt-2 text-lg">{p.value}</p>
                <p className="muted text-xs">{p.label}</p>
              </Card>
            ))}
          </div>
          <Link to="/movimientos" className="mt-3 flex items-center justify-between rounded-xl px-1 py-2 text-sm font-semibold text-brand">
            Ver todos los movimientos <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
