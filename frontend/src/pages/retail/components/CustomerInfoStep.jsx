import { Building2, Mail, Phone, MapPin, User, Users } from 'lucide-react'

export default function CustomerInfoStep({
  customers = [],
  selectedCustomerId = '',
  onSelectCustomer,
  customerName,
  setCustomerName,
  taxId,
  setTaxId,
  customerEmail,
  setCustomerEmail,
  customerPhone,
  setCustomerPhone,
  installationAddress,
  setInstallationAddress,
  representativeName,
  setRepresentativeName,
  selectedCity,
  setSelectedCity,
  cities,
  errors = {},
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Enterprise Subscriber Identification</h3>
          <p className="text-xs text-slate-500">Legal business entity credentials and physical circuit termination address</p>
        </div>

        {customers.length > 0 && onSelectCustomer && (
          <div className="w-full sm:w-64">
            <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              <Users size={11} /> Load Registered Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => onSelectCustomer(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
            >
              <option value="">-- Enter subscriber details manually --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customerName} ({c.taxId})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Company / Subscriber Legal Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Building2 size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter company or subscriber legal name"
              className={`w-full rounded-xl border bg-slate-50 py-2 pr-3 pl-8 text-xs font-medium text-slate-800 outline-none focus:bg-white ${
                errors.customerName ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-600'
              }`}
            />
          </div>
          {errors.customerName && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.customerName}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Tax Code / Enterprise ID (MST) <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="e.g. 0108881948"
            className={`w-full rounded-xl border bg-slate-50 py-2 px-3 text-xs font-mono font-medium text-slate-800 outline-none focus:bg-white ${
              errors.taxId ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-600'
            }`}
          />
          {errors.taxId && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.taxId}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Authorized Contact Representative <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={representativeName}
              onChange={(e) => setRepresentativeName(e.target.value)}
              placeholder="Full name of authorized contact"
              className={`w-full rounded-xl border bg-slate-50 py-2 pr-3 pl-8 text-xs font-medium text-slate-800 outline-none focus:bg-white ${
                errors.representativeName ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-600'
              }`}
            />
          </div>
          {errors.representativeName && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.representativeName}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Contact Phone <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Phone size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 0912 839 201"
              className={`w-full rounded-xl border bg-slate-50 py-2 pr-3 pl-8 text-xs font-medium text-slate-800 outline-none focus:bg-white ${
                errors.customerPhone ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-600'
              }`}
            />
          </div>
          {errors.customerPhone && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.customerPhone}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            E-Invoice Billing Email <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Mail size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="billing@company.com"
              className={`w-full rounded-xl border bg-slate-50 py-2 pr-3 pl-8 text-xs font-medium text-slate-800 outline-none focus:bg-white ${
                errors.customerEmail ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-600'
              }`}
            />
          </div>
          {errors.customerEmail && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.customerEmail}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Metro Region City Code</label>
          <select
            value={selectedCity.code}
            onChange={(e) => {
              const found = cities.find((c) => c.code === e.target.value)
              if (found) setSelectedCity(found)
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
          >
            {cities.map((city) => (
              <option key={city.code} value={city.code}>
                {city.name} (Code: {city.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Installation Site Address <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <MapPin size={14} className="absolute top-3 left-3 text-slate-400" />
          <textarea
            rows={2}
            required
            value={installationAddress}
            onChange={(e) => setInstallationAddress(e.target.value)}
            placeholder="Floor, Building, Street, Ward, District..."
            className={`w-full rounded-xl border bg-slate-50 p-2.5 pl-8 text-xs font-medium text-slate-800 outline-none focus:bg-white ${
              errors.installationAddress ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-600'
            }`}
          />
        </div>
        {errors.installationAddress && <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.installationAddress}</p>}
      </div>
    </div>
  )
}

