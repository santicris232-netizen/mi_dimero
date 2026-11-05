import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import {
  Home, ArrowLeftRight, Landmark, Target, User, Plus, CalendarRange, ShoppingBag, Briefcase, LineChart, Moon, Sun,
} from 'lucide-react';
import { cx } from './ui';
import { useUI } from '../store/ui';
import { useAuth } from '../store/auth';
import TutorHelp from '../tutor/TutorHelp';
import QuickAdd from './QuickAdd';
import Toasts from './Toasts';

const MAIN = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { to: '/deudas', label: 'Deudas', icon: Landmark },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/perfil', label: 'Perfil', icon: User },
];
const TOOLS = [
  { to: '/quincena', label: 'Distribuir quincena', icon: CalendarRange },
  { to: '/compras', label: '¿Lo necesito?', icon: ShoppingBag },
  { to: '/freelance', label: 'Freelance', icon: Briefcase },
  { to: '/simulador', label: 'Simulador', icon: LineChart },
];

export function ThemeButton() {
  const { theme, setTheme } = useUI();
  return (
    <button className="btn-ghost !p-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro'}>
      {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
      <div className="leading-tight">
        <div className="text-[15px] font-bold">Mi Control</div>
        <div className="text-[11px] font-medium text-slate-400">Financiero</div>
      </div>
    </div>
  );
}

export default function Layout() {
  const setQuickAdd = useUI((s) => s.setQuickAdd);
  const touch = useAuth((s) => s.touch);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
    touch();
  }, [pathname, touch]);

  const navItem = (item: (typeof MAIN)[number]) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5')
      }
    >
      <item.icon size={19} />
      {item.label}
    </NavLink>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/70 bg-white px-4 py-5 lg:flex dark:border-white/5 dark:bg-navy-2">
        <div className="flex items-center justify-between px-1">
          <Brand />
          <ThemeButton />
        </div>
        <button className="btn-primary mt-6 w-full" onClick={() => setQuickAdd(true)} data-tour="fab">
          <Plus size={18} /> Registrar movimiento
        </button>
        <nav className="mt-6 space-y-1">{MAIN.map(navItem)}</nav>
        <div className="mb-2 mt-6 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Herramientas</div>
        <nav className="space-y-1">{TOOLS.map(navItem)}</nav>
        <div className="mt-auto pt-4">
          <TutorHelp />
        </div>
      </aside>

      {/* Barra superior (móvil) */}
      <header className="safe-top sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/85 backdrop-blur-lg lg:hidden dark:border-white/5 dark:bg-navy/85">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <div className="flex items-center gap-1">
            <ThemeButton />
            <TutorHelp compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-36 pt-5 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
        <Outlet />
      </main>

      {/* Botón flotante (móvil) */}
      <button
        onClick={() => setQuickAdd(true)}
        data-tour="fab"
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2 rounded-full bg-brand px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/40 transition active:scale-95 lg:hidden"
      >
        <Plus size={20} strokeWidth={2.5} /> Registrar movimiento
      </button>

      {/* Navegación inferior (móvil) */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/95 backdrop-blur-lg lg:hidden dark:border-white/5 dark:bg-navy-2/95">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {MAIN.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => cx('flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition', isActive ? 'text-brand dark:text-blue-300' : 'text-slate-400')}>
              {({ isActive }) => (
                <>
                  <item.icon size={22} strokeWidth={isActive ? 2.4 : 1.9} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <QuickAdd />
      <Toasts />
    </div>
  );
}

export { TOOLS };
