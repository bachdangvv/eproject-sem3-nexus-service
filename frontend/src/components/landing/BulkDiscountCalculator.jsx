import { useState, useId } from 'react'
import { Link } from 'react-router-dom'
import {
  Sliders,
  Building2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Network,
  Sun,
  Moon,
} from 'lucide-react'
import { calcBulk, formatUSD, DEPOSIT_USD, getTierInfo } from '../../services/bulkScheme'

export default function BulkDiscountCalculator() {
  const [points, setPoints] = useState(16)
  const [serviceType, setServiceType] = useState('BROADBAND')
  const [matrixTheme, setMatrixTheme] = useState('light')
  const sliderId = useId()

  const bulk = calcBulk(points, serviceType)
  const tier = getTierInfo(points)
  const percent = bulk.rate * 100
  const depositUnit = DEPOSIT_USD[serviceType] || DEPOSIT_USD.BROADBAND

  const serviceOptions = [
    { key: 'BROADBAND', label: 'Broadband FTTx', deposit: DEPOSIT_USD.BROADBAND },
    { key: 'DIAL_UP', label: 'Dial-Up POS/ATM', deposit: DEPOSIT_USD.DIAL_UP },
    { key: 'LANDLINE', label: 'Landline / SIP', deposit: DEPOSIT_USD.LANDLINE },
  ]

  const milestones = [
    { label: '5 Sites (0%)', target: 5 },
    { label: '12 Sites (25%)', target: 12 },
    { label: '20 Sites (50%)', target: 20 },
    { label: '35 Sites (75%)', target: 35 },
    { label: '55 Sites (100%)', target: 55 },
  ]

  return (
    <section id="pricing" className="mx-auto mt-14 max-w-[1680px] px-4 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="eyebrow flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-wider">
                  <Sliders size={14} /> Multi-Site Bulk Scheme Estimator
                </span>
                <h2 className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
                  Tiered Volume Deposit Waiver
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Automatic statutory discounts on security deposits for enterprises deploying 10+ endpoints
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-brand">
                <Building2 size={20} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Select Telecom Service Type
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {serviceOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setServiceType(opt.key)}
                    className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                      serviceType === opt.key
                        ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                    }`}
                  >
                    <span className="block text-xs font-bold text-slate-900">{opt.label}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">${opt.deposit} / Endpoint</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor={sliderId} className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Contract Connection Count
                </label>
                <span className="font-mono text-base font-black text-indigo-600 bg-indigo-50 px-3 py-0.5 rounded-lg border border-indigo-200">
                  {points} {points === 1 ? 'Site' : 'Sites'}
                </span>
              </div>
              <input
                id={sliderId}
                type="range"
                min="1"
                max="60"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {milestones.map((m) => (
                  <button
                    key={m.target}
                    type="button"
                    onClick={() => setPoints(m.target)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition cursor-pointer ${
                      points === m.target
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-white p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Qualified Incentive Tier
                </span>
                <span className="rounded-full bg-indigo-600 text-white px-2.5 py-0.5 text-xs font-black">
                  {percent}% DISCOUNT
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Gross Hardware Deposit:</span>
                  <span className="font-mono font-semibold text-slate-800">{formatUSD(bulk.gross)}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">
                  <span>Volume Savings ({percent}%):</span>
                  <span className="font-mono">-{formatUSD(bulk.saved)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-900">Net Deposit Payable:</span>
                  <span className="text-2xl font-black text-indigo-600 font-mono">{formatUSD(bulk.payable)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Link
              to="/retail/orders/new"
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-500/20 w-full"
            >
              <span>Apply Scheme in New Order</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="eyebrow flex items-center gap-1.5 text-xs font-bold text-brand uppercase tracking-wider">
                <Network size={14} /> Global Carrier Backbone
              </span>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setMatrixTheme('light')}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 transition cursor-pointer ${
                      matrixTheme === 'light'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Sun size={11} /> Light Mesh
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixTheme('dark')}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 transition cursor-pointer ${
                      matrixTheme === 'dark'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Moon size={11} /> Dark NOC
                  </button>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                  Interactive Demo
                </span>
              </div>
            </div>

            <h3 className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
              DWDM Optical Mesh Matrix
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Autonomous subsea and terrestrial mesh interconnecting global financial hubs.
            </p>

            <div
              className={`relative mt-5 rounded-2xl p-5 transition-all duration-300 overflow-hidden font-mono ${
                matrixTheme === 'dark'
                  ? 'bg-[#091124] text-white shadow-xl border border-indigo-900/60'
                  : 'bg-gradient-to-br from-slate-50/90 via-indigo-50/30 to-sky-50/40 text-slate-800 shadow-sm border border-slate-200/90'
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-0 [background-size:16px_16px] ${
                  matrixTheme === 'dark'
                    ? 'bg-[radial-gradient(#1e293b_1px,transparent_1px)] opacity-40'
                    : 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] opacity-50'
                }`}
              />

              <div
                className={`relative z-10 flex items-center justify-between border-b pb-3 font-sans ${
                  matrixTheme === 'dark' ? 'border-indigo-900/40' : 'border-slate-200/80'
                }`}
              >
                <div>
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold shadow-xs ${
                      matrixTheme === 'dark'
                        ? 'border border-cyan-500/40 bg-cyan-950/60 text-cyan-300'
                        : 'border border-indigo-200 bg-white/90 text-indigo-700'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                    DWDM Optical Mesh Matrix
                  </div>
                  <p
                    className={`mt-1 text-[11px] font-medium ${
                      matrixTheme === 'dark' ? 'text-cyan-400/80' : 'text-slate-500'
                    }`}
                  >
                    Dynamic Autonomous Routing
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      matrixTheme === 'dark' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    LATENCY / RTT MATRIX
                  </span>
                  <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="text-xs">❖</span> Subsea Fast-path Active
                  </div>
                </div>
              </div>

              <div className="relative z-10 my-2 flex items-center justify-center font-sans">
                <svg
                  viewBox="0 0 500 270"
                  className="w-full h-auto overflow-visible select-none"
                  aria-label="Global DWDM Optical Mesh Matrix"
                >
                  <defs>
                    <linearGradient id="orbitGradLight" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="35%" stopColor="#6366f1" />
                      <stop offset="70%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#0ea5e9" />
                    </linearGradient>
                    <linearGradient id="orbitGradDark" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="35%" stopColor="#818cf8" />
                      <stop offset="70%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>

                    <radialGradient id="sphereGradLight" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                      <stop offset="45%" stopColor="#eef2ff" stopOpacity="0.85" />
                      <stop offset="85%" stopColor="#e0e7ff" stopOpacity="0.75" />
                      <stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.85" />
                    </radialGradient>
                    <radialGradient id="sphereGradDark" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#1e293b" stopOpacity="0.95" />
                      <stop offset="50%" stopColor="#0f172a" stopOpacity="0.9" />
                      <stop offset="85%" stopColor="#0a1128" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#0369a1" stopOpacity="0.7" />
                    </radialGradient>

                    <filter id="meshGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="boxShadowLight" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#64748b" floodOpacity="0.2" />
                    </filter>
                    <filter id="boxShadowDark" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.6" />
                    </filter>
                  </defs>

                  <circle
                    cx="250"
                    cy="135"
                    r="114"
                    fill="none"
                    stroke={matrixTheme === 'dark' ? 'rgba(56,189,248,0.25)' : 'rgba(99,102,241,0.22)'}
                    strokeDasharray="4 6"
                    strokeWidth="1.2"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="360 250 135"
                      to="0 250 135"
                      dur="35s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  <circle
                    cx="250"
                    cy="135"
                    r="102"
                    fill={matrixTheme === 'dark' ? 'url(#sphereGradDark)' : 'url(#sphereGradLight)'}
                    stroke={matrixTheme === 'dark' ? '#38bdf8' : '#6366f1'}
                    strokeWidth="1.8"
                  />

                  <ellipse
                    cx="250"
                    cy="135"
                    rx="102"
                    ry="32"
                    fill="none"
                    stroke={matrixTheme === 'dark' ? '#38bdf8' : '#4f46e5'}
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity={matrixTheme === 'dark' ? 0.75 : 0.65}
                  />
                  <ellipse
                    cx="250"
                    cy="98"
                    rx="95"
                    ry="26"
                    fill="none"
                    stroke={matrixTheme === 'dark' ? '#38bdf8' : '#4f46e5'}
                    strokeWidth="1.3"
                    strokeDasharray="3 3"
                    opacity={matrixTheme === 'dark' ? 0.65 : 0.55}
                  />
                  <ellipse
                    cx="250"
                    cy="68"
                    rx="74"
                    ry="18"
                    fill="none"
                    stroke={matrixTheme === 'dark' ? '#38bdf8' : '#4f46e5'}
                    strokeWidth="1.1"
                    strokeDasharray="2 3"
                    opacity={matrixTheme === 'dark' ? 0.55 : 0.45}
                  />
                  <ellipse
                    cx="250"
                    cy="172"
                    rx="95"
                    ry="26"
                    fill="none"
                    stroke={matrixTheme === 'dark' ? '#38bdf8' : '#4f46e5'}
                    strokeWidth="1.3"
                    strokeDasharray="3 3"
                    opacity={matrixTheme === 'dark' ? 0.65 : 0.55}
                  />
                  <ellipse
                    cx="250"
                    cy="202"
                    rx="74"
                    ry="18"
                    fill="none"
                    stroke={matrixTheme === 'dark' ? '#38bdf8' : '#4f46e5'}
                    strokeWidth="1.1"
                    strokeDasharray="2 3"
                    opacity={matrixTheme === 'dark' ? 0.55 : 0.45}
                  />

                  <line
                    x1="250"
                    y1="33"
                    x2="250"
                    y2="237"
                    stroke={matrixTheme === 'dark' ? '#818cf8' : '#6366f1'}
                    strokeWidth="1.4"
                    strokeDasharray="4 3"
                    opacity={matrixTheme === 'dark' ? 0.75 : 0.6}
                  />
                  <ellipse
                    cx="250"
                    cy="135"
                    rx="35"
                    ry="102"
                    fill="none"
                    stroke={matrixTheme === 'dark' ? '#818cf8' : '#6366f1'}
                    strokeWidth="1.3"
                    strokeDasharray="3 3"
                    opacity={matrixTheme === 'dark' ? 0.7 : 0.6}
                  />
                  <ellipse
                    cx="250"
                    cy="135"
                    rx="70"
                    ry="102"
                    fill="none"
                    stroke={matrixTheme === 'dark' ? '#818cf8' : '#6366f1'}
                    strokeWidth="1.3"
                    strokeDasharray="3 3"
                    opacity={matrixTheme === 'dark' ? 0.7 : 0.6}
                  />

                  <g opacity={matrixTheme === 'dark' ? 0.85 : 0.75}>
                    <polyline
                      points="175,108 190,122 182,142 196,154"
                      fill="none"
                      stroke={matrixTheme === 'dark' ? '#38bdf8' : '#2563eb'}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle cx="175" cy="108" r="2.5" fill={matrixTheme === 'dark' ? '#38bdf8' : '#2563eb'} />
                    <circle cx="190" cy="122" r="2.5" fill={matrixTheme === 'dark' ? '#38bdf8' : '#2563eb'} />
                    <circle cx="182" cy="142" r="2.5" fill={matrixTheme === 'dark' ? '#38bdf8' : '#2563eb'} />
                    <circle cx="196" cy="154" r="2.5" fill={matrixTheme === 'dark' ? '#38bdf8' : '#2563eb'} />
                  </g>

                  <g opacity={matrixTheme === 'dark' ? 0.85 : 0.75}>
                    <polyline
                      points="238,92 254,88 262,104 250,118"
                      fill="none"
                      stroke={matrixTheme === 'dark' ? '#818cf8' : '#6366f1'}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle cx="238" cy="92" r="2.5" fill={matrixTheme === 'dark' ? '#818cf8' : '#4f46e5'} />
                    <circle cx="254" cy="88" r="2.5" fill={matrixTheme === 'dark' ? '#818cf8' : '#4f46e5'} />
                    <circle cx="262" cy="104" r="2.5" fill={matrixTheme === 'dark' ? '#818cf8' : '#4f46e5'} />
                    <circle cx="250" cy="118" r="2.5" fill={matrixTheme === 'dark' ? '#818cf8' : '#4f46e5'} />
                  </g>

                  <g opacity={matrixTheme === 'dark' ? 0.85 : 0.75}>
                    <polyline
                      points="286,128 304,136 312,156 296,168"
                      fill="none"
                      stroke={matrixTheme === 'dark' ? '#34d399' : '#059669'}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle cx="286" cy="128" r="2.5" fill={matrixTheme === 'dark' ? '#34d399' : '#059669'} />
                    <circle cx="304" cy="136" r="2.5" fill={matrixTheme === 'dark' ? '#34d399' : '#059669'} />
                    <circle cx="312" cy="156" r="2.5" fill={matrixTheme === 'dark' ? '#34d399' : '#059669'} />
                    <circle cx="296" cy="168" r="2.5" fill={matrixTheme === 'dark' ? '#34d399' : '#059669'} />
                  </g>

                  <g transform="rotate(-22 250 135)">
                    <ellipse
                      cx="250"
                      cy="135"
                      rx="142"
                      ry="64"
                      fill="none"
                      stroke={matrixTheme === 'dark' ? 'url(#orbitGradDark)' : 'url(#orbitGradLight)'}
                      strokeWidth="2.8"
                      strokeDasharray="10 5"
                      filter="url(#meshGlow)"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 250 135"
                        to="360 250 135"
                        dur="24s"
                        repeatCount="indefinite"
                      />
                    </ellipse>
                  </g>

                  <g transform="translate(152, 124)">
                    <circle
                      cx="0"
                      cy="0"
                      r="15"
                      fill="none"
                      stroke="#0284c7"
                      opacity="0.35"
                      className="animate-ping"
                    />
                    <circle
                      cx="0"
                      cy="0"
                      r="9"
                      fill={matrixTheme === 'dark' ? '#082f49' : '#e0f2fe'}
                      stroke="#0284c7"
                      strokeWidth="2.2"
                    />
                    <circle cx="0" cy="0" r="4" fill="#0284c7" />
                  </g>

                  <g
                    transform="translate(20, 84)"
                    filter={matrixTheme === 'dark' ? 'url(#boxShadowDark)' : 'url(#boxShadowLight)'}
                  >
                    <rect
                      x="0"
                      y="0"
                      width="122"
                      height="38"
                      rx="8"
                      fill={matrixTheme === 'dark' ? '#06122d' : '#ffffff'}
                      stroke={matrixTheme === 'dark' ? '#0284c7' : '#93c5fd'}
                      strokeWidth="1.3"
                    />
                    <circle cx="12" cy="15" r="2.5" fill="#0284c7" />
                    <text
                      x="20"
                      y="18"
                      fill={matrixTheme === 'dark' ? '#ffffff' : '#0f172a'}
                      fontSize="10.5"
                      fontWeight="bold"
                    >
                      POP 01 • AMER
                    </text>
                    <text
                      x="12"
                      y="30"
                      fill={matrixTheme === 'dark' ? '#38bdf8' : '#0284c7'}
                      fontSize="8.5"
                      fontWeight="700"
                    >
                      Tier 3+ DC • 100G
                    </text>
                  </g>

                  <g transform="translate(332, 102)">
                    <circle
                      cx="0"
                      cy="0"
                      r="15"
                      fill="none"
                      stroke="#6366f1"
                      opacity="0.35"
                      className="animate-ping"
                    />
                    <circle
                      cx="0"
                      cy="0"
                      r="9"
                      fill={matrixTheme === 'dark' ? '#1e1b4b' : '#ede9fe'}
                      stroke="#6366f1"
                      strokeWidth="2.2"
                    />
                    <circle cx="0" cy="0" r="4" fill="#6366f1" />
                  </g>

                  <g
                    transform="translate(346, 74)"
                    filter={matrixTheme === 'dark' ? 'url(#boxShadowDark)' : 'url(#boxShadowLight)'}
                  >
                    <rect
                      x="0"
                      y="0"
                      width="126"
                      height="38"
                      rx="8"
                      fill={matrixTheme === 'dark' ? '#06122d' : '#ffffff'}
                      stroke={matrixTheme === 'dark' ? '#6366f1' : '#c7d2fe'}
                      strokeWidth="1.3"
                    />
                    <circle cx="12" cy="15" r="2.5" fill="#6366f1" />
                    <text
                      x="20"
                      y="18"
                      fill={matrixTheme === 'dark' ? '#ffffff' : '#0f172a'}
                      fontSize="10.5"
                      fontWeight="bold"
                    >
                      POP 02 • EMEA
                    </text>
                    <text
                      x="12"
                      y="30"
                      fill={matrixTheme === 'dark' ? '#a5b4fc' : '#4f46e5'}
                      fontSize="8.5"
                      fontWeight="700"
                    >
                      Core Matrix • 400G
                    </text>
                  </g>

                  <line
                    x1="430"
                    y1="112"
                    x2="450"
                    y2="112"
                    stroke={matrixTheme === 'dark' ? '#818cf8' : '#6366f1'}
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                  <circle cx="454" cy="112" r="2.5" fill="#0284c7" />
                  <text
                    x="460"
                    y="115"
                    fill={matrixTheme === 'dark' ? '#93c5fd' : '#4338ca'}
                    fontSize="8.5"
                    fontWeight="bold"
                  >
                    LEO Link
                  </text>

                  <g transform="translate(308, 198)">
                    <circle
                      cx="0"
                      cy="0"
                      r="15"
                      fill="none"
                      stroke="#059669"
                      opacity="0.35"
                      className="animate-ping"
                    />
                    <circle
                      cx="0"
                      cy="0"
                      r="9"
                      fill={matrixTheme === 'dark' ? '#064e3b' : '#d1fae5'}
                      stroke="#059669"
                      strokeWidth="2.2"
                    />
                    <circle cx="0" cy="0" r="4" fill="#059669" />
                  </g>

                  <g
                    transform="translate(318, 212)"
                    filter={matrixTheme === 'dark' ? 'url(#boxShadowDark)' : 'url(#boxShadowLight)'}
                  >
                    <rect
                      x="0"
                      y="0"
                      width="132"
                      height="38"
                      rx="8"
                      fill={matrixTheme === 'dark' ? '#06122d' : '#ffffff'}
                      stroke={matrixTheme === 'dark' ? '#059669' : '#a7f3d0'}
                      strokeWidth="1.3"
                    />
                    <circle cx="12" cy="15" r="2.5" fill="#059669" />
                    <text
                      x="20"
                      y="18"
                      fill={matrixTheme === 'dark' ? '#ffffff' : '#0f172a'}
                      fontSize="10.5"
                      fontWeight="bold"
                    >
                      POP 03 • APAC
                    </text>
                    <text
                      x="12"
                      y="30"
                      fill={matrixTheme === 'dark' ? '#34d399' : '#059669'}
                      fontSize="8.5"
                      fontWeight="700"
                    >
                      Subsea Landing Stn
                    </text>
                  </g>

                  <g transform="translate(218, 164)">
                    <circle cx="0" cy="0" r="4" fill="#0284c7" opacity="0.9" />
                    <circle cx="0" cy="0" r="8" fill="none" stroke="#0284c7" opacity="0.4" />
                    <text
                      x="-18"
                      y="16"
                      fill={matrixTheme === 'dark' ? '#94a3b8' : '#475569'}
                      fontSize="9"
                      fontStyle="italic"
                      fontWeight="bold"
                    >
                      Node-Subsea
                    </text>
                  </g>
                </svg>
              </div>

              <div
                className={`relative z-10 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[11px] font-sans ${
                  matrixTheme === 'dark' ? 'border-indigo-900/40' : 'border-slate-200/80'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold shadow-xs ${
                      matrixTheme === 'dark'
                        ? 'border border-indigo-500/40 bg-indigo-950/70 text-cyan-300'
                        : 'border border-sky-200 bg-white text-sky-800'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    Subsea Fiber: 42,000+ km
                  </span>
                  <span
                    className={`inline-flex items-center rounded-lg px-3 py-1 font-semibold shadow-xs ${
                      matrixTheme === 'dark'
                        ? 'border border-indigo-500/40 bg-indigo-950/70 text-slate-300'
                        : 'border border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    Terrestrial Ring: N+1
                  </span>
                </div>
                <span
                  className={`inline-flex items-center rounded-lg px-3 py-1 font-semibold shadow-xs ${
                    matrixTheme === 'dark'
                      ? 'border border-indigo-500/40 bg-indigo-950/70 text-slate-300'
                      : 'border border-emerald-200 bg-white text-emerald-800'
                  }`}
                >
                  Auto APS &lt; 50ms
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Backbone Architecture:</span>
                <span className="font-bold text-slate-800">Dynamic DWDM Mesh with N+1 Ring Protection</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Subsea Transits:</span>
                <span className="font-bold text-slate-800">Direct APG &amp; AAG Express Routes</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Protection Switching:</span>
                <span className="font-bold text-slate-800">Sub-50ms Optical Fast Re-route (APS)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
