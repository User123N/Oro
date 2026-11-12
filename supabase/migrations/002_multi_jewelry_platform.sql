-- Plataforma multi-joyería ORO
-- Ejecutar después de supabase/schema.sql. No elimina la tabla legacy public.store.

create extension if not exists pgcrypto;

create table if not exists public.jewelry_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  name text not null,
  brand_name text not null,
  description text not null default '',
  logo_url text not null default '',
  city text not null default '',
  status text not null default 'active' check (status in ('active','suspended','draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.jewelry_tenant_owners (
  tenant_id uuid primary key references public.jewelry_tenants(id) on delete cascade,
  owner_email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.jewelry_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.jewelry_tenants(id) on delete cascade,
  domain text not null unique,
  verified boolean not null default false,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint jewelry_domains_domain_format check (domain = lower(domain) and domain !~ '^https?://' and domain !~ '/')
);

create table if not exists public.jewelry_store_data (
  tenant_id uuid not null references public.jewelry_tenants(id) on delete cascade,
  data_key text not null check (data_key in ('settings','products','collections')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, data_key)
);

create index if not exists jewelry_tenants_status_created_idx on public.jewelry_tenants(status, created_at desc);
create index if not exists jewelry_domains_tenant_idx on public.jewelry_domains(tenant_id);
create index if not exists jewelry_store_data_tenant_idx on public.jewelry_store_data(tenant_id);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a
    where lower(a.email) = lower(coalesce(auth.jwt()->>'email',''))
  );
$$;

create or replace function private.owns_jewelry(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.jewelry_tenant_owners o
    where o.tenant_id = p_tenant_id
      and lower(o.owner_email) = lower(coalesce(auth.jwt()->>'email',''))
  );
$$;

revoke all on function private.is_platform_admin() from public;
revoke all on function private.owns_jewelry(uuid) from public;
grant execute on function private.is_platform_admin() to anon, authenticated;
grant execute on function private.owns_jewelry(uuid) to anon, authenticated;

create or replace function public.resolve_jewelry_domain(p_domain text)
returns table (
  tenant_id uuid, slug text, name text, brand_name text,
  description text, logo_url text, city text, status text
)
language sql stable security invoker set search_path = ''
as $$
  select t.id,t.slug,t.name,t.brand_name,t.description,t.logo_url,t.city,t.status
  from public.jewelry_domains d
  join public.jewelry_tenants t on t.id=d.tenant_id
  where lower(d.domain)=lower(trim(p_domain))
    and d.verified=true and t.status='active'
  limit 1;
$$;
revoke all on function public.resolve_jewelry_domain(text) from public;
grant execute on function public.resolve_jewelry_domain(text) to anon, authenticated;

alter table public.jewelry_tenants enable row level security;
alter table public.platform_admins enable row level security;
alter table public.jewelry_tenant_owners enable row level security;
alter table public.jewelry_domains enable row level security;
alter table public.jewelry_store_data enable row level security;

drop policy if exists "public active jewelry directory" on public.jewelry_tenants;
create policy "public active jewelry directory" on public.jewelry_tenants
for select using (status='active' or private.is_platform_admin() or private.owns_jewelry(id));

drop policy if exists "platform admins manage jewelry tenants" on public.jewelry_tenants;
create policy "platform admins manage jewelry tenants" on public.jewelry_tenants
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "platform admins read own admin row" on public.platform_admins;
create policy "platform admins read own admin row" on public.platform_admins
for select to authenticated using (lower(email)=lower(coalesce(auth.jwt()->>'email','')));

drop policy if exists "owners and platform admins read owner mapping" on public.jewelry_tenant_owners;
create policy "owners and platform admins read owner mapping" on public.jewelry_tenant_owners
for select to authenticated using (public.is_platform_admin() or lower(owner_email)=lower(coalesce(auth.jwt()->>'email','')));

drop policy if exists "platform admins manage owner mapping" on public.jewelry_tenant_owners;
create policy "platform admins manage owner mapping" on public.jewelry_tenant_owners
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "public resolve verified domains" on public.jewelry_domains;
create policy "public resolve verified domains" on public.jewelry_domains
for select using (verified=true);

drop policy if exists "platform admins manage domains" on public.jewelry_domains;
create policy "platform admins manage domains" on public.jewelry_domains
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "public read active store data" on public.jewelry_store_data;
create policy "public read active store data" on public.jewelry_store_data
for select using (exists (select 1 from public.jewelry_tenants t where t.id=tenant_id and t.status='active'));

drop policy if exists "owners and platform admins manage store data" on public.jewelry_store_data;
create policy "owners and platform admins manage store data" on public.jewelry_store_data
for all to authenticated
using (public.is_platform_admin() or public.owns_jewelry(tenant_id))
with check (public.is_platform_admin() or public.owns_jewelry(tenant_id));

revoke select on public.jewelry_tenants from anon, authenticated;
grant select (id,slug,name,brand_name,description,logo_url,city,status,created_at,updated_at) on public.jewelry_tenants to anon, authenticated;
grant select on public.jewelry_tenant_owners to authenticated;
grant select on public.jewelry_domains, public.jewelry_store_data to authenticated;
grant select on public.jewelry_domains, public.jewelry_store_data to anon;
grant insert, update, delete on public.jewelry_tenants, public.jewelry_domains, public.jewelry_tenant_owners to authenticated;
grant insert, update, delete on public.jewelry_store_data to authenticated;
grant select on public.platform_admins to authenticated;
grant execute on function public.resolve_jewelry_domain(text) to anon, authenticated;

-- IMPORTANTE: registra aquí el correo del propietario de la plataforma.
-- insert into public.platform_admins(email) values ('TU_CORREO_ADMIN') on conflict do nothing;
