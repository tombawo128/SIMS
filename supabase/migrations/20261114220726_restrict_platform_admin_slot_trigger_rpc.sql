-- This function is invoked only by the profiles trigger, never by API clients.
revoke all on function public.assign_platform_admin_slot() from public, anon, authenticated;
