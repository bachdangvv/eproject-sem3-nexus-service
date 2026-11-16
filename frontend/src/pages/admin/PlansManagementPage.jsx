import { Scale, ChevronRight } from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import TariffTable from '../../components/tariffs/TariffTable'
import ProductCatalogPanel from '../../components/tariffs/ProductCatalogPanel'
import CityCatalogPanel from '../../components/tariffs/CityCatalogPanel'
import { STATUTORY_TAX_RATE_PERCENT } from '../../services/taxConfig'
import { REVIEW1_API_MODE } from '../../services/review1Api'

export default function PlansManagementPage() {
  return (
    <AdminLayout activeNavId="plans" apiMode={REVIEW1_API_MODE}>
      <div className="card p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Admin Console</span>
              <ChevronRight size={12} />
              <span>Catalog &amp; Tariffs</span>
              <ChevronRight size={12} />
              <span>Broadband &amp; Dedicated QoS</span>
              <ChevronRight size={12} />
              <span className="font-bold text-navy">Master Plans</span>
            </div>
            <h1 className="mt-1.5 text-xl font-extrabold text-navy md:text-2xl">
              Plans &amp; Tariffs Provisioning, QoS Thresholds &amp; Statutory Tax
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-black text-sky-800">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                {REVIEW1_API_MODE ? 'REVIEW_1_BACKEND_CATALOG' : 'LOCAL_CATALOG_CRUD'}
              </span>
              <span className="text-slate-500">National Tax Decree: <strong className="text-emerald-600">{STATUTORY_TAX_RATE_PERCENT}% Statutory Remittance (Read-Only)</strong></span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-500">
                Authority: <strong className="font-mono text-indigo-600">{REVIEW1_API_MODE ? 'Review 1 Catalog API' : 'NOC Catalog Admin (Demo)'}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700">
              Mode: {REVIEW1_API_MODE ? 'Review 1 API Catalog' : 'Local Demo Catalog'}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 text-white shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Scale size={16} className="text-indigo-400 shrink-0" />
              <span>
                <strong className="text-indigo-300">Statutory Telecom Tax {STATUTORY_TAX_RATE_PERCENT}% (Fixed):</strong> Active per National Telecommunications Executive Decree &bull; Unified across tariff schedules, billing invoices, and tax reports.
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-slate-300">Storage: {REVIEW1_API_MODE ? 'ASP.NET Core API' : 'Browser LocalStorage'}</span>
              <span className="text-emerald-400 font-bold">Admin Catalog CRUD</span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-8">
          <TariffTable readOnly={false} />
          {REVIEW1_API_MODE && (
            <>
              <ProductCatalogPanel />
              <CityCatalogPanel />
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
