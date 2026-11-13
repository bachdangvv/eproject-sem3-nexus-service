import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackgroundAtmosphere from '../../components/common/BackgroundAtmosphere'
import {
  login,
  enterDemoRole,
  DEMO_DEFAULT_PASSWORD,
  ROLES_INFO,
} from '../../services/authService'
import {
  Network,
  ArrowLeft,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Router,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  Store,
  Wrench,
  BadgeDollarSign,
  Lock,
  Headphones,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  MapPin,
  Mail,
  Send,
  Info,
  Sparkles,
} from 'lucide-react'

const ROLES = [
  { id: 'customer', label: 'Customer', icon: UserCheck, placeholder: 'CUS-001 / B101000000000089 / Tax ID' },
  { id: 'retail', label: 'Retail Outlet', icon: Store, placeholder: 'retail.hn01@nexus.vn' },
  { id: 'technical', label: 'Technical NOC', icon: Wrench, placeholder: 'noc.engineer@nexus.vn' },
  { id: 'accounts', label: 'Accounts & Billing', icon: BadgeDollarSign, placeholder: 'billing.officer@nexus.vn' },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, placeholder: 'admin@nexus.vn' },
]

const DEMO_CUSTOMER_SAMPLES = [
  { customerId: 'CUS-001', label: 'CUS-001 • AlphaCorp' },
  { customerId: 'CUS-002', label: 'CUS-002 • TechNova' },
  { customerId: 'CUS-004', label: 'CUS-004 • PharmaCare' },
  { customerId: 'CUS-006', label: 'CUS-006 • FastCall' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('login')
  const [role, setRole] = useState('customer')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [regName, setRegName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regAddress, setRegAddress] = useState('')
  const [regService, setRegService] = useState('BROADBAND')
  const [regEndpoints, setRegEndpoints] = useState(1)
  const [regSubmitted, setRegSubmitted] = useState(false)
  const navTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
    }
  }, [])

  const activeRole = ROLES.find((r) => r.id === role)

  function handleQuickRoleSelect(r) {
    setRole(r.id)
    setIdentifier(ROLES_INFO[r.id]?.defaultIdentifier || r.placeholder)
    setPassword(DEMO_DEFAULT_PASSWORD)
    setError('')
  }

  function handleInstantDemoPreview(targetRole, options = {}) {
    setError('')
    const user = enterDemoRole(targetRole, options)
    navigate(user.dashboardRoute)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!identifier.trim() || !password.trim()) {
      setError('Please provide both registered identifier and demo password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await login(identifier, password, role)
      setLoading(false)
      navigate(user.dashboardRoute)
    } catch (err) {
      setLoading(false)
      setError(err.message || 'Mock directory verification failed. Please check credentials.')
    }
  }

  function handleRegisterSubmit(e) {
    e.preventDefault()
    if (!regName.trim() || !regPhone.trim()) {
      setError('Please provide at least your full name / enterprise name and phone number.')
      return
    }
    setError('')
    setRegSubmitted(true)
    if (navTimerRef.current) clearTimeout(navTimerRef.current)
    navTimerRef.current = setTimeout(() => {
      navigate('/retail/orders/new', {
        state: {
          subscriberDraft: {
            customerName: regName,
            contactPhone: regPhone,
            email: regEmail,
            installationAddress: regAddress,
            serviceType: regService,
            endpoints: Number(regEndpoints) || 1,
          },
        },
      })
    }, 900)
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      <BackgroundAtmosphere />
      <header className="border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-brand-accent">
                <Network size={20} />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-extrabold tracking-wide text-navy">NEXUS CORE</span>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  DEMO ROLE SANDBOX
                </span>
              </span>
            </Link>
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-accent transition ml-2"
            >
              <ArrowLeft size={14} /> Back to Home
            </Link>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="hidden md:inline-flex items-center gap-1.5 font-medium text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Carrier Operations Demo &bull; Semester 3 Project
            </span>
            <a
              href="tel:18008098"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-700 bg-slate-100/70 hover:bg-slate-100 px-3 py-1.5 rounded-full transition"
            >
              <Phone size={13} className="text-brand-accent" /> Hotline: 1800 8098
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="card p-7 sm:p-10 shadow-xl border border-slate-100">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3.5 py-1 text-[11px] font-bold text-sky-700 border border-sky-200/70">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> SEMESTER 3 DEMO SANDBOX &bull; NOT PRODUCTION IAM
              </span>
              <div className="mt-3 flex items-center justify-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-brand-accent">
                  <Router size={20} />
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-navy">Nexus Telecom Demo Portal</h1>
              </div>
              <p className="mt-2 text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                Frontend role switcher &amp; mock directory lookup for the 5 telecom portals. Sessions are stored locally in browser state and are not server-verified authentication.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-center">
              <div className="inline-flex rounded-2xl bg-slate-100/90 p-1 text-xs font-semibold border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError('') }}
                  className={`min-h-[38px] rounded-xl px-5 py-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    tab === 'login'
                      ? 'bg-brand-soft text-white shadow-sm font-bold'
                      : 'text-slate-600 hover:text-navy hover:bg-white/50'
                  }`}
                >
                  <KeyRound size={13} /> Mock Auth &amp; Role Switcher
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('register'); setError('') }}
                  className={`min-h-[38px] rounded-xl px-5 py-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    tab === 'register'
                      ? 'bg-brand-soft text-white shadow-sm font-bold'
                      : 'text-slate-600 hover:text-navy hover:bg-white/50'
                  }`}
                >
                  <Router size={13} /> New Subscriber Registration
                </button>
              </div>
            </div>

            {tab === 'login' ? (
              <>
                <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-[11px] text-amber-900 leading-relaxed">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <span className="font-bold">Demo Mode Disclaimer:</span> Quick role buttons switch personas locally for UI walkthroughs (not real security). Below, Mock Directory Login only accepts registered staff emails/IDs or verified customer IDs (<span className="font-mono font-semibold">CUS-xxx</span>, Tax ID, Account ID, Order ID, or customer email; default password <span className="font-mono font-semibold">{DEMO_DEFAULT_PASSWORD}</span>) and blocks role escalation.
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Step 1: Select Role or Launch Demo Preview
                    </label>
                    <button
                      type="button"
                      onClick={() => handleInstantDemoPreview(role)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                    >
                      <Sparkles size={12} /> Quick Demo Preview ({activeRole?.label})
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {ROLES.map((r) => {
                      const Icon = r.icon
                      const active = role === r.id
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleQuickRoleSelect(r)}
                          className={`min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl border p-2 text-[11px] font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                            active
                              ? 'border-brand-soft bg-indigo-50/80 text-brand-accent shadow-xs font-bold ring-1 ring-indigo-100'
                              : 'border-slate-200/80 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-navy'
                          }`}
                        >
                          <Icon size={14} className="shrink-0" />
                          <span className="truncate">{r.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  {role === 'customer' && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-slate-500 font-semibold">Demo Customers (strictly scoped by customerId):</span>
                      {DEMO_CUSTOMER_SAMPLES.map((sample) => (
                        <button
                          key={sample.customerId}
                          type="button"
                          onClick={() => {
                            setIdentifier(sample.customerId)
                            setPassword(DEMO_DEFAULT_PASSWORD)
                            setError('')
                          }}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                        >
                          {sample.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <label htmlFor="identifier">
                        {role === 'customer'
                          ? 'Verified Customer ID / Account ID / Tax ID / Email'
                          : 'Registered Staff Email or Employee ID'}
                      </label>
                      <span className="text-[10px] font-medium text-slate-400">
                        {role === 'customer' ? 'Exact ID match only (no fuzzy names)' : 'Strict Role Match'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 focus-within:border-brand-soft focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                      <KeyRound size={16} className="text-slate-400 shrink-0" />
                      <input
                        id="identifier"
                        type="text"
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={activeRole ? activeRole.placeholder : 'admin@nexus.vn'}
                        className="min-w-0 flex-1 bg-transparent text-xs font-mono outline-none text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <label htmlFor="password">Demo Directory Password</label>
                      <span className="text-[10px] font-mono text-slate-400">
                        Default: {DEMO_DEFAULT_PASSWORD}
                      </span>
                    </div>
                    <div className="mt-1.5 flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 focus-within:border-brand-soft focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                      <Lock size={16} className="text-slate-400 shrink-0" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={`Enter ${DEMO_DEFAULT_PASSWORD} or Admin temp password`}
                        className="min-w-0 flex-1 bg-transparent text-xs outline-none text-slate-800 placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="rounded border-slate-300 text-brand-soft focus:ring-brand-soft cursor-pointer"
                      />
                      Keep demo session in localStorage
                    </label>
                    <Link
                      to="/coming-soon?topic=password-recovery"
                      className="font-semibold text-brand-soft hover:underline cursor-pointer"
                    >
                      Forgot password / Recover access?
                    </Link>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200/60" role="alert">
                      <AlertCircle size={15} className="shrink-0" /> {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full !py-3 !rounded-xl !text-sm shadow-md"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Checking Mock Directory...
                      </>
                    ) : (
                      <>Sign In via Mock Directory &rarr;</>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4" noValidate>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-indigo-900 leading-relaxed">
                  <span className="font-bold">Subscriber Onboarding Intake:</span> Fill in the details below to initialize a new optical circuit agreement and dispatch to Retail Order Setup.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Subscriber / Entity Name</label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <Building2 size={15} className="text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. FPT Telecom Joint Stock"
                        className="w-full text-xs outline-none text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone (E.164)</label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <Phone size={15} className="text-slate-400 shrink-0" />
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="0912 345 678"
                        className="w-full text-xs font-mono outline-none text-slate-800"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Business Email</label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <Mail size={15} className="text-slate-400 shrink-0" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="contact@enterprise.vn"
                        className="w-full text-xs outline-none text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Requested Service Package</label>
                    <select
                      value={regService}
                      onChange={(e) => setRegService(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                    >
                      <option value="BROADBAND">Broadband FTTx Metro (Deposit $500)</option>
                      <option value="DIAL_UP">Dial-Up POS/ATM Link (Deposit $325)</option>
                      <option value="LANDLINE">Landline &amp; SIP Trunk (Deposit $250)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1">Premise Installation Address</label>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <MapPin size={15} className="text-slate-400 shrink-0" />
                      <input
                        type="text"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="18 Tam Trinh, Hai Ba Trung, Hanoi"
                        className="w-full text-xs outline-none text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Target Sites</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={regEndpoints}
                      onChange={(e) => setRegEndpoints(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200/60" role="alert">
                    <AlertCircle size={15} className="shrink-0" /> {error}
                  </div>
                )}

                {regSubmitted && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    Subscriber intake validated! Redirecting to Retail Order Entry...
                  </div>
                )}

                <button
                  type="submit"
                  disabled={regSubmitted}
                  className="btn-primary w-full !py-3 !rounded-xl !text-sm shadow-md"
                >
                  <Send size={15} /> Continue to Order Entry &amp; Contract Generation &rarr;
                </button>
              </form>
            )}

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50/80 p-3 border border-slate-100">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-brand-accent">
                  <Info size={16} />
                </span>
                <div className="text-[11px]">
                  <div className="font-bold text-slate-800">Client-Side Demo Auth</div>
                  <div className="text-slate-400">Preview role switcher only</div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50/80 p-3 border border-slate-100">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <CheckCircle2 size={16} />
                </span>
                <div className="text-[11px]">
                  <div className="font-bold text-slate-800">Strict Customer Scoping</div>
                  <div className="text-slate-400">Matched by CUS-ID / Tax ID</div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50/80 p-3 border border-slate-100">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                  <Headphones size={16} />
                </span>
                <div className="text-[11px]">
                  <div className="font-bold text-slate-800">NOC Hotline 1800 8098</div>
                  <div className="text-slate-400">Support Contact Reference</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-[1680px] flex-col items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-4 text-[11px] text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <ShieldAlert size={13} className="text-amber-600" /> Semester 3 Local Sandbox
            </span>
            <span>&bull;</span>
            <span>Mock Directory &amp; Role Preview Environment</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/coming-soon?topic=security-policy" className="hover:text-brand-accent transition">
              Security Policy
            </Link>
            <Link to="/coming-soon?topic=safety-standards" className="hover:text-brand-accent transition">
              Safety Standards
            </Link>
            <span>&copy; 2026 Nexus Telecom Corporation.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
