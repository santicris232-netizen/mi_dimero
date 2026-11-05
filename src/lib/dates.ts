import type { ISODate } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = (): ISODate => toISO(new Date());

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Suma meses conservando el día cuando existe (31 ene + 1 mes = 28/29 feb). */
export function addMonths(iso: ISODate, months: number): ISODate {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

/** Días entre a y b (b - a), con fechas de calendario. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

/** Meses completos de calendario que faltan desde `from` hasta `to` (0 si ya pasó). */
export function monthsBetween(from: ISODate, to: ISODate): number {
  const a = fromISO(from);
  const b = fromISO(to);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

export const monthKey = (iso: ISODate) => iso.slice(0, 7);
export const firstOfMonth = (iso: ISODate): ISODate => `${iso.slice(0, 7)}-01`;
export const lastDayOfMonth = (iso: ISODate) => {
  const d = fromISO(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};
/** Quincena de una fecha: 1 (días 1-15) o 2 (16-fin de mes). */
export const halfOf = (iso: ISODate): 1 | 2 => (fromISO(iso).getDate() <= 15 ? 1 : 2);

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function formatDate(iso: ISODate | null | undefined, withYear = true): string {
  if (!iso) return '—';
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}
export function formatMonth(iso: ISODate, long = false): string {
  const d = fromISO(iso.length === 7 ? `${iso}-01` : iso);
  return `${(long ? MONTHS_LONG : MONTHS)[d.getMonth()]} ${long ? d.getFullYear() : String(d.getFullYear()).slice(2)}`;
}
