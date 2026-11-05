import { create } from 'zustand';

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'info';
}

interface UIState {
  toasts: Toast[];
  quickAddOpen: boolean;
  theme: 'light' | 'dark';
  setQuickAdd(open: boolean): void;
  setTheme(t: 'light' | 'dark'): void;
  push(text: string, tone?: Toast['tone']): void;
  dismiss(id: number): void;
}

let seq = 0;
const initialTheme = (): 'light' | 'dark' =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  quickAddOpen: false,
  theme: initialTheme(),
  setQuickAdd: (quickAddOpen) => set({ quickAddOpen }),
  setTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('mcf-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1324' : '#f5f7fb');
    set({ theme });
  },
  push(text, tone = 'ok') {
    const id = ++seq;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    setTimeout(() => get().dismiss(id), tone === 'error' ? 6000 : 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (text: string, tone: Toast['tone'] = 'ok') => useUI.getState().push(text, tone);
