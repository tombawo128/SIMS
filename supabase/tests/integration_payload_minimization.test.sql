begin;
create extension if not exists pgtap;
select plan(4);

insert into public.integration_connections (id, name, organization_type, university_id, created_by)
values ('77777777-7777-4777-8777-777777770003','payload minimization university','university','11111111-1111-4111-8111-111111111101','99999999-9999-4999-8999-999999999001');
insert into public.integration_connections (id, name, organization_type, company_id, created_by)
values ('77777777-7777-4777-8777-777777770004','payload minimization company','company','22222222-2222-4222-8222-222222222201','99999999-9999-4999-8999-999999999001');

insert into public.integration_webhooks (id, integration_id, name, endpoint_url, events, secret_ciphertext, created_by)
values
  ('88888888-8888-4888-8888-888888880003','77777777-7777-4777-8777-777777770003','University payload hook','https://hooks.example.com/payload-university',array['placement.completed','evaluation.completed'],'test-ciphertext','99999999-9999-4999-8999-999999999001'),
  ('88888888-8888-4888-8888-888888880004','77777777-7777-4777-8777-777777770004','Company payload hook','https://hooks.example.com/payload-company',array['placement.completed','evaluation.completed'],'test-ciphertext','99999999-9999-4999-8999-999999999001');

update public.placements
set status='completed', final_grade=88
where id='66666666-6666-4666-8666-666666660001';

select is(
  (select count(*)::integer from public.integration_webhook_deliveries
   where webhook_id in ('88888888-8888-4888-8888-888888880003','88888888-8888-4888-8888-888888880004')
     and event_type='placement.completed'),
  2,
  'placement completion is queued for both tenant connections'
);
select ok(
  (select bool_and(not (payload ? 'final_grade'))
   from public.integration_webhook_deliveries
   where webhook_id in ('88888888-8888-4888-8888-888888880003','88888888-8888-4888-8888-888888880004')
     and event_type='placement.completed'),
  'placement webhook payloads omit final grades'
);

insert into public.evaluations (id, placement_id, evaluator_id, evaluator_role, type, rubric_scores, comments, overall_score)
values ('88888888-8888-4888-8888-888888880003','66666666-6666-4666-8666-666666660001','99999999-9999-4999-8999-999999999031','site_supervisor','final','{"professionalism":4,"technical_skill":5,"communication":4,"initiative":4}'::jsonb,'Synthetic final evaluation',4.25);

select is(
  (select count(*)::integer from public.integration_webhook_deliveries
   where webhook_id in ('88888888-8888-4888-8888-888888880003','88888888-8888-4888-8888-888888880004')
     and event_type='evaluation.completed'),
  2,
  'evaluation events are queued for both tenant connections'
);
select ok(
  (select bool_and(not (payload ? 'overall_score') and not (payload ? 'rubric_scores') and not (payload ? 'comments'))
   from public.integration_webhook_deliveries
   where webhook_id in ('88888888-8888-4888-8888-888888880003','88888888-8888-4888-8888-888888880004')
     and event_type='evaluation.completed'),
  'evaluation webhook payloads omit scores, rubrics and comments'
);

select * from finish();
rollback;
