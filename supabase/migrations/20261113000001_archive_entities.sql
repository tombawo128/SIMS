-- Archive and restore support for users, universities, and companies.
-- Safe to apply more than once; existing records are preserved.

alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.universities add column if not exists deleted_at timestamptz;
alter table public.universities add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.companies add column if not exists deleted_at timestamptz;
alter table public.companies add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create table if not exists public.deleted_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('user','university','company')),
  entity_id uuid not null,
  display_name text not null,
  details jsonb not null default '{}'::jsonb,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete set null
);

create index if not exists deleted_entities_type_deleted_idx
  on public.deleted_entities(entity_type, deleted_at desc)
  where restored_at is null;

alter table public.deleted_entities enable row level security;
grant select on public.deleted_entities to authenticated;

drop policy if exists deleted_entities_platform_admin on public.deleted_entities;
create policy deleted_entities_platform_admin on public.deleted_entities
  for select to authenticated
  using (public.is_platform_admin());

create or replace function public.delete_tenant(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_details jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform administrator can archive tenants';
  end if;

  if p_kind = 'university' then
    select name, to_jsonb(u) into v_name, v_details
    from public.universities u
    where id = p_id and deleted_at is null
    for update;

    if not found then raise exception 'University not found or already archived'; end if;

    update public.universities
    set deleted_at = now(), deleted_by = auth.uid(), status = 'suspended'
    where id = p_id;

  elsif p_kind = 'company' then
    select name, to_jsonb(c) into v_name, v_details
    from public.companies c
    where id = p_id and deleted_at is null
    for update;

    if not found then raise exception 'Company not found or already archived'; end if;

    update public.companies
    set deleted_at = now(), deleted_by = auth.uid(), status = 'suspended'
    where id = p_id;
  else
    raise exception 'Invalid tenant type';
  end if;

  insert into public.deleted_entities(entity_type, entity_id, display_name, details, deleted_by)
  values (p_kind, p_id, v_name, coalesce(v_details, '{}'::jsonb), auth.uid());
end;
$$;

create or replace function public.archive_user(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_details jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform administrator can archive users';
  end if;
  if p_id = auth.uid() then raise exception 'You cannot archive your own account'; end if;

  select full_name, to_jsonb(p)
  into v_name, v_details
  from public.profiles p
  where id = p_id and deleted_at is null and role <> 'platform_admin'
  for update;

  if not found then raise exception 'User not found or already archived'; end if;

  update public.profiles
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_id;

  insert into public.deleted_entities(entity_type, entity_id, display_name, details, deleted_by)
  values ('user', p_id, coalesce(v_name, 'Unnamed user'), coalesce(v_details, '{}'::jsonb), auth.uid());
end;
$$;

create or replace function public.restore_deleted_entity(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $
declare
  v_details jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a platform administrator can restore archived records';
  end if;

  select details into v_details
  from public.deleted_entities
  where entity_type = p_kind and entity_id = p_id and restored_at is null
  order by deleted_at desc
  limit 1
  for update;

  if not found then raise exception 'Archived record not found'; end if;

  if p_kind = 'user' then
    update public.profiles
    set deleted_at = null, deleted_by = null
    where id = p_id and deleted_at is not null;
  elsif p_kind = 'university' then
    update public.universities
    set deleted_at = null, deleted_by = null,
        status = coalesce(v_details->>'status', 'active')::public.tenant_status
    where id = p_id and deleted_at is not null;
  elsif p_kind = 'company' then
    update public.companies
    set deleted_at = null, deleted_by = null,
        status = coalesce(v_details->>'status', 'active')
    where id = p_id and deleted_at is not null;
  else
    raise exception 'Invalid archive type';
  end if;

  if not found then raise exception 'Archived record not found'; end if;

  update public.deleted_entities
  set restored_at = now(), restored_by = auth.uid()
  where entity_type = p_kind and entity_id = p_id and restored_at is null;
end;
$;

revoke all on function public.delete_tenant(text, uuid) from public, anon;
revoke all on function public.archive_user(uuid) from public, anon;
revoke all on function public.restore_deleted_entity(text, uuid) from public, anon;
grant execute on function public.delete_tenant(text, uuid) to authenticated;
grant execute on function public.archive_user(uuid) to authenticated;
grant execute on function public.restore_deleted_entity(text, uuid) to authenticated;
