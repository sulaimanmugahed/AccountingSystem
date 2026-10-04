import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'

function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError) {
    // Never retry auth/permission/validation problems — only transport or 5xx blips.
    if (error.status >= 400 && error.status < 500) return false
    if (error.status === 0) return failureCount < 1
  }
  return failureCount < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
  queryCache: new QueryCache(),
  mutationCache: new MutationCache(),
})
