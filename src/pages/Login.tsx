import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, User, ShieldCheck, HardDrive } from 'lucide-react';
import { useAuth } from '../store/auth';
import { configError, isCloud } from '../lib/supabase';
import { Field, Notice, Segmented, cx } from '../components/ui';
import { ThemeButton } from '../components/Layout';
import { toast } from '../store/ui';

const email = z.string().trim().email('Correo inválido').max(120);
const password = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Incluye al menos una letra')
  .regex(/\d/, 'Incluye al menos un número');

const loginSchema = z.object({ email, password: z.string().min(1, 'Ingresa tu contraseña') });
const signupSchema = z
  .object({ name: z.string().trim().min(2, 'Escribe tu nombre').max(60), email, password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' });
const resetSchema = z.object({ email });

type Mode = 'login' | 'signup' | 'reset';

function IconInput({ icon, error, type = 'text', reveal, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode; error?: boolean; reveal?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
      <input {...props} type={reveal ? (show ? 'text' : 'password') : type} className={cx('input pl-10', reveal && 'pr-11', error && 'border-red-400')} />
      {reveal && (
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-600" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  );
}

function LoginForm() {
  const signIn = useAuth((s) => s.signIn);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setErr(null);
        try {
          await signIn(v.email, v.password);
        } catch (e) {
          setErr((e as Error).message);
        }
      })}
    >
      <Field label="Correo electrónico" error={formState.errors.email?.message}>
        <IconInput icon={<Mail size={18} />} type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" error={!!formState.errors.email} {...register('email')} />
      </Field>
      <Field label="Contraseña" error={formState.errors.password?.message}>
        <IconInput icon={<Lock size={18} />} reveal autoComplete="current-password" placeholder="••••••••" error={!!formState.errors.password} {...register('password')} />
      </Field>
      {err && <Notice tone="red">{err}</Notice>}
      <button className="btn-primary w-full !py-3" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
      </button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const signUp = useAuth((s) => s.signUp);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema) });
  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setErr(null);
        try {
          const r = await signUp(v.name, v.email, v.password);
          if (r.needsConfirmation) {
            toast('Te enviamos un correo para confirmar tu cuenta.', 'info');
            onDone();
          }
        } catch (e) {
          setErr((e as Error).message);
        }
      })}
    >
      <Field label="¿Cómo te llamas?" error={formState.errors.name?.message}>
        <IconInput icon={<User size={18} />} autoComplete="given-name" placeholder="Tu nombre" error={!!formState.errors.name} {...register('name')} />
      </Field>
      <Field label="Correo electrónico" error={formState.errors.email?.message}>
        <IconInput icon={<Mail size={18} />} type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" error={!!formState.errors.email} {...register('email')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contraseña" error={formState.errors.password?.message} hint="8+ caracteres, letras y números">
          <IconInput icon={<Lock size={18} />} reveal autoComplete="new-password" placeholder="••••••••" error={!!formState.errors.password} {...register('password')} />
        </Field>
        <Field label="Repite la contraseña" error={formState.errors.confirm?.message}>
          <IconInput icon={<Lock size={18} />} reveal autoComplete="new-password" placeholder="••••••••" error={!!formState.errors.confirm} {...register('confirm')} />
        </Field>
      </div>
      {err && <Notice tone="red">{err}</Notice>}
      <button className="btn-primary w-full !py-3" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? 'Creando cuenta…' : 'Crear mi cuenta gratis'}
      </button>
      <p className="muted text-center text-xs">Nunca te pediremos claves ni credenciales de tus bancos.</p>
    </form>
  );
}

function ResetForm({ onDone }: { onDone: () => void }) {
  const resetPassword = useAuth((s) => s.resetPassword);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setErr(null);
        try {
          await resetPassword(v.email);
          toast('Si el correo existe, recibirás un enlace para restablecer tu contraseña.', 'info');
          onDone();
        } catch (e) {
          setErr((e as Error).message);
        }
      })}
    >
      <Field label="Correo de tu cuenta" error={formState.errors.email?.message}>
        <IconInput icon={<Mail size={18} />} type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" {...register('email')} />
      </Field>
      {err && <Notice tone="red">{err}</Notice>}
      <button className="btn-primary w-full !py-3" disabled={formState.isSubmitting}>
        Enviar enlace
      </button>
    </form>
  );
}

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const bubble =
    mode === 'signup'
      ? '¡Genial! Crea tu cuenta y en 2 minutos te enseño a organizar tu dinero.'
      : mode === 'reset'
        ? 'Tranquilo, a todos se nos olvida. Te ayudo a recuperarla.'
        : '¡Hola! Soy Mini Cris. Inicia sesión y sigamos construyendo tu libertad financiera.';

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Héroe con el tutor */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-navy px-6 pb-8 pt-10 text-white sm:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0 opacity-[.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-teal/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src="icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
          <div>
            <div className="font-bold">Mi Control Financiero</div>
            <div className="text-xs text-slate-400">Tu asistente financiero personal</div>
          </div>
        </div>
        <div className="relative mt-8 flex items-end gap-4 lg:mt-0 lg:flex-col lg:items-start">
          <div className="pixel-box order-2 mb-6 max-w-xs p-4 text-sm leading-relaxed lg:order-1 lg:mb-0 lg:max-w-sm lg:text-base">
            <span className="font-pixel mb-2 block text-[9px] text-coin">MINI CRIS</span>
            {bubble}
          </div>
          <img src="tutor/pixel.png" alt="Mini Cris, tu tutor financiero" className="pixelated animate-bob order-1 h-36 drop-shadow-[0_8px_0_rgba(0,0,0,.35)] sm:h-44 lg:order-2 lg:h-72" />
        </div>
        <div className="relative mt-6 hidden gap-6 text-sm text-slate-300 lg:flex">
          <span>✓ Quincenas organizadas</span>
          <span>✓ Fuera de deudas</span>
          <span>✓ Metas cumplidas</span>
        </div>
      </section>

      {/* Formulario */}
      <section className="flex flex-col px-5 py-8 sm:px-10 lg:justify-center">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">{mode === 'signup' ? 'Crea tu cuenta' : mode === 'reset' ? 'Recuperar contraseña' : 'Bienvenido de nuevo'}</h1>
            <ThemeButton />
          </div>
          {mode !== 'reset' && (
            <Segmented
              className="mb-6 w-full"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'login', label: 'Iniciar sesión' },
                { value: 'signup', label: 'Crear cuenta' },
              ]}
            />
          )}
          {mode === 'login' && <LoginForm />}
          {mode === 'signup' && <SignupForm onDone={() => setMode('login')} />}
          {mode === 'reset' && <ResetForm onDone={() => setMode('login')} />}

          <div className="mt-4 text-center text-sm">
            {mode === 'login' && isCloud && (
              <button className="font-semibold text-brand hover:underline" onClick={() => setMode('reset')}>
                ¿Olvidaste tu contraseña?
              </button>
            )}
            {mode === 'reset' && (
              <button className="font-semibold text-brand hover:underline" onClick={() => setMode('login')}>
                Volver a iniciar sesión
              </button>
            )}
          </div>

          <div className="mt-8">
            {configError ? (
              <Notice tone="red">{configError}</Notice>
            ) : isCloud ? (
              <Notice tone="green" icon={<ShieldCheck size={16} />}>
                Conexión segura. Tus datos se guardan en la nube, protegidos para que solo tú puedas verlos.
              </Notice>
            ) : (
              <Notice tone="amber" icon={<HardDrive size={16} />}>
                <b>Modo local:</b> tu cuenta y tus datos se guardan solo en este dispositivo. Exporta copias de seguridad desde tu perfil.
              </Notice>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
