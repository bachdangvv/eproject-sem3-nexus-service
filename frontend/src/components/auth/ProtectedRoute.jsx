import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  getCurrentUser,
  isAuthenticated,
  getDefaultDashboardForRole,
  hydrateServerSession,
} from '../../services/authService'
import { REVIEW1_API_MODE } from '../../services/review1Api'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation()
  const [hydrated, setHydrated] = useState(!REVIEW1_API_MODE)
  const [serverUser, setServerUser] = useState(() => (REVIEW1_API_MODE ? null : getCurrentUser()))

  useEffect(() => {
    if (!REVIEW1_API_MODE) return undefined
    let cancelled = false
    hydrateServerSession().then((user) => {
      if (cancelled) return
      setServerUser(user)
      setHydrated(true)
    })
    return () => { cancelled = true }
  }, [])

  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Checking session…</div>
  }

  const isAuth = isAuthenticated()
  const user = serverUser || getCurrentUser()

  if (!isAuth || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles.length > 0) {
    const userRole = (user.role || '').toLowerCase()
    const isAllowed = allowedRoles.some((r) => r.toLowerCase() === userRole)

    if (!isAllowed) {
      const target = getDefaultDashboardForRole(userRole)
      return <Navigate to={target} replace />
    }
  }

  return children
}

