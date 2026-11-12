-- Optimización de evaluación de JWT en políticas RLS
drop policy if exists "platform admins read own admin row" on public.platform_admins;
create policy "platform admins read own admin row" on public.platform_admins
for select to authenticated
using (lower(email)=lower(coalesce((select auth.jwt())->>'email','')));

drop policy if exists "owners and platform admins read owner mapping" on public.jewelry_tenant_owners;
create policy "owners and platform admins read owner mapping" on public.jewelry_tenant_owners
for select to authenticated
using (private.is_platform_admin() or lower(owner_email)=lower(coalesce((select auth.jwt())->>'email','')));
