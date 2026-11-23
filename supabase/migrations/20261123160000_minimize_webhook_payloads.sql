-- Remove unnecessary tenant and assessment details from outbound webhook payloads.
-- Tenant recipients already have tenant context; grades/rubric scores are not needed.
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
      'status', v_row->>'status'
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
      'status', v_row->>'status'
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
      'type', v_row->>'type'
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

revoke all on function public.capture_integration_webhook_event() from public, anon, authenticated;
comment on function public.capture_integration_webhook_event() is
  'Queues tenant-scoped webhook events without student identifiers, tenant IDs, final grades, rubric scores or evaluation scores.';
