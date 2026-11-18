begin;

create extension if not exists pgtap;

select plan(12);

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
     and c.relname in ('applications','placements','weekly_logs','evaluations')
     and t.tgname in (
       'applications_integration_webhook_event',
       'placements_integration_webhook_event',
       'weekly_logs_integration_webhook_event',
       'evaluations_integration_webhook_event'
     )
     and not t.tgisinternal),
  4,
  'application, placement, weekly report and evaluation events are captured'
);

select ok(not has_function_privilege('anon', 'public.enqueue_integration_webhook_event(text,uuid,text,jsonb)', 'execute'), 'anonymous users cannot enqueue integration webhook events');
select ok(not has_function_privilege('authenticated', 'public.capture_integration_webhook_event()', 'execute'), 'authenticated users cannot invoke the webhook trigger function');

select * from finish();
rollback;
