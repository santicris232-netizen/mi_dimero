// Repositorio de datos con dos implementaciones intercambiables:
// - CloudRepo: Supabase (PostgreSQL + RLS + Storage + Realtime).
// - LocalRepo: almacenamiento del dispositivo (localStorage + IndexedDB) cuando Supabase no está configurado.
import { supabase } from '../lib/supabase';
import { TABLES, emptyDataset, type CollectionKey, type Dataset, type Profile } from '../types';

export interface Repo {
  readonly kind: 'cloud' | 'local';
  loadAll(): Promise<{ profile: Profile; data: Dataset }>;
  saveProfile(patch: Partial<Profile>): Promise<void>;
  insert(key: CollectionKey, row: { id: string }): Promise<void>;
  update(key: CollectionKey, id: string, patch: object): Promise<void>;
  remove(key: CollectionKey, id: string): Promise<void>;
  /** Reemplaza todos los datos (importar copia de seguridad / reiniciar). */
  replaceAll(data: Dataset, profile?: Partial<Profile>): Promise<void>;
  uploadFile(file: File): Promise<string>;
  fileUrl(path: string): Promise<string>;
  subscribe(onChange: () => void): () => void;
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

export function validateFile(file: File) {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) throw new Error('Formato no permitido. Usa PDF, JPG, PNG o WEBP.');
  if (file.size > MAX_FILE_BYTES) throw new Error('El archivo supera 5 MB.');
}

// ---------- conversión camelCase <-> snake_case (solo nivel superior; jsonb queda intacto) ----------
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const mapKeys = (o: Record<string, unknown>, f: (k: string) => string) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [f(k), v]));
const toRow = (o: object) => mapKeys(o as Record<string, unknown>, snake);
const fromRow = <T,>(o: Record<string, unknown>) => mapKeys(o, camel) as T;

const defaultProfile = (id: string, displayName = ''): Profile => ({
  id,
  displayName,
  currency: 'COP',
  theme: 'system',
  tutorialDone: false,
  onboarded: false,
  waitRuleHours: 48,
});

// =====================================================================
// Supabase
// =====================================================================
export class CloudRepo implements Repo {
  readonly kind = 'cloud' as const;
  constructor(private userId: string) {}

  private get db() {
    if (!supabase) throw new Error('Supabase no está configurado.');
    return supabase;
  }

  async loadAll() {
    const db = this.db;
    const { data: p, error: pe } = await db.from('profiles').select('*').eq('id', this.userId).maybeSingle();
    if (pe) throw pe;
    let profile = p ? fromRow<Profile>(p) : null;
    if (!profile) {
      profile = defaultProfile(this.userId);
      const { error } = await db.from('profiles').insert(toRow(profile));
      if (error) throw error;
    }
    const data = emptyDataset();
    const keys = Object.keys(TABLES) as CollectionKey[];
    const results = await Promise.all(keys.map((k) => db.from(TABLES[k]).select('*').order('created_at', { ascending: true })));
    results.forEach((r, i) => {
      if (r.error) throw r.error;
      (data[keys[i]] as unknown[]) = (r.data ?? []).map((row) => fromRow(row as Record<string, unknown>));
    });
    return { profile, data };
  }

  async saveProfile(patch: Partial<Profile>) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = patch;
    const { error } = await this.db.from('profiles').update(toRow(rest)).eq('id', this.userId);
    if (error) throw error;
  }

  async insert(key: CollectionKey, row: { id: string }) {
    const { createdAt: _c, updatedAt: _u, userId: _uid, ...rest } = row as Record<string, unknown>;
    const { error } = await this.db.from(TABLES[key]).insert({ ...toRow(rest), user_id: this.userId });
    if (error) throw error;
  }

  async update(key: CollectionKey, id: string, patch: object) {
    const { id: _i, createdAt: _c, updatedAt: _u, userId: _uid, ...rest } = patch as Record<string, unknown>;
    const { error } = await this.db.from(TABLES[key]).update(toRow(rest)).eq('id', id);
    if (error) throw error;
  }

  async remove(key: CollectionKey, id: string) {
    const { error } = await this.db.from(TABLES[key]).delete().eq('id', id);
    if (error) throw error;
  }

  async replaceAll(data: Dataset, profile?: Partial<Profile>) {
    const db = this.db;
    // Borrar en orden inverso de dependencias; las FK en cascada limpian hijos.
    for (const k of ['transactions', 'purchaseDecisions', 'freelanceProjects', 'budgets', 'savingsGoals', 'debts', 'expenses', 'expenseCategories', 'income'] as CollectionKey[]) {
      const { error } = await db.from(TABLES[k]).delete().eq('user_id', this.userId);
      if (error) throw error;
    }
    const order: CollectionKey[] = ['income', 'expenseCategories', 'expenses', 'debts', 'debtPayments', 'debtNegotiations', 'savingsGoals', 'savingsContributions', 'budgets', 'budgetAllocations', 'purchaseDecisions', 'freelanceProjects', 'transactions'];
    for (const k of order) {
      const rows = (data[k] as object[]).map((r) => {
        const { createdAt: _c, updatedAt: _u, userId: _uid, ...rest } = r as Record<string, unknown>;
        return { ...toRow(rest), user_id: this.userId };
      });
      if (rows.length) {
        const { error } = await db.from(TABLES[k]).insert(rows);
        if (error) throw error;
      }
    }
    if (profile) await this.saveProfile(profile);
  }

  async uploadFile(file: File) {
    validateFile(file);
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const path = `${this.userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.db.storage.from('documents').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  }

  async fileUrl(path: string) {
    // URL firmada de corta duración: los documentos nunca son públicos.
    const { data, error } = await this.db.storage.from('documents').createSignedUrl(path, 120);
    if (error) throw error;
    return data.signedUrl;
  }

  subscribe(onChange: () => void) {
    const db = this.db;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, 500);
    };
    const channel = db.channel(`mcf-${this.userId}`);
    for (const table of [...Object.values(TABLES), 'profiles']) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: table === 'profiles' ? `id=eq.${this.userId}` : `user_id=eq.${this.userId}` },
        debounced,
      );
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void db.removeChannel(channel);
    };
  }
}

// =====================================================================
// Local (solo este dispositivo)
// =====================================================================
const idb = {
  open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('mcf-files', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async put(key: string, value: Blob) {
    const db = await idb.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async get(key: string): Promise<Blob | undefined> {
    const db = await idb.open();
    return new Promise((resolve, reject) => {
      const req = db.transaction('files').objectStore('files').get(key);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
  },
};

export class LocalRepo implements Repo {
  readonly kind = 'local' as const;
  private key: string;
  private profileKey: string;
  private listeners = new Set<() => void>();
  constructor(private userId: string, private displayName = '') {
    this.key = `mcf:data:${userId}`;
    this.profileKey = `mcf:profile:${userId}`;
  }

  private read(): Dataset {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? { ...emptyDataset(), ...(JSON.parse(raw) as Partial<Dataset>) } : emptyDataset();
    } catch {
      return emptyDataset();
    }
  }
  private write(data: Dataset) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }
  private stamp<T extends object>(row: T, isNew: boolean): T {
    const now = new Date().toISOString();
    return { ...row, ...(isNew ? { createdAt: now } : {}), updatedAt: now };
  }

  async loadAll() {
    const raw = localStorage.getItem(this.profileKey);
    const profile: Profile = raw ? { ...defaultProfile(this.userId), ...JSON.parse(raw) } : defaultProfile(this.userId, this.displayName);
    if (!raw) localStorage.setItem(this.profileKey, JSON.stringify(profile));
    return { profile, data: this.read() };
  }
  async saveProfile(patch: Partial<Profile>) {
    const { profile } = await this.loadAll();
    localStorage.setItem(this.profileKey, JSON.stringify({ ...profile, ...patch, id: this.userId }));
  }
  async insert(key: CollectionKey, row: { id: string }) {
    const data = this.read();
    (data[key] as object[]).push(this.stamp(row, true));
    this.write(data);
  }
  async update(key: CollectionKey, id: string, patch: object) {
    const data = this.read();
    (data[key] as unknown as { id: string }[]) = (data[key] as unknown as { id: string }[]).map((r) =>
      r.id === id ? this.stamp({ ...r, ...patch, id }, false) : r,
    );
    this.write(data);
  }
  async remove(key: CollectionKey, id: string) {
    const data = this.read();
    (data[key] as unknown as { id: string }[]) = (data[key] as unknown as { id: string }[]).filter((r) => r.id !== id);
    // Cascada equivalente a la de la base de datos.
    if (key === 'debts') {
      data.debtPayments = data.debtPayments.filter((p) => p.debtId !== id);
      data.debtNegotiations = data.debtNegotiations.filter((n) => n.debtId !== id);
      data.budgetAllocations = data.budgetAllocations.map((a) => (a.debtId === id ? { ...a, debtId: null } : a));
    }
    if (key === 'savingsGoals') {
      data.savingsContributions = data.savingsContributions.filter((c) => c.goalId !== id);
      data.budgetAllocations = data.budgetAllocations.map((a) => (a.goalId === id ? { ...a, goalId: null } : a));
    }
    if (key === 'budgets') data.budgetAllocations = data.budgetAllocations.filter((a) => a.budgetId !== id);
    this.write(data);
  }
  async replaceAll(data: Dataset, profile?: Partial<Profile>) {
    this.write({ ...emptyDataset(), ...data });
    if (profile) await this.saveProfile(profile);
  }
  async uploadFile(file: File) {
    validateFile(file);
    const path = `${this.userId}/${crypto.randomUUID()}`;
    await idb.put(path, file);
    return path;
  }
  async fileUrl(path: string) {
    const blob = await idb.get(path);
    if (!blob) throw new Error('Archivo no encontrado en este dispositivo.');
    return URL.createObjectURL(blob);
  }
  subscribe(onChange: () => void) {
    // Sincroniza entre pestañas abiertas del mismo navegador.
    const handler = (e: StorageEvent) => {
      if (e.key === this.key || e.key === this.profileKey) onChange();
    };
    window.addEventListener('storage', handler);
    this.listeners.add(onChange);
    return () => {
      window.removeEventListener('storage', handler);
      this.listeners.delete(onChange);
    };
  }
}
