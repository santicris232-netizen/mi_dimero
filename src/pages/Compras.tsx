import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Clock, PauseCircle, XCircle, ThumbsUp, AlertTriangle, HelpCircle, RotateCcw, Trash2, PiggyBank } from 'lucide-react';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { Badge, Card, ConfirmButton, Field, Input, Money, MoneyInput, PageHeader, Segmented, Select, SectionTitle, Stat, Toggle, cx } from '../components/ui';
import { evaluatePurchase, formatCountdown, remainingMs, waitUntilFor, avoidedTotal, type PurchaseContext } from '../lib/calc/purchases';
import { halfRange, ledgerBalance, upcomingDue } from '../lib/calc/budget';
import { allCategories, categoryLabel } from '../lib/constants';
import { firstOfMonth, formatDate, halfOf, today } from '../lib/dates';
import { formatCOP } from '../lib/money';
import type { Dataset, PurchaseDecision } from '../types';

function purchaseContext(data: Dataset, on: string): PurchaseContext {
  const available = ledgerBalance(data.transactions);
  const period = firstOfMonth(on);
  const half = halfOf(on);
  const budget = data.budgets.find((b) => b.period === period && b.half === half);
  const allocs = budget ? data.budgetAllocations.filter((a) => a.budgetId === budget.id) : [];
  const range = halfRange(period, half);
  let personalLeft: number | null = null;
  if (budget) {
    const personal = allocs.filter((a) => a.bucket === 'personales').reduce((s, a) => s + a.amount, 0);
    const spent = data.transactions
      .filter((t) => t.kind === 'gasto' && t.occurredOn >= range.from && t.occurredOn <= range.to && ['compras_personales', 'entretenimiento'].includes(t.category))
      .reduce((s, t) => s + t.amount, 0);
    personalLeft = personal - spent;
  }
  const due = upcomingDue(data.expenses, data.debts, on, 15);
  return {
    available,
    personalLeft,
    upcomingDebt: due.filter((d) => d.kind === 'deuda').reduce((s, d) => s + d.amount, 0),
    upcomingObligations: due.filter((d) => d.kind === 'gasto').reduce((s, d) => s + d.amount, 0),
    plannedSaving: budget && !budget.executed ? allocs.filter((a) => a.bucket === 'emergencia' || a.bucket === 'moto').reduce((s, a) => s + a.amount, 0) : 0,
  };
}

function Answer({ q, yes, good }: { q: string; yes: boolean; good: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="flex items-center gap-2"><HelpCircle size={15} className="text-slate-400" /> {q}</span>
      <Badge tone={good ? 'green' : 'red'}>{yes ? 'Sí' : 'No'}</Badge>
    </li>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export default function Compras() {
  const { data, profile, add, patch, remove, addTransaction } = useData();
  const on = today();
  const ctx = useMemo(() => purchaseContext(data, on), [data, on]);
  const cats = allCategories(data.expenseCategories);
  const waitHours = profile?.waitRuleHours ?? 48;

  const [product, setProduct] = useState('');
  const [price, setPrice] = useState(0);
  const [category, setCategory] = useState('compras_personales');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<PurchaseDecision['priority']>('media');
  const [nature, setNature] = useState<PurchaseDecision['nature'] | null>(null);
  const [useWait, setUseWait] = useState(true);
  const [busy, setBusy] = useState(false);

  const ev = price > 0 && nature ? evaluatePurchase(price, nature, ctx) : null;
  const pending = data.purchaseDecisions.filter((p) => p.status === 'esperando' || p.status === 'lista' || p.status === 'pospuesta');
  const history = data.purchaseDecisions.filter((p) => p.status === 'comprada' || p.status === 'cancelada').sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));
  const now = useNow(pending.some((p) => p.status === 'esperando'));

  const submit = async () => {
    if (!product.trim() || price <= 0 || !nature || !ev) return;
    setBusy(true);
    try {
      const waitUntil = waitUntilFor(Date.now(), waitHours, nature, useWait);
      await add('purchaseDecisions', {
        product: product.trim().slice(0, 120),
        price,
        category,
        reason: reason.trim() || null,
        priority,
        decidedOn: on,
        nature,
        inBudget: ev.inBudget,
        affectsDebt: ev.affectsDebt,
        affectsSaving: ev.affectsSaving,
        waitUntil,
        status: waitUntil ? 'esperando' : 'lista',
        resolvedAt: null,
      });
      toast(waitUntil ? `Listo. Espera ${waitHours} h antes de decidir.` : 'Compra evaluada');
      setProduct('');
      setPrice(0);
      setReason('');
      setNature(null);
    } finally {
      setBusy(false);
    }
  };

  const buy = async (p: PurchaseDecision) => {
    await addTransaction({ kind: 'gasto', amount: p.price, occurredOn: today(), category: p.category, description: p.product, refTable: 'purchase_decisions', refId: p.id });
    await patch('purchaseDecisions', p.id, { status: 'comprada', resolvedAt: new Date().toISOString() });
    toast('Compra registrada como gasto. ¡Disfrútala!');
  };
  const cancel = async (p: PurchaseDecision) => {
    await patch('purchaseDecisions', p.id, { status: 'cancelada', resolvedAt: new Date().toISOString() });
    toast(`¡Bien! Evitaste gastar ${formatCOP(p.price)} 🪙`);
  };

  const verdictUI = ev && {
    adelante: { text: 'Adelante: tus números lo soportan', cls: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100', icon: <ThumbsUp size={18} /> },
    con_cuidado: { text: 'Con cuidado: es necesario, pero ajusta otra cosa', cls: 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100', icon: <AlertTriangle size={18} /> },
    no_ahora: { text: 'Mejor no ahora', cls: 'bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-100', icon: <XCircle size={18} /> },
  }[ev.verdict];

  return (
    <div>
      <PageHeader title="¿Realmente lo necesito?" subtitle="Decide con cabeza fría, no con el antojo" />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Dinero evitado" value={<Money value={avoidedTotal(data.purchaseDecisions)} className="text-emerald-600 dark:text-emerald-400" />} icon={<PiggyBank size={17} />} accent="#00a69a" />
        <Stat label="Canceladas" value={<span className="amount">{data.purchaseDecisions.filter((p) => p.status === 'cancelada').length}</span>} />
        <Stat label="Compradas" value={<span className="amount">{data.purchaseDecisions.filter((p) => p.status === 'comprada').length}</span>} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-5" data-tour="purchase-add">
          <h3 className="mb-4 font-bold">Quiero comprar…</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Producto">
                <Input value={product} maxLength={120} onChange={(e) => setProduct(e.target.value)} placeholder="Ej: tenis nuevos" />
              </Field>
              <Field label="Precio">
                <MoneyInput value={price} onChange={setPrice} />
              </Field>
              <Field label="Categoría">
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {cats.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Prioridad">
                <Select value={priority} onChange={(e) => setPriority(e.target.value as PurchaseDecision['priority'])}>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </Select>
              </Field>
            </div>
            <Field label="¿Por qué lo quieres?">
              <Input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Sé honesto contigo" />
            </Field>
            <div>
              <span className="label">¿Es una necesidad o un gusto?</span>
              <Segmented className="w-full" value={nature ?? ('' as 'necesidad')} onChange={setNature} options={[{ value: 'necesidad', label: 'Necesidad' }, { value: 'gusto', label: 'Gusto' }]} />
            </div>
            {ev && verdictUI && (
              <div className="animate-pop space-y-3">
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-3 dark:divide-white/5 dark:border-white/5">
                  <Answer q="¿Está dentro de mi presupuesto?" yes={ev.inBudget} good={ev.inBudget} />
                  <Answer q="¿Afectará el pago de alguna deuda?" yes={ev.affectsDebt} good={!ev.affectsDebt} />
                  <Answer q="¿Afectará mi ahorro?" yes={ev.affectsSaving} good={!ev.affectsSaving} />
                </ul>
                <div className={cx('rounded-xl p-3 text-sm', verdictUI.cls)}>
                  <p className="flex items-center gap-2 font-bold">{verdictUI.icon} {verdictUI.text}</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
                    {ev.messages.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                  {ctx.personalLeft == null && <p className="mt-1.5 text-xs opacity-80">Tip: distribuye tu quincena para que pueda comparar contra tu presupuesto personal.</p>}
                </div>
                {nature === 'gusto' && <Toggle checked={useWait} onChange={setUseWait} label={`Aplicar regla de espera de ${waitHours} horas`} hint="Si después de esperar aún lo quieres, cómpralo sin culpa" />}
              </div>
            )}
            <button className="btn-primary w-full" disabled={busy || !product.trim() || price <= 0 || !nature} onClick={() => void submit()}>
              <ShoppingCart size={18} /> {nature === 'gusto' && useWait ? 'Empezar espera' : 'Guardar decisión'}
            </button>
          </div>
        </Card>

        <div>
          <h3 className="mb-3 font-bold">En evaluación</h3>
          {pending.length === 0 ? (
            <Card className="p-6 text-center text-sm">
              <p className="muted">Nada en espera. Cuando te provoque algo, regístralo aquí antes de comprar.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pending.map((p) => {
                const left = p.status === 'esperando' ? remainingMs(p.waitUntil, now) : 0;
                const ready = left === 0;
                const total = p.waitUntil ? new Date(p.waitUntil).getTime() - new Date(p.createdAt ?? p.waitUntil).getTime() : 1;
                return (
                  <Card key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{p.product}</p>
                        <p className="muted text-xs">{categoryLabel(p.category, data.expenseCategories)} · {p.nature === 'gusto' ? 'Gusto' : 'Necesidad'} · prioridad {p.priority}</p>
                      </div>
                      <Money value={p.price} />
                    </div>
                    {p.status === 'esperando' && !ready && (
                      <div className="mt-3 rounded-xl bg-navy p-3 text-center text-white">
                        <p className="font-pixel text-[9px] text-coin">TIEMPO DE ENFRIAMIENTO</p>
                        <p className="font-pixel mt-2 text-lg tracking-widest"><Clock size={16} className="mr-2 inline" />{formatCountdown(left)}</p>
                        <div className="mx-auto mt-2 h-2 max-w-60 border-2 border-white p-[1px]">
                          <div className="h-full bg-coin transition-all" style={{ width: `${Math.max(0, Math.min(100, 100 - (left / total) * 100))}%` }} />
                        </div>
                      </div>
                    )}
                    {p.status === 'pospuesta' && <Badge tone="amber" className="mt-2">Pospuesta</Badge>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ready && p.status !== 'pospuesta' && (
                        <>
                          <button className="btn-primary !py-2 text-xs" onClick={() => void buy(p)}><ShoppingCart size={14} /> Comprar</button>
                          <button className="btn-secondary !py-2 text-xs" onClick={() => void patch('purchaseDecisions', p.id, { status: 'pospuesta' })}><PauseCircle size={14} /> Posponer</button>
                        </>
                      )}
                      {p.status === 'pospuesta' && (
                        <button className="btn-secondary !py-2 text-xs" onClick={() => void patch('purchaseDecisions', p.id, { status: 'lista' })}><RotateCcw size={14} /> Retomar</button>
                      )}
                      <button className="btn !py-2 text-xs bg-emerald-600 text-white" onClick={() => void cancel(p)}><XCircle size={14} /> Cancelar compra</button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <>
          <SectionTitle>Historial</SectionTitle>
          <Card className="divide-y divide-slate-100 dark:divide-white/5">
            {history.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.product}</p>
                  <p className="muted text-xs">{formatDate((p.resolvedAt ?? p.decidedOn).slice(0, 10))}</p>
                </div>
                <Badge tone={p.status === 'cancelada' ? 'green' : 'slate'}>{p.status === 'cancelada' ? 'Evitada' : 'Comprada'}</Badge>
                <Money value={p.price} />
                <ConfirmButton className="btn-ghost !p-2 text-slate-400" confirmText="Borrar" onConfirm={() => void remove('purchaseDecisions', p.id)}>
                  <Trash2 size={15} />
                </ConfirmButton>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
