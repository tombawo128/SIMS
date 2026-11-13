-- Restrict workflow SECURITY DEFINER RPCs to authenticated callers.
-- Their function bodies continue to enforce per-user, role, and tenant ownership.

revoke execute on function public.accept_application(uuid, uuid, date, date) from public, anon;
revoke execute on function public.review_application(uuid, application_status, text) from public, anon;
revoke execute on function public.submit_evaluation(uuid, evaluation_type, jsonb, text, numeric) from public, anon;
revoke execute on function public.upsert_weekly_log(uuid, integer, numeric, text, text) from public, anon;
revoke execute on function public.submit_weekly_log(uuid) from public, anon;
revoke execute on function public.withdraw_application(uuid) from public, anon;

grant execute on function public.accept_application(uuid, uuid, date, date) to authenticated, service_role;
grant execute on function public.review_application(uuid, application_status, text) to authenticated, service_role;
grant execute on function public.submit_evaluation(uuid, evaluation_type, jsonb, text, numeric) to authenticated, service_role;
grant execute on function public.upsert_weekly_log(uuid, integer, numeric, text, text) to authenticated, service_role;
grant execute on function public.submit_weekly_log(uuid) to authenticated, service_role;
grant execute on function public.withdraw_application(uuid) to authenticated, service_role;
