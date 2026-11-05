import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, CheckCircle2, Receipt } from 'lucide-react';
import { useData } from '../store/data';
import { useUI, toast } from '../store/ui';
import { Badge, Card, ConfirmButton, DataBadge, Empty, Field, Input, Modal, Money, MoneyInput, Notice, PageHeader, Segmented, Select, Toggle, cx } from '../components/ui';
import { allCategories, categoryColor, categoryLabel, SCHEDULE_LABEL } from '../lib/constants';
import { monthlyExpenses, monthlyIncome, monthTotals } from '../lib/calc/budget';
import { addMonths, firstOfMonth, formatDate, formatMonth, monthKey, today } from '../lib/dates';
import { formatCOP } from '../lib/money';
import { isoDate, money } from '../components/QuickAdd';
import type { Expense, Income, Transaction } from '../types';

type Tab = 'historial' | 'ingresos' | 'gastos';

export default function Movimientos() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'historial';
  return (
    <div>
      <PageHeader title="Movimientos" subtitle="Tu historial, tus ingresos y tus gastos fijos" />
      <div data-tour="mov-tabs" className="mb-5">
        <Segmented
          className="w-full sm:w-auto"
          value={tab}
          onChange={(v) => setParams({ tab: v }, { replace: true })}
          options={[
            { value: 'historial', label: 'Historial' },
            { value: 'ingresos', label: 'Ingresos' },
            { value: 'gastos', label: 'Gastos fijos' },
          ]}
        />
      </div>
      {tab === 'historial' && <History />}
      {tab === 'ingresos' && <IncomeTab />}
      {tab === 'gastos' && <ExpensesTab />}
    </div>
  );
}

// =====================================================================
// Historial
// =====================================================================
const KIND_LABEL: Record<Transaction['kind'], string> = {
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  abono_deuda: 'Abono a deuda',
  ahorro: 'Ahorro',
  retiro_ahorro: 'Retiro de ahorro',
};

function History() {
  const { data, remove } = useData();
  const setQuickAdd = useUI((s) => s.setQuickAdd);
  const [month, setMonth] = useState(firstOfMonth(today()));
  const [filter, setFilter] = useState<'todos' | 'entradas' | 'salidas'>('todos');
  const key = monthKey(month);
  const totals = monthTotals(data.transactions, key);
  const list = useMemo(
    () =>
      data.transactions
        .filter((t) => monthKey(t.occurredOn) === key)
        .filter((t) => (filter === 'todos' ? true : filter === 'entradas' ? t.kind === 'ingreso' || t.kind === 'retiro_ahorro' : t.kind !== 'ingreso' && t.kind !== 'retiro_ahorro'))
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [data.transactions, key, filter],
  );
  const groups = list.reduce<Record<string, Transaction[]>>((acc, t) => ((acc[t.occurredOn] ??= []).push(t), acc), {});

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button className="btn-secondary !p-2" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold capitalize">{formatMonth(month, true)}</span>
        <button className="btn-secondary !p-2" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Card className="p-3">
          <p className="muted text-xs">Entradas</p>
          <Money value={totals.ingresos} className="text-teal-600 dark:text-teal-300" />
        </Card>
        <Card className="p-3">
          <p className="muted text-xs">Gastos</p>
          <Money value={totals.gastos} />
        </Card>
        <Card className="p-3">
          <p className="muted text-xs">Deudas + ahorro</p>
          <Money value={totals.deudas + totals.ahorro} />
        </Card>
      </div>
      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'entradas', label: 'Entradas' },
          { value: 'salidas', label: 'Salidas' },
        ]}
      />
      {list.length === 0 ? (
        <Empty title="Sin movimientos este mes" text="Registra tus gastos e ingresos reales para que tu dinero disponible sea exacto." action={<button className="btn-primary" onClick={() => setQuickAdd(true)}><Plus size={18} /> Registrar movimiento</button>} />
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([date, items]) => (
            <div key={date}>
              <p className="muted mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide">{formatDate(date)}</p>
              <Card className="divide-y divide-slate-100 dark:divide-white/5">
                {items.map((t) => {
                  const inflow = t.kind === 'ingreso' || t.kind === 'retiro_ahorro';
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${inflow ? '#00a69a' : categoryColor(t.category, data.expenseCategories)}1a`, color: inflow ? '#00a69a' : categoryColor(t.category, data.expenseCategories) }}>
                        {inflow ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{t.description || categoryLabel(t.category, data.expenseCategories)}</p>
                        <p className="muted truncate text-xs">{KIND_LABEL[t.kind]} · {categoryLabel(t.category, data.expenseCategories)}</p>
                      </div>
                      <Money value={inflow ? t.amount : -t.amount} className={cx('text-sm', inflow && 'text-teal-600 dark:text-teal-300')} signed />
                      {t.refTable && t.refTable !== 'income' && t.refTable !== 'purchase_decisions' && t.refTable !== 'freelance_projects' ? (
                        <span className="w-8" title="Se gestiona desde su módulo (deuda o meta)" />
                      ) : (
                        <ConfirmButton className="btn-ghost !p-1.5 text-slate-400" confirmText="Borrar" onConfirm={() => void remove('transactions', t.id).then(() => toast('Movimiento eliminado'))}>
                          <Trash2 size={16} />
                        </ConfirmButton>
                      )}
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Ingresos
// =====================================================================
const incomeSchema = z
  .object({
    name: z.string().trim().min(1, 'Escribe un nombre').max(80),
    amount: z.number().int().min(0).max(99_999_999_999),
    schedule: z.enum(['q1', 'q2', 'mensual', 'extraordinario']),
    status: z.enum(['estimado', 'confirmado', 'recibido']),
    expectedOn: z.string().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => v.amount > 0, { path: ['amount'], message: 'Ingresa un monto mayor a $0' });
type IncomeForm = z.infer<typeof incomeSchema>;

function IncomeModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Income | null }) {
  const { add, patch } = useData();
  const { register, control, handleSubmit, watch, formState } = useForm<IncomeForm>({
    resolver: zodResolver(incomeSchema),
    values: editing
      ? { name: editing.name, amount: editing.amount, schedule: editing.schedule, status: editing.status, expectedOn: editing.expectedOn ?? '', notes: editing.notes ?? '' }
      : { name: '', amount: 0, schedule: 'q1', status: 'confirmado', expectedOn: '', notes: '' },
  });
  const schedule = watch('schedule');
  const submit = async (v: IncomeForm) => {
    const row = { ...v, expectedOn: v.expectedOn || null, notes: v.notes || null, status: v.schedule !== 'extraordinario' && v.status === 'recibido' ? 'confirmado' : v.status } as Omit<Income, 'id'>;
    if (editing) await patch('income', editing.id, row);
    else await add('income', row);
    toast(editing ? 'Ingreso actualizado' : 'Ingreso agregado');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar ingreso' : 'Nuevo ingreso'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <Field label="Nombre" error={formState.errors.name?.message}>
          <Input placeholder="Ej: Salario, prima de diciembre" {...register('name')} />
        </Field>
        <Field label="Monto" error={formState.errors.amount?.message}>
          <Controller control={control} name="amount" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="¿Cuándo llega?">
            <Select {...register('schedule')}>
              {Object.entries(SCHEDULE_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select {...register('status')}>
              <option value="confirmado">Confirmado</option>
              <option value="estimado">Estimado</option>
              {schedule === 'extraordinario' && <option value="recibido">Recibido</option>}
            </Select>
          </Field>
        </div>
        {schedule === 'extraordinario' && (
          <>
            <Field label="Fecha esperada">
              <Input type="date" {...register('expectedOn')} />
            </Field>
            <Notice tone="amber">Los ingresos extraordinarios (prima, bonos) <b>no se suman a tu dinero disponible</b> hasta que marques que los recibiste.</Notice>
          </>
        )}
        <Field label="Notas (opcional)">
          <Input {...register('notes')} />
        </Field>
        <button className="btn-primary w-full" disabled={formState.isSubmitting}>Guardar</button>
      </form>
    </Modal>
  );
}

function ReceiveModal({ income, onClose }: { income: Income | null; onClose: () => void }) {
  const { addTransaction, patch } = useData();
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  if (!income) return null;
  const value = amount || income.amount;
  return (
    <Modal open onClose={onClose} title={`Registrar: ${income.name}`}>
      <div className="space-y-4">
        <Field label="Monto recibido realmente" hint="Ajusta si recibiste un valor diferente al esperado">
          <MoneyInput value={value} onChange={setAmount} />
        </Field>
        <Field label="Fecha">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <button
          className="btn-primary w-full"
          disabled={busy || value <= 0 || !isoDate.safeParse(date).success}
          onClick={async () => {
            setBusy(true);
            try {
              await addTransaction({ kind: 'ingreso', amount: value, occurredOn: date, category: income.schedule === 'extraordinario' ? 'prima' : 'salario', description: income.name, refTable: 'income', refId: income.id });
              if (income.schedule === 'extraordinario') await patch('income', income.id, { status: 'recibido', amount: value });
              toast(`${formatCOP(value)} sumados a tu dinero disponible`);
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          <CheckCircle2 size={18} /> Confirmar recepción
        </button>
      </div>
    </Modal>
  );
}

function IncomeTab() {
  const { data, remove } = useData();
  const [modal, setModal] = useState<{ open: boolean; editing: Income | null }>({ open: false, editing: null });
  const [receiving, setReceiving] = useState<Income | null>(null);
  const m = monthlyIncome(data.income);
  const recurring = data.income.filter((i) => i.schedule !== 'extraordinario');
  const extra = data.income.filter((i) => i.schedule === 'extraordinario');

  const row = (i: Income) => (
    <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{i.name}</p>
        <p className="muted flex flex-wrap items-center gap-1.5 text-xs">
          {SCHEDULE_LABEL[i.schedule]}
          {i.expectedOn && ` · ${formatDate(i.expectedOn)}`}
          <DataBadge kind={i.status === 'estimado' ? 'estimado' : 'confirmado'} />
          {i.status === 'recibido' && <Badge tone="green">Recibido</Badge>}
        </p>
      </div>
      <Money value={i.amount} />
      <div className="flex w-full justify-end gap-1 sm:w-auto">
        {i.status !== 'recibido' && (
          <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setReceiving(i)}>
            <CheckCircle2 size={14} /> Lo recibí
          </button>
        )}
        <button className="btn-ghost !p-2" onClick={() => setModal({ open: true, editing: i })} aria-label="Editar">
          <Pencil size={16} />
        </button>
        <ConfirmButton className="btn-ghost !p-2 text-slate-400" confirmText="Eliminar" onConfirm={() => void remove('income', i.id)}>
          <Trash2 size={16} />
        </ConfirmButton>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="muted text-xs">Ingreso mensual recurrente</p>
          <Money value={m.total} className="text-xl" />
          {m.estimated > 0 && <p className="mt-1 text-xs text-amber-600">Incluye {formatCOP(m.estimated)} estimados</p>}
        </Card>
        <Card className="p-4">
          <p className="muted text-xs">1.ª quincena</p>
          <Money value={data.income.filter((i) => i.schedule === 'q1' || i.schedule === 'mensual').reduce((s, i) => s + i.amount, 0)} className="text-xl" />
        </Card>
        <Card className="p-4">
          <p className="muted text-xs">2.ª quincena</p>
          <Money value={data.income.filter((i) => i.schedule === 'q2').reduce((s, i) => s + i.amount, 0)} className="text-xl" />
        </Card>
      </div>
      <Notice>Configurar un ingreso no cambia tu dinero disponible. Cuando te paguen, pulsa <b>“Lo recibí”</b> para registrarlo como movimiento real.</Notice>

      <div className="flex items-center justify-between">
        <h3 className="font-bold">Ingresos recurrentes</h3>
        <button className="btn-primary !py-2" onClick={() => setModal({ open: true, editing: null })}>
          <Plus size={16} /> Agregar
        </button>
      </div>
      {recurring.length ? <Card className="divide-y divide-slate-100 dark:divide-white/5">{recurring.map(row)}</Card> : <Empty title="Aún no configuras ingresos" text="Agrega tu salario de cada quincena para planear tu presupuesto." />}

      <h3 className="font-bold">Extraordinarios (prima, bonos)</h3>
      {extra.length ? <Card className="divide-y divide-slate-100 dark:divide-white/5">{extra.map(row)}</Card> : <p className="muted text-sm">Sin ingresos extraordinarios. Agrégalos con estado “Estimado” hasta recibirlos.</p>}

      <IncomeModal open={modal.open} editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />
      <ReceiveModal key={receiving?.id ?? "none"} income={receiving} onClose={() => setReceiving(null)} />
    </div>
  );
}

// =====================================================================
// Gastos fijos
// =====================================================================
const expenseSchema = z
  .object({
    name: z.string().trim().min(1, 'Escribe un nombre').max(80),
    category: z.string().min(2),
    amount: z.number().int().min(0).max(99_999_999_999),
    isVariable: z.boolean(),
    amountMin: z.number().int().min(0).nullable(),
    amountMax: z.number().int().min(0).nullable(),
    dueDay: z.union([z.number().int().min(1).max(31), z.nan()]).nullable(),
    isEstimate: z.boolean(),
    active: z.boolean(),
  })
  .refine((v) => v.amount > 0, { path: ['amount'], message: 'Ingresa un monto mayor a $0' })
  .refine((v) => !v.isVariable || (v.amountMin != null && v.amountMax != null && v.amountMin <= v.amountMax && v.amountMax > 0), { path: ['amountMax'], message: 'El mínimo debe ser menor o igual al máximo' });
type ExpenseForm = z.infer<typeof expenseSchema>;

function ExpenseModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Expense | null }) {
  const { add, patch, data } = useData();
  const cats = allCategories(data.expenseCategories);
  const { register, control, handleSubmit, watch, setValue, formState } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    values: editing
      ? { name: editing.name, category: editing.category, amount: editing.amount, isVariable: editing.isVariable, amountMin: editing.amountMin, amountMax: editing.amountMax, dueDay: editing.dueDay, isEstimate: editing.isEstimate, active: editing.active }
      : { name: '', category: 'vivienda', amount: 0, isVariable: false, amountMin: null, amountMax: null, dueDay: null, isEstimate: false, active: true },
  });
  const isVariable = watch('isVariable');
  const submit = async (v: ExpenseForm) => {
    const row = {
      ...v,
      dueDay: v.dueDay && !Number.isNaN(v.dueDay) ? v.dueDay : null,
      amountMin: v.isVariable ? v.amountMin : null,
      amountMax: v.isVariable ? v.amountMax : null,
    };
    if (editing) await patch('expenses', editing.id, row);
    else await add('expenses', row);
    toast(editing ? 'Gasto actualizado' : 'Gasto fijo agregado');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" error={formState.errors.name?.message}>
            <Input placeholder="Ej: Arriendo" {...register('name')} />
          </Field>
          <Field label="Categoría">
            <Select {...register('category')}>
              {cats.map((c) => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={isVariable ? 'Valor típico' : 'Valor mensual'} error={formState.errors.amount?.message}>
          <Controller control={control} name="amount" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
        </Field>
        <Toggle checked={isVariable} onChange={(v) => setValue('isVariable', v)} label="Valor variable" hint="Ej: la luz cambia cada mes" />
        {isVariable && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mínimo">
              <Controller control={control} name="amountMin" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Máximo" error={formState.errors.amountMax?.message}>
              <Controller control={control} name="amountMax" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
            </Field>
          </div>
        )}
        <Field label="Día de pago (opcional)" hint="Para avisarte y asignarlo a la quincena correcta">
          <Input type="number" min={1} max={31} inputMode="numeric" placeholder="Ej: 5" {...register('dueDay', { setValueAs: (v) => (v === '' || v == null ? null : Number(v)) })} />
        </Field>
        <Controller control={control} name="isEstimate" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Es un valor estimado" hint="Aún no conoces el valor exacto" />} />
        <Controller control={control} name="active" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Activo" hint="Desactívalo si ya no lo pagas" />} />
        <button className="btn-primary w-full" disabled={formState.isSubmitting}>Guardar</button>
      </form>
    </Modal>
  );
}

function PayExpenseModal({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const addTransaction = useData((s) => s.addTransaction);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today());
  if (!expense) return null;
  const value = amount || expense.amount;
  return (
    <Modal open onClose={onClose} title={`Pagar: ${expense.name}`}>
      <div className="space-y-4">
        <Field label="Valor pagado">
          <MoneyInput value={value} onChange={setAmount} />
        </Field>
        <Field label="Fecha">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <button
          className="btn-primary w-full"
          disabled={value <= 0 || !money().safeParse(value).success}
          onClick={async () => {
            await addTransaction({ kind: 'gasto', amount: value, occurredOn: date, category: expense.category, description: expense.name, refTable: null, refId: null });
            toast(`Pago de ${expense.name} registrado`);
            onClose();
          }}
        >
          <Receipt size={18} /> Registrar pago
        </button>
      </div>
    </Modal>
  );
}

function ExpensesTab() {
  const { data, remove, add } = useData();
  const [modal, setModal] = useState<{ open: boolean; editing: Expense | null }>({ open: false, editing: null });
  const [paying, setPaying] = useState<Expense | null>(null);
  const [newCat, setNewCat] = useState('');
  const totals = monthlyExpenses(data.expenses);
  const cats = allCategories(data.expenseCategories);
  const byCat = cats.map((c) => ({ ...c, items: data.expenses.filter((e) => e.category === c.slug) })).filter((c) => c.items.length);
  const orphan = data.expenses.filter((e) => !cats.some((c) => c.slug === e.category));

  const addCategory = async () => {
    const name = newCat.trim();
    if (name.length < 2) return;
    const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    if (slug.length < 2 || cats.some((c) => c.slug === slug)) return toast('Esa categoría ya existe', 'error');
    await add('expenseCategories', { slug, name: name.slice(0, 40) });
    setNewCat('');
    toast('Categoría creada');
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="muted text-xs">Total gastos fijos al mes</p>
          <Money value={totals.base} className="text-xl" />
          {totals.min !== totals.max && <p className="muted mt-1 text-xs">Entre {formatCOP(totals.min)} y {formatCOP(totals.max)}</p>}
        </Card>
        <Card className="p-4">
          <p className="muted text-xs">Te queda después de gastos fijos</p>
          <Money value={monthlyIncome(data.income).total - totals.max} className="text-xl" />
          <p className="muted mt-1 text-xs">Ingreso recurrente − gasto máximo</p>
        </Card>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Tus gastos fijos</h3>
        <button className="btn-primary !py-2" onClick={() => setModal({ open: true, editing: null })}>
          <Plus size={16} /> Agregar
        </button>
      </div>
      {byCat.length === 0 && orphan.length === 0 ? (
        <Empty title="Sin gastos fijos" text="Agrega arriendo, servicios, comida, transporte, suscripciones… Todo es editable." />
      ) : (
        [...byCat, ...(orphan.length ? [{ slug: 'otros_x', label: 'Sin categoría', color: '#64748b', items: orphan }] : [])].map((c) => (
          <div key={c.slug}>
            <div className="mb-1.5 flex items-center justify-between px-1">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                {c.label}
              </span>
              <Money value={c.items.filter((e) => e.active).reduce((s, e) => s + e.amount, 0)} className="text-sm" />
            </div>
            <Card className="divide-y divide-slate-100 dark:divide-white/5">
              {c.items.map((e) => (
                <div key={e.id} className={cx('flex items-center gap-3 px-4 py-3', !e.active && 'opacity-50')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.name}</p>
                    <p className="muted flex flex-wrap items-center gap-1.5 text-xs">
                      {e.dueDay ? `Día ${e.dueDay}` : 'Sin día fijo'}
                      {e.isVariable && e.amountMin != null && ` · ${formatCOP(e.amountMin)} – ${formatCOP(e.amountMax ?? 0)}`}
                      {e.isEstimate && <DataBadge kind="estimado" />}
                      {!e.active && <Badge>Inactivo</Badge>}
                    </p>
                  </div>
                  <Money value={e.amount} />
                  <button className="btn-ghost !p-2" onClick={() => setPaying(e)} aria-label="Registrar pago" title="Registrar pago">
                    <Receipt size={16} />
                  </button>
                  <button className="btn-ghost !p-2" onClick={() => setModal({ open: true, editing: e })} aria-label="Editar">
                    <Pencil size={16} />
                  </button>
                  <ConfirmButton className="btn-ghost !p-2 text-slate-400" confirmText="Eliminar" onConfirm={() => void remove('expenses', e.id)}>
                    <Trash2 size={16} />
                  </ConfirmButton>
                </div>
              ))}
            </Card>
          </div>
        ))
      )}
      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold">Crear categoría personalizada</p>
        <div className="flex gap-2">
          <Input value={newCat} maxLength={40} onChange={(e) => setNewCat(e.target.value)} placeholder="Ej: Gimnasio" onKeyDown={(e) => e.key === 'Enter' && void addCategory()} />
          <button className="btn-secondary" onClick={() => void addCategory()}>Crear</button>
        </div>
        {data.expenseCategories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.expenseCategories.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs font-semibold dark:bg-white/5">
                {c.name}
                <ConfirmButton className="rounded-full p-1 text-slate-400 hover:text-red-500" confirmText="×" onConfirm={() => void remove('expenseCategories', c.id)}>
                  <Trash2 size={12} />
                </ConfirmButton>
              </span>
            ))}
          </div>
        )}
      </Card>
      <ExpenseModal open={modal.open} editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />
      <PayExpenseModal key={paying?.id ?? "none"} expense={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
