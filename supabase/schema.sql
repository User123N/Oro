-- ÁUREA · Ejecuta este archivo completo en Supabase > SQL Editor.
-- ANTES cambia TU_CORREO@EJEMPLO.COM (4 veces) por el correo del administrador.

create table if not exists public.store (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table public.store enable row level security;

create policy "lectura publica" on public.store for select using (true);
create policy "solo admin escribe" on public.store for all to authenticated
  using ((auth.jwt()->>'email') = 'TU_CORREO@EJEMPLO.COM')
  with check ((auth.jwt()->>'email') = 'TU_CORREO@EJEMPLO.COM');

-- Bucket público para fotos y logos
insert into storage.buckets (id, name, public) values ('images','images',true) on conflict (id) do nothing;
create policy "imagenes publicas" on storage.objects for select using (bucket_id = 'images');
create policy "solo admin gestiona imagenes" on storage.objects for all to authenticated
  using (bucket_id = 'images' and (auth.jwt()->>'email') = 'TU_CORREO@EJEMPLO.COM')
  with check (bucket_id = 'images' and (auth.jwt()->>'email') = 'TU_CORREO@EJEMPLO.COM');
