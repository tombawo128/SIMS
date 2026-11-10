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
