import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reuse cached page data during client-side navigation instead of refetching
      // every time a route component mounts. Mutations still invalidate affected data.
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: false,
    },
  },
});
