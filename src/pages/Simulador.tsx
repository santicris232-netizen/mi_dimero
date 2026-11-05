import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../store/data';
import { Card, DataBadge, Empty, Field, Input, Money, MoneyInput, Notice, PageHeader, Select, SectionTitle, Toggle, cx } from '../components/ui';
import { ChartCard, MultiLine } from '../components/charts';
import { simulatePayoff, type Scenario, type SimDebt } from '../lib/calc/simulator';
import { isActiveDebt } from '../lib/calc/debts';
import { debtRows, overview } from '../lib/selectors';
import { addMonths, formatMonth, today } from '../lib/dates';
import { formatCOP } from '../lib/money';

const COLORS = ['#1771e6', '#00a69a', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'];
type Editable = Scenario & { id: string; enabled: boolean };

export default function Simulador() {
  const { data } = useData();
  const on = today();
  const o = useMemo(() => overview(data, on), [data, on]);
  const debts: SimDebt[] = debtRows(data)
    .filter((r) => isActiveDebt(r.debt) && r.summary.balance > 0)
    .map((r) => ({ id: r.debt.id, name: r.debt.creditor, balance: r.summary.balance, rateEA: r.debt.interestRateEa, estimate: r.debt.isEstimate }));
  const prima = o.extraordinary.reduce((s, i) => s + i.amount, 0);
  const biggest = [...debts].sort((a, b) => b.balance - a.balance)[0];

  const [scenarios, setScenarios] = useState<Editable[]>(() => [
    { id: 'a', enabled: true, name: 'Pago $500.000 al mes', monthlyPayment: 500000 },
    { id: 'b', enabled: true, name: 'Pago $700.000 al mes', monthlyPayment: 700000 },
    { id: 'c', enabled: false, name: 'Con ingreso adicional', monthlyPayment: 500000, extraMonthly: 200000 },
    { id: 'd', enabled: false, name: 'Usando la prima', monthlyPayment: 500000, lumpSum: prima, lumpMonth: 2 },
    { id: 'e', enabled: false, name: 'Con descuento bancario', monthlyPayment: 500000, discount: biggest ? { debtId: biggest.id, pct: 0 } : null },
  ]);
  const update = (id: string, patch: Partial<Editable>) => setScenarios((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const active = scenarios.filter((s) => s.enabled);
  const results = active.map((s) => simulatePayoff(debts, s));
  const maxLen = Math.max(1, ...results.map((r) => r.series.length));
  const chart = Array.from({ length: Math.min(maxLen, 61) }, (_, m) => {
    const row: Record<string, number | string> = { month: addMonths(`${on.slice(0, 7)}-01`, m).slice(0, 7) };
    results.forEach((r, i) => (row[`s${i}`] = r.series[Math.min(m, r.series.length - 1)]));
    return row;
  });

  if (!debts.length)
    return (
      <div>
        <PageHeader title="Simulador financiero" subtitle="¿Qué pasa si…?" />
        <Empty title="Necesito tus deudas para simular" text="Registra al menos una deuda con saldo para comparar escenarios de pago." action={<Link to="/deudas" className="btn-primary">Ir a deudas</Link>} />
      </div>
    );

  return (
    <div>
      <PageHeader title="Simulador financiero" subtitle="Compara escenarios sin tocar tus datos reales" />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="muted">Leyenda:</span> <DataBadge kind="confirmado" /> registrado y confirmado <DataBadge kind="estimado" /> valor aproximado <DataBadge kind="hipotetico" /> escenario supuesto
      </div>

      <Card className="mb-4 p-4">
        <p className="mb-2 text-sm font-semibold">Deudas que se simulan</p>
        <ul className="space-y-1.5 text-sm">
          {debts.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">{d.name} <DataBadge kind={d.estimate ? 'estimado' : 'confirmado'} /></span>
              <span className="muted text-xs">{d.rateEA != null ? `${String(d.rateEA).replace('.', ',')} % EA` : 'tasa desconocida (sin interés)'} · <Money value={d.balance} className="text-ink dark:text-white" /></span>
            </li>
          ))}
        </ul>
        {results[0]?.interestUnknown && <p className="muted mt-2 text-xs">Las deudas sin tasa registrada se simulan sin intereses: el tiempo real podría ser mayor. No se inventan tasas.</p>}
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-tour="sim-scenarios">
        {scenarios.map((s) => {
          const idx = active.findIndex((a) => a.id === s.id);
          return (
            <Card key={s.id} className={cx('p-4 transition', !s.enabled && 'opacity-60')}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {idx >= 0 && <span className="h-3 w-3 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />}
                  <DataBadge kind="hipotetico" />
                </span>
                <div className="flex items-center gap-1">
                  <Toggle checked={s.enabled} onChange={(v) => update(s.id, { enabled: v })} label="" />
                  {scenarios.length > 1 && (
                    <button className="btn-ghost !p-1.5 text-slate-400" onClick={() => setScenarios((x) => x.filter((y) => y.id !== s.id))} aria-label="Quitar escenario"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <Input value={s.name} maxLength={50} onChange={(e) => update(s.id, { name: e.target.value })} className="!py-2 font-semibold" />
                <Field label="Pago mensual a deudas">
                  <MoneyInput value={s.monthlyPayment} onChange={(v) => update(s.id, { monthlyPayment: v })} />
                </Field>
                <Field label="Ingreso adicional mensual">
                  <MoneyInput value={s.extraMonthly ?? 0} onChange={(v) => update(s.id, { extraMonthly: v })} />
                </Field>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <Field label={prima ? `Pago único (prima estimada ${formatCOP(prima)})` : 'Pago único (prima, bono)'}>
                    <MoneyInput value={s.lumpSum ?? 0} onChange={(v) => update(s.id, { lumpSum: v })} />
                  </Field>
                  <Field label="En el mes">
                    <Input type="number" min={1} max={60} value={s.lumpMonth ?? 1} onChange={(e) => update(s.id, { lumpMonth: Math.max(1, Number(e.target.value) || 1) })} />
                  </Field>
                </div>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <Field label="Descuento sobre">
                    <Select value={s.discount?.debtId ?? ''} onChange={(e) => update(s.id, { discount: e.target.value ? { debtId: e.target.value, pct: s.discount?.pct ?? 0 } : null })}>
                      <option value="">Sin descuento</option>
                      {debts.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="%">
                    <Input type="number" min={0} max={100} disabled={!s.discount} value={s.discount?.pct ?? 0} onChange={(e) => s.discount && update(s.id, { discount: { ...s.discount, pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })} />
                  </Field>
                </div>
              </div>
            </Card>
          );
        })}
        {scenarios.length < 6 && (
          <button className="card grid min-h-40 place-items-center border-dashed p-4 text-sm font-semibold text-slate-500 hover:text-brand" onClick={() => setScenarios((s) => [...s, { id: crypto.randomUUID(), enabled: true, name: 'Mi escenario', monthlyPayment: Math.max(0, o.monthlyCapacity - 0) > 0 ? Math.round(Math.max(0, o.monthlyCapacity) / 2 / 1000) * 1000 : 300000 }])}>
            <span className="flex items-center gap-2"><Plus size={18} /> Agregar escenario</span>
          </button>
        )}
      </div>

      <SectionTitle>Resultados</SectionTitle>
      {active.length === 0 ? (
        <p className="muted text-sm">Activa al menos un escenario.</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {results.map((r, i) => (
              <Card key={i} className="p-4">
                <p className="flex items-center gap-2 font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{r.name}</p>
                {r.months == null ? (
                  <p className="mt-2 text-sm font-semibold text-red-600">Con este pago la deuda no se termina en 10 años.</p>
                ) : (
                  <p className="mt-2"><span className="amount text-2xl">{r.months}</span> <span className="muted text-sm">meses · libre en {formatMonth(addMonths(on, r.months), true)}</span></p>
                )}
                <ul className="muted mt-2 space-y-0.5 text-xs">
                  <li>Total pagado: <b className="text-ink dark:text-white">{formatCOP(r.totalPaid)}</b></li>
                  <li>Intereses (con tasas conocidas): <b className="text-ink dark:text-white">{formatCOP(r.totalInterest)}</b></li>
                  {r.savedByDiscount > 0 && <li>Ahorro por descuento: <b className="text-emerald-600">{formatCOP(r.savedByDiscount)}</b></li>}
                  {r.order.length > 0 && <li>Orden de pago: {r.order.join(' → ')}</li>}
                </ul>
                {active[i].monthlyPayment + (active[i].extraMonthly ?? 0) > Math.max(0, o.monthlyCapacity) && o.monthlyCapacity > 0 && (
                  <p className="mt-2 text-xs font-medium text-amber-600">Este pago supera tu capacidad mensual estimada ({formatCOP(o.monthlyCapacity)}).</p>
                )}
              </Card>
            ))}
          </div>
          <div className="mt-3">
            <ChartCard title="Deuda total en el tiempo" badge={<DataBadge kind="hipotetico" />} height={280}>
              <MultiLine data={chart} xKey="month" xFormatter={(v) => formatMonth(v)} lines={results.map((r, i) => ({ key: `s${i}`, name: r.name, color: COLORS[i % COLORS.length] }))} />
            </ChartCard>
          </div>
          <div className="mt-3">
            <Notice tone="violet">Estos resultados son proyecciones hipotéticas. Un descuento solo es real cuando la entidad lo ofrece por escrito, y la prima solo cuenta cuando la recibes.</Notice>
          </div>
        </>
      )}
    </div>
  );
}
