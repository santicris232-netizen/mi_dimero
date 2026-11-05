// Agregados que usan varias pantallas. Funciones puras sobre el Dataset.
import type { Dataset, ISODate } from '../types';
import {
  committedForHalf,
  debtInstallment,
  ledgerBalance,
  monthlyExpenses,
  monthlyIncome,
  monthTotals,
  monthsWithinBudget,
  pendingExtraordinary,
  upcomingDue,
  type DueItem,
} from './calc/budget';
import { debtSummary, isActiveDebt } from './calc/debts';
import { goalProgress, goalSaved } from './calc/goals';
import { avoidedTotal } from './calc/purchases';
import { addMonths, firstOfMonth, halfOf, monthKey } from './dates';
import { sum } from './money';

export function debtRows(data: Dataset) {
  return data.debts.map((d) => ({ debt: d, summary: debtSummary(d, data.debtPayments, data.debtNegotiations) }));
}

export function goalRows(data: Dataset, on: ISODate) {
  return data.savingsGoals.map((g) => {
    const saved = goalSaved(g, data.savingsContributions);
    return { goal: g, saved, progress: goalProgress({ target: g.targetAmount, saved, targetDate: g.targetDate, monthlyContribution: g.monthlyContribution, today: on }) };
  });
}

export function overview(data: Dataset, on: ISODate) {
  const income = monthlyIncome(data.income);
  const expenses = monthlyExpenses(data.expenses);
  const available = ledgerBalance(data.transactions);
  const debts = debtRows(data);
  const active = debts.filter((r) => isActiveDebt(r.debt));
  const debtTotal = sum(active.map((r) => r.summary.balance));
  const debtHasEstimates = active.some((r) => r.debt.isEstimate);
  const debtInstallments = sum(active.map((r) => debtInstallment(r.debt)));
  const goals = goalRows(data, on);
  const emergency = goals.filter((g) => g.goal.kind === 'emergencia');
  const moto = goals.find((g) => g.goal.kind === 'moto') ?? null;
  // Capacidad mensual: ingreso recurrente − gastos fijos (máximo de los variables). Base para planear deudas y ahorro.
  const monthlyCapacity = income.total - expenses.max;
  const upcoming: DueItem[] = [
    ...upcomingDue(data.expenses, data.debts, on, 30),
    ...data.freelanceProjects
      .filter((p) => p.deliveryDate && p.deliveryDate >= on && p.deliveryDate <= addMonths(on, 1) && p.status !== 'cancelado' && p.status !== 'pagado')
      .map((p) => ({ date: p.deliveryDate!, label: `Entrega: ${p.project}`, amount: Math.max(0, p.contractValue - p.receivedTotal), kind: 'freelance' as const, estimate: true })),
    ...pendingExtraordinary(data.income)
      .filter((i) => i.expectedOn && i.expectedOn >= on && i.expectedOn <= addMonths(on, 2))
      .map((i) => ({ date: i.expectedOn!, label: `${i.name} (estimado)`, amount: i.amount, kind: 'ingreso' as const, estimate: true })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const half = halfOf(on);
  const committed = committedForHalf(data.expenses, data.debts, firstOfMonth(on), half);

  return {
    income,
    expenses,
    available,
    debtTotal,
    debtHasEstimates,
    debtInstallments,
    activeDebtCount: active.length,
    hasArrears: active.some((r) => r.debt.status === 'en_mora'),
    emergencySaved: sum(emergency.map((g) => g.saved)),
    emergencyTarget: sum(emergency.map((g) => g.goal.targetAmount)),
    moto,
    goals,
    monthlyCapacity,
    upcoming,
    committed,
    half,
    progress: {
      debtReduced: sum(debts.map((r) => r.summary.paidTotal)),
      saved: sum(data.savingsContributions.map((c) => c.amount)),
      monthsOk: monthsWithinBudget(data.transactions),
      goalsReached: goals.filter((g) => g.goal.targetAmount > 0 && g.saved >= g.goal.targetAmount).length + data.debts.filter((d) => d.status === 'paz_y_salvo' || d.status === 'pagada').length,
      avoided: avoidedTotal(data.purchaseDecisions),
    },
    extraordinary: pendingExtraordinary(data.income),
  };
}

/** Serie de los últimos n meses para gráficas. */
export function monthlySeries(data: Dataset, on: ISODate, n = 6) {
  const out = [];
  let cumulativeSaving = 0;
  const startMonth = addMonths(firstOfMonth(on), -(n - 1));
  // ahorro acumulado previo al rango
  cumulativeSaving += sum(data.savingsContributions.filter((c) => c.contributedOn < startMonth).map((c) => c.amount));
  cumulativeSaving += sum(data.savingsGoals.map((g) => g.initialSaved));
  const rows = debtRows(data);
  for (let i = 0; i < n; i++) {
    const m = addMonths(startMonth, i);
    const key = monthKey(m);
    const t = monthTotals(data.transactions, key);
    cumulativeSaving += sum(data.savingsContributions.filter((c) => monthKey(c.contributedOn) === key).map((c) => c.amount));
    const endOfMonth = addMonths(m, 1);
    // saldo de deuda al cierre del mes (reconstruido desde los abonos registrados)
    const debt = sum(
      rows
        .filter((r) => (r.debt.createdAt ?? '').slice(0, 10) < endOfMonth)
        .map((r) => {
          const paidAfter = sum(data.debtPayments.filter((p) => p.debtId === r.debt.id && p.paidOn >= endOfMonth && (!r.summary.baseDate || p.paidOn >= r.summary.baseDate)).map((p) => p.amount));
          return Math.min(r.summary.base, r.summary.balance + paidAfter);
        }),
    );
    out.push({ month: key, ingresos: t.ingresos, gastos: t.gastos + t.deudas, ahorro: cumulativeSaving, deuda: debt });
  }
  return out;
}
