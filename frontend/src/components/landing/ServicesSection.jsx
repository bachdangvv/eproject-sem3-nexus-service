import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Landmark, ArrowUpDown, PhoneCall, Smartphone, Globe, Bot, X, ShieldCheck } from 'lucide-react'

const SERVICES = [
  {
    id: 'BROADBAND',
    prefix: 'B',
    icon: ArrowUpDown,
    tag: 'Always-On Data',
    title: 'Broadband Internet [B]',
    desc: '64 Kbps – 128 Kbps unlimited plans and hourly packages (30h / 60h), backed by seeded BB Basic ($225/mo) in Review 1.',
    badge: '64 – 128 Kbps',
    badgeTone: 'bg-emerald-50 text-emerald-700',
    meta: { icon: Globe, text: '$500 Security Deposit' },
    specHighlights: [
      'Prefix: Order ID starts with B (11 chars); Account ID starts with B + 3-digit City Code.',
      'Plans in Specification: 30 Hrs ($175), 60 Hrs ($315), Unlimited 64 Kbps ($225 / $400), Unlimited 128 Kbps ($350 / $445).',
      'Demo 1 Seeded Plan: BB Basic (64 Kbps · monthly) at $225.00 USD.',
      'Security Deposit: $500.00 USD (eligible for 25%–100% Bulk Connection Discount).',
    ],
  },
  {
    id: 'DIALUP',
    prefix: 'D',
    icon: Landmark,
    tag: 'PSTN / Leased Access',
    title: 'Dial-Up Connections [D]',
    desc: 'Hourly (10h / 30h / 60h) and 28–56 Kbps unlimited plans with mandatory Nexus landline feasibility verification.',
    badge: '28 – 56 Kbps',
    badgeTone: 'bg-amber-50 text-amber-800',
    meta: { icon: Smartphone, text: '$325 Security Deposit' },
    specHighlights: [
      'Prefix: Order ID starts with D (11 chars); Account ID starts with D + 3-digit City Code.',
      'Plans in Specification: 10 Hrs ($50), 30 Hrs ($130), 60 Hrs ($260), Unlimited 28 Kbps ($75 / $150), Unlimited 56 Kbps ($100 / $180).',
      'Demo 1 Seeded Plan: Dial-up 10h (10 hours · one month) at $50.00 USD.',
      'Technical Rule: Requires existing vendor landline or Landline Feasible verification during ODN Survey.',
    ],
  },
  {
    id: 'LANDLINE',
    prefix: 'T',
    icon: PhoneCall,
    tag: 'Voice Telephony',
    title: 'Landline Services [T]',
    desc: 'Local Unlimited / Monthly voice service and STD packages with transparent per-minute call tariffs and carrier SLA.',
    badge: 'Local & STD',
    badgeTone: 'bg-violet-50 text-violet-700',
    meta: { icon: Bot, text: '$250 Security Deposit' },
    specHighlights: [
      'Prefix: Order ID starts with T (11 chars); Account ID starts with T + 3-digit City Code.',
      'Plans in Specification: Local Unlimited ($75/yr + 55c/min), Local Monthly ($35 + 75c/min), STD Monthly ($125), Half-Yearly ($420).',
      'Demo 1 Seeded Plan: Landline Monthly (Monthly local rental) at $35.00 USD.',
      'Security Deposit: $250.00 USD (12.24% Statutory Service Tax applies to full billing schedule).',
    ],
  },
]

export default function ServicesSection() {
  const [activeService, setActiveService] = useState(null)

  useEffect(() => {
    if (!activeService) return undefined
    function handleKeyDown(e) {
      if (e.key === 'Escape') setActiveService(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeService])

  return (
    <section id="services" className="mx-auto mt-14 max-w-[1680px] px-4 sm:px-6 lg:px-8">
      {activeService && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => setActiveService(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="inline-block rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase text-brand-accent">
                  {activeService.tag} &bull; {activeService.badge}
                </span>
                <h3 className="mt-1.5 text-lg font-extrabold text-navy">{activeService.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveService(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Close service specifications"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">{activeService.desc}</p>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-navy">
                <ShieldCheck size={14} className="text-indigo-600" />
                <span>Specification &amp; SLA Highlights</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                {activeService.specHighlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveService(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <a
                href="#pricing"
                onClick={() => setActiveService(null)}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                Bulk Deposit Calculator
              </a>
              <Link
                to="/login"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Staff Portal Login
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Nexus Service Catalog</div>
          <h2 className="mt-1 text-3xl font-extrabold text-navy">Core Services</h2>
        </div>
        <span className="hidden rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm sm:block">
          Broadband [B] &bull; Dial-Up [D] &bull; Landline [T]
        </span>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {SERVICES.map((service) => {
          const { icon: Icon, tag, title, desc, badge, badgeTone, meta } = service
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => setActiveService(service)}
              className="card card-hover flex flex-col p-6 text-left cursor-pointer group"
            >
              <div className="flex w-full items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50/80 text-brand-accent shadow-xs group-hover:bg-brand-soft group-hover:text-white transition-colors duration-200">
                  <Icon size={22} />
                </span>
                <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide ${badgeTone}`}>
                  {badge}
                </span>
              </div>
              <div className="mt-5 text-[10px] font-bold uppercase tracking-widest text-brand-soft">{tag}</div>
              <h3 className="mt-1 text-lg font-extrabold text-navy group-hover:text-brand-accent transition-colors">
                {title}
              </h3>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-500">{desc}</p>
              <div className="mt-5 w-full pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  {meta.text} <meta.icon size={13} className="text-slate-400" />
                </span>
                <span className="font-bold text-brand-soft group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  View SLA &rarr;
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
