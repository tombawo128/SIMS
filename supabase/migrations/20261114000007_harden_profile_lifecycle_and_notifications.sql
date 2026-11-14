-- Backend security hardening: active-account authorization and protected profile lifecycle.
-- Safe to apply after the existing schema baseline has been reconciled.

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid())
    and p.account_status = 'active'::public.account_status
    and p.deleted_at is null;
$$;

create or replace function public.auth_university_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.university_id
  from public.profiles as p
  where p.id = (select auth.uid())
    and p.account_status = 'active'::public.account_status
    and p.deleted_at is null;
$$;

create or replace function public.auth_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id
  from public.profiles as p
  where p.id = (select auth.uid())
    and p.account_status = 'active'::public.account_status
    and p.deleted_at is null;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.role = 'platform_admin'::public.user_role
      and p.account_status = 'active'::public.account_status
      and p.deleted_at is null
  );
$$;

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (select auth.uid()) = old.id then
    if new.role is distinct from old.role
      or new.university_id is distinct from old.university_id
      or new.company_id is distinct from old.company_id
      or new.email is distinct from old.email
      or new.account_status is distinct from old.account_status
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by then
      raise exception 'You cannot change protected account or tenant fields';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.notify_user(
  p_user uuid,
  p_title text,
  p_body text,
  p_link text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, title, body, link)
  values (p_user, p_title, p_body, p_link);
$$;

-- Notifications must be emitted by trusted server-side workflows, not arbitrary API clients.
revoke all on function public.notify_user(uuid, text, text, text) from public;
revoke all on function public.notify_user(uuid, text, text, text) from anon;
revoke all on function public.notify_user(uuid, text, text, text) from authenticated;
grant execute on function public.notify_user(uuid, text, text, text) to service_role;

-- Keep administrative RPCs available to authenticated callers only.
revoke all on function public.admin_signup_available() from public;
revoke all on function public.admin_signup_available() from anon;
revoke all on function public.admin_signup_available() from authenticated;
grant execute on function public.admin_signup_available() to service_role;

revoke all on function public.set_user_status(uuid, public.account_status) from public;
revoke all on function public.set_user_status(uuid, public.account_status) from anon;

revoke all on function public.list_platform_admins() from public;
revoke all on function public.list_platform_admins() from anon;

revoke all on function public.company_stats() from public;
revoke all on function public.company_stats() from anon;

revoke all on function public.faculty_stats() from public;
revoke all on function public.faculty_stats() from anon;

revoke all on function public.platform_stats() from public;
revoke all on function public.platform_stats() from anon;

-- Trigger and event-trigger functions are not callable as Data API RPCs.
revoke all on function public.audit_row_change() from public;
revoke all on function public.audit_row_change() from anon;
revoke all on function public.audit_row_change() from authenticated;

revoke all on function public.guard_application() from public;
revoke all on function public.guard_application() from anon;
revoke all on function public.guard_application() from authenticated;

revoke all on function public.guard_profile_update() from public;
revoke all on function public.guard_profile_update() from anon;
revoke all on function public.guard_profile_update() from authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;
