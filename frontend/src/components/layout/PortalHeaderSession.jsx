import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { getCurrentUser, logout } from '../../services/authService'
import { REVIEW1_API_MODE } from '../../services/review1Api'

function getInitials(name, fallback) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return fallback
}

/** Displays the active operator identity and Review 1 API sign-out control in portal headers. */
export default function PortalHeaderSession({
  fallbackInitials = 'NX',
  fallbackTopLabel = 'OPERATOR',
  fallbackBottomLabel = 'Demo Session',
  badgeColorClass = 'bg-navy',
}) {
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const user = getCurrentUser()
  const useLiveUser = REVIEW1_API_MODE && Boolean(user)

  const displayName = useLiveUser ? (user.displayName || user.username) : fallbackBottomLabel
  const roleLabel = useLiveUser ? (user.roleName || user.username) : fallbackTopLabel
  const initials = useLiveUser ? getInitials(displayName, fallbackInitials) : fallbackInitials

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await logout()
    } finally {
      setSigningOut(false)
      navigate('/login')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-2.5 py-1">
        <div className={`flex h-6 w-6 items-center justify-center rounded-full ${badgeColorClass} text-[10px] font-black text-white`}>
          {initials}
        </div>
        <div className="hidden text-left sm:block">
          <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
            {roleLabel}
          </span>
          <span className="block text-xs font-bold text-navy">
            {displayName}
          </span>
        </div>
      </div>

      {REVIEW1_API_MODE && (
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer disabled:opacity-50"
        >
          <LogOut size={13} />
          <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
        </button>
      )}
    </div>
  )
}

