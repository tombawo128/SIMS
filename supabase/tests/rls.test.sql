begin;

create extension if not exists pgtap;

select plan(43);

-- Switch the JWT subject inside the current transaction.
create or replace function public.test_as(p_uid uuid)
returns void
language sql
security invoker
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text,
    true
  );
$$;

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
  'Not authorized to review this log',
  'faculty cannot review a log outside their placement'
);

-- ---------------------------------------------------------------------------
-- Students cannot mutate workflow state directly
-- ---------------------------------------------------------------------------
select public.test_as('99999999-9999-4999-8999-999999999021');

select is(
  (
    with updated as (
      update public.applications
        set status = 'rejected'
        where id = '55555555-5555-4555-8555-555555550001'
        returning 1
    )
    select count(*) from updated
  ),
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

reset role;
select set_config('request.jwt.claims', '{}', true);
update public.profiles
set account_status = 'active'
where id = '99999999-9999-4999-8999-999999999021';
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
  has_table_privilege('anon', 'public.placements', 'select'),
  false,
  'anon has no select privilege on placements'
);

select is(
  has_table_privilege('anon', 'public.job_postings', 'select'),
  false,
  'anon has no select privilege on job postings'
);

select is(
  has_table_privilege('anon', 'public.universities', 'select'),
  true,
  'anon can read the active university directory for sign-up'
);

reset role;
select * from finish();

rollback;
