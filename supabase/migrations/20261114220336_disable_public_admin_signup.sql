-- Disable public administrator bootstrap on production and future environments.
create or replace function public.admin_signup_available()
returns boolean
language sql
immutable
set search_path = ''
as $$
  select false;
$$;

revoke all on function public.admin_signup_available() from public;
grant execute on function public.admin_signup_available() to anon, authenticated, service_role;
