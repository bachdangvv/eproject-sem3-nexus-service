import { useSearchParams, Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, Phone, Clock, ArrowRight, Construction } from 'lucide-react'
import BackgroundAtmosphere from '../../components/common/BackgroundAtmosphere'

const TOPIC_DETAILS = {
  'password-reset': {
    title: 'Account Recovery & Password Reset',
    desc: 'Self-service password reset via SMS OTP & enterprise SSO token is currently scheduled for Sprint 4. Please contact your designated Retail Shop officer or call NOC Engineering at 1800 8098 for an immediate emergency bypass credential.',
  },
  'security-policy': {
    title: 'Nexus Telecom Security & ISO/IEC 27001 Policy',
    desc: 'Information security management system standards for optical circuits, encrypted data channels, and physical ODF access authorization.',
  },
  'safety-standards': {
    title: 'Outside Plant Field Safety Standards',
    desc: 'High-voltage separation, underground conduit safety regulations, and personal protective equipment directives for field splicing engineers.',
  },
  'terms': {
    title: 'General Terms of Telecom Service',
    desc: 'Master commercial terms governing enterprise dedicated circuits, symmetrical bandwidth commitments, and standard 99.98% uptime SLA.',
  },
  'privacy': {
    title: 'Subscriber Privacy & Data Protection Directive',
    desc: 'Mandatory data retention policies, non-disclosure compliance, and identity protection under Vietnam National Telecom Regulatory Framework.',
  },
}

export default function ComingSoonPage() {
  const [params] = useSearchParams()
  const topicKey = params.get('topic') || 'terms'
  const topic = TOPIC_DETAILS[topicKey] || {
    title: 'Enterprise Feature Deployment',
    desc: 'This capability is actively being finalized under the current development sprint. Please check back shortly.',
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between font-sans text-slate-800">
      <BackgroundAtmosphere />

      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-navy transition">
            <ArrowLeft size={14} /> Back to Nexus Portal
          </Link>
          <span className="text-[11px] font-bold text-brand-soft">
            Sprint Status: Scheduled Deployment
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center p-4">
        <div className="card w-full p-8 text-center shadow-xl border border-indigo-100">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-brand-soft shadow-inner">
            <Construction size={28} />
          </div>

          <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800">
            <Clock size={12} /> Milestone Scheduled: Sprint 4 / 2026
          </span>

          <h1 className="mt-3 text-xl font-extrabold text-navy sm:text-2xl">
            {topic.title}
          </h1>

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {topic.desc}
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-left">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">24/7 Support Hotline:</span>
              <a href="tel:18008098" className="font-extrabold text-brand-soft hover:underline flex items-center gap-1">
                <Phone size={12} /> 1800 8098
              </a>
            </div>
            <div className="mt-1 flex items-center justify-between text-slate-500">
              <span>Engineering Support:</span>
              <span className="font-mono text-slate-700">support.noc@nexus.vn</span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/" className="btn-primary !px-5 !py-2.5 !text-xs font-bold">
              Return to Homepage <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200/80 bg-white/90 py-4 text-center text-xs text-slate-500 backdrop-blur-md">
        <div className="mx-auto max-w-[1680px] px-4">
          <p>© 2026 Nexus Telecom Corporation v4.8 • All Rights Reserved</p>
        </div>
      </footer>
    </div>
  )
}

