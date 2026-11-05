import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronRight, Handshake, Save, Clock } from 'lucide-react';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { Badge, Card, DataBadge, Empty, Field, Input, Money, MoneyInput, PageHeader, Progress, Select, SectionTitle, Stat } from '../components/ui';
import DebtForm from '../components/DebtForm';
import OfferAnalysisView from '../components/OfferAnalysisView';
import { debtRows, overview } from '../lib/selectors';
import { currentDaysPastDue, isActiveDebt } from '../lib/calc/debts';
import { DEBT_STATUS } from '../lib/constants';
import { formatDate, today } from '../lib/dates';
import { formatCOP } from '../lib/money';

function Negotiator() {
  const { data, add } = useData();
  const on = today();
  const o = useMemo(() => overview(data, on), [data, on]);
  const rows = debtRows(data).filter((r) => isActiveDebt(r.debt));
  const [debtId, setDebtId] = useState('');
  const [original, setOriginal] = useState(0);
  const [offer, setOffer] = useState(0);
  const [deadline, setDeadline] = useState('');
  const selected = rows.find((r) => r.debt.id === debtId);
  const base = original || selected?.summary.balance || 0;

  return (
    <Card className="p-5" data-tour="negotiator">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Handshake size={20} />
        </span>
        <div>
          <h3 className="font-bold">Negociador de deudas</h3>
          <p className="muted text-xs">Simula cualquier oferta y mira su impacto</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Deuda">
          <Select value={debtId} onChange={(e) => { setDebtId(e.target.value); setOriginal(0); }}>
            <option value="">— Elegir (o escribe un saldo) —</option>
            {rows.map((r) => (
              <option key={r.debt.id} value={r.debt.id}>{r.debt.creditor}</option>
            ))}
          </Select>
        </Field>
        <Field label="Saldo original">
          <MoneyInput value={base} onChange={setOriginal} />
        </Field>
        <Field label="Oferta recibida o hipotética">
          <MoneyInput value={offer} onChange={setOffer} />
        </Field>
        <Field label="Fecha límite (opcional)">
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      </div>
      {base > 0 && offer > 0 && (
        <div className="mt-4">
          <OfferAnalysisView original={base} offer={offer} available={o.available} monthlySurplus={Math.max(0, o.monthlyCapacity - o.debtInstallments)} deadline={deadline || null} />
          {selected && (
            <button
              className="btn-secondary mt-3 w-full"
              onClick={async () => {
                await add('debtNegotiations', { debtId: selected.debt.id, originalBalance: base, offerAmount: offer, deadline: deadline || null, kind: 'simulacion', status: 'abierta', documentPath: null, notes: null });
                toast('Simulación guardada en la deuda');
              }}
            >
              <Save size={16} /> Guardar simulación en {selected.debt.creditor}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Deudas() {
  const { data } = useData();
  const [open, setOpen] = useState(false);
  const on = today();
  const rows = debtRows(data);
  const active = rows.filter((r) => isActiveDebt(r.debt));
  const closed = rows.filter((r) => !isActiveDebt(r.debt));
  const total = active.reduce((s, r) => s + r.summary.balance, 0);
  const paid = rows.reduce((s, r) => s + r.summary.paidTotal, 0);
  const inArrears = active.filter((r) => r.debt.status === 'en_mora').length;

  const item = (r: (typeof rows)[number]) => {
    const st = DEBT_STATUS[r.debt.status];
    const dpd = currentDaysPastDue(r.debt, on);
    return (
      <Link key={r.debt.id} to={`/deudas/${r.debt.id}`} className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold">{r.debt.creditor}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone={st.tone}>{st.label}</Badge>
              {r.debt.isEstimate && <DataBadge kind="estimado" />}
              {r.debt.status === 'en_mora' && dpd > 0 && <Badge tone="red"><Clock size={11} /> {dpd} días</Badge>}
            </div>
          </div>
          <div className="text-right">
            <Money value={r.summary.balance} className="text-lg" />
            <p className="muted text-[11px]">saldo actual</p>
          </div>
        </div>
        <Progress value={r.summary.progressPct} color="#00a69a" className="mt-3" />
        <div className="muted mt-2 flex items-center justify-between text-xs">
          <span>Pagado: <b className="text-ink dark:text-white">{formatCOP(r.summary.paidTotal)}</b></span>
          <span className="flex items-center gap-1">
            {r.debt.nextPaymentDate ? `Próximo pago ${formatDate(r.debt.nextPaymentDate, false)}` : 'Sin fecha de pago'}
            <ChevronRight size={14} />
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div>
      <PageHeader
        title="Mis deudas"
        subtitle="Saldos, mora, abonos y negociaciones"
        action={
          <button className="btn-primary" onClick={() => setOpen(true)} data-tour="debts-add">
            <Plus size={18} /> <span className="hidden sm:inline">Nueva deuda</span><span className="sm:hidden">Nueva</span>
          </button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Deuda total" value={<Money value={total} />} sub={active.some((r) => r.debt.isEstimate) ? 'Incluye saldos estimados' : `${active.length} activas`} accent="#ef4444" />
        <Stat label="Total abonado" value={<Money value={paid} />} sub="Pagos registrados" accent="#00a69a" />
        <div className="col-span-2 sm:col-span-1">
          <Stat label="En mora" value={<span className="amount">{inArrears}</span>} sub={inArrears ? 'Prioriza negociar estas' : '¡Sin deudas en mora!'} accent="#f59e0b" />
        </div>
      </div>

      <SectionTitle>Activas</SectionTitle>
      {active.length ? <div className="grid gap-3 md:grid-cols-2">{active.map(item)}</div> : <Empty title="Sin deudas activas" text="Si tienes deudas, regístralas con su saldo aproximado. Marca como estimado lo que no esté confirmado por la entidad." />}

      <SectionTitle>Negociación</SectionTitle>
      <Negotiator />

      {closed.length > 0 && (
        <>
          <SectionTitle>Pagadas 🎉</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">{closed.map(item)}</div>
        </>
      )}
      <DebtForm open={open} onClose={() => setOpen(false)} editing={null} />
    </div>
  );
}
