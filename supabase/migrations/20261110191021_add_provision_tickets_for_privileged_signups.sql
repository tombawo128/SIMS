-- One-time server-side authorization tickets for privileged account creation.
create table public.provision_tickets (
  email text primary key,
  role public.user_role not null,
  university_id uuid,
  company_id uuid,
  created_at timestamptz not null default now()
);

alter table public.provision_tickets enable row level security;
revoke all on table public.provision_tickets from public, anon, authenticated;
grant all on table public.provision_tickets to service_role;

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
  v_university uuid;
  v_company uuid;
  v_name text := coalesce(nullif(v_meta ->> 'full_name', ''), split_part(new.email, '@', 1));
  v_year integer;
  v_ticket public.provision_tickets%rowtype;
begin
  -- Expire old tickets and atomically consume a fresh ticket for this email.
  delete from public.provision_tickets
  where created_at <= now() - interval '2 minutes';

  delete from public.provision_tickets
  where lower(email) = lower(coalesce(new.email, ''))
  returning * into v_ticket;

  if found then
    v_role := v_ticket.role;
    v_university := v_ticket.university_id;
    v_company := v_ticket.company_id;
  elsif v_provisioned
    and v_app ->> 'role' in (
      'student', 'faculty_supervisor', 'coordinator', 'site_supervisor', 'company_admin', 'platform_admin'
    ) then
    v_role := (v_app ->> 'role')::public.user_role;
    v_university := public.try_uuid(v_app ->> 'university_id');
    v_company := public.try_uuid(v_app ->> 'company_id');
  else
    -- Public sign-ups can submit arbitrary user_metadata, so only a university is accepted from it.
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

  insert into public.profiles (id, role, university_id, company_id, full_name, email)
  values (new.id, v_role, v_university, v_company, v_name, coalesce(new.email, ''));

  if v_role = 'student' then
    insert into public.student_profiles (user_id, student_id, program, year)
    values (new.id, nullif(v_meta ->> 'student_id', ''), nullif(v_meta ->> 'program', ''), v_year);
  end if;

  return new;
end;
$$;