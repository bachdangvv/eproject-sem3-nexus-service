import { Zap, ScanSearch, RadioTower, Gauge, ShieldCheck, Siren } from 'lucide-react'

const METRICS = [
  { icon: RadioTower, value: '12,500+', label: 'POP Stations' },
  { icon: Gauge, value: '< 2ms', label: 'Core Latency' },
  { icon: ShieldCheck, value: '99.98%', label: 'Committed SLA' },
  { icon: Siren, value: '2 Hours', label: 'On-site Dispatch' },
]

export default function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8 pt-12 pb-4">
      <div className="pointer-events-none absolute -top-12 left-1/2 -z-10 h-72 w-full max-w-4xl -translate-x-1/2 rounded-full bg-gradient-to-b from-indigo-100/40 via-blue-50/20 to-transparent blur-3xl" />

      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Telecom Operations Sandbox &bull; Demo Portal
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.12] tracking-tight text-navy sm:text-5xl">
            Enterprise Telecom
            <span className="block bg-gradient-to-r from-brand-accent via-indigo-600 to-brand-soft bg-clip-text text-transparent">
              Infrastructure Suite
            </span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
            Dedicated POS/ATM data circuits &amp; Gigabit symmetrical fiber with a guaranteed 99.98% SLA commitment and sub-2ms core latency.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="#survey" className="btn-primary">
            <Zap size={16} /> Free Site Survey
          </a>
          <a href="#tracking" className="btn-ghost">
            <ScanSearch size={16} /> Quick Lookup
          </a>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {METRICS.map(({ icon: Icon, value, label }) => (
          <div key={label} className="card card-hover flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50/80 text-brand-accent shadow-xs">
              <Icon size={20} />
            </span>
            <div>
              <div className="text-2xl font-black tracking-tight text-navy">{value}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
