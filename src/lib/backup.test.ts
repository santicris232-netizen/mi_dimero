import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup, transactionsCSV } from './backup';
import { emptyDataset } from '../types';

describe('copias de seguridad', () => {
  it('ida y vuelta con IDs nuevos y referencias remapeadas', () => {
    const data = emptyDataset();
    data.debts.push({ id: 'd1', creditor: 'Banco', debtType: 'financiera', initialBalance: 100, updatedBalance: null, balanceUpdatedOn: null, isEstimate: true, dueDate: null, daysPastDue: 0, daysPastDueOn: null, interestRateEa: null, minimumPayment: null, negotiatedPayment: null, status: 'pendiente', nextPaymentDate: null, objective: null, notes: null, userId: 'u1' });
    data.debtPayments.push({ id: 'p1', debtId: 'd1', amount: 50, paidOn: '2026-11-05', note: null, receiptPath: null });
    data.debtPayments.push({ id: 'p2', debtId: 'huerfano', amount: 50, paidOn: '2026-11-05', note: null, receiptPath: null });
    data.transactions.push({ id: 't1', kind: 'abono_deuda', amount: 50, occurredOn: '2026-11-05', category: 'deudas', description: null, refTable: 'debt_payments', refId: 'p1' });
    const json = JSON.parse(JSON.stringify(makeBackup(data, { displayName: 'Ana', waitRuleHours: 48 })));
    const { data: out, profile } = parseBackup(json);
    expect(profile?.displayName).toBe('Ana');
    expect(out.debts[0].id).not.toBe('d1');
    expect((out.debts[0] as { userId?: string }).userId).toBeUndefined();
    expect(out.debtPayments).toHaveLength(1);
    expect(out.debtPayments[0].debtId).toBe(out.debts[0].id);
    expect(out.transactions[0].refId).toBe(out.debtPayments[0].id);
  });
  it('rechaza archivos ajenos', () => {
    expect(() => parseBackup({ hola: 1 })).toThrow();
  });
  it('CSV neutraliza fórmulas', () => {
    const csv = transactionsCSV([{ id: 'x', kind: 'gasto', amount: 1000, occurredOn: '2026-11-05', category: 'otros', description: '=HYPERLINK("x")', refTable: null, refId: null }], (s) => s);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('$1.000');
  });
});
