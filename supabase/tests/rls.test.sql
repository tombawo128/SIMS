begin;

create extension if not exists pgtap;

select plan(71);

-- Switch the JWT subject inside the current transaction.
create or replace function public.test_as(p_uid uuid)
returns void
language plpgsql
security invoker
as $$
begin
  -- Supabase auth.uid() versions may read the legacy subject GUC before
  -- falling back to the full claims JSON. Keep both values in sync when
  -- switching identities inside this transaction.
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function public.test_application_update_row_count()
returns bigint
language plpgsql
security invoker
as $test$
declare
  v_rows bigint;
begin
  update public.applications
  set status = 'rejected'
  where id = '55555555-5555-4555-8555-555555550001';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$test$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Student isolation (Bay State student 1)
-- ---------------------------------------------------------------------------
select public.test_as('99999999-9999-4999-8999-999999999021');

select is(
  (select count(*) from public.weekly_logs where placement_id = '66666666-6666-4666-8666-666666660001'),
  4::bigint,
  'student can read their own weekly logs'
);

select is(
  (select count(*) from public.weekly_logs where placement_id = '66666666-6666-4666-8666-666666660002'),
  0::bigint,
  'student cannot read another university student weekly logs'
);

select is(
  (select count(*) from public.profiles where id = '99999999-9999-4999-8999-999999999021'),
  1::bigint,
  'student can read their own profile'
);

select is(
  (select count(*) from public.profiles where id = '99999999-9999-4999-8999-999999999023'),
  0::bigint,
  'student cannot read another university student profile'
);

select is(
  (select count(*) from public.applications),
  2::bigint,
  'student sees only their own applications'
);

select is(
  (select count(*) from public.applications where student_id = '99999999-9999-4999-8999-999999999023'),
  0::bigint,
  'student cannot read another student applications'
);

select is(
  (select count(*) from public.job_postings where status = 'published'),
  3::bigint,
  'student sees published postings visible to their university'
);

-- ---------------------------------------------------------------------------
-- Company isolation (Acme admin)
-- ---------------------------------------------------------------------------
select public.test_as('99999999-9999-4999-8999-999999999041');

select lives_ok(
  $$ insert into public.job_postings (company_id, title, description, location)
     values (public.auth_company_id(), 'RLS company draft test', 'Draft created by company admin', 'Kigali')
     returning id $$,
  'company admin can create a posting and receive its id'
);

select is(
  (select count(*) from public.job_postings where title = 'RLS company draft test'),
  1::bigint,
  'company admin can read its own draft posting immediately after insert'
);

select is(
  (select count(*) from public.applications),
  3::bigint,
  'company admin sees only applications to their company postings'
);

select is(
  (select count(*) from public.applications where company_id = '22222222-2222-4222-8222-222222222202'),
  0::bigint,
  'company admin cannot see another company applications'
);

select is(
  (select count(*) from public.placements),
  1::bigint,
  'company admin sees their company placements'
);

select is(
  (select count(*) from public.placements where id = '66666666-6666-4666-8666-666666660002'),
  0::bigint,
  'company admin cannot see another company placement'
);

select throws_ok(
  $$ select public.accept_application(
       '55555555-5555-4555-8555-555555550004',
       '99999999-9999-4999-8999-999999999033',
       '2027-01-01',
       '2027-03-01'
     ) $$,
  'P0001',
  'Not authorized to accept applications',
  'company cannot accept another company application'
);

-- ---------------------------------------------------------------------------
-- University isolation (Bay State coordinator)
-- ---------------------------------------------------------------------------
select public.test_as('99999999-9999-4999-8999-999999999002');

select is(
  (select count(*) from public.placements),
  1::bigint,
  'coordinator sees only placements at their university'
);

select is(
  (select count(*) from public.profiles where role = 'student' and university_id = '11111111-1111-4111-8111-111111111101'),
  2::bigint,
  'coordinator sees their university students'
);

select is(
  (select count(*) from public.profiles where id = '99999999-9999-4999-8999-999999999023'),
  0::bigint,
  'coordinator cannot see another university student'
);

select is(
  (select count(*) from public.applications),
  5::bigint,
  'coordinator sees only applications from their university'
);

-- ---------------------------------------------------------------------------
-- Faculty isolation
-- ---------------------------------------------------------------------------
select public.test_as('99999999-9999-4999-8999-999999999011');

select is(
  (select count(*) from public.weekly_logs where placement_id = '66666666-6666-4666-8666-666666660001'),
  4::bigint,
  'faculty supervisor can read logs for their assigned placement'
);

select is(
  (select count(*) from public.weekly_logs where placement_id = '66666666-6666-4666-8666-666666660002'),
  0::bigint,
  'faculty supervisor cannot read logs for another placement'
);

select throws_ok(
  $$ select public.review_weekly_log(
       '77777777-7777-4777-8777-777777770005',
       'approved',
       'looks good'
     ) $$,
  'P0001',
  'Only the assigned university faculty supervisor can approve this weekly report',
  'faculty cannot review a log outside their placement'
);

-- ---------------------------------------------------------------------------
-- Students cannot mutate workflow state directly
-- ---------------------------------------------------------------------------
select public.test_as('99999999-9999-4999-8999-999999999021');

select is(
  public.test_application_update_row_count(),
  0::bigint,
  'students cannot update application status directly'
);

select is(
  (select status::text from public.applications where id = '55555555-5555-4555-8555-555555550001'),
  'accepted',
  'application status is unchanged after the blocked update'
);

select throws_ok(
  $$ update public.profiles
       set role = 'coordinator'
       where id = '99999999-9999-4999-8999-999999999021' $$,
  'P0001',
  'You cannot change protected account or tenant fields',
  'students cannot escalate their role'
);

select throws_ok(
  $$ update public.profiles
       set account_status = 'suspended'
       where id = '99999999-9999-4999-8999-999999999021' $$,
  'P0001',
  'You cannot change protected account or tenant fields',
  'users cannot suspend or reactivate their own account'
);

select throws_ok(
  $$ update public.profiles
       set deleted_at = now()
       where id = '99999999-9999-4999-8999-999999999021' $$,
  'P0001',
  'You cannot change protected account or tenant fields',
  'users cannot archive their own account'
);

select throws_ok(
  $$ update public.profiles
       set deleted_by = auth.uid()
       where id = '99999999-9999-4999-8999-999999999021' $$,
  'P0001',
  'You cannot change protected account or tenant fields',
  'users cannot forge archive attribution'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.profiles
set account_status = 'suspended'
where id = '99999999-9999-4999-8999-999999999021';
set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999021');

select is(
  public.auth_role()::text,
  null::text,
  'suspended users have no effective application role'
);

select is(
  public.auth_university_id(),
  null::uuid,
  'suspended users have no effective university tenant'
);

select is(
  public.can_view_placement('66666666-6666-4666-8666-666666660001'),
  false,
  'suspended students cannot read placement records'
);

select is(
  public.can_read_cv('99999999-9999-4999-8999-999999999021/cv.pdf'),
  false,
  'suspended students cannot read their private CV files'
);

select throws_ok(
  $test$ select public.save_daily_report(
       '66666666-6666-4666-8666-666666660001',
       current_date,
       1,
       'blocked test',
       ''
     ) $test$,
  'P0001',
  'Only active students can save daily reports',
  'suspended students cannot save daily reports'
);

select throws_ok(
  $test$ select public.upsert_weekly_log(
       '66666666-6666-4666-8666-666666660001',
       1,
       1,
       'blocked test',
       ''
     ) $test$,
  'P0001',
  'Only active students can edit weekly reports',
  'suspended students cannot edit weekly reports'
);

select throws_ok(
  $test$ select public.submit_weekly_report(
       '66666666-6666-4666-8666-666666660001',
       1
     ) $test$,
  'P0001',
  'Only active students can submit weekly reports',
  'suspended students cannot submit weekly reports'
);

select throws_ok(
  $test$ select public.submit_weekly_log('77777777-7777-4777-8777-777777770001') $test$,
  'P0001',
  'Only active students can submit weekly reports',
  'suspended students cannot submit legacy weekly logs'
);

select throws_ok(
  $test$ select public.withdraw_application('55555555-5555-4555-8555-555555550001') $test$,
  'P0001',
  'Only active students can withdraw applications',
  'suspended students cannot withdraw applications'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.profiles
set account_status = 'active'
where id = '99999999-9999-4999-8999-999999999021';

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.profiles
set account_status = 'suspended'
where id = '99999999-9999-4999-8999-999999999011';
set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999011');

select throws_ok(
  $test$ select public.add_check_in(
       '66666666-6666-4666-8666-666666660001',
       'visit',
       'blocked test',
       now()
     ) $test$,
  'P0001',
  'Only an active faculty supervisor can log a check-in',
  'suspended faculty cannot log placement check-ins'
);

select throws_ok(
  $test$ select public.submit_evaluation(
       '66666666-6666-4666-8666-666666660001',
       'final',
       '{}'::jsonb,
       'blocked test',
       8.5
     ) $test$,
  'P0001',
  'Not authorized to evaluate this placement',
  'suspended faculty cannot submit evaluations'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.profiles
set account_status = 'active'
where id = '99999999-9999-4999-8999-999999999011';
set local role authenticated;

select is(
  has_function_privilege('anon', 'public.notify_user(uuid,text,text,text)', 'execute'),
  false,
  'anonymous users cannot execute notify_user'
);

select is(
  has_function_privilege('authenticated', 'public.notify_user(uuid,text,text,text)', 'execute'),
  false,
  'authenticated users cannot execute notify_user directly'
);

select is(
  has_function_privilege('service_role', 'public.notify_user(uuid,text,text,text)', 'execute'),
  true,
  'trusted service role can execute notify_user'
);

select is(
  public.admin_signup_available(),
  false,
  'public administrator bootstrap is permanently disabled'
);

select is(
  has_function_privilege('anon', 'public.admin_signup_available()', 'execute'),
  true,
  'legacy signup clients can still call the disabled feature check'
);

select is(
  has_function_privilege('anon', 'public.assign_platform_admin_slot()', 'execute'),
  false,
  'anonymous users cannot execute the platform-admin slot trigger'
);

select is(
  has_function_privilege('authenticated', 'public.assign_platform_admin_slot()', 'execute'),
  false,
  'authenticated users cannot execute the platform-admin slot trigger'
);

select is(
  has_function_privilege('anon', 'public.list_platform_admins()', 'execute'),
  false,
  'anonymous users cannot list platform administrators'
);

select is(
  has_function_privilege('anon', 'public.set_user_status(uuid,public.account_status)', 'execute'),
  false,
  'anonymous users cannot execute administrative account-status changes'
);

select is(
  has_function_privilege('authenticated', 'public.guard_profile_update()', 'execute'),
  false,
  'trigger-only profile guard cannot be called as a Data API RPC'
);

select is(
  has_table_privilege('anon', 'public.provision_tickets', 'select'),
  false,
  'anonymous users cannot read privileged provisioning tickets'
);

select is(
  has_table_privilege('authenticated', 'public.provision_tickets', 'select'),
  false,
  'authenticated users cannot read privileged provisioning tickets'
);

select is(
  has_table_privilege('service_role', 'public.provision_tickets', 'select'),
  true,
  'trusted service role can read provisioning tickets'
);

select is(
  has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
  false,
  'anonymous users cannot invoke the auth-user trigger function'
);

select is(
  has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  false,
  'authenticated users cannot invoke the auth-user trigger function'
);

select is(
  (select count(*) from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname in ('post_images_authenticated_upload', 'post_images_owner_select', 'post_images_owner_delete')),
  3::bigint,
  'post image storage policies are present for owner-scoped access'
);

-- ---------------------------------------------------------------------------
-- Second university visibility and platform aggregates
-- ---------------------------------------------------------------------------
select public.test_as('99999999-9999-4999-8999-999999999024');

select is(
  (select count(*) from public.job_postings where status = 'published'),
  3::bigint,
  'Northbridge student sees published postings targeted at their university'
);

select public.test_as('99999999-9999-4999-8999-999999999001');

select is(
  (public.platform_stats() ->> 'universities')::integer,
  2,
  'platform admin can read aggregate tenant counts'
);

select is(
  (select platform_admin_slot from public.profiles where id = '99999999-9999-4999-8999-999999999001'),
  1::smallint,
  'existing platform administrator receives a protected administrator slot'
);

select is(
  (select count(*) from public.profiles where platform_admin_slot is not null),
  1::bigint,
  'only the existing administrator occupies an administrator slot'
);

-- ---------------------------------------------------------------------------
-- Lifecycle RPC: accepting an application creates a placement
-- ---------------------------------------------------------------------------
select public.test_as('99999999-9999-4999-8999-999999999041');

select isnt(
  public.accept_application(
    '55555555-5555-4555-8555-555555550002',
    '99999999-9999-4999-8999-999999999031',
    '2027-01-05',
    '2027-04-05'
  ),
  null,
  'company admin can accept an application and create a placement'
);

-- ---------------------------------------------------------------------------
-- Anonymous access is denied on tenant data
-- ---------------------------------------------------------------------------
reset role;
set local role anon;

select is(
  (select count(*) from public.placements),
  0::bigint,
  'anonymous users cannot read placement records through RLS'
);

select is(
  (select count(*) from public.job_postings),
  0::bigint,
  'anonymous users cannot read job postings through RLS'
);

select is(
  has_table_privilege('anon', 'public.universities', 'select'),
  true,
  'anon can read the active university directory for sign-up'
);

select is(
  (select count(*) from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname = 'reports_owner_delete'
     and cmd = 'DELETE'
     and roles = array['authenticated']::name[]),
  1::bigint,
  'report storage deletion is limited to the authenticated owner policy'
);


-- ---------------------------------------------------------------------------
-- Weekly ratings, student supervisor requests, and final-grade safeguards
-- ---------------------------------------------------------------------------
reset role;
update public.placements
set end_date = current_date + 30
where id = '66666666-6666-4666-8666-666666660001';
set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999011');

select lives_ok(
  $$ $1
       '77777777-7777-4777-8777-777777770001',
       '{"professionalism":4,"technical_skill":5,"communication":4,"initiative":4}'::jsonb,
       'Delivered assigned work reliably and communicated progress clearly.'
     ) $$,
  'assigned faculty supervisor can rate an approved weekly report'
);

select is(
  (select rating_overall from public.weekly_logs where id = '77777777-7777-4777-8777-777777770001'),
  4.25::numeric,
  'weekly rating average is calculated from the four rubric criteria'
);

select throws_ok(
  $$ $1
       '66666666-6666-4666-8666-666666660001',
       85,
       'Final review'
     ) $$,
  'P0001',
  'The placement must reach its end date before final grading',
  'faculty cannot record a final grade before the placement end date'
);

select public.test_as('99999999-9999-4999-8999-999999999021');

select throws_ok(
  $$ $1
       '77777777-7777-4777-8777-777777770001',
       '{"professionalism":4,"technical_skill":4,"communication":4,"initiative":4}'::jsonb,
       'Student must not rate own work.'
     ) $$,
  'P0001',
  'Only the assigned university faculty supervisor can rate this weekly report',
  'students cannot rate their own weekly reports'
);

reset role;
update public.placements
set faculty_supervisor_id = null
where id = '66666666-6666-4666-8666-666666660002';
set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999023');

select lives_ok(
  $$ $1'66666666-6666-4666-8666-666666660002') $,
  'student can request a university faculty supervisor for an unassigned placement'
);

select is(
  (select status from public.faculty_supervisor_requests
   where placement_id = '66666666-6666-4666-8666-666666660002'),
  'pending',
  'student supervisor request is stored as pending'
);

select public.test_as('99999999-9999-4999-8999-999999999003');

select is(
  (select count(*) from public.faculty_supervisor_requests
   where placement_id = '66666666-6666-4666-8666-666666660002'),
  1::bigint,
  'the matching university coordinator can see the student supervisor request'
);

select public.assign_faculty_supervisor(
  '66666666-6666-4666-8666-666666660002',
  '99999999-9999-4999-8999-999999999013'
);

select is(
  (select status from public.faculty_supervisor_requests
   where placement_id = '66666666-6666-4666-8666-666666660002'),
  'assigned',
  'coordinator assignment updates the student request to assigned'
);

reset role;
select * from finish();

rollback;
