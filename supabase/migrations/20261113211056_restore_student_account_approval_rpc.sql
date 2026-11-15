-- Restore the RPC used by the platform-admin Approve action.
-- The frontend calls set_user_status(target, new_status); without this function
-- deployed, approval fails even though the user directory can load.

create or replace function public.set_user_status(target uuid, new_status public.account_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_title text;
  v_body text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only a general administrator can manage user accounts';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot change your own account status';
  end if;

  select role into v_role from public.profiles where id = target;
  if v_role is null then
    raise exception 'User not found';
  end if;
  if v_role = 'platform_admin' then
    raise exception 'Manage administrator accounts from General admins';
  end if;
  if new_status not in ('pending', 'active', 'suspended', 'blocked') then
    raise exception 'Invalid account status';
  end if;

  update public.profiles
    set account_status = new_status, updated_at = now()
    where id = target;

  insert into public.audit_logs (actor_id, entity, entity_id, action, metadata)
  values (auth.uid(), 'profile', target::text, 'status_change',
          jsonb_build_object('status', new_status));

  v_title := case new_status
    when 'active' then 'Account approved'
    when 'suspended' then 'Account suspended'
    when 'blocked' then 'Account blocked'
    else 'Account updated'
  end;
  v_body := case new_status
    when 'active' then 'Your account has been approved. You can now sign in and use SIMS.'
    when 'suspended' then 'Your account has been temporarily suspended. Contact the platform team.'
    when 'blocked' then 'Your account has been blocked. Contact the platform team.'
    else 'Your account status was updated.'
  end;
  insert into public.notifications (user_id, title, body, link)
  values (target, v_title, v_body, '/dashboard');
end;
$$;

revoke all on function public.set_user_status(uuid, public.account_status) from public;
grant execute on function public.set_user_status(uuid, public.account_status) to authenticated;
