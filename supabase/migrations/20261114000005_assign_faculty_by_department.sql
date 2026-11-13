alter table public.profiles add column if not exists department text;

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

  select * into v_placement from public.placements where id = p_placement_id for update;
  if not found or v_placement.university_id <> public.auth_university_id() then
    raise exception 'Placement not found';
  end if;

  select department into v_student_department
  from public.profiles where id = v_placement.student_id;

  select * into v_faculty from public.profiles where id = p_faculty_id;
  if not found
    or v_faculty.role <> 'faculty_supervisor'
    or v_faculty.university_id <> public.auth_university_id() then
    raise exception 'Select a faculty supervisor from your university';
  end if;

  if nullif(trim(v_student_department), '') is not null
    and lower(trim(coalesce(v_faculty.department, ''))) <> lower(trim(v_student_department)) then
    raise exception 'The selected faculty supervisor must belong to the student department';
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
$function$;
revoke execute on function public.assign_faculty_supervisor(uuid,uuid) from public, anon;
grant execute on function public.assign_faculty_supervisor(uuid,uuid) to authenticated, service_role;