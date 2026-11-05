import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Bike, ShieldCheck, Target, TrendingUp, Calendar, ChevronDown, Minus } from 'lucide-react';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { Badge, Card, ConfirmButton, Empty, Field, Input, Modal, Money, MoneyInput, Notice, PageHeader, Progress, Segmented, Select, SectionTitle, cx } from '../components/ui';
import { compareFinancing, motoCashTotal, motoMonthlyCosts, motoOneTimeCosts } from '../lib/calc/goals';
import { goalRows, overview } from '../lib/selectors';
import { formatDate, today } from '../lib/dates';
import { formatCOP, formatPct } from '../lib/money';
import type { MotoDetails, SavingsGoal } from '../types';

const KIND = {
  moto: { label: 'Moto', icon: Bike, color: '#8b5cf6' },
  emergencia: { label: 'Fondo de emergencia', icon: ShieldCheck, color: '#f59e0b' },
  otro: { label: 'Otra meta', icon: Target, color: '#1771e6' },
} as const;

function GoalForm({ open, onClose, editing, presetKind }: { open: boolean; onClose: () => void; editing: SavingsGoal | null; presetKind?: SavingsGoal['kind'] }) {
  const { add, patch, data } = useData();
  const [name, setName] = useState(editing?.name ?? (presetKind === 'moto' ? 'Mi moto' : presetKind === 'emergencia' ? 'Fondo de emergencia' : ''));
  const [kind, setKind] = useState<SavingsGoal['kind']>(editing?.kind ?? presetKind ?? 'otro');
  const [target, setTarget] = useState(editing?.targetAmount ?? 0);
  const [targetDate, setTargetDate] = useState(editing?.targetDate ?? '');
  const [initialSaved, setInitialSaved] = useState(editing?.initialSaved ?? 0);
  const [monthly, setMonthly] = useState(editing?.monthlyContribution ?? 0);
  const [d, setD] = useState<MotoDetails>(editing?.details ?? {});
  const [plan, setPlan] = useState<'contado' | 'financiado'>(editing?.details?.plan ?? 'contado');
  const [busy, setBusy] = useState(false);
  const setDet = (k: keyof MotoDetails, v: number | string) => setD((x) => ({ ...x, [k]: v }));
  const motoTarget = plan === 'contado' ? motoCashTotal(d) : (d.downPayment ?? 0) + motoOneTimeCosts(d);
  const effectiveTarget = kind === 'moto' ? motoTarget : target;
  const monthlyExpenses = data.expenses.filter((e) => e.active).reduce((s, e) => s + (e.amountMax ?? e.amount), 0);

  const save = async () => {
    if (!name.trim()) return toast('Escribe un nombre', 'error');
    if (effectiveTarget <= 0) return toast(kind === 'moto' ? 'Ingresa el precio de la moto' : 'Ingresa el valor de la meta', 'error');
    setBusy(true);
    try {
      const row = { name: name.trim().slice(0, 80), kind, targetAmount: effectiveTarget, targetDate: targetDate || null, initialSaved, monthlyContribution: monthly, details: kind === 'moto' ? { ...d, plan } : {}, achievedOn: null };
      if (editing) await patch('savingsGoals', editing.id, row);
      else await add('savingsGoals', row);
      toast(editing ? 'Meta actualizada' : '¡Meta creada! 🎯');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const money = (label: string, k: keyof MotoDetails, hint?: string) => (
    <Field label={label} hint={hint}>
      <MoneyInput value={(d[k] as number) ?? 0} onChange={(v) => setDet(k, v)} />
    </Field>
  );

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar meta' : 'Nueva meta'} wide>
      <div className="space-y-4">
        {!editing && (
          <Segmented className="w-full" value={kind} onChange={(k) => { setKind(k); if (!name || Object.values(KIND).some((x) => x.label === name) || name === 'Mi moto') setName(k === 'moto' ? 'Mi moto' : k === 'emergencia' ? 'Fondo de emergencia' : ''); }} options={[{ value: 'moto', label: 'Moto' }, { value: 'emergencia', label: 'Emergencia' }, { value: 'otro', label: 'Otra' }]} />
        )}
        <Field label="Nombre de la meta">
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ej: Viaje, computador nuevo" />
        </Field>
        {kind === 'moto' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Marca">
                <Input value={d.brand ?? ''} maxLength={40} onChange={(e) => setDet('brand', e.target.value)} />
              </Field>
              <Field label="Modelo">
                <Input value={d.model ?? ''} maxLength={60} onChange={(e) => setDet('model', e.target.value)} />
              </Field>
              {money('Precio de la moto', 'price')}
              {money('Cuota inicial (si financias)', 'downPayment')}
            </div>
            <p className="pt-1 text-sm font-semibold">Costos únicos al comprar</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {money('Matrícula', 'matricula')}
              {money('SOAT', 'soat')}
              {money('Casco y protección', 'proteccion')}
              {money('Impuestos aplicables', 'impuestos')}
            </div>
            <p className="pt-1 text-sm font-semibold">Costos mensuales después de comprarla</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {money('Mantenimiento mensual', 'mantenimientoMensual')}
              {money('Combustible mensual', 'combustibleMensual')}
            </div>
            <Notice tone="blue">Ingresa valores que hayas cotizado. La app no asume precios, tasas ni impuestos.</Notice>
            <div>
              <span className="label">¿Cuánto necesitas ahorrar?</span>
              <Segmented className="w-full" value={plan} onChange={setPlan} options={[{ value: 'contado', label: 'Compra de contado' }, { value: 'financiado', label: 'Cuota inicial + costos' }]} />
              <p className="mt-2 text-sm">Meta de ahorro: <b className="amount">{formatCOP(motoTarget)}</b></p>
            </div>
          </>
        ) : (
          <Field label="Valor de la meta" hint={kind === 'emergencia' && monthlyExpenses ? `Recomendado: 3 a 6 meses de gastos fijos (${formatCOP(monthlyExpenses * 3)} – ${formatCOP(monthlyExpenses * 6)})` : undefined}>
            <MoneyInput value={target} onChange={setTarget} />
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Fecha objetivo">
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          <Field label="Ya tengo ahorrado">
            <MoneyInput value={initialSaved} onChange={setInitialSaved} />
          </Field>
          <Field label="Aporte mensual planeado">
            <MoneyInput value={monthly} onChange={setMonthly} />
          </Field>
        </div>
        <button className="btn-primary w-full" disabled={busy} onClick={() => void save()}>Guardar meta</button>
      </div>
    </Modal>
  );
}

function ContributionModal({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const addContribution = useData((s) => s.addContribution);
  const [type, setType] = useState<'aporte' | 'retiro'>('aporte');
  const [amount, setAmount] = useState(goal.monthlyContribution || 0);
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={goal.name}>
      <div className="space-y-4">
        <Segmented className="w-full" value={type} onChange={setType} options={[{ value: 'aporte', label: 'Aportar' }, { value: 'retiro', label: 'Retirar' }]} />
        <Field label="Monto">
          <MoneyInput large autoFocus value={amount} onChange={setAmount} />
        </Field>
        <Field label="Fecha">
          <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <p className="muted text-xs">{type === 'aporte' ? 'El aporte sale de tu dinero disponible y se guarda en esta meta.' : 'El retiro vuelve a tu dinero disponible.'}</p>
        <button
          className="btn-primary w-full"
          disabled={busy || amount <= 0}
          onClick={async () => {
            setBusy(true);
            try {
              await addContribution({ goalId: goal.id, amount: type === 'aporte' ? amount : -amount, contributedOn: date });
              toast(type === 'aporte' ? `+${formatCOP(amount)} a ${goal.name} 🪙` : 'Retiro registrado');
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {type === 'aporte' ? 'Aportar' : 'Retirar'}
        </button>
      </div>
    </Modal>
  );
}

function MotoPlanner({ goal }: { goal: SavingsGoal }) {
  const { data } = useData();
  const on = today();
  const o = useMemo(() => overview(data, on), [data, on]);
  const [rate, setRate] = useState('');
  const [months, setMonths] = useState(36);
  const d = goal.details;
  const rateNum = rate.trim() === '' ? null : Number(rate.replace(',', '.'));
  const surplus = Math.max(0, o.monthlyCapacity - o.debtInstallments);
  const c = compareFinancing({ details: d, rateEA: rateNum != null && Number.isFinite(rateNum) ? rateNum : null, months, monthlySurplus: surplus, hasDebtsInArrears: o.hasArrears });
  const aff = { viable: { t: 'Cuota manejable', tone: 'green' }, ajustado: { t: 'Cuota ajustada', tone: 'amber' }, no_viable: { t: 'No es viable hoy', tone: 'red' }, sin_datos: { t: 'Faltan datos', tone: 'slate' } }[c.affordability] as { t: string; tone: 'green' | 'amber' | 'red' | 'slate' };

  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 font-bold"><Bike size={18} /> {d.brand || d.model ? `${d.brand ?? ''} ${d.model ?? ''}`.trim() : 'Tu moto'}: contado vs. financiación</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <p className="muted text-xs">Precio</p>
          <Money value={d.price ?? 0} />
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <p className="muted text-xs">Costos únicos (matrícula, SOAT, casco, impuestos)</p>
          <Money value={motoOneTimeCosts(d)} />
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <p className="muted text-xs">Costo mensual de tenerla</p>
          <Money value={motoMonthlyCosts(d)} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Tasa efectiva anual ofrecida (%)" hint="Escribe la tasa real que te cotice el banco o concesionario">
          <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Ej: 26,8" />
        </Field>
        <Field label="Plazo">
          <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[12, 18, 24, 36, 48, 60].map((m) => (
              <option key={m} value={m}>{m} meses</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
          <p className="font-semibold">De contado</p>
          <Money value={c.cashTotal} className="mt-1 block text-xl" />
          <p className="muted mt-1 text-xs">Sin intereses. Pagas solo precio + costos únicos.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Financiada</p>
            <Badge tone={aff.tone}>{aff.t}</Badge>
          </div>
          {c.financed.monthlyPayment > 0 ? (
            <>
              <p className="mt-1"><Money value={c.financed.monthlyPayment} className="text-xl" /> <span className="muted text-sm">/ mes × {months}</span></p>
              <ul className="muted mt-2 space-y-0.5 text-xs">
                <li>Necesitas ahorrar hoy: <b>{formatCOP(c.financed.savingNeededNow)}</b></li>
                <li>Total pagado: <b>{formatCOP(c.financed.totalPaid)}</b></li>
                <li>Costo en intereses: <b className="text-red-600">{formatCOP(c.financed.interestCost)}</b></li>
              </ul>
            </>
          ) : (
            <p className="muted mt-2 text-sm">Escribe la tasa para calcular la cuota.</p>
          )}
        </div>
      </div>
      {c.warnings.length > 0 && (
        <div className="mt-3 space-y-2">
          {c.warnings.map((w) => (
            <Notice key={w} tone="amber">{w}</Notice>
          ))}
        </div>
      )}
      <p className="muted mt-3 text-xs">Tu excedente mensual estimado (ingresos − gastos fijos − cuotas de deuda): {formatCOP(surplus)}. Comprar de contado siempre evita intereses.</p>
    </Card>
  );
}

export default function Metas() {
  const { data, remove, removeContribution } = useData();
  const on = today();
  const rows = goalRows(data, on);
  const [form, setForm] = useState<{ open: boolean; editing: SavingsGoal | null; preset?: SavingsGoal['kind'] }>({ open: false, editing: null });
  const [contributing, setContributing] = useState<SavingsGoal | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const hasMoto = rows.some((r) => r.goal.kind === 'moto');
  const hasEmergency = rows.some((r) => r.goal.kind === 'emergencia');

  return (
    <div>
      <PageHeader
        title="Mis metas"
        subtitle="Fondo de emergencia, tu moto y todo lo que sueñes"
        action={
          <button className="btn-primary" data-tour="goals-add" onClick={() => setForm({ open: true, editing: null })}>
            <Plus size={18} /> <span className="hidden sm:inline">Nueva meta</span><span className="sm:hidden">Nueva</span>
          </button>
        }
      />

      {(!hasMoto || !hasEmergency) && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {!hasEmergency && (
            <button onClick={() => setForm({ open: true, editing: null, preset: 'emergencia' })} className="card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><ShieldCheck size={20} /></span>
              <span><b className="block">Crear fondo de emergencia</b><span className="muted text-xs">Tu escudo contra imprevistos</span></span>
            </button>
          )}
          {!hasMoto && (
            <button onClick={() => setForm({ open: true, editing: null, preset: 'moto' })} className="card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><Bike size={20} /></span>
              <span><b className="block">Configurar mi moto</b><span className="muted text-xs">Precio, SOAT, matrícula, casco y más</span></span>
            </button>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <Empty title="Aún no tienes metas" text="Una meta clara te ayuda a decir “no” a los gastos impulsivos. ¡Crea la primera!" />
      ) : (
        <div className="space-y-4">
          {rows.map(({ goal, saved, progress: p }) => {
            const k = KIND[goal.kind];
            const contribs = data.savingsContributions.filter((c) => c.goalId === goal.id).sort((a, b) => b.contributedOn.localeCompare(a.contributedOn));
            const done = p.remaining === 0 && goal.targetAmount > 0;
            return (
              <div key={goal.id} className="space-y-3">
                <Card className={cx('p-5', done && '!border-emerald-300 dark:!border-emerald-500/40')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: k.color }}><k.icon size={20} /></span>
                      <div>
                        <p className="font-bold">{goal.name}</p>
                        <p className="muted text-xs">{k.label}{goal.targetDate ? ` · para el ${formatDate(goal.targetDate)}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn-ghost !p-2" onClick={() => setForm({ open: true, editing: goal })} aria-label="Editar"><Pencil size={16} /></button>
                      <ConfirmButton className="btn-ghost !p-2 text-slate-400" confirmText="Eliminar" onConfirm={async () => { for (const c of contribs) await removeContribution(c.id); await remove('savingsGoals', goal.id); }}>
                        <Trash2 size={16} />
                      </ConfirmButton>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <Money value={saved} className="text-2xl" />
                      <span className="muted text-sm"> de {formatCOP(goal.targetAmount)}</span>
                    </div>
                    <span className="amount text-lg" style={{ color: k.color }}>{formatPct(p.pct)}</span>
                  </div>
                  <Progress value={p.pct} color={k.color} className="mt-2 !h-3" />
                  {done ? (
                    <p className="mt-3 font-semibold text-emerald-600">🏆 ¡Meta alcanzada! Felicitaciones.</p>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><p className="muted text-xs">Falta</p><p className="amount">{formatCOP(p.remaining)}</p></div>
                      <div><p className="muted text-xs">Meses restantes</p><p className="amount">{p.monthsLeft ?? '—'}</p></div>
                      <div><p className="muted text-xs">Ahorro mensual necesario</p><p className="amount">{p.requiredMonthly != null ? formatCOP(p.requiredMonthly) : 'Define una fecha'}</p></div>
                      <div><p className="muted text-xs">Fecha estimada</p><p className="amount">{p.etaDate ? formatDate(p.etaDate) : 'Define un aporte'}</p></div>
                    </div>
                  )}
                  {!done && p.onTrack === false && (
                    <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                      Con {formatCOP(goal.monthlyContribution)}/mes no llegas a la fecha. Aumenta el aporte a {formatCOP(p.requiredMonthly ?? 0)} o mueve la fecha.
                    </p>
                  )}
                  {!done && p.onTrack === true && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><TrendingUp size={14} /> Vas a buen ritmo para llegar a tiempo.</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn-primary !py-2" onClick={() => setContributing(goal)}><Plus size={16} /> Aportar</button>
                    <button className="btn-ghost !py-2 text-sm" onClick={() => setExpanded(expanded === goal.id ? null : goal.id)}>
                      <Calendar size={15} /> Aportes ({contribs.length}) <ChevronDown size={15} className={cx('transition', expanded === goal.id && 'rotate-180')} />
                    </button>
                  </div>
                  {expanded === goal.id && (
                    <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-white/5 dark:border-white/5">
                      {goal.initialSaved > 0 && <li className="flex justify-between px-3 py-2 text-sm"><span className="muted">Ahorro inicial</span><Money value={goal.initialSaved} /></li>}
                      {contribs.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span>{formatDate(c.contributedOn)}{c.note && <span className="muted"> · {c.note}</span>}</span>
                          <span className="flex items-center gap-1">
                            <Money value={c.amount} signed className={c.amount < 0 ? 'text-red-600' : 'text-emerald-600'} />
                            <ConfirmButton className="btn-ghost !p-1.5 text-slate-400" confirmText="Borrar" onConfirm={() => void removeContribution(c.id)}>
                              {c.amount < 0 ? <Minus size={14} /> : <Trash2 size={14} />}
                            </ConfirmButton>
                          </span>
                        </li>
                      ))}
                      {!contribs.length && goal.initialSaved === 0 && <li className="muted px-3 py-2 text-sm">Sin aportes todavía.</li>}
                    </ul>
                  )}
                </Card>
                {goal.kind === 'moto' && <MotoPlanner goal={goal} />}
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <SectionTitle>Recuerda</SectionTitle>
          <Notice>Primero el fondo de emergencia, luego las metas. Si tienes deudas en mora, prioriza normalizarlas antes de adquirir nuevos créditos.</Notice>
        </>
      )}

      {form.open && <GoalForm open onClose={() => setForm({ open: false, editing: null })} editing={form.editing} presetKind={form.preset} />}
      {contributing && <ContributionModal goal={contributing} onClose={() => setContributing(null)} />}
    </div>
  );
}
