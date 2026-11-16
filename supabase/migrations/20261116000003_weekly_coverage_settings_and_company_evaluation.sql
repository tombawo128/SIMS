-- User preferences, university-scoped opportunity visibility, weekly coverage, and company final evaluation gate.

-- CVs are private to their owner, the company receiving the application,
-- university coordinators, and supervisors assigned to the resulting placement.
-- A student must never inherit CV access merely by sharing a university.
create or replace function public.can_read_cv(object_name text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when split_part(object_name, '/', 1) = auth.uid()::text then true
    else exists (
      select 1
      from public.applications a
      where a.cv_path = object_name
        and split_part(object_name, '/', 1) = a.student_id::text
        and (
          (
            public.auth_role() = 'company_admin'
            and a.company_id = public.auth_company_id()
          )
          or (
            public.auth_role() = 'coordinator'
            and a.university_id = public.auth_university_id()
          )
          or exists (
            select 1
            from public.placements pl
            where pl.application_id = a.id
              and (
                pl.faculty_supervisor_id = auth.uid()
                or pl.site_supervisor_id = auth.uid()
              )
          )
        )
    )
  end;
$function$;


-- Store notification preferences on the user's own profile row. This avoids
-- introducing another exposed Data API table and inherits the existing self-only RLS.
alter table public.profiles
  add column if not exists notification_preferences jsonb not null
  default '{"in_app_notifications":true,"application_updates":true,"supervision_updates":true,"system_announcements":true}'::jsonb;

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_notification_preferences_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_notification_preferences_check
      check (
        jsonb_typeof(notification_preferences) = 'object'
        and notification_preferences ?& array[
          'in_app_notifications',
          'application_updates',
          'supervision_updates',
          'system_announcements'
        ]
        and jsonb_typeof(notification_preferences->'in_app_notifications') = 'boolean'
        and jsonb_typeof(notification_preferences->'application_updates') = 'boolean'
        and jsonb_typeof(notification_preferences->'supervision_updates') = 'boolean'
        and jsonb_typeof(notification_preferences->'system_announcements') = 'boolean'
      );
  end if;
end;
$constraint$;

-- Keep the company-owned draft visibility required by INSERT ... RETURNING,
-- while allowing students to read only published postings visible to their university.
drop policy if exists job_postings_select on public.job_postings;
create policy job_postings_select on public.job_postings
  for select to authenticated
  using (
    company_id = (select public.auth_company_id())
    or (select public.is_platform_admin())
    or (
      status = 'published'
      and (
        visibility = 'all_universities'
        or (
          (select public.auth_university_id()) is not null
          and exists (
            select 1
            from public.posting_universities pu
            where pu.posting_id = job_postings.id
              and pu.university_id = (select public.auth_university_id())
          )
        )
      )
    )
  );

-- Daily reports are unique by placement/date. Locking the placement serializes
-- concurrent writes so a student cannot create a sixth day through parallel requests.
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
  v_day_count integer;
begin
  select * into v_placement
  from public.placements
  where id = p_placement_id and student_id = auth.uid()
  for update;

  if not found then raise exception 'Placement not found'; end if;
  if public.auth_role() is distinct from 'student' or v_placement.status <> 'active' then
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

  if not exists (
    select 1 from public.daily_reports
    where placement_id = p_placement_id and report_date = p_report_date
  ) then
    select count(*) into v_day_count
    from public.daily_reports
    where placement_id = p_placement_id and week_number = v_week and student_id = auth.uid();

    if v_day_count >= 5 then
      raise exception 'A maximum of 5 daily reports is allowed per internship week';
    end if;
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
  v_day_count integer;
begin
  select * into v_placement
  from public.placements
  where id = p_placement_id and student_id = auth.uid()
  for update;

  if not found then raise exception 'Placement not found'; end if;
  if public.auth_role() is distinct from 'student' or v_placement.status <> 'active' then
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

  select count(*),
         coalesce(sum(hours), 0),
         string_agg(to_char(report_date, 'Dy, DD Mon') || ': ' || tasks, E'\n' order by report_date),
         string_agg(nullif(learning_outcomes, ''), E'\n' order by report_date)
  into v_day_count, v_hours, v_tasks, v_outcomes
  from public.daily_reports
  where placement_id = p_placement_id
    and week_number = p_week_number
    and student_id = auth.uid();

  if v_day_count < 3 then
    raise exception 'At least 3 different daily reports are required for each internship week';
  end if;
  if v_day_count > 5 then
    raise exception 'A maximum of 5 daily reports is allowed per internship week';
  end if;
  if v_tasks is null then raise exception 'Add daily reports before submitting the week'; end if;
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

-- The university's official grade cannot be recorded until the designated
-- company site supervisor has submitted the final evaluation.
-- The university final mark is calculated from three independent assessment sources:
-- 30% approved weekly faculty ratings, 40% company site-supervisor final evaluation,
-- and 30% university faculty final evaluation. All component scores are on a 1-5 scale.
drop function if exists public.record_grade(uuid, numeric, text);

create or replace function public.record_grade(
  p_placement_id uuid,
  p_notes text default null
)
returns numeric
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
  v_weekly_average numeric;
  v_company_score numeric;
  v_faculty_score numeric;
  v_final_grade numeric;
begin
  select * into v_placement
  from public.placements
  where id = p_placement_id
  for update;

  if not found then raise exception 'Placement not found'; end if;
  if public.auth_role() is distinct from 'faculty_supervisor'
     or v_placement.faculty_supervisor_id is distinct from auth.uid() then
    raise exception 'Only the assigned university faculty supervisor can record the official final grade';
  end if;
  if v_placement.status = 'cancelled' then
    raise exception 'A cancelled placement cannot receive a final grade';
  end if;
  if v_placement.final_grade is not null or v_placement.status = 'completed' then
    raise exception 'A final grade has already been recorded';
  end if;
  if v_placement.end_date > current_date then
    raise exception 'The placement must reach its end date before final grading';
  end if;

  v_expected_weeks := ceil((v_placement.end_date - v_placement.start_date + 1)::numeric / 7)::integer;

  select count(*),
         count(*) filter (where status = 'approved' and rating_overall is not null),
         min(week_number),
         max(week_number),
         avg(rating_overall) filter (where status = 'approved' and rating_overall is not null)
  into v_total_weeks, v_complete_weeks, v_min_week, v_max_week, v_weekly_average
  from public.weekly_logs
  where placement_id = p_placement_id;

  if v_total_weeks <> v_expected_weeks
     or v_complete_weeks <> v_expected_weeks
     or v_min_week <> 1
     or v_max_week <> v_expected_weeks then
    raise exception 'Every expected internship week must be submitted, approved, and rated before final grading';
  end if;

  select e.overall_score into v_company_score
  from public.evaluations e
  where e.placement_id = p_placement_id
    and e.evaluator_role = 'site_supervisor'
    and e.type = 'final'
    and e.evaluator_id = v_placement.site_supervisor_id;

  if v_company_score is null then
    raise exception 'The assigned company site supervisor must submit the final evaluation before final grading';
  end if;

  select e.overall_score into v_faculty_score
  from public.evaluations e
  where e.placement_id = p_placement_id
    and e.evaluator_role = 'faculty_supervisor'
    and e.type = 'final'
    and e.evaluator_id = v_placement.faculty_supervisor_id;

  if v_faculty_score is null then
    raise exception 'The assigned university faculty supervisor must submit the final evaluation before final grading';
  end if;

  v_final_grade := round(
    (v_weekly_average / 5.0 * 100.0 * 0.30)
    + (v_company_score / 5.0 * 100.0 * 0.40)
    + (v_faculty_score / 5.0 * 100.0 * 0.30),
    2
  );

  update public.placements
  set final_grade = v_final_grade,
      grade_notes = nullif(trim(coalesce(p_notes, '')), ''),
      graded_by = auth.uid(),
      graded_at = now(),
      status = 'completed',
      updated_at = now()
  where id = p_placement_id;

  perform public.notify_user(
    v_placement.student_id,
    'Final grade recorded',
    'Your official internship grade has been calculated and recorded as ' || v_final_grade || '%.',
    '/placements/' || p_placement_id
  );

  return v_final_grade;
end;
$function$;

-- Notification preferences are opt-out by default only after a user saves settings;
-- accounts without a settings row keep the current notification behaviour.
create or replace function public.notify_user(
  p_user uuid,
  p_title text,
  p_body text,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_preferences jsonb;
  v_category_enabled boolean := true;
begin
  select notification_preferences into v_preferences
  from public.profiles
  where id = p_user;

  if found then
    v_category_enabled := case
      when p_title ilike any (array['%application%', '%shortlist%', '%offer%'])
        then coalesce((v_preferences->>'application_updates')::boolean, true)
      when p_title ilike any (array['%weekly%', '%report%', '%supervisor%', '%evaluation%', '%grade%', '%placement%'])
        then coalesce((v_preferences->>'supervision_updates')::boolean, true)
      when p_title ilike any (array['%announcement%', '%system%'])
        then coalesce((v_preferences->>'system_announcements')::boolean, true)
      else true
    end;

    if not coalesce((v_preferences->>'in_app_notifications')::boolean, true)
       or not v_category_enabled then
      return;
    end if;
  end if;

  insert into public.notifications (user_id, title, body, link)
  values (p_user, p_title, p_body, p_link);
end;
$function$;

revoke all on function public.notify_user(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.save_daily_report(uuid,date,numeric,text,text) from public, anon;
revoke all on function public.submit_weekly_report(uuid,integer) from public, anon;
revoke all on function public.record_grade(uuid,text) from public, anon;
grant execute on function public.save_daily_report(uuid,date,numeric,text,text) to authenticated, service_role;
grant execute on function public.submit_weekly_report(uuid,integer) to authenticated, service_role;
grant execute on function public.record_grade(uuid,text) to authenticated, service_role;


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
set search_path to 'public'
as $function$
declare
  v_placement public.placements%rowtype;
  v_role public.evaluation_role;
  v_actor_role public.user_role;
begin
  select * into v_placement
  from public.placements
  where id = p_placement_id;

  if not found then raise exception 'Placement not found'; end if;
  v_actor_role := public.auth_role();

  if v_actor_role = 'site_supervisor' and v_placement.site_supervisor_id = auth.uid() then
    v_role := 'site_supervisor';
  elsif v_actor_role = 'faculty_supervisor' and v_placement.faculty_supervisor_id = auth.uid() then
    if p_type <> 'final' then
      raise exception 'Faculty supervisors can only submit final evaluations';
    end if;
    v_role := 'faculty_supervisor';
  else
    raise exception 'Not authorized to evaluate this placement';
  end if;

  if v_placement.status <> 'active' then
    raise exception 'Evaluations are locked after placement completion';
  end if;
  if p_type is null or p_type not in ('midterm', 'final') then
    raise exception 'Choose a valid evaluation type';
  end if;
  if nullif(trim(coalesce(p_comments, '')), '') is null then
    raise exception 'Add written comments to support the evaluation';
  end if;
  if p_overall is null or p_overall < 1 or p_overall > 5 then
    raise exception 'The overall evaluation score must be between 1 and 5';
  end if;
  if jsonb_typeof(p_rubric) is distinct from 'object' then
    raise exception 'Evaluation rubric must contain exactly four scoring criteria';
  end if;

  if (select count(*) from jsonb_object_keys(p_rubric)) <> 4
     or not (p_rubric ?& array['professionalism', 'technical_skill', 'communication', 'initiative'])
     or coalesce(p_rubric->>'professionalism', '') not in ('1', '2', '3', '4', '5')
     or coalesce(p_rubric->>'technical_skill', '') not in ('1', '2', '3', '4', '5')
     or coalesce(p_rubric->>'communication', '') not in ('1', '2', '3', '4', '5')
     or coalesce(p_rubric->>'initiative', '') not in ('1', '2', '3', '4', '5') then
    raise exception 'Each evaluation rubric score must be a whole number from 1 to 5';
  end if;

  if p_overall is distinct from round((
    (p_rubric->>'professionalism')::numeric
    + (p_rubric->>'technical_skill')::numeric
    + (p_rubric->>'communication')::numeric
    + (p_rubric->>'initiative')::numeric
  ) / 4, 2) then
    raise exception 'Overall evaluation score must equal the average of the four rubric scores';
  end if;

  insert into public.evaluations
    (placement_id, evaluator_id, evaluator_role, type, rubric_scores, comments, overall_score)
  values
    (p_placement_id, auth.uid(), v_role, p_type, p_rubric, trim(p_comments), p_overall)
  on conflict (placement_id, evaluator_role, type) do update
    set evaluator_id = excluded.evaluator_id,
        rubric_scores = excluded.rubric_scores,
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

revoke all on function public.submit_evaluation(uuid,public.evaluation_type,jsonb,text,numeric) from public, anon;
grant execute on function public.submit_evaluation(uuid,public.evaluation_type,jsonb,text,numeric) to authenticated, service_role;



-- Broadcast delivery honours each recipient's announcement preferences as well.
create or replace function public.publish_admin_broadcast(
  p_title text,
  p_body text,
  p_audience_role public.user_role default null,
  p_link text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_broadcast_id uuid;
  v_count integer;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Only platform administrators can send broadcasts' using errcode = '42501';
  end if;
  if p_title is null or length(trim(p_title)) = 0 or length(trim(p_title)) > 160 then
    raise exception 'Title must contain 1 to 160 characters';
  end if;
  if p_body is null or length(trim(p_body)) = 0 or length(trim(p_body)) > 5000 then
    raise exception 'Message must contain 1 to 5000 characters';
  end if;

  insert into public.admin_broadcasts (title, body, audience_role, link, created_by)
  values (trim(p_title), trim(p_body), p_audience_role, nullif(trim(p_link), ''), auth.uid())
  returning id into v_broadcast_id;

  insert into public.notifications (user_id, title, body, link)
  select p.id, trim(p_title), trim(p_body), nullif(trim(p_link), '')
  from public.profiles p
  where p.account_status = 'active'
    and p.deleted_at is null
    and (p_audience_role is null or p.role = p_audience_role)
    and p.id <> auth.uid()
    and coalesce((p.notification_preferences->>'in_app_notifications')::boolean, true)
    and coalesce((p.notification_preferences->>'system_announcements')::boolean, true);

  get diagnostics v_count = row_count;
  update public.admin_broadcasts set recipients_count = v_count where id = v_broadcast_id;

  insert into public.audit_logs (actor_id, entity, entity_id, action, metadata)
  values (
    auth.uid(),
    'admin_broadcasts',
    v_broadcast_id::text,
    'broadcast_sent',
    jsonb_build_object('audience_role', p_audience_role, 'recipients_count', v_count, 'title', trim(p_title))
  );

  return jsonb_build_object('id', v_broadcast_id, 'recipients_count', v_count);
end;
$function$;

revoke all on function public.publish_admin_broadcast(text,text,public.user_role,text) from public, anon;
grant execute on function public.publish_admin_broadcast(text,text,public.user_role,text) to authenticated;

