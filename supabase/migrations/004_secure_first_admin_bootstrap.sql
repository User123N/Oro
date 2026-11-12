-- Bootstrap seguro para el primer administrador de ORO.
create table if not exists private.platform_bootstrap_tokens (
  id integer primary key check (id = 1),
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table private.platform_bootstrap_tokens enable row level security;

create or replace function private.claim_platform_admin(p_token text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_claimed integer;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Debes iniciar sesión con una cuenta de Supabase Auth.';
  end if;
  if exists (select 1 from public.platform_admins) then
    raise exception 'La administración principal ya fue configurada.';
  end if;
  update private.platform_bootstrap_tokens
  set used_at = now()
  where id = 1 and used_at is null and expires_at > now()
    and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  returning id into v_claimed;
  if v_claimed is null then
    raise exception 'Clave de activación inválida, vencida o ya utilizada.';
  end if;
  insert into public.platform_admins(email) values (v_email);
  return true;
end;
$$;
revoke all on function private.claim_platform_admin(text) from public;
grant execute on function private.claim_platform_admin(text) to authenticated;

create or replace function public.claim_platform_admin(p_token text)
returns boolean language sql security invoker set search_path = ''
as $$ select private.claim_platform_admin(p_token); $$;
revoke all on function public.claim_platform_admin(text) from public, anon;
grant execute on function public.claim_platform_admin(text) to authenticated;
