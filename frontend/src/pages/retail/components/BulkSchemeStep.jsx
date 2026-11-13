import { Layers, Percent, DollarSign, Calendar } from 'lucide-react'
import { fetchBulkSchemeTiers, formatTierRange } from '../../../services/bulkScheme'

export default function BulkSchemeStep({
  endpoints,
  setEndpoints,
  bulkDiscountPercent,
  paymentSchemes,
  selectedPaymentScheme,
  setSelectedPaymentScheme,
}) {
  const policyTiers = fetchBulkSchemeTiers()

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900">Bulk Discount Scheme &amp; Payment Cycle</h3>
        <p className="text-xs text-slate-500">Tiered volume discounts for multi-site deployment &amp; advance billing terms</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-700">Number of Endpoint Connections</label>
          <span className="font-mono text-sm font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
            {endpoints} {endpoints === 1 ? 'Site' : 'Sites'}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="80"
          value={endpoints}
          onChange={(e) => setEndpoints(parseInt(e.target.value) || 1)}
          className="w-full accent-indigo-600 cursor-pointer"
        />
        <div className="flex flex-wrap justify-between gap-2 text-[10px] font-bold text-slate-400 mt-1">
          {policyTiers.map((tier) => (
            <span key={tier.id}>
              {formatTierRange(tier, true)} ({tier.discountPercent}%)
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-600 p-2 text-white">
              <Percent size={16} />
            </div>
            <div>
              <div className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                Bulk Scheme Qualified Tier
              </div>
              <div className="text-[11px] text-indigo-700">
                Discount strictly applies to hardware deposit and advance payment.
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-indigo-600">{bulkDiscountPercent}%</span>
            <span className="text-[10px] font-bold text-slate-500 block">Deduction Rate</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2">Advance Billing Term &amp; Scheme</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {paymentSchemes.map((scheme) => {
            const isSelected = selectedPaymentScheme === scheme.id
            return (
              <div
                key={scheme.id}
                onClick={() => setSelectedPaymentScheme(scheme.id)}
                className={`rounded-xl border p-3.5 cursor-pointer transition ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">{scheme.title}</span>
                  <Calendar size={13} className="text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-500">{scheme.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

