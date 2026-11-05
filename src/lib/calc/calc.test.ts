import { describe, expect, it } from 'vitest';
import type { Debt, DebtNegotiation, DebtPayment, Expense, FreelanceProject, Income, SavingsGoal, Transaction } from '../../types';
import { formatCOP, formatPct, parseCOP, percent, splitByPercent, groupInput } from '../money';
import { addMonths, monthsBetween } from '../dates';
import {
  committedForHalf,
  halfIncome,
  ledgerBalance,
  monthlyExpenses,
  monthlyIncome,
  pendingExtraordinary,
  suggestDistribution,
  summarizeDistribution,
  upcomingDue,
  monthsWithinBudget,
} from './budget';
import { analyzeOffer, canMarkPaid, canMarkPazYSalvo, currentDaysPastDue, debtSummary } from './debts';
import { avoidedTotal, evaluatePurchase, waitUntilFor, formatCountdown } from './purchases';
import { compareFinancing, goalProgress, goalSaved, loanPayment, motoCashTotal } from './goals';
import { simulatePayoff } from './simulator';
import { freelanceSummary, splitPayment } from './freelance';

const inc = (p: Partial<Income>): Income => ({ id: crypto.randomUUID(), name: 'x', amount: 0, schedule: 'q1', expectedOn: null, status: 'confirmado', notes: null, ...p });
const exp = (p: Partial<Expense>): Expense => ({ id: crypto.randomUUID(), name: 'x', category: 'otros', amount: 0, amountMin: null, amountMax: null, isVariable: false, isEstimate: false, dueDay: null, active: true, ...p });
const debt = (p: Partial<Debt>): Debt => ({
  id: crypto.randomUUID(), creditor: 'Banco', debtType: 'financiera', initialBalance: 0, updatedBalance: null, balanceUpdatedOn: null,
  isEstimate: true, dueDate: null, daysPastDue: 0, daysPastDueOn: null, interestRateEa: null, minimumPayment: null,
  negotiatedPayment: null, status: 'pendiente', nextPaymentDate: null, objective: null, notes: null, ...p,
});
const tx = (kind: Transaction['kind'], amount: number, occurredOn = '2026-11-05'): Transaction => ({ id: crypto.randomUUID(), kind, amount, occurredOn, category: 'otros', description: null, refTable: null, refId: null });

describe('money', () => {
  it('formatea COP con separador de miles', () => {
    expect(formatCOP(3340000)).toBe('$3.340.000');
    expect(formatCOP(0)).toBe('$0');
    expect(formatCOP(-5000)).toBe('-$5.000');
    expect(formatCOP(999)).toBe('$999');
  });
  it('interpreta texto del usuario', () => {
    expect(parseCOP('$1.700.000')).toBe(1700000);
    expect(parseCOP('1700000,50')).toBe(1700000);
    expect(parseCOP('')).toBe(0);
    expect(groupInput('0001640000')).toBe('1.640.000');
  });
  it('porcentajes exactos', () => {
    expect(percent(1000000, 3000000)).toBe(33.33);
    expect(formatPct(33.33)).toBe('33,33 %');
    expect(formatPct(50)).toBe('50 %');
    expect(percent(1, 0)).toBe(0);
  });
  it('reparto por porcentaje suma exacto', () => {
    const r = splitByPercent(1000001, { a: 33, b: 33, c: 34 });
    expect(r.parts.a + r.parts.b + r.parts.c + r.unassigned).toBe(1000001);
  });
});

describe('fechas', () => {
  it('suma meses sin desbordar', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(monthsBetween('2026-11-05', '2027-11-05')).toBe(12);
    expect(monthsBetween('2026-11-05', '2027-11-04')).toBe(11);
    expect(monthsBetween('2027-01-01', '2026-01-01')).toBe(0);
  });
});

describe('presupuesto', () => {
  const income = [
    inc({ schedule: 'q1', amount: 1700000 }),
    inc({ schedule: 'q2', amount: 1640000 }),
    inc({ schedule: 'extraordinario', amount: 1750000, status: 'estimado' }),
  ];
  it('el ingreso mensual excluye la prima estimada', () => {
    expect(monthlyIncome(income).total).toBe(3340000);
    expect(halfIncome(income, 1)).toBe(1700000);
    expect(halfIncome(income, 2)).toBe(1640000);
    expect(pendingExtraordinary(income)).toHaveLength(1);
  });
  it('gastos variables con rango', () => {
    const e = [exp({ amount: 636000 }), exp({ amount: 100000, amountMin: 90000, amountMax: 115000, isVariable: true }), exp({ amount: 50000, active: false })];
    expect(monthlyExpenses(e)).toEqual({ base: 736000, min: 726000, max: 751000 });
  });
  it('saldo del libro', () => {
    const t = [tx('ingreso', 1700000), tx('gasto', 636000), tx('abono_deuda', 200000), tx('ahorro', 100000), tx('retiro_ahorro', 50000)];
    expect(ledgerBalance(t)).toBe(814000);
    expect(monthsWithinBudget(t)).toBe(1);
  });
});

describe('distribución quincenal', () => {
  const expenses = [exp({ amount: 636000, dueDay: 5 }), exp({ amount: 130000, dueDay: 20 }), exp({ amount: 101, dueDay: null })];
  const debts = [debt({ minimumPayment: 200000, nextPaymentDate: '2026-11-10' }), debt({ negotiatedPayment: 300000, minimumPayment: 100000, nextPaymentDate: '2026-11-25' }), debt({ minimumPayment: 999, nextPaymentDate: '2026-11-12', status: 'pagada' })];
  it('compromisos por quincena', () => {
    expect(committedForHalf(expenses, debts, '2026-11-01', 1)).toEqual({ obligatorios: 636051, deudas: 200000, total: 836051 });
    expect(committedForHalf(expenses, debts, '2026-11-01', 2)).toEqual({ obligatorios: 130050, deudas: 300000, total: 430050 });
  });
  it('detecta cuando lo asignado supera lo recibido', () => {
    const s = summarizeDistribution(1700000, [{ bucket: 'obligatorios', amount: 1000000 }, { bucket: 'personales', amount: 800000 }], 1200000);
    expect(s.overBudget).toBe(true);
    expect(s.overBy).toBe(100000);
    expect(s.uncovered).toBe(200000);
  });
  it('la sugerencia suma exactamente lo recibido', () => {
    const s = suggestDistribution(1700000, { obligatorios: 836051, deudas: 200000 });
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(1700000);
    expect(s.obligatorios).toBe(836051);
    expect(s.deudas).toBeGreaterThanOrEqual(200000);
  });
  it('si no alcanza, cubre obligatorios primero', () => {
    const s = suggestDistribution(500000, { obligatorios: 800000, deudas: 200000 });
    expect(s).toEqual({ obligatorios: 500000, deudas: 0, personales: 0, emergencia: 0, moto: 0 });
  });
  it('próximos vencimientos', () => {
    const items = upcomingDue(expenses, debts, '2026-11-05', 30);
    expect(items.map((i) => i.date)).toEqual(['2026-11-05', '2026-11-10', '2026-11-20', '2026-11-25', '2026-12-05']);
  });
});

describe('deudas', () => {
  const d = debt({ id: 'd1', initialBalance: 3000000 });
  const pay = (amount: number, paidOn: string): DebtPayment => ({ id: crypto.randomUUID(), debtId: 'd1', amount, paidOn, note: null, receiptPath: null });
  it('saldo = inicial − abonos', () => {
    expect(debtSummary(d, [pay(500000, '2026-11-01')]).balance).toBe(2500000);
  });
  it('saldo actualizado solo descuenta abonos desde su fecha', () => {
    const u = { ...d, updatedBalance: 2800000, balanceUpdatedOn: '2026-11-03' };
    expect(debtSummary(u, [pay(200000, '2026-11-01'), pay(300000, '2026-11-03')]).balance).toBe(2500000);
  });
  it('las simulaciones no cambian el saldo; un acuerdo real aceptado sí', () => {
    const neg = (kind: DebtNegotiation['kind'], status: DebtNegotiation['status']): DebtNegotiation => ({
      id: crypto.randomUUID(), debtId: 'd1', originalBalance: 3000000, offerAmount: 2000000, deadline: null, kind, status, documentPath: null, notes: null, createdAt: '2026-11-04T10:00:00Z',
    });
    expect(debtSummary(d, [], [neg('simulacion', 'abierta')]).balance).toBe(3000000);
    const s = debtSummary(d, [pay(2000000, '2026-11-05')], [neg('oferta_real', 'aceptada')]);
    expect(s.balance).toBe(0);
    expect(canMarkPaid(s).ok).toBe(true);
  });
  it('no permite marcar pagada sin pagos registrados', () => {
    const s = debtSummary({ ...d, initialBalance: 0 }, []);
    expect(canMarkPaid(s).ok).toBe(false);
    expect(canMarkPazYSalvo(d, s).ok).toBe(false);
  });
  it('días de mora avanzan solo si sigue en mora', () => {
    const m = debt({ status: 'en_mora', daysPastDue: 106, daysPastDueOn: '2026-11-01' });
    expect(currentDaysPastDue(m, '2026-11-05')).toBe(110);
    expect(currentDaysPastDue({ ...m, status: 'en_negociacion' }, '2026-11-05')).toBe(106);
  });
  it('negociador: descuento y faltante', () => {
    const a = analyzeOffer({ original: 3000000, offer: 2000000, available: 1200000, monthlySurplus: 400000, deadline: '2027-01-10', today: '2026-11-05' });
    expect(a.discount).toBe(1000000);
    expect(a.discountPct).toBe(33.33);
    expect(a.missing).toBe(800000);
    expect(a.monthsToCover).toBe(2);
    expect(a.reachableByDeadline).toBe(true);
    const b = analyzeOffer({ original: 3000000, offer: 2000000, available: 0, monthlySurplus: 0, today: '2026-11-05' });
    expect(b.monthsToCover).toBeNull();
  });
});

describe('compras', () => {
  const base = { available: 1000000, personalLeft: 200000, upcomingDebt: 300000, upcomingObligations: 400000, plannedSaving: 100000 };
  it('un gusto dentro del presupuesto se aprueba', () => {
    expect(evaluatePurchase(100000, 'gusto', base).verdict).toBe('adelante');
  });
  it('si afecta deudas, no ahora', () => {
    const e = evaluatePurchase(500000, 'gusto', base);
    expect(e.affectsDebt).toBe(true);
    expect(e.verdict).toBe('no_ahora');
  });
  it('regla de 48 h solo para gustos', () => {
    expect(waitUntilFor(0, 48, 'gusto', true)).toBe(new Date(48 * 3600000).toISOString());
    expect(waitUntilFor(0, 48, 'necesidad', true)).toBeNull();
    expect(waitUntilFor(0, 48, 'gusto', false)).toBeNull();
    expect(formatCountdown(3661000)).toBe('01:01:01');
  });
  it('dinero evitado', () => {
    const p = (price: number, status: 'cancelada' | 'comprada') => ({ price, status }) as never;
    expect(avoidedTotal([p(100, 'cancelada'), p(50, 'comprada'), p(25, 'cancelada')])).toBe(125);
  });
});

describe('metas', () => {
  const goal: SavingsGoal = { id: 'g', name: 'Moto', kind: 'moto', targetAmount: 12000000, targetDate: '2027-11-05', initialSaved: 1000000, monthlyContribution: 500000, details: {}, achievedOn: null };
  it('progreso y ahorro necesario', () => {
    const saved = goalSaved(goal, [{ id: 'c', goalId: 'g', amount: 1000000, contributedOn: '2026-11-01', note: null }]);
    expect(saved).toBe(2000000);
    const p = goalProgress({ target: 12000000, saved, targetDate: '2027-11-05', monthlyContribution: 500000, today: '2026-11-05' });
    expect(p.pct).toBe(16.67);
    expect(p.remaining).toBe(10000000);
    expect(p.monthsLeft).toBe(12);
    expect(p.requiredMonthly).toBe(833334);
    expect(p.etaDate).toBe('2028-07-05');
    expect(p.onTrack).toBe(false);
  });
  it('meta sin aporte no tiene fecha estimada', () => {
    expect(goalProgress({ target: 100, saved: 0, targetDate: null, monthlyContribution: 0, today: '2026-11-05' }).etaDate).toBeNull();
  });
  it('costos de la moto y financiación', () => {
    const d = { price: 10000000, matricula: 500000, soat: 400000, proteccion: 300000, impuestos: 0, downPayment: 2000000 };
    expect(motoCashTotal(d)).toBe(11200000);
    expect(loanPayment(1200000, 0, 12)).toBe(100000);
    const c = compareFinancing({ details: d, rateEA: null, months: 24, monthlySurplus: 800000, hasDebtsInArrears: true });
    expect(c.affordability).toBe('sin_datos');
    expect(c.warnings.length).toBe(2);
    const c2 = compareFinancing({ details: d, rateEA: 30, months: 24, monthlySurplus: 300000, hasDebtsInArrears: false });
    expect(c2.affordability).toBe('no_viable');
    expect(c2.financed.interestCost).toBeGreaterThan(0);
  });
});

describe('simulador', () => {
  const debts = [
    { id: 'a', name: 'Banco', balance: 3000000, rateEA: null, estimate: true },
    { id: 'b', name: 'Addi', balance: 900000, rateEA: null, estimate: true },
  ];
  it('500k mensuales sin intereses conocidos', () => {
    const r = simulatePayoff(debts, { name: '500k', monthlyPayment: 500000 });
    expect(r.months).toBe(8);
    expect(r.totalPaid).toBe(3900000);
    expect(r.order[0]).toBe('Addi');
    expect(r.interestUnknown).toBe(true);
  });
  it('700k + prima termina antes', () => {
    const r = simulatePayoff(debts, { name: 'prima', monthlyPayment: 700000, lumpSum: 1750000, lumpMonth: 1 });
    expect(r.months).toBe(4);
  });
  it('descuento reduce el total', () => {
    const r = simulatePayoff(debts, { name: 'desc', monthlyPayment: 500000, discount: { debtId: 'a', pct: 33.33 } });
    expect(r.savedByDiscount).toBe(999900);
    expect(r.totalPaid).toBe(2900100);
  });
  it('detecta cuando el pago no cubre los intereses', () => {
    const r = simulatePayoff([{ id: 'x', name: 'X', balance: 10000000, rateEA: 40, estimate: false }], { name: 'bajo', monthlyPayment: 100000 });
    expect(r.months).toBeNull();
  });
});

describe('freelance', () => {
  const p: FreelanceProject = { id: 'p', client: 'C', project: 'Web', category: 'desarrollo_web', contractValue: 2000000, advance: 1000000, receivedTotal: 1000000, costs: 150000, deliveryDate: null, status: 'activo', pctDebt: 50, pctSaving: 30, pctPersonal: 20 };
  it('saldo pendiente, neto y reparto', () => {
    const s = freelanceSummary(p);
    expect(s.pending).toBe(1000000);
    expect(s.netEstimated).toBe(1850000);
    expect(s.allocation).toEqual({ deudas: 925000, ahorro: 555000, personal: 370000 });
    expect(splitPayment(333333, p).unassigned + Object.values(splitPayment(333333, p).parts).reduce((a, b) => a + b, 0)).toBe(333333);
  });
});
