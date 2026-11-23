-- Cache per-statement identity/role lookups in RLS predicates and index uncovered foreign keys.
drop policy if exists applications_insert_self on public.applications;
create policy applications_insert_self on public.applications
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (select public.auth_role()) = 'student'::public.user_role
    and university_id = (select public.auth_university_id())
    and status in ('draft'::public.application_status, 'submitted'::public.application_status)
  );

drop policy if exists applications_select on public.applications;
create policy applications_select on public.applications
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (
      (select public.auth_role()) in ('company_admin'::public.user_role, 'site_supervisor'::public.user_role)
      and company_id = (select public.auth_company_id())
    )
    or (
      (select public.auth_role()) in ('coordinator'::public.user_role, 'faculty_supervisor'::public.user_role)
      and university_id = (select public.auth_university_id())
    )
  );

drop policy if exists documents_delete_self on public.documents;
create policy documents_delete_self on public.documents
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists documents_insert_self on public.documents;
create policy documents_insert_self on public.documents
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (placement_id is not null and public.can_view_placement(placement_id))
  );

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.can_view_profile(id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists student_profiles_insert_self on public.student_profiles;
create policy student_profiles_insert_self on public.student_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists student_profiles_update_self on public.student_profiles;
create policy student_profiles_update_self on public.student_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index if not exists check_ins_faculty_supervisor_id_idx on public.check_ins (faculty_supervisor_id);
create index if not exists companies_deleted_by_idx on public.companies (deleted_by);
create index if not exists daily_reports_reviewed_by_idx on public.daily_reports (reviewed_by);
create index if not exists daily_reports_student_id_idx on public.daily_reports (student_id);
create index if not exists deleted_entities_deleted_by_idx on public.deleted_entities (deleted_by);
create index if not exists deleted_entities_restored_by_idx on public.deleted_entities (restored_by);
create index if not exists evaluations_evaluator_id_idx on public.evaluations (evaluator_id);
create index if not exists integration_api_keys_created_by_idx on public.integration_api_keys (created_by);
create index if not exists integration_connections_created_by_idx on public.integration_connections (created_by);
create index if not exists job_postings_created_by_idx on public.job_postings (created_by);
create index if not exists placements_graded_by_idx on public.placements (graded_by);
create index if not exists placements_posting_id_idx on public.placements (posting_id);
create index if not exists profiles_deleted_by_idx on public.profiles (deleted_by);
create index if not exists system_alerts_resolved_by_idx on public.system_alerts (resolved_by);
create index if not exists universities_deleted_by_idx on public.universities (deleted_by);
create index if not exists weekly_logs_reviewed_by_idx on public.weekly_logs (reviewed_by);