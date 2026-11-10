-- Row Level Security: the only authorization boundary for tenant data.

alter table public.universities enable row level security;
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.job_postings enable row level security;
alter table public.posting_universities enable row level security;
alter table public.applications enable row level security;
alter table public.placements enable row level security;
alter table public.weekly_logs enable row level security;
alter table public.evaluations enable row level security;
alter table public.check_ins enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Directory data needed for sign-up and branding.
create policy universities_public_read on public.universities
  for select to anon, authenticated
  using (status = 'active');

create policy universities_platform_all on public.universities
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy companies_public_read on public.companies
  for select to anon, authenticated
  using (status = 'active');

create policy companies_platform_all on public.companies
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Profiles: self, tenant staff directories, and people connected via applications/placements.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.can_view_profile(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy student_profiles_select on public.student_profiles
  for select to authenticated
  using (public.can_view_profile(user_id));

create policy student_profiles_insert_self on public.student_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy student_profiles_update_self on public.student_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Postings.
create policy job_postings_select on public.job_postings
  for select to authenticated
  using (public.can_view_posting(id));

create policy job_postings_insert_company on public.job_postings
  for insert to authenticated
  with check (
    company_id = public.auth_company_id()
    and public.auth_role() in ('company_admin', 'site_supervisor')
  );

create policy job_postings_update_company on public.job_postings
  for update to authenticated
  using (public.can_manage_posting(id))
  with check (public.can_manage_posting(id));

create policy job_postings_delete_company on public.job_postings
  for delete to authenticated
  using (public.can_manage_posting(id));

create policy posting_universities_select on public.posting_universities
  for select to authenticated
  using (public.can_view_posting(posting_id));

create policy posting_universities_manage_company on public.posting_universities
  for insert to authenticated
  with check (public.can_manage_posting(posting_id));

create policy posting_universities_delete_company on public.posting_universities
  for delete to authenticated
  using (public.can_manage_posting(posting_id));

-- Applications: students own their rows; companies see their applicants; universities see their students.
create policy applications_select on public.applications
  for select to authenticated
  using (
    student_id = auth.uid()
    or (public.auth_role() in ('company_admin', 'site_supervisor') and company_id = public.auth_company_id())
    or (public.auth_role() in ('coordinator', 'faculty_supervisor') and university_id = public.auth_university_id())
  );

create policy applications_insert_self on public.applications
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and public.auth_role() = 'student'
    and university_id = public.auth_university_id()
    and status in ('draft', 'submitted')
  );

-- Placements and placement-scoped data are read-only to clients.
create policy placements_select on public.placements
  for select to authenticated
  using (public.can_view_placement(id));

create policy weekly_logs_select on public.weekly_logs
  for select to authenticated
  using (public.can_view_placement(placement_id));

create policy evaluations_select on public.evaluations
  for select to authenticated
  using (public.can_view_placement(placement_id));

create policy check_ins_select on public.check_ins
  for select to authenticated
  using (public.can_view_placement(placement_id));

create policy documents_select on public.documents
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (placement_id is not null and public.can_view_placement(placement_id))
  );

create policy documents_insert_self on public.documents
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy documents_delete_self on public.documents
  for delete to authenticated
  using (owner_id = auth.uid());

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy audit_logs_platform_read on public.audit_logs
  for select to authenticated
  using (public.is_platform_admin());

-- Privileges. RLS remains the effective boundary for authenticated users.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.universities, public.companies to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
