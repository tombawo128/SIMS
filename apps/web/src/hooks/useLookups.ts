import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Company,
  InvitePayload,
  InviteResult,
  Profile,
  StudentProfile,
  University,
} from '@sims/shared';
import { supabase } from '@/lib/supabase';

export interface PersonRow extends Profile {
  student_profile?: StudentProfile | null;
}

export function useUniversities(includeInactive = false) {
  return useQuery({
    queryKey: ['universities', includeInactive],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let query = supabase
        .from('universities')
        .select('id,name,slug,domain,logo_url,status,created_at')
        .is('deleted_at', null);
      if (!includeInactive) query = query.eq('status', 'active');
      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data ?? []) as University[];
    },
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id,name,slug,industry,website,logo_url,status,created_at')
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });
}

export function useFacultyList(universityId: string | null | undefined) {
  return useQuery({
    queryKey: ['faculty', universityId],
    enabled: Boolean(universityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,full_name,email,role,university_id,company_id,department')
        .eq('university_id', universityId)
        .eq('role', 'faculty_supervisor')
        .eq('account_status', 'active')
        .is('deleted_at', null)
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });
}

export function useCompanyTeam(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ['company-team', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,full_name,email,role,company_id,university_id')
        .eq('company_id', companyId)
        .in('role', ['site_supervisor', 'company_admin'])
        .is('deleted_at', null)
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });
}

export function useUniversityPeople(universityId: string | null | undefined) {
  return useQuery({
    queryKey: ['university-people', universityId],
    enabled: Boolean(universityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, student_profile:student_profiles(*)')
        .eq('university_id', universityId)
        .is('deleted_at', null)
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: InvitePayload) => {
      const { data, error } = await supabase.functions.invoke<InviteResult>('invite-user', {
        body: payload,
      });
      if (error) {
        let message = 'Could not create the account. Is the invite-user function deployed?';
        const context = (error as { context?: Response }).context;
        if (context) {
          try {
            const body = (await context.json()) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            // keep the fallback message
          }
        }
        throw new Error(message);
      }
      if (!data) throw new Error('The invite function returned no data.');
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['university-people'] });
      void queryClient.invalidateQueries({ queryKey: ['company-team'] });
    },
  });
}

export function useSaveTenant(kind: 'university' | 'company') {
  const queryClient = useQueryClient();
  const table = kind === 'university' ? 'universities' : 'companies';

  return useMutation({
    mutationFn: async (input: { id?: string; values: Record<string, unknown> }) => {
      if (input.id) {
        const { error } = await supabase.from(table).update(input.values).eq('id', input.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from(table).insert(input.values);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['universities'] });
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
