import { useLocation } from 'react-router-dom';
import { PAGE_TIPS } from './steps';
import { useTutor } from './store';

/** Botón con la cara de Mini Cris: consejo de la pantalla actual + repetir tutorial. */
export default function TutorHelp({ compact }: { compact?: boolean }) {
  const { tipOpen, setTip, start } = useTutor();
  const { pathname } = useLocation();
  const key = '/' + (pathname.split('/')[1] ?? '');
  const tip = PAGE_TIPS[key] ?? PAGE_TIPS['/'];

  return (
    <div className="relative">
      <button
        onClick={() => setTip(!tipOpen)}
        className="group flex items-center gap-2 rounded-xl p-1 transition hover:bg-slate-100 dark:hover:bg-white/5"
        aria-label="Ayuda de Mini Cris"
        aria-expanded={tipOpen}
      >
        <img src="tutor/pixel-head.png" alt="" className="pixelated h-9 w-9 rounded-lg bg-navy ring-2 ring-coin/70 transition group-hover:scale-105" />
        {!compact && <span className="pr-2 text-sm font-semibold">Ayuda de Mini Cris</span>}
      </button>
      {tipOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTip(false)} />
          <div className={`pixel-box animate-pop absolute z-50 w-[min(20rem,calc(100vw-2rem))] p-4 ${compact ? 'right-0 mt-3' : 'bottom-14 left-0'}`}>
            <div className="mb-2 flex items-center gap-2">
              <img src="tutor/pixel-head.png" alt="" className="pixelated h-8 w-8" />
              <span className="font-pixel text-[9px] text-coin">CONSEJO DE MINI CRIS</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-100">{tip}</p>
            <div className="mt-3 flex justify-end">
              <button
                className="pixel-btn pixel-btn-gold"
                onClick={() => {
                  setTip(false);
                  start();
                }}
              >
                Repetir tutorial ▶
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
