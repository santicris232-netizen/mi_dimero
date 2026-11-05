import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { useData } from './store/data';
import { useTutor } from './tutor/store';
import Layout from './components/Layout';
import TutorOverlay from './tutor/TutorOverlay';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Toasts from './components/Toasts';

const Movimientos = lazy(() => import('./pages/Movimientos'));
const Quincena = lazy(() => import('./pages/Quincena'));
const Deudas = lazy(() => import('./pages/Deudas'));
const DeudaDetalle = lazy(() => import('./pages/DeudaDetalle'));
const Compras = lazy(() => import('./pages/Compras'));
const Metas = lazy(() => import('./pages/Metas'));
const Freelance = lazy(() => import('./pages/Freelance'));
const Simulador = lazy(() => import('./pages/Simulador'));
const Perfil = lazy(() => import('./pages/Perfil'));

export function Splash({ text = 'Cargando tus finanzas…' }: { text?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-navy text-white">
      <div className="flex flex-col items-center gap-4">
        <img src="tutor/pixel.png" alt="" className="pixelated animate-bob h-28" />
        <p className="font-pixel text-[10px] text-coin">{text}</p>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-navy p-6 text-white">
        <div className="pixel-box max-w-md p-6 text-center">
          <img src="tutor/pixel-head.png" alt="" className="pixelated mx-auto mb-3 h-16" />
          <p className="font-pixel mb-3 text-[11px] text-coin">¡UPS! ALGO FALLÓ</p>
          <p className="text-sm text-slate-200">Tus datos están a salvo. Recarga la aplicación para continuar.</p>
          <button className="pixel-btn pixel-btn-gold mt-4" onClick={() => location.reload()}>
            Recargar ▶
          </button>
        </div>
      </div>
    );
  }
}

function AuthedApp() {
  const { status, profile, error, reload } = useData();
  const startTutor = useTutor((s) => s.start);
  const tutorActive = useTutor((s) => s.active);

  useEffect(() => {
    if (status === 'ready' && profile?.onboarded && !profile.tutorialDone && !tutorActive) startTutor();
    // Solo al terminar la bienvenida / primera carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, profile?.onboarded]);

  if (status === 'error')
    return (
      <div className="grid min-h-dvh place-items-center bg-navy p-6 text-white">
        <div className="pixel-box max-w-md p-6 text-center">
          <p className="font-pixel mb-3 text-[11px] text-coin">SIN CONEXIÓN</p>
          <p className="text-sm text-slate-200">No pudimos cargar tus datos: {error}</p>
          <button className="pixel-btn pixel-btn-gold mt-4" onClick={() => void reload().then(() => useData.setState({ status: 'ready' }))}>
            Reintentar ▶
          </button>
        </div>
      </div>
    );
  if (status !== 'ready' || !profile) return <Splash />;
  if (!profile.onboarded) return <Onboarding />;

  return (
    <HashRouter>
      <Suspense fallback={<div className="p-10 text-center text-sm text-slate-400">Cargando…</div>}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="movimientos" element={<Movimientos />} />
            <Route path="quincena" element={<Quincena />} />
            <Route path="deudas" element={<Deudas />} />
            <Route path="deudas/:id" element={<DeudaDetalle />} />
            <Route path="compras" element={<Compras />} />
            <Route path="metas" element={<Metas />} />
            <Route path="ingresos-extra" element={<Freelance />} />
            <Route path="freelance" element={<Navigate to="/ingresos-extra" replace />} />
            <Route path="simulador" element={<Simulador />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
      <TutorOverlay />
    </HashRouter>
  );
}

export default function App() {
  const { ready, user, init } = useAuth();
  const start = useData((s) => s.start);
  const stop = useData((s) => s.stop);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (user) void start(user);
    else stop();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ErrorBoundary>
      {!ready ? <Splash text="Iniciando…" /> : !user ? <Login /> : <AuthedApp />}
      {!user && <Toasts />}
    </ErrorBoundary>
  );
}
