create or replace function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_app public.applications%rowtype;
begin
  select * into v_app
  from public.applications
  where id = p_application_id
  for update;

  if not found or v_app.student_id <> auth.uid() then
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

revoke execute on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.withdraw_application(uuid) to authenticated, service_role;