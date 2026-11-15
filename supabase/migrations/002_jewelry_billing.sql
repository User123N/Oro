-- ORO · Commercial billing for catalog subscriptions
-- Run after 001_multi_jewelry_core.sql. No payment gateway is configured.

create table if not exists public.jewelry_billing (
  tenant_id uuid primary key references public.jewelry_tenants(id) on delete cascade,
  setup_fee numeric(12,2) not null default 0 check (setup_fee >= 0),
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  contracted_at date not null default current_date,
  next_due_at date,
  grace_days integer not null default 5 check (grace_days between 0 and 60),
  billing_status text not null default 'pending' check (billing_status in ('pending','active','past_due','grace','suspended','cancelled')),
  updated_at timestamptz not null default now()
);

create table if not exists public.jewelry_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.jewelry_tenants(id) on delete cascade,
  payment_type text not null check (payment_type in ('setup','monthly')),
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  period_start date,
  period_end date,
  note text not null default '',
  registered_by text not null default lower(coalesce(auth.jwt()->>'email','')),
  created_at timestamptz not null default now()
);

create index if not exists jewelry_payments_tenant_paid_idx
  on public.jewelry_payments(tenant_id, paid_at desc);

alter table public.jewelry_billing enable row level security;
alter table public.jewelry_payments enable row level security;

drop policy if exists jewelry_billing_admin_only on public.jewelry_billing;
create policy jewelry_billing_admin_only on public.jewelry_billing
for all to authenticated
using (public.is_oro_platform_admin())
with check (public.is_oro_platform_admin());

drop policy if exists jewelry_payments_admin_only on public.jewelry_payments;
create policy jewelry_payments_admin_only on public.jewelry_payments
for all to authenticated
using (public.is_oro_platform_admin())
with check (public.is_oro_platform_admin());

grant select, insert, update, delete on public.jewelry_billing to authenticated;
grant select, insert, update, delete on public.jewelry_payments to authenticated;
