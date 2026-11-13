import { Link, useNavigate } from 'react-router-dom'
import { Network, CheckCircle2, AlertTriangle, Info, LogOut } from 'lucide-react'
import BackgroundAtmosphere from '../common/BackgroundAtmosphere'
import Footer from './Footer'
import { logout, getCurrentUser } from '../../services/authService'

export default function PortalLayout({
  portalName = 'PORTAL',
  portalBadge = 'DEMO-ENV',
  navItems = [],
  activeNavId = '',
  actions = null,
  toast = null,
  title,
  subtitle,
  categoryIcon: CategoryIcon,
  categoryLabel,
  children,
}) {
  const navigate = useNavigate()
  const user = getCurrentUser()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between font-sans text-slate-800 bg-slate-50/50">
      <BackgroundAtmosphere />

      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          {toast.type === 'error' ? (
            <AlertTriangle size={16} className="text-rose-400" />
          ) : toast.type === 'info' ? (
            <Info size={16} className="text-indigo-400" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 py-2 sm:px-6 lg:px-8 border-b border-slate-100">
          <div className="flex items-center gap-5">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/25">
                <Network size={20} className="text-white" />
              </div>
              <div>
                <div className="text-xs font-black tracking-tight text-slate-900 uppercase leading-none">
                  NEXUS TELECOM
                </div>
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">
                  {portalName}
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-2 border-l border-slate-200 pl-4">
              <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider">
                {portalBadge}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                {user?.authMode === 'DEMO_ROLE_SWITCHER' ? 'DEMO SWITCHER' : 'LOCAL DEMO'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {actions}
            {user && (
              <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-3">
                <span className="text-xs font-bold text-slate-700">
                  {user.fullName || user.email || user.identifier}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {navItems.length > 0 && (
          <div className="border-t border-slate-200/60 bg-white">
            <div className="mx-auto flex max-w-[1680px] gap-2 px-4 py-1.5 sm:px-6 lg:px-8 overflow-x-auto no-scrollbar">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = item.id === activeNavId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {Icon && <Icon size={14} />}
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1680px] flex-1 px-4 py-6 sm:px-6 lg:px-8 w-full space-y-6">
        {(title || categoryLabel) && (
          <div>
            {categoryLabel && (
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider">
                {CategoryIcon && <CategoryIcon size={14} />}
                <span>{categoryLabel}</span>
              </div>
            )}
            {title && (
              <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">{title}</h1>
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
        )}

        {children}
      </main>

      <Footer />
    </div>
  )
}

