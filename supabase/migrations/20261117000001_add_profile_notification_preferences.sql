-- Persist per-user notification preferences used by the Settings page.
-- Safe to run on environments where the column may already exist.
alter table public.profiles
  add column if not exists notification_preferences jsonb
  not null
  default '{
    "in_app_notifications": true,
    "application_updates": true,
    "supervision_updates": true,
    "system_announcements": true
  }'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_notification_preferences_object_check'
  ) then
    alter table public.profiles
      add constraint profiles_notification_preferences_object_check
      check (jsonb_typeof(notification_preferences) = 'object');
  end if;
end;
$$;
