import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CheckIn,
  CheckInType,
  DocumentRecord,
  Evaluation,
  EvaluationType,
  FacultySupervisorRequest,
  Placement,
  WeeklyLog,
} from '@sims/shared';
import { supabase } from '@/lib/supabase';

const PLACEMENT_SELECT =
  '*, student:profiles!placements_student_id_fkey(id,full_name,email,department,student_profile:student_profiles(*)), site_supervisor:profiles!placements_site_supervisor_id_fkey(id,full_name,email), faculty_supervisor:profiles!placements_faculty_supervisor_id_fkey(id,full_name,email,department), company:companies(id,name), university:universities(id,name), posting:job_postings(id,title,type)';

export interface PlacementDetail extends Placement {
  weekly_logs: WeeklyLog[];
  evaluations: Evaluation[];
  check_ins: CheckIn[];
  documents: DocumentRecord[];
  faculty_supervisor_requests: FacultySupervisorRequest[];
}

function invalidatePlacementData(queryClient: ReturnType<typeof useQueryClient>, placementId?: string) {
  void queryClient.invalidateQueries({ queryKey: ['placements'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  if (placementId) {
    void queryClient.invalidateQueries({ queryKey: ['placement', placementId] });
  } else {
    void queryClient.invalidateQueries({ queryKey: ['placement'] });
  }
}

export interface PendingLogRow {
  id: string;
  week_number: number;
  submitted_at: string | null;
  placement_id: string;
  placement?: {
    id: string;
    posting?: { title: string } | null;
    student?: { full_name: string } | null;
  } | null;
}

export function usePlacements() {
  return useQuery({
    queryKey: ['placements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('placements')
        .select(PLACEMENT_SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Placement[];
    },
  });
}

export function usePendingLogs(enabled = true) {
  return useQuery({
    queryKey: ['pending-logs'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_logs')
        .select(
          'id, week_number, submitted_at, placement_id, placement:placements!weekly_logs_placement_id_fkey(id, posting:job_postings(title), student:profiles!placements_student_id_fkey(full_name))',
        )
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as PendingLogRow[];
    },
  });
}

export function usePlacement(id: string | undefined) {
  return useQuery({
    queryKey: ['placement', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('placements')
        .select(
          `${PLACEMENT_SELECT}, weekly_logs(*), evaluations(*), check_ins(*), documents(*, owner:profiles!documents_owner_id_fkey(id,full_name)), faculty_supervisor_requests(*)`,
        )
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as PlacementDetail;
    },
  });
}

export function useUpsertWeeklyLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      placementId: string;
      weekNumber: number;
      hours: number;
      tasks: string;
      learningOutcomes: string;
    }) => {
      const { data, error } = await supabase.rpc('upsert_weekly_log', {
        p_placement_id: input.placementId,
        p_week_number: input.weekNumber,
        p_hours: input.hours,
        p_tasks: input.tasks,
        p_learning_outcomes: input.learningOutcomes,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidatePlacementData(queryClient),
  });
}

export function useSubmitWeeklyLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ logId }: { logId: string; placementId: string }) => {
      const { error } = await supabase.rpc('submit_weekly_log', { p_log_id: logId });
      if (error) throw error;
    },
    onSuccess: () => invalidatePlacementData(queryClient),
  });
}

export function useReviewWeeklyLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      logId: string;
      placementId: string;
      decision: 'approved' | 'needs_revision';
      comment?: string;
    }) => {
      const { error } = await supabase.rpc('review_weekly_log', {
        p_log_id: input.logId,
        p_decision: input.decision,
        p_comment: input.comment ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidatePlacementData(queryClient),
  });
}


export function useRequestFacultySupervisor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (placementId: string) => {
      const { data, error } = await supabase.rpc('request_faculty_supervisor', {
        p_placement_id: placementId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_data, placementId) => invalidatePlacementData(queryClient, placementId),
  });
}

export function useRateWeeklyLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      logId: string;
      placementId: string;
      rubric: Record<string, number>;
      comment: string;
    }) => {
      const { error } = await supabase.rpc('rate_weekly_log', {
        p_log_id: input.logId,
        p_rubric: input.rubric,
        p_comment: input.comment,
      });
      if (error) throw error;
    },
    onSuccess: (_data, input) => invalidatePlacementData(queryClient, input.placementId),
  });
}

export function useSubmitEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      placementId: string;
      type: EvaluationType;
      rubric: Record<string, number>;
      comments: string;
      overall: number | null;
    }) => {
      const { error } = await supabase.rpc('submit_evaluation', {
        p_placement_id: input.placementId,
        p_type: input.type,
        p_rubric: input.rubric,
        p_comments: input.comments,
        p_overall: input.overall,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidatePlacementData(queryClient),
  });
}

export function useAddCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      placementId: string;
      type: CheckInType;
      notes: string;
      occurredAt: string;
    }) => {
      const { error } = await supabase.rpc('add_check_in', {
        p_placement_id: input.placementId,
        p_type: input.type,
        p_notes: input.notes,
        p_occurred_at: input.occurredAt,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidatePlacementData(queryClient),
  });
}

export function useAssignFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { placementId: string; facultyId: string }) => {
      const { error } = await supabase.rpc('assign_faculty_supervisor', {
        p_placement_id: input.placementId,
        p_faculty_id: input.facultyId,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidatePlacementData(queryClient),
  });
}

export function useRecordGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { placementId: string; grade: number; notes: string }) => {
      const { error } = await supabase.rpc('record_grade', {
        p_placement_id: input.placementId,
        p_grade: input.grade,
        p_notes: input.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidatePlacementData(queryClient),
  });
}

export function useAddDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      placementId: string;
      ownerId: string;
      storagePath: string;
      fileName: string;
      type: 'report' | 'other';
    }) => {
      const { error } = await supabase.from('documents').insert({
        placement_id: input.placementId,
        owner_id: input.ownerId,
        storage_path: input.storagePath,
        file_name: input.fileName,
        type: input.type,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => invalidatePlacementData(queryClient, variables.placementId),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { documentId: string; placementId: string; storagePath: string }) => {
      // Keep the document record if storage deletion fails. Removing metadata first
      // would leave an orphaned private file that users can no longer locate.
      const { error: storageError } = await supabase.storage
        .from('reports')
        .remove([input.storagePath]);
      if (storageError) {
        throw new Error(`The file could not be removed from storage: ${storageError.message}`);
      }

      const { error: metadataError } = await supabase
        .from('documents')
        .delete()
        .eq('id', input.documentId);
      if (metadataError) {
        throw new Error(
          `The file was removed, but its document record could not be deleted: ${metadataError.message}`,
        );
      }
    },
    onSuccess: (_data, variables) => invalidatePlacementData(queryClient, variables.placementId),
  });
}
