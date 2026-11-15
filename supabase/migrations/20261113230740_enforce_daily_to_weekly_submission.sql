create or replace function public.submit_weekly_log(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_log public.weekly_logs%rowtype;
begin
  select * into v_log from public.weekly_logs where id = p_log_id;
  if not found then raise exception 'Weekly report not found'; end if;

  perform public.submit_weekly_report(v_log.placement_id, v_log.week_number);
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
  if not exists (select 1 from public.weekly_logs where placement_id = p_placement_id) then
    raise exception 'At least one weekly report must be submitted and approved before final grading';
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

revoke execute on function public.submit_weekly_log(uuid) from public, anon;
grant execute on function public.submit_weekly_log(uuid) to authenticated, service_role;
revoke execute on function public.record_grade(uuid,numeric,text) from public, anon;
grant execute on function public.record_grade(uuid,numeric,text) to authenticated, service_role;