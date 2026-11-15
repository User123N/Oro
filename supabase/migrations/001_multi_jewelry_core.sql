-- ORO · Multi-joyería SaaS core
-- Scope: public storefront + product catalog, categories and store settings.
-- No appointments, orders, employees, customer CRM or inventory module.

create extension if not exists pgcrypto;

create table if not exists public.jewelry_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  brand_name text not null,
  description text not null default '',
  logo_url text,
  city text not null default '',
  status text not null default 'draft' check (status in ('draft','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.jewelry_tenant_owners (
  tenant_id uuid not null references public.jewelry_tenants(id) on delete cascade,
  owner_email text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, owner_email)
);

create table if not exists public.jewelry_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.jewelry_tenants(id) on delete cascade,
  domain text not null unique,
  verified boolean not null default false,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  check (domain = lower(domain) and domain !~ '^https?://')
);

create table if not exists public.jewelry_store_data (
  tenant_id uuid not null references public.jewelry_tenants(id) on delete cascade,
  data_key text not null check (data_key in ('settings','products','collections')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, data_key)
);

create table if not exists public.platform_admin_bootstrap (
  id boolean primary key default true check (id),
  token_hash text not null,
  consumed_at timestamptz
);

-- Change this one-time key before running the migration.
insert into public.platform_admin_bootstrap(id, token_hash)
values (true, encode(digest('CAMBIA-ESTA-CLAVE-DE-ACTIVACION', 'sha256'), 'hex'))
on conflict (id) do nothing;

create index if not exists jewelry_tenants_status_created_idx
  on public.jewelry_tenants(status, created_at desc);
create index if not exists jewelry_owners_email_idx
  on public.jewelry_tenant_owners(lower(owner_email));
create index if not exists jewelry_domains_tenant_idx
  on public.jewelry_domains(tenant_id);

alter table public.jewelry_tenants enable row level security;
alter table public.platform_admins enable row level security;
alter table public.jewelry_tenant_owners enable row level security;
alter table public.jewelry_domains enable row level security;
alter table public.jewelry_store_data enable row level security;
alter table public.platform_admin_bootstrap enable row level security;

create or replace function public.is_oro_platform_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins p
    where lower(p.email) = lower(coalesce(auth.jwt()->>'email',''))
  );
$$;

-- Drop the previous signature first because PostgreSQL cannot change OUT/RETURNS TABLE types with CREATE OR REPLACE.
drop function if exists public.resolve_jewelry_domain(text);

create function public.resolve_jewelry_domain(p_domain text)
returns table (
  id uuid, tenant_id uuid, slug text, name text, brand_name text,
  description text, logo_url text, city text, status text
)
language sql stable security definer
set search_path = public
as $$
  select t.id, t.id, t.slug, t.name, t.brand_name, t.description,
         t.logo_url, t.city, t.status
  from public.jewelry_domains d
  join public.jewelry_tenants t on t.id = d.tenant_id
  where d.verified = true and t.status = 'active'
    and lower(d.domain) = lower(trim(p_domain))
  limit 1;
$$;

create or replace function public.claim_platform_admin(p_token text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_hash text;
  v_consumed timestamptz;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Debes iniciar sesión primero.';
  end if;
  select token_hash, consumed_at into v_hash, v_consumed
  from public.platform_admin_bootstrap where id = true for update;
  if v_hash is null or v_consumed is not null
     or encode(digest(coalesce(p_token,''), 'sha256'), 'hex') <> v_hash then
    raise exception 'Clave de activación inválida o ya utilizada.';
  end if;
  insert into public.platform_admins(email) values (v_email)
  on conflict (email) do nothing;
  update public.platform_admin_bootstrap set consumed_at = now() where id = true;
  return true;
end;
$$;

-- Public storefront reads only active jewelry tenants and their published catalog data.
drop policy if exists jewelry_tenants_public_read on public.jewelry_tenants;
create policy jewelry_tenants_public_read on public.jewelry_tenants
for select using (status = 'active' or public.is_oro_platform_admin()
  or exists (select 1 from public.jewelry_tenant_owners o
    where o.tenant_id = id and lower(o.owner_email) = lower(coalesce(auth.jwt()->>'email',''))));

drop policy if exists platform_admins_self_read on public.platform_admins;
create policy platform_admins_self_read on public.platform_admins
for select to authenticated using (lower(email) = lower(coalesce(auth.jwt()->>'email','')));

drop policy if exists owners_self_read on public.jewelry_tenant_owners;
create policy owners_self_read on public.jewelry_tenant_owners
for select to authenticated using (
  lower(owner_email) = lower(coalesce(auth.jwt()->>'email',''))
  or public.is_oro_platform_admin()
);

drop policy if exists domains_public_read on public.jewelry_domains;
create policy domains_public_read on public.jewelry_domains
for select using (verified = true or public.is_oro_platform_admin()
  or exists (select 1 from public.jewelry_tenant_owners o
    where o.tenant_id = jewelry_domains.tenant_id
      and lower(o.owner_email) = lower(coalesce(auth.jwt()->>'email',''))));

drop policy if exists store_data_public_read on public.jewelry_store_data;
create policy store_data_public_read on public.jewelry_store_data
for select using (
  exists (select 1 from public.jewelry_tenants t
    where t.id = tenant_id and t.status = 'active')
  or public.is_oro_platform_admin()
  or exists (select 1 from public.jewelry_tenant_owners o
    where o.tenant_id = tenant_id
      and lower(o.owner_email) = lower(coalesce(auth.jwt()->>'email','')))
);

drop policy if exists store_data_owner_write on public.jewelry_store_data;
create policy store_data_owner_write on public.jewelry_store_data
for all to authenticated
using (
  public.is_oro_platform_admin()
  or exists (select 1 from public.jewelry_tenant_owners o
    where o.tenant_id = tenant_id
      and lower(o.owner_email) = lower(coalesce(auth.jwt()->>'email','')))
)
with check (
  public.is_oro_platform_admin()
  or exists (select 1 from public.jewelry_tenant_owners o
    where o.tenant_id = tenant_id
      and lower(o.owner_email) = lower(coalesce(auth.jwt()->>'email','')))
);

drop policy if exists tenants_admin_manage on public.jewelry_tenants;
create policy tenants_admin_manage on public.jewelry_tenants
for all to authenticated using (public.is_oro_platform_admin())
with check (public.is_oro_platform_admin());

drop policy if exists owners_admin_manage on public.jewelry_tenant_owners;
create policy owners_admin_manage on public.jewelry_tenant_owners
for all to authenticated using (public.is_oro_platform_admin())
with check (public.is_oro_platform_admin());

drop policy if exists domains_admin_manage on public.jewelry_domains;
create policy domains_admin_manage on public.jewelry_domains
for all to authenticated using (public.is_oro_platform_admin())
with check (public.is_oro_platform_admin());

grant select on public.jewelry_tenants, public.jewelry_domains, public.jewelry_store_data to anon, authenticated;
grant select on public.platform_admins, public.jewelry_tenant_owners to authenticated;
grant insert, update, delete on public.jewelry_tenants, public.jewelry_tenant_owners, public.jewelry_domains to authenticated;
grant insert, update, delete on public.jewelry_store_data to authenticated;
grant execute on function public.resolve_jewelry_domain(text) to anon, authenticated;
grant execute on function public.claim_platform_admin(text) to authenticated;
