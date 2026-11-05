// Fases 1-2: ingresos, gastos, libro de movimientos y distribución quincenal.
import type { Bucket, Debt, Expense, Income, ISODate, Transaction } from '../../types';
import { addDays, addMonths, lastDayOfMonth, monthKey } from '../dates';
import { sum } from '../money';

/** Ingreso mensual recurrente. Los extraordinarios (prima, bonos) NUNCA se suman aquí. */
export function monthlyIncome(income: Income[]) {
  const recurring = income.filter((i) => i.schedule !== 'extraordinario');
  const confirmed = sum(recurring.filter((i) => i.status !== 'estimado').map((i) => i.amount));
  const estimated = sum(recurring.filter((i) => i.status === 'estimado').map((i) => i.amount));
  return { confirmed, estimated, total: confirmed + estimated };
}

/** Ingreso esperado de una quincena. Los ingresos "mensual" se cuentan en la primera. */
export function halfIncome(income: Income[], half: 1 | 2): number {
  return sum(
    income
      .filter((i) => (half === 1 ? i.schedule === 'q1' || i.schedule === 'mensual' : i.schedule === 'q2'))
      .map((i) => i.amount),
  );
}

/** Extraordinarios aún no recibidos: se muestran aparte, jamás en el saldo. */
export function pendingExtraordinary(income: Income[]) {
  return income.filter((i) => i.schedule === 'extraordinario' && i.status !== 'recibido');
}

/** Gasto mensual fijo. Para variables: base = valor típico, min/max = rango. */
export function monthlyExpenses(expenses: Expense[]) {
  const active = expenses.filter((e) => e.active);
  return {
    base: sum(active.map((e) => e.amount)),
    min: sum(active.map((e) => e.amountMin ?? e.amount)),
    max: sum(active.map((e) => e.amountMax ?? e.amount)),
  };
}

export function expensesByCategory(expenses: Expense[]) {
  const map = new Map<string, number>();
  for (const e of expenses.filter((x) => x.active)) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

const SIGN: Record<Transaction['kind'], 1 | -1> = {
  ingreso: 1,
  retiro_ahorro: 1,
  gasto: -1,
  abono_deuda: -1,
  ahorro: -1,
};

/** Dinero disponible real = suma de movimientos registrados (ingresos − salidas). */
export function ledgerBalance(tx: Transaction[]): number {
  return sum(tx.map((t) => SIGN[t.kind] * t.amount));
}

export function monthTotals(tx: Transaction[], month: string) {
  const inMonth = tx.filter((t) => monthKey(t.occurredOn) === month);
  const by = (k: Transaction['kind']) => sum(inMonth.filter((t) => t.kind === k).map((t) => t.amount));
  return {
    ingresos: by('ingreso'),
    gastos: by('gasto'),
    deudas: by('abono_deuda'),
    ahorro: by('ahorro') - by('retiro_ahorro'),
  };
}

/** Meses (con ingresos registrados) en los que lo que salió no superó lo recibido. */
export function monthsWithinBudget(tx: Transaction[]): number {
  const months = [...new Set(tx.map((t) => monthKey(t.occurredOn)))];
  return months.filter((m) => {
    const t = monthTotals(tx, m);
    return t.ingresos > 0 && t.gastos + t.deudas + t.ahorro <= t.ingresos;
  }).length;
}

// ---------- vencimientos ----------
export interface DueItem {
  date: ISODate;
  label: string;
  amount: number;
  kind: 'gasto' | 'deuda' | 'freelance' | 'ingreso';
  estimate: boolean;
}

const ACTIVE_DEBT = (d: Debt) => d.status !== 'pagada' && d.status !== 'paz_y_salvo';

/** Pago esperado de una deuda: cuota negociada > pago mínimo > 0. */
export const debtInstallment = (d: Debt) => d.negotiatedPayment ?? d.minimumPayment ?? 0;

/** Próximos vencimientos entre `from` y `from + days` (incluidos). */
export function upcomingDue(expenses: Expense[], debts: Debt[], from: ISODate, days: number): DueItem[] {
  const to = addDays(from, days);
  const items: DueItem[] = [];
  for (const e of expenses.filter((x) => x.active && x.dueDay)) {
    for (let cursor = `${from.slice(0, 7)}-01`; cursor <= to; cursor = addMonths(cursor, 1)) {
      const day = Math.min(e.dueDay!, lastDayOfMonth(cursor));
      const date = `${cursor.slice(0, 8)}${String(day).padStart(2, '0')}`;
      if (date >= from && date <= to)
        items.push({ date, label: e.name, amount: e.amountMax ?? e.amount, kind: 'gasto', estimate: e.isEstimate || e.isVariable });
    }
  }
  for (const d of debts.filter(ACTIVE_DEBT)) {
    if (d.nextPaymentDate && d.nextPaymentDate >= from && d.nextPaymentDate <= to)
      items.push({ date: d.nextPaymentDate, label: `Pago ${d.creditor}`, amount: debtInstallment(d), kind: 'deuda', estimate: d.isEstimate });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

/** Rango de fechas de una quincena. */
export function halfRange(period: ISODate, half: 1 | 2): { from: ISODate; to: ISODate } {
  const ym = period.slice(0, 7);
  const last = lastDayOfMonth(period);
  return half === 1 ? { from: `${ym}-01`, to: `${ym}-15` } : { from: `${ym}-16`, to: `${ym}-${last}` };
}

/**
 * Compromisos de una quincena: gastos cuyo día de pago cae en ese rango
 * (los que no tienen día se reparten 50/50) + cuotas de deuda que vencen en el rango.
 * Para gastos variables se usa el valor máximo (criterio conservador).
 */
export function committedForHalf(expenses: Expense[], debts: Debt[], period: ISODate, half: 1 | 2) {
  const { from, to } = halfRange(period, half);
  let obligatorios = 0;
  for (const e of expenses.filter((x) => x.active)) {
    const value = e.amountMax ?? e.amount;
    if (!e.dueDay) obligatorios += half === 1 ? Math.ceil(value / 2) : Math.floor(value / 2);
    else if ((e.dueDay <= 15 ? 1 : 2) === half) obligatorios += value;
  }
  const deudas = sum(
    debts
      .filter((d) => ACTIVE_DEBT(d) && d.nextPaymentDate && d.nextPaymentDate >= from && d.nextPaymentDate <= to)
      .map(debtInstallment),
  );
  return { obligatorios, deudas, total: obligatorios + deudas };
}

export const BUCKETS: Bucket[] = ['obligatorios', 'deudas', 'personales', 'emergencia', 'moto'];

export function summarizeDistribution(received: number, allocations: { bucket: Bucket; amount: number }[], committed: number) {
  const assigned = sum(allocations.map((a) => a.amount));
  const byBucket = Object.fromEntries(
    BUCKETS.map((b) => [b, sum(allocations.filter((a) => a.bucket === b).map((a) => a.amount))]),
  ) as Record<Bucket, number>;
  const remaining = received - assigned;
  return {
    assigned,
    remaining,
    byBucket,
    overBudget: remaining < 0,
    overBy: Math.max(0, -remaining),
    committed,
    /** Compromisos (obligatorios + deudas) que no quedaron cubiertos. */
    uncovered: Math.max(0, committed - byBucket.obligatorios - byBucket.deudas),
  };
}

/**
 * Sugerencia (editable, no obligatoria): cubre primero obligatorios y cuotas de deuda;
 * el resto se reparte con los pesos dados, en múltiplos de $1.000; el sobrante va a personales.
 * La suma siempre es exactamente igual a lo recibido.
 */
export function suggestDistribution(
  received: number,
  committed: { obligatorios: number; deudas: number },
  weights: { personales: number; emergencia: number; moto: number; deudas: number } = {
    deudas: 30,
    emergencia: 25,
    moto: 20,
    personales: 25,
  },
): Record<Bucket, number> {
  const obligatorios = Math.min(received, committed.obligatorios);
  let left = received - obligatorios;
  const debtMin = Math.min(left, committed.deudas);
  left -= debtMin;
  const totalW = weights.personales + weights.emergencia + weights.moto + weights.deudas || 1;
  const part = (w: number) => Math.floor((left * w) / totalW / 1000) * 1000;
  const extraDeudas = part(weights.deudas);
  const emergencia = part(weights.emergencia);
  const moto = part(weights.moto);
  const personales = left - extraDeudas - emergencia - moto;
  return { obligatorios, deudas: debtMin + extraDeudas, personales, emergencia, moto };
}
