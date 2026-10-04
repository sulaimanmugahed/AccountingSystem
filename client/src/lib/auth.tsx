import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  UNAUTHORIZED_EVENT,
  readSession,
  writeSession,
} from '@/lib/api/client'
import { authApi } from '@/lib/api/endpoints'
import type { AuthSession, LoginRequest } from '@/lib/types'

export interface AuthContextValue {
  session: AuthSession | null
  isAuthenticated: boolean
  login: (payload: LoginRequest) => Promise<AuthSession>
  logout: () => void
  isLoggingIn: boolean
  loginError: string | null
  hasRole: (...roles: string[]) => boolean
  isAdmin: boolean
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<AuthSession | null>(() => readSession())
  const queryClient = useQueryClient()

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      setSession(null)
      queryClient.clear()
      toast.error(detail || 'Your session has expired. Please sign in again.')
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handler)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler)
  }, [queryClient])

  const loginMutation = useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: (result) => {
      writeSession(result)
      setSession(result)
      queryClient.clear()
    },
  })

  const login = React.useCallback(
    async (payload: LoginRequest) => {
      const result = await loginMutation.mutateAsync(payload)
      return result
    },
    [loginMutation],
  )

  const logout = React.useCallback(() => {
    writeSession(null)
    setSession(null)
    queryClient.clear()
  }, [queryClient])

  const hasRole = React.useCallback(
    (...roles: string[]) => {
      if (roles.length === 0) return true
      if (!session) return false
      return roles.some((role) => session.roles.includes(role))
    },
    [session],
  )

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: !!session,
      login,
      logout,
      isLoggingIn: loginMutation.isPending,
      loginError: loginMutation.error
        ? loginMutation.error instanceof Error
          ? loginMutation.error.message
          : 'Unable to sign in.'
        : null,
      hasRole,
      isAdmin: hasRole('Admin'),
    }),
    [session, login, logout, loginMutation.isPending, loginMutation.error, hasRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within <AuthProvider>')
  return context
}
