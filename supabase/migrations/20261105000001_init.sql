-- =====================================================================
-- Mi Control Financiero — esquema inicial
-- Moneda: COP. Todos los montos son enteros (pesos, sin decimales) en bigint.
-- Cada tabla de usuario tiene user_id + Row Level Security (solo el dueño ve/edita).
-- Las FK compuestas (id, user_id) impiden enlazar registros de otro usuario.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- utilidades ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- profiles ----------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null default '' check (char_length(display_name) <= 60),
  currency       text not null default 'COP' check (currency = 'COP'),
  theme          text not null default 'system' check (theme in ('system','light','dark')),
  tutorial_done  boolean not null default false,
  onboarded      boolean not null default false,
  wait_rule_hours smallint not null default 48 check (wait_rule_hours between 0 and 720),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data->>'display_name', 60), ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- accounts (cuentas / bolsillos; reservado para futuras versiones) ----------
create table public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  kind       text not null default 'efectivo' check (kind in ('efectivo','ahorros','corriente','billetera','otro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

-- ---------- income (fuentes de ingreso recurrentes y extraordinarias) ----------
create table public.income (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  amount        bigint not null check (amount >= 0),
  schedule      text not null check (schedule in ('q1','q2','mensual','extraordinario')),
  expected_on   date,
  status        text not null default 'confirmado' check (status in ('estimado','confirmado','recibido')),
  notes         text check (char_length(notes) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id)
);
create index income_user_idx on public.income(user_id);

-- ---------- expense_categories (categorías personalizadas; las base viven en la app) ----------
create table public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slug       text not null check (slug ~ '^[a-z0-9_]{2,40}$'),
  name       text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

-- ---------- expenses (gastos fijos / recurrentes mensuales) ----------
create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  category    text not null check (char_length(category) between 2 and 40),
  amount      bigint not null check (amount >= 0),
  amount_min  bigint check (amount_min >= 0),
  amount_max  bigint check (amount_max >= 0),
  is_variable boolean not null default false,
  is_estimate boolean not null default true,
  due_day     smallint check (due_day between 1 and 31),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  check (amount_min is null or amount_max is null or amount_min <= amount_max)
);
create index expenses_user_idx on public.expenses(user_id);

-- ---------- debts ----------
create table public.debts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creditor           text not null check (char_length(creditor) between 1 and 80),
  debt_type          text not null default 'financiera' check (debt_type in ('financiera','familiar','servicio','otra')),
  initial_balance    bigint not null check (initial_balance >= 0),
  updated_balance    bigint check (updated_balance >= 0),
  balance_updated_on date,
  is_estimate        boolean not null default true,
  due_date           date,
  days_past_due      integer not null default 0 check (days_past_due >= 0),
  days_past_due_on   date,
  interest_rate_ea   numeric(6,3) check (interest_rate_ea >= 0 and interest_rate_ea <= 200),
  minimum_payment    bigint check (minimum_payment >= 0),
  negotiated_payment bigint check (negotiated_payment >= 0),
  status             text not null default 'pendiente' check (status in
                      ('pendiente','en_mora','en_negociacion','acuerdo_confirmado','en_proceso_pago','pagada','paz_y_salvo')),
  next_payment_date  date,
  objective          text check (char_length(objective) <= 300),
  notes              text check (char_length(notes) <= 1000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, user_id)
);
create index debts_user_idx on public.debts(user_id);

create table public.debt_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debt_id      uuid not null,
  amount       bigint not null check (amount > 0),
  paid_on      date not null default current_date,
  note         text check (char_length(note) <= 300),
  receipt_path text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (debt_id, user_id) references public.debts(id, user_id) on delete cascade
);
create index debt_payments_debt_idx on public.debt_payments(debt_id, paid_on);

create table public.debt_negotiations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debt_id          uuid not null,
  original_balance bigint not null check (original_balance >= 0),
  offer_amount     bigint not null check (offer_amount >= 0),
  deadline         date,
  kind             text not null default 'simulacion' check (kind in ('simulacion','oferta_real')),
  status           text not null default 'abierta' check (status in ('abierta','aceptada','rechazada','vencida')),
  document_path    text,
  notes            text check (char_length(notes) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (debt_id, user_id) references public.debts(id, user_id) on delete cascade,
  -- Una simulación nunca puede quedar "aceptada": solo las ofertas reales.
  check (kind = 'oferta_real' or status <> 'aceptada')
);
create index debt_negotiations_debt_idx on public.debt_negotiations(debt_id);

-- ---------- savings_goals ----------
create table public.savings_goals (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                 text not null check (char_length(name) between 1 and 80),
  kind                 text not null default 'otro' check (kind in ('moto','emergencia','otro')),
  target_amount        bigint not null default 0 check (target_amount >= 0),
  target_date          date,
  initial_saved        bigint not null default 0 check (initial_saved >= 0),
  monthly_contribution bigint not null default 0 check (monthly_contribution >= 0),
  details              jsonb not null default '{}'::jsonb,
  achieved_on          date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, user_id)
);
create index savings_goals_user_idx on public.savings_goals(user_id);

create table public.savings_contributions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id        uuid not null,
  amount         bigint not null check (amount <> 0), -- negativo = retiro
  contributed_on date not null default current_date,
  note           text check (char_length(note) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.savings_goals(id, user_id) on delete cascade
);
create index savings_contributions_goal_idx on public.savings_contributions(goal_id, contributed_on);

-- ---------- budgets (una por quincena) ----------
create table public.budgets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period          date not null check (extract(day from period) = 1),
  half            smallint not null check (half in (1,2)),
  received_amount bigint not null default 0 check (received_amount >= 0),
  received_on     date,
  executed        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, period, half),
  unique (id, user_id)
);

create table public.budget_allocations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  budget_id  uuid not null,
  bucket     text not null check (bucket in ('obligatorios','deudas','personales','emergencia','moto')),
  amount     bigint not null check (amount >= 0),
  debt_id    uuid,
  goal_id    uuid,
  note       text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (budget_id, user_id) references public.budgets(id, user_id) on delete cascade,
  foreign key (debt_id, user_id) references public.debts(id, user_id) on delete set null (debt_id),
  foreign key (goal_id, user_id) references public.savings_goals(id, user_id) on delete set null (goal_id)
);
create index budget_allocations_budget_idx on public.budget_allocations(budget_id);

-- ---------- purchase_decisions ("¿Realmente lo necesito?") ----------
create table public.purchase_decisions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product        text not null check (char_length(product) between 1 and 120),
  price          bigint not null check (price > 0),
  category       text not null,
  reason         text check (char_length(reason) <= 500),
  priority       text not null default 'media' check (priority in ('alta','media','baja')),
  decided_on     date not null default current_date,
  nature         text not null check (nature in ('necesidad','gusto')),
  in_budget      boolean,
  affects_debt   boolean,
  affects_saving boolean,
  wait_until     timestamptz,
  status         text not null default 'esperando' check (status in ('esperando','lista','comprada','pospuesta','cancelada')),
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index purchase_decisions_user_idx on public.purchase_decisions(user_id, status);

-- ---------- freelance_projects ----------
create table public.freelance_projects (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client         text not null check (char_length(client) between 1 and 80),
  project        text not null check (char_length(project) between 1 and 120),
  category       text not null check (category in ('desarrollo_web','automatizaciones','bases_de_datos','desarrollo_software','mantenimiento','otros')),
  contract_value bigint not null check (contract_value >= 0),
  advance        bigint not null default 0 check (advance >= 0),
  received_total bigint not null default 0 check (received_total >= 0),
  costs          bigint not null default 0 check (costs >= 0),
  delivery_date  date,
  status         text not null default 'activo' check (status in ('propuesta','activo','entregado','pagado','cancelado')),
  pct_debt       smallint not null default 0 check (pct_debt between 0 and 100),
  pct_saving     smallint not null default 0 check (pct_saving between 0 and 100),
  pct_personal   smallint not null default 0 check (pct_personal between 0 and 100),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (pct_debt + pct_saving + pct_personal <= 100),
  check (advance <= contract_value)
);
create index freelance_projects_user_idx on public.freelance_projects(user_id);

-- ---------- financial_transactions (libro de movimientos reales) ----------
create table public.financial_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('ingreso','gasto','abono_deuda','ahorro','retiro_ahorro')),
  amount      bigint not null check (amount > 0),
  occurred_on date not null default current_date,
  category    text not null,
  description text check (char_length(description) <= 200),
  ref_table   text check (ref_table in ('debt_payments','savings_contributions','freelance_projects','purchase_decisions','budgets','income')),
  ref_id      uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index financial_transactions_user_date_idx on public.financial_transactions(user_id, occurred_on desc);
create index financial_transactions_ref_idx on public.financial_transactions(ref_table, ref_id);

-- ---------- triggers updated_at + RLS para todas las tablas de usuario ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','accounts','income','expense_categories','expenses','debts','debt_payments',
    'debt_negotiations','savings_goals','savings_contributions','budgets','budget_allocations',
    'purchase_decisions','freelance_projects','financial_transactions']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;

  foreach t in array array['accounts','income','expense_categories','expenses','debts','debt_payments',
    'debt_negotiations','savings_goals','savings_contributions','budgets','budget_allocations',
    'purchase_decisions','freelance_projects','financial_transactions']
  loop
    execute format('create policy "%s_select_own" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s_update_own" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s_delete_own" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t, t);
  end loop;
end $$;

create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- Realtime ----------
alter publication supabase_realtime add table
  public.profiles, public.income, public.expenses, public.debts, public.debt_payments, public.debt_negotiations,
  public.savings_goals, public.savings_contributions, public.budgets, public.budget_allocations,
  public.purchase_decisions, public.freelance_projects, public.financial_transactions, public.expense_categories;

-- ---------- Storage privado para comprobantes y acuerdos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 5242880, array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Cada usuario solo accede a su carpeta: documents/<user_id>/...
create policy "documents_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
