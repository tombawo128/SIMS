import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StudentProfile } from '@sims/shared';
import { supabase } from '@/lib/supabase';

export function useStudentProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['student-profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as StudentProfile | null;
    },
  });
}

export function useSaveStudentProfile(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      student_id?: string | null;
      program?: string | null;
      year?: number | null;
      cv_path?: string | null;
      skills?: string[];
    }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('student_profiles').upsert(
        { user_id: userId, ...values },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-profile', userId] });
      void queryClient.invalidateQueries({ queryKey: ['university-people'] });
    },
  });
}
