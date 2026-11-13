import { X, ShieldAlert, Phone, CheckCircle2, ArrowRight } from 'lucide-react'

export default function ComplianceModal({ isOpen, onClose, title, topic, description }) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="card w-full max-w-lg p-6 shadow-2xl border border-indigo-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-brand-soft">
            <ShieldAlert size={18} />
            <h3 className="text-sm font-extrabold text-navy">{title || 'Enterprise Compliance & Legal'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-800">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            Demo Sandbox &bull; Reference Policy View
          </div>

          <h4 className="mt-2 text-base font-extrabold text-navy">
            {topic || 'Portal Policy & Regulatory Governance'}
          </h4>

          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            {description ||
              'This portal module demonstrates telecom order, inventory, and billing workflows using local browser storage for Semester 3 coursework.'}
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              IMMEDIATE NOC ASSISTANCE
            </span>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Engineering Hotline (Demo):</span>
              <a href="tel:18008098" className="font-extrabold text-brand-soft hover:underline">
                1800 8098
              </a>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-slate-500 text-[11px]">
              <span>Demo Environment ID:</span>
              <span className="font-mono">NEXUS-SEM3-DEMO</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary !px-5 !py-2 !text-xs font-bold"
          >
            Acknowledge &amp; Return
          </button>
        </div>
      </div>
    </div>
  )
}

