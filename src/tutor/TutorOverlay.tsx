import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TUTORIAL } from './steps';
import { useTutor } from './store';
import { useData } from '../store/data';

const PAD = 8;

function findVisible(target: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
  return els.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) ?? null;
}

/** Texto con efecto máquina de escribir. Un toque lo completa. */
function useTypewriter(text: string) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [count, setCount] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const id = setInterval(() => setCount((c) => (c >= text.length ? (clearInterval(id), c) : c + 1)), 16);
    return () => clearInterval(id);
  }, [text, reduce]);
  return { shown: text.slice(0, count), done: count >= text.length, finish: () => setCount(text.length) };
}

function Coins({ burst }: { burst: number }) {
  if (!burst) return null;
  return (
    <div key={burst} className="pointer-events-none absolute -top-2 right-6 flex gap-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className="animate-coin block h-4 w-4 rounded-full border-2 border-[#b8860b] bg-coin" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

export default function TutorOverlay() {
  const { active, step, next, prev, stop } = useTutor();
  const profile = useData((s) => s.profile);
  const saveProfile = useData((s) => s.saveProfile);
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [burst, setBurst] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const current = TUTORIAL[step];
  const name = profile?.displayName?.split(' ')[0] ?? '';
  const text = current ? current.text(name) : '';
  const { shown, done, finish } = useTypewriter(active ? text : '');
  const isLast = step === TUTORIAL.length - 1;
  const xp = Math.round(((step + 1) / TUTORIAL.length) * 100);

  // Navegar a la pantalla de la misión.
  useEffect(() => {
    if (active && current && location.pathname !== current.route) navigate(current.route);
  }, [active, current, location.pathname, navigate]);

  // Ubicar y seguir el elemento resaltado.
  const measure = useCallback(() => {
    if (!active || !current?.target) return setRect(null);
    const el = findVisible(current.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [active, current]);

  useLayoutEffect(() => {
    if (!active) return;
    setRect(null);
    if (!current?.target) return;
    let tries = 0;
    let raf = 0;
    const seek = () => {
      const el = findVisible(current.target!);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(measure, 350);
      } else if (tries++ < 90) raf = requestAnimationFrame(seek);
    };
    raf = requestAnimationFrame(seek);
    return () => cancelAnimationFrame(raf);
  }, [active, step, current, location.pathname, measure]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, measure]);

  const finishTutorial = useCallback(() => {
    stop();
    void saveProfile({ tutorialDone: true }).catch(() => undefined);
  }, [stop, saveProfile]);

  const advance = useCallback(() => {
    if (!done) return finish();
    setBurst((b) => b + 1);
    if (isLast) {
      finishTutorial();
      navigate('/movimientos');
    } else next();
  }, [done, finish, isLast, finishTutorial, navigate, next]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishTutorial();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        advance();
      } else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, advance, prev, finishTutorial]);

  useEffect(() => {
    if (active) boxRef.current?.focus();
  }, [active, step]);

  if (!active || !current) return null;

  // El cuadro de diálogo va arriba si el elemento resaltado está en la mitad inferior.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const boxOnTop = rect ? rect.top + rect.height / 2 > vh * 0.55 : false;
  const centered = !current.target;

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      {/* Fondo oscuro con "agujero" sobre el elemento resaltado */}
      {rect ? (
        <div
          className="animate-ring pointer-events-none fixed rounded-2xl transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 4px #f6c23e, 0 0 0 9999px rgba(5, 9, 25, 0.78)',
          }}
        />
      ) : (
        <div className="animate-fade fixed inset-0 bg-[rgba(5,9,25,0.82)]" />
      )}
      {/* Captura clics para que no se interactúe con la app durante la misión */}
      <div className="fixed inset-0" onClick={advance} />

      {/* HUD */}
      <div className="safe-top pointer-events-none fixed inset-x-0 top-0 flex items-center justify-between gap-3 px-4 pt-3">
        <div className="pointer-events-auto flex items-center gap-3">
          <span className="font-pixel text-[10px] text-coin drop-shadow">MISIÓN {step + 1}/{TUTORIAL.length}</span>
          <div className="flex h-3 w-28 gap-[2px] border-2 border-white bg-[#11183a] p-[2px] sm:w-40">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="flex-1" style={{ background: i < Math.round(xp / 10) ? '#22c55e' : 'transparent' }} />
            ))}
          </div>
          <span className="font-pixel hidden text-[9px] text-white sm:inline">XP {xp}</span>
        </div>
        <button className="pixel-btn pointer-events-auto !bg-[#e74c3c]" onClick={finishTutorial}>
          Saltar ✕
        </button>
      </div>

      {/* Cuadro de diálogo estilo RPG */}
      <div
        className={
          centered
            ? 'fixed inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4'
            : `fixed inset-x-0 flex justify-center px-4 ${boxOnTop ? 'top-16' : 'bottom-24 lg:bottom-8'}`
        }
      >
        <div
          ref={boxRef}
          tabIndex={-1}
          key={step}
          className="pixel-box animate-pop w-full max-w-xl outline-none"
          onClick={(e) => {
            e.stopPropagation();
            if (!done) finish();
          }}
        >
          <Coins burst={burst} />
          {centered && (
            <div className="flex justify-center pt-5">
              <img src="tutor/pixel.png" alt="Mini Cris, tu tutor" className="pixelated animate-bob h-40 drop-shadow-[0_6px_0_rgba(0,0,0,.35)] sm:h-48" />
            </div>
          )}
          <div className="flex gap-3 p-4 sm:gap-4 sm:p-5">
            {!centered && (
              <div className="-mt-12 shrink-0 sm:-mt-16">
                <img src="tutor/pixel.png" alt="Mini Cris, tu tutor" className="pixelated animate-bob h-24 drop-shadow-[0_4px_0_rgba(0,0,0,.35)] sm:h-32" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-pixel inline-block bg-[#6c5ce7] px-2 py-1 text-[9px] text-white">MINI CRIS</span>
                {current.reward && <span className="font-pixel text-[9px] text-coin">{current.reward}</span>}
              </div>
              <h3 className="font-pixel mb-2 text-[11px] leading-relaxed text-coin sm:text-xs">{current.title}</h3>
              <p className="min-h-[5.5rem] text-[15px] font-medium leading-relaxed text-slate-100">
                {shown}
                {!done && <span className="animate-blink">▌</span>}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button className="pixel-btn !bg-[#2d3561] disabled:opacity-40" disabled={step === 0} onClick={(e) => { e.stopPropagation(); prev(); }}>
                  ◀ Atrás
                </button>
                <button className="pixel-btn pixel-btn-gold" onClick={(e) => { e.stopPropagation(); advance(); }}>
                  {!done ? 'Saltar texto' : isLast ? '¡Vamos! ★' : step === 0 ? '¡Listo! ▶' : 'Siguiente ▶'}
                  {done && !isLast && <span className="animate-blink">▼</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
