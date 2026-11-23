create or replace function public.create_system_alert(
  p_title text,
  p_message text,
  p_severity text default 'info',
  p_source text default 'admin'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Only platform administrators can create system alerts' using errcode = '42501';
  end if;
  if p_title is null or length(trim(p_title)) not between 1 and 180 then
    raise exception 'Title must contain 1 to 180 characters';
  end if;
  if p_message is null or length(trim(p_message)) not between 1 and 5000 then
    raise exception 'Message must contain 1 to 5000 characters';
  end if;
  if p_severity not in ('info','warning','critical') then
    raise exception 'Invalid alert severity';
  end if;
  insert into public.system_alerts(title, message, severity, source)
  values (trim(p_title), trim(p_message), p_severity, coalesce(nullif(trim(p_source), ''), 'admin'))
  returning id into v_id;
  insert into public.audit_logs(actor_id, entity, entity_id, action, metadata)
  values (auth.uid(), 'system_alerts', v_id::text, 'alert_created',
    jsonb_build_object('title', trim(p_title), 'severity', p_severity));
  return v_id;
end;
$$;

create or replace function public.resolve_system_alert(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Only platform administrators can resolve system alerts' using errcode = '42501';
  end if;
  update public.system_alerts
  set resolved_at = now(), resolved_by = auth.uid()
  where id = p_id and resolved_at is null;
  if not found then
    raise exception 'Alert was not found or is already resolved';
  end if;
  insert into public.audit_logs(actor_id, entity, entity_id, action, metadata)
  values (auth.uid(), 'system_alerts', p_id::text, 'alert_resolved', '{}'::jsonb);
end;
$$;

revoke all on function public.create_system_alert(text,text,text,text) from public, anon;
revoke all on function public.resolve_system_alert(uuid) from public, anon;
grant execute on function public.create_system_alert(text,text,text,text) to authenticated;
grant execute on function public.resolve_system_alert(uuid) to authenticated;