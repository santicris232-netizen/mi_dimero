import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, HandCoins, Briefcase } from 'lucide-react';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { Badge, Card, ConfirmButton, Empty, Field, Input, Modal, Money, MoneyInput, Notice, PageHeader, Progress, Select, Stat, Toggle } from '../components/ui';
import { freelanceSummary, freelanceTotals, splitPayment } from '../lib/calc/freelance';
import { FREELANCE_CATEGORIES } from '../lib/constants';
import { formatDate, today } from '../lib/dates';
import { formatCOP } from '../lib/money';
import type { FreelanceProject } from '../types';

const STATUS: Record<FreelanceProject['status'], { label: string; tone: 'slate' | 'blue' | 'amber' | 'green' | 'red' }> = {
  propuesta: { label: 'Propuesta', tone: 'slate' },
  activo: { label: 'En curso', tone: 'blue' },
  entregado: { label: 'Entregado', tone: 'amber' },
  pagado: { label: 'Pagado', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'red' },
};

const schema = z
  .object({
    client: z.string().trim().min(1, 'Escribe el cliente').max(80),
    project: z.string().trim().min(1, 'Escribe el proyecto').max(120),
    category: z.enum(['desarrollo_web', 'automatizaciones', 'bases_de_datos', 'desarrollo_software', 'mantenimiento', 'otros']),
    contractValue: z.number().int().min(1, 'Ingresa el valor contratado'),
    advance: z.number().int().min(0),
    costs: z.number().int().min(0),
    deliveryDate: z.string(),
    status: z.enum(['propuesta', 'activo', 'entregado', 'pagado', 'cancelado']),
    pctDebt: z.number().int().min(0).max(100),
    pctSaving: z.number().int().min(0).max(100),
    pctPersonal: z.number().int().min(0).max(100),
    advanceReceived: z.boolean(),
  })
  .refine((v) => v.advance <= v.contractValue, { path: ['advance'], message: 'El anticipo no puede superar el valor contratado' })
  .refine((v) => v.pctDebt + v.pctSaving + v.pctPersonal <= 100, { path: ['pctPersonal'], message: 'Los porcentajes suman más de 100 %' });
type Form = z.infer<typeof schema>;

function ProjectForm({ editing, onClose }: { editing: FreelanceProject | null; onClose: () => void }) {
  const { add, patch, addTransaction } = useData();
  const { register, control, handleSubmit, watch, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? { ...editing, deliveryDate: editing.deliveryDate ?? '', advanceReceived: false }
      : { client: '', project: '', category: 'desarrollo_web', contractValue: 0, advance: 0, costs: 0, deliveryDate: '', status: 'activo', pctDebt: 40, pctSaving: 30, pctPersonal: 30, advanceReceived: true },
  });
  const [cv, adv, costs, pd, ps, pp] = watch(['contractValue', 'advance', 'costs', 'pctDebt', 'pctSaving', 'pctPersonal']);
  const net = (cv || 0) - (costs || 0);
  const pctSum = (pd || 0) + (ps || 0) + (pp || 0);

  const submit = async (v: Form) => {
    const { advanceReceived, ...rest } = v;
    const row = { ...rest, deliveryDate: v.deliveryDate || null };
    if (editing) {
      await patch('freelanceProjects', editing.id, row);
      toast('Proyecto actualizado');
    } else {
      const received = advanceReceived ? v.advance : 0;
      const p = await add('freelanceProjects', { ...row, receivedTotal: received });
      if (received > 0) await addTransaction({ kind: 'ingreso', amount: received, occurredOn: today(), category: 'freelance', description: `Anticipo: ${v.project}`, refTable: 'freelance_projects', refId: p.id });
      toast('Proyecto registrado');
    }
    onClose();
  };

  const pctField = (name: 'pctDebt' | 'pctSaving' | 'pctPersonal', label: string, color: string) => (
    <Field label={`${label} (%)`}>
      <div className="flex items-center gap-2">
        <input type="range" min={0} max={100} step={5} className="flex-1" style={{ accentColor: color }} {...register(name, { valueAsNumber: true })} />
        <span className="amount w-10 text-right text-sm">{watch(name)}%</span>
      </div>
    </Field>
  );

  return (
    <Modal open onClose={onClose} title={editing ? 'Editar ingreso extra' : 'Nuevo ingreso extra'} wide>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente" error={formState.errors.client?.message}><Input {...register('client')} /></Field>
          <Field label="Proyecto" error={formState.errors.project?.message}><Input {...register('project')} /></Field>
          <Field label="Categoría">
            <Select {...register('category')}>
              {Object.entries(FREELANCE_CATEGORIES).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select {...register('status')}>
              {Object.entries(STATUS).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Valor contratado" error={formState.errors.contractValue?.message}>
            <Controller control={control} name="contractValue" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
          </Field>
          <Field label="Anticipo" error={formState.errors.advance?.message}>
            <Controller control={control} name="advance" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
          </Field>
          <Field label="Gastos asociados" hint="Licencias, hosting, transporte…">
            <Controller control={control} name="costs" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
          </Field>
          <Field label="Fecha de entrega"><Input type="date" {...register('deliveryDate')} /></Field>
        </div>
        {!editing && adv > 0 && <Controller control={control} name="advanceReceived" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Ya recibí el anticipo" hint="Se suma a tu dinero disponible" />} />}
        <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
          Ingreso neto estimado: <b className="amount">{formatCOP(net)}</b> · Saldo por cobrar: <b className="amount">{formatCOP(Math.max(0, (cv || 0) - (adv || 0)))}</b>
        </div>
        <p className="pt-1 text-sm font-semibold">¿Cómo repartirás lo que ganes?</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {pctField('pctDebt', 'Deudas', '#ef4444')}
          {pctField('pctSaving', 'Ahorro', '#00a69a')}
          {pctField('pctPersonal', 'Personal', '#1771e6')}
        </div>
        {pctSum > 100 ? <p className="text-xs font-semibold text-red-600">Los porcentajes suman {pctSum} %. Deben ser máximo 100 %.</p> : pctSum < 100 && <p className="muted text-xs">{100 - pctSum} % queda sin asignar.</p>}
        <button className="btn-primary w-full" disabled={formState.isSubmitting || pctSum > 100}>Guardar</button>
      </form>
    </Modal>
  );
}

function PaymentModal({ project, onClose }: { project: FreelanceProject; onClose: () => void }) {
  const { patch, addTransaction } = useData();
  const pending = Math.max(0, project.contractValue - project.receivedTotal);
  const [amount, setAmount] = useState(pending);
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const split = splitPayment(amount, project);
  return (
    <Modal open onClose={onClose} title={`Pago de ${project.client}`}>
      <div className="space-y-4">
        <Field label="Valor recibido" hint={`Pendiente por cobrar: ${formatCOP(pending)}`}>
          <MoneyInput large autoFocus value={amount} onChange={setAmount} />
        </Field>
        <Field label="Fecha"><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
        {amount > 0 && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
            <p className="mb-1 font-semibold">Reparto sugerido según tus porcentajes</p>
            <p>Deudas: <b>{formatCOP(split.parts.deudas)}</b> · Ahorro: <b>{formatCOP(split.parts.ahorro)}</b> · Personal: <b>{formatCOP(split.parts.personal)}</b>{split.unassigned > 0 && <> · Sin asignar: <b>{formatCOP(split.unassigned)}</b></>}</p>
            <p className="muted mt-1 text-xs">Registra el abono en Deudas y el aporte en Metas para completar el reparto.</p>
          </div>
        )}
        {amount > pending && <Notice tone="amber">El valor supera lo pendiente del contrato. Verifica si es un adicional.</Notice>}
        <button
          className="btn-primary w-full"
          disabled={busy || amount <= 0}
          onClick={async () => {
            setBusy(true);
            try {
              const receivedTotal = project.receivedTotal + amount;
              await patch('freelanceProjects', project.id, { receivedTotal, ...(receivedTotal >= project.contractValue ? { status: 'pagado' as const } : {}) });
              await addTransaction({ kind: 'ingreso', amount, occurredOn: date, category: 'freelance', description: `Pago: ${project.project}`, refTable: 'freelance_projects', refId: project.id });
              toast(`+${formatCOP(amount)} de ingreso extra 💪`);
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          <HandCoins size={18} /> Registrar pago
        </button>
      </div>
    </Modal>
  );
}

export default function Freelance() {
  const { data, remove } = useData();
  const [form, setForm] = useState<{ open: boolean; editing: FreelanceProject | null }>({ open: false, editing: null });
  const [paying, setPaying] = useState<FreelanceProject | null>(null);
  const t = freelanceTotals(data.freelanceProjects);
  const projects = [...data.freelanceProjects].sort((a, b) => (a.status === 'pagado' || a.status === 'cancelado' ? 1 : 0) - (b.status === 'pagado' || b.status === 'cancelado' ? 1 : 0));

  return (
    <div>
      <PageHeader
        title="Ingresos extra"
        subtitle="Trabajos y proyectos adicionales, y cómo repartes lo que ganas"
        action={<button className="btn-primary" data-tour="freelance-add" onClick={() => setForm({ open: true, editing: null })}><Plus size={18} /> <span className="hidden sm:inline">Nuevo ingreso extra</span><span className="sm:hidden">Nuevo</span></button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Contratado" value={<Money value={t.contracted} />} />
        <Stat label="Recibido" value={<Money value={t.received} className="text-teal-600 dark:text-teal-300" />} />
        <Stat label="Por cobrar" value={<Money value={t.pending} />} />
        <Stat label="Neto estimado" value={<Money value={t.net} />} sub="Contratado − gastos" />
      </div>

      <div className="mt-5 space-y-3">
        {projects.length === 0 ? (
          <Empty title="Sin proyectos todavía" text="Registra tus trabajos o proyectos adicionales y decide qué porcentaje va a deudas, ahorro y gustos." />
        ) : (
          projects.map((p) => {
            const s = freelanceSummary(p);
            const st = STATUS[p.status];
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Briefcase size={20} /></span>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{p.project}</p>
                      <p className="muted text-xs">{p.client} · {FREELANCE_CATEGORIES[p.category]}{p.deliveryDate ? ` · entrega ${formatDate(p.deliveryDate)}` : ''}</p>
                    </div>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><p className="muted text-xs">Contratado</p><p className="amount">{formatCOP(p.contractValue)}</p></div>
                  <div><p className="muted text-xs">Recibido</p><p className="amount text-teal-600 dark:text-teal-300">{formatCOP(p.receivedTotal)}</p></div>
                  <div><p className="muted text-xs">Saldo pendiente</p><p className="amount">{formatCOP(s.pending)}</p></div>
                  <div><p className="muted text-xs">Neto estimado</p><p className="amount">{formatCOP(s.netEstimated)}</p></div>
                </div>
                <Progress value={p.contractValue ? (p.receivedTotal / p.contractValue) * 100 : 0} color="#00a69a" className="mt-3" />
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge tone="red">Deudas {p.pctDebt}% · {formatCOP(s.allocation.deudas)}</Badge>
                  <Badge tone="teal">Ahorro {p.pctSaving}% · {formatCOP(s.allocation.ahorro)}</Badge>
                  <Badge tone="blue">Personal {p.pctPersonal}% · {formatCOP(s.allocation.personal)}</Badge>
                  {p.costs > 0 && <Badge>Gastos {formatCOP(p.costs)}</Badge>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.status !== 'cancelado' && s.pending > 0 && <button className="btn-primary !py-2" onClick={() => setPaying(p)}><HandCoins size={16} /> Registrar pago</button>}
                  <button className="btn-ghost !py-2" onClick={() => setForm({ open: true, editing: p })}><Pencil size={15} /> Editar</button>
                  <ConfirmButton className="btn-ghost !py-2 text-slate-400" confirmText="Eliminar proyecto" onConfirm={() => void remove('freelanceProjects', p.id)}>
                    <Trash2 size={15} />
                  </ConfirmButton>
                </div>
              </Card>
            );
          })
        )}
      </div>
      {form.open && <ProjectForm editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />}
      {paying && <PaymentModal project={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}
