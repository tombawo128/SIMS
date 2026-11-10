-- Private buckets for CVs and reports, public bucket for company branding.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cvs', 'cvs', false, 5242880, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('reports', 'reports', false, 10485760, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('company-logos', 'company-logos', true, 2097152, array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml'
  ])
on conflict (id) do nothing;

-- Path convention: cvs/{student_id}/{file}
create policy cvs_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy cvs_read on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and public.can_read_cv(name));

create policy cvs_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cvs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Path convention: reports/{placement_id}/{student_id}/{file}
create policy reports_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reports'
    and public.auth_role() = 'student'
    and public.can_view_placement(public.try_uuid(split_part(name, '/', 1)))
    and split_part(name, '/', 2) = auth.uid()::text
  );

create policy reports_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reports'
    and public.can_view_placement(public.try_uuid(split_part(name, '/', 1)))
  );

create policy company_logos_manage on storage.objects
  for all to authenticated
  using (
    bucket_id = 'company-logos'
    and (
      public.is_platform_admin()
      or (public.auth_role() = 'company_admin'
          and split_part(name, '/', 1) = public.auth_company_id()::text)
    )
  )
  with check (
    bucket_id = 'company-logos'
    and (
      public.is_platform_admin()
      or (public.auth_role() = 'company_admin'
          and split_part(name, '/', 1) = public.auth_company_id()::text)
    )
  );
