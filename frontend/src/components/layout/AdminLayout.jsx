import { Link, useNavigate } from 'react-router-dom'
import {
  Network,
  LayoutGrid,
  SlidersHorizontal,
  Building2,
  HardDrive,
  Layers,
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react'
import BackgroundAtmosphere from '../common/BackgroundAtmosphere'
import Footer from './Footer'
import PortalHeaderSession from './PortalHeaderSession'
import PortalTopbarActions from './PortalTopbarActions'
import { REVIEW1_API_MODE } from '../../services/review1Api'

export const ADMIN_NAV_ITEMS = [
  { id: 'customers', label: 'Customers', icon: Users, path: '/admin/customers' },
  { id: 'plans', label: 'Plans & Tariffs', icon: SlidersHorizontal, path: '/admin/plans' },
  { id: 'shops', label: 'Stores & Vendors', icon: Building2, path: '/admin/vendors' },
  { id: 'inventory', label: 'Hardware & Inventory', icon: HardDrive, path: '/admin/inventory' },
  { id: 'users', label: 'Access Control & RBAC', icon: ShieldCheck, path: '/admin/users' },
  { id: 'schemes', label: 'Bulk Schemes Audit', icon: Layers, path: '/admin/schemes' },
  { id: 'overview', label: 'Network Overview', icon: LayoutGrid, path: '/admin/overview' },
]

export default function AdminLayout({
  activeNavId = 'plans',
  apiMode = false,
  toast = null,
  children,
}) {
  const navigate = useNavigate()
  const isApiMode = apiMode || REVIEW1_API_MODE

  return (
    <div className="relative min-h-screen flex flex-col justify-between font-sans text-slate-800">
      <BackgroundAtmosphere />

      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-3 text-xs font-bold text-navy shadow-xl animate-in fade-in slide-in-from-top-2">
          {toast.type === 'error' ? (
            <AlertTriangle size={16} className="text-rose-500" />
          ) : toast.type === 'info' ? (
            <Info size={16} className="text-indigo-500" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-600" />
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
                <div className="text-xs font-black tracking-tight text-navy uppercase leading-none">
                  NEXUS TELECOM
                </div>
                <div className="text-[10px] font-bold text-brand-soft uppercase tracking-widest mt-0.5">
                  ADMIN CONSOLE
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-navy px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider">
                  ADMIN SYS-CORE
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  {isApiMode ? 'ASP.NET API' : 'LOCAL STORAGE'}
                  <span className="text-[9px] font-sans font-black text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                    {isApiMode ? 'REVIEW 1' : 'DEMO SANDBOX'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PortalTopbarActions portal="admin" isApiMode={isApiMode} />

            <PortalHeaderSession
              fallbackInitials="QB"
              fallbackTopLabel="KS. Le Quoc Bao"
              fallbackBottomLabel="Senior Telecom Architect"
            />
          </div>
        </div>

        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeNavId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`inline-flex items-center gap-2.5 rounded-xl px-4 py-2 sm:px-4.5 sm:py-2.5 text-xs sm:text-[13px] font-extrabold transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-navy text-white shadow-md shadow-navy/25'
                      : 'text-slate-600 hover:bg-slate-100/90 hover:text-navy'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3 py-1.5 font-mono text-xs font-bold text-slate-700">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              {isApiMode ? 'REVIEW 1' : 'LOCAL-DEMO'}
              <span className="text-[10px] font-sans font-black text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                {isApiMode ? 'API DATA' : 'MOCK DATA'}
              </span>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-4 w-full max-w-[1680px] flex-1 px-4 pb-24 sm:px-6 lg:px-8">
        {children}
      </main>

      <Footer />
    </div>
  )
}

