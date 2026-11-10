-- SIMS complete backend setup.
-- Paste this whole file into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Order: schema -> functions/RPCs -> RLS -> storage -> realtime.
-- This is a concatenation of supabase/migrations/*.sql (the source of truth).
-- Optional demo data afterwards: run supabase/seed.sql once (never on real production).

-- Core schema for the multi-tenant SIMS platform.

create extension if not exists pgcrypto;

create type public.user_role as enum (
  'student',
  'faculty_supervisor',
  'coordinator',
  'site_supervisor',
  'company_admin',
  'platform_admin'
);
create type public.tenant_status as enum ('active', 'suspended');
create type public.posting_type as enum ('internship', 'graduate_job', 'part_time');
create type public.posting_status as enum ('draft', 'published', 'closed');
create type public.posting_visibility as enum ('all_universities', 'selected_universities');
create type public.application_status as enum (
  'draft',
  'submitted',
  'under_review',
  'shortlisted',
  'accepted',
  'rejected'
);
create type public.placement_status as enum ('active', 'completed', 'cancelled');
create type public.log_status as enum ('draft', 'submitted', 'approved', 'needs_revision');
create type public.evaluation_type as enum ('midterm', 'final');
create type public.evaluation_role as enum ('site_supervisor', 'faculty_supervisor');
create type public.checkin_type as enum ('visit', 'call', 'email');
create type public.document_type as enum ('cv', 'report', 'other');

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text,
  logo_url text,
  status public.tenant_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry text,
  website text,
  logo_url text,
  status public.tenant_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'student',
  university_id uuid references public.universities (id) on delete restrict,
  company_id uuid references public.companies (id) on delete restrict,
  full_name text not null default '',
  email text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_tenant_check check (
    (role in ('student', 'faculty_supervisor', 'coordinator')
      and university_id is not null and company_id is null)
    or (role in ('site_supervisor', 'company_admin')
      and company_id is not null and university_id is null)
    or (role = 'platform_admin'
      and university_id is null and company_id is null)
  )
);

create table public.student_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  student_id text,
  program text,
  year integer check (year between 1 and 8),
  cv_path text,
  skills text[] not null default '{}'
);

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null,
  type public.posting_type not null default 'internship',
  description text not null default '',
  requirements text not null default '',
  location text not null default '',
  is_remote boolean not null default false,
  duration_months integer check (duration_months is null or duration_months > 0),
  stipend text,
  deadline date,
  status public.posting_status not null default 'draft',
  visibility public.posting_visibility not null default 'all_universities',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posting_universities (
  posting_id uuid not null references public.job_postings (id) on delete cascade,
  university_id uuid not null references public.universities (id) on delete cascade,
  primary key (posting_id, university_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  posting_id uuid not null references public.job_postings (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  university_id uuid not null references public.universities (id) on delete restrict,
  company_id uuid not null references public.companies (id) on delete restrict,
  cv_path text,
  cover_letter text not null default '',
  status public.application_status not null default 'submitted',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_posting_student_key unique (posting_id, student_id)
);

create table public.placements (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  university_id uuid not null references public.universities (id) on delete restrict,
  company_id uuid not null references public.companies (id) on delete restrict,
  posting_id uuid not null references public.job_postings (id) on delete restrict,
  site_supervisor_id uuid not null references public.profiles (id) on delete restrict,
  faculty_supervisor_id uuid references public.profiles (id) on delete set null,
  start_date date not null,
  end_date date not null,
  status public.placement_status not null default 'active',
  final_grade numeric(5, 2) check (final_grade is null or final_grade between 0 and 100),
  grade_notes text,
  graded_by uuid references public.profiles (id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint placements_dates_check check (end_date > start_date)
);

create table public.weekly_logs (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements (id) on delete cascade,
  week_number integer not null check (week_number > 0),
  hours numeric(5, 2) not null default 0 check (hours >= 0 and hours <= 168),
  tasks text not null default '',
  learning_outcomes text not null default '',
  status public.log_status not null default 'draft',
  supervisor_comment text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_logs_placement_week_key unique (placement_id, week_number)
);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements (id) on delete cascade,
  evaluator_id uuid not null references public.profiles (id) on delete cascade,
  evaluator_role public.evaluation_role not null,
  type public.evaluation_type not null,
  rubric_scores jsonb not null default '{}'::jsonb,
  comments text not null default '',
  overall_score numeric(3, 2) check (overall_score is null or overall_score between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluations_unique_key unique (placement_id, evaluator_role, type)
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements (id) on delete cascade,
  faculty_supervisor_id uuid not null references public.profiles (id) on delete cascade,
  type public.checkin_type not null default 'call',
  notes text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  placement_id uuid references public.placements (id) on delete cascade,
  type public.document_type not null default 'other',
  storage_path text not null,
  file_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigserial primary key,
  actor_id uuid,
  entity text not null,
  entity_id text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_university_idx on public.profiles (university_id);
create index profiles_company_idx on public.profiles (company_id);
create index profiles_role_idx on public.profiles (role);
create index job_postings_company_idx on public.job_postings (company_id, status);
create index job_postings_deadline_idx on public.job_postings (deadline);
create index posting_universities_university_idx on public.posting_universities (university_id);
create index applications_posting_idx on public.applications (posting_id);
create index applications_student_idx on public.applications (student_id);
create index applications_company_idx on public.applications (company_id);
create index applications_university_idx on public.applications (university_id);
create index applications_status_idx on public.applications (status);
create index placements_student_idx on public.placements (student_id);
create index placements_site_supervisor_idx on public.placements (site_supervisor_id);
create index placements_faculty_supervisor_idx on public.placements (faculty_supervisor_id);
create index placements_university_idx on public.placements (university_id);
create index placements_company_idx on public.placements (company_id);
create index weekly_logs_placement_idx on public.weekly_logs (placement_id);
create index evaluations_placement_idx on public.evaluations (placement_id);
create index check_ins_placement_idx on public.check_ins (placement_id);
create index documents_placement_idx on public.documents (placement_id);
create index documents_owner_idx on public.documents (owner_id);
create index notifications_user_idx on public.notifications (user_id, read_at);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger universities_updated_at before update on public.universities
  for each row execute function public.set_updated_at();
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger job_postings_updated_at before update on public.job_postings
  for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger placements_updated_at before update on public.placements
  for each row execute function public.set_updated_at();
create trigger weekly_logs_updated_at before update on public.weekly_logs
  for each row execute function public.set_updated_at();
create trigger evaluations_updated_at before update on public.evaluations
  for each row execute function public.set_updated_at();

-- Helpers, guards, audit trail, and SECURITY DEFINER workflow RPCs.

create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_university_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select university_id from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'platform_admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target
      and (
        p.id = auth.uid()
        or (public.auth_role() = 'coordinator' and p.university_id = public.auth_university_id())
        or (
          public.auth_role() = 'faculty_supervisor'
          and (
            (p.university_id = public.auth_university_id() and p.role in ('student', 'faculty_supervisor', 'coordinator'))
            or exists (
              select 1 from public.placements pl
              where pl.faculty_supervisor_id = auth.uid()
                and p.id in (pl.student_id, pl.site_supervisor_id)
            )
          )
        )
        or (public.auth_role() = 'company_admin' and p.company_id = public.auth_company_id())
        or (
          public.auth_role() = 'site_supervisor'
          and (
            p.company_id = public.auth_company_id()
            or exists (
              select 1 from public.applications a
              where a.company_id = public.auth_company_id() and a.student_id = p.id
            )
            or exists (
              select 1 from public.placements pl
              where pl.company_id = public.auth_company_id()
                and p.id in (pl.student_id, pl.faculty_supervisor_id)
            )
          )
        )
        or (
          public.auth_role() = 'student'
          and exists (
            select 1 from public.placements pl
            where pl.student_id = auth.uid()
              and p.id in (pl.site_supervisor_id, pl.faculty_supervisor_id)
          )
        )
      )
  );
$$;

create or replace function public.can_view_placement(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.placements pl
    where pl.id = target
      and (
        pl.student_id = auth.uid()
        or pl.site_supervisor_id = auth.uid()
        or pl.faculty_supervisor_id = auth.uid()
        or (public.auth_role() = 'coordinator' and pl.university_id = public.auth_university_id())
        or (public.auth_role() = 'company_admin' and pl.company_id = public.auth_company_id())
      )
  );
$$;

create or replace function public.can_view_posting(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_postings p
    where p.id = target
      and (
        (
          p.status = 'published'
          and (
            p.visibility = 'all_universities'
            or exists (
              select 1 from public.posting_universities pu
              where pu.posting_id = p.id and pu.university_id = public.auth_university_id()
            )
          )
        )
        or p.company_id = public.auth_company_id()
        or public.is_platform_admin()
      )
  );
$$;

create or replace function public.can_manage_posting(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_postings p
    where p.id = target
      and p.company_id = public.auth_company_id()
      and public.auth_role() in ('company_admin', 'site_supervisor')
  );
$$;

create or replace function public.can_read_cv(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) = auth.uid()::text then true
    else exists (
      select 1
      from public.applications a
      where a.cv_path = object_name
        and (a.company_id = public.auth_company_id() or a.university_id = public.auth_university_id())
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Guards and triggers
-- ---------------------------------------------------------------------------

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
      or new.email is distinct from old.email then
      raise exception 'You cannot change your role or tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.guard_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posting public.job_postings%rowtype;
  v_profile public.profiles%rowtype;
begin
  select * into v_posting from public.job_postings where id = new.posting_id;
  if not found then
    raise exception 'Job posting not found';
  end if;

  select * into v_profile from public.profiles where id = new.student_id;
  if not found or v_profile.role <> 'student' then
    raise exception 'Only students can apply';
  end if;

  if v_posting.company_id <> new.company_id or v_profile.university_id <> new.university_id then
    raise exception 'Application tenant mismatch';
  end if;

  if v_posting.status <> 'published' then
    raise exception 'This posting is not open for applications';
  end if;

  if v_posting.visibility = 'selected_universities' and not exists (
    select 1 from public.posting_universities pu
    where pu.posting_id = v_posting.id and pu.university_id = new.university_id
  ) then
    raise exception 'This posting is not open to your university';
  end if;

  if auth.uid() is not null then
    if new.student_id <> auth.uid() then
      raise exception 'You can only apply for yourself';
    end if;
    if new.status not in ('draft', 'submitted') then
      raise exception 'Applications must be submitted through the application form';
    end if;
  end if;

  return new;
end;
$$;

create trigger applications_guard before insert on public.applications
  for each row execute function public.guard_application();

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
begin
  -- Only the service role can write app_metadata. Public sign-ups can submit arbitrary
  -- user_metadata, so privileged roles and company tenancy are accepted only from
  -- accounts provisioned by the invite-user Edge Function (or seed data).
  if v_provisioned
    and v_app ->> 'role' in (
      'student', 'faculty_supervisor', 'coordinator', 'site_supervisor', 'company_admin', 'platform_admin'
    ) then
    v_role := (v_app ->> 'role')::public.user_role;
    v_university := public.try_uuid(v_app ->> 'university_id');
    v_company := public.try_uuid(v_app ->> 'company_id');
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

  insert into public.profiles (id, role, university_id, company_id, full_name, email)
  values (new.id, v_role, v_university, v_company, v_name, coalesce(new.email, ''));

  if v_role = 'student' then
    insert into public.student_profiles (user_id, student_id, program, year)
    values (new.id, nullif(v_meta ->> 'student_id', ''), nullif(v_meta ->> 'program', ''), v_year);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');

  insert into public.audit_logs (actor_id, entity, entity_id, action, metadata)
  values (
    auth.uid(),
    tg_table_name,
    v_id,
    lower(tg_op),
    case
      when tg_op = 'DELETE' then to_jsonb(old)
      when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else to_jsonb(new)
    end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger job_postings_audit after insert or update or delete on public.job_postings
  for each row execute function public.audit_row_change();
create trigger applications_audit after insert or update or delete on public.applications
  for each row execute function public.audit_row_change();
create trigger placements_audit after insert or update or delete on public.placements
  for each row execute function public.audit_row_change();
create trigger weekly_logs_audit after insert or update or delete on public.weekly_logs
  for each row execute function public.audit_row_change();
create trigger evaluations_audit after insert or update or delete on public.evaluations
  for each row execute function public.audit_row_change();

create or replace function public.notify_user(
  p_user uuid,
  p_title text,
  p_body text,
  p_link text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, title, body, link)
  values (p_user, p_title, p_body, p_link);
$$;

revoke all on function public.notify_user(uuid, text, text, text) from public;

-- ---------------------------------------------------------------------------
-- Workflow RPCs
-- ---------------------------------------------------------------------------

create or replace function public.accept_application(
  p_application_id uuid,
  p_site_supervisor_id uuid,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
  v_posting public.job_postings%rowtype;
  v_supervisor public.profiles%rowtype;
  v_company_name text;
  v_placement_id uuid;
begin
  if public.auth_role() not in ('company_admin', 'site_supervisor') then
    raise exception 'Not authorized to accept applications';
  end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;

  select * into v_posting from public.job_postings where id = v_app.posting_id;
  if v_posting.company_id is distinct from public.auth_company_id() then
    raise exception 'Not authorized to accept applications';
  end if;

  if v_app.status not in ('submitted', 'under_review', 'shortlisted') then
    raise exception 'Application cannot be accepted in its current state';
  end if;

  select * into v_supervisor from public.profiles where id = p_site_supervisor_id;
  if not found
    or v_supervisor.company_id is distinct from v_posting.company_id
    or v_supervisor.role not in ('site_supervisor', 'company_admin') then
    raise exception 'Select a valid site supervisor for this company';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'End date must be after the start date';
  end if;

  update public.applications
    set status = 'rejected',
        rejection_reason = 'Student accepted another opportunity',
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where student_id = v_app.student_id
      and id <> v_app.id
      and status in ('submitted', 'under_review', 'shortlisted');

  update public.applications
    set status = 'accepted',
        rejection_reason = null,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = v_app.id;

  insert into public.placements (
    application_id, student_id, university_id, company_id, posting_id,
    site_supervisor_id, start_date, end_date, status
  )
  values (
    v_app.id, v_app.student_id, v_app.university_id, v_app.company_id, v_app.posting_id,
    p_site_supervisor_id, p_start_date, p_end_date, 'active'
  )
  returning id into v_placement_id;

  select name into v_company_name from public.companies where id = v_posting.company_id;

  perform public.notify_user(
    v_app.student_id,
    'Application accepted',
    'You have been accepted for ' || v_posting.title || ' at ' || coalesce(v_company_name, 'the company') || '.',
    '/placements/' || v_placement_id
  );
  perform public.notify_user(
    p_site_supervisor_id,
    'New intern assigned',
    'A student has been placed under your supervision.',
    '/placements/' || v_placement_id
  );

  insert into public.notifications (user_id, title, body, link)
  select id,
         'New placement recorded',
         'A student from your university has been placed at ' || coalesce(v_company_name, 'a company') || '.',
         '/placements/' || v_placement_id
  from public.profiles
  where role = 'coordinator' and university_id = v_app.university_id;

  return v_placement_id;
end;
$$;

create or replace function public.review_application(
  p_application_id uuid,
  p_status public.application_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
  v_title text;
begin
  if public.auth_role() not in ('company_admin', 'site_supervisor') then
    raise exception 'Not authorized to review applications';
  end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;

  if v_app.company_id is distinct from public.auth_company_id() then
    raise exception 'Not authorized to review applications';
  end if;

  if v_app.status in ('accepted', 'rejected') then
    raise exception 'This application is already closed';
  end if;

  if p_status not in ('under_review', 'shortlisted', 'rejected') then
    raise exception 'Invalid application status transition';
  end if;

  update public.applications
    set status = p_status,
        rejection_reason = case when p_status = 'rejected' then coalesce(nullif(p_reason, ''), 'Not selected') else null end,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_application_id;

  select title into v_title from public.job_postings where id = v_app.posting_id;

  perform public.notify_user(
    v_app.student_id,
    'Application update',
    'Your application for ' || coalesce(v_title, 'a role') || ' is now ' || replace(p_status::text, '_', ' ') || '.',
    '/applications'
  );
end;
$$;

create or replace function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if not found or v_app.student_id <> auth.uid() then
    raise exception 'Application not found';
  end if;
  if v_app.status not in ('submitted', 'under_review', 'shortlisted') then
    raise exception 'This application can no longer be withdrawn';
  end if;

  update public.applications
    set status = 'rejected', rejection_reason = 'Withdrawn by student', reviewed_at = now()
    where id = p_application_id;
end;
$$;

create or replace function public.assign_faculty_supervisor(
  p_placement_id uuid,
  p_faculty_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_placement public.placements%rowtype;
  v_faculty public.profiles%rowtype;
begin
  if public.auth_role() <> 'coordinator' then
    raise exception 'Only internship coordinators can assign faculty supervisors';
  end if;

  select * into v_placement from public.placements where id = p_placement_id for update;
  if not found or v_placement.university_id <> public.auth_university_id() then
    raise exception 'Placement not found';
  end if;

  select * into v_faculty from public.profiles where id = p_faculty_id;
  if not found
    or v_faculty.role <> 'faculty_supervisor'
    or v_faculty.university_id <> public.auth_university_id() then
    raise exception 'Select a faculty supervisor from your university';
  end if;

  update public.placements set faculty_supervisor_id = p_faculty_id where id = p_placement_id;

  perform public.notify_user(
    p_faculty_id,
    'New placement assigned',
    'You are now supervising a student placement.',
    '/placements/' || p_placement_id
  );
  perform public.notify_user(
    v_placement.student_id,
    'Faculty supervisor assigned',
    'A faculty supervisor has been assigned to your placement.',
    '/placements/' || p_placement_id
  );
end;
$$;

create or replace function public.upsert_weekly_log(
  p_placement_id uuid,
  p_week_number integer,
  p_hours numeric,
  p_tasks text,
  p_learning_outcomes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_placement public.placements%rowtype;
  v_log public.weekly_logs%rowtype;
  v_id uuid;
begin
  select * into v_placement from public.placements where id = p_placement_id;
  if not found or v_placement.student_id <> auth.uid() then
    raise exception 'Placement not found';
  end if;
  if v_placement.status <> 'active' then
    raise exception 'Only active placements accept weekly logs';
  end if;
  if p_week_number is null or p_week_number < 1 then
    raise exception 'Week number must be at least 1';
  end if;

  select * into v_log from public.weekly_logs
  where placement_id = p_placement_id and week_number = p_week_number;

  if found then
    if v_log.status not in ('draft', 'needs_revision') then
      raise exception 'This log can no longer be edited';
    end if;
    update public.weekly_logs
      set hours = coalesce(p_hours, 0),
          tasks = coalesce(p_tasks, ''),
          learning_outcomes = coalesce(p_learning_outcomes, '')
      where id = v_log.id
      returning id into v_id;
  else
    insert into public.weekly_logs (placement_id, week_number, hours, tasks, learning_outcomes)
    values (p_placement_id, p_week_number, coalesce(p_hours, 0), coalesce(p_tasks, ''), coalesce(p_learning_outcomes, ''))
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.submit_weekly_log(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.weekly_logs%rowtype;
  v_placement public.placements%rowtype;
begin
  select * into v_log from public.weekly_logs where id = p_log_id for update;
  if not found then
    raise exception 'Weekly log not found';
  end if;

  select * into v_placement from public.placements where id = v_log.placement_id;
  if v_placement.student_id <> auth.uid() then
    raise exception 'Not authorized to submit this log';
  end if;
  if v_log.status not in ('draft', 'needs_revision') then
    raise exception 'This log has already been submitted';
  end if;
  if v_log.hours <= 0 or length(trim(v_log.tasks)) = 0 then
    raise exception 'Add hours worked and tasks before submitting';
  end if;

  update public.weekly_logs
    set status = 'submitted', submitted_at = now(), reviewed_at = null
    where id = p_log_id;

  perform public.notify_user(
    v_placement.site_supervisor_id,
    'Weekly log submitted',
    'A student submitted a weekly log for review.',
    '/placements/' || v_placement.id
  );
end;
$$;

create or replace function public.review_weekly_log(
  p_log_id uuid,
  p_decision public.log_status,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.weekly_logs%rowtype;
  v_placement public.placements%rowtype;
  v_allowed boolean;
begin
  select * into v_log from public.weekly_logs where id = p_log_id for update;
  if not found then
    raise exception 'Weekly log not found';
  end if;

  select * into v_placement from public.placements where id = v_log.placement_id;

  v_allowed := (
    (public.auth_role() = 'site_supervisor' and v_placement.site_supervisor_id = auth.uid())
    or (public.auth_role() = 'company_admin' and v_placement.company_id = public.auth_company_id())
    or (public.auth_role() = 'faculty_supervisor' and v_placement.faculty_supervisor_id = auth.uid())
  );

  if not v_allowed then
    raise exception 'Not authorized to review this log';
  end if;
  if p_decision not in ('approved', 'needs_revision') then
    raise exception 'Decision must be approved or needs_revision';
  end if;
  if v_log.status <> 'submitted' then
    raise exception 'Only submitted logs can be reviewed';
  end if;

  update public.weekly_logs
    set status = p_decision,
        supervisor_comment = nullif(p_comment, ''),
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_log_id;

  perform public.notify_user(
    v_placement.student_id,
    'Weekly log reviewed',
    'Your week ' || v_log.week_number || ' log was marked ' || replace(p_decision::text, '_', ' ') || '.',
    '/placements/' || v_placement.id
  );
end;
$$;

create or replace function public.submit_evaluation(
  p_placement_id uuid,
  p_type public.evaluation_type,
  p_rubric jsonb,
  p_comments text,
  p_overall numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_placement public.placements%rowtype;
  v_role public.evaluation_role;
begin
  select * into v_placement from public.placements where id = p_placement_id;
  if not found then
    raise exception 'Placement not found';
  end if;

  if v_placement.site_supervisor_id = auth.uid()
    or (public.auth_role() = 'company_admin' and v_placement.company_id = public.auth_company_id()) then
    v_role := 'site_supervisor';
  elsif public.auth_role() = 'faculty_supervisor' and v_placement.faculty_supervisor_id = auth.uid() then
    if p_type <> 'final' then
      raise exception 'Faculty supervisors can only submit final evaluations';
    end if;
    v_role := 'faculty_supervisor';
  else
    raise exception 'Not authorized to evaluate this placement';
  end if;

  insert into public.evaluations (placement_id, evaluator_id, evaluator_role, type, rubric_scores, comments, overall_score)
  values (p_placement_id, auth.uid(), v_role, p_type, coalesce(p_rubric, '{}'::jsonb), coalesce(p_comments, ''), p_overall)
  on conflict (placement_id, evaluator_role, type) do update
    set rubric_scores = excluded.rubric_scores,
        comments = excluded.comments,
        overall_score = excluded.overall_score;

  perform public.notify_user(
    v_placement.student_id,
    'Evaluation submitted',
    'A ' || p_type::text || ' evaluation has been submitted for your placement.',
    '/placements/' || p_placement_id
  );
end;
$$;

create or replace function public.add_check_in(
  p_placement_id uuid,
  p_type public.checkin_type,
  p_notes text,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_placement public.placements%rowtype;
  v_id uuid;
begin
  select * into v_placement from public.placements where id = p_placement_id;
  if not found or v_placement.faculty_supervisor_id <> auth.uid() then
    raise exception 'Not authorized to log a check-in for this placement';
  end if;

  insert into public.check_ins (placement_id, faculty_supervisor_id, type, notes, occurred_at)
  values (p_placement_id, auth.uid(), p_type, coalesce(p_notes, ''), coalesce(p_occurred_at, now()))
  returning id into v_id;

  perform public.notify_user(
    v_placement.student_id,
    'Supervisor check-in',
    'Your faculty supervisor logged a ' || p_type::text || '.',
    '/placements/' || p_placement_id
  );

  return v_id;
end;
$$;

create or replace function public.record_grade(
  p_placement_id uuid,
  p_grade numeric,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_placement public.placements%rowtype;
begin
  select * into v_placement from public.placements where id = p_placement_id;
  if not found then
    raise exception 'Placement not found';
  end if;

  if not (
    (public.auth_role() = 'faculty_supervisor' and v_placement.faculty_supervisor_id = auth.uid())
    or (public.auth_role() = 'coordinator' and v_placement.university_id = public.auth_university_id())
  ) then
    raise exception 'Not authorized to record a grade';
  end if;

  if p_grade is null or p_grade < 0 or p_grade > 100 then
    raise exception 'Grade must be between 0 and 100';
  end if;

  update public.placements
    set final_grade = p_grade,
        grade_notes = p_notes,
        graded_by = auth.uid(),
        graded_at = now()
    where id = p_placement_id;

  perform public.notify_user(
    v_placement.student_id,
    'Final grade recorded',
    'Your final grade has been recorded.',
    '/placements/' || p_placement_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Read helpers / dashboards
-- ---------------------------------------------------------------------------

create or replace function public.search_postings(
  p_query text default null,
  p_type public.posting_type default null,
  p_location text default null,
  p_remote boolean default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns setof public.job_postings
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from public.job_postings p
  where p.status = 'published'
    and (
      p_query is null or p_query = ''
      or p.title ilike '%' || p_query || '%'
      or p.description ilike '%' || p_query || '%'
      or p.requirements ilike '%' || p_query || '%'
    )
    and (p_type is null or p.type = p_type)
    and (p_location is null or p_location = '' or p.location ilike '%' || p_location || '%')
    and (p_remote is null or p.is_remote = p_remote)
  order by p.created_at desc
  limit least(coalesce(p_limit, 20), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.university_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.auth_university_id();
  v_role public.user_role := public.auth_role();
begin
  if v_uid is null or v_role not in ('coordinator', 'faculty_supervisor') then
    raise exception 'Not authorized';
  end if;

  return jsonb_build_object(
    'students', (select count(*) from public.profiles where university_id = v_uid and role = 'student'),
    'faculty', (select count(*) from public.profiles where university_id = v_uid and role = 'faculty_supervisor'),
    'active_placements', (select count(*) from public.placements where university_id = v_uid and status = 'active'),
    'pending_applications', (select count(*) from public.applications where university_id = v_uid and status in ('submitted', 'under_review')),
    'pending_logs', (
      select count(*) from public.weekly_logs l
      join public.placements pl on pl.id = l.placement_id
      where pl.university_id = v_uid and l.status = 'submitted'
    ),
    'completed_placements', (select count(*) from public.placements where university_id = v_uid and status = 'completed'),
    'placements_without_faculty', (
      select count(*) from public.placements
      where university_id = v_uid and faculty_supervisor_id is null and status = 'active'
    )
  );
end;
$$;

create or replace function public.faculty_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.auth_role() <> 'faculty_supervisor' then
    raise exception 'Not authorized';
  end if;

  return jsonb_build_object(
    'placements', (select count(*) from public.placements where faculty_supervisor_id = auth.uid()),
    'pending_logs', (
      select count(*) from public.weekly_logs l
      join public.placements pl on pl.id = l.placement_id
      where pl.faculty_supervisor_id = auth.uid() and l.status = 'submitted'
    ),
    'students', (select count(*) from public.placements where faculty_supervisor_id = auth.uid() and status = 'active'),
    'check_ins', (select count(*) from public.check_ins where faculty_supervisor_id = auth.uid())
  );
end;
$$;

create or replace function public.company_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cid uuid := public.auth_company_id();
begin
  if v_cid is null or public.auth_role() not in ('company_admin', 'site_supervisor') then
    raise exception 'Not authorized';
  end if;

  return jsonb_build_object(
    'total_postings', (select count(*) from public.job_postings where company_id = v_cid),
    'published_postings', (select count(*) from public.job_postings where company_id = v_cid and status = 'published'),
    'new_applications', (select count(*) from public.applications where company_id = v_cid and status in ('submitted', 'under_review')),
    'active_placements', (select count(*) from public.placements where company_id = v_cid and status = 'active'),
    'pending_logs', (
      select count(*) from public.weekly_logs l
      join public.placements pl on pl.id = l.placement_id
      where pl.company_id = v_cid and l.status = 'submitted'
    )
  );
end;
$$;

create or replace function public.platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return jsonb_build_object(
    'universities', (select count(*) from public.universities),
    'companies', (select count(*) from public.companies),
    'students', (select count(*) from public.profiles where role = 'student'),
    'published_postings', (select count(*) from public.job_postings where status = 'published'),
    'applications', (select count(*) from public.applications),
    'active_placements', (select count(*) from public.placements where status = 'active'),
    'completed_placements', (select count(*) from public.placements where status = 'completed')
  );
end;
$$;

-- Row Level Security: the only authorization boundary for tenant data.

alter table public.universities enable row level security;
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.job_postings enable row level security;
alter table public.posting_universities enable row level security;
alter table public.applications enable row level security;
alter table public.placements enable row level security;
alter table public.weekly_logs enable row level security;
alter table public.evaluations enable row level security;
alter table public.check_ins enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Directory data needed for sign-up and branding.
create policy universities_public_read on public.universities
  for select to anon, authenticated
  using (status = 'active');

create policy universities_platform_all on public.universities
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy companies_public_read on public.companies
  for select to anon, authenticated
  using (status = 'active');

create policy companies_platform_all on public.companies
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Profiles: self, tenant staff directories, and people connected via applications/placements.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.can_view_profile(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy student_profiles_select on public.student_profiles
  for select to authenticated
  using (public.can_view_profile(user_id));

create policy student_profiles_insert_self on public.student_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy student_profiles_update_self on public.student_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Postings.
create policy job_postings_select on public.job_postings
  for select to authenticated
  using (public.can_view_posting(id));

create policy job_postings_insert_company on public.job_postings
  for insert to authenticated
  with check (
    company_id = public.auth_company_id()
    and public.auth_role() in ('company_admin', 'site_supervisor')
  );

create policy job_postings_update_company on public.job_postings
  for update to authenticated
  using (public.can_manage_posting(id))
  with check (public.can_manage_posting(id));

create policy job_postings_delete_company on public.job_postings
  for delete to authenticated
  using (public.can_manage_posting(id));

create policy posting_universities_select on public.posting_universities
  for select to authenticated
  using (public.can_view_posting(posting_id));

create policy posting_universities_manage_company on public.posting_universities
  for insert to authenticated
  with check (public.can_manage_posting(posting_id));

create policy posting_universities_delete_company on public.posting_universities
  for delete to authenticated
  using (public.can_manage_posting(posting_id));

-- Applications: students own their rows; companies see their applicants; universities see their students.
create policy applications_select on public.applications
  for select to authenticated
  using (
    student_id = auth.uid()
    or (public.auth_role() in ('company_admin', 'site_supervisor') and company_id = public.auth_company_id())
    or (public.auth_role() in ('coordinator', 'faculty_supervisor') and university_id = public.auth_university_id())
  );

create policy applications_insert_self on public.applications
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and public.auth_role() = 'student'
    and university_id = public.auth_university_id()
    and status in ('draft', 'submitted')
  );

-- Placements and placement-scoped data are read-only to clients.
create policy placements_select on public.placements
  for select to authenticated
  using (public.can_view_placement(id));

create policy weekly_logs_select on public.weekly_logs
  for select to authenticated
  using (public.can_view_placement(placement_id));

create policy evaluations_select on public.evaluations
  for select to authenticated
  using (public.can_view_placement(placement_id));

create policy check_ins_select on public.check_ins
  for select to authenticated
  using (public.can_view_placement(placement_id));

create policy documents_select on public.documents
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (placement_id is not null and public.can_view_placement(placement_id))
  );

create policy documents_insert_self on public.documents
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy documents_delete_self on public.documents
  for delete to authenticated
  using (owner_id = auth.uid());

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy audit_logs_platform_read on public.audit_logs
  for select to authenticated
  using (public.is_platform_admin());

-- Privileges. RLS remains the effective boundary for authenticated users.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.universities, public.companies to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Private buckets for CVs and reports, public bucket for company branding.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cvs', 'cvs', false, 5242880, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('reports', 'reports', false, 10485760, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('company-logos', 'company-logos', true, 2097152, array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml'
  ])
on conflict (id) do nothing;

-- Path convention: cvs/{student_id}/{file}
create policy cvs_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy cvs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and public.can_read_cv(name));

create policy cvs_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cvs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Path convention: reports/{placement_id}/{student_id}/{file}
create policy reports_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reports'
    and public.auth_role() = 'student'
    and public.can_view_placement(public.try_uuid(split_part(name, '/', 1)))
    and split_part(name, '/', 2) = auth.uid()::text
  );

create policy reports_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reports'
    and public.can_view_placement(public.try_uuid(split_part(name, '/', 1)))
  );

create policy company_logos_manage on storage.objects
  for all to authenticated
  using (
    bucket_id = 'company-logos'
    and (
      public.is_platform_admin()
      or (public.auth_role() = 'company_admin'
          and split_part(name, '/', 1) = public.auth_company_id()::text)
    )
  )
  with check (
    bucket_id = 'company-logos'
    and (
      public.is_platform_admin()
      or (public.auth_role() = 'company_admin'
          and split_part(name, '/', 1) = public.auth_company_id()::text)
    )
  );

-- Live notification badge support.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
exception
  when duplicate_object then null;
end;
$$;
