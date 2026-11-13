import { Scale, ChevronRight, Lock } from 'lucide-react'
import AccountsLayout from '../../components/layout/AccountsLayout'
import TariffTable from '../../components/tariffs/TariffTable'
import { STATUTORY_TAX_RATE_PERCENT } from '../../services/taxConfig'

export default function AccountsTariffsPage() {
  return (
    <AccountsLayout activeNavId="tariffs">
      <div className="card p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Finance &amp; Revenue</span>
              <ChevronRight size={12} />
              <span>Master Tariff Catalog</span>
              <ChevronRight size={12} />
              <span>Service Price Schedules</span>
              <ChevronRight size={12} />
              <span className="font-bold text-navy">Read-Only Lookup</span>
            </div>
            <h1 className="mt-1.5 text-xl font-extrabold text-navy md:text-2xl">
              Master Tariff &amp; Service Price Lookup
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> READ_ONLY_CATALOG
              </span>
              <span className="text-slate-500">
                Statutory Tax Rate:{' '}
                <strong className="text-emerald-600">{STATUTORY_TAX_RATE_PERCENT}% VAT (Fixed &mdash; Non-Editable)</strong>
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-500">
                Access: <strong className="font-mono text-indigo-600">Single Accounts Reference</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700">
              <Lock size={13} /> Fixed {STATUTORY_TAX_RATE_PERCENT}% Tax Rate
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 text-white shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Scale size={16} className="text-indigo-400 shrink-0" />
              <span>
                <strong className="text-indigo-300">Fixed Statutory Service Tax ({STATUTORY_TAX_RATE_PERCENT}%):</strong>{' '}
                Non-editable rate applied and itemized automatically on billing invoices &amp; statements. Plan edits are restricted to Admin Catalog.
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-slate-300">Scope: Price Lookup</span>
              <span className="text-indigo-300 font-bold">Read-Only Mode</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <TariffTable readOnly={true} />
        </div>
      </div>
    </AccountsLayout>
  )
}
