-- Suspended accounts still carry authenticated JWTs, but auth_role() returns NULL.
-- Make the faculty statistics guard NULL-safe and pin the function search path.
create or replace function public.faculty_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or public.auth_role() is distinct from 'faculty_supervisor'::public.user_role then
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
$function$;

revoke all on function public.faculty_stats() from public, anon;
grant execute on function public.faculty_stats() to authenticated, service_role;

comment on function public.faculty_stats() is
  'Faculty statistics are available only to an authenticated active faculty supervisor; NULL role values are rejected.';
