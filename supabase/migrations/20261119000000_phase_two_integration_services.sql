-- Phase Two integration services: webhook delivery, SSO configuration and public embeds.
-- This migration is source-only until the production backup/recovery gate is signed off.

create table public.integration_webhooks (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integration_connections(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  endpoint_url text not null check (endpoint_url ~ '^https://[^[:space:]]+$'),
  events text[] not null check (
    cardinality(events) > 0
    and events <@ array[
      'application.submitted',
      'application.status_changed',
      'placement.created',
      'placement.status_changed',
      'placement.completed',
      'weekly_report.submitted',
      'weekly_report.reviewed',
      'daily_report.submitted',
      'daily_report.reviewed',
      'evaluation.completed'
    ]::text[]
  ),
  secret_ciphertext text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index integration_webhooks_connection_idx on public.integration_webhooks(integration_id, status);

create table public.integration_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.integration_webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_status_code integer,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index integration_webhook_deliveries_due_idx
  on public.integration_webhook_deliveries(status, next_attempt_at, created_at)
  where status in ('pending', 'processing');
create index integration_webhook_deliveries_webhook_idx
  on public.integration_webhook_deliveries(webhook_id, created_at desc);

create table public.integration_sso_configs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null unique references public.integration_connections(id) on delete cascade,
  protocol text not null check (protocol in ('oidc', 'saml')),
  issuer_url text not null check (issuer_url ~ '^https://[^[:space:]]+$'),
  client_id text,
  metadata_url text,
  auth_provider_id uuid unique,
  provider_config_ciphertext text not null,
  email_domains text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'pending_verification', 'active', 'disabled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_sso_config_protocol_fields check (
    (protocol = 'oidc' and client_id is not null and char_length(trim(client_id)) > 0)
    or
    (protocol = 'saml' and metadata_url is not null and metadata_url ~ '^https://[^[:space:]]+$')
  )
);

create table public.integration_embeds (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integration_connections(id) on delete cascade,
  public_token text not null unique,
  title text not null default 'Internship opportunities' check (char_length(trim(title)) between 2 and 120),
  allowed_origins text[] not null default '{}',
  display_options jsonb not null default '{"show_company":true,"show_location":true,"show_deadline":true}'::jsonb,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_embeds_origins_required check (
    coalesce(array_length(allowed_origins, 1), 0) > 0
  )
);
create index integration_embeds_connection_idx on public.integration_embeds(integration_id, status);

alter table public.integration_webhooks enable row level security;
alter table public.integration_webhook_deliveries enable row level security;
alter table public.integration_sso_configs enable row level security;
alter table public.integration_embeds enable row level security;

revoke all on public.integration_webhooks from anon, authenticated;
revoke all on public.integration_webhook_deliveries from anon, authenticated;
revoke all on public.integration_sso_configs from anon, authenticated;
revoke all on public.integration_embeds from anon, authenticated;
grant all on public.integration_webhooks to service_role;
grant all on public.integration_webhook_deliveries to service_role;
grant all on public.integration_sso_configs to service_role;
grant all on public.integration_embeds to service_role;

create trigger integration_webhooks_set_updated_at
before update on public.integration_webhooks
for each row execute function public.set_updated_at();
create trigger integration_sso_configs_set_updated_at
before update on public.integration_sso_configs
for each row execute function public.set_updated_at();
create trigger integration_embeds_set_updated_at
before update on public.integration_embeds
for each row execute function public.set_updated_at();

create or replace function public.enqueue_integration_webhook_event(
  p_organization_type text,
  p_organization_id uuid,
  p_event_type text,
  p_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook record;
  v_count integer := 0;
begin
  if p_organization_type not in ('university', 'company') or p_organization_id is null then
    return 0;
  end if;

  for v_webhook in
    select w.id
    from public.integration_webhooks w
    join public.integration_connections c on c.id = w.integration_id
    where c.status = 'active'
      and w.status = 'active'
      and p_event_type = any(w.events)
      and (
        (p_organization_type = 'university' and c.organization_type = 'university' and c.university_id = p_organization_id)
        or
        (p_organization_type = 'company' and c.organization_type = 'company' and c.company_id = p_organization_id)
      )
  loop
    insert into public.integration_webhook_deliveries(webhook_id, event_type, payload)
    values (v_webhook.id, p_event_type, coalesce(p_payload, '{}'::jsonb));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.capture_integration_webhook_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_event text;
  v_university_id uuid;
  v_company_id uuid;
  v_placement_id uuid;
  v_payload jsonb;
begin
  if tg_table_name = 'applications' then
    v_university_id := nullif(v_row->>'university_id', '')::uuid;
    v_company_id := nullif(v_row->>'company_id', '')::uuid;
    if tg_op = 'INSERT' then
      v_event := 'application.submitted';
    elsif v_old->>'status' is distinct from v_row->>'status' then
      v_event := 'application.status_changed';
    end if;
    v_payload := jsonb_build_object(
      'application_id', v_row->>'id',
      'posting_id', v_row->>'posting_id',
      'status', v_row->>'status',
      'university_id', v_row->>'university_id',
      'company_id', v_row->>'company_id'
    );
  elsif tg_table_name = 'placements' then
    v_university_id := nullif(v_row->>'university_id', '')::uuid;
    v_company_id := nullif(v_row->>'company_id', '')::uuid;
    if tg_op = 'INSERT' then
      v_event := 'placement.created';
    elsif v_old->>'status' is distinct from v_row->>'status' then
      v_event := case when v_row->>'status' = 'completed' then 'placement.completed' else 'placement.status_changed' end;
    end if;
    v_payload := jsonb_build_object(
      'placement_id', v_row->>'id',
      'application_id', v_row->>'application_id',
      'status', v_row->>'status',
      'final_grade', v_row->>'final_grade'
    );
  elsif tg_table_name = 'weekly_logs' then
    v_placement_id := nullif(v_row->>'placement_id', '')::uuid;
    select p.university_id, p.company_id into v_university_id, v_company_id
    from public.placements p where p.id = v_placement_id;
    if v_row->>'status' = 'submitted' and (tg_op = 'INSERT' or v_old->>'status' is distinct from 'submitted') then
      v_event := 'weekly_report.submitted';
    elsif tg_op = 'UPDATE' and v_old->>'status' is distinct from v_row->>'status'
      and v_row->>'status' in ('approved', 'needs_revision') then
      v_event := 'weekly_report.reviewed';
    end if;
    v_payload := jsonb_build_object(
      'weekly_report_id', v_row->>'id',
      'placement_id', v_row->>'placement_id',
      'week_number', v_row->>'week_number',
      'status', v_row->>'status'
    );
  elsif tg_table_name = 'daily_reports' then
    v_placement_id := nullif(v_row->>'placement_id', '')::uuid;
    select p.university_id, p.company_id into v_university_id, v_company_id
    from public.placements p where p.id = v_placement_id;
    if v_row->>'status' = 'submitted' and (tg_op = 'INSERT' or v_old->>'status' is distinct from 'submitted') then
      v_event := 'daily_report.submitted';
    elsif tg_op = 'UPDATE' and v_old->>'status' is distinct from v_row->>'status'
      and v_row->>'status' in ('approved', 'needs_revision') then
      v_event := 'daily_report.reviewed';
    end if;
    v_payload := jsonb_build_object(
      'daily_report_id', v_row->>'id',
      'placement_id', v_row->>'placement_id',
      'report_date', v_row->>'report_date',
      'week_number', v_row->>'week_number',
      'status', v_row->>'status'
    );
  elsif tg_table_name = 'evaluations' then
    v_placement_id := nullif(v_row->>'placement_id', '')::uuid;
    select p.university_id, p.company_id into v_university_id, v_company_id
    from public.placements p where p.id = v_placement_id;
    if tg_op = 'INSERT' then
      v_event := 'evaluation.completed';
    end if;
    v_payload := jsonb_build_object(
      'evaluation_id', v_row->>'id',
      'placement_id', v_row->>'placement_id',
      'type', v_row->>'type',
      'overall_score', v_row->>'overall_score'
    );
  end if;

  if v_event is not null then
    if v_university_id is not null then
      perform public.enqueue_integration_webhook_event('university', v_university_id, v_event, v_payload);
    end if;
    if v_company_id is not null then
      perform public.enqueue_integration_webhook_event('company', v_company_id, v_event, v_payload);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enqueue_integration_webhook_event(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.capture_integration_webhook_event() from public, anon, authenticated;

create trigger applications_integration_webhook_event
after insert or update of status on public.applications
for each row execute function public.capture_integration_webhook_event();
create trigger placements_integration_webhook_event
after insert or update of status on public.placements
for each row execute function public.capture_integration_webhook_event();
create trigger weekly_logs_integration_webhook_event
after insert or update of status on public.weekly_logs
for each row execute function public.capture_integration_webhook_event();
create trigger daily_reports_integration_webhook_event
after insert or update of status on public.daily_reports
for each row execute function public.capture_integration_webhook_event();
create trigger evaluations_integration_webhook_event
after insert on public.evaluations
for each row execute function public.capture_integration_webhook_event();

comment on table public.integration_webhooks is
  'Tenant-bound HTTPS webhook endpoints. Signing secrets are encrypted by trusted Edge Functions and never exposed after creation.';
comment on table public.integration_webhook_deliveries is
  'Durable webhook delivery outbox with retry state and response metadata.';
comment on table public.integration_sso_configs is
  'Tenant-specific OIDC/SAML provider configuration. Encrypted provider secrets are only accessible to trusted Edge Functions.';
comment on table public.integration_embeds is
  'Public, tenant-bound embed configuration with unguessable tokens and explicit HTTPS origin allowlists.';


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


-- Per-key fixed-window API rate limiting. The service-role-only RPC performs
-- an atomic upsert so concurrent requests cannot exceed the configured window.
create table public.integration_api_rate_limits (
  api_key_id uuid primary key references public.integration_api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.integration_api_rate_limits enable row level security;
revoke all on public.integration_api_rate_limits from public, anon, authenticated;
grant all on public.integration_api_rate_limits to service_role;

create or replace function public.consume_integration_api_rate_limit(
  p_key_id uuid,
  p_max_requests integer default 60,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_key_id is null or p_max_requests is null or p_max_requests not between 1 and 10000
    or p_window_seconds is null or p_window_seconds not between 1 and 3600 then
    raise exception 'Invalid API rate-limit parameters';
  end if;

  v_window_start := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.integration_api_rate_limits(api_key_id, window_start, request_count)
  values (p_key_id, v_window_start, 1)
  on conflict (api_key_id) do update
    set window_start = excluded.window_start,
        request_count = case
          when public.integration_api_rate_limits.window_start = excluded.window_start
            then public.integration_api_rate_limits.request_count + 1
          else 1
        end,
        updated_at = pg_catalog.clock_timestamp()
    where public.integration_api_rate_limits.window_start <> excluded.window_start
      or public.integration_api_rate_limits.request_count < p_max_requests
  returning request_count into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.consume_integration_api_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_integration_api_rate_limit(uuid, integer, integer) to service_role;
