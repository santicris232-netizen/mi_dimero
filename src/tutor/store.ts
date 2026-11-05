import { create } from 'zustand';
import { TUTORIAL } from './steps';

interface TutorState {
  active: boolean;
  step: number;
  tipOpen: boolean;
  start(): void;
  next(): void;
  prev(): void;
  stop(): void;
  setTip(open: boolean): void;
}

export const useTutor = create<TutorState>((set, get) => ({
  active: false,
  step: 0,
  tipOpen: false,
  start: () => set({ active: true, step: 0, tipOpen: false }),
  next: () => {
    const s = get().step + 1;
    if (s >= TUTORIAL.length) set({ active: false, step: 0 });
    else set({ step: s });
  },
  prev: () => set({ step: Math.max(0, get().step - 1) }),
  stop: () => set({ active: false, step: 0 }),
  setTip: (tipOpen) => set({ tipOpen }),
}));
