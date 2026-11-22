-- Phase 2 post-merge gate: ensure abandoned webhook claims at the retry ceiling are terminalized.
-- Source-only migration; apply only after staging validation and release approval.
create or replace function public.claim_integration_webhook_deliveries(p_limit integer default 10)
returns table (
  id uuid,
  webhook_id uuid,
  event_type text,
  payload jsonb,
  attempts integer,
  endpoint_url text,
  secret_ciphertext text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Expired processing claims at the retry ceiling cannot be reclaimed;
  -- mark them terminal rather than leaving them stuck indefinitely.
  update public.integration_webhook_deliveries d
  set status = 'failed',
      last_error = coalesce(d.last_error, 'Worker lease expired after retry ceiling'),
      next_attempt_at = pg_catalog.now()
  where d.status = 'processing'
    and d.next_attempt_at <= pg_catalog.now()
    and d.attempts >= 8;

  return query
  with picked as (
    select d.id
    from public.integration_webhook_deliveries d
    join public.integration_webhooks w on w.id = d.webhook_id
    where d.status in ('pending', 'processing')
      and d.next_attempt_at <= pg_catalog.now()
      and d.attempts < 8
      and w.status = 'active'
    order by d.next_attempt_at, d.created_at
    for update of d skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 25))
  ),
  claimed as (
    update public.integration_webhook_deliveries d
    set status = 'processing',
        attempts = d.attempts + 1,
        next_attempt_at = pg_catalog.now() + interval '5 minutes'
    from picked
    where d.id = picked.id
    returning d.id, d.webhook_id, d.event_type, d.payload, d.attempts
  )
  select c.id, c.webhook_id, c.event_type, c.payload, c.attempts, w.endpoint_url, w.secret_ciphertext
  from claimed c
  join public.integration_webhooks w on w.id = c.webhook_id;
end;
$$;

revoke all on function public.claim_integration_webhook_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_integration_webhook_deliveries(integer) to service_role;
