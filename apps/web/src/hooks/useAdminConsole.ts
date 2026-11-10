import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountStatus, AdminUser } from '@sims/shared';
import { supabase } from '@/lib/supabase';

async function invokeManageUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('manage-users', { body });
  if (error) {
    let message = 'Could not complete the request. Is the manage-users function deployed?';
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
  if (!data) throw new Error('The manage-users function returned no data.');
  return data;
}

// Whether the public sign-up page may still offer the administrator option.
// Polls lightly so the option disappears soon after the second admin is created,
// even if that happened in another tab.
export function useAdminSignupAvailable() {
  return useQuery({
    queryKey: ['admin-signup-available'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_signup_available');
      if (error) throw error;
      return Boolean(data);
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: ['admin-users'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_all_users');
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AccountStatus }) => {
      const { error } = await supabase.rpc('set_user_status', { target: id, new_status: status });
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      const previous = queryClient.getQueryData<AdminUser[]>(['admin-users']);
      queryClient.setQueryData<AdminUser[]>(['admin-users'], (old) =>
        (old ?? []).map((user) => (user.id === id ? { ...user, account_status: status } : user)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['admin-users'], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invokeManageUsers<{ id: string }>({ action: 'delete_user', id }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });
      const previous = queryClient.getQueryData<AdminUser[]>(['admin-users']);
      queryClient.setQueryData<AdminUser[]>(['admin-users'], (old) =>
        (old ?? []).filter((user) => user.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['admin-users'], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['universities'] });
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'university' | 'company' }) =>
      invokeManageUsers<{ id: string }>({ action: 'delete_tenant', id, kind }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['universities'] });
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}