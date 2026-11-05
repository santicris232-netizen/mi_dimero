import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Upload, LogOut, ShieldCheck, FileSpreadsheet, RotateCcw, Gamepad2, ChevronRight, Cloud, HardDrive, Trash2 } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useData } from '../store/data';
import { useUI, toast } from '../store/ui';
import { useTutor } from '../tutor/store';
import { Card, ConfirmButton, Field, Input, Notice, PageHeader, Segmented, SectionTitle } from '../components/ui';
import { TOOLS } from '../components/Layout';
import { download, makeBackup, parseBackup, transactionsCSV } from '../lib/backup';
import { categoryLabel } from '../lib/constants';
import { today } from '../lib/dates';
import { emptyDataset } from '../types';

export default function Perfil() {
  const { user, mode, signOut } = useAuth();
  const { profile, data, saveProfile, replaceAll } = useData();
  const { theme, setTheme } = useUI();
  const startTutorial = useTutor((s) => s.start);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [hours, setHours] = useState(profile?.waitRuleHours ?? 48);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  const exportJSON = () => {
    download(`mi-control-financiero-${today()}.json`, JSON.stringify(makeBackup(data, { displayName: profile.displayName, waitRuleHours: profile.waitRuleHours }), null, 2), 'application/json');
    toast('Copia de seguridad descargada');
  };
  const exportCSV = () => {
    download(`movimientos-${today()}.csv`, transactionsCSV(data.transactions, (s) => categoryLabel(s, data.expenseCategories)), 'text/csv;charset=utf-8');
    toast('Movimientos exportados a CSV');
  };
  const importJSON = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) return toast('Archivo demasiado grande', 'error');
    setBusy(true);
    try {
      const parsed = parseBackup(JSON.parse(await file.text()));
      await replaceAll(parsed.data, parsed.profile?.displayName ? { displayName: parsed.profile.displayName, waitRuleHours: parsed.profile.waitRuleHours ?? 48 } : undefined);
      toast('Copia restaurada correctamente');
    } catch (e) {
      toast(e instanceof SyntaxError ? 'El archivo no es un JSON válido' : (e as Error).message, 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <PageHeader title="Perfil" subtitle={user?.email} />

      <Card className="overflow-hidden !border-0 bg-navy p-0 text-white dark:bg-navy-3" data-tour="profile-tutorial">
        <div className="flex items-center gap-4 p-5">
          <img src="tutor/pixel.png" alt="Mini Cris" className="pixelated animate-bob h-24 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-pixel text-[10px] text-coin">TU TUTOR: MINI CRIS</p>
            <p className="mt-2 text-sm text-slate-200">{profile.tutorialDone ? '¡Insignia "Primer paso" desbloqueada! ¿Quieres repasar las misiones?' : 'Aún no terminas el tutorial. ¡Te faltan misiones!'}</p>
            <button className="pixel-btn pixel-btn-gold mt-3" onClick={startTutorial}>
              <Gamepad2 size={14} /> {profile.tutorialDone ? 'Repetir tutorial' : 'Continuar tutorial'}
            </button>
          </div>
        </div>
      </Card>

      <SectionTitle>Herramientas</SectionTitle>
      <Card className="divide-y divide-slate-100 lg:hidden dark:divide-white/5">
        {TOOLS.map((t) => (
          <Link key={t.to} to={t.to} className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold">
            <t.icon size={18} className="text-brand" /> <span className="flex-1">{t.label}</span> <ChevronRight size={16} className="text-slate-400" />
          </Link>
        ))}
      </Card>
      <p className="muted hidden text-sm lg:block">Encuentra todas las herramientas en la barra lateral.</p>

      <SectionTitle>Preferencias</SectionTitle>
      <Card className="space-y-5 p-5">
        <div className="flex items-end gap-2">
          <Field label="Tu nombre">
            <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </Field>
          <button className="btn-secondary" disabled={name.trim().length < 2 || name.trim() === profile.displayName} onClick={() => void saveProfile({ displayName: name.trim() }).then(() => toast('Nombre actualizado'))}>
            Guardar
          </button>
        </div>
        <div>
          <span className="label">Apariencia</span>
          <Segmented
            value={theme}
            onChange={(t) => {
              setTheme(t);
              void saveProfile({ theme: t }).catch(() => undefined);
            }}
            options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]}
          />
        </div>
        <div className="flex items-end gap-2">
          <Field label="Regla de espera para compras no esenciales (horas)">
            <Input type="number" min={0} max={720} value={hours} onChange={(e) => setHours(Math.max(0, Math.min(720, Number(e.target.value) || 0)))} />
          </Field>
          <button className="btn-secondary" disabled={hours === profile.waitRuleHours} onClick={() => void saveProfile({ waitRuleHours: hours }).then(() => toast('Regla actualizada'))}>
            Guardar
          </button>
        </div>
      </Card>

      <SectionTitle>Tus datos</SectionTitle>
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm">
          {mode === 'cloud' ? <Cloud size={16} className="text-brand" /> : <HardDrive size={16} className="text-amber-600" />}
          {mode === 'cloud' ? 'Sincronizado en la nube (Supabase)' : 'Guardado solo en este dispositivo (modo local)'}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button className="btn-secondary" onClick={exportJSON}><Download size={16} /> Copia de seguridad</button>
          <button className="btn-secondary" onClick={exportCSV} disabled={!data.transactions.length}><FileSpreadsheet size={16} /> Movimientos CSV</button>
          <button className="btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={16} /> Restaurar copia</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void importJSON(e.target.files[0])} />
        </div>
        <p className="muted text-xs">Restaurar reemplaza todos tus datos actuales por los de la copia. Los comprobantes adjuntos no se incluyen en la copia.</p>
        <div className="border-t border-slate-100 pt-3 dark:border-white/5">
          <ConfirmButton className="btn-ghost text-red-600 dark:text-red-400" confirmText="Sí, borrar todos mis datos" onConfirm={() => void replaceAll(emptyDataset()).then(() => toast('Todos tus datos fueron borrados'))}>
            <Trash2 size={16} /> Borrar todos mis datos y empezar de cero
          </ConfirmButton>
        </div>
      </Card>

      <SectionTitle>Seguridad</SectionTitle>
      <Notice tone="green" icon={<ShieldCheck size={16} />}>
        <ul className="list-disc space-y-1 pl-4">
          <li>Nunca te pediremos contraseñas, claves ni credenciales de tus bancos.</li>
          {mode === 'cloud' ? <li>Cada registro está protegido con políticas de seguridad por usuario: solo tu cuenta puede leerlo.</li> : <li>Tu contraseña nunca se guarda en texto plano: solo un hash PBKDF2 con sal aleatoria.</li>}
          <li>Los comprobantes se guardan de forma privada y solo se abren con enlaces temporales.</li>
          <li>Haz una copia de seguridad cada mes.</li>
        </ul>
      </Notice>

      <button className="btn-secondary mt-6 w-full !py-3 text-red-600 dark:text-red-400" onClick={() => void signOut()}>
        <LogOut size={18} /> Cerrar sesión
      </button>
      <p className="muted mt-4 flex items-center justify-center gap-1 text-center text-xs"><RotateCcw size={12} /> Mi Control Financiero v1.0</p>
    </div>
  );
}
