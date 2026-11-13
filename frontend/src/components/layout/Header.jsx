import { Link } from 'react-router-dom'
import { Network, Phone, UserRound, Server } from 'lucide-react'

const NAV = [
  { href: '#services', label: 'Services' },
  { href: '#tracking', label: 'Tracking' },
  { href: '#pricing', label: 'Pricing' },
]

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-shadow duration-200">
      <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
        <a href="#top" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent p-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-brand-accent shadow-xs">
            <Network size={20} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-wide text-navy">NEXUS CORE NETWORK</span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Enterprise Telecom Infra
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main Navigation">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent cursor-pointer"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="tel:18008098"
            className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent lg:flex cursor-pointer"
          >
            <Phone size={13} className="text-brand-accent" /> 1800 8098
          </a>
          <Link
            to="/login"
            className="hidden items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-1.5 text-xs font-bold text-brand-accent transition hover:bg-indigo-100 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:flex cursor-pointer"
          >
            <Server size={14} /> Customer Portal / NOC
          </Link>
          <Link
            to="/login"
            aria-label="Account Login"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-accent text-white shadow-sm transition hover:bg-brand active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent cursor-pointer"
          >
            <UserRound size={17} />
          </Link>
        </div>
      </div>
    </header>
  )
}
