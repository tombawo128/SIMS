
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  report_date date not null,
  week_number integer not null check (week_number >= 1),
  hours numeric(6,2) not null default 0 check (hours >= 0 and hours <= 24),
  tasks text not null default '',
  learning_outcomes text not null default '',
  status public.log_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  supervisor_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_reports_placement_date_key unique (placement_id, report_date)
);

create index if not exists daily_reports_placement_week_idx
  on public.daily_reports (placement_id, week_number, report_date);

alter table public.daily_reports enable row level security;

drop policy if exists daily_reports_select on public.daily_reports;
create policy daily_reports_select on public.daily_reports
  for select to authenticated using (public.can_view_placement(placement_id));

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
  if v_placement.status <> 'active' then raise exception 'Only active placements accept daily reports'; end if;
  if p_report_date < v_placement.start_date or p_report_date > v_placement.end_date then
    raise exception 'Report date must fall within the placement dates';
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
begin
  select * into v_placement
  from public.placements
  where id = p_placement_id and student_id = auth.uid()
  for update;

  if not found then raise exception 'Placement not found'; end if;
  if v_placement.status <> 'active' then raise exception 'Only active placements can submit weekly reports'; end if;
  if p_week_number is null or p_week_number < 1 then raise exception 'Invalid week number'; end if;
  if v_placement.faculty_supervisor_id is null then
    raise exception 'A university faculty supervisor must be assigned before submitting a weekly report';
  end if;

  select * into v_log
  from public.weekly_logs
  where placement_id = p_placement_id and week_number = p_week_number
  for update;

  if found and v_log.status not in ('draft', 'needs_revision') then
    raise exception 'This week has already been submitted';
  end if;

  select coalesce(sum(hours), 0),
         string_agg(to_char(report_date, 'Dy, DD Mon') || ': ' || tasks, E'\n' order by report_date),
         string_agg(nullif(learning_outcomes, ''), E'\n' order by report_date)
  into v_hours, v_tasks, v_outcomes
  from public.daily_reports
  where placement_id = p_placement_id
    and week_number = p_week_number
    and student_id = auth.uid();

  if v_tasks is null then raise exception 'Add at least one daily report before submitting the week'; end if;
  if v_hours <= 0 then raise exception 'Your weekly report must include some working hours'; end if;

  insert into public.weekly_logs
    (placement_id, week_number, hours, tasks, learning_outcomes, status, submitted_at, reviewed_at, reviewed_by)
  values
    (p_placement_id, p_week_number, v_hours, v_tasks, coalesce(v_outcomes, ''), 'submitted', now(), null, null)
  on conflict (placement_id, week_number) do update
    set hours = excluded.hours,
        tasks = excluded.tasks,
        learning_outcomes = excluded.learning_outcomes,
        status = 'submitted',
        submitted_at = now(),
        reviewed_at = null,
        reviewed_by = null,
        supervisor_comment = null
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

create or replace function public.review_weekly_log(
  p_log_id uuid,
  p_decision public.log_status,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_log public.weekly_logs%rowtype;
  v_placement public.placements%rowtype;
begin
  select * into v_log from public.weekly_logs where id = p_log_id for update;
  if not found then raise exception 'Weekly report not found'; end if;

  select * into v_placement from public.placements where id = v_log.placement_id;
  if public.auth_role() <> 'faculty_supervisor'
     or v_placement.faculty_supervisor_id <> auth.uid() then
    raise exception 'Only the assigned university faculty supervisor can approve this weekly report';
  end if;
  if p_decision not in ('approved', 'needs_revision') then
    raise exception 'Decision must be approved or needs_revision';
  end if;
  if v_log.status <> 'submitted' then
    raise exception 'Only submitted weekly reports can be reviewed';
  end if;

  update public.weekly_logs
  set status = p_decision,
      supervisor_comment = nullif(trim(p_comment), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_log_id;

  update public.daily_reports
  set status = p_decision,
      supervisor_comment = nullif(trim(p_comment), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where placement_id = v_placement.id and week_number = v_log.week_number;

  perform public.notify_user(
    v_placement.student_id,
    'Weekly report reviewed',
    'Your week ' || v_log.week_number || ' report was marked ' || replace(p_decision::text, '_', ' ') || '.',
    '/placements/' || v_placement.id
  );
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
begin
  select * into v_placement from public.placements where id = p_placement_id for update;
  if not found then raise exception 'Placement not found'; end if;

  if public.auth_role() <> 'faculty_supervisor'
     or v_placement.faculty_supervisor_id <> auth.uid() then
    raise exception 'Only the assigned university faculty supervisor can record the official final grade';
  end if;
  if p_grade is null or p_grade < 0 or p_grade > 100 then
    raise exception 'Grade must be between 0 and 100';
  end if;
  if exists (
    select 1 from public.weekly_logs
    where placement_id = p_placement_id and status <> 'approved'
  ) then
    raise exception 'All weekly reports must be approved before recording the final grade';
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
    'Your official internship grade has been recorded.',
    '/placements/' || p_placement_id
  );
end;
$function$;

revoke execute on function public.save_daily_report(uuid,date,numeric,text,text) from public, anon;
revoke execute on function public.submit_weekly_report(uuid,integer) from public, anon;
revoke execute on function public.review_weekly_log(uuid,public.log_status,text) from public, anon;
revoke execute on function public.record_grade(uuid,numeric,text) from public, anon;
grant execute on function public.save_daily_report(uuid,date,numeric,text,text) to authenticated, service_role;
grant execute on function public.submit_weekly_report(uuid,integer) to authenticated, service_role;
grant execute on function public.review_weekly_log(uuid,public.log_status,text) to authenticated, service_role;
grant execute on function public.record_grade(uuid,numeric,text) to authenticated, service_role;
