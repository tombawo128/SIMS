-- General-admin console: account approval gate, full user directory, and moderation.
--
-- Adds an account_status lifecycle to profiles. Public sign-ups start as 'pending'
-- and cannot use the product until a general administrator approves them; accounts
-- provisioned by the service role (invites, admin bootstrap, seed) are 'active'.
-- Administrators can additionally suspend, block, or delete users and delete tenants.
--
-- The approval gate is enforced in the database, not just the UI: auth_role(),
-- auth_university_id(), and auth_company_id() return nothing unless the account is
-- active, so every RLS policy that resolves the caller through them denies pending,
-- suspended, and blocked accounts. A user may still read their own profile row (the
-- profiles_select self branch) so the app can show the correct gate screen.

create type public.account_status as enum ('pending', 'active', 'suspended', 'blocked');

alter table public.profiles
  add column account_status public.account_status not null default 'pending';

-- Existing accounts predate the approval gate; keep them usable.
update public.profiles set account_status = 'active';

create index profiles_account_status_idx on public.profiles (account_status);

-- Provisioned accounts are trusted and active immediately; public sign-ups await approval.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_provisioned boolean := coalesce(v_app ->> 'sims_provisioned', '') = 'true';
  v_role public.user_role := 'student';
  v_status public.account_status := 'pending';
  v_university uuid;
  v_company uuid;
  v_name text := coalesce(nullif(v_meta ->> 'full_name', ''), split_part(new.email, '@', 1));
  v_year integer;
begin
  -- Only the service role can write app_metadata. Public sign-ups can submit arbitrary
  -- user_metadata, so privileged roles and company tenancy are accepted only from
  -- accounts provisioned by an Edge Function (or seed data).
  if v_provisioned
    and v_app ->> 'role' in (
      'student', 'faculty_supervisor', 'coordinator', 'site_supervisor', 'company_admin', 'platform_admin'
    ) then
    v_role := (v_app ->> 'role')::public.user_role;
    v_university := public.try_uuid(v_app ->> 'university_id');
    v_company := public.try_uuid(v_app ->> 'company_id');
    v_status := 'active';
  else
    v_university := public.try_uuid(v_meta ->> 'university_id');
  end if;

  if v_role in ('student', 'faculty_supervisor', 'coordinator') then
    v_company := null;
    if v_university is null then
      raise exception 'A university is required for this role';
    end if;
  elsif v_role in ('site_supervisor', 'company_admin') then
    v_university := null;
    if v_company is null then
      raise exception 'A company is required for this role';
    end if;
  else
    v_university := null;
    v_company := null;
  end if;

  if (v_meta ->> 'year') ~ '^[0-9]{1,2}$' then
    v_year := (v_meta ->> 'year')::integer;
  end if;

  insert into public.profiles (id, role, university_id, company_id, full_name, email, account_status)
  values (new.id, v_role, v_university, v_company, v_name, coalesce(new.email, ''), v_status);

  if v_role = 'student' then
    insert into public.student_profiles (user_id, student_id, program, year)
    values (new.id, nullif(v_meta ->> 'student_id', ''), nullif(v_meta ->> 'program', ''), v_year);
  end if;

  return new;
end;
$$;

-- A user must not be able to approve, unblock, or otherwise change their own status.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role is distinct from old.role
      or new.university_id is distinct from old.university_id
      or new.company_id is distinct from old.company_id
      or new.email is distinct from old.email
      or new.account_status is distinct from old.account_status then
      raise exception 'You cannot change your role, tenant, or account status';
    end if;
  end if;
  return new;
end;
$$;

-- Approval gate at the RLS boundary: inactive accounts resolve to no role/tenant.
create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and account_status = 'active';
$$;

create or replace function public.auth_university_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select university_id from public.profiles where id = auth.uid() and account_status = 'active';
$$;

create or replace function public.auth_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid() and account_status = 'active';
$$;

-- Public, unauthenticated check used by the sign-up page to decide whether the
-- administrator option is still offered. Returns only a boolean — no identities.
-- Keep the literal in sync with MAX_PLATFORM_ADMINS in @sims/shared.
create or replace function public.admin_signup_available()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*) from public.profiles where role = 'platform_admin') < 2;
$$;

grant execute on function public.admin_signup_available() to anon, authenticated;

-- Full user directory for general administrators. SECURITY DEFINER bypasses the
-- self/tenant-only profiles RLS; the WHERE clause returns nothing for non-admins.
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
  order by p.created_at desc, p.full_name;
$$;

grant execute on function public.list_all_users() to authenticated;

-- Approve / suspend / block / reactivate a non-administrator account.
create or replace function public.set_user_status(target uuid, new_status public.account_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_title text;
  v_body text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a general administrator can manage user accounts';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot change your own account status';
  end if;

  select role into v_role from public.profiles where id = target;
  if v_role is null then
    raise exception 'User not found';
  end if;
  if v_role = 'platform_admin' then
    raise exception 'Manage administrator accounts from General admins';
  end if;

  update public.profiles set account_status = new_status where id = target;

  insert into public.audit_logs (actor_id, entity, entity_id, action, metadata)
  values (auth.uid(), 'profile', target::text, 'status_change', jsonb_build_object('status', new_status));

  v_title := case new_status
    when 'active' then 'Account approved'
    when 'suspended' then 'Account suspended'
    when 'blocked' then 'Account blocked'
    else 'Account updated'
  end;
  v_body := case new_status
    when 'active' then 'Your account has been approved. You can now sign in and use SIMS.'
    when 'suspended' then 'Your account has been temporarily suspended. Contact the platform team.'
    when 'blocked' then 'Your account has been blocked. Contact the platform team.'
    else 'Your account status was updated.'
  end;
  insert into public.notifications (user_id, title, body, link)
  values (target, v_title, v_body, '/dashboard');
end;
$$;

grant execute on function public.set_user_status(uuid, public.account_status) to authenticated;

-- Permanently delete a university or company and everything that belongs to it.
-- Runs in a single transaction so a failure never leaves a half-deleted tenant.
-- Order matters: placements and applications hold RESTRICT foreign keys to the
-- tenant (and placements.posting_id restricts the company's job_postings cascade),
-- so they are removed before the member accounts and the tenant row. Deleting the
-- member auth.users rows cascades their profiles, student profiles, notifications,
-- documents, evaluations, and check-ins; the only non-cascading profile reference
-- (placements.site_supervisor_id) is cleared explicitly first.
create or replace function public.delete_tenant(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_members uuid[];
begin
  if not public.is_platform_admin() then
    raise exception 'Only a general administrator can delete tenants';
  end if;
  if p_kind not in ('university', 'company') then
    raise exception 'Unknown tenant kind';
  end if;

  if p_kind = 'university' then
    if not exists (select 1 from public.universities where id = p_id) then
      raise exception 'University not found';
    end if;
    select array_agg(id) into v_members from public.profiles where university_id = p_id;

    delete from public.placements
      where university_id = p_id
         or (v_members is not null and site_supervisor_id = any(v_members));
    delete from public.applications where university_id = p_id;
    delete from public.posting_universities where university_id = p_id;
    if v_members is not null then
      delete from auth.users where id = any(v_members);
    end if;
    delete from public.universities where id = p_id;
  else
    if not exists (select 1 from public.companies where id = p_id) then
      raise exception 'Company not found';
    end if;
    select array_agg(id) into v_members from public.profiles where company_id = p_id;

    delete from public.placements
      where company_id = p_id
         or (v_members is not null and site_supervisor_id = any(v_members));
    delete from public.applications where company_id = p_id;
    if v_members is not null then
      delete from auth.users where id = any(v_members);
    end if;
    delete from public.companies where id = p_id;
  end if;

  insert into public.audit_logs (actor_id, entity, entity_id, action, metadata)
  values (
    auth.uid(), p_kind, p_id::text, 'delete',
    jsonb_build_object('members_removed', coalesce(array_length(v_members, 1), 0))
  );
end;
$$;

grant execute on function public.delete_tenant(text, uuid) to authenticated;