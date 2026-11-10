import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Application, ApplicationStatus } from '@sims/shared';
import { supabase } from '@/lib/supabase';

const APPLICATION_SELECT =
  '*, student:profiles!applications_student_id_fkey(id,full_name,email,student_profile:student_profiles(*)), posting:job_postings(id,title,type,status), company:companies(id,name), university:universities(id,name)';

export function useApplications(enabled = true) {
  return useQuery({
    queryKey: ['applications'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(APPLICATION_SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });
}

export function useApply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      posting_id: string;
      student_id: string;
      university_id: string;
      company_id: string;
      cover_letter: string;
      cv_path: string | null;
    }) => {
      const { error } = await supabase.from('applications').insert({
        ...input,
        status: 'submitted',
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['posting', variables.posting_id] });
    },
  });
}

export function useReviewApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      applicationId: string;
      status: Extract<ApplicationStatus, 'under_review' | 'shortlisted' | 'rejected'>;
      reason?: string;
    }) => {
      const { error } = await supabase.rpc('review_application', {
        p_application_id: input.applicationId,
        p_status: input.status,
        p_reason: input.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useAcceptApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      applicationId: string;
      siteSupervisorId: string;
      startDate: string;
      endDate: string;
    }) => {
      const { data, error } = await supabase.rpc('accept_application', {
        p_application_id: input.applicationId,
        p_site_supervisor_id: input.siteSupervisorId,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['placements'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useWithdrawApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const { error } = await supabase.rpc('withdraw_application', {
        p_application_id: applicationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
