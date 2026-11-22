-- Fail closed when an authenticated JWT belongs to a suspended, archived,
-- or otherwise inactive profile. auth_role() returns NULL in those cases, and
-- SQL comparisons using <> evaluate to NULL (which PL/pgSQL IF treats as false).
-- Keep these client workflow RPCs available to authenticated users, but make
-- their role and tenant checks explicitly NULL-safe.

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
  if public.auth_role() is distinct from 'coordinator'::public.user_role then
    raise exception 'Only internship coordinators can assign faculty supervisors';
  end if;

  select * into v_placement
  from public.placements
  where id = p_placement_id
  for update;

  if not found
     or v_placement.university_id is distinct from public.auth_university_id() then
    raise exception 'Placement not found';
  end if;

  select department into v_student_department
  from public.profiles
  where id = v_placement.student_id;

  select * into v_faculty
  from public.profiles
  where id = p_faculty_id;

  if not found
     or v_faculty.role is distinct from 'faculty_supervisor'::public.user_role
     or v_faculty.university_id is distinct from public.auth_university_id() then
    raise exception 'Select a faculty supervisor from your university';
  end if;

  if nullif(trim(v_student_department), '') is not null
     and lower(trim(coalesce(v_faculty.department, ''))) <> lower(trim(v_student_department)) then
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

create or replace function public.faculty_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if public.auth_role() is distinct from 'faculty_supervisor'::public.user_role then
    raise exception 'Not authorized';
  end if;

  return jsonb_build_object(
    'placements', (select count(*) from public.placements where faculty_supervisor_id = auth.uid()),
    'pending_logs', (
      select count(*)
      from public.weekly_logs l
      join public.placements pl on pl.id = l.placement_id
      where pl.faculty_supervisor_id = auth.uid() and l.status = 'submitted'
    ),
    'students', (select count(*) from public.placements where faculty_supervisor_id = auth.uid() and status = 'active'),
    'check_ins', (select count(*) from public.check_ins where faculty_supervisor_id = auth.uid())
  );
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
  select * into v_log
  from public.weekly_logs
  where id = p_log_id
  for update;

  if not found then
    raise exception 'Weekly report not found';
  end if;

  select * into v_placement
  from public.placements
  where id = v_log.placement_id;

  if public.auth_role() is distinct from 'faculty_supervisor'::public.user_role
     or v_placement.faculty_supervisor_id is distinct from auth.uid() then
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
  where placement_id = v_placement.id
    and week_number = v_log.week_number;

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
  select * into v_placement
  from public.placements
  where id = p_placement_id
  for update;

  if not found then
    raise exception 'Placement not found';
  end if;

  if public.auth_role() is distinct from 'faculty_supervisor'::public.user_role
     or v_placement.faculty_supervisor_id is distinct from auth.uid() then
    raise exception 'Only the assigned university faculty supervisor can record the official final grade';
  end if;

  if p_grade is null or p_grade < 0 or p_grade > 100 then
    raise exception 'Grade must be between 0 and 100';
  end if;

  if not exists (
    select 1
    from public.weekly_logs
    where placement_id = p_placement_id
  ) then
    raise exception 'At least one weekly report must be submitted and approved before final grading';
  end if;

  if exists (
    select 1
    from public.weekly_logs
    where placement_id = p_placement_id
      and status <> 'approved'
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

-- Preserve the existing intended API: no PUBLIC/anon execution; authenticated
-- workflows and trusted service-role operations remain supported.
revoke execute on function public.assign_faculty_supervisor(uuid, uuid) from public, anon;
revoke execute on function public.faculty_stats() from public, anon;
revoke execute on function public.review_weekly_log(uuid, public.log_status, text) from public, anon;
revoke execute on function public.record_grade(uuid, numeric, text) from public, anon;

grant execute on function public.assign_faculty_supervisor(uuid, uuid) to authenticated, service_role;
grant execute on function public.faculty_stats() to authenticated, service_role;
grant execute on function public.review_weekly_log(uuid, public.log_status, text) to authenticated, service_role;
grant execute on function public.record_grade(uuid, numeric, text) to authenticated, service_role;
