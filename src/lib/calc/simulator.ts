// Fase 7 / Simulador: proyección de pago de deudas bajo distintos escenarios.
// No inventa tasas: solo aplica interés a deudas cuya tasa EA fue ingresada por el usuario.

export interface SimDebt {
  id: string;
  name: string;
  balance: number;
  rateEA: number | null;
  estimate: boolean;
}

export interface Scenario {
  name: string;
  monthlyPayment: number; // dinero mensual destinado a deudas
  extraMonthly?: number; // ingreso adicional mensual (freelance, etc.) destinado a deudas
  lumpSum?: number; // pago único (p. ej. prima) — hipotético
  lumpMonth?: number; // mes en que llega el pago único (1 = próximo mes)
  discount?: { debtId: string; pct: number } | null; // descuento hipotético sobre una deuda
}

export interface SimResult {
  name: string;
  months: number | null; // null = no se termina de pagar en el horizonte
  totalPaid: number;
  totalInterest: number;
  savedByDiscount: number;
  series: number[]; // saldo total al final de cada mes (índice 0 = hoy)
  order: string[];
  interestUnknown: boolean;
}

const monthlyRate = (ea: number) => Math.pow(1 + ea / 100, 1 / 12) - 1;

export function simulatePayoff(debts: SimDebt[], scenario: Scenario, horizon = 120): SimResult {
  const state = debts.filter((d) => d.balance > 0).map((d) => ({ ...d }));
  let savedByDiscount = 0;
  if (scenario.discount) {
    const t = state.find((d) => d.id === scenario.discount!.debtId);
    if (t) {
      const cut = Math.round((t.balance * Math.min(100, Math.max(0, scenario.discount.pct))) / 100);
      t.balance -= cut;
      savedByDiscount = cut;
    }
  }
  // Orden: con tasa conocida, mayor tasa primero (avalancha); el resto, menor saldo primero (bola de nieve).
  const sorted = () =>
    state
      .filter((d) => d.balance > 0)
      .sort((a, b) => (b.rateEA ?? -1) - (a.rateEA ?? -1) || a.balance - b.balance);

  const series = [state.reduce((s, d) => s + d.balance, 0)];
  const order: string[] = [];
  let totalPaid = 0;
  let totalInterest = 0;
  let month = 0;

  while (series[series.length - 1] > 0 && month < horizon) {
    month += 1;
    for (const d of state) {
      if (d.balance > 0 && d.rateEA) {
        const i = Math.round(d.balance * monthlyRate(d.rateEA));
        d.balance += i;
        totalInterest += i;
      }
    }
    let budget = scenario.monthlyPayment + (scenario.extraMonthly ?? 0);
    if (scenario.lumpSum && (scenario.lumpMonth ?? 1) === month) budget += scenario.lumpSum;
    for (const d of sorted()) {
      if (budget <= 0) break;
      const pay = Math.min(budget, d.balance);
      d.balance -= pay;
      budget -= pay;
      totalPaid += pay;
      if (d.balance === 0) order.push(d.name);
    }
    const total = state.reduce((s, d) => s + d.balance, 0);
    series.push(total);
    // Si el saldo no baja en un año completo, nunca terminará.
    if (month >= 12 && total >= series[month - 12]) break;
  }
  const done = series[series.length - 1] === 0;
  return {
    name: scenario.name,
    months: done ? month : null,
    totalPaid,
    totalInterest,
    savedByDiscount,
    series,
    order,
    interestUnknown: state.some((d) => d.rateEA == null),
  };
}
