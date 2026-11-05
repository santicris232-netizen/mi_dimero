import { useState } from 'react';
import { useData } from '../store/data';
import { MoneyInput, Toggle, Input } from '../components/ui';
import { formatCOP } from '../lib/money';

/** Bienvenida estilo videojuego: nombre + quincenas (opcional). Todo queda en $0 si se omite. */
export default function Onboarding() {
  const { profile, saveProfile, add } = useData();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [q1, setQ1] = useState(0);
  const [q2, setQ2] = useState(0);
  const [estimate, setEstimate] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      const status = estimate ? 'estimado' : 'confirmado';
      if (q1 > 0) await add('income', { name: 'Pago 1.ª quincena', amount: q1, schedule: 'q1', expectedOn: null, status, notes: null });
      if (q2 > 0) await add('income', { name: 'Pago 2.ª quincena', amount: q2, schedule: 'q2', expectedOn: null, status, notes: null });
      await saveProfile({ displayName: name.trim().slice(0, 60), onboarded: true });
    } finally {
      setBusy(false);
    }
  };

  const screens = [
    {
      title: 'NUEVA PARTIDA',
      text: '¡Bienvenido a Mi Control Financiero! Soy Mini Cris y seré tu tutor. Antes de empezar, dime: ¿cómo quieres que te llame?',
      body: <Input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="!bg-white !text-ink" />,
      next: () => setStep(1),
      can: name.trim().length >= 2,
      cta: 'Continuar ▶',
    },
    {
      title: 'TUS INGRESOS',
      text: `Perfecto, ${name.trim().split(' ')[0]}. ¿Cuánto recibes en cada quincena? Si aún no lo sabes, déjalo en $0 y lo configuras luego.`,
      body: (
        <div className="space-y-3 text-left">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-300">1.ª quincena (días 1 a 15)</span>
            <MoneyInput value={q1} onChange={setQ1} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-300">2.ª quincena (días 16 a 31)</span>
            <MoneyInput value={q2} onChange={setQ2} />
          </label>
          <div className="rounded-lg bg-white/5 px-3 text-slate-100">
            <Toggle checked={estimate} onChange={setEstimate} label="Son valores aproximados" hint="Se marcarán como estimados" />
          </div>
          <p className="text-xs text-slate-300">Ingreso mensual: <b className="text-coin">{formatCOP(q1 + q2)}</b>. Primas o bonos se registran aparte y solo cuentan cuando los recibes.</p>
        </div>
      ),
      next: () => setStep(2),
      can: true,
      cta: q1 + q2 > 0 ? 'Guardar ▶' : 'Omitir por ahora ▶',
    },
    {
      title: '¡TODO LISTO!',
      text: 'Tu cuenta empieza en $0, sin datos inventados. Ahora te daré un recorrido rápido por la app, misión por misión. ¡Vamos!',
      body: null,
      next: finish,
      can: !busy,
      cta: busy ? 'Guardando…' : 'Empezar tutorial ★',
    },
  ];
  const s = screens[step];

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-navy px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="relative w-full max-w-md">
        <div className="mb-4 flex justify-center gap-2">
          {screens.map((_, i) => (
            <span key={i} className="h-3 w-8 border-2 border-white" style={{ background: i <= step ? '#f6c23e' : 'transparent' }} />
          ))}
        </div>
        <div className="flex justify-center">
          <img src="tutor/pixel.png" alt="Mini Cris" className="pixelated animate-bob relative z-10 -mb-3 h-40 drop-shadow-[0_8px_0_rgba(0,0,0,.35)]" />
        </div>
        <div key={step} className="pixel-box animate-pop p-5">
          <p className="font-pixel mb-3 text-[11px] text-coin">{s.title}</p>
          <p className="mb-4 text-[15px] leading-relaxed text-slate-100">{s.text}</p>
          {s.body}
          <div className="mt-5 flex items-center justify-between">
            <button className="pixel-btn !bg-[#2d3561] disabled:opacity-40" disabled={step === 0} onClick={() => setStep(step - 1)}>
              ◀
            </button>
            <button className="pixel-btn pixel-btn-gold disabled:opacity-50" disabled={!s.can} onClick={() => void s.next()}>
              {s.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
