-- Remove overlapping permissive tenant-directory policies while preserving public
-- active-directory reads and platform-admin access to all tenant records.
drop policy if exists companies_platform_all on public.companies;
drop policy if exists companies_public_read on public.companies;
create policy companies_public_read on public.companies
  for select to anon
  using (status = 'active'::public.tenant_status);
create policy companies_authenticated_read on public.companies
  for select to authenticated
  using (status = 'active'::public.tenant_status or (select public.is_platform_admin()));
create policy companies_platform_insert on public.companies
  for insert to authenticated
  with check ((select public.is_platform_admin()));
create policy companies_platform_update on public.companies
  for update to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));
create policy companies_platform_delete on public.companies
  for delete to authenticated
  using ((select public.is_platform_admin()));

drop policy if exists universities_platform_all on public.universities;
drop policy if exists universities_public_read on public.universities;
create policy universities_public_read on public.universities
  for select to anon
  using (status = 'active'::public.tenant_status);
create policy universities_authenticated_read on public.universities
  for select to authenticated
  using (status = 'active'::public.tenant_status or (select public.is_platform_admin()));
create policy universities_platform_insert on public.universities
  for insert to authenticated
  with check ((select public.is_platform_admin()));
create policy universities_platform_update on public.universities
  for update to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));
create policy universities_platform_delete on public.universities
  for delete to authenticated
  using ((select public.is_platform_admin()));

create index if not exists admin_broadcasts_created_by_idx on public.admin_broadcasts (created_by);
create index if not exists applications_reviewed_by_idx on public.applications (reviewed_by);