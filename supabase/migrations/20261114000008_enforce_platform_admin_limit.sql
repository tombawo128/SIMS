-- Enforce the platform-administrator ceiling inside PostgreSQL.
-- The transaction-scoped advisory lock serializes concurrent profile creation.

alter table public.profiles
  add column platform_admin_slot smallint;

with ranked_admins as (
  select id, row_number() over (order by id)::smallint as slot
  from public.profiles
  where role = 'platform_admin'::public.user_role
)
update public.profiles as p
set platform_admin_slot = r.slot
from ranked_admins as r
where p.id = r.id;

alter table public.profiles
  add constraint profiles_platform_admin_slot_range
  check (platform_admin_slot is null or platform_admin_slot in (1, 2));

create unique index profiles_platform_admin_slot_unique
  on public.profiles (platform_admin_slot)
  where platform_admin_slot is not null;

alter table public.profiles
  add constraint profiles_platform_admin_slot_role_check
  check (
    (role = 'platform_admin'::public.user_role and platform_admin_slot is not null)
    or
    (role <> 'platform_admin'::public.user_role and platform_admin_slot is null)
  );

create or replace function public.assign_platform_admin_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'platform_admin'::public.user_role then
    if tg_op = 'UPDATE' then
      if old.role = 'platform_admin'::public.user_role
        and old.platform_admin_slot is not null then
        new.platform_admin_slot := old.platform_admin_slot;
        return new;
      end if;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(723451, 1);

    select available.slot
      into new.platform_admin_slot
    from pg_catalog.generate_series(1, 2) as available(slot)
    where not exists (
      select 1
      from public.profiles as existing
      where existing.platform_admin_slot = available.slot
        and existing.id is distinct from new.id
    )
    order by available.slot
    limit 1;

    if new.platform_admin_slot is null then
      raise exception 'The maximum number of platform administrators has been reached'
        using errcode = '23514';
    end if;
  else
    new.platform_admin_slot := null;
  end if;

  return new;
end;
$$;

create trigger profiles_assign_platform_admin_slot
before insert or update on public.profiles
for each row execute function public.assign_platform_admin_slot();
