// Fase 5: metas de ahorro y moto.
import type { ISODate, MotoDetails, SavingsContribution, SavingsGoal } from '../../types';
import { addMonths, monthsBetween } from '../dates';
import { percent, sum } from '../money';

export function goalSaved(goal: SavingsGoal, contributions: SavingsContribution[]): number {
  return goal.initialSaved + sum(contributions.filter((c) => c.goalId === goal.id).map((c) => c.amount));
}

export interface GoalProgress {
  target: number;
  saved: number;
  pct: number;
  remaining: number;
  monthsLeft: number | null;
  requiredMonthly: number | null;
  etaDate: ISODate | null;
  onTrack: boolean | null;
}

export function goalProgress(input: {
  target: number;
  saved: number;
  targetDate: ISODate | null;
  monthlyContribution: number;
  today: ISODate;
}): GoalProgress {
  const { target, saved, targetDate, monthlyContribution, today } = input;
  const remaining = Math.max(0, target - saved);
  const monthsLeft = targetDate ? monthsBetween(today, targetDate) : null;
  let requiredMonthly: number | null = null;
  if (monthsLeft != null) requiredMonthly = remaining === 0 ? 0 : Math.ceil(remaining / Math.max(1, monthsLeft));
  const etaDate =
    remaining === 0 ? today : monthlyContribution > 0 ? addMonths(today, Math.ceil(remaining / monthlyContribution)) : null;
  const onTrack =
    remaining === 0 ? true : requiredMonthly == null ? null : monthlyContribution >= requiredMonthly && monthlyContribution > 0;
  return {
    target,
    saved,
    pct: target > 0 ? Math.min(100, percent(saved, target)) : 0,
    remaining,
    monthsLeft,
    requiredMonthly,
    etaDate,
    onTrack,
  };
}

/** Costos únicos al comprar la moto (además del precio). */
export function motoOneTimeCosts(d: MotoDetails): number {
  return (d.matricula ?? 0) + (d.soat ?? 0) + (d.proteccion ?? 0) + (d.impuestos ?? 0);
}
export const motoMonthlyCosts = (d: MotoDetails) => (d.mantenimientoMensual ?? 0) + (d.combustibleMensual ?? 0);
/** Total para comprar de contado: precio + costos únicos. */
export const motoCashTotal = (d: MotoDetails) => (d.price ?? 0) + motoOneTimeCosts(d);

/** Cuota fija mensual (sistema francés) a partir de una tasa efectiva anual ingresada por el usuario. */
export function loanPayment(principal: number, rateEA: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = Math.pow(1 + rateEA / 100, 1 / 12) - 1;
  if (r === 0) return Math.ceil(principal / months);
  return Math.ceil((principal * r) / (1 - Math.pow(1 + r, -months)));
}

export interface FinancingComparison {
  cashTotal: number;
  financed: {
    downPayment: number;
    principal: number;
    monthlyPayment: number;
    months: number;
    totalPaid: number;
    interestCost: number;
    savingNeededNow: number; // cuota inicial + costos únicos
  };
  affordability: 'viable' | 'ajustado' | 'no_viable' | 'sin_datos';
  warnings: string[];
}

/**
 * Compara contado vs financiación. No recomienda endeudarse:
 * evalúa la cuota frente al excedente mensual y advierte si hay deudas en mora.
 */
export function compareFinancing(input: {
  details: MotoDetails;
  rateEA: number | null;
  months: number;
  monthlySurplus: number;
  hasDebtsInArrears: boolean;
}): FinancingComparison {
  const { details, rateEA, months, monthlySurplus, hasDebtsInArrears } = input;
  const price = details.price ?? 0;
  const downPayment = Math.min(price, details.downPayment ?? 0);
  const principal = price - downPayment;
  const monthlyPayment = rateEA == null ? 0 : loanPayment(principal, rateEA, months);
  const totalPaid = downPayment + monthlyPayment * months;
  const warnings: string[] = [];
  let affordability: FinancingComparison['affordability'] = 'sin_datos';
  if (rateEA == null || months <= 0 || price <= 0) {
    warnings.push('Ingresa la tasa efectiva anual real que te ofrezcan y el plazo. No se asume ninguna tasa.');
  } else {
    const totalMonthly = monthlyPayment + motoMonthlyCosts(details);
    if (monthlySurplus <= 0 || totalMonthly > monthlySurplus) affordability = 'no_viable';
    else if (totalMonthly > monthlySurplus * 0.5) affordability = 'ajustado';
    else affordability = 'viable';
    if (affordability === 'no_viable') warnings.push('La cuota más los costos mensuales superan tu excedente mensual actual.');
    if (affordability === 'ajustado') warnings.push('La cuota consumiría más de la mitad de tu excedente mensual.');
  }
  if (hasDebtsInArrears) warnings.push('Tienes deudas en mora: no es recomendable adquirir un crédito nuevo hasta normalizarlas.');
  return {
    cashTotal: motoCashTotal(details),
    financed: {
      downPayment,
      principal,
      monthlyPayment,
      months,
      totalPaid: rateEA == null ? 0 : totalPaid + motoOneTimeCosts(details),
      interestCost: rateEA == null ? 0 : Math.max(0, totalPaid - price),
      savingNeededNow: downPayment + motoOneTimeCosts(details),
    },
    affordability,
    warnings,
  };
}
