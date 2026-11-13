import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Download,
  DollarSign,
  Percent,
  Layers,
  CheckCircle2,
  ChevronRight,
  Scale,
  RotateCcw,
  RefreshCw,
  Receipt,
  ShieldCheck,
} from 'lucide-react'
import AccountsLayout from '../../components/layout/AccountsLayout'
import { useToast } from '../../hooks/useToast'
import {
  fetchTaxAuditRecords,
  getTaxPeriodOptions,
  reconcileTaxLedgerWithBilling,
  subscribeTaxAuditUpdates,
} from '../../services/taxReportService'
import { formatUSD } from '../../services/billingService'
import { STATUTORY_TAX_RATE_PERCENT } from '../../services/taxConfig'
import { downloadCsvDocument } from '../../utils/telecomDocumentGenerator'

const STATUS_BADGE_CLASSES = {
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIALLY_PAID: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  OVERDUE: 'bg-rose-50 text-rose-700 border-rose-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function TaxAuditReportsPage() {
  const [records, setRecords] = useState(() => fetchTaxAuditRecords())
  const { toast, showToast } = useToast()

  const [selectedPeriod, setSelectedPeriod] = useState('ALL')
  const [selectedService, setSelectedService] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const syncFromBilling = () => {
      setRecords(fetchTaxAuditRecords())
    }
    syncFromBilling()
    const unsubscribe = subscribeTaxAuditUpdates(syncFromBilling)
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', syncFromBilling)
    }
    return () => {
      unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', syncFromBilling)
      }
    }
  }, [])

  const periodOptions = useMemo(() => getTaxPeriodOptions(records), [records])

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    return records.filter((r) => {
      const matchPeriod = selectedPeriod === 'ALL' || r.period === selectedPeriod || r.quarter === selectedPeriod
      const matchService = selectedService === 'ALL' || r.serviceType === selectedService
      const matchStatus = selectedStatus === 'ALL' || r.status === selectedStatus
      const matchSearch =
        normalizedQuery === '' ||
        String(r.id || '').toLowerCase().includes(normalizedQuery) ||
        String(r.customerName || '').toLowerCase().includes(normalizedQuery) ||
        String(r.accountId || '').toLowerCase().includes(normalizedQuery) ||
        (r.taxCode && String(r.taxCode).toLowerCase().includes(normalizedQuery))

      return matchPeriod && matchService && matchStatus && matchSearch
    })
  }, [records, selectedPeriod, selectedService, selectedStatus, searchQuery])

  const totals = useMemo(() => reconcileTaxLedgerWithBilling(filteredRecords), [filteredRecords])

  function handleSyncBilling() {
    const latest = fetchTaxAuditRecords()
    setRecords(latest)
    showToast(`Synced ${latest.length} invoices directly from the active Billing ledger.`, 'success')
  }

  function resetFilters() {
    setSelectedPeriod('ALL')
    setSelectedService('ALL')
    setSelectedStatus('ALL')
    setSearchQuery('')
  }

  function exportCSV() {
    const headers = [
      'Invoice ID',
      'Period',
      'Quarter',
      'Customer Name',
      'Account ID',
      'Tax Code (MST)',
      'Service Type',
      'Gross Subtotal',
      'Taxable Amount',
      `Statutory Tax (${STATUTORY_TAX_RATE_PERCENT}%)`,
      'Previous Balance',
      'Total Payable',
      'Paid Amount',
      'Outstanding Debt',
      'CN07 Deposit/Advance Bulk (Non-MRC Reference)',
      'Audit Status',
    ]
    const rows = filteredRecords.map((r) => [
      r.id,
      r.period,
      r.quarter,
      r.customerName,
      r.accountId,
      r.taxCode,
      r.serviceType,
      r.grossSubtotal,
      r.taxableSubtotal,
      r.taxAmount,
      r.previousBalance,
      r.totalPayable,
      r.paidAmount,
      r.debtBalance,
      r.cn07DepositAdvanceBulkUSD || 0,
      r.status,
    ])
    downloadCsvDocument(headers, rows, `Tax_Audit_Report_${STATUTORY_TAX_RATE_PERCENT}_${Date.now()}.csv`)
    showToast(`Exported ${filteredRecords.length} Billing-reconciled tax records to CSV.`, 'info')
  }

  return (
    <AccountsLayout activeNavId="tax-reports" toast={toast}>
      <div className="card p-5 md:p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Finance &amp; Revenue</span>
              <ChevronRight size={12} />
              <span>Statutory Compliance &amp; Tax Governance</span>
              <ChevronRight size={12} />
              <span className="font-bold text-navy">{STATUTORY_TAX_RATE_PERCENT}% Telecom Tax Audit</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-navy">
                Statutory Telecom Tax &amp; Audit Reports
              </h1>
              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700">
                {STATUTORY_TAX_RATE_PERCENT}% STATUTORY VAT · BILLING SYNCED
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Reconciled 1:1 with the active Billing ledger and fixed {STATUTORY_TAX_RATE_PERCENT}% statutory tax calculations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSyncBilling}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-xs hover:bg-emerald-100 transition cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Sync Billing</span>
            </button>

            <Link
              to="/accounts/billing"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Receipt size={14} />
              <span>Billing Ledger</span>
            </Link>

            <Link
              to="/accounts/tariffs"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-100 transition"
            >
              <Scale size={14} />
              <span>View Master Tariffs</span>
            </Link>

            <button
              type="button"
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/50 px-4 py-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-indigo-950">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-indigo-600" />
            <div>
              <span className="font-bold">Billing Reconciliation &amp; CN07 Scope Rule:</span>{' '}
              Tax rows reflect live invoices in Billing (including generated invoices, CDR syncs, and FIFO settlements).
              Per CN07, Bulk Scheme discounts apply strictly to Order Deposit &amp; Advance Payment and are{' '}
              <strong>never deducted</strong> from monthly MRC or invoice taxable base (MRC Bulk Deduction:{' '}
              <span className="font-mono font-bold">{formatUSD(totals.bulkDiscountDeductedFromMrc)}</span>).
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Gross Billing Subtotal
              </span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="mt-1 text-2xl font-black text-navy">{formatUSD(totals.grossBillingSubtotal)}</div>
            <div className="mt-1 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              {totals.invoiceCount} live Billing invoice(s)
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Net Taxable Base
              </span>
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Layers size={16} />
              </div>
            </div>
            <div className="mt-1 text-2xl font-black text-indigo-700">{formatUSD(totals.netTaxableBase)}</div>
            <div className="mt-1 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              100% MRC &amp; usage base (CN07 bulk on Deposit/Adv only)
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Statutory Tax ({STATUTORY_TAX_RATE_PERCENT}%)
              </span>
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <Percent size={16} />
              </div>
            </div>
            <div className="mt-1 text-2xl font-black text-emerald-700">{formatUSD(totals.totalStatutoryTax)}</div>
            <div className="mt-1 text-[11px] text-emerald-800 font-medium border-t border-emerald-200/60 pt-1.5">
              {STATUTORY_TAX_RATE_PERCENT}% mandatory telecom remittance
            </div>
          </div>

          <div className="rounded-2xl p-4 bg-navy text-white shadow-lg shadow-navy/20">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                Total Remittance Ledger
              </span>
              <div className="rounded-lg bg-white/10 p-2 text-emerald-400">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-1 text-2xl font-black text-white">{formatUSD(totals.totalPayableLedger)}</div>
            <div className="mt-1 text-[11px] text-slate-300 border-t border-white/10 pt-1.5">
              Collected {formatUSD(totals.collectedTotal)} · Due {formatUSD(totals.outstandingDebt)}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Billing Cycle
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand-soft"
                >
                  <option value="ALL">All Fiscal Cycles ({records.length})</option>
                  {periodOptions.quarters.length > 0 && (
                    <optgroup label="Fiscal Quarters">
                      {periodOptions.quarters.map((q) => (
                        <option key={q} value={q}>
                          Quarter {q}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {periodOptions.periods.length > 0 && (
                    <optgroup label="Monthly Cycles">
                      {periodOptions.periods.map((p) => (
                        <option key={p} value={p}>
                          Cycle {p}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Service Line
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand-soft"
                >
                  <option value="ALL">All Services</option>
                  <option value="BROADBAND">Broadband FTTH</option>
                  <option value="LEASED_LINE">Leased Line B2B</option>
                  <option value="SIP_TRUNK">Landline / SIP Trunk</option>
                  <option value="DIAL_UP">Dial-Up POS/ATM</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Invoice Settlement
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand-soft"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">Settled (Paid)</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="PENDING">Pending Remittance</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Search Customer / ID
                </label>
                <div className="relative">
                  <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Invoice, Account, MST..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:border-brand-soft"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-900">
                Invoice Tax &amp; Remittance Ledger ({filteredRecords.length} Records)
              </h2>
              <div className="text-xs text-slate-500">
                Total Remittance: <strong className="text-navy">{formatUSD(totals.totalPayableLedger)}</strong>
                {totals.previousArrearsTotal > 0 && (
                  <span className="ml-2 text-slate-400">
                    (Incl. Prev Arrears {formatUSD(totals.previousArrearsTotal)})
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500 bg-slate-50">
                    <th className="py-3 px-4">Invoice / Cycle</th>
                    <th className="py-3 px-4">Customer &amp; Account ID</th>
                    <th className="py-3 px-4">Tax ID (MST)</th>
                    <th className="py-3 px-4 text-right">Gross Subtotal</th>
                    <th className="py-3 px-4 text-right">Taxable Base</th>
                    <th className="py-3 px-4 text-right">Tax {STATUTORY_TAX_RATE_PERCENT}%</th>
                    <th className="py-3 px-4 text-right">Total Payable</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 px-4 text-center">
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-slate-600">
                            No invoice tax records match the active filter criteria.
                          </p>
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <RotateCcw size={12} /> Reset Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-navy">{r.id}</div>
                          <div className="text-[10px] text-slate-400">
                            {r.periodLabel || r.period} · {r.quarter}
                          </div>
                          {r.contractId && (
                            <div className="font-mono text-[10px] text-indigo-600">Order {r.contractId}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{r.customerName}</div>
                          <div className="font-mono text-[10px] text-brand-soft font-semibold">{r.accountId}</div>
                          <div className="text-[10px] text-slate-400">{r.serviceName}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{r.taxCode}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          <div>{formatUSD(r.grossSubtotal)}</div>
                          {r.cn07DepositAdvanceBulkUSD > 0 && (
                            <div className="text-[10px] text-indigo-600">
                              Dep/Adv Bulk: -{formatUSD(r.cn07DepositAdvanceBulkUSD)} ({r.cn07DepositAdvanceBulkPercent}%)
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          {formatUSD(r.taxableSubtotal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 font-bold">
                          {formatUSD(r.taxAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <div className="font-black text-navy">{formatUSD(r.totalPayable)}</div>
                          {r.previousBalance > 0 && (
                            <div className="text-[10px] text-slate-400">
                              + Prev {formatUSD(r.previousBalance)}
                            </div>
                          )}
                          {r.debtBalance > 0 && (
                            <div className="text-[10px] font-semibold text-rose-600">
                              Due: {formatUSD(r.debtBalance)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                              STATUS_BADGE_CLASSES[r.status] || STATUS_BADGE_CLASSES.PENDING
                            }`}
                          >
                            <CheckCircle2 size={11} /> {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AccountsLayout>
  )
}
