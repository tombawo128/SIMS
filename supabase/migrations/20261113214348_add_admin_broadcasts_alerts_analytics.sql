create table if not exists public.admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null check (length(trim(body)) between 1 and 5000),
  audience_role public.user_role,
  link text,
  recipients_count integer not null default 0 check (recipients_count >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists admin_broadcasts_created_at_idx on public.admin_broadcasts (created_at desc);
alter table public.admin_broadcasts enable row level security;
drop policy if exists admin_broadcasts_platform_read on public.admin_broadcasts;
create policy admin_broadcasts_platform_read on public.admin_broadcasts for select to authenticated using (public.is_platform_admin());
revoke all on public.admin_broadcasts from anon, authenticated;
grant select on public.admin_broadcasts to authenticated;

create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 180),
  message text not null check (length(trim(message)) between 1 and 5000),
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  source text not null default 'admin',
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists system_alerts_created_at_idx on public.system_alerts (created_at desc);
alter table public.system_alerts enable row level security;
drop policy if exists system_alerts_platform_read on public.system_alerts;
create policy system_alerts_platform_read on public.system_alerts for select to authenticated using (public.is_platform_admin());
revoke all on public.system_alerts from anon, authenticated;
grant select on public.system_alerts to authenticated;

create or replace function public.publish_admin_broadcast(p_title text, p_body text, p_audience_role public.user_role default null, p_link text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_broadcast_id uuid; v_count integer;
begin
  if auth.uid() is null or not public.is_platform_admin() then raise exception 'Only platform administrators can send broadcasts' using errcode = '42501'; end if;
  if p_title is null or length(trim(p_title)) = 0 or length(trim(p_title)) > 160 then raise exception 'Title must contain 1 to 160 characters'; end if;
  if p_body is null or length(trim(p_body)) = 0 or length(trim(p_body)) > 5000 then raise exception 'Message must contain 1 to 5000 characters'; end if;
  insert into public.admin_broadcasts (title, body, audience_role, link, created_by) values (trim(p_title), trim(p_body), p_audience_role, nullif(trim(p_link), ''), auth.uid()) returning id into v_broadcast_id;
  insert into public.notifications (user_id, title, body, link)
  select p.id, trim(p_title), trim(p_body), nullif(trim(p_link), '') from public.profiles p
  where p.account_status = 'active' and p.deleted_at is null and (p_audience_role is null or p.role = p_audience_role) and p.id <> auth.uid();
  get diagnostics v_count = row_count;
  update public.admin_broadcasts set recipients_count = v_count where id = v_broadcast_id;
  insert into public.audit_logs (actor_id, entity, entity_id, action, metadata) values (auth.uid(), 'admin_broadcasts', v_broadcast_id::text, 'broadcast_sent', jsonb_build_object('audience_role', p_audience_role, 'recipients_count', v_count, 'title', trim(p_title)));
  return jsonb_build_object('id', v_broadcast_id, 'recipients_count', v_count);
end; $$;
revoke all on function public.publish_admin_broadcast(text, text, public.user_role, text) from public, anon;
grant execute on function public.publish_admin_broadcast(text, text, public.user_role, text) to authenticated;

create or replace function public.get_platform_analytics() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_platform_admin() then raise exception 'Only platform administrators can view platform analytics' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users_total', (select count(*) from public.profiles where deleted_at is null),
    'students', (select count(*) from public.profiles where role = 'student' and deleted_at is null),
    'university_staff', (select count(*) from public.profiles where role in ('coordinator','faculty_supervisor') and deleted_at is null),
    'company_staff', (select count(*) from public.profiles where role in ('company_admin','site_supervisor') and deleted_at is null),
    'platform_admins', (select count(*) from public.profiles where role = 'platform_admin' and deleted_at is null),
    'pending_users', (select count(*) from public.profiles where account_status = 'pending' and deleted_at is null),
    'active_users', (select count(*) from public.profiles where account_status = 'active' and deleted_at is null),
    'universities', (select count(*) from public.universities where deleted_at is null),
    'companies', (select count(*) from public.companies where deleted_at is null),
    'applications', (select count(*) from public.applications),
    'placements', (select count(*) from public.placements),
    'job_postings', (select count(*) from public.job_postings),
    'broadcasts', (select count(*) from public.admin_broadcasts)
  ) into v_result;
  return v_result;
end; $$;
revoke all on function public.get_platform_analytics() from public, anon;
grant execute on function public.get_platform_analytics() to authenticated;