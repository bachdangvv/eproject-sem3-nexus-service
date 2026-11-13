import { AlertTriangle, CheckCircle2, PhoneCall, PlusCircle } from 'lucide-react'

export default function ServicePlanStep({
  connectionTypes,
  selectedConnectionType,
  handleConnectionTypeChange,
  currentPlans,
  selectedPlanId,
  setSelectedPlanId,
  includePoESwitch,
  setIncludePoESwitch,
  hasLandlineBundle,
  landlineOption = 'NONE',
  onSelectLandlineOption,
  existingLandlineNumber = '',
  onExistingLandlineChange,
  availableLandlineAccounts = [],
  dialupLandlineValidation = { valid: true, mode: 'NOT_APPLICABLE', error: '' },
  step2LandlineTouched = false,
}) {
  const isDialupSelected = selectedConnectionType === 'DIALUP'
  const showErrorTone = isDialupSelected && !dialupLandlineValidation.valid && step2LandlineTouched
  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Service Line &amp; Tariff Package</h3>
          <p className="text-xs text-slate-500">Select network technology tier, bandwidth profile, and managed CPE options</p>
        </div>
        <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
          Synced from Admin Master Tariffs
        </span>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2">Network Connection Type</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {connectionTypes.map((type) => {
            const isSelected = selectedConnectionType === type.id
            return (
              <div
                key={type.id}
                onClick={() => handleConnectionTypeChange(type.id)}
                className={`rounded-xl border p-4 cursor-pointer transition ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-black text-indigo-600">[{type.prefix}]</span>
                  <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 ${type.badgeColor}`}>
                    {type.badge}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{type.name}</div>
                <p className="text-[11px] text-slate-500 mt-1">{type.description}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2">
          Bandwidth &amp; Port Tariff Tier ({currentPlans.length} active)
        </label>
        {currentPlans.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <div>
              <div className="font-bold text-amber-900">No active tariff plans available for this service type</div>
              <p className="mt-0.5">
                All plans under this category were removed or set to INACTIVE in Admin Plans &amp; Tariffs. Provision or activate a plan in Admin Console to place orders for this category.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {currentPlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`rounded-xl border p-4 cursor-pointer transition ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 gap-1.5">
                    <span className="font-mono text-xs font-bold text-slate-500 truncate">
                      {plan.sku || plan.id}
                    </span>
                    {plan.recommended && (
                      <span className="rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 shrink-0">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-900">{plan.name}</div>
                  <div className="mt-2 text-lg font-black text-indigo-600">
                    ${Number(plan.priceUSD || 0).toLocaleString()} <span className="text-[11px] font-normal text-slate-500">/mo/site</span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-600 space-y-1">
                    <div>&bull; Speed: {plan.domesticSpeed}</div>
                    <div>&bull; IP: {plan.ipStatic || 'Static IP Provisioned'}</div>
                    {plan.cpeModel && (
                      <div className="truncate text-slate-500">&bull; CPE: {plan.cpeModel}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Hardware &amp; Auxiliary Add-ons</label>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={includePoESwitch}
              onChange={(e) => setIncludePoESwitch(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Managed L2 PoE+ Gigabit Switch (+ $30/mo)</span>
          </label>
        </div>

        {isDialupSelected && (
          <div
            className={`rounded-2xl border p-4 space-y-3 transition ${
              dialupLandlineValidation.valid
                ? 'border-emerald-200 bg-emerald-50/50'
                : showErrorTone
                  ? 'border-rose-300 bg-rose-50/70'
                  : 'border-amber-200 bg-amber-50/60'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <PhoneCall
                  size={16}
                  className={`mt-0.5 shrink-0 ${
                    dialupLandlineValidation.valid
                      ? 'text-emerald-600'
                      : showErrorTone
                        ? 'text-rose-600'
                        : 'text-amber-600'
                  }`}
                />
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    Mandatory Dial-Up Prerequisite: Landline Connection Required
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                    Dial-Up orders run over a PSTN/SIP Landline channel. Link an existing active Landline account/number or bundle a new PSTN Landline channel (+ $15/mo) before continuing or submitting this order.
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shrink-0 ${
                  dialupLandlineValidation.valid
                    ? 'bg-emerald-100 text-emerald-800'
                    : showErrorTone
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {dialupLandlineValidation.valid
                  ? 'Landline Verified'
                  : showErrorTone
                    ? 'Blocked • Required'
                    : 'Action Required'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition bg-white ${
                  landlineOption === 'BUNDLE' && hasLandlineBundle
                    ? 'border-indigo-600 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="dialupLandlineOption"
                  checked={landlineOption === 'BUNDLE' && hasLandlineBundle}
                  onChange={() => onSelectLandlineOption?.('BUNDLE')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <PlusCircle size={13} className="text-indigo-600 shrink-0" />
                    <span>Bundle New PSTN Landline (+ $15/mo)</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Provision a new PSTN Landline channel with this Dial-Up subscription (+ $15/mo added to MRC).
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition bg-white ${
                  landlineOption === 'EXISTING'
                    ? 'border-indigo-600 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="dialupLandlineOption"
                  checked={landlineOption === 'EXISTING'}
                  onChange={() => onSelectLandlineOption?.('EXISTING')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">Link Existing Active Landline ($0/mo)</div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Bind an existing subscriber Landline Account ID (T...) or PSTN telephone number with no extra bundle charge.
                  </p>
                </div>
              </label>
            </div>

            {landlineOption === 'EXISTING' && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
                {availableLandlineAccounts.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Select Active Landline Account (Optional Shortcut)
                    </label>
                    <select
                      value={
                        availableLandlineAccounts.some((acc) => acc.accountId === existingLandlineNumber)
                          ? existingLandlineNumber
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value) onExistingLandlineChange?.(e.target.value)
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-indigo-600 focus:bg-white"
                    >
                      <option value="">-- Choose an active Landline account or enter number below --</option>
                      {availableLandlineAccounts.map((acc) => (
                        <option key={acc.accountId} value={acc.accountId}>
                          {acc.accountId} — {acc.customerName}
                          {acc.isCustomerMatch ? ' (Customer Match)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Existing Landline Number or 16-Char Account ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={existingLandlineNumber}
                    onChange={(e) => onExistingLandlineChange?.(e.target.value)}
                    placeholder="e.g. T101000000000102 or +84 24 3825 9900"
                    className={`w-full rounded-xl border px-3 py-2 text-xs font-mono font-semibold text-slate-800 outline-none ${
                      dialupLandlineValidation.valid
                        ? 'border-emerald-300 bg-emerald-50/30 focus:border-emerald-500'
                        : 'border-rose-300 bg-rose-50/30 focus:border-rose-500'
                    }`}
                  />
                </div>
              </div>
            )}

            {dialupLandlineValidation.valid ? (
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-emerald-800">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  {dialupLandlineValidation.mode === 'BUNDLE'
                    ? 'Requirement met: PSTN Landline Backup Channel Bundle (+ $15/mo) included.'
                    : `Requirement met: Bound to existing Landline ${dialupLandlineValidation.existingLandlineNumber}.`}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectLandlineOption?.('NONE')}
                  className="text-[11px] font-bold text-slate-500 hover:text-rose-600 underline cursor-pointer shrink-0"
                >
                  Clear selection
                </button>
              </div>
            ) : (
              <div
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                  showErrorTone
                    ? 'border-rose-200 bg-rose-100/70 text-rose-800'
                    : 'border-amber-200 bg-amber-100/60 text-amber-900'
                }`}
              >
                <AlertTriangle
                  size={14}
                  className={`mt-0.5 shrink-0 ${showErrorTone ? 'text-rose-600' : 'text-amber-600'}`}
                />
                <span>{dialupLandlineValidation.error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

