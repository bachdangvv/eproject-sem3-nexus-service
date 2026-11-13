import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentUser, isAuthenticated, getDefaultDashboardForRole } from '../../services/authService'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation()
  const isAuth = isAuthenticated()
  const user = getCurrentUser()

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

