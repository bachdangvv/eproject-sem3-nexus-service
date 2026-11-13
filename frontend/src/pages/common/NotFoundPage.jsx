import { Link, useNavigate } from 'react-router-dom'
import { Network, ArrowLeft, Home, ShieldAlert } from 'lucide-react'
import BackgroundAtmosphere from '../../components/common/BackgroundAtmosphere'
import Footer from '../../components/layout/Footer'
import { getCurrentUser } from '../../services/authService'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const user = getCurrentUser()

  return (
    <div className="relative min-h-screen flex flex-col justify-between font-sans text-slate-800 bg-slate-50/70">
      <BackgroundAtmosphere />

      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand to-brand-soft text-white shadow-md shadow-brand/20">
              <Network size={20} className="text-white" />
            </div>
            <div>
              <div className="text-xs font-black tracking-tight text-navy uppercase leading-none">
                NEXUS TELECOM
              </div>
              <div className="text-[10px] font-bold text-brand-soft uppercase tracking-widest mt-0.5">
                CARRIER CORE ROUTER
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Go Back</span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1680px] flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 shadow-sm">
            <ShieldAlert size={32} />
          </div>

          <div className="space-y-1">
            <span className="font-mono text-xs font-black uppercase tracking-widest text-rose-600">
              HTTP 404 &bull; ROUTE_NOT_FOUND
            </span>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Optical Circuit Unreachable
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              The requested routing destination does not exist within the Nexus Telecom Carrier Control Plane. The port may have been de-provisioned or re-indexed.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
            <Link
              to="/"
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              <Home size={14} />
              <span>Carrier Home</span>
            </Link>
            {user?.dashboardRoute && (
              <Link
                to={user.dashboardRoute}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <span>My Operational Dashboard</span>
              </Link>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

