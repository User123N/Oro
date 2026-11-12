drop policy if exists "deny direct access to platform bootstrap tokens" on private.platform_bootstrap_tokens;
create policy "deny direct access to platform bootstrap tokens" on private.platform_bootstrap_tokens
for all to anon, authenticated
using (false)
with check (false);