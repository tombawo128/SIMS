begin;

create extension if not exists pgtap;

select plan(18);

select ok(to_regclass('public.integration_webhooks') is not null, 'webhook configuration table exists');
select ok(to_regclass('public.integration_webhook_deliveries') is not null, 'webhook delivery outbox exists');
select ok(to_regclass('public.integration_sso_configs') is not null, 'tenant SSO configuration table exists');
select ok(to_regclass('public.integration_embeds') is not null, 'tenant embed configuration table exists');

select is(
  (select count(*)::integer
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('integration_webhooks','integration_webhook_deliveries','integration_sso_configs','integration_embeds')
     and c.relrowsecurity),
  4,
  'RLS is enabled on every new integration service table'
);

select ok(not has_table_privilege('anon', 'public.integration_webhooks', 'select'), 'anonymous users cannot read webhook secrets');
select ok(not has_table_privilege('authenticated', 'public.integration_webhooks', 'select'), 'authenticated users cannot read webhook secrets');
select ok(not has_table_privilege('authenticated', 'public.integration_webhook_deliveries', 'select'), 'authenticated users cannot read webhook delivery payloads');
select ok(not has_table_privilege('authenticated', 'public.integration_sso_configs', 'select'), 'authenticated users cannot read SSO provider configuration');
select ok(not has_table_privilege('authenticated', 'public.integration_embeds', 'select'), 'authenticated users cannot read embed configuration directly');

select is(
  (select count(*)::integer
   from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('applications','placements','weekly_logs','daily_reports','evaluations')
     and t.tgname in (
       'applications_integration_webhook_event',
       'placements_integration_webhook_event',
       'weekly_logs_integration_webhook_event',
       'daily_reports_integration_webhook_event',
       'evaluations_integration_webhook_event'
     )
     and not t.tgisinternal),
  5,
  'application, placement, daily and weekly report, and evaluation events are captured'
);

select ok(not has_function_privilege('anon', 'public.enqueue_integration_webhook_event(text,uuid,text,jsonb)', 'execute'), 'anonymous users cannot enqueue integration webhook events');
select ok(not has_function_privilege('authenticated', 'public.capture_integration_webhook_event()', 'execute'), 'authenticated users cannot invoke the webhook trigger function');
select ok(has_function_privilege('service_role', 'public.claim_integration_webhook_deliveries(integer)', 'execute'), 'service role can claim queued webhook deliveries');
select ok(not has_function_privilege('authenticated', 'public.claim_integration_webhook_deliveries(integer)', 'execute'), 'authenticated users cannot claim queued webhook deliveries');
insert into public.integration_connections (id, name, organization_type, university_id, created_by)
values (
  '77777777-7777-4777-8777-777777770001',
  'pgTAP University webhook',
  'university',
  '11111111-1111-4111-8111-111111111101',
  '99999999-9999-4999-8999-999999999001'
);
insert into public.integration_connections (id, name, organization_type, company_id, created_by)
values (
  '77777777-7777-4777-8777-777777770002',
  'pgTAP Company webhook',
  'company',
  '22222222-2222-4222-8222-222222222201',
  '99999999-9999-4999-8999-999999999001'
);

insert into public.integration_webhooks (id, integration_id, name, endpoint_url, events, secret_ciphertext, created_by)
values
  ('88888888-8888-4888-8888-888888880001', '77777777-7777-4777-8777-777777770001', 'University status hook', 'https://hooks.example.com/university', array['application.status_changed'], 'test-ciphertext', '99999999-9999-4999-8999-999999999001'),
  ('88888888-8888-4888-8888-888888880002', '77777777-7777-4777-8777-777777770002', 'Company status hook', 'https://hooks.example.com/company', array['application.status_changed'], 'test-ciphertext', '99999999-9999-4999-8999-999999999001');

update public.applications
set status = 'under_review'
where id = '55555555-5555-4555-8555-555555550001';

select is(
  (select count(*)::integer from public.integration_webhook_deliveries
   where webhook_id in ('88888888-8888-4888-8888-888888880001','88888888-8888-4888-8888-888888880002')),
  2,
  'application status event is queued once for each matching tenant connection'
);
select ok(
  (select bool_and(not (payload ? 'student_id') and not (payload ? 'email') and not (payload ? 'cover_letter'))
   from public.integration_webhook_deliveries
   where webhook_id in ('88888888-8888-4888-8888-888888880001','88888888-8888-4888-8888-888888880002')),
  'webhook payloads omit student identifiers, emails and cover letters'
);
select is(
  (select count(*)::integer from public.claim_integration_webhook_deliveries(2)),
  2,
  'delivery worker can atomically claim both queued tenant deliveries'
);


select * from finish();
rollback;
