-- Production-safe follow-up hardening for storage and public RPC grants.
drop policy if exists reports_owner_delete on storage.objects;
create policy reports_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'reports'
    and public.auth_role() = 'student'::public.user_role
    and public.can_view_placement(public.try_uuid(split_part(name, '/', 1)))
    and split_part(name, '/', 2) = (select auth.uid())::text
  );

revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.auth_company_id() from public, anon;
revoke execute on function public.auth_university_id() from public, anon;
revoke execute on function public.is_platform_admin() from public, anon;
revoke execute on function public.can_manage_posting(uuid) from public, anon;
revoke execute on function public.can_read_cv(text) from public, anon;
revoke execute on function public.can_view_placement(uuid) from public, anon;
revoke execute on function public.can_view_posting(uuid) from public, anon;
revoke execute on function public.can_view_profile(uuid) from public, anon;
revoke execute on function public.company_stats() from public, anon;
revoke execute on function public.faculty_stats() from public, anon;
revoke execute on function public.platform_stats() from public, anon;
revoke execute on function public.list_platform_admins() from public, anon;
revoke execute on function public.set_user_status(uuid, public.account_status) from public, anon;

grant execute on function public.auth_role() to authenticated, service_role;
grant execute on function public.auth_company_id() to authenticated, service_role;
grant execute on function public.auth_university_id() to authenticated, service_role;
grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.can_manage_posting(uuid) to authenticated, service_role;
grant execute on function public.can_read_cv(text) to authenticated, service_role;
grant execute on function public.can_view_placement(uuid) to authenticated, service_role;
grant execute on function public.can_view_posting(uuid) to authenticated, service_role;
grant execute on function public.can_view_profile(uuid) to authenticated, service_role;
grant execute on function public.company_stats() to authenticated, service_role;
grant execute on function public.faculty_stats() to authenticated, service_role;
grant execute on function public.platform_stats() to authenticated, service_role;
grant execute on function public.list_platform_admins() to authenticated, service_role;
grant execute on function public.set_user_status(uuid, public.account_status) to authenticated, service_role;

revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.guard_application() from public, anon, authenticated;
revoke all on function public.guard_profile_update() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.try_uuid(text) from public, anon;
grant execute on function public.try_uuid(text) to authenticated, service_role;