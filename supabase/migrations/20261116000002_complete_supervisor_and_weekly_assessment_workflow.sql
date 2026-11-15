-- Student-initiated university supervisor requests, weekly performance ratings,
-- and final-grade completion safeguards. This migration is additive and does not
-- change the production database until explicitly deployed.

create table if not exists public.faculty_supervisor_requests (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'assigned', 'cancelled')),
  assigned_faculty_id uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists faculty_supervisor_requests_one_pending_per_placement
  on public.faculty_supervisor_requests (placement_id)
  where status = 'pending';

create index if not exists faculty_supervisor_requests_university_status_idx
  on public.faculty_supervisor_requests (university_id, status, requested_at);

alter table public.faculty_supervisor_requests enable row level security;

drop policy if exists faculty_supervisor_requests_select on public.faculty_supervisor_requests;
create policy faculty_supervisor_requests_select
  on public.faculty_supervisor_requests
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or assigned_faculty_id = (select auth.uid())
    or (
      public.auth_role() = 'coordinator'
      and university_id = (select public.auth_university_id())
    )
  );

grant select on public.faculty_supervisor_requests to authenticated;
revoke insert, update, delete on public.faculty_supervisor_requests from anon, authenticated;

create or replace function public.request_faculty_supervisor(p_placement_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_placement public.placements%rowtype;
  v_request_id uuid;
  v_coordinator record;
begin
  if public.auth_role() <> 'student' then
    raise exception 'Only the student on this placement can request a university supervisor';
  end if;

  select * into v_placement
  from public.placements
  where id = p_placement_id
    and student_id = auth.uid()
  for update;

  if not found then raise exception 'Placement not found'; end if;
  if v_placement.status <> 'active' then
    raise exception 'Only active placements can request a faculty supervisor';
  end if;
  if v_placement.faculty_supervisor_id is not null then
    raise exception 'A faculty supervisor is already assigned to this placement';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and nullif(trim(department), '') is not null
  ) then
    raise exception 'Add your department to your profile before requesting a university supervisor';
  end if;

  select id into v_request_id
  from public.faculty_supervisor_requests
  where placement_id = p_placement_id and status = 'pending'
  order by requested_at desc
  limit 1;

  if v_request_id is not null then
    return v_request_id;
  end if;

  insert into public.faculty_supervisor_requests (placement_id, student_id, university_id)
  values (v_placement.id, v_placement.student_id, v_placement.university_id)
  returning id into v_request_id;

  for v_coordinator in
    select id
    from public.profiles
    where role = 'coordinator'
      and university_id = v_placement.university_id
      and account_status = 'active'
      and deleted_at is null
  loop
    perform public.notify_user(
      v_coordinator.id,
      'Faculty supervisor requested',
      'A student needs a faculty supervisor for an active internship placement.',
      '/placements/' || v_placement.id
    );
  end loop;

  return v_request_id;
end;
$function$;

revoke execute on function public.request_faculty_supervisor(uuid) from public, anon;
grant execute on function public.request_faculty_supervisor(uuid) to authenticated, service_role;

create or replace function public.sync_faculty_supervisor_request_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.faculty_supervisor_id is not null
     and new.faculty_supervisor_id is distinct from old.faculty_supervisor_id then
    update public.faculty_supervisor_requests
    set status = 'assigned',
        assigned_faculty_id = new.faculty_supervisor_id,
        assigned_at = now(),
        updated_at = now()
    where placement_id = new.id
      and status = 'pending';
  end if;
  return new;
end;
$function$;

revoke execute on function public.sync_faculty_supervisor_request_assignment() from public, anon, authenticated;

drop trigger if exists placements_sync_faculty_supervisor_request on public.placements;
create trigger placements_sync_faculty_supervisor_request
  after update of faculty_supervisor_id on public.placements
  for each row
  execute function public.sync_faculty_supervisor_request_assignment();

alter table public.weekly_logs
  add column if not exists rating_scores jsonb not null default '{}'::jsonb,
  add column if not exists rating_overall numeric(3,2),
  add column if not exists rating_comment text,
  add column if not exists rated_by uuid references public.profiles(id) on delete set null,
  add column if not exists rated_at timestamptz;

alter table public.weekly_logs
  drop constraint if exists weekly_logs_rating_overall_check;
alter table public.weekly_logs
  add constraint weekly_logs_rating_overall_check
  check (rating_overall is null or rating_overall between 1 and 5);

create or replace function public.rate_weekly_log(
  p_log_id uuid,
  p_rubric jsonb,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_log public.weekly_logs%rowtype;
  v_placement public.placements%rowtype;
  v_overall numeric(3,2);
begin
  select * into v_log
  from public.weekly_logs
  where id = p_log_id
  for update;

  if not found then raise exception 'Weekly report not found'; end if;

  select * into v_placement
  from public.placements
  where id = v_log.placement_id;

  if public.auth_role() <> 'faculty_supervisor'
     or v_placement.faculty_supervisor_id <> auth.uid() then
    raise exception 'Only the assigned university faculty supervisor can rate this weekly report';
  end if;

  if v_log.status <> 'approved' then
    raise exception 'Approve the weekly report before entering its performance rating';
  end if;

  if jsonb_typeof(p_rubric) <> 'object'
     or (select count(*) from jsonb_object_keys(p_rubric)) <> 4
     or not (p_rubric ?& array['professionalism', 'technical_skill', 'communication', 'initiative'])
     or coalesce(p_rubric->>'professionalism', '') !~ '^[1-5]$'
     or coalesce(p_rubric->>'technical_skill', '') !~ '^[1-5]$'
     or coalesce(p_rubric->>'communication', '') !~ '^[1-5]$'
     or coalesce(p_rubric->>'initiative', '') !~ '^[1-5]$' then
    raise exception 'Each weekly rubric score must be a whole number from 1 to 5';
  end if;

  if nullif(trim(coalesce(p_comment, '')), '') is null then
    raise exception 'Add evidence-based feedback before saving the weekly rating';
  end if;

  v_overall := round((
    (p_rubric->>'professionalism')::numeric
    + (p_rubric->>'technical_skill')::numeric
    + (p_rubric->>'communication')::numeric
    + (p_rubric->>'initiative')::numeric
  ) / 4, 2);

  update public.weekly_logs
  set rating_scores = p_rubric,
      rating_overall = v_overall,
      rating_comment = trim(p_comment),
      rated_by = auth.uid(),
      rated_at = now(),
      updated_at = now()
  where id = p_log_id;

  perform public.notify_user(
    v_placement.student_id,
    'Weekly performance rating recorded',
    'Your week ' || v_log.week_number || ' performance rating is ' || v_overall || ' out of 5.',
    '/placements/' || v_placement.id
  );
end;
$function$;

revoke execute on function public.rate_weekly_log(uuid,jsonb,text) from public, anon;
grant execute on function public.rate_weekly_log(uuid,jsonb,text) to authenticated, service_role;

-- Keep daily and weekly date rules enforced by the database, not only the UI.
create or replace function public.save_daily_report(
  p_placement_id uuid,
  p_report_date date,
  p_hours numeric,
  p_tasks text,
  p_learning_outcomes text default ''
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_placement public.placements%rowtype;
  v_week integer;
  v_report_id uuid;
  v_week_status public.log_status;
begin
  select * into v_placement
  from public.placements
  where id = p_placement_id and student_id = auth.uid()
  for update;

  if not found then raise exception 'Placement not found'; end if;
  if public.auth_role() <> 'student' or v_placement.status <> 'active' then
    raise exception 'Only active students can save daily reports';
  end if;
  if p_report_date is null
     or p_report_date < v_placement.start_date
     or p_report_date > v_placement.end_date
     or p_report_date > current_date then
    raise exception 'Report date must be within the placement period and cannot be in the future';
  end if;
  if p_hours is null or p_hours < 0 or p_hours > 24 then
    raise exception 'Hours must be between 0 and 24';
  end if;
  if nullif(trim(coalesce(p_tasks, '')), '') is null then
    raise exception 'Describe the work completed that day';
  end if;

  v_week := floor((p_report_date - v_placement.start_date)::numeric / 7)::integer + 1;

  select status into v_week_status
  from public.weekly_logs
  where placement_id = p_placement_id and week_number = v_week;

  if v_week_status in ('submitted', 'approved') then
    raise exception 'This week has already been submitted for supervisor review';
  end if;

  insert into public.daily_reports
    (placement_id, student_id, report_date, week_number, hours, tasks, learning_outcomes, status)
  values
    (p_placement_id, auth.uid(), p_report_date, v_week, p_hours, trim(p_tasks), coalesce(trim(p_learning_outcomes), ''), 'draft')
  on conflict (placement_id, report_date) do update
    set hours = excluded.hours,
        tasks = excluded.tasks,
        learning_outcomes = excluded.learning_outcomes,
        status = 'draft',
        updated_at = now()
  returning id into v_report_id;

  return v_report_id;
end;
$function$;

create or replace function public.submit_weekly_report(
  p_placement_id uuid,
  p_week_number integer
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_placement public.placements%rowtype;
  v_log public.weekly_logs%rowtype;
  v_hours numeric;
  v_tasks text;
  v_outcomes text;
  v_log_id uuid;
  v_expected_weeks integer;
  v_week_end date;
begin
  select * into v_placement
  from public.placements
  where id = p_placement_id and student_id = auth.uid()
  for update;

  if not found then raise exception 'Placement not found'; end if;
  if public.auth_role() <> 'student' or v_placement.status <> 'active' then
    raise exception 'Only active students can submit weekly reports';
  end if;
  if p_week_number is null or p_week_number < 1 then
    raise exception 'Invalid week number';
  end if;
  if v_placement.faculty_supervisor_id is null then
    raise exception 'A university faculty supervisor must be assigned before submitting a weekly report';
  end if;

  v_expected_weeks := ceil((v_placement.end_date - v_placement.start_date + 1)::numeric / 7)::integer;
  if p_week_number > v_expected_weeks then
    raise exception 'The selected week is outside the placement period';
  end if;
  v_week_end := least(v_placement.start_date + (p_week_number * 7) - 1, v_placement.end_date);
  if v_week_end > current_date then
    raise exception 'A weekly report can only be submitted after that placement week has ended';
  end if;

  select * into v_log
  from public.weekly_logs
  where placement_id = p_placement_id and week_number = p_week_number
  for update;

  if found and v_log.status not in ('draft', 'needs_revision') then
    raise exception 'This week has already been submitted';
  end if;

  select coalesce(sum(hours), 0),
         string_agg(to_char(report_date, 'Dy, DD Mon') || ': ' || tasks, E'\\n' order by report_date),
         string_agg(nullif(learning_outcomes, ''), E'\\n' order by report_date)
  into v_hours, v_tasks, v_outcomes
  from public.daily_reports
  where placement_id = p_placement_id
    and week_number = p_week_number
    and student_id = auth.uid();

  if v_tasks is null then raise exception 'Add at least one daily report before submitting the week'; end if;
  if v_hours <= 0 then raise exception 'Your weekly report must include some working hours'; end if;

  insert into public.weekly_logs
    (placement_id, week_number, hours, tasks, learning_outcomes, status, submitted_at, reviewed_at, reviewed_by,
     rating_scores, rating_overall, rating_comment, rated_by, rated_at)
  values
    (p_placement_id, p_week_number, v_hours, v_tasks, coalesce(v_outcomes, ''), 'submitted', now(), null, null,
     '{}'::jsonb, null, null, null, null)
  on conflict (placement_id, week_number) do update
    set hours = excluded.hours,
        tasks = excluded.tasks,
        learning_outcomes = excluded.learning_outcomes,
        status = 'submitted',
        submitted_at = now(),
        reviewed_at = null,
        reviewed_by = null,
        supervisor_comment = null,
        rating_scores = '{}'::jsonb,
        rating_overall = null,
        rating_comment = null,
        rated_by = null,
        rated_at = null,
        updated_at = now()
  returning id into v_log_id;

  update public.daily_reports
  set status = 'submitted', submitted_at = now(), reviewed_at = null, reviewed_by = null,
      supervisor_comment = null, updated_at = now()
  where placement_id = p_placement_id and week_number = p_week_number and student_id = auth.uid();

  perform public.notify_user(
    v_placement.faculty_supervisor_id,
    'Weekly report awaiting approval',
    'A student submitted daily reports for week ' || p_week_number || '.',
    '/placements/' || p_placement_id
  );

  return v_log_id;
end;
$function$;

create or replace function public.record_grade(
  p_placement_id uuid,
  p_grade numeric,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_placement public.placements%rowtype;
  v_expected_weeks integer;
  v_total_weeks integer;
  v_complete_weeks integer;
  v_min_week integer;
  v_max_week integer;
begin
  select * into v_placement
  from public.placements
  where id = p_placement_id
  for update;

  if not found then raise exception 'Placement not found'; end if;
  if public.auth_role() <> 'faculty_supervisor'
     or v_placement.faculty_supervisor_id <> auth.uid() then
    raise exception 'Only the assigned university faculty supervisor can record the official final grade';
  end if;
  if p_grade is null or p_grade < 0 or p_grade > 100 then
    raise exception 'Grade must be between 0 and 100';
  end if;
  if v_placement.status = 'cancelled' then
    raise exception 'A cancelled placement cannot receive a final grade';
  end if;
  if v_placement.end_date > current_date then
    raise exception 'The placement must reach its end date before final grading';
  end if;

  v_expected_weeks := ceil((v_placement.end_date - v_placement.start_date + 1)::numeric / 7)::integer;

  select count(*),
         count(*) filter (where status = 'approved' and rating_overall is not null),
         min(week_number),
         max(week_number)
  into v_total_weeks, v_complete_weeks, v_min_week, v_max_week
  from public.weekly_logs
  where placement_id = p_placement_id;

  if v_total_weeks <> v_expected_weeks
     or v_complete_weeks <> v_expected_weeks
     or v_min_week <> 1
     or v_max_week <> v_expected_weeks then
    raise exception 'Every expected internship week must be submitted, approved, and rated before final grading';
  end if;

  update public.placements
  set final_grade = p_grade,
      grade_notes = p_notes,
      graded_by = auth.uid(),
      graded_at = now(),
      status = 'completed',
      updated_at = now()
  where id = p_placement_id;

  perform public.notify_user(
    v_placement.student_id,
    'Final grade recorded',
    'Your official internship grade has been recorded and the placement is complete.',
    '/placements/' || p_placement_id
  );
end;
$function$;

revoke execute on function public.save_daily_report(uuid,date,numeric,text,text) from public, anon;
revoke execute on function public.submit_weekly_report(uuid,integer) from public, anon;
revoke execute on function public.record_grade(uuid,numeric,text) from public, anon;
grant execute on function public.save_daily_report(uuid,date,numeric,text,text) to authenticated, service_role;
grant execute on function public.submit_weekly_report(uuid,integer) to authenticated, service_role;
grant execute on function public.record_grade(uuid,numeric,text) to authenticated, service_role;

-- The old direct weekly-log editor bypasses the daily-report aggregation workflow.
revoke execute on function public.upsert_weekly_log(uuid,integer,numeric,text,text) from public, anon, authenticated;
grant execute on function public.upsert_weekly_log(uuid,integer,numeric,text,text) to service_role;


-- Capture the student's declared department from sign-up metadata. Department is
-- profile information, not an authorization claim; it is used only for matching.
create or replace function public.sync_student_department_from_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.profiles
  set department = nullif(trim(new.raw_user_meta_data ->> 'department'), '')
  where id = new.id and role = 'student';
  return new;
end;
$function$;

revoke execute on function public.sync_student_department_from_signup() from public, anon, authenticated;

drop trigger if exists zz_sync_student_department_after_signup on auth.users;
create trigger zz_sync_student_department_after_signup
  after insert on auth.users
  for each row
  execute function public.sync_student_department_from_signup();

-- Tighten the coordinator assignment RPC: both the student and faculty member
-- must have a matching department, and the faculty account must be active.
create or replace function public.assign_faculty_supervisor(
  p_placement_id uuid,
  p_faculty_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_placement public.placements%rowtype;
  v_faculty public.profiles%rowtype;
  v_student_department text;
begin
  if public.auth_role() <> 'coordinator' then
    raise exception 'Only internship coordinators can assign faculty supervisors';
  end if;

  select * into v_placement
  from public.placements
  where id = p_placement_id
  for update;

  if not found or v_placement.university_id <> public.auth_university_id() then
    raise exception 'Placement not found';
  end if;

  select nullif(trim(department), '')
  into v_student_department
  from public.profiles
  where id = v_placement.student_id;

  if v_student_department is null then
    raise exception 'The student must add their department to their profile before supervisor assignment';
  end if;

  select * into v_faculty
  from public.profiles
  where id = p_faculty_id
    and role = 'faculty_supervisor'
    and university_id = public.auth_university_id()
    and account_status = 'active'
    and deleted_at is null;

  if not found then
    raise exception 'Select an active faculty supervisor from your university';
  end if;

  if lower(trim(coalesce(v_faculty.department, ''))) <> lower(trim(v_student_department)) then
    raise exception 'The selected faculty supervisor must belong to the student department';
  end if;

  update public.placements
  set faculty_supervisor_id = p_faculty_id
  where id = p_placement_id;

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
$function$;

revoke execute on function public.assign_faculty_supervisor(uuid,uuid) from public, anon;
grant execute on function public.assign_faculty_supervisor(uuid,uuid) to authenticated, service_role;
