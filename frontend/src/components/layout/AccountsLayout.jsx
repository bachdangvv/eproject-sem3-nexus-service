import { Link, useNavigate } from 'react-router-dom'
import {
  Network,
  LayoutGrid,
  Receipt,
  Activity,
  ShieldAlert,
  FileSpreadsheet,
  Scale,
  Calendar,
  Search,
  Bell,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react'
import BackgroundAtmosphere from '../common/BackgroundAtmosphere'
import Footer from './Footer'

export const ACCOUNTS_NAV_ITEMS = [
  { id: 'overview', label: 'Billing Overview', icon: LayoutGrid, path: '/coming-soon' },
  { id: 'invoices', label: 'Invoices & Billing Charges', icon: Receipt, path: '/accounts/billing' },
  { id: 'cdr', label: 'CDR & Traffic Metering', icon: Activity, path: '/accounts/cdr' },
  { id: 'debts', label: 'Debt & Arrears Management', icon: ShieldAlert, path: '/accounts/debts' },
  { id: 'tax-reports', label: 'Tax & Scheme Audit Reports', icon: FileSpreadsheet, path: '/accounts/tax-reports' },
  { id: 'tariffs', label: 'Master Tariff Lookup', icon: Scale, path: '/accounts/tariffs' },
]

export default function AccountsLayout({
  activeNavId = 'invoices',
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
                  COMMUNICATION SYSTEM
                </div>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-navy">
                  ACCOUNTS &amp; BILLING
                </span>
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black text-brand-soft">
                  DEMO LEDGER
                </span>
              </div>
              <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/60 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800">
                <Calendar size={11} className="text-brand-soft" />
                <span>SAMPLE CYCLE: 01/10/2026 – 31/10/2026</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block w-72">
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Account ID / Order ID / Invoice ID..."
                defaultValue="B101000000000089"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-1.5 pr-3 pl-8 text-xs text-slate-700 outline-none transition focus:border-brand-soft focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={14} />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                  2
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
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-[10px] font-black text-white">
                TH
              </div>
              <div className="hidden text-left sm:block">
                <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  KS. Tran Thu Ha
                </span>
                <span className="block text-xs font-bold text-navy">
                  Billing &amp; Financial Lead
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {ACCOUNTS_NAV_ITEMS.map((item) => {
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

