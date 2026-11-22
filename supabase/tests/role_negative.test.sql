begin;
create extension if not exists pgtap;
select plan(17);

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
select throws_ok($$select public.set_user_status('99999999-9999-4999-8999-999999999021','suspended')$$,'P0001','Not authorized','coordinator cannot perform platform-level account suspension');

-- Company admin: restrict to its own tenant and assigned application workflow.
select public.role_negative_test_as('99999999-9999-4999-8999-999999999041');
select is((select count(*) from public.job_postings where company_id='22222222-2222-4222-8222-222222222202'),0::bigint,'company admin cannot read another company postings');
select throws_ok($$select public.accept_application('55555555-5555-4555-8555-555555550004','99999999-9999-4999-8999-999999999033','2027-01-01','2027-03-01')$$,'P0001','Not authorized to accept applications','company admin cannot accept another tenant application');

-- Student: no privileged data access or workflow changes.
select public.role_negative_test_as('99999999-9999-4999-8999-999999999021');
select is((select count(*) from public.integration_connections),0::bigint,'student cannot read integration connections');
select is((select count(*) from public.integration_api_keys),0::bigint,'student cannot read integration credentials');
select is((select count(*) from public.provision_tickets),0::bigint,'student cannot read privileged provision tickets');
select throws_ok($$select public.record_grade('66666666-6666-4666-8666-666666660001','unauthorized student grade')$$,'P0001','Not authorized','student cannot finalize placement grade');

-- Platform admin: privileged function execution is gated by grants, not arbitrary authenticated callers.
select is(has_function_privilege('authenticated','public.set_user_status(uuid,public.account_status)','execute'),false,'authenticated role cannot execute platform account-status RPC');
select is(has_function_privilege('anon','public.platform_stats()','execute'),false,'anonymous role cannot execute platform aggregate RPC');

reset role;
select * from finish();
rollback;
