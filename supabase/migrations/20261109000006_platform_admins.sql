-- General (platform) administrator management.
--
-- Platform administrators are not bound to a tenant, and the profiles RLS
-- policies only let a user read their own row (can_view_profile has no
-- platform-admin branch). This SECURITY DEFINER RPC lets an authenticated
-- platform administrator list the peer administrator accounts so the web app
-- can show how many of the two allowed slots are filled.
--
-- Account creation and deletion happen in the manage-admins Edge Function,
-- which uses the service role to call auth.admin.createUser / deleteUser and
-- enforces the two-account cap server-side.

create or replace function public.list_platform_admins()
returns table (id uuid, full_name text, email text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.created_at
  from public.profiles p
  where p.role = 'platform_admin'
    and public.is_platform_admin()
  order by p.created_at, p.full_name;
$$;