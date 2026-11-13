import { Link } from 'react-router-dom'
import { Network } from 'lucide-react'

const LINKS = [
  { label: 'Terms of Service', topic: 'terms' },
  { label: 'Privacy Policy', topic: 'privacy' },
  { label: 'Service Level Agreement (SLA)', topic: 'safety-standards' },
  { label: 'Telecom Regulatory Compliance', topic: 'security-policy' },
]

export default function Footer({ className = '' }) {
  return (
    <footer className={`mt-12 border-t border-slate-200/80 bg-white/95 backdrop-blur-md ${className}`}>
      <div className="mx-auto flex max-w-[1680px] flex-col items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-6 text-xs text-slate-500 md:flex-row">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-brand-accent">
            <Network size={15} />
          </span>
          © 2026 Nexus Telecom Corporation. All rights reserved.
        </div>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              to={`/coming-soon?topic=${l.topic}`}
              className="transition hover:text-brand-accent"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}

