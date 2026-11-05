// Fase 4: "¿Realmente lo necesito?"
import type { PurchaseDecision } from '../../types';
import { sum } from '../money';

export interface PurchaseContext {
  available: number; // dinero disponible real
  personalLeft: number | null; // lo que queda del presupuesto personal de la quincena (si hay distribución)
  upcomingDebt: number; // cuotas de deuda próximas (15 días)
  upcomingObligations: number; // gastos obligatorios próximos (15 días)
  plannedSaving: number; // ahorro planeado en la quincena aún no ejecutado
}

export interface PurchaseEvaluation {
  inBudget: boolean;
  affectsDebt: boolean;
  affectsSaving: boolean;
  verdict: 'adelante' | 'con_cuidado' | 'no_ahora';
  messages: string[];
}

/**
 * Evalúa una compra. Un gasto personal no es "malo" por sí mismo:
 * si cabe en el presupuesto y no compromete deudas ni ahorro, se aprueba.
 */
export function evaluatePurchase(price: number, nature: 'necesidad' | 'gusto', ctx: PurchaseContext): PurchaseEvaluation {
  const afterPurchase = ctx.available - price;
  const inBudget = ctx.personalLeft != null ? price <= ctx.personalLeft : afterPurchase >= ctx.upcomingObligations + ctx.upcomingDebt;
  const affectsDebt = afterPurchase < ctx.upcomingObligations + ctx.upcomingDebt && ctx.upcomingDebt > 0;
  const affectsSaving = afterPurchase < ctx.upcomingObligations + ctx.upcomingDebt + ctx.plannedSaving && ctx.plannedSaving > 0;
  const messages: string[] = [];
  if (inBudget) messages.push('Cabe dentro de tu presupuesto.');
  else messages.push('Supera lo que tienes disponible para gastos personales.');
  if (affectsDebt) messages.push('Podría dejarte sin dinero para tus próximos pagos de deuda.');
  if (affectsSaving) messages.push('Reduciría el ahorro que planeaste para esta quincena.');
  if (afterPurchase < 0) messages.push('No tienes dinero disponible suficiente hoy.');

  let verdict: PurchaseEvaluation['verdict'] = 'adelante';
  if (afterPurchase < 0 || affectsDebt) verdict = 'no_ahora';
  else if (!inBudget || affectsSaving) verdict = nature === 'necesidad' ? 'con_cuidado' : 'no_ahora';
  if (verdict === 'adelante')
    messages.push(
      nature === 'gusto'
        ? 'Darte un gusto planeado también es parte de un presupuesto sano.'
        : 'Es una necesidad y tus números la soportan.',
    );
  return { inBudget, affectsDebt, affectsSaving, verdict, messages };
}

/** Regla de espera: solo aplica a compras no esenciales y si el usuario la activa. */
export function waitUntilFor(nowMs: number, hours: number, nature: 'necesidad' | 'gusto', enabled: boolean): string | null {
  if (!enabled || nature === 'necesidad' || hours <= 0) return null;
  return new Date(nowMs + hours * 3_600_000).toISOString();
}

export function remainingMs(waitUntil: string | null, nowMs: number): number {
  if (!waitUntil) return 0;
  return Math.max(0, new Date(waitUntil).getTime() - nowMs);
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Dinero que se evitó gastar = suma de compras canceladas. */
export const avoidedTotal = (list: PurchaseDecision[]) => sum(list.filter((p) => p.status === 'cancelada').map((p) => p.price));
