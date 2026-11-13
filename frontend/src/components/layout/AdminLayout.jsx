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
  Search,
  Bell,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react'
import BackgroundAtmosphere from '../common/BackgroundAtmosphere'
import Footer from './Footer'

export const ADMIN_NAV_ITEMS = [
  { id: 'customers', label: 'Customers', icon: Users, path: '/admin/customers' },
  { id: 'plans', label: 'Plans & Tariffs', icon: SlidersHorizontal, path: '/admin/plans' },
  { id: 'shops', label: 'Stores & Vendors', icon: Building2, path: '/admin/vendors' },
  { id: 'inventory', label: 'Hardware & Inventory', icon: HardDrive, path: '/admin/inventory' },
  { id: 'users', label: 'Access Control & RBAC', icon: ShieldCheck, path: '/admin/users' },
  { id: 'schemes', label: 'Bulk Schemes Audit', icon: Layers, path: '/admin/schemes' },
  { id: 'overview', label: 'Network Overview', icon: LayoutGrid, path: '/coming-soon' },
]

export default function AdminLayout({
  activeNavId = 'plans',
  toast = null,
  children,
}) {
  const navigate = useNavigate()

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
                  LOCAL STORAGE
                  <span className="text-[9px] font-sans font-black text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                    DEMO SANDBOX
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block w-72">
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search customers, plans, inventory, users..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-1.5 pr-3 pl-8 text-xs text-slate-700 outline-none transition focus:border-brand-soft focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-black text-slate-700">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                DEMO ENV
              </span>
              <button
                type="button"
                className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={14} />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                  1
                </span>
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                aria-label="Help"
              >
                <HelpCircle size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-2.5 py-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-[10px] font-black text-white">
                QB
              </div>
              <div className="hidden text-left sm:block">
                <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  KS. Le Quoc Bao
                </span>
                <span className="block text-xs font-bold text-navy">
                  Senior Telecom Architect
                </span>
              </div>
            </div>
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
              LOCAL-DEMO
              <span className="text-[10px] font-sans font-black text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                MOCK DATA
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

