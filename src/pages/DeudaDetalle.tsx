import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, FileText, Upload, RefreshCw, CheckCircle2, XCircle, Award, Clock, Paperclip } from 'lucide-react';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { Badge, Card, ConfirmButton, DataBadge, Field, Input, Modal, Money, MoneyInput, Notice, Progress, Segmented, SectionTitle } from '../components/ui';
import DebtForm from '../components/DebtForm';
import OfferAnalysisView from '../components/OfferAnalysisView';
import { canMarkPaid, canMarkPazYSalvo, currentDaysPastDue, debtSummary } from '../lib/calc/debts';
import { overview } from '../lib/selectors';
import { DEBT_STATUS, DEBT_TYPE } from '../lib/constants';
import { formatDate, today } from '../lib/dates';
import { formatCOP, formatPct, percent } from '../lib/money';
import { ALLOWED_FILE_TYPES } from '../data/repo';
import type { DebtNegotiation, DebtStatus } from '../types';

function useOpenFile() {
  const repo = useData((s) => s.repo);
  return async (path: string) => {
    try {
      const url = await repo!.fileUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
}

function FilePicker({ file, onChange, label = 'Adjuntar comprobante (PDF o imagen, máx. 5 MB)' }: { file: File | null; onChange: (f: File | null) => void; label?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm transition hover:border-brand dark:border-white/15">
      <Paperclip size={18} className="text-slate-400" />
      <span className="min-w-0 flex-1 truncate">{file ? file.name : label}</span>
      <input type="file" className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  );
}

function PaymentModal({ debtId, open, onClose }: { debtId: string; open: boolean; onClose: () => void }) {
  const addDebtPayment = useData((s) => s.addDebtPayment);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Registrar abono">
      <div className="space-y-4">
        <Field label="Valor abonado">
          <MoneyInput autoFocus value={amount} onChange={setAmount} />
        </Field>
        <Field label="Fecha del pago">
          <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Nota (opcional)">
          <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ej: pago por PSE, referencia 123" />
        </Field>
        <FilePicker file={file} onChange={setFile} />
        <button
          className="btn-primary w-full"
          disabled={busy || amount <= 0 || !date}
          onClick={async () => {
            setBusy(true);
            try {
              await addDebtPayment({ debtId, amount, paidOn: date, note: note || null, file });
              toast(`Abono de ${formatCOP(amount)} registrado`);
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          Registrar abono
        </button>
      </div>
    </Modal>
  );
}

function BalanceModal({ debtId, current, open, onClose }: { debtId: string; current: number; open: boolean; onClose: () => void }) {
  const patch = useData((s) => s.patch);
  const [value, setValue] = useState(current);
  const [date, setDate] = useState(today());
  const [confirmed, setConfirmed] = useState(true);
  return (
    <Modal open={open} onClose={onClose} title="Actualizar saldo">
      <div className="space-y-4">
        <Notice>Usa esto cuando la entidad te informe un saldo nuevo (extracto, llamada, app). Los abonos que registres desde esa fecha se descontarán de este valor.</Notice>
        <Field label="Saldo informado">
          <MoneyInput value={value} onChange={setValue} />
        </Field>
        <Field label="Fecha del saldo">
          <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-4 w-4 accent-brand" />
          Este saldo fue confirmado por la entidad
        </label>
        <button
          className="btn-primary w-full"
          onClick={async () => {
            await patch('debts', debtId, { updatedBalance: value, balanceUpdatedOn: date, isEstimate: !confirmed });
            toast('Saldo actualizado');
            onClose();
          }}
        >
          Guardar saldo
        </button>
      </div>
    </Modal>
  );
}

function NegotiationModal({ debtId, balance, open, onClose }: { debtId: string; balance: number; open: boolean; onClose: () => void }) {
  const { add, uploadFile } = useData();
  const [kind, setKind] = useState<DebtNegotiation['kind']>('simulacion');
  const [original, setOriginal] = useState(balance);
  const [offer, setOffer] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Nueva negociación" wide>
      <div className="space-y-4">
        <Segmented className="w-full" value={kind} onChange={setKind} options={[{ value: 'simulacion', label: 'Simulación' }, { value: 'oferta_real', label: 'Oferta real del acreedor' }]} />
        {kind === 'oferta_real' && <Notice tone="amber">Registra solo ofertas que la entidad te haya hecho. Adjunta el documento o correo si lo tienes.</Notice>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Saldo original">
            <MoneyInput value={original} onChange={setOriginal} />
          </Field>
          <Field label="Oferta">
            <MoneyInput value={offer} onChange={setOffer} />
          </Field>
          <Field label="Fecha límite">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>
        <Field label="Notas">
          <Input value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: asesor, número de radicado, condiciones" />
        </Field>
        <FilePicker file={file} onChange={setFile} label="Adjuntar acuerdo o documento (opcional)" />
        <button
          className="btn-primary w-full"
          disabled={busy || offer <= 0 || original <= 0}
          onClick={async () => {
            setBusy(true);
            try {
              const documentPath = file ? await uploadFile(file) : null;
              await add('debtNegotiations', { debtId, originalBalance: original, offerAmount: offer, deadline: deadline || null, kind, status: 'abierta', documentPath, notes: notes || null });
              toast(kind === 'simulacion' ? 'Simulación guardada' : 'Oferta registrada');
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}

export default function DeudaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, patch, remove, removeDebtPayment, uploadFile } = useData();
  const openFile = useOpenFile();
  const on = today();
  const o = useMemo(() => overview(data, on), [data, on]);
  const debt = data.debts.find((d) => d.id === id);
  const [modal, setModal] = useState<'edit' | 'pay' | 'balance' | 'neg' | null>(null);

  if (!debt)
    return (
      <div className="py-20 text-center">
        <p className="muted">Esta deuda no existe.</p>
        <Link to="/deudas" className="btn-secondary mt-4">Volver</Link>
      </div>
    );

  const s = debtSummary(debt, data.debtPayments, data.debtNegotiations);
  const st = DEBT_STATUS[debt.status];
  const payments = data.debtPayments.filter((p) => p.debtId === debt.id).sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  const negotiations = data.debtNegotiations.filter((n) => n.debtId === debt.id).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const paidCheck = canMarkPaid(s);
  const pazCheck = canMarkPazYSalvo(debt, s);
  const dpd = currentDaysPastDue(debt, on);

  const setStatus = async (status: DebtStatus) => {
    await patch('debts', debt.id, { status, ...(status !== 'en_mora' && debt.status === 'en_mora' ? { daysPastDue: dpd, daysPastDueOn: null } : {}) });
    toast(`Estado: ${DEBT_STATUS[status].label}`);
  };

  return (
    <div>
      <button onClick={() => navigate('/deudas')} className="btn-ghost -ml-3 mb-2">
        <ArrowLeft size={18} /> Deudas
      </button>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{debt.creditor}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={st.tone}>{st.label}</Badge>
            <Badge>{DEBT_TYPE[debt.debtType]}</Badge>
            {debt.isEstimate ? <DataBadge kind="estimado" /> : <DataBadge kind="confirmado" />}
            {debt.status === 'en_mora' && <Badge tone="red"><Clock size={11} /> {dpd} días de mora</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary !p-2.5" onClick={() => setModal('edit')} aria-label="Editar"><Pencil size={17} /></button>
          <ConfirmButton className="btn-secondary !p-2.5 text-red-600" confirmText="Eliminar deuda" onConfirm={async () => { await remove('debts', debt.id); for (const t of data.transactions.filter((t) => t.refTable === 'debt_payments' && payments.some((p) => p.id === t.refId))) await remove('transactions', t.id); navigate('/deudas'); }}>
            <Trash2 size={17} />
          </ConfirmButton>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="muted text-sm">Saldo actual según tus registros</p>
            <Money value={s.balance} className="text-3xl" />
            {s.agreement && <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">Acuerdo aceptado por {formatCOP(s.agreement.offerAmount)} (ahorro de {formatCOP(s.agreement.originalBalance - s.agreement.offerAmount)})</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setModal('pay')}><Plus size={17} /> Registrar abono</button>
            <button className="btn-secondary" onClick={() => setModal('balance')}><RefreshCw size={16} /> Actualizar saldo</button>
          </div>
        </div>
        <Progress value={s.progressPct} color="#00a69a" className="mt-4" />
        <p className="muted mt-1.5 text-xs">{formatPct(s.progressPct)} pagado de {formatCOP(s.base)}{s.baseDate ? ` (referencia del ${formatDate(s.baseDate)})` : ''}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ['Saldo inicial', formatCOP(debt.initialBalance)],
            ['Saldo actualizado', debt.updatedBalance != null ? `${formatCOP(debt.updatedBalance)} · ${formatDate(debt.balanceUpdatedOn)}` : '—'],
            ['Pago mínimo', debt.minimumPayment ? formatCOP(debt.minimumPayment) : '—'],
            ['Cuota negociada', debt.negotiatedPayment ? formatCOP(debt.negotiatedPayment) : '—'],
            ['Próximo pago', formatDate(debt.nextPaymentDate)],
            ['Vencimiento', formatDate(debt.dueDate)],
            ['Tasa EA', debt.interestRateEa != null ? `${String(debt.interestRateEa).replace('.', ',')} %` : 'No registrada'],
            ['Total abonado', formatCOP(s.paidTotal)],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="muted text-xs">{l}</p>
              <p className="font-semibold">{v}</p>
            </div>
          ))}
        </div>
        {debt.objective && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5"><b>Objetivo:</b> {debt.objective}</p>}
        {debt.notes && <p className="muted mt-2 whitespace-pre-wrap text-sm">{debt.notes}</p>}
      </Card>

      <SectionTitle>Estado de negociación</SectionTitle>
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {(['pendiente', 'en_mora', 'en_negociacion', 'acuerdo_confirmado', 'en_proceso_pago'] as DebtStatus[]).map((k) => (
            <button key={k} onClick={() => void setStatus(k)} className={debt.status === k ? 'btn-primary !py-1.5 text-xs' : 'btn-secondary !py-1.5 text-xs'}>
              {DEBT_STATUS[k].label}
            </button>
          ))}
          <button disabled={!paidCheck.ok || debt.status === 'pagada'} onClick={() => void setStatus('pagada')} className={debt.status === 'pagada' ? 'btn bg-emerald-600 !py-1.5 text-xs text-white' : 'btn-secondary !py-1.5 text-xs'}>
            <CheckCircle2 size={14} /> Pagada
          </button>
          <button disabled={!pazCheck.ok && debt.status !== 'paz_y_salvo'} onClick={() => void setStatus('paz_y_salvo')} className={debt.status === 'paz_y_salvo' ? 'btn bg-emerald-600 !py-1.5 text-xs text-white' : 'btn-secondary !py-1.5 text-xs'}>
            <Award size={14} /> Paz y salvo confirmado
          </button>
        </div>
        {!paidCheck.ok && <p className="muted mt-3 text-xs">Para marcarla como pagada: {paidCheck.reason}</p>}
        {paidCheck.ok && !pazCheck.ok && debt.status !== 'paz_y_salvo' && <p className="muted mt-3 text-xs">Paz y salvo: {pazCheck.reason} Pide el certificado a la entidad y adjúntalo como documento.</p>}
      </Card>

      <SectionTitle>Historial de abonos</SectionTitle>
      {payments.length === 0 ? (
        <p className="muted text-sm">Aún no hay abonos registrados.</p>
      ) : (
        <Card className="divide-y divide-slate-100 dark:divide-white/5">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{formatDate(p.paidOn)}</p>
                {p.note && <p className="muted truncate text-xs">{p.note}</p>}
              </div>
              {p.receiptPath ? (
                <button className="btn-ghost !p-2 text-brand" onClick={() => void openFile(p.receiptPath!)} aria-label="Ver comprobante" title="Ver comprobante">
                  <FileText size={17} />
                </button>
              ) : (
                <label className="btn-ghost cursor-pointer !p-2 text-slate-400" title="Adjuntar comprobante">
                  <Upload size={16} />
                  <input type="file" className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const path = await uploadFile(f); await patch('debtPayments', p.id, { receiptPath: path }); toast('Comprobante adjuntado'); } }} />
                </label>
              )}
              <Money value={p.amount} />
              <ConfirmButton className="btn-ghost !p-2 text-slate-400" confirmText="Borrar" onConfirm={() => void removeDebtPayment(p.id)}>
                <Trash2 size={16} />
              </ConfirmButton>
            </div>
          ))}
        </Card>
      )}

      <SectionTitle action={<button className="btn-secondary !py-1.5 text-xs" onClick={() => setModal('neg')}><Plus size={14} /> Nueva</button>}>Negociaciones y acuerdos</SectionTitle>
      {negotiations.length === 0 ? (
        <p className="muted text-sm">Simula ofertas de liquidación o registra las ofertas reales que te haga la entidad.</p>
      ) : (
        <div className="space-y-3">
          {negotiations.map((n) => (
            <Card key={n.id} className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {n.kind === 'simulacion' ? <DataBadge kind="hipotetico" /> : <Badge tone="blue">Oferta real</Badge>}
                  {n.status === 'aceptada' && <Badge tone="green">Aceptada</Badge>}
                  {n.status === 'rechazada' && <Badge tone="red">Rechazada</Badge>}
                  <span className="muted text-xs">Registrada {formatDate((n.createdAt ?? on).slice(0, 10))} · {formatPct(percent(n.originalBalance - n.offerAmount, n.originalBalance))} de descuento</span>
                </div>
                <div className="flex items-center gap-1">
                  {n.documentPath && (
                    <button className="btn-ghost !p-2 text-brand" onClick={() => void openFile(n.documentPath!)} title="Ver documento"><FileText size={16} /></button>
                  )}
                  {n.kind === 'oferta_real' && n.status === 'abierta' && (
                    <>
                      <button className="btn-secondary !py-1.5 text-xs" onClick={async () => { await patch('debtNegotiations', n.id, { status: 'aceptada' }); await patch('debts', debt.id, { status: 'acuerdo_confirmado' }); toast('Acuerdo aceptado. Registra los pagos para completarlo.'); }}>
                        <CheckCircle2 size={14} /> Aceptar
                      </button>
                      <button className="btn-ghost !py-1.5 text-xs" onClick={() => void patch('debtNegotiations', n.id, { status: 'rechazada' })}>
                        <XCircle size={14} /> Rechazar
                      </button>
                    </>
                  )}
                  <ConfirmButton className="btn-ghost !p-2 text-slate-400" confirmText="Borrar" onConfirm={() => void remove('debtNegotiations', n.id)}>
                    <Trash2 size={16} />
                  </ConfirmButton>
                </div>
              </div>
              <OfferAnalysisView original={n.originalBalance} offer={n.offerAmount} available={o.available} monthlySurplus={Math.max(0, o.monthlyCapacity - o.debtInstallments)} deadline={n.deadline} />
              {n.notes && <p className="muted mt-2 text-sm">{n.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      <DebtForm open={modal === 'edit'} onClose={() => setModal(null)} editing={debt} />
      {modal === 'pay' && <PaymentModal debtId={debt.id} open onClose={() => setModal(null)} />}
      {modal === 'balance' && <BalanceModal debtId={debt.id} current={s.balance} open onClose={() => setModal(null)} />}
      {modal === 'neg' && <NegotiationModal debtId={debt.id} balance={s.balance} open onClose={() => setModal(null)} />}
    </div>
  );
}
