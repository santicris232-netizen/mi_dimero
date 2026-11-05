// Fase 3: saldos de deuda, mora y negociación.
import type { Debt, DebtNegotiation, DebtPayment, ISODate } from '../../types';
import { diffDays } from '../dates';
import { percent, sum } from '../money';

export interface DebtSummary {
  base: number; // saldo de referencia (actualizado, o el acordado si hay acuerdo aceptado)
  baseDate: ISODate | null;
  paidSinceBase: number;
  paidTotal: number;
  balance: number;
  agreement: DebtNegotiation | null;
  progressPct: number;
}

/**
 * Saldo actual = saldo de referencia − abonos registrados desde la fecha de referencia (incluida).
 * - Referencia: saldo actualizado (si existe, con su fecha) o saldo inicial (cuenta todos los abonos).
 * - Si hay una oferta REAL aceptada, la referencia pasa a ser el monto acordado desde su fecha.
 * Las simulaciones nunca cambian el saldo.
 */
export function debtSummary(debt: Debt, payments: DebtPayment[], negotiations: DebtNegotiation[] = []): DebtSummary {
  const own = payments.filter((p) => p.debtId === debt.id);
  const agreement =
    negotiations
      .filter((n) => n.debtId === debt.id && n.kind === 'oferta_real' && n.status === 'aceptada')
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0] ?? null;

  let base = debt.updatedBalance ?? debt.initialBalance;
  let baseDate: ISODate | null = debt.updatedBalance != null ? debt.balanceUpdatedOn : null;
  if (agreement) {
    base = agreement.offerAmount;
    baseDate = (agreement.createdAt ?? '').slice(0, 10) || baseDate;
  }
  const counted = baseDate ? own.filter((p) => p.paidOn >= baseDate!) : own;
  const paidSinceBase = sum(counted.map((p) => p.amount));
  return {
    base,
    baseDate,
    paidSinceBase,
    paidTotal: sum(own.map((p) => p.amount)),
    balance: Math.max(0, base - paidSinceBase),
    agreement,
    progressPct: base > 0 ? Math.min(100, percent(paidSinceBase, base)) : 0,
  };
}

/** Días de mora a hoy: los registrados + días transcurridos desde el registro (solo si sigue en mora). */
export function currentDaysPastDue(debt: Debt, on: ISODate): number {
  if (debt.status !== 'en_mora' || !debt.daysPastDueOn) return debt.daysPastDue;
  return debt.daysPastDue + Math.max(0, diffDays(debt.daysPastDueOn, on));
}

/** Una deuda solo puede marcarse pagada si hay abonos registrados que dejan el saldo en 0. */
export function canMarkPaid(summary: DebtSummary): { ok: boolean; reason?: string } {
  if (summary.paidTotal <= 0) return { ok: false, reason: 'Registra primero el pago (idealmente con su comprobante).' };
  if (summary.balance > 0) return { ok: false, reason: 'Aún queda saldo por cubrir según tus registros.' };
  return { ok: true };
}

export function canMarkPazYSalvo(debt: Debt, summary: DebtSummary): { ok: boolean; reason?: string } {
  const paid = canMarkPaid(summary);
  if (!paid.ok) return paid;
  if (debt.status !== 'pagada') return { ok: false, reason: 'Primero marca la deuda como pagada.' };
  return { ok: true };
}

export const isActiveDebt = (d: Debt) => d.status !== 'pagada' && d.status !== 'paz_y_salvo';

export interface OfferAnalysis {
  original: number;
  offer: number;
  discount: number;
  discountPct: number;
  available: number;
  missing: number;
  coveredNow: boolean;
  leftAfter: number;
  monthsToCover: number | null; // con el excedente mensual actual; null = no alcanza nunca
  daysToDeadline: number | null;
  reachableByDeadline: boolean | null;
}

/** Analiza una oferta de liquidación. Es un cálculo, NO una oferta del acreedor. */
export function analyzeOffer(input: {
  original: number;
  offer: number;
  available: number;
  monthlySurplus: number;
  deadline?: ISODate | null;
  today: ISODate;
}): OfferAnalysis {
  const { original, offer, available, monthlySurplus, deadline, today } = input;
  const discount = Math.max(0, original - offer);
  const missing = Math.max(0, offer - Math.max(0, available));
  const monthsToCover = missing === 0 ? 0 : monthlySurplus > 0 ? Math.ceil(missing / monthlySurplus) : null;
  const daysToDeadline = deadline ? diffDays(today, deadline) : null;
  let reachableByDeadline: boolean | null = null;
  if (daysToDeadline != null) {
    if (daysToDeadline < 0) reachableByDeadline = false;
    else if (missing === 0) reachableByDeadline = true;
    else reachableByDeadline = monthsToCover != null && monthsToCover * 30 <= daysToDeadline;
  }
  return {
    original,
    offer,
    discount,
    discountPct: percent(discount, original),
    available,
    missing,
    coveredNow: missing === 0,
    leftAfter: available - offer,
    monthsToCover,
    daysToDeadline,
    reachableByDeadline,
  };
}
