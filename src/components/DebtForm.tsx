import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field, Input, Modal, MoneyInput, Notice, Select, Toggle } from './ui';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { DEBT_STATUS, DEBT_TYPE } from '../lib/constants';
import { today } from '../lib/dates';
import type { Debt } from '../types';

const optDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha inválida');
const schema = z.object({
  creditor: z.string().trim().min(1, 'Escribe el acreedor').max(80),
  debtType: z.enum(['financiera', 'familiar', 'servicio', 'otra']),
  initialBalance: z.number().int().min(1, 'Ingresa el saldo').max(99_999_999_999),
  isEstimate: z.boolean(),
  status: z.enum(['pendiente', 'en_mora', 'en_negociacion', 'acuerdo_confirmado', 'en_proceso_pago']),
  daysPastDue: z.number().int().min(0).max(36500),
  dueDate: optDate,
  interestRateEa: z.number().min(0).max(200).nullable(),
  minimumPayment: z.number().int().min(0).nullable(),
  negotiatedPayment: z.number().int().min(0).nullable(),
  nextPaymentDate: optDate,
  objective: z.string().max(300),
  notes: z.string().max(1000),
});
type Form = z.infer<typeof schema>;

export default function DebtForm({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Debt | null }) {
  const { add, patch } = useData();
  const editableStatus = editing && (editing.status === 'pagada' || editing.status === 'paz_y_salvo') ? 'en_proceso_pago' : editing?.status;
  const { register, control, handleSubmit, watch, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    values: editing
      ? {
          creditor: editing.creditor,
          debtType: editing.debtType,
          initialBalance: editing.initialBalance,
          isEstimate: editing.isEstimate,
          status: editableStatus as Form['status'],
          daysPastDue: editing.daysPastDue,
          dueDate: editing.dueDate ?? '',
          interestRateEa: editing.interestRateEa,
          minimumPayment: editing.minimumPayment,
          negotiatedPayment: editing.negotiatedPayment,
          nextPaymentDate: editing.nextPaymentDate ?? '',
          objective: editing.objective ?? '',
          notes: editing.notes ?? '',
        }
      : { creditor: '', debtType: 'financiera', initialBalance: 0, isEstimate: true, status: 'pendiente', daysPastDue: 0, dueDate: '', interestRateEa: null, minimumPayment: null, negotiatedPayment: null, nextPaymentDate: '', objective: '', notes: '' },
  });
  const status = watch('status');

  const submit = async (v: Form) => {
    const row = {
      ...v,
      dueDate: v.dueDate || null,
      nextPaymentDate: v.nextPaymentDate || null,
      objective: v.objective || null,
      notes: v.notes || null,
      minimumPayment: v.minimumPayment || null,
      negotiatedPayment: v.negotiatedPayment || null,
      daysPastDue: v.status === 'en_mora' ? v.daysPastDue : 0,
      daysPastDueOn: v.status === 'en_mora' ? (editing?.daysPastDue === v.daysPastDue && editing.daysPastDueOn ? editing.daysPastDueOn : today()) : null,
    };
    if (editing) {
      await patch('debts', editing.id, editing.status === 'pagada' || editing.status === 'paz_y_salvo' ? { ...row, status: editing.status } : row);
      toast('Deuda actualizada');
    } else {
      await add('debts', { ...row, updatedBalance: null, balanceUpdatedOn: null });
      toast('Deuda registrada');
    }
    onClose();
  };

  const num = (v: string) => (v === '' ? null : Number(v.replace(',', '.')));

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar deuda' : 'Nueva deuda'} wide>
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Acreedor" error={formState.errors.creditor?.message}>
            <Input placeholder="Ej: Banco, tienda, familiar" {...register('creditor')} />
          </Field>
          <Field label="Tipo">
            <Select {...register('debtType')}>
              {Object.entries(DEBT_TYPE).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Saldo inicial" error={formState.errors.initialBalance?.message}>
          <Controller control={control} name="initialBalance" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
        </Field>
        <Controller control={control} name="isEstimate" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Saldo estimado" hint="Actívalo si la entidad aún no te ha confirmado el valor exacto" />} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Estado">
            <Select {...register('status')}>
              {Object.entries(DEBT_STATUS)
                .filter(([k]) => k !== 'pagada' && k !== 'paz_y_salvo')
                .map(([k, s]) => (
                  <option key={k} value={k}>{s.label}</option>
                ))}
            </Select>
          </Field>
          {status === 'en_mora' && (
            <Field label="Días de mora (hoy)" hint="Se actualizan solos cada día">
              <Input type="number" min={0} inputMode="numeric" {...register('daysPastDue', { valueAsNumber: true })} />
            </Field>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pago mínimo (opcional)">
            <Controller control={control} name="minimumPayment" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
          </Field>
          <Field label="Cuota negociada (opcional)">
            <Controller control={control} name="negotiatedPayment" render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />} />
          </Field>
          <Field label="Fecha del próximo pago">
            <Input type="date" {...register('nextPaymentDate')} />
          </Field>
          <Field label="Fecha de vencimiento">
            <Input type="date" {...register('dueDate')} />
          </Field>
        </div>
        <Field label="Tasa de interés efectiva anual (%)" hint="Solo si la conoces. No se asume ninguna tasa." error={formState.errors.interestRateEa?.message}>
          <Input type="text" inputMode="decimal" placeholder="Ej: 28,5" {...register('interestRateEa', { setValueAs: (v) => (typeof v === 'number' ? v : num(String(v ?? ''))) })} />
        </Field>
        <Field label="Objetivo">
          <Input placeholder="Ej: Negociar liquidación total con descuento" {...register('objective')} />
        </Field>
        <Field label="Observaciones">
          <textarea className="input min-h-20" {...register('notes')} />
        </Field>
        <Notice tone="amber">Nunca registres aquí contraseñas ni claves de tus bancos.</Notice>
        <button className="btn-primary w-full" disabled={formState.isSubmitting}>Guardar</button>
      </form>
    </Modal>
  );
}
