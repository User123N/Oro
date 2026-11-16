-- Jewelry inventory ledger and customer directory.
-- Existing product catalogs remain in jewelry_store_data for compatibility;
-- public stock values are moved into RLS-protected tables.

create table if not exists public.jewelry_inventory (
  tenant_id uuid not null references public.jewelry_tenants(id) on delete cascade,
  product_id text not null,
  product_name text not null default '',
  quantity integer not null default 0 check (quantity >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, product_id)
);

create table if not exists public.jewelry_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.jewelry_tenants(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  movement_type text not null check (movement_type in ('entry','exit','adjustment')),
  quantity_delta integer not null check (quantity_delta <> 0),
  quantity_after integer not null check (quantity_after >= 0),
  note text not null default '',
  created_by text not null default lower(coalesce(auth.jwt()->>'email','')),
  created_at timestamptz not null default now()
);

create table if not exists public.jewelry_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.jewelry_tenants(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  email text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.touch_jewelry_inventory_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;
revoke all on function private.touch_jewelry_inventory_updated_at() from public, anon, authenticated;
grant execute on function private.touch_jewelry_inventory_updated_at() to authenticated;
drop trigger if exists jewelry_inventory_touch_updated_at on public.jewelry_inventory;
create trigger jewelry_inventory_touch_updated_at before update on public.jewelry_inventory
for each row execute function private.touch_jewelry_inventory_updated_at();

create index if not exists jewelry_inventory_tenant_quantity_idx
  on public.jewelry_inventory(tenant_id, quantity);
create index if not exists jewelry_inventory_movements_tenant_created_idx
  on public.jewelry_inventory_movements(tenant_id, created_at desc);
create index if not exists jewelry_inventory_movements_tenant_product_idx
  on public.jewelry_inventory_movements(tenant_id, product_id, created_at desc);
create index if not exists jewelry_customers_tenant_created_idx
  on public.jewelry_customers(tenant_id, created_at desc);
create index if not exists jewelry_customers_tenant_email_idx
  on public.jewelry_customers(tenant_id, lower(email));

alter table public.jewelry_inventory enable row level security;
alter table public.jewelry_inventory_movements enable row level security;
alter table public.jewelry_customers enable row level security;

create or replace function private.can_manage_jewelry(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_platform_admin() or private.owns_jewelry(p_tenant_id);
$$;
revoke all on function private.can_manage_jewelry(uuid) from public, anon;
grant execute on function private.can_manage_jewelry(uuid) to authenticated;

drop policy if exists jewelry_inventory_owner_access on public.jewelry_inventory;
create policy jewelry_inventory_owner_access on public.jewelry_inventory
for select to authenticated using (private.can_manage_jewelry(tenant_id));
drop policy if exists jewelry_inventory_owner_update on public.jewelry_inventory;
create policy jewelry_inventory_owner_update on public.jewelry_inventory
for update to authenticated using (private.can_manage_jewelry(tenant_id))
with check (private.can_manage_jewelry(tenant_id));

drop policy if exists jewelry_inventory_movements_owner_access on public.jewelry_inventory_movements;
create policy jewelry_inventory_movements_owner_access on public.jewelry_inventory_movements
for select to authenticated using (private.can_manage_jewelry(tenant_id));

drop policy if exists jewelry_customers_owner_access on public.jewelry_customers;
create policy jewelry_customers_owner_access on public.jewelry_customers
for all to authenticated using (private.can_manage_jewelry(tenant_id))
with check (private.can_manage_jewelry(tenant_id));

grant select on public.jewelry_inventory, public.jewelry_inventory_movements to authenticated;
grant update (low_stock_threshold) on public.jewelry_inventory to authenticated;
grant select, insert, update, delete on public.jewelry_customers to authenticated;
revoke all on public.jewelry_inventory, public.jewelry_inventory_movements,
  public.jewelry_customers from anon;

-- Backfill current catalog quantities before removing them from public JSON.
insert into public.jewelry_inventory(tenant_id, product_id, product_name, quantity, updated_at)
select d.tenant_id, p.item->>'id', coalesce(p.item->>'name',''),
  case when coalesce(p.item->>'stock','') ~ '^[0-9]+$' then
    case when length(p.item->>'stock') > 10 then 2147483647
      else least((p.item->>'stock')::numeric, 2147483647)::integer end
    else 0 end,
  coalesce(d.updated_at, now())
from public.jewelry_store_data d
cross join lateral jsonb_array_elements(case when jsonb_typeof(d.data)='array' then d.data else '[]'::jsonb end) p(item)
where d.data_key='products' and nullif(p.item->>'id','') is not null
on conflict (tenant_id, product_id) do nothing;

update public.jewelry_store_data d
set data = coalesce((
  select jsonb_agg(p.item - 'stock' order by p.ordinality)
  from jsonb_array_elements(case when jsonb_typeof(d.data)='array' then d.data else '[]'::jsonb end)
    with ordinality p(item, ordinality)
), '[]'::jsonb), updated_at=now()
where d.data_key='products'
  and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(d.data)='array' then d.data else '[]'::jsonb end) x(item) where x.item ? 'stock');

create or replace function public.manage_jewelry_inventory(
  p_tenant_id uuid,
  p_product_id text,
  p_movement_type text,
  p_quantity_delta integer,
  p_note text default ''
)
returns public.jewelry_inventory_movements
language plpgsql security definer set search_path = ''
as $$
declare
  v_product jsonb;
  v_product_name text;
  v_current integer;
  v_after integer;
  v_inventory public.jewelry_inventory%rowtype;
  v_movement public.jewelry_inventory_movements%rowtype;
begin
  if auth.uid() is null or not private.can_manage_jewelry(p_tenant_id) then
    raise exception 'No tienes permiso para modificar este inventario.';
  end if;
  if p_movement_type is null or p_movement_type not in ('entry','exit','adjustment')
    or p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'El tipo y la cantidad del movimiento no son válidos.';
  end if;
  if (p_movement_type='entry' and p_quantity_delta < 0)
    or (p_movement_type='exit' and p_quantity_delta > 0) then
    raise exception 'La cantidad no coincide con el tipo de movimiento.';
  end if;
  select item into v_product
  from public.jewelry_store_data d
  cross join lateral jsonb_array_elements(case when jsonb_typeof(d.data)='array' then d.data else '[]'::jsonb end) item
  where d.tenant_id=p_tenant_id and d.data_key='products' and item->>'id'=p_product_id
  limit 1 for update of d;
  if v_product is null then raise exception 'El producto ya no existe en el catálogo.'; end if;
  v_product_name := coalesce(v_product->>'name','Producto');
  insert into public.jewelry_inventory(tenant_id, product_id, product_name)
    values (p_tenant_id, p_product_id, v_product_name)
    on conflict (tenant_id, product_id) do nothing;
  select * into v_inventory from public.jewelry_inventory
    where tenant_id=p_tenant_id and product_id=p_product_id for update;
  v_current := v_inventory.quantity;
  v_after := v_current + p_quantity_delta;
  if v_after < 0 then raise exception 'La salida supera las existencias disponibles (%).', v_current; end if;
  update public.jewelry_inventory set quantity=v_after, product_name=v_product_name, updated_at=now()
    where tenant_id=p_tenant_id and product_id=p_product_id;
  insert into public.jewelry_inventory_movements(tenant_id,product_id,product_name,movement_type,quantity_delta,quantity_after,note)
    values (p_tenant_id,p_product_id,v_product_name,p_movement_type,p_quantity_delta,v_after,left(coalesce(p_note,''),500))
    returning * into v_movement;
  return v_movement;
end;
$$;
revoke all on function public.manage_jewelry_inventory(uuid,text,text,integer,text) from public, anon;
grant execute on function public.manage_jewelry_inventory(uuid,text,text,integer,text) to authenticated;

create or replace function public.ensure_jewelry_inventory_product(
  p_tenant_id uuid, p_product_id text, p_product_name text,
  p_initial_quantity integer default 0, p_low_stock_threshold integer default 3
)
returns public.jewelry_inventory
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.jewelry_inventory%rowtype;
  v_exists boolean;
begin
  if auth.uid() is null or not private.can_manage_jewelry(p_tenant_id) then
    raise exception 'No tienes permiso para modificar este inventario.';
  end if;
  if p_initial_quantity is null or p_initial_quantity < 0 then raise exception 'Las existencias no pueden ser negativas.'; end if;
  if p_low_stock_threshold is null or p_low_stock_threshold < 0 then raise exception 'El umbral no puede ser negativo.'; end if;
  if not exists (
    select 1 from public.jewelry_store_data d
    cross join lateral jsonb_array_elements(case when jsonb_typeof(d.data)='array' then d.data else '[]'::jsonb end) item
    where d.tenant_id=p_tenant_id and d.data_key='products' and item->>'id'=p_product_id
    for update of d
  ) then raise exception 'El producto no existe en el catálogo.'; end if;
  select * into v_row from public.jewelry_inventory
    where tenant_id=p_tenant_id and product_id=p_product_id for update;
  v_exists := found;
  if v_exists then
    update public.jewelry_inventory set product_name=left(coalesce(p_product_name,''),160),updated_at=now()
      where tenant_id=p_tenant_id and product_id=p_product_id returning * into v_row;
  else
    insert into public.jewelry_inventory(tenant_id,product_id,product_name,quantity,low_stock_threshold)
      values (p_tenant_id,p_product_id,left(coalesce(p_product_name,''),160),p_initial_quantity,p_low_stock_threshold)
      returning * into v_row;
    if p_initial_quantity > 0 then
      insert into public.jewelry_inventory_movements(tenant_id,product_id,product_name,movement_type,quantity_delta,quantity_after,note)
        values (p_tenant_id,p_product_id,left(coalesce(p_product_name,''),160),'entry',p_initial_quantity,p_initial_quantity,'Existencias iniciales del producto');
    end if;
  end if;
  return v_row;
end;
$$;
revoke all on function public.ensure_jewelry_inventory_product(uuid,text,text,integer,integer) from public, anon;
grant execute on function public.ensure_jewelry_inventory_product(uuid,text,text,integer,integer) to authenticated;

-- Tenant-scoped public images for catalog products, categories and brand marks.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('jewelry-media','jewelry-media',true,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public=true,file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists jewelry_media_public_read on storage.objects;
create policy jewelry_media_public_read on storage.objects
for select using (bucket_id='jewelry-media');

drop policy if exists jewelry_media_owner_insert on storage.objects;
create policy jewelry_media_owner_insert on storage.objects
for insert to authenticated with check (
  bucket_id='jewelry-media'
  and private.can_manage_jewelry(case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(name))[1]::uuid else null end)
);

drop policy if exists jewelry_media_owner_update on storage.objects;
create policy jewelry_media_owner_update on storage.objects
for update to authenticated using (
  bucket_id='jewelry-media'
  and private.can_manage_jewelry(case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(name))[1]::uuid else null end)
) with check (
  bucket_id='jewelry-media'
  and private.can_manage_jewelry(case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(name))[1]::uuid else null end)
);

drop policy if exists jewelry_media_owner_delete on storage.objects;
create policy jewelry_media_owner_delete on storage.objects
for delete to authenticated using (
  bucket_id='jewelry-media'
  and private.can_manage_jewelry(case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(name))[1]::uuid else null end)
);
