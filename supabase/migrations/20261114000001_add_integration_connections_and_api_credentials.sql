-- Integration Centre: tenant-bound external connections and hashed API credentials.
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  organization_type text not null check (organization_type in ('university', 'company')),
  university_id uuid references public.universities(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_single_tenant check (
    (organization_type = 'university' and university_id is not null and company_id is null)
    or
    (organization_type = 'company' and company_id is not null and university_id is null)
  )
);

create unique index integration_connections_university_name_key
  on public.integration_connections(university_id, lower(name))
  where university_id is not null;
create unique index integration_connections_company_name_key
  on public.integration_connections(company_id, lower(name))
  where company_id is not null;
create index integration_connections_status_idx on public.integration_connections(status);

create table public.integration_api_keys (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integration_connections(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint integration_api_keys_scopes_check check (
    scopes <@ array['organisation:read','opportunities:read','applications:read','placements:read']::text[]
  )
);
create index integration_api_keys_integration_idx on public.integration_api_keys(integration_id);
create index integration_api_keys_active_idx on public.integration_api_keys(key_prefix) where revoked_at is null;

alter table public.integration_connections enable row level security;
alter table public.integration_api_keys enable row level security;
revoke all on public.integration_connections from anon, authenticated;
revoke all on public.integration_api_keys from anon, authenticated;
grant all on public.integration_connections to service_role;
grant all on public.integration_api_keys to service_role;

create trigger integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function public.set_updated_at();

comment on table public.integration_connections is
  'External-system connections bound to exactly one existing SIMS university or company tenant. Access only through trusted Edge Functions.';
comment on table public.integration_api_keys is
  'Hashed SIMS integration API credentials. Plaintext keys are returned once at creation and never stored.';
