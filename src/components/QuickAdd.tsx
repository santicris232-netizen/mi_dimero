import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { Modal, MoneyInput, Field, Input, Segmented, cx } from './ui';
import { useUI, toast } from '../store/ui';
import { useData } from '../store/data';
import { allCategories, INCOME_CATEGORIES } from '../lib/constants';
import { today } from '../lib/dates';
import { formatCOP } from '../lib/money';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');
export const money = (msg = 'Ingresa un monto mayor a $0') => z.number().int().positive(msg).max(99_999_999_999, 'Monto demasiado alto');

const schema = z.object({
  kind: z.enum(['gasto', 'ingreso']),
  amount: money(),
  category: z.string().min(1, 'Elige una categoría'),
  description: z.string().trim().max(200, 'Máximo 200 caracteres'),
  occurredOn: isoDate,
});
type Form = z.infer<typeof schema>;

export default function QuickAdd() {
  const { quickAddOpen, setQuickAdd } = useUI();
  const custom = useData((s) => s.data.expenseCategories);
  const addTransaction = useData((s) => s.addTransaction);
  const { control, handleSubmit, watch, setValue, reset, register, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'gasto', amount: 0, category: 'alimentacion', description: '', occurredOn: today() },
  });
  const kind = watch('kind');
  const category = watch('category');
  const categories = kind === 'gasto' ? allCategories(custom) : INCOME_CATEGORIES.map((c) => ({ ...c, color: '#00a69a' }));

  useEffect(() => {
    if (quickAddOpen) reset({ kind: 'gasto', amount: 0, category: 'alimentacion', description: '', occurredOn: today() });
  }, [quickAddOpen, reset]);

  const onSubmit = async (f: Form) => {
    await addTransaction({
      kind: f.kind,
      amount: f.amount,
      category: f.category,
      description: f.description || null,
      occurredOn: f.occurredOn,
      refTable: null,
      refId: null,
    });
    toast(`${f.kind === 'gasto' ? 'Gasto' : 'Ingreso'} de ${formatCOP(f.amount)} registrado`);
    setQuickAdd(false);
  };

  return (
    <Modal open={quickAddOpen} onClose={() => setQuickAdd(false)} title="Registrar movimiento">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Segmented
          className="w-full"
          value={kind}
          onChange={(v) => {
            setValue('kind', v);
            setValue('category', v === 'gasto' ? 'alimentacion' : 'salario');
          }}
          options={[
            { value: 'gasto', label: 'Gasto' },
            { value: 'ingreso', label: 'Ingreso' },
          ]}
        />
        <div>
          <span className="label">¿Cuánto?</span>
          <Controller control={control} name="amount" render={({ field }) => <MoneyInput large autoFocus value={field.value} onChange={field.onChange} invalid={!!formState.errors.amount} />} />
          {formState.errors.amount && <p className="mt-1 text-xs font-medium text-red-600">{formState.errors.amount.message}</p>}
        </div>
        <div>
          <span className="label">Categoría</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                type="button"
                key={c.slug}
                onClick={() => setValue('category', c.slug)}
                className={cx('rounded-full border px-3 py-1.5 text-[13px] font-semibold transition', category === c.slug ? 'border-transparent text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300')}
                style={category === c.slug ? { background: c.color } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Descripción (opcional)" error={formState.errors.description?.message}>
            <Input placeholder={kind === 'gasto' ? 'Ej: mercado' : 'Ej: pago quincena'} {...register('description')} />
          </Field>
          <Field label="Fecha" error={formState.errors.occurredOn?.message}>
            <Input type="date" max="2100-12-31" {...register('occurredOn')} />
          </Field>
        </div>
        <button className={cx('w-full !py-3.5 text-base', kind === 'gasto' ? 'btn-primary' : 'btn bg-teal text-white')} disabled={formState.isSubmitting}>
          Guardar {kind}
        </button>
      </form>
    </Modal>
  );
}
