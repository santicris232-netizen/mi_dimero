import { create } from 'zustand';
import { CloudRepo, LocalRepo, type Repo } from '../data/repo';
import { isCloud } from '../lib/supabase';
import { today } from '../lib/dates';
import { toast } from './ui';
import type { AuthUser } from './auth';
import {
  emptyDataset,
  type CollectionKey,
  type Dataset,
  type DebtPayment,
  type Profile,
  type SavingsContribution,
  type Transaction,
} from '../types';

type RowOf<K extends CollectionKey> = Dataset[K][number];
type NewRow<K extends CollectionKey> = Omit<RowOf<K>, 'id'> & { id?: string };

interface DataState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  repo: Repo | null;
  profile: Profile | null;
  data: Dataset;
  unsubscribe: (() => void) | null;

  start(user: AuthUser): Promise<void>;
  stop(): void;
  reload(): Promise<void>;
  saveProfile(patch: Partial<Profile>): Promise<void>;

  add<K extends CollectionKey>(key: K, row: NewRow<K>): Promise<RowOf<K>>;
  patch<K extends CollectionKey>(key: K, id: string, patch: Partial<RowOf<K>>): Promise<void>;
  remove(key: CollectionKey, id: string): Promise<void>;
  replaceAll(data: Dataset, profile?: Partial<Profile>): Promise<void>;

  // Acciones de dominio (mantienen el libro de movimientos consistente)
  addTransaction(t: NewRow<'transactions'>): Promise<Transaction>;
  addDebtPayment(p: { debtId: string; amount: number; paidOn: string; note?: string | null; file?: File | null }): Promise<DebtPayment>;
  removeDebtPayment(id: string): Promise<void>;
  addContribution(c: { goalId: string; amount: number; contributedOn?: string; note?: string | null }): Promise<SavingsContribution>;
  removeContribution(id: string): Promise<void>;
  uploadFile(file: File): Promise<string>;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Error inesperado');

export const useData = create<DataState>((set, get) => ({
  status: 'idle',
  error: null,
  repo: null,
  profile: null,
  data: emptyDataset(),
  unsubscribe: null,

  async start(user) {
    get().stop();
    const repo: Repo = isCloud ? new CloudRepo(user.id) : new LocalRepo(user.id, user.name);
    set({ repo, status: 'loading', error: null });
    try {
      const { profile, data } = await repo.loadAll();
      if (!profile.displayName && user.name) {
        profile.displayName = user.name;
        await repo.saveProfile({ displayName: user.name });
      }
      set({ profile, data, status: 'ready' });
      set({ unsubscribe: repo.subscribe(() => void get().reload()) });
    } catch (e) {
      set({ status: 'error', error: errMsg(e) });
    }
  },

  stop() {
    get().unsubscribe?.();
    // Al cerrar sesión se borra todo de memoria.
    set({ repo: null, profile: null, data: emptyDataset(), status: 'idle', unsubscribe: null, error: null });
  },

  async reload() {
    const repo = get().repo;
    if (!repo) return;
    try {
      const { profile, data } = await repo.loadAll();
      set({ profile, data });
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  },

  async saveProfile(patch) {
    const { repo, profile } = get();
    if (!repo || !profile) return;
    set({ profile: { ...profile, ...patch } });
    try {
      await repo.saveProfile(patch);
    } catch (e) {
      set({ profile });
      toast(errMsg(e), 'error');
      throw e;
    }
  },

  async add(key, row) {
    const { repo, data } = get();
    if (!repo) throw new Error('Sesión no iniciada');
    const now = new Date().toISOString();
    const full = { ...row, id: row.id ?? crypto.randomUUID(), createdAt: now, updatedAt: now } as unknown as RowOf<typeof key>;
    set({ data: { ...data, [key]: [...data[key], full] } });
    try {
      await repo.insert(key, full as { id: string });
      return full;
    } catch (e) {
      set((s) => ({ data: { ...s.data, [key]: (s.data[key] as { id: string }[]).filter((r) => r.id !== (full as { id: string }).id) } }));
      toast(errMsg(e), 'error');
      throw e;
    }
  },

  async patch(key, id, patch) {
    const { repo, data } = get();
    if (!repo) return;
    const before = data[key];
    set({ data: { ...data, [key]: (before as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) } });
    try {
      await repo.update(key, id, patch);
    } catch (e) {
      set((s) => ({ data: { ...s.data, [key]: before } }));
      toast(errMsg(e), 'error');
      throw e;
    }
  },

  async remove(key, id) {
    const { repo, data } = get();
    if (!repo) return;
    const before = data;
    const next = { ...data, [key]: (data[key] as { id: string }[]).filter((r) => r.id !== id) } as Dataset;
    if (key === 'debts') {
      next.debtPayments = next.debtPayments.filter((p) => p.debtId !== id);
      next.debtNegotiations = next.debtNegotiations.filter((n) => n.debtId !== id);
    }
    if (key === 'savingsGoals') next.savingsContributions = next.savingsContributions.filter((c) => c.goalId !== id);
    if (key === 'budgets') next.budgetAllocations = next.budgetAllocations.filter((a) => a.budgetId !== id);
    set({ data: next });
    try {
      await repo.remove(key, id);
    } catch (e) {
      set({ data: before });
      toast(errMsg(e), 'error');
      throw e;
    }
  },

  async replaceAll(data, profile) {
    const repo = get().repo;
    if (!repo) return;
    await repo.replaceAll(data, profile);
    await get().reload();
  },

  addTransaction(t) {
    return get().add('transactions', t);
  },

  async addDebtPayment({ debtId, amount, paidOn, note, file }) {
    const receiptPath = file ? await get().uploadFile(file) : null;
    const debt = get().data.debts.find((d) => d.id === debtId);
    const payment = await get().add('debtPayments', { debtId, amount, paidOn, note: note ?? null, receiptPath });
    await get().add('transactions', {
      kind: 'abono_deuda',
      amount,
      occurredOn: paidOn,
      category: 'deudas',
      description: `Abono ${debt?.creditor ?? 'deuda'}`,
      refTable: 'debt_payments',
      refId: payment.id,
    });
    return payment;
  },

  async removeDebtPayment(id) {
    const tx = get().data.transactions.filter((t) => t.refTable === 'debt_payments' && t.refId === id);
    await get().remove('debtPayments', id);
    for (const t of tx) await get().remove('transactions', t.id);
  },

  async addContribution({ goalId, amount, contributedOn = today(), note = null }) {
    const goal = get().data.savingsGoals.find((g) => g.id === goalId);
    const c = await get().add('savingsContributions', { goalId, amount, contributedOn, note });
    await get().add('transactions', {
      kind: amount >= 0 ? 'ahorro' : 'retiro_ahorro',
      amount: Math.abs(amount),
      occurredOn: contributedOn,
      category: 'ahorro',
      description: `${amount >= 0 ? 'Aporte a' : 'Retiro de'} ${goal?.name ?? 'meta'}`,
      refTable: 'savings_contributions',
      refId: c.id,
    });
    return c;
  },

  async removeContribution(id) {
    const tx = get().data.transactions.filter((t) => t.refTable === 'savings_contributions' && t.refId === id);
    await get().remove('savingsContributions', id);
    for (const t of tx) await get().remove('transactions', t.id);
  },

  async uploadFile(file) {
    const repo = get().repo;
    if (!repo) throw new Error('Sesión no iniciada');
    try {
      return await repo.uploadFile(file);
    } catch (e) {
      toast(errMsg(e), 'error');
      throw e;
    }
  },
}));
