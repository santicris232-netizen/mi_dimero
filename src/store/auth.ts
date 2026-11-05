import { create } from 'zustand';
import { isCloud, supabase } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  ready: boolean;
  user: AuthUser | null;
  mode: 'cloud' | 'local';
  init(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  touch(): void;
}

// ---------- cuentas locales (solo si no hay Supabase) ----------
// La contraseña nunca se guarda: se almacena un hash PBKDF2-SHA256 con sal aleatoria.
interface LocalAccount {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
}
const USERS_KEY = 'mcf:users';
const SESSION_KEY = 'mcf:session';
const SESSION_DAYS = 14;
const IDLE_MINUTES = 60 * 12;

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 210_000 }, key, 256);
  return b64(bits);
}
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const readUsers = (): LocalAccount[] => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]');
  } catch {
    return [];
  }
};

function startLocalSession(user: AuthUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, exp: Date.now() + SESSION_DAYS * 86_400_000, last: Date.now() }));
}

const friendly = (msg: string) => {
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Confirma tu correo antes de ingresar (revisa tu bandeja de entrada).';
  if (/already registered|already exists/i.test(msg)) return 'Ese correo ya tiene una cuenta.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
  if (/password/i.test(msg) && /characters|weak/i.test(msg)) return 'La contraseña es muy débil.';
  if (/fetch|network/i.test(msg)) return 'Sin conexión con el servidor. Revisa tu internet.';
  return msg;
};

export const useAuth = create<AuthState>((set, get) => ({
  ready: false,
  user: null,
  mode: isCloud ? 'cloud' : 'local',

  async init() {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      set({ ready: true, user: u ? { id: u.id, email: u.email ?? '', name: (u.user_metadata?.display_name as string) ?? '' } : null });
      supabase.auth.onAuthStateChange((_event, session) => {
        const su = session?.user;
        const current = get().user;
        if (su?.id === current?.id) return;
        set({ user: su ? { id: su.id, email: su.email ?? '', name: (su.user_metadata?.display_name as string) ?? '' } : null });
      });
      return;
    }
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
      const valid = s && s.exp > Date.now() && Date.now() - s.last < IDLE_MINUTES * 60_000;
      if (!valid) localStorage.removeItem(SESSION_KEY);
      set({ ready: true, user: valid ? { id: s.id, email: s.email, name: s.name } : null });
    } catch {
      set({ ready: true, user: null });
    }
  },

  async signIn(email, password) {
    email = email.trim().toLowerCase();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(friendly(error.message));
      const u = data.user;
      set({ user: { id: u.id, email: u.email ?? email, name: (u.user_metadata?.display_name as string) ?? '' } });
      return;
    }
    const acc = readUsers().find((u) => u.email === email);
    // Se calcula el hash aunque no exista la cuenta, para no revelar qué correos existen por tiempo de respuesta.
    const hash = await hashPassword(password, acc ? unb64(acc.salt) : new Uint8Array(16));
    if (!acc || !timingSafeEqual(hash, acc.hash)) throw new Error('Correo o contraseña incorrectos.');
    const user = { id: acc.id, email: acc.email, name: acc.name };
    startLocalSession(user);
    set({ user });
  },

  async signUp(name, email, password) {
    email = email.trim().toLowerCase();
    name = name.trim();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name }, emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw new Error(friendly(error.message));
      if (data.session && data.user) {
        set({ user: { id: data.user.id, email, name } });
        return { needsConfirmation: false };
      }
      return { needsConfirmation: true };
    }
    const users = readUsers();
    if (users.some((u) => u.email === email)) throw new Error('Ese correo ya tiene una cuenta en este dispositivo.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const acc: LocalAccount = { id: crypto.randomUUID(), email, name, salt: b64(salt), hash: await hashPassword(password, salt) };
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, acc]));
    const user = { id: acc.id, email, name };
    startLocalSession(user);
    set({ user });
    return { needsConfirmation: false };
  },

  async resetPassword(email) {
    if (!supabase) throw new Error('En modo local no hay recuperación por correo. Si olvidaste la contraseña, crea una cuenta nueva.');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw new Error(friendly(error.message));
  },

  async signOut() {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    set({ user: null });
  },

  touch() {
    if (supabase) return;
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, last: Date.now() }));
    } catch {
      /* noop */
    }
  },
}));
