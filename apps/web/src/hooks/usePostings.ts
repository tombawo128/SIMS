import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  JobPosting,
  PostingStatus,
  PostingType,
  PostingVisibility,
} from '@sims/shared';
import { supabase } from '@/lib/supabase';

export interface PostingFilters {
  search: string;
  type: PostingType | '';
  location: string;
  remoteOnly: boolean;
}

const POSTING_SELECT =
  '*, company:companies(id,name,industry,logo_url), posting_universities(university_id)';

export function usePostings(filters: PostingFilters) {
  return useQuery({
    queryKey: ['postings', filters],
    queryFn: async () => {
      let query = supabase
        .from('job_postings')
        .select('*, company:companies(id,name,industry,logo_url)')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(60);

      const term = filters.search.trim().replace(/[%,()]/g, '').trim();
      if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.location.trim()) query = query.ilike('location', `%${filters.location.trim()}%`);
      if (filters.remoteOnly) query = query.eq('is_remote', true);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as JobPosting[];
    },
  });
}

export function usePosting(id: string | undefined) {
  return useQuery({
    queryKey: ['posting', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select(POSTING_SELECT)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as JobPosting;
    },
  });
}

export function useManagePostings(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ['manage-postings', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select(POSTING_SELECT)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobPosting[];
    },
  });
}

export interface PostingFormValues {
  company_id: string;
  created_by: string;
  title: string;
  type: PostingType;
  description: string;
  requirements: string;
  location: string;
  is_remote: boolean;
  duration_months: number | null;
  stipend: string | null;
  deadline: string | null;
  status: PostingStatus;
  visibility: PostingVisibility;
}

export function useSavePosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      values: PostingFormValues;
      universityIds: string[];
    }) => {
      let postingId = input.id;

      if (postingId) {
        const { error } = await supabase
          .from('job_postings')
          .update(input.values)
          .eq('id', postingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('job_postings')
          .insert(input.values)
          .select('id')
          .single();
        if (error) throw error;
        postingId = data.id as string;
      }

      const { error: deleteError } = await supabase
        .from('posting_universities')
        .delete()
        .eq('posting_id', postingId);
      if (deleteError) throw deleteError;

      if (input.values.visibility === 'selected_universities' && input.universityIds.length) {
        const { error: insertError } = await supabase.from('posting_universities').insert(
          input.universityIds.map((universityId) => ({
            posting_id: postingId,
            university_id: universityId,
          })),
        );
        if (insertError) throw insertError;
      }

      return postingId;
    },
    onSuccess: (postingId) => {
      void queryClient.invalidateQueries({ queryKey: ['postings'] });
      void queryClient.invalidateQueries({ queryKey: ['manage-postings'] });
      void queryClient.invalidateQueries({ queryKey: ['posting', postingId] });
    },
  });
}

export function useUpdatePostingStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: PostingStatus }) => {
      const { error } = await supabase
        .from('job_postings')
        .update({ status: input.status })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['postings'] });
      void queryClient.invalidateQueries({ queryKey: ['manage-postings'] });
      void queryClient.invalidateQueries({ queryKey: ['posting'] });
    },
  });
}

export function useDeletePosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('job_postings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['postings'] });
      void queryClient.invalidateQueries({ queryKey: ['manage-postings'] });
    },
  });
}
