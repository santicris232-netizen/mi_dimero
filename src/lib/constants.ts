import type { Bucket, DebtStatus, DebtType, ExpenseCategory, FreelanceCategory, IncomeSchedule } from '../types';

export const BASE_CATEGORIES = [
  { slug: 'vivienda', label: 'Vivienda', color: '#1771e6' },
  { slug: 'alimentacion', label: 'Alimentación', color: '#00a69a' },
  { slug: 'transporte', label: 'Transporte', color: '#f59e0b' },
  { slug: 'servicios', label: 'Servicios', color: '#8b5cf6' },
  { slug: 'mascotas', label: 'Mascotas', color: '#ec4899' },
  { slug: 'suscripciones', label: 'Suscripciones', color: '#ef4444' },
  { slug: 'herramientas_trabajo', label: 'Herramientas de trabajo', color: '#0ea5e9' },
  { slug: 'entretenimiento', label: 'Entretenimiento', color: '#f97316' },
  { slug: 'compras_personales', label: 'Compras personales', color: '#14b8a6' },
  { slug: 'otros', label: 'Otros', color: '#64748b' },
] as const;

const EXTRA_COLORS = ['#a855f7', '#22c55e', '#e11d48', '#0891b2', '#ca8a04', '#7c3aed'];

export function allCategories(custom: ExpenseCategory[]) {
  return [
    ...BASE_CATEGORIES.map((c) => ({ ...c })),
    ...custom.map((c, i) => ({ slug: c.slug, label: c.name, color: EXTRA_COLORS[i % EXTRA_COLORS.length] })),
  ];
}

const SPECIAL: Record<string, string> = {
  deudas: 'Pago de deudas',
  ahorro: 'Ahorro',
  salario: 'Salario',
  freelance: 'Freelance',
  ingreso_extra: 'Ingreso extra',
  prima: 'Prima',
};

export function categoryLabel(slug: string, custom: ExpenseCategory[] = []): string {
  return SPECIAL[slug] ?? allCategories(custom).find((c) => c.slug === slug)?.label ?? slug;
}
export function categoryColor(slug: string, custom: ExpenseCategory[] = []): string {
  return allCategories(custom).find((c) => c.slug === slug)?.color ?? '#64748b';
}

export const INCOME_CATEGORIES = [
  { slug: 'salario', label: 'Salario' },
  { slug: 'freelance', label: 'Freelance' },
  { slug: 'prima', label: 'Prima' },
  { slug: 'ingreso_extra', label: 'Ingreso extra' },
];

export const SCHEDULE_LABEL: Record<IncomeSchedule, string> = {
  q1: '1.ª quincena',
  q2: '2.ª quincena',
  mensual: 'Mensual',
  extraordinario: 'Extraordinario',
};

export const DEBT_STATUS: Record<DebtStatus, { label: string; tone: 'red' | 'amber' | 'blue' | 'teal' | 'green' | 'slate' }> = {
  pendiente: { label: 'Pendiente', tone: 'slate' },
  en_mora: { label: 'En mora', tone: 'red' },
  en_negociacion: { label: 'En negociación', tone: 'amber' },
  acuerdo_confirmado: { label: 'Acuerdo confirmado', tone: 'blue' },
  en_proceso_pago: { label: 'En proceso de pago', tone: 'teal' },
  pagada: { label: 'Pagada', tone: 'green' },
  paz_y_salvo: { label: 'Paz y salvo confirmado', tone: 'green' },
};

export const DEBT_TYPE: Record<DebtType, string> = {
  financiera: 'Entidad financiera',
  familiar: 'Familiar / personal',
  servicio: 'Servicio',
  otra: 'Otra',
};

export const BUCKET_INFO: Record<Bucket, { label: string; color: string; hint: string }> = {
  obligatorios: { label: 'Gastos obligatorios', color: '#1771e6', hint: 'Arriendo, servicios, comida, transporte…' },
  deudas: { label: 'Pago de deudas', color: '#ef4444', hint: 'Cuotas y abonos extra' },
  personales: { label: 'Gastos personales', color: '#14b8a6', hint: 'Tus gustos planeados, sin culpa' },
  emergencia: { label: 'Fondo de emergencia', color: '#f59e0b', hint: 'Tu colchón para imprevistos' },
  moto: { label: 'Ahorro meta', color: '#8b5cf6', hint: 'Tu moto u otra meta' },
};

export const FREELANCE_CATEGORIES: Record<FreelanceCategory, string> = {
  desarrollo_web: 'Desarrollo web',
  automatizaciones: 'Automatizaciones',
  bases_de_datos: 'Bases de datos',
  desarrollo_software: 'Desarrollo de software',
  mantenimiento: 'Mantenimiento',
  otros: 'Otros',
};
