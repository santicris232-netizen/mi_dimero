import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Save, PlayCircle, AlertTriangle, CheckCircle2, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { Badge, Card, Field, Money, MoneyInput, Notice, PageHeader, Segmented, Select, Toggle, cx } from '../components/ui';
import { BUCKETS, committedForHalf, halfIncome, halfRange, suggestDistribution, summarizeDistribution, upcomingDue } from '../lib/calc/budget';
import { isActiveDebt } from '../lib/calc/debts';
import { BUCKET_INFO } from '../lib/constants';
import { addDays, addMonths, diffDays, firstOfMonth, formatDate, formatMonth, halfOf, today } from '../lib/dates';
import { formatCOP } from '../lib/money';
import { ledgerBalance } from '../lib/calc/budget';
import type { Bucket } from '../types';

type Draft = Record<Bucket, { amount: number; targetId: string | null }>;
const emptyDraft = (): Draft => Object.fromEntries(BUCKETS.map((b) => [b, { amount: 0, targetId: null }])) as Draft;

export default function Quincena() {
  const { data, add, patch, remove, addContribution, addDebtPayment, addTransaction } = useData();
  const now = today();
  const [period, setPeriod] = useState(firstOfMonth(now));
  const [half, setHalf] = useState<1 | 2>(halfOf(now));
  const budget = data.budgets.find((b) => b.period === period && b.half === half) ?? null;
  const saved = useMemo(() => data.budgetAllocations.filter((a) => a.budgetId === budget?.id), [data.budgetAllocations, budget?.id]);

  const expected = halfIncome(data.income, half);
  const [received, setReceived] = useState(0);
  const [registerIncome, setRegisterIncome] = useState(true);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [ackOver, setAckOver] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sincroniza el borrador con lo guardado al cambiar de quincena.
  useEffect(() => {
    setReceived(budget?.receivedAmount ?? expected);
    const d = emptyDraft();
    for (const a of saved) d[a.bucket] = { amount: d[a.bucket].amount + a.amount, targetId: a.debtId ?? a.goalId ?? null };
    setDraft(d);
    setAckOver(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget?.id, period, half, saved.length]);

  const committed = committedForHalf(data.expenses, data.debts, period, half);
  const allocations = BUCKETS.map((b) => ({ bucket: b, amount: draft[b].amount }));
  const s = summarizeDistribution(received, allocations, committed.total);
  const reserved = draft.emergencia.amount + draft.moto.amount;
  const range = halfRange(period, half);
  const due = upcomingDue(data.expenses, data.debts, range.from, diffDays(range.from, range.to));
  const debts = data.debts.filter(isActiveDebt);
  const emergencyGoals = data.savingsGoals.filter((g) => g.kind === 'emergencia');
  const otherGoals = data.savingsGoals.filter((g) => g.kind !== 'emergencia');
  const available = ledgerBalance(data.transactions);
  const executed = budget?.executed ?? false;

  const setBucket = (b: Bucket, v: Partial<Draft[Bucket]>) => {
    setDraft((d) => ({ ...d, [b]: { ...d[b], ...v } }));
    setAckOver(false);
  };

  const suggest = () => {
    const sug = suggestDistribution(received, committed);
    setDraft((d) => {
      const next = { ...d };
      for (const b of BUCKETS) next[b] = { amount: sug[b], targetId: d[b].targetId ?? (b === 'emergencia' ? emergencyGoals[0]?.id ?? null : b === 'moto' ? otherGoals[0]?.id ?? null : b === 'deudas' ? debts[0]?.id ?? null : null) };
      return next;
    });
    toast('Sugerencia aplicada. Ajústala a tu gusto.', 'info');
  };

  const save = async () => {
    if (received <= 0) return toast('Ingresa el dinero recibido', 'error');
    if (s.overBudget && !ackOver) return toast('Confirma la advertencia: estás asignando más de lo recibido', 'error');
    setBusy(true);
    try {
      let budgetId = budget?.id;
      if (!budget) {
        const b = await add('budgets', { period, half, receivedAmount: received, receivedOn: now, executed: false });
        budgetId = b.id;
        if (registerIncome) {
          await addTransaction({ kind: 'ingreso', amount: received, occurredOn: now, category: 'salario', description: `Quincena ${half} · ${formatMonth(period)}`, refTable: 'budgets', refId: b.id });
        }
      } else if (budget.receivedAmount !== received) {
        await patch('budgets', budget.id, { receivedAmount: received });
      }
      for (const a of saved) await remove('budgetAllocations', a.id);
      for (const b of BUCKETS) {
        const { amount, targetId } = draft[b];
        if (amount <= 0) continue;
        await add('budgetAllocations', {
          budgetId: budgetId!,
          bucket: b,
          amount,
          debtId: b === 'deudas' ? targetId : null,
          goalId: b === 'emergencia' || b === 'moto' ? targetId : null,
          note: null,
        });
      }
      toast('Distribución guardada');
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    if (!budget) return;
    setBusy(true);
    try {
      for (const a of saved) {
        if ((a.bucket === 'emergencia' || a.bucket === 'moto') && a.goalId) await addContribution({ goalId: a.goalId, amount: a.amount, note: `Quincena ${half} · ${formatMonth(period)}` });
        if (a.bucket === 'deudas' && a.debtId) await addDebtPayment({ debtId: a.debtId, amount: a.amount, paidOn: now, note: `Quincena ${half} · ${formatMonth(period)}` });
      }
      await patch('budgets', budget.id, { executed: true });
      toast('¡Distribución ejecutada! Aportes y abonos registrados.');
    } finally {
      setBusy(false);
    }
  };

  const toExecute = saved.filter((a) => ((a.bucket === 'emergencia' || a.bucket === 'moto') && a.goalId) || (a.bucket === 'deudas' && a.debtId));
  const dirty = BUCKETS.some((b) => saved.filter((a) => a.bucket === b).reduce((x, a) => x + a.amount, 0) !== draft[b].amount) || (budget && budget.receivedAmount !== received);

  return (
    <div>
      <PageHeader title="Distribuir mi quincena" subtitle="Dale un trabajo a cada peso antes de gastarlo" />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn-secondary !p-2" aria-label="Quincena anterior" onClick={() => (half === 2 ? setHalf(1) : (setPeriod(addMonths(period, -1)), setHalf(2)))}>
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-36 text-center font-semibold capitalize">{formatMonth(period, true)}</span>
          <button className="btn-secondary !p-2" aria-label="Quincena siguiente" onClick={() => (half === 1 ? setHalf(2) : (setPeriod(addMonths(period, 1)), setHalf(1)))}>
            <ChevronRight size={18} />
          </button>
        </div>
        <Segmented value={String(half) as '1' | '2'} onChange={(v) => setHalf(Number(v) as 1 | 2)} options={[{ value: '1', label: '1.ª quincena' }, { value: '2', label: '2.ª quincena' }]} />
        {budget && (executed ? <Badge tone="green">Ejecutada</Badge> : <Badge tone="blue">Guardada</Badge>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="p-5" data-tour="quincena-received">
            <Field label="Dinero recibido" hint={expected ? `Esperado según tus ingresos: ${formatCOP(expected)}` : 'Configura tus ingresos en Movimientos para precargar este valor'}>
              <MoneyInput large value={received} onChange={(v) => { setReceived(v); setAckOver(false); }} />
            </Field>
            {!budget && (
              <div className="mt-3">
                <Toggle checked={registerIncome} onChange={setRegisterIncome} label="Registrar como ingreso recibido" hint="Suma este dinero a tu disponible al guardar (desactívalo si ya lo registraste)" />
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Comprometido', value: committed.total, hint: 'Gastos y cuotas de esta quincena' },
                { label: 'Asignado', value: s.assigned },
                { label: 'Disponible', value: s.remaining, tone: s.remaining < 0 ? 'text-red-600' : s.remaining === 0 ? 'text-emerald-600' : '' },
                { label: 'Reservado', value: reserved, hint: 'Emergencia + metas' },
              ].map((x) => (
                <div key={x.label} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                  <p className="muted text-xs">{x.label}</p>
                  <Money value={x.value} className={cx('text-[15px]', x.tone)} />
                </div>
              ))}
            </div>
            {/* Barra apilada */}
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              {BUCKETS.map((b) => (
                <div key={b} style={{ width: `${received ? Math.min(100, (draft[b].amount / Math.max(received, s.assigned)) * 100) : 0}%`, background: BUCKET_INFO[b].color }} className="transition-all" />
              ))}
            </div>
          </Card>

          {s.overBudget && (
            <Notice tone="red" icon={<AlertTriangle size={16} />}>
              <b>Estás asignando {formatCOP(s.overBy)} más de lo que recibiste.</b> Reduce alguna categoría o confirma que cubrirás la diferencia con dinero que ya tienes.
              <div className="mt-2">
                <Toggle checked={ackOver} onChange={setAckOver} label="Entiendo y quiero guardar de todos modos" />
              </div>
            </Notice>
          )}
          {s.uncovered > 0 && !s.overBudget && (
            <Notice tone="amber" icon={<AlertTriangle size={16} />}>
              Tus compromisos de esta quincena suman {formatCOP(committed.total)} y solo asignaste {formatCOP(draft.obligatorios.amount + draft.deudas.amount)} a obligatorios y deudas. Faltan {formatCOP(s.uncovered)}.
            </Notice>
          )}

          <Card className="divide-y divide-slate-100 dark:divide-white/5">
            <div className="flex items-center justify-between px-5 py-3">
              <h3 className="font-bold">¿A dónde va tu dinero?</h3>
              <button className="btn-secondary !py-2 text-xs" onClick={suggest} disabled={executed || received <= 0}>
                <Sparkles size={15} /> Sugerir
              </button>
            </div>
            {BUCKETS.map((b) => {
              const info = BUCKET_INFO[b];
              const pct = received ? Math.round((draft[b].amount / received) * 100) : 0;
              const targets = b === 'deudas' ? debts.map((d) => ({ id: d.id, name: d.creditor })) : b === 'emergencia' ? emergencyGoals.map((g) => ({ id: g.id, name: g.name })) : b === 'moto' ? otherGoals.map((g) => ({ id: g.id, name: g.name })) : null;
              return (
                <div key={b} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_180px]">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: info.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{info.label} <span className="muted text-xs font-medium">{pct}%</span></p>
                      <p className="muted text-xs">{b === 'obligatorios' ? `Compromisos: ${formatCOP(committed.obligatorios)}` : b === 'deudas' ? `Cuotas que vencen: ${formatCOP(committed.deudas)}` : info.hint}</p>
                      {targets && (
                        targets.length ? (
                          <Select className="mt-2 !py-1.5 text-sm" value={draft[b].targetId ?? ''} disabled={executed} onChange={(e) => setBucket(b, { targetId: e.target.value || null })}>
                            <option value="">— Sin destino específico —</option>
                            {targets.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </Select>
                        ) : (
                          <Link to={b === 'deudas' ? '/deudas' : '/metas'} className="mt-1 inline-block text-xs font-semibold text-brand">
                            {b === 'deudas' ? 'Registra una deuda' : 'Crea una meta'} para enlazarla →
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                  <div className={cx(executed && 'pointer-events-none opacity-60')}>
                    <MoneyInput value={draft[b].amount} onChange={(v) => setBucket(b, { amount: v })} />
                  </div>
                </div>
              );
            })}
          </Card>

          {!executed && (
            <button className="btn-primary w-full !py-3.5" onClick={() => void save()} disabled={busy || (s.overBudget && !ackOver)}>
              <Save size={18} /> {budget ? 'Guardar cambios' : 'Guardar distribución'}
            </button>
          )}
          {budget && !executed && (
            <Card className="p-5">
              <h3 className="font-bold">Ejecutar distribución</h3>
              <p className="muted mt-1 text-sm">Registra automáticamente los aportes a tus metas y los abonos a deudas que tengan un destino seleccionado. Los gastos obligatorios y personales los registras a medida que los pagas.</p>
              {dirty && <p className="mt-2 text-sm font-medium text-amber-600">Guarda los cambios antes de ejecutar.</p>}
              {toExecute.length ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {toExecute.map((a) => (
                    <li key={a.id} className="flex justify-between">
                      <span>{a.bucket === 'deudas' ? `Abono a ${data.debts.find((d) => d.id === a.debtId)?.creditor}` : `Aporte a ${data.savingsGoals.find((g) => g.id === a.goalId)?.name}`}</span>
                      <Money value={a.amount} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No hay asignaciones con destino específico para ejecutar.</p>
              )}
              <button className="btn mt-4 w-full bg-teal text-white" disabled={busy || !!dirty || !toExecute.length} onClick={() => void execute()}>
                <PlayCircle size={18} /> Ejecutar ahora
              </button>
            </Card>
          )}
          {executed && (
            <Notice tone="green" icon={<CheckCircle2 size={16} />}>
              Esta quincena ya fue ejecutada. Puedes ver los aportes en Metas y los abonos en Deudas.
            </Notice>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="muted text-xs">Dinero disponible hoy (todos tus movimientos)</p>
            <Money value={available} className="text-2xl" />
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <CalendarClock size={18} /> Vencimientos de esta quincena
            </h3>
            {due.length === 0 ? (
              <p className="muted text-sm">Sin vencimientos con fecha entre el {formatDate(range.from, false)} y el {formatDate(range.to, false)}.</p>
            ) : (
              <ul className="space-y-2.5">
                {due.map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{d.label}</span>
                      <span className="muted text-xs">{formatDate(d.date, false)}{d.date < now ? ' · pasado' : d.date <= addDays(now, 3) ? ' · ¡pronto!' : ''}{d.estimate ? ' · estimado' : ''}</span>
                    </span>
                    <Money value={d.amount} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Notice>
            Consejo: cubre primero lo obligatorio y las cuotas. Luego reparte entre deudas, emergencia y metas. Un poco para gustos personales hace el plan sostenible.
          </Notice>
        </div>
      </div>
    </div>
  );
}
