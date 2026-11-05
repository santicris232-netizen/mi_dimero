import { z } from 'zod';
import { emptyDataset, type CollectionKey, type Dataset, type Transaction } from '../types';
import { formatCOP } from './money';

export const BACKUP_APP = 'mi-control-financiero';
export const BACKUP_VERSION = 1;

const row = z.object({ id: z.string().min(1).max(64) }).passthrough();
const keys = Object.keys(emptyDataset()) as CollectionKey[];
const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: z.string(),
  profile: z.object({ displayName: z.string().max(60).optional(), waitRuleHours: z.number().int().min(0).max(720).optional() }).passthrough().optional(),
  data: z.object(Object.fromEntries(keys.map((k) => [k, z.array(row).max(50_000).default([])])) as Record<CollectionKey, z.ZodDefault<z.ZodArray<typeof row>>>),
});

export function makeBackup(data: Dataset, profile: { displayName: string; waitRuleHours: number }) {
  const strip = <T extends object>(r: T) => {
    const { userId: _u, ...rest } = r as T & { userId?: string };
    return rest;
  };
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    data: Object.fromEntries(keys.map((k) => [k, (data[k] as object[]).map(strip)])),
  };
}

const FK_FIELDS = ['debtId', 'goalId', 'budgetId', 'refId'] as const;

/**
 * Valida una copia de seguridad y asigna IDs nuevos (remapeando las referencias),
 * para que se pueda importar en cualquier cuenta sin choques de identificadores.
 */
export function parseBackup(json: unknown): { data: Dataset; profile?: { displayName?: string; waitRuleHours?: number } } {
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) throw new Error('El archivo no es una copia de seguridad válida de Mi Control Financiero.');
  const map = new Map<string, string>();
  for (const k of keys) for (const r of parsed.data.data[k]) map.set(r.id, crypto.randomUUID());
  const out = emptyDataset();
  for (const k of keys) {
    (out[k] as object[]) = parsed.data.data[k].map((r) => {
      const next: Record<string, unknown> = { ...r, id: map.get(r.id)! };
      delete next.userId;
      for (const f of FK_FIELDS) if (typeof next[f] === 'string') next[f] = map.get(next[f] as string) ?? null;
      return next;
    });
  }
  // Integridad: hijos sin padre se descartan.
  const ids = (k: CollectionKey) => new Set((out[k] as { id: string }[]).map((r) => r.id));
  const debts = ids('debts');
  const goals = ids('savingsGoals');
  const budgets = ids('budgets');
  out.debtPayments = out.debtPayments.filter((p) => debts.has(p.debtId));
  out.debtNegotiations = out.debtNegotiations.filter((n) => debts.has(n.debtId));
  out.savingsContributions = out.savingsContributions.filter((c) => goals.has(c.goalId));
  out.budgetAllocations = out.budgetAllocations.filter((a) => budgets.has(a.budgetId));
  const p = parsed.data.profile;
  return { data: out, profile: p ? { displayName: p.displayName, waitRuleHours: p.waitRuleHours } : undefined };
}

const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  // Evita inyección de fórmulas al abrir el CSV en Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function transactionsCSV(tx: Transaction[], label: (slug: string) => string): string {
  const head = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Monto (COP)'];
  const rows = [...tx]
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
    .map((t) => [t.occurredOn, t.kind, label(t.category), t.description ?? '', t.amount, formatCOP(t.amount)]);
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
