-- Restores the platform-admin user directory RPC expected by the Users page.
-- Existing profiles are preserved; previously existing accounts remain active.

do $$ begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'account_status'
  ) then
    create type public.account_status as enum ('pending', 'active', 'suspended', 'blocked');
  end if;
end $$;

alter table public.profiles
  add column if not exists account_status public.account_status not null default 'pending';

update public.profiles
set account_status = 'active'
where account_status = 'pending';

create index if not exists profiles_account_status_idx
  on public.profiles (account_status);

create or replace function public.list_all_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  account_status public.account_status,
  university_id uuid,
  company_id uuid,
  university_name text,
  company_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.full_name, p.email, p.role, p.account_status,
    p.university_id, p.company_id, u.name, c.name, p.created_at
  from public.profiles p
  left join public.universities u on u.id = p.university_id
  left join public.companies c on c.id = p.company_id
  where public.is_platform_admin()
    and p.deleted_at is null
  order by p.created_at desc, p.full_name;
$$;

revoke all on function public.list_all_users() from public, anon;
grant execute on function public.list_all_users() to authenticated;

notify pgrst, 'reload schema';
