-- Require an active application account for privileged workflow mutations.
-- This closes SECURITY DEFINER paths that previously relied only on auth.uid()
-- and therefore remained callable by suspended or archived users with a live JWT.

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
as $function$
declare
  v_placement public.placements%rowtype;
  v_id uuid;
begin
  if public.auth_role() is distinct from 'faculty_supervisor'::public.user_role then
    raise exception 'Only an active faculty supervisor can log a check-in';
  end if;

  select * into v_placement
  from public.placements
  where id = p_placement_id;

  if not found or v_placement.faculty_supervisor_id is distinct from auth.uid() then
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
$function$;

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
as $function$
declare
  v_placement public.placements%rowtype;
  v_role public.evaluation_role;
  v_actor_role public.user_role;
begin
  select * into v_placement
  from public.placements
  where id = p_placement_id;

  if not found then
    raise exception 'Placement not found';
  end if;

  v_actor_role := public.auth_role();

  if v_actor_role = 'site_supervisor' and v_placement.site_supervisor_id = auth.uid() then
    v_role := 'site_supervisor';
  elsif v_actor_role = 'company_admin'
    and v_placement.company_id = public.auth_company_id() then
    v_role := 'site_supervisor';
  elsif v_actor_role = 'faculty_supervisor'
    and v_placement.faculty_supervisor_id = auth.uid() then
    if p_type <> 'final' then
      raise exception 'Faculty supervisors can only submit final evaluations';
    end if;
    v_role := 'faculty_supervisor';
  else
    raise exception 'Not authorized to evaluate this placement';
  end if;

  insert into public.evaluations
    (placement_id, evaluator_id, evaluator_role, type, rubric_scores, comments, overall_score)
  values
    (p_placement_id, auth.uid(), v_role, p_type, coalesce(p_rubric, '{}'::jsonb), coalesce(p_comments, ''), p_overall)
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
$function$;

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
set search_path = public
as $function$
declare
  v_placement public.placements%rowtype;
  v_week integer;
  v_report_id uuid;
  v_week_status public.log_status;
begin
  if public.auth_role() is distinct from 'student'::public.user_role then
    raise exception 'Only active students can save daily reports';
  end if;

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
as $function$
declare
  v_placement public.placements%rowtype;
  v_log public.weekly_logs%rowtype;
  v_id uuid;
begin
  if public.auth_role() is distinct from 'student'::public.user_role then
    raise exception 'Only active students can edit weekly reports';
  end if;

  select * into v_placement from public.placements where id = p_placement_id;
  if not found or v_placement.student_id is distinct from auth.uid() then
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
$function$;

create or replace function public.submit_weekly_report(
  p_placement_id uuid,
  p_week_number integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_placement public.placements%rowtype;
  v_log public.weekly_logs%rowtype;
  v_hours numeric;
  v_tasks text;
  v_outcomes text;
  v_log_id uuid;
begin
  if public.auth_role() is distinct from 'student'::public.user_role then
    raise exception 'Only active students can submit weekly reports';
  end if;

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

create or replace function public.submit_weekly_log(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_log public.weekly_logs%rowtype;
begin
  if public.auth_role() is distinct from 'student'::public.user_role then
    raise exception 'Only active students can submit weekly reports';
  end if;

  select * into v_log from public.weekly_logs where id = p_log_id;
  if not found then raise exception 'Weekly report not found'; end if;

  perform public.submit_weekly_report(v_log.placement_id, v_log.week_number);
end;
$function$;

create or replace function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_app public.applications%rowtype;
begin
  if public.auth_role() is distinct from 'student'::public.user_role then
    raise exception 'Only active students can withdraw applications';
  end if;

  select * into v_app
  from public.applications
  where id = p_application_id
  for update;

  if not found or v_app.student_id is distinct from auth.uid() then
    raise exception 'Application not found';
  end if;

  if v_app.status not in ('submitted', 'under_review', 'shortlisted') then
    raise exception 'This application can no longer be withdrawn';
  end if;

  update public.applications
  set status = 'withdrawn',
      rejection_reason = 'Withdrawn by student',
      reviewed_at = now()
  where id = p_application_id;
end;
$function$;

create or replace function public.can_view_placement(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    public.auth_role() is not null
    and exists (
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
    ),
    false
  );
$function$;

create or replace function public.can_read_cv(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    public.auth_role() is not null
    and (
      split_part(object_name, '/', 1) = auth.uid()::text
      or exists (
        select 1
        from public.applications a
        where a.cv_path = object_name
          and (a.company_id = public.auth_company_id() or a.university_id = public.auth_university_id())
      )
    ),
    false
  );
$function$;

create or replace function public.guard_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
    if new.student_id is distinct from auth.uid() then
      raise exception 'You can only apply for yourself';
    end if;
    if v_profile.account_status is distinct from 'active'::public.account_status
      or v_profile.deleted_at is not null then
      raise exception 'Your account is not active';
    end if;
    if new.status not in ('draft', 'submitted') then
      raise exception 'Applications must be submitted through the application form';
    end if;
  end if;

  return new;
end;
$function$;
