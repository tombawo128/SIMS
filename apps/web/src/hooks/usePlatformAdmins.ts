import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InviteResult, PlatformAdmin } from '@sims/shared';
import { supabase } from '@/lib/supabase';

async function invokeManageAdmins<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('manage-admins', { body });
  if (error) {
    let message = 'Could not complete the request. Is the manage-admins function deployed?';
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const parsed = (await context.json()) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        // keep the fallback message
      }
    }
    throw new Error(message);
  }
  if (!data) throw new Error('The manage-admins function returned no data.');
  return data;
}

export function usePlatformAdmins(enabled = true) {
  return useQuery({
    queryKey: ['platform-admins'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_platform_admins');
      if (error) throw error;
      return (data ?? []) as PlatformAdmin[];
    },
  });
}

export function useCreatePlatformAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; full_name: string }) =>
      invokeManageAdmins<InviteResult>({ action: 'create', ...payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-signup-available'] });
    },
  });
}

export function useDeletePlatformAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invokeManageAdmins<{ id: string }>({ action: 'delete', id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform-admins'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-signup-available'] });
    },
  });
}
