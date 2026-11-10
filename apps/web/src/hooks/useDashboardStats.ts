import { useQuery } from '@tanstack/react-query';
import type { CompanyStats, FacultyStats, PlatformStats, UniversityStats } from '@sims/shared';
import { supabase } from '@/lib/supabase';

function useStatsQuery<T>(name: string, enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard-stats', name],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(name);
      if (error) throw error;
      return data as T;
    },
  });
}

export function useUniversityStats(enabled: boolean) {
  return useStatsQuery<UniversityStats>('university_stats', enabled);
}

export function useFacultyStats(enabled: boolean) {
  return useStatsQuery<FacultyStats>('faculty_stats', enabled);
}

export function useCompanyStats(enabled: boolean) {
  return useStatsQuery<CompanyStats>('company_stats', enabled);
}

export function usePlatformStats(enabled: boolean) {
  return useStatsQuery<PlatformStats>('platform_stats', enabled);
}
