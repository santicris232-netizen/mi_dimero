// Entidades del dominio. Los nombres de campo son camelCase de las columnas SQL (snake_case).
// Montos: enteros en pesos colombianos (COP), sin decimales.

export type ISODate = string; // 'YYYY-MM-DD'

export interface Profile {
  id: string;
  displayName: string;
  currency: 'COP';
  theme: 'system' | 'light' | 'dark';
  tutorialDone: boolean;
  onboarded: boolean;
  waitRuleHours: number;
  createdAt?: string;
  updatedAt?: string;
}

interface Row {
  id: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type IncomeSchedule = 'q1' | 'q2' | 'mensual' | 'extraordinario';
export type IncomeStatus = 'estimado' | 'confirmado' | 'recibido';
export interface Income extends Row {
  name: string;
  amount: number;
  schedule: IncomeSchedule;
  expectedOn: ISODate | null;
  status: IncomeStatus;
  notes: string | null;
}

export interface ExpenseCategory extends Row {
  slug: string;
  name: string;
}

export interface Expense extends Row {
  name: string;
  category: string;
  amount: number;
  amountMin: number | null;
  amountMax: number | null;
  isVariable: boolean;
  isEstimate: boolean;
  dueDay: number | null;
  active: boolean;
}

export type DebtStatus =
  | 'pendiente'
  | 'en_mora'
  | 'en_negociacion'
  | 'acuerdo_confirmado'
  | 'en_proceso_pago'
  | 'pagada'
  | 'paz_y_salvo';
export type DebtType = 'financiera' | 'familiar' | 'servicio' | 'otra';

export interface Debt extends Row {
  creditor: string;
  debtType: DebtType;
  initialBalance: number;
  updatedBalance: number | null;
  balanceUpdatedOn: ISODate | null;
  isEstimate: boolean;
  dueDate: ISODate | null;
  daysPastDue: number;
  daysPastDueOn: ISODate | null;
  interestRateEa: number | null;
  minimumPayment: number | null;
  negotiatedPayment: number | null;
  status: DebtStatus;
  nextPaymentDate: ISODate | null;
  objective: string | null;
  notes: string | null;
}

export interface DebtPayment extends Row {
  debtId: string;
  amount: number;
  paidOn: ISODate;
  note: string | null;
  receiptPath: string | null;
}

export interface DebtNegotiation extends Row {
  debtId: string;
  originalBalance: number;
  offerAmount: number;
  deadline: ISODate | null;
  kind: 'simulacion' | 'oferta_real';
  status: 'abierta' | 'aceptada' | 'rechazada' | 'vencida';
  documentPath: string | null;
  notes: string | null;
}

export interface MotoDetails {
  brand?: string;
  model?: string;
  price?: number;
  downPayment?: number;
  matricula?: number;
  soat?: number;
  proteccion?: number;
  impuestos?: number;
  mantenimientoMensual?: number;
  combustibleMensual?: number;
  plan?: 'contado' | 'financiado';
}

export interface SavingsGoal extends Row {
  name: string;
  kind: 'moto' | 'emergencia' | 'otro';
  targetAmount: number;
  targetDate: ISODate | null;
  initialSaved: number;
  monthlyContribution: number;
  details: MotoDetails;
  achievedOn: ISODate | null;
}

export interface SavingsContribution extends Row {
  goalId: string;
  amount: number; // negativo = retiro
  contributedOn: ISODate;
  note: string | null;
}

export type Bucket = 'obligatorios' | 'deudas' | 'personales' | 'emergencia' | 'moto';

export interface Budget extends Row {
  period: ISODate; // primer día del mes
  half: 1 | 2;
  receivedAmount: number;
  receivedOn: ISODate | null;
  executed: boolean;
}

export interface BudgetAllocation extends Row {
  budgetId: string;
  bucket: Bucket;
  amount: number;
  debtId: string | null;
  goalId: string | null;
  note: string | null;
}

export type PurchaseStatus = 'esperando' | 'lista' | 'comprada' | 'pospuesta' | 'cancelada';
export interface PurchaseDecision extends Row {
  product: string;
  price: number;
  category: string;
  reason: string | null;
  priority: 'alta' | 'media' | 'baja';
  decidedOn: ISODate;
  nature: 'necesidad' | 'gusto';
  inBudget: boolean | null;
  affectsDebt: boolean | null;
  affectsSaving: boolean | null;
  waitUntil: string | null;
  status: PurchaseStatus;
  resolvedAt: string | null;
}

export type FreelanceCategory =
  | 'desarrollo_web'
  | 'automatizaciones'
  | 'bases_de_datos'
  | 'desarrollo_software'
  | 'mantenimiento'
  | 'otros';

export interface FreelanceProject extends Row {
  client: string;
  project: string;
  category: FreelanceCategory;
  contractValue: number;
  advance: number;
  receivedTotal: number;
  costs: number;
  deliveryDate: ISODate | null;
  status: 'propuesta' | 'activo' | 'entregado' | 'pagado' | 'cancelado';
  pctDebt: number;
  pctSaving: number;
  pctPersonal: number;
}

export type TxKind = 'ingreso' | 'gasto' | 'abono_deuda' | 'ahorro' | 'retiro_ahorro';
export interface Transaction extends Row {
  kind: TxKind;
  amount: number;
  occurredOn: ISODate;
  category: string;
  description: string | null;
  refTable: string | null;
  refId: string | null;
}

export interface Dataset {
  income: Income[];
  expenseCategories: ExpenseCategory[];
  expenses: Expense[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  debtNegotiations: DebtNegotiation[];
  savingsGoals: SavingsGoal[];
  savingsContributions: SavingsContribution[];
  budgets: Budget[];
  budgetAllocations: BudgetAllocation[];
  purchaseDecisions: PurchaseDecision[];
  freelanceProjects: FreelanceProject[];
  transactions: Transaction[];
}

export type CollectionKey = keyof Dataset;

export const TABLES: Record<CollectionKey, string> = {
  income: 'income',
  expenseCategories: 'expense_categories',
  expenses: 'expenses',
  debts: 'debts',
  debtPayments: 'debt_payments',
  debtNegotiations: 'debt_negotiations',
  savingsGoals: 'savings_goals',
  savingsContributions: 'savings_contributions',
  budgets: 'budgets',
  budgetAllocations: 'budget_allocations',
  purchaseDecisions: 'purchase_decisions',
  freelanceProjects: 'freelance_projects',
  transactions: 'financial_transactions',
};

export const emptyDataset = (): Dataset => ({
  income: [],
  expenseCategories: [],
  expenses: [],
  debts: [],
  debtPayments: [],
  debtNegotiations: [],
  savingsGoals: [],
  savingsContributions: [],
  budgets: [],
  budgetAllocations: [],
  purchaseDecisions: [],
  freelanceProjects: [],
  transactions: [],
});
