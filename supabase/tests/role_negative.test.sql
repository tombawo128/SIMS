begin;
create extension if not exists pgtap;
select plan(21);

-- Fixture identities/placements are seeded by the established CI RLS fixture.
create or replace function public.role_negative_test_as(p_uid uuid)
returns void language plpgsql security invoker as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated')::text, true);
end; $$;

set local role authenticated;

-- Faculty supervisor: assigned placement only; cannot mutate application or tenant.
select public.role_negative_test_as('99999999-9999-4999-8999-999999999011');
select is((select count(*) from public.placements where id='66666666-6666-4666-8666-666666660002'),0::bigint,'faculty cannot see unassigned/other placement');
select is((select count(*) from public.applications where id='55555555-5555-4555-8555-555555550004'),0::bigint,'faculty cannot see unrelated application');
select throws_ok($$select public.review_weekly_log('77777777-7777-4777-8777-777777770006','approved','unauthorized')$$,'P0001','Only the assigned university faculty supervisor can approve this weekly report','faculty cannot approve another placement report');

-- Site supervisor: company-scoped placement only, no cross-company evaluations.
select public.role_negative_test_as('99999999-9999-4999-8999-999999999031');
select is((select count(*) from public.placements where id='66666666-6666-4666-8666-666666660002'),0::bigint,'site supervisor cannot see another company placement');
select is((select count(*) from public.evaluations where placement_id='66666666-6666-4666-8666-666666660002'),0::bigint,'site supervisor cannot read another company evaluation');
select throws_ok($$select public.submit_evaluation('66666666-6666-4666-8666-666666660002','final','{"professionalism":4,"technical_skill":4,"communication":4,"initiative":4}'::jsonb,'cross-company test',4)$$,'P0001','Not authorized to evaluate this placement','site supervisor cannot submit a cross-company evaluation');

-- Coordinator: university boundary and privilege separation.
select public.role_negative_test_as('99999999-9999-4999-8999-999999999002');
select is((select count(*) from public.placements where id='66666666-6666-4666-8666-666666660002'),0::bigint,'coordinator cannot see foreign university placement');
select is((select count(*) from public.profiles where id='99999999-9999-4999-8999-999999999024'),0::bigint,'coordinator cannot read foreign university student profile');
select throws_ok($$select public.set_user_status('99999999-9999-4999-8999-999999999021','suspended')$$,'P0001','Only a general administrator can manage user accounts','coordinator cannot perform platform-level account suspension');

-- Company admin: restrict to its own tenant and assigned application workflow.
select public.role_negative_test_as('99999999-9999-4999-8999-999999999041');
select is((select count(*) from public.job_postings where id='44444444-4444-4444-8444-444444440005'),0::bigint,'company admin cannot read another company draft posting');
select throws_ok($$select public.accept_application('55555555-5555-4555-8555-555555550004','99999999-9999-4999-8999-999999999033','2027-01-01','2027-03-01')$$,'P0001','Not authorized to accept applications','company admin cannot accept another tenant application');

-- Student: no privileged data access or workflow changes.
select public.role_negative_test_as('99999999-9999-4999-8999-999999999021');
select is(has_table_privilege('authenticated','public.integration_connections','select'),false,'student role has no direct SELECT privilege on integration connections');
select is(has_table_privilege('authenticated','public.integration_api_keys','select'),false,'student role has no direct SELECT privilege on integration credentials');
select is(has_table_privilege('authenticated','public.provision_tickets','select'),false,'student role has no direct SELECT privilege on privileged provision tickets');
select throws_ok($$select public.record_grade('66666666-6666-4666-8666-666666660001','unauthorized student grade')$$,'P0001','Not authorized','student cannot finalize placement grade');

-- Platform admin: privileged function execution is gated by grants, not arbitrary authenticated callers.
select is(has_function_privilege('authenticated','public.set_user_status(uuid,public.account_status)','execute'),false,'authenticated role cannot execute platform account-status RPC');
select is(has_function_privilege('anon','public.platform_stats()','execute'),false,'anonymous role cannot execute platform aggregate RPC');

-- Suspended accounts still carry authenticated JWTs. The role helper returns
-- NULL for them, so SECURITY DEFINER guards must use NULL-safe comparisons.
reset role;
update public.profiles
set account_status = 'suspended'
where id = '99999999-9999-4999-8999-999999999003';
set local role authenticated;
select public.role_negative_test_as('99999999-9999-4999-8999-999999999003');

select throws_ok(
  $ select public.assign_faculty_supervisor(
       '66666666-6666-4666-8666-666666660002',
       '99999999-9999-4999-8999-999999999013'
     ) $,
  'P0001',
  'Only internship coordinators can assign faculty supervisors',
  'suspended coordinator cannot assign faculty supervisors'
);

reset role;
update public.profiles
set account_status = 'active'
where id = '99999999-9999-4999-8999-999999999003';

update public.profiles
set account_status = 'suspended'
where id = '99999999-9999-4999-8999-999999999011';
set local role authenticated;
select public.role_negative_test_as('99999999-9999-4999-8999-999999999011');

select throws_ok(
  $ select public.faculty_stats() $,
  'P0001',
  'Not authorized',
  'suspended faculty cannot read faculty statistics'
);

select throws_ok(
  $ select public.review_weekly_log(
       '77777777-7777-4777-8777-777777770001',
       'approved',
       'Suspended faculty cannot review.'
     ) $,
  'P0001',
  'Only the assigned university faculty supervisor can approve this weekly report',
  'suspended faculty cannot review weekly reports'
);

select throws_ok(
  $ select public.record_grade(
       '66666666-6666-4666-8666-666666660001',
       85,
       'Suspended faculty cannot grade.'
     ) $,
  'P0001',
  'Only the assigned university faculty supervisor can record the official final grade',
  'suspended faculty cannot record final grades'
);

reset role;
update public.profiles
set account_status = 'active'
where id = '99999999-9999-4999-8999-999999999011';

reset role;
select * from finish();
rollback;
