// Fase 6: ingresos freelance.
import type { FreelanceProject } from '../../types';
import { splitByPercent, sum } from '../money';

export function freelanceSummary(p: FreelanceProject) {
  const pending = Math.max(0, p.contractValue - p.receivedTotal);
  const netEstimated = p.contractValue - p.costs;
  const { parts, unassigned } = splitByPercent(Math.max(0, netEstimated), {
    deudas: p.pctDebt,
    ahorro: p.pctSaving,
    personal: p.pctPersonal,
  });
  return { pending, netEstimated, allocation: parts, unassigned };
}

/** Reparte un pago recibido según los porcentajes del proyecto (suma exacta). */
export function splitPayment(amount: number, p: Pick<FreelanceProject, 'pctDebt' | 'pctSaving' | 'pctPersonal'>) {
  return splitByPercent(amount, { deudas: p.pctDebt, ahorro: p.pctSaving, personal: p.pctPersonal });
}

export function freelanceTotals(projects: FreelanceProject[]) {
  const active = projects.filter((p) => p.status !== 'cancelado');
  return {
    contracted: sum(active.map((p) => p.contractValue)),
    received: sum(active.map((p) => p.receivedTotal)),
    pending: sum(active.map((p) => Math.max(0, p.contractValue - p.receivedTotal))),
    net: sum(active.map((p) => p.contractValue - p.costs)),
  };
}
