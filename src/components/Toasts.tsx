import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useUI } from '../store/ui';

export default function Toasts() {
  const { toasts, dismiss } = useUI();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="animate-pop pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl bg-navy px-4 py-3 text-left text-sm font-medium text-white shadow-xl dark:bg-white dark:text-navy"
        >
          {t.tone === 'ok' ? <CheckCircle2 size={18} className="shrink-0 text-emerald-400 dark:text-emerald-600" /> : t.tone === 'error' ? <AlertTriangle size={18} className="shrink-0 text-red-400 dark:text-red-600" /> : <Info size={18} className="shrink-0 text-blue-300 dark:text-blue-600" />}
          {t.text}
        </button>
      ))}
    </div>
  );
}
