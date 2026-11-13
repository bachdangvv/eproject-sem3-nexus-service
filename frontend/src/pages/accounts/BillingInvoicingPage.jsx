import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Network,
  LayoutGrid,
  Receipt,
  Activity,
  ShieldAlert,
  FileSpreadsheet,
  SlidersHorizontal,
  CheckCircle2,
  Bell,
  HelpCircle,
  Download,
  FileText,
  Send,
  CreditCard,
  Building2,
  Calendar,
  Clock,
  Printer,
  QrCode,
  ShieldCheck,
  Check,
  RotateCw,
  Search,
  ChevronRight,
  FileCheck,
} from 'lucide-react'
import AccountsLayout from '../../components/layout/AccountsLayout'
import {
  fetchInvoices,
  recordFifoAccountPayment,
  getAccountUnpaidSummary,
  simulateFifoAllocation,
  buildPaymentReceiptFromResponse,
  calculateInvoiceTotals,
  formatUSD,
} from '../../services/billingService'
import { STATUTORY_TAX_RATE_PERCENT } from '../../services/taxConfig'
import { useToast } from '../../hooks/useToast'
import {
  downloadCalculationSheetCsv,
  exportInvoiceXmlDocument,
  downloadInvoiceDocument,
} from '../../utils/telecomDocumentGenerator'
import PrintReceiptModal from '../../components/common/PrintReceiptModal'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import { useAsyncResource } from '../../hooks/useAsyncResource'

export default function BillingInvoicingPage() {
  const navigate = useNavigate()
  const [activeMenu, setActiveMenu] = useState('invoices')
  const {
    data: invoicesData,
    setData: setInvoices,
    isLoading,
    error,
    reload: reloadInvoices,
  } = useAsyncResource(() => fetchInvoices(), [])
  const invoices = invoicesData || []
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('INV-2026-03-0881')
  const [paymentAmountInput, setPaymentAmountInput] = useState('')
  const [paymentMethodInput, setPaymentMethodInput] = useState('Counter Cash Desk')
  const [paymentNoteInput, setPaymentNoteInput] = useState('Counter FIFO cash desk settlement')
  const [lastPaymentResult, setLastPaymentResult] = useState(null)
  const [isSettlingFifo, setIsSettlingFifo] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [paymentError, setPaymentError] = useState(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState(17)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [receiptModalData, setReceiptModalData] = useState(null)
  const { toast, showToast } = useToast()

  const activeInvoice = useMemo(() => {
    return invoices.find((i) => i.invoiceId === selectedInvoiceId) || invoices[0] || null
  }, [invoices, selectedInvoiceId])

  useEffect(() => {
    setIsPaid(activeInvoice?.status === 'PAID')
  }, [activeInvoice])

  const activeAccountSummary = activeInvoice
    ? getAccountUnpaidSummary(activeInvoice.accountId, invoices)
    : { accountId: '', invoices: [], count: 0, totalUnpaidBalance: 0, oldestInvoice: null }

  const effectivePaymentAmount =
    paymentAmountInput !== '' && Number.isFinite(Number(paymentAmountInput))
      ? Number(paymentAmountInput)
      : activeAccountSummary.totalUnpaidBalance

  const fifoPreview = activeInvoice
    ? simulateFifoAllocation(activeInvoice.accountId, effectivePaymentAmount, invoices)
    : { allocations: [], remainingAccountBalance: 0, effectiveAmount: 0, excessAmount: 0, totalUnpaidBalance: 0 }

  const activeInvoiceTotals = activeInvoice
    ? calculateInvoiceTotals(activeInvoice.items || [], activeInvoice.previousBalance || 0, activeInvoice.paidAmount || 0)
    : null

  const activeLatestReceiptSource =
    lastPaymentResult && lastPaymentResult.accountId === activeInvoice?.accountId
      ? lastPaymentResult
      : activeInvoice && Number(activeInvoice.paidAmount || 0) > 0 && activeInvoice.receiptNumber
      ? activeInvoice
      : null

  async function handleConfirmPayment() {
    if (!activeInvoice) return
    setPaymentError(null)
    if (activeAccountSummary.totalUnpaidBalance <= 0) {
      const msg = `Account ${activeInvoice.accountId} has no remaining unpaid invoices to settle.`
      setPaymentError(msg)
      showToast(msg, 'error')
      return
    }
    setIsSettlingFifo(true)
    try {
      const response = await recordFifoAccountPayment(activeInvoice.accountId, {
        amount: effectivePaymentAmount,
        method: paymentMethodInput,
        cashierName: 'Tran Thi Mai (Accounts)',
        note: paymentNoteInput || `Counter FIFO settlement via ${paymentMethodInput}`,
      })
      setInvoices(response.updatedInvoices)
      setLastPaymentResult(response)
      setPaymentAmountInput('')
      setIsPaid(response.fullySettled)
      const realReceipt = buildPaymentReceiptFromResponse(response)
      setReceiptModalData(realReceipt)
      const allocatedSummary = response.allocations
        .map((a) => `${a.invoiceId}: ${formatUSD(a.allocatedAmount)} (${a.status})`)
        .join(', ')
      showToast(
        `Settled ${formatUSD(response.totalPaidAmount)} [${response.receiptNumber}] via FIFO: ${allocatedSummary}`
      )
    } catch (err) {
      const msg = err?.message || 'Payment processing failed.'
      setPaymentError(msg)
      showToast(msg, 'error')
    } finally {
      setIsSettlingFifo(false)
    }
  }

  function handleOpenRealReceipt() {
    if (!activeLatestReceiptSource) {
      const msg =
        'No payment has been recorded yet for this account. Collect a FIFO payment first to issue a real receipt.'
      setPaymentError(msg)
      showToast(msg, 'error')
      return
    }
    try {
      const realReceipt = buildPaymentReceiptFromResponse(activeLatestReceiptSource)
      setReceiptModalData(realReceipt)
      setShowPrintModal(true)
    } catch (err) {
      const msg = err?.message || 'Unable to build payment receipt from transaction record.'
      setPaymentError(msg)
      showToast(msg, 'error')
    }
  }

  const daysInMonth = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1
    let mbps = 180 + Math.sin(day * 0.8) * 80 + (day % 5) * 20
    if (day === 18) mbps = 542
    if (day === 12) mbps = 488
    if (day === 5) mbps = 498
    return { day, mbps: Math.round(mbps) }
  })

  return (
    <AccountsLayout activeNavId="invoices" toast={toast}>
      <div className="card p-5 md:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>Finance &amp; Revenue</span>
                <ChevronRight size={12} />
                <span>Postpaid Billing Management</span>
                <ChevronRight size={12} />
                <span>Period Q1/2026</span>
                <ChevronRight size={12} />
                <span className="font-bold text-navy">AlphaCorp</span>
                <span className="rounded bg-indigo-50 px-1.5 py-0.2 font-mono text-[11px] font-bold text-brand-soft">
                  ID: B101000000000089
                </span>
              </div>
              <h1 className="mt-1.5 text-xl font-extrabold text-navy md:text-2xl">
                Monthly Invoicing, CDR Metering Reconciliation &amp; Telecom Tax Ledger
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-black text-cyan-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" /> DRAFT_CALCULATED
                </span>
                <span className="text-slate-500">Billing Cycle: <strong>01/03/2026 – 31/03/2026</strong></span>
                <span className="text-slate-300">&bull;</span>
                <span className="text-slate-500">
                  Payment Due Date: <strong className="text-rose-600">15/04/2026</strong> (SLA 12 Days Remaining)
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="text-slate-500">Contract ID: <strong className="font-mono">#B0000001089</strong></span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isLoading || !activeInvoice}
                onClick={() => {
                  if (!activeInvoice) return
                  downloadCalculationSheetCsv(activeInvoice)
                  showToast(`Downloaded calculation sheet: Billing_Calculation_Sheet_${activeInvoice.invoiceId}.csv`)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                <Download size={13} /> Download Calculation Sheet
              </button>
              <button
                type="button"
                disabled={isLoading || !activeInvoice}
                onClick={() => {
                  if (!activeInvoice) return
                  downloadInvoiceDocument(activeInvoice)
                  showToast(`Downloaded invoice PDF: Invoice_${activeInvoice.invoiceId}.pdf`)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                <FileText size={13} /> Download Invoice PDF
              </button>
              <button
                type="button"
                disabled={isLoading || !activeInvoice}
                onClick={() => {
                  if (!activeInvoice) return
                  exportInvoiceXmlDocument(activeInvoice)
                  showToast(`Exported unsigned XML draft: Invoice_${activeInvoice.invoiceId}.xml`)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                <FileText size={13} /> Export Draft XML
              </button>
              <button
                type="button"
                onClick={() => showToast('Demo notice preview logged for contact@alphacorp.vn (no email sent).')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-brand-soft hover:bg-indigo-100 transition cursor-pointer"
              >
                <Send size={13} /> Send Billing Notice
              </button>
              <button
                type="button"
                onClick={reloadInvoices}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
              >
                <RotateCw size={13} /> Refresh
              </button>
              <button
                type="button"
                disabled={isLoading || invoices.length === 0}
                onClick={() => {
                  const desk = document.getElementById('fifo-payment-desk')
                  if (desk) desk.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  const input = document.getElementById('fifo-payment-amount')
                  if (input) input.focus()
                  showToast('Review FIFO oldest-first queue and confirm collected amount below.')
                }}
                className="btn-primary !px-4 !py-1.5 !text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                <CreditCard size={13} /> Counter Payment Desk
              </button>
            </div>
          </div>

          {paymentError && (
            <div className="mt-4">
              <AsyncStatePanel
                compact
                state="error"
                title="Payment Reconciliation Error"
                description={paymentError}
                actionLabel="Dismiss"
                onAction={() => setPaymentError(null)}
              />
            </div>
          )}

          {isLoading ? (
            <div className="mt-5">
              <AsyncStatePanel
                state="loading"
                title="Loading billing & invoice ledger..."
                description={`Reconciling monthly CDR metering, ${STATUTORY_TAX_RATE_PERCENT}% statutory telecom tax, and e-Invoice signatures.`}
              />
            </div>
          ) : error ? (
            <div className="mt-5">
              <AsyncStatePanel
                state="error"
                title="Unable to load billing invoices"
                description={error}
                onRetry={reloadInvoices}
              />
            </div>
          ) : invoices.length === 0 || !activeInvoice ? (
            <div className="mt-5">
              <AsyncStatePanel
                state="empty"
                icon={Receipt}
                title="No Invoices Available"
                description="No monthly billing statements or statutory tax invoices were found for the selected period."
                actionLabel="Reload Ledger"
                onAction={reloadInvoices}
              />
            </div>
          ) : (
          <>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                GROSS REVENUE BEFORE TAX
              </div>
              <div className="mt-1 text-2xl font-black text-navy">$3,450.00</div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                <span>FTTH Port: $2,500</span>
                <span>ONT: $200</span>
                <span className="font-bold text-indigo-600">Burst: +$750</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  CORPORATE B2B SCHEME DISCOUNT
                </span>
                <span className="rounded bg-sky-100 px-1.5 py-0.2 text-[10px] font-black text-sky-800">
                  -12.5%
                </span>
              </div>
              <div className="mt-1 text-2xl font-black text-sky-700">-$431.25</div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                <span>Corporate Enterprise Tier-1</span>
                <span className="font-bold text-sky-700">Contract 24M</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  STATUTORY TELECOM TAX ({STATUTORY_TAX_RATE_PERCENT}%)
                </span>
                <span className="rounded bg-indigo-100 px-1.5 py-0.2 text-[10px] font-black text-indigo-800">
                  MANDATORY
                </span>
              </div>
              <div className="mt-1 text-2xl font-black text-indigo-700">+$369.50</div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                <span>Taxable Base: $3,018.75</span>
                <span className="font-bold text-indigo-700">Telecom VAT</span>
              </div>
            </div>

            <div className="rounded-2xl p-4 bg-navy text-white shadow-lg shadow-navy/20 border-none">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  TOTAL PAYABLE THIS CYCLE
                </span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-black text-emerald-300">
                  RECONCILED
                </span>
              </div>
              <div className="mt-1 text-2xl font-black text-white">$3,388.25</div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300 border-t border-white/10 pt-1.5">
                <span>Prior Arrears: $0.00</span>
                <span className="font-bold text-emerald-400">Balanced Match</span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-navy flex items-center gap-2">
                      <Activity size={16} className="text-brand-soft" />
                      CDR Traffic Metering &amp; Bandwidth Analysis
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Sample CDR Ledger HN-HK-BRAS01 &bull; 31-Day Demo Cycle
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    DEMO CDR LEDGER
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Total Cycle Volume</div>
                    <div className="mt-1 text-lg font-black text-navy">14.82 TB</div>
                    <div className="text-[10px] text-slate-500">DL: 11.20 TB &bull; UL: 3.62 TB</div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Peak Bandwidth Rate</div>
                    <div className="mt-1 text-lg font-black text-rose-600">542 Mbps</div>
                    <div className="text-[10px] text-slate-500">14:22 18/03 &bull; 4.2h Burst</div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Actual SLA Availability</div>
                    <div className="mt-1 text-lg font-black text-emerald-600">99.985%</div>
                    <div className="text-[10px] text-slate-500">Committed: 99.98% &bull; Tier Carrier</div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between text-xs font-bold text-slate-700 mb-3">
                    <span>Bandwidth Spectrum (31 Days) &amp; Commitment Threshold (CIR 200M / PIR 500M)</span>
                    <span className="text-[10px] font-mono text-slate-400">Unit: Mbps / Day</span>
                  </div>

                  <div className="relative h-44 w-full flex items-end gap-1 sm:gap-1.5 pt-8 pb-4 px-2 border-b border-slate-200">
                    <div className="absolute top-10 left-0 right-0 border-b-2 border-dashed border-rose-300 z-10 pointer-events-none">
                      <span className="absolute -top-3.5 right-2 font-mono text-[9px] font-bold text-rose-600 bg-white/90 px-1 rounded">
                        PIR 500 Mbps Limit
                      </span>
                    </div>

                    <div className="absolute top-24 left-0 right-0 border-b-2 border-dashed border-indigo-300 z-10 pointer-events-none">
                      <span className="absolute -top-3.5 right-2 font-mono text-[9px] font-bold text-indigo-600 bg-white/90 px-1 rounded">
                        CIR 200 Mbps Committed
                      </span>
                    </div>

                    {daysInMonth.map((d, idx) => {
                      const isPeak = d.day === 18
                      const heightPercent = Math.min(100, Math.max(15, (d.mbps / 580) * 100))
                      const isSelected = selectedDayIndex === idx

                      return (
                        <div
                          key={d.day}
                          onClick={() => setSelectedDayIndex(idx)}
                          className="relative flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                        >
                          {isPeak && (
                            <div className="absolute -top-7 z-20 whitespace-nowrap rounded-md bg-rose-600 px-1.5 py-0.5 font-mono text-[9px] font-black text-white shadow-md animate-bounce">
                              18/03: 542 Mbps [+42M Burst]
                            </div>
                          )}

                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t transition-all ${
                              isPeak
                                ? 'bg-rose-500 shadow-sm shadow-rose-300'
                                : isSelected
                                ? 'bg-brand-soft ring-1 ring-indigo-300'
                                : 'bg-slate-300 group-hover:bg-indigo-300'
                            }`}
                          />
                          <span className="mt-1 text-[8px] font-mono text-slate-400">{d.day}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Day 01/03</span>
                    <span className="font-semibold text-rose-600 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-600" />
                      Day 18/03: Peak 542 Mbps [Exceeded SLA limit by 42 Mbps]
                    </span>
                    <span>Day 31/03</span>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-navy uppercase tracking-wider">
                      Peak Bandwidth CDR Sessions Log
                    </span>
                    <button
                      type="button"
                      onClick={() => showToast('Opening CDR audit viewer for 1,842 sessions...')}
                      className="text-[11px] font-bold text-brand-soft hover:underline cursor-pointer"
                    >
                      View all 1,842 CDR records &rarr;
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-2.5">Timestamp</th>
                          <th className="p-2.5">Event Type</th>
                          <th className="p-2.5">Volume (In/Out)</th>
                          <th className="p-2.5">Peak Rate</th>
                          <th className="p-2.5 text-right">Overage Charge</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="bg-rose-50/40 hover:bg-rose-50/70">
                          <td className="p-2.5 font-mono text-slate-700">18/03/2026 14:22:10</td>
                          <td className="p-2.5">
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-black text-rose-800">
                              QoS Burst Over
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-600">520 GB / 210 GB</td>
                          <td className="p-2.5 font-mono font-bold text-rose-600">542.4 Mbps</td>
                          <td className="p-2.5 text-right font-mono font-black text-navy">$750.00</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-700">12/03/2026 09:15:00</td>
                          <td className="p-2.5">
                            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-black text-indigo-800">
                              Peak Hour Sync
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-600">412 GB / 94 GB</td>
                          <td className="p-2.5 font-mono font-semibold text-slate-700">488.1 Mbps</td>
                          <td className="p-2.5 text-right font-mono text-slate-400">Within Quota</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-700">05/03/2026 02:40:19</td>
                          <td className="p-2.5">
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-black text-slate-700">
                              Off-Peak Backup
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-600">1.40 TB / 380 GB</td>
                          <td className="p-2.5 font-mono font-semibold text-slate-700">498.0 Mbps</td>
                          <td className="p-2.5 text-right font-mono text-slate-400">Zero Rated</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-navy">
                      Itemized Accounting Breakdown (B2B Standard T03/2026)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Standard telecommunication ledger format for corporate enterprise
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-brand-soft">
                    Account: B101000000000089
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                      <tr>
                        <th className="p-3">CODE</th>
                        <th className="p-3">SERVICE SPECIFICATION &amp; HARDWARE</th>
                        <th className="p-3 text-center">UNIT</th>
                        <th className="p-3 text-center">QTY</th>
                        <th className="p-3 text-right">UNIT RATE</th>
                        <th className="p-3 text-right">AMOUNT (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-500">ITM-FTTH500</td>
                        <td className="p-3">
                          <div className="font-bold text-navy">FTTH Dedicated 500Mbps Port</div>
                          <div className="text-[11px] text-slate-500">
                            Cycle 01/03/2026 – 31/03/2026 &bull; CIR 200M / PIR 500M &bull; ODF SP-HK-04 Port 04
                          </div>
                        </td>
                        <td className="p-3 text-center text-slate-600">Month</td>
                        <td className="p-3 text-center font-mono text-slate-700">1</td>
                        <td className="p-3 text-right font-mono text-slate-700">$2,500.00</td>
                        <td className="p-3 text-right font-mono font-bold text-navy">$2,500.00</td>
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-500">ITM-ONT-AX3</td>
                        <td className="p-3">
                          <div className="font-bold text-navy">Terminal Equipment: Wi-Fi 6 GPON ONT</div>
                          <div className="text-[11px] text-slate-500">
                            SN: NX08829104 &bull; MAC: BC:24:11:8A:4F:9C &bull; 24/7 SLA Replacement
                          </div>
                        </td>
                        <td className="p-3 text-center text-slate-600">Device</td>
                        <td className="p-3 text-center font-mono text-slate-700">1</td>
                        <td className="p-3 text-right font-mono text-slate-700">$200.00</td>
                        <td className="p-3 text-right font-mono font-bold text-navy">$200.00</td>
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-500">ITM-QOS-BURST</td>
                        <td className="p-3">
                          <div className="font-bold text-navy">Flexible Burstable Bandwidth (QoS Premium)</div>
                          <div className="text-[11px] text-slate-500">
                            Logged 4.2h peak burst at 542 Mbps on March 18
                          </div>
                        </td>
                        <td className="p-3 text-center text-slate-600">Event</td>
                        <td className="p-3 text-center font-mono text-slate-700">1</td>
                        <td className="p-3 text-right font-mono text-slate-700">$750.00</td>
                        <td className="p-3 text-right font-mono font-bold text-navy">$750.00</td>
                      </tr>

                      <tr className="bg-sky-50/40 hover:bg-sky-50/70">
                        <td className="p-3 font-mono font-bold text-sky-800">DISC-B2B-T1</td>
                        <td className="p-3">
                          <div className="font-bold text-sky-900">Corporate B2B Customer Discount (Tier-1 Enterprise)</div>
                          <div className="text-[11px] text-sky-700">
                            Volume incentive 12.5% applied on recurring charges &bull; 24M Contract
                          </div>
                        </td>
                        <td className="p-3 text-center text-sky-800">%</td>
                        <td className="p-3 text-center font-mono font-bold text-sky-800">12.5%</td>
                        <td className="p-3 text-right font-mono font-bold text-sky-800">-$431.25</td>
                        <td className="p-3 text-right font-mono font-bold text-sky-800">-$431.25</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="w-full sm:w-96 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Gross Telecom Charges (Gross Subtotal):</span>
                      <span className="font-mono font-bold text-slate-800">$3,450.00</span>
                    </div>
                    <div className="flex justify-between text-sky-700 font-semibold">
                      <span>Corporate Scheme Deduction (-12.5%):</span>
                      <span className="font-mono font-bold">-$431.25</span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-bold border-t border-slate-200 pt-1">
                      <span>Net Taxable Base:</span>
                      <span className="font-mono font-black">$3,018.75</span>
                    </div>
                    <div className="flex justify-between items-center rounded-lg bg-indigo-100/70 p-2 text-indigo-950 font-black">
                      <span>Statutory Telecom VAT ({STATUTORY_TAX_RATE_PERCENT}%):</span>
                      <span className="font-mono text-sm">+$369.50</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 text-sm font-black text-navy border-t border-slate-200">
                      <span>TOTAL PAYABLE:</span>
                      <span className="font-mono text-2xl font-black text-brand-soft">$3,388.25</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div
                id="fifo-payment-desk"
                className="rounded-2xl border-2 border-indigo-200 bg-white p-5 shadow-md space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-brand-soft" />
                      <h2 className="text-sm font-black text-navy uppercase tracking-wide">
                        FIFO Counter Payment Collection (CN19)
                      </h2>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Payments allocate oldest-first by invoice issue/due date; receipts reflect live response data (simulated client ledger).
                    </p>
                  </div>
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                    OLDEST-FIRST FIFO
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Active Invoice / Subscriber Account
                  </label>
                  <select
                    value={activeInvoice.invoiceId}
                    onChange={(e) => {
                      setSelectedInvoiceId(e.target.value)
                      setPaymentError(null)
                      setPaymentAmountInput('')
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-navy focus:border-brand-soft focus:bg-white focus:outline-none"
                  >
                    {invoices.map((inv) => {
                      const rem = calculateInvoiceTotals(inv.items || [], inv.previousBalance || 0, inv.paidAmount || 0).remainingBalance
                      const bal = inv.status === 'PAID' ? 0 : (inv.remainingBalance ?? rem)
                      return (
                        <option key={inv.invoiceId} value={inv.invoiceId}>
                          {inv.invoiceId} &bull; {inv.customerName} ({inv.accountId}) &bull; {inv.status} ({formatUSD(bal)})
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Account ID</div>
                    <div className="font-mono font-bold text-navy truncate">{activeInvoice.accountId}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Open FIFO Inv.</div>
                    <div className="font-mono font-black text-indigo-700">{activeAccountSummary.count} open</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Total Account Debt</div>
                    <div className="font-mono font-black text-rose-600">
                      {formatUSD(activeAccountSummary.totalUnpaidBalance)}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>FIFO Settlement Queue (Oldest-First Order)</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Sorted: issuedDate &rarr; dueDate
                    </span>
                  </div>
                  {activeAccountSummary.count === 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-semibold text-emerald-800">
                      All invoices for account {activeInvoice.accountId} are PAID in full ($0.00 balance).
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden text-[11px]">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                          <tr>
                            <th className="py-1.5 px-2.5">#</th>
                            <th className="py-1.5 px-2.5">Invoice</th>
                            <th className="py-1.5 px-2.5">Due / Status</th>
                            <th className="py-1.5 px-2.5 text-right">Due Bal</th>
                            <th className="py-1.5 px-2.5 text-right">FIFO Alloc</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeAccountSummary.invoices.map((inv, idx) => {
                            const planned = fifoPreview.allocations.find((a) => a.invoiceId === inv.invoiceId)
                            const bal = inv.remainingBalance ?? calculateInvoiceTotals(inv.items || [], inv.previousBalance || 0, inv.paidAmount || 0).remainingBalance
                            return (
                              <tr key={inv.invoiceId} className={planned ? 'bg-indigo-50/40' : 'bg-white'}>
                                <td className="py-2 px-2.5 font-mono font-bold text-indigo-700">#{idx + 1}</td>
                                <td className="py-2 px-2.5">
                                  <div className="font-mono font-bold text-navy">{inv.invoiceId}</div>
                                  <div className="text-[10px] text-slate-400">{inv.billingCycle}</div>
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="font-mono text-slate-600">{inv.dueDate}</div>
                                  <span
                                    className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-bold ${
                                      inv.status === 'OVERDUE'
                                        ? 'bg-rose-100 text-rose-700'
                                        : inv.status === 'PARTIALLY_PAID'
                                        ? 'bg-sky-100 text-sky-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-700">
                                  {formatUSD(bal)}
                                </td>
                                <td className="py-2 px-2.5 text-right font-mono font-black text-emerald-700">
                                  {planned ? `+${formatUSD(planned.allocatedAmount)}` : '$0.00'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {activeAccountSummary.count > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor="fifo-payment-amount"
                          className="block text-[11px] font-bold text-slate-600 mb-1"
                        >
                          Collected Amount (USD)
                        </label>
                        <input
                          id="fifo-payment-amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={activeAccountSummary.totalUnpaidBalance}
                          placeholder={activeAccountSummary.totalUnpaidBalance.toFixed(2)}
                          value={paymentAmountInput}
                          onChange={(e) => {
                            setPaymentAmountInput(e.target.value)
                            setPaymentError(null)
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-navy focus:border-brand-soft focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Payment Channel
                        </label>
                        <select
                          value={paymentMethodInput}
                          onChange={(e) => setPaymentMethodInput(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-brand-soft focus:outline-none"
                        >
                          <option value="Counter Cash Desk">Counter Cash Desk</option>
                          <option value="Corporate Bank Transfer (Demo)">Corporate Bank Transfer (Demo)</option>
                          <option value="Virtual Account QR (Demo)">Virtual Account QR (Demo)</option>
                          <option value="POS / Corporate Card (Demo)">POS / Corporate Card (Demo)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      {activeAccountSummary.oldestInvoice && (
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentAmountInput(String(activeAccountSummary.oldestInvoice.remainingBalance ?? 0))
                          }
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          Oldest Invoice Only ({formatUSD(activeAccountSummary.oldestInvoice.remainingBalance)})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPaymentAmountInput(activeAccountSummary.totalUnpaidBalance.toFixed(2))}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                      >
                        Full FIFO Account Balance ({formatUSD(activeAccountSummary.totalUnpaidBalance)})
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Collector Reference / Note
                      </label>
                      <input
                        type="text"
                        value={paymentNoteInput}
                        onChange={(e) => setPaymentNoteInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-brand-soft focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isSettlingFifo}
                        onClick={handleConfirmPayment}
                        className="btn-primary !py-2 !text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {isSettlingFifo ? 'Allocating FIFO...' : `Collect ${formatUSD(fifoPreview.effectiveAmount || activeAccountSummary.totalUnpaidBalance)} (FIFO)`}
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenRealReceipt}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        <Receipt size={13} className="inline mr-1 text-emerald-600" />
                        Print Real Receipt
                      </button>
                    </div>
                  </div>
                )}

                {activeLatestReceiptSource && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-emerald-900">
                      <span>Recorded Payment Receipt Ready</span>
                      <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-200">
                        {activeLatestReceiptSource.receiptNumber}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-emerald-800">
                      <span>
                        Settled:{' '}
                        <strong>
                          {formatUSD(
                            activeLatestReceiptSource.totalPaidAmount ??
                              activeLatestReceiptSource.lastPaymentAmount ??
                              activeLatestReceiptSource.paidAmount
                          )}
                        </strong>{' '}
                        via {activeLatestReceiptSource.paymentMethod}
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenRealReceipt}
                        className="font-bold underline text-emerald-900 hover:text-emerald-700 cursor-pointer"
                      >
                        Open Receipt Modal
                      </button>
                    </div>
                  </div>
                )}

                {activeInvoiceTotals && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] space-y-1">
                    <div className="flex justify-between font-bold text-navy">
                      <span>Selected Invoice: {activeInvoice.invoiceId}</span>
                      <span className="font-mono">{activeInvoice.status}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal + VAT ({STATUTORY_TAX_RATE_PERCENT}%):</span>
                      <span className="font-mono">
                        {formatUSD(activeInvoiceTotals.subtotal)} + {formatUSD(activeInvoiceTotals.serviceTax)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Paid / Remaining on {activeInvoice.invoiceId}:</span>
                      <span className="font-mono font-bold text-navy">
                        {formatUSD(activeInvoice.paidAmount || 0)} / {formatUSD(activeInvoice.remainingBalance ?? activeInvoiceTotals.remainingBalance)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl relative overflow-hidden font-sans">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck size={18} className="text-brand-soft" />
                    <span className="text-xs font-black uppercase tracking-wider text-navy">
                      INVOICE DRAFT PREVIEW
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 font-bold">PREVIEW COPY</span>
                </div>

                <div className="mt-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Network size={16} className="text-brand-soft" />
                    <span className="text-xs font-black text-navy uppercase tracking-wider">
                      NEXUS TELECOM CORPORATION
                    </span>
                  </div>
                  <div className="font-serif text-[11px] text-slate-500">Enterprise Carrier &amp; Broadband Services</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">
                    Cycle: <strong>T03/2026</strong> &bull; Demo Sample Preview
                  </div>
                  <div className="text-[10px] text-slate-400">Date: 31/03/2026</div>
                </div>

                <div className="mt-4 border-t border-b border-slate-100 py-3 text-[11px] space-y-1.5 text-slate-600">
                  <div>
                    <div className="font-bold text-slate-700 uppercase text-[10px]">Service Provider:</div>
                    <div className="font-bold text-navy">NEXUS TELECOM CORPORATION</div>
                    <div className="text-slate-500">Tax ID: 0102345678 &bull; Hotline: 1800 8098</div>
                    <div className="text-slate-500">54 Lieu Giai, Ngoc Khanh, Ba Dinh, Hanoi</div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-100">
                    <div className="font-bold text-slate-700 uppercase text-[10px]">Subscriber / Client:</div>
                    <div className="font-bold text-navy">ALPHACORP TECHNOLOGY SOLUTIONS JSC</div>
                    <div className="text-slate-500">Tax ID: 0108881948</div>
                    <div className="text-slate-500">Rep: KS. Tran Hai</div>
                    <div className="text-slate-500">45 Ly Thuong Kiet, Hoan Kiem, Hanoi</div>
                    <div className="text-slate-500">Account ID: <strong className="font-mono text-brand-soft">B101000000000089</strong></div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>1. FTTH 500Mbps Port</span>
                    <span className="font-mono">$2,500.00</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>2. Wi-Fi 6 GPON ONT Rental</span>
                    <span className="font-mono">$200.00</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>3. Burst Bandwidth CDR</span>
                    <span className="font-mono">$750.00</span>
                  </div>
                  <div className="flex justify-between text-sky-700 font-semibold">
                    <span>4. Corporate Scheme (-12.5%)</span>
                    <span className="font-mono">-$431.25</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-700">
                    <span>Net Subtotal:</span>
                    <span className="font-mono">$3,018.75</span>
                  </div>
                  <div className="flex justify-between text-indigo-700 font-bold">
                    <span>VAT Telecom ({STATUTORY_TAX_RATE_PERCENT}%):</span>
                    <span className="font-mono">+$369.50</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-300 pt-1 font-black text-navy text-xs">
                    <span>TOTAL AMOUNT DUE:</span>
                    <span className="font-mono text-brand-soft">$3,388.25</span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between">
                  <div className="text-[10px] text-slate-600">
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <ShieldCheck size={12} className="text-indigo-600" /> SYSTEM BILLING PREVIEW (UNSIGNED)
                    </div>
                    <div className="text-slate-500 mt-0.5">Generated from internal billing ledger</div>
                    <div className="text-slate-400 font-mono text-[9px]">Pending tax-authority digital issuance</div>
                  </div>
                  <QrCode size={40} className="text-slate-400" />
                </div>

                <div className="mt-3 text-[10px] text-center text-slate-400">
                  Demo Invoice Sample &bull; Account: <strong>B101000000000089</strong>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-brand-soft" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-navy">
                      Payment Channels &amp; Settlement (Demo)
                    </h3>
                  </div>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-brand-soft">
                    DEMO BANK TRANSFER
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    SAMPLE VIRTUAL ACCOUNT REFERENCE (DEMO)
                  </div>
                  <div className="mt-1 font-mono text-base font-black tracking-wider text-brand-accent">
                    9988 B101 0000 0000 0089
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">
                    Demo Settlement Channel &bull; Local Simulation Only
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 text-slate-600">
                    <span>Reminder Schedule (Mock):</span>
                    <span className="font-bold text-slate-700">Configurable (+3d)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5 text-slate-600">
                    <span>Sample Corporate Account:</span>
                    <span className="font-medium text-slate-800">AlphaCorp Demo Settlement Acc</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Contract Security Deposit:</span>
                    <span className="font-bold text-slate-800">$7,500.00 (Offset Eligible)</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSettlingFifo || activeAccountSummary.totalUnpaidBalance <= 0}
                    onClick={handleConfirmPayment}
                    className={`rounded-xl py-2 px-3 text-center text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                      activeAccountSummary.totalUnpaidBalance <= 0 || isPaid
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'btn-primary !py-2 !text-xs font-bold'
                    }`}
                  >
                    {activeAccountSummary.totalUnpaidBalance <= 0 ? (
                      <>&check; Account Paid (FIFO)</>
                    ) : (
                      <>Collect FIFO Payment</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => showToast('Dunning schedule created for Day 4.')}
                    className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Schedule Notice
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 via-white to-white p-4.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-xs border border-emerald-100">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-navy">
                    Invoice Period T03/2026 for Contract #B0000001089 &bull; Billing Preview Ready
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {STATUTORY_TAX_RATE_PERCENT}% Statutory Tax applied &bull; Sample Preview &bull; Account: <strong>B101000000000089</strong>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenRealReceipt}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Print Payment Receipt
                </button>
                <button
                  type="button"
                  onClick={() => showToast('Loading historical CDR audit for AlphaCorp...')}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  CDR History
                </button>
                <button
                  type="button"
                  onClick={() => showToast('Adjustment ledger opened.')}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                >
                  Revoke / Adjust
                </button>
                <button
                  type="button"
                  onClick={() => {
                    showToast('Invoice released to Customer Portal ledger.')
                  }}
                  className="btn-primary !px-5 !py-2 !text-xs font-bold shadow-md cursor-pointer"
                >
                  Release Invoice to Customer Portal &rarr;
                </button>
              </div>
            </div>
          </div>
          </>
          )}
        </div>

        {showPrintModal && (
          <PrintReceiptModal
            receiptData={receiptModalData}
            onClose={() => setShowPrintModal(false)}
          />
        )}
    </AccountsLayout>
  )
}
