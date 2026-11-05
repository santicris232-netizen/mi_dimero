import { useEffect, useId, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { X, Info } from 'lucide-react';
import { formatCOP, groupInput, parseCOP } from '../lib/money';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{children}</h2>
      {action}
    </div>
  );
}

type Tone = 'red' | 'amber' | 'blue' | 'teal' | 'green' | 'slate' | 'violet';
const TONES: Record<Tone, string> = {
  red: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/10 dark:text-blue-300',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-500/10 dark:text-teal-300',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-white/5 dark:text-slate-300',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300',
};
export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', TONES[tone], className)}>{children}</span>;
}

/** Etiqueta de confiabilidad de un dato: confirmado / estimado / hipotético. */
export function DataBadge({ kind }: { kind: 'confirmado' | 'estimado' | 'hipotetico' }) {
  if (kind === 'confirmado') return <Badge tone="green">Confirmado</Badge>;
  if (kind === 'estimado') return <Badge tone="amber">Estimado</Badge>;
  return <Badge tone="violet">Hipotético</Badge>;
}

export function Money({ value, className, signed }: { value: number; className?: string; signed?: boolean }) {
  return <span className={cx('amount', className)}>{signed && value > 0 ? '+' : ''}{formatCOP(value)}</span>;
}

export function Progress({ value, color = '#1771e6', className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">{error}</span> : hint ? <span className="muted mt-1 block text-xs">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('input', props.className)} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx('input appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', props.className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}

/** Campo de dinero: muestra separadores de miles mientras se escribe y entrega un entero COP. */
export function MoneyInput({ value, onChange, placeholder = '0', autoFocus, id, invalid, large }: { value: number | null | undefined; onChange: (v: number) => void; placeholder?: string; autoFocus?: boolean; id?: string; invalid?: boolean; large?: boolean }) {
  const [text, setText] = useState(value ? groupInput(String(value)) : '');
  useEffect(() => {
    if (parseCOP(text) !== (value ?? 0)) setText(value ? groupInput(String(value)) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <span className={cx('pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-slate-400', large && 'text-2xl')}>$</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={cx('input amount pl-7', large && 'py-4 pl-9 text-3xl', invalid && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')}
        value={text}
        onChange={(e) => {
          const g = groupInput(e.target.value).slice(0, 17);
          setText(g);
          onChange(parseCOP(g));
        }}
      />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('inline-flex rounded-xl bg-slate-100 p-1 dark:bg-white/5', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition', value === o.value ? 'bg-white text-ink shadow-sm dark:bg-navy-3 dark:text-white' : 'text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-white')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="muted block text-xs">{hint}</span>}
      </span>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand' : 'bg-slate-300 dark:bg-white/15')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

/** Hoja inferior en móvil / diálogo centrado en escritorio. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-navy/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('animate-slide-up sm:animate-pop safe-bottom relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-navy-2', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-white/5 dark:bg-navy-2/95">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="btn-ghost -mr-2 !p-2" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Botón que pide confirmación en línea (sin diálogos nativos del navegador). */
export function ConfirmButton({ onConfirm, children, confirmText = '¿Seguro?', className = 'btn-ghost text-red-600 dark:text-red-400' }: { onConfirm: () => void; children: ReactNode; confirmText?: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <button type="button" className="btn-danger" onClick={() => { setArmed(false); onConfirm(); }}>
      {confirmText}
    </button>
  ) : (
    <button type="button" className={className} onClick={() => setArmed(true)}>
      {children}
    </button>
  );
}

export function Notice({ tone = 'blue', children, icon }: { tone?: 'blue' | 'amber' | 'red' | 'green' | 'violet'; children: ReactNode; icon?: ReactNode }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-900 border-blue-100 dark:bg-blue-500/10 dark:text-blue-100 dark:border-blue-400/20',
    amber: 'bg-amber-50 text-amber-900 border-amber-100 dark:bg-amber-500/10 dark:text-amber-100 dark:border-amber-400/20',
    red: 'bg-red-50 text-red-900 border-red-100 dark:bg-red-500/10 dark:text-red-100 dark:border-red-400/20',
    green: 'bg-emerald-50 text-emerald-900 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-100 dark:border-emerald-400/20',
    violet: 'bg-violet-50 text-violet-900 border-violet-100 dark:bg-violet-500/10 dark:text-violet-100 dark:border-violet-400/20',
  };
  return (
    <div className={cx('flex gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed', tones[tone])}>
      <span className="mt-0.5 shrink-0">{icon ?? <Info size={16} />}</span>
      <div>{children}</div>
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <img src="tutor/pixel-head.png" alt="" className="pixelated mb-3 h-16 w-16 rounded-2xl bg-navy p-1" />
      <p className="font-semibold">{title}</p>
      <p className="muted mx-auto mt-1 max-w-sm text-sm">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, accent = '#1771e6', tour, children }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; accent?: string; tour?: string; children?: ReactNode }) {
  return (
    <div className="card p-4" data-tour={tour}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
        {icon && (
          <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${accent}18`, color: accent }}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 text-[22px] leading-tight">{value}</div>
      {sub && <div className="muted mt-1 text-xs">{sub}</div>}
      {children}
    </div>
  );
}
