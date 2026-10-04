import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { hasRole } = useAuth()
  if (!hasRole(...roles)) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <h2 className="text-lg font-semibold">Insufficient permissions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This area requires one of the following roles: {roles.join(', ')}.
        </p>
      </div>
    )
  }
  return <>{children}</>
}
