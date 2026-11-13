import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wifi,
  Activity,
  Receipt,
  MessageSquare,
  Radio,
  CreditCard,
  Zap,
  ShieldCheck,
  RefreshCw,
  Download,
  CheckCircle2,
  Star,
  Send,
  PlusCircle,
  AlertCircle,
} from 'lucide-react'
import CustomerLayout from '../../components/layout/CustomerLayout'
import {
  fetchInvoices,
  recordFifoAccountPayment,
  getAccountUnpaidSummary,
  simulateFifoAllocation,
  buildPaymentReceiptFromResponse,
  formatUSD,
  calculateInvoiceTotals,
} from '../../services/billingService'
import { STATUTORY_TAX_RATE_PERCENT } from '../../services/taxConfig'
import { filterCustomerData } from '../../services/customerService'
import { getLifecycleStatusMeta, ACCOUNT_LIFECYCLE_STATUS } from '../../services/accountLifecycleService'
import { getCurrentUser } from '../../services/authService'
import { useToast } from '../../hooks/useToast'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import {
  downloadInvoiceDocument,
  downloadStatementDocument,
  exportInvoiceXmlDocument,
} from '../../utils/telecomDocumentGenerator'
import LiveDiagnosticModal from '../../components/common/LiveDiagnosticModal'
import PrintReceiptModal from '../../components/common/PrintReceiptModal'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import { useAsyncResource } from '../../hooks/useAsyncResource'

export default function CustomerPortalPage() {
  const user = getCurrentUser()
  const hasAuthenticatedUser = Boolean(
    user && (user.customerId || user.identifier || user.taxId || user.email)
  )
  const [activeTab, setActiveTab] = useState('circuits')
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('Online Corporate Banking')
  const [paymentError, setPaymentError] = useState(null)
  const [receiptModalData, setReceiptModalData] = useState(null)
  const [lastPortalPayment, setLastPortalPayment] = useState(null)
  const { toast, showToast } = useToast()
  const [feedbackCategory, setFeedbackCategory] = useState('SERVICE_QUALITY')
  const [rating, setRating] = useState(5)
  const [feedbackNote, setFeedbackNote] = useState('')
  const [submittedFeedbacks, setSubmittedFeedbacks] = useState([
    {
      id: 'FB-901',
      date: '2026-03-25',
      category: 'CIRCUIT_PERFORMANCE',
      rating: 5,
      note: 'Optical latency consistently under 2ms for our trading desk. Excellent SLA.',
      status: 'RESOLVED',
    },
    {
      id: 'FB-884',
      date: '2026-03-10',
      category: 'BILLING_SUPPORT',
      rating: 4,
      note: `Requested clarification on ${STATUTORY_TAX_RATE_PERCENT}% statutory service tax deduction. Handled swiftly.`,
      status: 'RESOLVED',
    },
  ])

  const {
    data: loadedCustomerState,
    isLoading,
    error,
    reload: reloadCustomerData,
  } = useAsyncResource(async () => {
    if (!hasAuthenticatedUser) {
      return {
        customerProfile: null,
        circuits: [],
        orders: [],
        invoices: [],
        isEmpty: true,
        hasUser: false,
      }
    }
    const invs = await fetchInvoices()
    return filterCustomerData(user, invs)
  }, [user?.customerId, user?.identifier, user?.taxId, user?.email, user?.authMode])

  const customerState = loadedCustomerState || {
    customerProfile: null,
    circuits: [],
    orders: [],
    invoices: [],
    isEmpty: true,
    hasUser: hasAuthenticatedUser,
  }

  const { customerProfile, circuits, orders, invoices, hasUser } = customerState

  async function handleMakePayment(e) {
    e.preventDefault()
    if (!selectedInvoice) return
    setPaymentError(null)
    const unpaidSummary = getAccountUnpaidSummary(selectedInvoice.accountId, invoices)
    const amountToPay = payAmount ? parseFloat(payAmount) : unpaidSummary.totalUnpaidBalance

    try {
      const paymentResult = await recordFifoAccountPayment(selectedInvoice.accountId, {
        amount: amountToPay,
        method: payMethod,
        cashierName: 'Customer Self-Service Portal',
        note: `Self-service online FIFO payment by ${customerProfile?.customerName || user?.identifier}`,
      })
      const realReceipt = buildPaymentReceiptFromResponse(paymentResult)
      setLastPortalPayment(paymentResult)
      setReceiptModalData(realReceipt)
      showToast(
        `FIFO payment of ${formatUSD(paymentResult.totalPaidAmount)} settled (${paymentResult.receiptNumber}) across ${paymentResult.allocations.length} invoice(s).`
      )
      setSelectedInvoice(null)
      setPayAmount('')
      reloadCustomerData()
    } catch (err) {
      const msg = err?.message || 'Payment processing failed.'
      setPaymentError(msg)
      showToast(msg, 'error')
    }
  }

  function handleSubmitFeedback(e) {
    e.preventDefault()
    if (!feedbackNote.trim()) return

    const newFb = {
      id: `FB-${Math.floor(100 + Math.random() * 900)}`,
      date: new Date().toISOString().split('T')[0],
      category: feedbackCategory,
      rating,
      note: feedbackNote,
      status: 'UNDER_REVIEW',
    }

    setSubmittedFeedbacks([newFb, ...submittedFeedbacks])
    setFeedbackNote('')
    showToast('Feedback submitted to NOC Support Management.')
  }

  const totalOutstanding = invoices.reduce((sum, inv) => {
    return sum + (inv.status !== 'PAID' ? (inv.remainingBalance ?? (inv.items.reduce((s, i) => s + i.amount, 0) * 1.1224)) : 0)
  }, 0)

  return (
    <CustomerLayout
      activeNavId={activeTab}
      onTabChange={setActiveTab}
      toast={toast}
      customerProfile={customerProfile}
    >
      {!hasUser ? (
        <div className="card p-8 md:p-12 shadow-sm text-center space-y-4 max-w-xl mx-auto my-12 rounded-3xl border border-slate-200 bg-white">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 font-bold">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-navy">Subscriber Identity Required</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            No customer session was detected. Sign in with a verified Customer ID (<span className="font-mono">CUS-001</span>), 16-character Account ID (<span className="font-mono">B101000000000089</span>), Order ID, or Tax ID to load only that subscriber&apos;s circuits and statutory tax invoices.
          </p>
          <div className="pt-2 flex justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 shadow-md shadow-navy/20 transition cursor-pointer"
            >
              <span>Sign In to Customer Portal</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="card p-5 md:p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>Enterprise Subscriber Portal</span>
                <span>/</span>
                <span className="font-semibold text-slate-700">Client Self-Service</span>
                <span>/</span>
                <span className="font-mono text-brand-soft font-bold">
                  {customerProfile?.customerName || user?.identifier}
                </span>
                {customerProfile?.customerId && (
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700 border border-indigo-200/80">
                    {customerProfile.customerId}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-extrabold text-navy">
                  {activeTab === 'circuits' && 'Dedicated Subscriber Circuits (Demo View)'}
                  {activeTab === 'orders' && 'Service Orders & Provisioning Milestones'}
                  {activeTab === 'invoices' && 'Monthly Invoices & Statutory Tax Statements'}
                  {activeTab === 'support' && 'Carrier Support & Service Quality Assurance'}
                </h1>
                <span className="rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-700">
                  {circuits.length > 0 ? 'SLA TARGET 99.98% (DEMO)' : 'DEMO PORTAL'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Simulated circuit status, invoice preview, order progression, and SLA reference metrics.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'circuits' && (
                <button
                  type="button"
                  onClick={() => setShowDiagnosticModal(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>Run Sample Diagnostic</span>
                </button>
              )}
              {activeTab === 'invoices' && (
                <button
                  type="button"
                  disabled={isLoading || invoices.length === 0}
                  onClick={() => {
                    downloadStatementDocument(customerProfile, circuits, invoices, totalOutstanding)
                    showToast(`Billing statement PDF downloaded for ${customerProfile?.customerName || 'Subscriber'}.`)
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download size={14} />
                  <span>Statement PDF</span>
                </button>
              )}
              <button
                type="button"
                onClick={reloadCustomerData}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {paymentError && (
            <AsyncStatePanel
              compact
              state="error"
              title="Electronic Payment Error"
              description={paymentError}
              actionLabel="Dismiss"
              onAction={() => setPaymentError(null)}
            />
          )}

          {isLoading ? (
            <AsyncStatePanel
              state="loading"
              title="Loading subscriber account..."
              description="Retrieving active optical circuits, provisioning history, and statutory billing invoices."
            />
          ) : error ? (
            <AsyncStatePanel
              state="error"
              title="Unable to load subscriber data"
              description={error}
              onRetry={reloadCustomerData}
            />
          ) : (
          <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Circuits</span>
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 border border-emerald-100">
                  <Radio size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{circuits.length}</span>
                <span className={`text-xs font-bold ${circuits.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {circuits.length > 0 ? 'Provisioned (Demo)' : 'No Lines'}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500 truncate" title={circuits.map((c) => c.serviceTitle || c.planName).join(' + ')}>
                {circuits.length > 0
                  ? circuits.map((c) => c.serviceTitle || c.planName).join(' + ')
                  : 'Awaiting circuit activation'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outstanding Balance</span>
                <div className="rounded-xl bg-indigo-50 p-2 text-brand-soft border border-indigo-100">
                  <CreditCard size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{formatUSD(totalOutstanding)}</span>
                <span className={`text-xs font-bold ${totalOutstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {invoices.length > 0 ? (totalOutstanding > 0 ? 'Payment Due' : 'Settled') : 'Settled'}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {invoices.length > 0 ? 'Monthly cycle settlement' : 'No pending billing cycles'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Optical SLA Health</span>
                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600 border border-cyan-100">
                  <Zap size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{circuits.length > 0 ? '99.98%' : 'Nominal'}</span>
                <span className="text-xs font-bold text-cyan-600">&lt; 2.0ms Latency</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {circuits.length > 0
                  ? `Sample Rx: ${circuits[0].qualityMetrics?.rxPowerDbm || circuits[0].rxPower || -18.2} dBm`
                  : 'Demo telemetry status'}
              </div>
            </div>

            <div className="rounded-2xl bg-navy text-white p-5 shadow-lg shadow-navy/20">
              <div className="flex items-center justify-between text-indigo-300">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Carrier NOC Priority</span>
                <div className="rounded-xl bg-white/10 p-2 text-indigo-200">
                  <ShieldCheck size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">Tier 1 SLA</span>
                <span className="text-xs font-semibold text-emerald-400">24/7 Dedicated</span>
              </div>
              <div className="mt-1 text-xs text-indigo-200/80 truncate">
                {customerProfile?.taxId ? `Tax ID: ${customerProfile.taxId}` : 'Enterprise Client Services'}
              </div>
            </div>
          </div>

          {activeTab === 'circuits' && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-base font-bold text-navy">Dedicated Subscriber Circuits</h3>
                <p className="text-xs text-slate-500">Circuit status, simulated signal values, and hardware port bindings</p>
              </div>

              {circuits.length === 0 ? (
                <AsyncStatePanel
                  state="empty"
                  icon={Radio}
                  title="No Subscribed Circuits Found"
                  description={`There are currently no active optical lines, FTTH broadband ports, or SIP voice trunks registered under ${customerProfile?.customerName || user?.identifier}.`}
                  actionLabel="Register New Circuit"
                  actionTo="/retail/orders/new"
                />
              ) : (
                <div className="space-y-4">
                  {circuits.map((circuit) => {
                    const rxPower = circuit.qualityMetrics?.rxPowerDbm ?? circuit.rxPower ?? -18.2
                    const pingMs = circuit.qualityMetrics?.pingMs ?? circuit.latencyMs ?? 1.6
                    const ipWan = circuit.networkConfig?.ipWan ?? circuit.ipWan ?? '118.70.124.89/29'
                    const serial = circuit.assignedHardware?.serialNumber ?? circuit.ontSerial ?? 'NX8829104'
                    const lifecycleMeta = getLifecycleStatusMeta(circuit.lifecycleStatus || circuit.status)
                    const statusPillClass =
                      lifecycleMeta.value === ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : lifecycleMeta.value === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'

                    return (
                      <div
                        key={circuit.accountId}
                        className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-indigo-300 transition"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-black text-brand-soft font-mono border border-indigo-200">
                                {circuit.accountId}
                              </span>
                              <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${statusPillClass}`}>
                                {lifecycleMeta.label}
                              </span>
                              {circuit.orderId && (
                                <span className="text-xs text-slate-400">Ref Order: {circuit.orderId}</span>
                              )}
                            </div>
                            <h4 className="text-base font-bold text-navy">{circuit.serviceTitle || circuit.planName}</h4>
                            <p className="text-xs text-slate-500">{circuit.installationAddress}</p>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">IP WAN Allocation</span>
                              <span className="font-mono font-bold text-slate-800">{ipWan}</span>
                            </div>
                            <div className="rounded-xl bg-emerald-50/50 p-3 border border-emerald-100">
                              <span className="text-emerald-700 block text-[10px] uppercase font-bold">Optical Rx Power</span>
                              <span className="font-bold text-emerald-700">{rxPower} dBm</span>
                            </div>
                            <div className="rounded-xl bg-cyan-50/50 p-3 border border-cyan-100">
                              <span className="text-cyan-700 block text-[10px] uppercase font-bold">Ping Latency</span>
                              <span className="font-bold text-cyan-800">{pingMs} ms</span>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Hardware S/N</span>
                              <span className="font-mono text-slate-700 text-[11px] font-semibold">{serial}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-base font-bold text-navy">Service Orders &amp; Provisioning Milestones</h3>
                <p className="text-xs text-slate-500">Historical requests, initial deposits, and ODN site survey validation</p>
              </div>

              {orders.length === 0 ? (
                <AsyncStatePanel
                  state="empty"
                  icon={Activity}
                  title="No Service Orders on Record"
                  description={`No historical provisioning requests or ODN site surveys were found for subscriber profile ${customerProfile?.customerName || user?.identifier}.`}
                  actionLabel="Create New Service Order"
                  actionTo="/retail/orders/new"
                />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="py-3.5 px-4">Order ID</th>
                        <th className="py-3.5 px-4">Service Plan</th>
                        <th className="py-3.5 px-4">Registration</th>
                        <th className="py-3.5 px-4">ODN Survey</th>
                        <th className="py-3.5 px-4">Plan Price</th>
                        <th className="py-3.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {orders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-brand-soft">{ord.id}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">{ord.planName}</td>
                          <td className="py-3.5 px-4 text-slate-500">{ord.registeredTime || '09:00'}</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <CheckCircle2 size={13} /> {ord.signalLoss || 'Verified'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{formatUSD(ord.planPriceUSD)}</td>
                          <td className="py-3.5 px-4">
                            <OrderStatusBadge status={ord.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-base font-bold text-navy">Monthly Invoices &amp; Statutory Tax Statements</h3>
                <p className="text-xs text-slate-500">Compliant with {STATUTORY_TAX_RATE_PERCENT}% telecom statutory service tax regulations</p>
              </div>

              {invoices.length === 0 ? (
                <AsyncStatePanel
                  state="empty"
                  icon={Receipt}
                  title="No Monthly Invoices Issued"
                  description={`Your billing ledger is clear with no unpaid charges or statutory tax statements for subscriber ${customerProfile?.customerName || user?.identifier}.`}
                />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="py-3.5 px-4">Invoice #</th>
                        <th className="py-3.5 px-4">Account ID</th>
                        <th className="py-3.5 px-4">Billing Cycle</th>
                        <th className="py-3.5 px-4">Due Date</th>
                        <th className="py-3.5 px-4">Subtotal</th>
                        <th className="py-3.5 px-4">Tax ({STATUTORY_TAX_RATE_PERCENT}%)</th>
                        <th className="py-3.5 px-4">Paid</th>
                        <th className="py-3.5 px-4">Balance</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {invoices.map((inv) => {
                        const totals = calculateInvoiceTotals(inv.items, inv.previousBalance || 0, inv.paidAmount || 0)
                        const subtotal = totals.subtotal
                        const tax = totals.serviceTax
                        const paid = inv.paidAmount || (inv.status === 'PAID' ? totals.totalPayable : 0)
                        const balance =
                          inv.remainingBalance !== undefined
                            ? inv.remainingBalance
                            : Math.max(0, Number((totals.totalPayable - paid).toFixed(2)))

                        return (
                          <tr key={inv.invoiceId} className="hover:bg-slate-50/70 transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{inv.invoiceId}</td>
                            <td className="py-3.5 px-4 font-mono text-brand-soft">{inv.accountId}</td>
                            <td className="py-3.5 px-4 text-slate-500">{inv.billingCycle}</td>
                            <td className="py-3.5 px-4 text-slate-500">{inv.dueDate}</td>
                            <td className="py-3.5 px-4 font-mono">{formatUSD(subtotal)}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">{formatUSD(tax)}</td>
                            <td className="py-3.5 px-4 font-mono text-emerald-600 font-bold">{formatUSD(paid)}</td>
                            <td className="py-3.5 px-4 font-mono font-bold text-amber-600">{formatUSD(balance)}</td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                                  inv.status === 'PAID'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : inv.status === 'PARTIALLY_PAID'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : inv.status === 'OVERDUE'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              {balance > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedInvoice(inv)
                                    setPayAmount(balance.toFixed(2))
                                  }}
                                  className="rounded-lg bg-navy px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 transition cursor-pointer shadow-xs"
                                >
                                  Pay Now
                                </button>
                              )}
                              {inv.receiptNumber && (Number(inv.paidAmount || 0) > 0 || inv.status === 'PAID') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const source =
                                      lastPortalPayment &&
                                      lastPortalPayment.receiptNumber === inv.receiptNumber
                                        ? lastPortalPayment
                                        : inv
                                    setReceiptModalData(buildPaymentReceiptFromResponse(source))
                                  }}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer shadow-xs"
                                  title="View payment receipt from actual transaction"
                                >
                                  Receipt
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  downloadInvoiceDocument(inv)
                                  showToast(`Invoice PDF downloaded: Invoice_${inv.invoiceId}.pdf.`)
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
                                title="Download Invoice PDF"
                              >
                                <Download size={12} className="inline mr-1 text-slate-500" />
                                PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  exportInvoiceXmlDocument(inv)
                                  showToast(`Unsigned XML draft for ${inv.invoiceId} exported.`)
                                }}
                                className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-2 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                                title="Export unsigned XML draft"
                              >
                                XML
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedInvoice && (() => {
                const portalAccountSummary = getAccountUnpaidSummary(selectedInvoice.accountId, invoices)
                const portalFifoPreview = simulateFifoAllocation(
                  selectedInvoice.accountId,
                  payAmount ? parseFloat(payAmount) : portalAccountSummary.totalUnpaidBalance,
                  invoices
                )
                return (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-md animate-in fade-in slide-in-from-top-2 space-y-4">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-navy flex items-center gap-2">
                        <CreditCard className="text-brand-soft" size={18} />
                        Electronic Settlement (FIFO Oldest-First) &bull; Account {selectedInvoice.accountId}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Payments settle oldest unpaid invoices first across {portalAccountSummary.count} open invoice(s) totaling{' '}
                        <strong className="font-mono text-navy">{formatUSD(portalAccountSummary.totalUnpaidBalance)}</strong>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(null)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleMakePayment} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Account Bound</label>
                      <input
                        type="text"
                        disabled
                        value={selectedInvoice.accountId}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-700 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                      <select
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-brand-soft focus:outline-none"
                      >
                        <option value="Online Corporate Banking">Corporate Wire / E-Banking (Demo)</option>
                        <option value="Virtual Account Auto-Debit">Virtual Account Debit (Demo)</option>
                        <option value="Corporate Credit Card">Corporate Card (Demo)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Payment Amount (USD) &bull; FIFO Account Max: {formatUSD(portalAccountSummary.totalUnpaidBalance)}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={portalAccountSummary.totalUnpaidBalance}
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-navy shadow-xs focus:border-brand-soft focus:outline-none"
                          required
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-navy px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer whitespace-nowrap shadow-md shadow-navy/20"
                        >
                          Confirm Pay
                        </button>
                      </div>
                    </div>
                  </form>

                  {portalFifoPreview.allocations.length > 0 && (
                    <div className="rounded-xl border border-indigo-200/80 bg-white p-3 text-[11px] space-y-1">
                      <div className="font-bold text-navy">FIFO Allocation Preview:</div>
                      {portalFifoPreview.allocations.map((alloc) => (
                        <div key={alloc.invoiceId} className="flex justify-between text-slate-600">
                          <span>
                            #{alloc.fifoOrder} <strong className="font-mono text-navy">{alloc.invoiceId}</strong> (Issued {alloc.issuedDate})
                          </span>
                          <span className="font-mono font-bold text-emerald-700">
                            +{formatUSD(alloc.allocatedAmount)} &rarr; {alloc.resultingStatus} (Rem: {formatUSD(alloc.remainingAfter)})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )
              })()}
            </div>
          )}

          {activeTab === 'support' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-navy">Submit Customer Service Feedback</h3>
                  <p className="text-xs text-slate-500">Rate service quality or report network performance issues to NOC</p>
                </div>

                <form onSubmit={handleSubmitFeedback} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={feedbackCategory}
                      onChange={(e) => setFeedbackCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs focus:border-brand-soft focus:outline-none"
                    >
                      <option value="SERVICE_QUALITY">Optical Circuit &amp; Throughput Performance</option>
                      <option value="BILLING_SUPPORT">Billing, Invoices &amp; {STATUTORY_TAX_RATE_PERCENT}% Statutory Tax</option>
                      <option value="INSTALLATION">Field Technician Installation &amp; CPE Hardware</option>
                      <option value="FEATURE_REQUEST">Bandwidth Upgrade / Multi-Site Expansion</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Satisfaction Rating</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="cursor-pointer transition"
                        >
                          <Star
                            size={20}
                            className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-slate-700 ml-2">
                        {rating === 5 ? '5/5 - Outstanding' : `${rating}/5 Stars`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Detailed Remarks</label>
                    <textarea
                      rows={4}
                      value={feedbackNote}
                      onChange={(e) => setFeedbackNote(e.target.value)}
                      placeholder="Describe your operational experience, SLA verification, or assistance needed..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 shadow-xs focus:border-brand-soft focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer w-full shadow-md shadow-navy/20"
                  >
                    <Send size={14} />
                    <span>Send Feedback to Telecom Operations</span>
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-navy">Recent Feedback &amp; Support Log</h3>
                  <p className="text-xs text-slate-500">Tracking history of submitted reviews and NOC ticket responses</p>
                </div>

                <div className="space-y-3">
                  {submittedFeedbacks.length === 0 ? (
                    <AsyncStatePanel
                      compact
                      state="empty"
                      icon={MessageSquare}
                      title="No Support Tickets Logged"
                      description="You have not submitted any service quality reviews or support requests yet."
                    />
                  ) : (
                    submittedFeedbacks.map((fb) => (
                      <div key={fb.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-brand-soft">{fb.id}</span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                              {fb.category}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">{fb.date}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                          {Array.from({ length: fb.rating }).map((_, i) => (
                            <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                        <p className="text-xs text-slate-600">{fb.note}</p>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} /> {fb.status}
                          </span>
                          <span className="text-slate-400">Carrier SLA Acknowledged</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {showDiagnosticModal && (
        <LiveDiagnosticModal
          circuit={circuits[0]}
          onClose={() => setShowDiagnosticModal(false)}
        />
      )}

      {receiptModalData && (
        <PrintReceiptModal
          receiptData={receiptModalData}
          onClose={() => setReceiptModalData(null)}
        />
      )}
    </CustomerLayout>
  )
}
