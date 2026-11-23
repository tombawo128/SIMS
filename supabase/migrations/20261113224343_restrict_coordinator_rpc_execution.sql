-- Restrict coordinator workflow SECURITY DEFINER RPCs to authenticated sessions.
-- The functions still enforce role, university, and placement ownership in their bodies.

revoke execute on function public.university_stats() from public, anon;
revoke execute on function public.assign_faculty_supervisor(uuid, uuid) from public, anon;
revoke execute on function public.record_grade(uuid, numeric, text) from public, anon;
revoke execute on function public.add_check_in(uuid, checkin_type, text, timestamptz) from public, anon;
revoke execute on function public.review_weekly_log(uuid, log_status, text) from public, anon;

grant execute on function public.university_stats() to authenticated, service_role;
grant execute on function public.assign_faculty_supervisor(uuid, uuid) to authenticated, service_role;
grant execute on function public.record_grade(uuid, numeric, text) to authenticated, service_role;
grant execute on function public.add_check_in(uuid, checkin_type, text, timestamptz) to authenticated, service_role;
grant execute on function public.review_weekly_log(uuid, log_status, text) to authenticated, service_role;
