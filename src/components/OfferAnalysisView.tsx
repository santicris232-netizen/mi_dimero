import { analyzeOffer } from '../lib/calc/debts';
import { formatCOP, formatPct } from '../lib/money';
import { formatDate, today } from '../lib/dates';
import { Money, Notice, cx } from './ui';

export default function OfferAnalysisView({ original, offer, available, monthlySurplus, deadline }: { original: number; offer: number; available: number; monthlySurplus: number; deadline: string | null }) {
  const a = analyzeOffer({ original, offer, available, monthlySurplus, deadline, today: today() });
  const cells = [
    { label: 'Saldo original', value: <Money value={a.original} /> },
    { label: 'Oferta', value: <Money value={a.offer} /> },
    { label: 'Descuento', value: <span className="amount text-emerald-600 dark:text-emerald-400">{formatCOP(a.discount)} · {formatPct(a.discountPct)}</span> },
    { label: 'Fecha límite', value: <span className="font-semibold">{deadline ? `${formatDate(deadline)}${a.daysToDeadline != null ? ` (${a.daysToDeadline < 0 ? 'vencida' : `${a.daysToDeadline} días`})` : ''}` : '—'}</span> },
    { label: 'Dinero disponible', value: <Money value={a.available} /> },
    { label: 'Dinero faltante', value: <Money value={a.missing} className={a.missing ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'} /> },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
            <p className="muted text-[11px]">{c.label}</p>
            <div className="text-sm">{c.value}</div>
          </div>
        ))}
      </div>
      <div className={cx('rounded-xl p-3 text-sm', a.coveredNow ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100' : 'bg-slate-50 dark:bg-white/5')}>
        <b>Impacto en tu presupuesto: </b>
        {a.coveredNow
          ? `Podrías pagarla hoy y te quedarían ${formatCOP(a.leftAfter)} disponibles. Verifica que eso no deje sin cubrir tus gastos obligatorios.`
          : a.monthsToCover == null
            ? 'Con tu excedente mensual actual no alcanzarías a reunir el faltante. Revisa tus gastos o busca ingresos extra.'
            : `Necesitarías ahorrar tu excedente completo (${formatCOP(monthlySurplus)}/mes) durante ${a.monthsToCover} mes${a.monthsToCover > 1 ? 'es' : ''}.`}
        {a.reachableByDeadline === false && <span className="mt-1 block font-semibold text-red-600 dark:text-red-400">No alcanzarías a reunirlo antes de la fecha límite.</span>}
      </div>
      <Notice tone="violet">Una simulación no constituye una oferta del acreedor. Solo un acuerdo escrito de la entidad es válido.</Notice>
    </div>
  );
}
