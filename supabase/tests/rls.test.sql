begin;

create extension if not exists pgtap;

select plan(125);

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

-- Evaluate the actual DELETE policy expression without deleting directly from
-- storage.objects. Supabase's protect_delete trigger intentionally requires the
-- Storage HTTP API for object deletion.
create or replace function public.test_storage_delete_policy_allows(
  p_bucket_id text,
  p_object_name text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $policy_test$
declare
  v_qual text;
  v_allowed boolean;
begin
  select qual into v_qual
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'reports_owner_delete'
    and cmd = 'DELETE';

  if v_qual is null then
    raise exception 'reports_owner_delete policy is missing';
  end if;

  execute format(
    'select coalesce((%s), false) from (select $1::text as bucket_id, $2::text as name) as candidate',
    v_qual
  ) into v_allowed using p_bucket_id, p_object_name;

  return coalesce(v_allowed, false);
end;
$policy_test$;

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Student isolation (Bay State student 1)
-- ---------------------------------------------------------------------------
select public.test_as('99999999-9999-4999-8999-999999999021');
select lives_ok(
  $$ update public.profiles
     set notification_preferences = '{"in_app_notifications":false,"application_updates":true,"supervision_updates":true,"system_announcements":true}'::jsonb
     where id = auth.uid() $$,
  'student can update notification preferences on their own profile'
);

select is(
  (select notification_preferences->>'in_app_notifications' from public.profiles where id = auth.uid()),
  'false',
  'student can read back their own notification preference'
);

select is(
  (select count(*) from public.profiles where id = '99999999-9999-4999-8999-999999999023'),
  0::bigint,
  'notification preference changes do not expose another student profile'
);

reset role;
update public.profiles
set notification_preferences = jsonb_set(
  notification_preferences,
  '{system_announcements}',
  'false'::jsonb
)
where id = '99999999-9999-4999-8999-999999999022';
set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999001');

select lives_ok(
  $$ select public.publish_admin_broadcast(
       'Preferences CI broadcast',
       'Checking that user announcement preferences are respected.',
       'student',
       '/notifications'
     ) $$,
  'platform administrator can publish an announcement to students'
);

reset role;

select is(
  (select count(*) from public.notifications
   where user_id = '99999999-9999-4999-8999-999999999021'
     and title = 'Preferences CI broadcast'),
  0::bigint,
  'global in-app notification opt-out suppresses system announcements'
);

select is(
  (select count(*) from public.notifications
   where user_id = '99999999-9999-4999-8999-999999999022'
     and title = 'Preferences CI broadcast'),
  0::bigint,
  'system announcement preference suppresses broadcast delivery'
);

select is(
  (select count(*) from public.notifications
   where user_id = '99999999-9999-4999-8999-999999999023'
     and title = 'Preferences CI broadcast'),
  1::bigint,
  'students with enabled preferences receive system announcements'
);

set local role authenticated;
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

select throws_ok(
  $$ select public.submit_evaluation(
       '66666666-6666-4666-8666-666666660001',
       'final',
       '{"professionalism":4,"technical_skill":4,"communication":4,"initiative":4}'::jsonb,
       'Company admin must not replace the assigned site supervisor.',
       4.00
     ) $$,
  'P0001',
  'Not authorized to evaluate this placement',
  'company administrator cannot replace the assigned site supervisor final evaluation'
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
  $$ select public.rate_weekly_log(
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
  $$ select public.record_grade(
       '66666666-6666-4666-8666-666666660001',
       'Final review'
     ) $$,
  'P0001',
  'The placement must reach its end date before final grading',
  'faculty cannot record a final grade before the placement end date'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.profiles
set account_status = 'suspended'
where id = '99999999-9999-4999-8999-999999999011';
set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999011');

select throws_ok(
  $$ select public.rate_weekly_log(
       '77777777-7777-4777-8777-777777770001',
       '{"professionalism":4,"technical_skill":4,"communication":4,"initiative":4}'::jsonb,
       'Suspended faculty cannot rate.'
     ) $$,
  'P0001',
  'Only the assigned university faculty supervisor can rate this weekly report',
  'suspended faculty cannot rate weekly reports'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.profiles
set account_status = 'active'
where id = '99999999-9999-4999-8999-999999999011';
set local role authenticated;


select public.test_as('99999999-9999-4999-8999-999999999021');

select throws_ok(
  $$ select public.rate_weekly_log(
       '77777777-7777-4777-8777-777777770001',
       '{"professionalism":4,"technical_skill":4,"communication":4,"initiative":4}'::jsonb,
       'Student must not rate own work.'
     ) $$,
  'P0001',
  'Only the assigned university faculty supervisor can rate this weekly report',

  'students cannot rate their own weekly reports'
);

select throws_ok(
  $$ select public.save_daily_report(
       '66666666-6666-4666-8666-666666660001',
       current_date + 1,
       8,
       'Future-dated work entry',
       'Not yet completed'
     ) $$,
  'P0001',
  'Report date must be within the placement period and cannot be in the future',
  'students cannot create future-dated daily reports'
);

select throws_ok(
  $$ select public.submit_weekly_report(
       '66666666-6666-4666-8666-666666660001',
       (select ceil((end_date - start_date + 1)::numeric / 7)::integer
        from public.placements
        where id = '66666666-6666-4666-8666-666666660001')
     ) $$,
  'P0001',
  'A weekly report can only be submitted after that placement week has ended',
  'students cannot submit a weekly report before the week ends'
);

select lives_ok(
  $$ select public.save_daily_report(
       '66666666-6666-4666-8666-666666660001',
       (select start_date + 28 from public.placements where id = '66666666-6666-4666-8666-666666660001'),
       8, 'Week five day one', 'Completed assigned work'
     ) $$,
  'student can save the first daily report for a week'
);

select lives_ok(
  $$ select public.save_daily_report(
       '66666666-6666-4666-8666-666666660001',
       (select start_date + 29 from public.placements where id = '66666666-6666-4666-8666-666666660001'),
       8, 'Week five day two', 'Completed assigned work'
     ) $$,
  'student can save the second daily report for a week'
);

select throws_ok(
  $$ select public.submit_weekly_report('66666666-6666-4666-8666-666666660001', 5) $$,
  'P0001',
  'At least 3 different daily reports are required for each internship week',
  'weekly report cannot be submitted with fewer than three daily entries'
);

select lives_ok(
  $$ select public.save_daily_report(
       '66666666-6666-4666-8666-666666660001',
       (select start_date + 30 from public.placements where id = '66666666-6666-4666-8666-666666660001'),
       8, 'Week five day three', 'Completed assigned work'
     ) $$,
  'student can save a third daily report for the week'
);

select lives_ok(
  $$ select public.save_daily_report(
       '66666666-6666-4666-8666-666666660001',
       (select start_date + 31 from public.placements where id = '66666666-6666-4666-8666-666666660001'),
       8, 'Week five day four', 'Completed assigned work'
     ) $$,
  'student can save a fourth daily report for the week'
);

select lives_ok(
  $$ select public.save_daily_report(
       '66666666-6666-4666-8666-666666660001',
       (select start_date + 32 from public.placements where id = '66666666-6666-4666-8666-666666660001'),
       8, 'Week five day five', 'Completed assigned work'
     ) $$,
  'student can save a fifth daily report for the week'
);

select throws_ok(
  $$ select public.save_daily_report(
       '66666666-6666-4666-8666-666666660001',
       (select start_date + 33 from public.placements where id = '66666666-6666-4666-8666-666666660001'),
       8, 'Week five day six', 'This must be rejected'
     ) $$,
  'P0001',
  'A maximum of 5 daily reports is allowed per internship week',
  'student cannot save more than five daily reports in a week'
);

select lives_ok(
  $$ select public.submit_weekly_report('66666666-6666-4666-8666-666666660001', 5) $$,
  'weekly report can be submitted once three to five daily entries exist and the week has ended'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.placements
set start_date = current_date - 31,
    end_date = current_date - 1
where id = '66666666-6666-4666-8666-666666660001';
set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999011');

select throws_ok(
  $$ select public.record_grade(
       '66666666-6666-4666-8666-666666660001',
       'Final review'
     ) $$,
  'P0001',
  'Every expected internship week must be submitted, approved, and rated before final grading',
  'faculty cannot finalize a placement with missing, unapproved, or unrated weeks'
);

reset role;
update public.weekly_logs
set status = 'approved',
    rating_overall = 4.00,
    rating_scores = '{"professionalism":4,"technical_skill":4,"communication":4,"initiative":4}'::jsonb,
    rated_by = '99999999-9999-4999-8999-999999999011',
    rated_at = now(),
    reviewed_by = '99999999-9999-4999-8999-999999999011',
    reviewed_at = now()
where placement_id = '66666666-6666-4666-8666-666666660001';

set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999011');

select throws_ok(
  $$ select public.record_grade(
       '66666666-6666-4666-8666-666666660001',
       'Final review'
     ) $$,
  'P0001',
  'The assigned company site supervisor must submit the final evaluation before final grading',
  'university final grade is blocked until the assigned company supervisor submits a final evaluation'
);

reset role;
set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999031');

select lives_ok(
  $$ select public.submit_evaluation(
       '66666666-6666-4666-8666-666666660001',
       'final',
       '{"professionalism":4,"technical_skill":5,"communication":4,"initiative":4}'::jsonb,
       'Final company internship evaluation completed.',
       4.25
     ) $$,
  'assigned company site supervisor can submit the final evaluation'
);

select public.test_as('99999999-9999-4999-8999-999999999011');

select throws_ok(
  $$ select public.record_grade(
       '66666666-6666-4666-8666-666666660001',
       'Final review'
     ) $$,
  'P0001',
  'The assigned university faculty supervisor must submit the final evaluation before final grading',
  'university final grade is blocked until the assigned faculty supervisor submits a final evaluation'
);

select lives_ok(
  $$ select public.submit_evaluation(
       '66666666-6666-4666-8666-666666660001',
       'final',
       '{"professionalism":5,"technical_skill":4,"communication":5,"initiative":4}'::jsonb,
       'Final university faculty evaluation completed.',
       4.50
     ) $$,
  'assigned university faculty supervisor can submit the final evaluation'
);

select is(
  public.record_grade(
    '66666666-6666-4666-8666-666666660001',
    'Final review'
  ),
  85.00::numeric,
  'automatic final grade correctly weights weekly ratings 30%, company final 40%, and faculty final 30%'
);

select throws_ok(
  $$ select public.record_grade(
       '66666666-6666-4666-8666-666666660001',
       'Attempted duplicate grade'
     ) $$,
  'P0001',
  'A final grade has already been recorded',
  'a recorded final grade cannot be overwritten or re-notified'
);

select is(
  to_regprocedure('public.record_grade(uuid,numeric,text)'),
  null::regprocedure,
  'manual client-supplied grade overload is removed'
);

reset role;
update public.profiles set department = 'Data Science' where id = '99999999-9999-4999-8999-999999999023';
update public.profiles set department = 'Data Science' where id = '99999999-9999-4999-8999-999999999013';
update public.placements
set faculty_supervisor_id = null
where id = '66666666-6666-4666-8666-666666660002';
set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999023');

select lives_ok(
  $$ select public.request_faculty_supervisor('66666666-6666-4666-8666-666666660002') $$,
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

-- ---------------------------------------------------------------------------
-- Private CV and internship report storage access
-- ---------------------------------------------------------------------------
reset role;
update public.applications
set cv_path = '99999999-9999-4999-8999-999999999021/storage-regression-cv.pdf'
where id = '55555555-5555-4555-8555-555555550001';

set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999021');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values (
       'cvs',
       '99999999-9999-4999-8999-999999999021/storage-regression-cv.pdf',
       '99999999-9999-4999-8999-999999999021',
       '{"mimetype":"application/pdf","size":1024}'::jsonb
     ) $$,
  'student can upload a CV into their own private folder'
);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values (
       'reports',
       '66666666-6666-4666-8666-666666660001/99999999-9999-4999-8999-999999999021/storage-regression-report.pdf',
       '99999999-9999-4999-8999-999999999021',
       '{"mimetype":"application/pdf","size":1024}'::jsonb
     ) $$,
  'student can upload an internship report for their own placement'
);

select public.test_as('99999999-9999-4999-8999-999999999022');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values (
       'cvs',
       '99999999-9999-4999-8999-999999999021/forbidden-cv.pdf',
       '99999999-9999-4999-8999-999999999022',
       '{"mimetype":"application/pdf","size":1024}'::jsonb
     ) $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'student cannot upload a CV into another student private folder'
);

select is(
  (select count(*) from storage.objects
   where bucket_id = 'cvs'
     and name = '99999999-9999-4999-8999-999999999021/storage-regression-cv.pdf'),
  0::bigint,
  'another student cannot read a private CV'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values (
       'reports',
       '66666666-6666-4666-8666-666666660001/99999999-9999-4999-8999-999999999022/forbidden-report.pdf',
       '99999999-9999-4999-8999-999999999022',
       '{"mimetype":"application/pdf","size":1024}'::jsonb
     ) $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'student cannot upload a report into another student placement folder'
);

select is(
  (select count(*) from storage.objects
   where bucket_id = 'reports'
     and name = '66666666-6666-4666-8666-666666660001/99999999-9999-4999-8999-999999999021/storage-regression-report.pdf'),
  0::bigint,
  'another student cannot read a private internship report'
);

reset role;
set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999041');

select is(
  (select count(*) from storage.objects
   where bucket_id = 'cvs'
     and name = '99999999-9999-4999-8999-999999999021/storage-regression-cv.pdf'),
  1::bigint,
  'company administrator can read the CV of a student who applied to its company'
);

select public.test_as('99999999-9999-4999-8999-999999999042');

select is(
  (select count(*) from storage.objects
   where bucket_id = 'cvs'
     and name = '99999999-9999-4999-8999-999999999021/storage-regression-cv.pdf'),
  0::bigint,
  'a different company cannot read the applicant CV'
);

reset role;
update public.applications
set cv_path = '99999999-9999-4999-8999-999999999022/borrowed-cv.pdf'
where id = '55555555-5555-4555-8555-555555550001';

set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999041');

select is(
  (select count(*) from storage.objects
   where bucket_id = 'cvs'
     and name = '99999999-9999-4999-8999-999999999021/storage-regression-cv.pdf'),
  0::bigint,
  'application metadata cannot grant access to a CV owned by a different student'
);

reset role;
update public.applications
set cv_path = '99999999-9999-4999-8999-999999999021/storage-regression-cv.pdf'
where id = '55555555-5555-4555-8555-555555550001';

set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999011');

select is(
  (select count(*) from storage.objects
   where bucket_id = 'cvs'
     and name = '99999999-9999-4999-8999-999999999021/storage-regression-cv.pdf'),
  1::bigint,
  'assigned faculty supervisor can read the CV for their placement'
);

select is(
  (select count(*) from storage.objects
   where bucket_id = 'reports'
     and name = '66666666-6666-4666-8666-666666660001/99999999-9999-4999-8999-999999999021/storage-regression-report.pdf'),
  1::bigint,
  'assigned faculty supervisor can read the placement report'
);

select public.test_as('99999999-9999-4999-8999-999999999031');

select is(
  (select count(*) from storage.objects
   where bucket_id = 'cvs'
     and name = '99999999-9999-4999-8999-999999999021/storage-regression-cv.pdf'),
  1::bigint,
  'assigned company site supervisor can read the CV for their placement'
);

select is(
  (select count(*) from storage.objects
   where bucket_id = 'reports'
     and name = '66666666-6666-4666-8666-666666660001/99999999-9999-4999-8999-999999999021/storage-regression-report.pdf'),
  1::bigint,
  'assigned company site supervisor can read the placement report'
);

select public.test_as('99999999-9999-4999-8999-999999999022');

select is(
  public.test_storage_delete_policy_allows(
    'reports',
    '66666666-6666-4666-8666-666666660001/99999999-9999-4999-8999-999999999021/storage-regression-report.pdf'
  ),
  false,
  'another student is denied by the actual placement report DELETE policy'
);

reset role;

select is(
  (select count(*) from storage.objects
   where bucket_id = 'reports'
     and name = '66666666-6666-4666-8666-666666660001/99999999-9999-4999-8999-999999999021/storage-regression-report.pdf'),
  1::bigint,
  'report metadata remains available after the unauthorised delete policy check'
);

set local role authenticated;
select public.test_as('99999999-9999-4999-8999-999999999021');

select is(
  public.test_storage_delete_policy_allows(
    'reports',
    '66666666-6666-4666-8666-666666660001/99999999-9999-4999-8999-999999999021/storage-regression-report.pdf'
  ),
  true,
  'the report owner is allowed by the actual placement report DELETE policy'
);

select is(
  public.test_storage_delete_policy_allows(
    'reports',
    '66666666-6666-4666-8666-666666660001/99999999-9999-4999-8999-999999999022/borrowed-report.pdf'
  ),
  false,
  'the report owner cannot delete a report stored in another student folder'
);


-- ---------------------------------------------------------------------------
-- Privileged integration data remains service-role-only
-- ---------------------------------------------------------------------------
select is(
  has_schema_privilege('anon', 'public', 'CREATE'),
  false,
  'anonymous users cannot create objects in the exposed public schema'
);

select is(
  has_schema_privilege('authenticated', 'public', 'CREATE'),
  false,
  'authenticated users cannot create objects in the exposed public schema'
);

select is(
  has_table_privilege('anon', 'public.integration_connections', 'select'),
  false,
  'anonymous users cannot read integration connections directly'
);

select is(
  has_table_privilege('authenticated', 'public.integration_connections', 'select'),
  false,
  'authenticated users cannot read integration connections directly'
);

select is(
  has_table_privilege('anon', 'public.integration_api_keys', 'select'),
  false,
  'anonymous users cannot read integration API credentials directly'
);

select is(
  has_table_privilege('authenticated', 'public.integration_api_keys', 'select'),
  false,
  'authenticated users cannot read integration API credentials directly'
);

select is(
  has_table_privilege('service_role', 'public.integration_connections', 'select')
  and has_table_privilege('service_role', 'public.integration_api_keys', 'select'),
  true,
  'trusted service role can access integration connections and credentials'
);

select is(
  (select count(*) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%'),
  0::bigint,
  'every public SECURITY DEFINER function has a pinned search_path'
);

select is(
  (select count(*) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and p.proname <> 'admin_signup_available'
     and has_function_privilege('anon', p.oid, 'execute')),
  0::bigint,
  'anonymous users cannot execute privileged SECURITY DEFINER functions'
);

select is(
  has_table_privilege('service_role', 'public.provision_tickets', 'delete'),
  true,
  'trusted service role can consume and expire provisioning tickets'
);

reset role;
select * from finish();

rollback;
