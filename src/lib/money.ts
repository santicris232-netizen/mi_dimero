// Utilidades monetarias. COP se maneja siempre como entero (pesos), nunca con flotantes acumulados.

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 3340000 -> "$3.340.000"; -5000 -> "-$5.000" */
export function formatCOP(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const n = Math.round(value);
  const sign = n < 0 ? '-' : '';
  return `${sign}$${group(String(Math.abs(n)))}`;
}

/** Formato compacto para ejes de gráficas: 1.250.000 -> "$1,3 M" */
export function formatCOPShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace('.', ',').replace(/,0$/, '')} M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)} mil`;
  return formatCOP(value);
}

/** Convierte texto del usuario a entero COP: "$1.700.000" -> 1700000. Ignora decimales. */
export function parseCOP(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : 0;
  if (!input) return 0;
  const negative = input.trim().startsWith('-');
  const clean = input.split(',')[0].replace(/\D/g, '');
  const n = clean ? parseInt(clean, 10) : 0;
  return negative ? -n : n;
}

/** Agrupa miles mientras se escribe: "1700000" -> "1.700.000" */
export function groupInput(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits ? group(digits) : '';
}

/** Porcentaje con 2 decimales exactos (redondeo half-up). */
export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 10000) / 100;
}

/** 33.33 -> "33,33 %" */
export function formatPct(value: number, decimals = 2): string {
  const fixed = value.toFixed(decimals).replace('.', ',');
  return `${decimals > 0 ? fixed.replace(/,?0+$/, '') || '0' : fixed} %`;
}

export const sum = (values: number[]) => values.reduce((a, b) => a + Math.round(b), 0);

/**
 * Reparte un entero según porcentajes. Cada parte se redondea hacia abajo y
 * lo que sobra por redondeo queda en `unassigned` para que la suma sea exacta.
 */
export function splitByPercent<K extends string>(total: number, pcts: Record<K, number>) {
  const parts = {} as Record<K, number>;
  let used = 0;
  for (const key of Object.keys(pcts) as K[]) {
    const v = Math.floor((total * pcts[key]) / 100);
    parts[key] = v;
    used += v;
  }
  return { parts, unassigned: total - used };
}
