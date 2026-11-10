-- Live notification badge support.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
exception
  when duplicate_object then null;
end;
$$;
