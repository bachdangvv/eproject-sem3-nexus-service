import { useEffect, useMemo, useState } from 'react'
import {
  ShieldAlert,
  Edit3,
  Ban,
  AlertOctagon,
  AlertTriangle,
  Wrench,
  Printer,
  RefreshCw,
  FileText,
  Download,
  ExternalLink,
  Lock,
  Receipt,
  Banknote,
} from 'lucide-react'
import OrderStatusBadge from '../../../components/common/OrderStatusBadge'
import {
  DEPOSIT_STATUS,
  getOrderDepositSummary,
  getOrderRefundAmountUSD,
} from '../../../services/orderService'
import {
  checkDocumentAvailability,
  getAttachedDocumentList,
  openDocumentPreview,
  triggerDocumentDownload,
} from '../../../services/documentStorageService'
import {
  ORDER_STATUS,
  canModifyOrCancelOrder,
  getOrderStatusMeta,
  isOrderTerminalStatus,
  normalizeOrderStatus,
} from '../../../utils/orderStatus'

export default function OrderDetailDrawer({
  selectedOrder,
  onActionToast,
  onEdit,
  onCancelOrder,
  onRefundOrder,
  onCollectDeposit,
  onDispatchFieldTech,
  onPrintReceipt,
}) {
  const [docAvailability, setDocAvailability] = useState({})
  const [docActionError, setDocActionError] = useState('')
  const [busyDocKey, setBusyDocKey] = useState(null)

  const attachedDocuments = useMemo(() => {
    if (!selectedOrder) return []
    return getAttachedDocumentList(selectedOrder)
  }, [selectedOrder])

  useEffect(() => {
    let cancelled = false
    setDocActionError('')
    if (attachedDocuments.length === 0) {
      setDocAvailability({})
      return () => {
        cancelled = true
      }
    }

    const pendingState = {}
    for (const item of attachedDocuments) {
      pendingState[item.key] = 'checking'
    }
    setDocAvailability(pendingState)

    Promise.all(
      attachedDocuments.map(async (item) => {
        const available = await checkDocumentAvailability(item.doc)
        return [item.key, available ? 'ready' : 'missing']
      })
    ).then((entries) => {
      if (!cancelled) {
        setDocAvailability(Object.fromEntries(entries))
      }
    })

    return () => {
      cancelled = true
    }
  }, [attachedDocuments])

  if (!selectedOrder) return null

  const normalizedStatus = normalizeOrderStatus(selectedOrder.status)
  const statusMeta = getOrderStatusMeta(normalizedStatus)
  const isActivated = normalizedStatus === ORDER_STATUS.ACTIVATED
  const isCancelled = normalizedStatus === ORDER_STATUS.CANCELLED
  const isRefunded = normalizedStatus === ORDER_STATUS.REFUNDED
  const isNotFeasible = normalizedStatus === ORDER_STATUS.NOT_FEASIBLE
  const isTerminal = isOrderTerminalStatus(normalizedStatus)
  const canModify = canModifyOrCancelOrder(normalizedStatus)
  const isVoided = isCancelled || isRefunded
  const depositSummary = getOrderDepositSummary(selectedOrder)

  async function handleDocumentAction(key, doc, actionFn, fallbackError) {
    setBusyDocKey(key)
    setDocActionError('')
    try {
      await actionFn(doc)
    } catch (err) {
      const msg = err?.message || fallbackError
      setDocActionError(msg)
      setDocAvailability((prev) => ({ ...prev, [key]: 'missing' }))
      onActionToast?.(msg)
    } finally {
      setBusyDocKey(null)
    }
  }

  return (
    <div className="sticky top-20 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md sm:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-2.5 w-2.5 rounded-full ${isTerminal ? `${statusMeta.dotClass}` : 'bg-indigo-600 animate-pulse'}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
            ORDER INSPECTION &amp; DETAILS
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!canModify ? (
            <span
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
              title={
                isActivated
                  ? 'Activated orders have a commissioned circuit and cannot be edited or cancelled.'
                  : `${statusMeta.label} orders cannot be edited or cancelled.`
              }
            >
              <Lock size={11} />
              <span>{isActivated ? 'Activated • Locked' : `${statusMeta.label} • Locked`}</span>
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onEdit?.(selectedOrder)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-navy hover:bg-indigo-50 hover:border-indigo-200 transition cursor-pointer shadow-xs"
                title="Edit Order"
              >
                <Edit3 size={12} className="text-brand-soft" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => onCancelOrder?.(selectedOrder)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition cursor-pointer shadow-xs"
                title="Cancel Order"
              >
                <Ban size={12} className="text-rose-600" />
                <span>Cancel</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            RETAIL ORDER ID (11-CHAR)
          </span>
          <p className="font-mono text-xl font-black text-indigo-700">{selectedOrder.id}</p>
          <p className="text-[11px] text-slate-500">Branch: {selectedOrder.branchName}</p>
        </div>
        <OrderStatusBadge status={normalizedStatus} className="rounded-xl px-2.5 py-1 text-xs" />
      </div>

      {isCancelled && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <AlertOctagon size={16} className="text-rose-600 shrink-0" />
            <span>ORDER CANCELLED &amp; VOIDED</span>
          </div>
          <div className="rounded-xl bg-white/90 p-2.5 border border-rose-100 text-[11px] text-rose-950 space-y-1">
            <div>
              <span className="font-semibold text-slate-600">Cancellation Reason: </span>
              <span className="font-medium text-rose-800">{selectedOrder.cancellationReason || 'Store representative cancellation'}</span>
            </div>
            {selectedOrder.cancelledAt && (
              <div className="text-[10px] text-slate-500 font-mono">
                Cancelled At: {selectedOrder.cancelledAt}
              </div>
            )}
          </div>
          <p className="text-[10px] text-rose-700 leading-relaxed">
            Provisioning workflow and dispatch tickets for this order are voided. Hardware allocations returned to inventory warehouse.
          </p>
        </div>
      )}

      {isRefunded && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/80 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2 font-bold text-purple-900">
            <div className="flex items-center gap-2">
              <RefreshCw size={16} className="text-purple-600 shrink-0" />
              <span>100% SECURITY DEPOSIT REFUNDED</span>
            </div>
            <span className="font-mono text-xs font-black text-purple-800">
              ${Number(selectedOrder.refundAmountUSD ?? getOrderRefundAmountUSD(selectedOrder)).toFixed(2)}
            </span>
          </div>
          <div className="rounded-xl bg-white/90 p-2.5 border border-purple-100 text-[11px] text-purple-950 space-y-1">
            <div>
              <span className="font-semibold text-slate-600">Refund Reference: </span>
              <span className="font-medium text-purple-800">{selectedOrder.refundReason || '100% Deposit Refund under Regulatory Rule CN16'}</span>
            </div>
            {selectedOrder.refundedAt && (
              <div className="text-[10px] text-slate-500 font-mono">
                Refunded At: {selectedOrder.refundedAt}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2.5">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          PROVISIONING LIFECYCLE (5 STEPS) {isVoided && <span className="text-rose-600 font-black">— {statusMeta.label.toUpperCase()}</span>}
        </span>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
              ✓
            </span>
            <div>
              <span className="font-semibold text-slate-900">1. Reception &amp; Profile Pre-Check</span>
              <p className="text-[10px] text-slate-400">Order verified at storefront</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              isVoided ? 'bg-slate-200 text-slate-400' : selectedOrder.currentStep >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {isVoided ? '✕' : selectedOrder.currentStep >= 2 ? '✓' : '2'}
            </span>
            <div>
              <span className={`font-semibold ${isVoided ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                2. ODN Fiber Feasibility Survey
              </span>
              <p className="text-[10px] text-slate-400">
                {isVoided ? `Closed (${statusMeta.label})` : `Signal: ${selectedOrder.signalLoss}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              isVoided ? 'bg-slate-200 text-slate-400' : selectedOrder.currentStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {isVoided ? '✕' : '3'}
            </span>
            <div>
              <span className={`font-semibold ${isVoided ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                3. Equipment Allocation &amp; Vault
              </span>
              <p className="text-[10px] text-indigo-600 font-medium">
                {isVoided ? `Closed (${statusMeta.label})` : selectedOrder.allocatedDevice}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              isVoided ? 'bg-slate-200 text-slate-400' : selectedOrder.currentStep >= 4 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {isVoided ? '✕' : '4'}
            </span>
            <div>
              <span className={`font-semibold ${isVoided ? 'text-slate-400 line-through' : ''}`}>
                4. 16-Char Account ID
              </span>
              <p className="text-[10px] font-mono font-bold text-indigo-600">
                {isVoided ? 'Voided / Not Issued' : (selectedOrder.accountId || 'Issued upon Technical Activation')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              isVoided ? 'bg-slate-200 text-slate-400' : selectedOrder.currentStep >= 5 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {isVoided ? '✕' : '5'}
            </span>
            <div>
              <span className={`font-semibold ${isVoided ? 'text-slate-400 line-through' : ''}`}>
                5. Commissioning &amp; Postpaid Invoicing
              </span>
              <p className="text-[10px]">{isVoided ? 'No billing traffic' : 'Active billing traffic'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-[11px] text-slate-600">
        <span className="flex items-center gap-1 font-bold text-indigo-900">
          <ShieldAlert className="h-3.5 w-3.5 text-indigo-600" /> ODN Engineering Route
        </span>
        <p className="mt-1 text-slate-600">{selectedOrder.odnBox}</p>
        {(selectedOrder.serviceType === 'DIALUP' || selectedOrder.serviceType === 'DIAL_UP') &&
          (selectedOrder.hasLandlineBundle || selectedOrder.existingLandlineNumber) && (
            <p className="mt-1.5 border-t border-indigo-100 pt-1.5 text-[11px] font-semibold text-indigo-800">
              {selectedOrder.hasLandlineBundle
                ? 'Dial-Up Landline: Bundled PSTN Channel (+$15/mo)'
                : `Dial-Up Landline: Linked ${selectedOrder.existingLandlineNumber}`}
            </p>
          )}
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          SUBSCRIBER PREMISES
        </span>
        <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-1">
          <span className="block font-bold text-slate-900">{selectedOrder.customerName}</span>
          <span className="font-mono text-[11px] text-slate-400">Tax ID: {selectedOrder.taxId} &bull; {selectedOrder.customerType}</span>
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Contact: {selectedOrder.contactPerson}</span>
            <span className="font-mono text-indigo-700 font-bold">{selectedOrder.phone}</span>
          </div>
          <p className="text-[11px] text-slate-500">{selectedOrder.address}</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          SECURITY DEPOSIT &amp; RECEIPT (CN16)
        </span>
        <div className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-2 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
              <Banknote size={13} className="text-indigo-600" />
              <span>Deposit Status</span>
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                depositSummary.depositStatus === DEPOSIT_STATUS.COLLECTED
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : depositSummary.depositStatus === DEPOSIT_STATUS.WAIVED
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : depositSummary.depositStatus === DEPOSIT_STATUS.REFUNDED
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {depositSummary.statusLabel}
            </span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Net Deposit Due:</span>
            <span className="font-mono font-bold text-slate-900">
              ${depositSummary.expectedDepositDueUSD.toFixed(2)}
            </span>
          </div>

          {depositSummary.isCollectedOrWaived ? (
            <>
              <div className="flex justify-between text-slate-600">
                <span>Collection Method:</span>
                <span className="font-semibold text-slate-800">{depositSummary.methodLabel}</span>
              </div>
              {depositSummary.receiptNumber && (
                <div className="flex justify-between text-slate-600">
                  <span>Deposit Receipt No.:</span>
                  <span className="font-mono font-bold text-indigo-700">{depositSummary.receiptNumber}</span>
                </div>
              )}
              {depositSummary.collectedAt && (
                <div className="flex justify-between text-slate-500">
                  <span>Collected At:</span>
                  <span className="font-mono text-[10px]">{depositSummary.collectedAt}</span>
                </div>
              )}
              {depositSummary.referenceCode && (
                <div className="flex justify-between text-slate-500">
                  <span>Payment Ref:</span>
                  <span className="font-mono text-[10px]">{depositSummary.referenceCode}</span>
                </div>
              )}
            </>
          ) : (
            !isCancelled &&
            !isRefunded &&
            onCollectDeposit && (
              <button
                type="button"
                onClick={() => onCollectDeposit(selectedOrder)}
                className="mt-1 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600 transition cursor-pointer shadow-xs"
              >
                <Receipt size={13} />
                <span>Confirm Deposit Collection (${depositSummary.expectedDepositDueUSD.toFixed(2)})</span>
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          PROVISIONED HARDWARE
        </span>
        <div className="rounded-xl border border-slate-100 bg-white p-3 font-mono text-[11px] space-y-1">
          <div className="font-bold text-slate-800">{selectedOrder.allocatedDevice || 'Standard Customer Premise Equipment'}</div>
          <div className="text-slate-500">{selectedOrder.deviceSerial || 'Pending Serial Assignment'}</div>
          <div className="text-slate-500">{selectedOrder.deviceMac || 'Pending MAC Assignment'}</div>
        </div>
      </div>

      {attachedDocuments.length > 0 && (
        <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            ATTACHED VERIFICATION DOCUMENTS
          </span>
          <div className="space-y-2">
            {attachedDocuments.map(({ key, title, doc }) => {
              const status = docAvailability[key] || (doc.dataUrl ? 'ready' : 'checking')
              const isBusy = busyDocKey === key
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white p-2.5 text-[11px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-indigo-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{doc.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {title} &bull; {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : 'Attached'}
                      </div>
                    </div>
                  </div>
                  {status === 'ready' ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleDocumentAction(key, doc, openDocumentPreview, 'Unable to preview document.')
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                        title="Open file preview"
                      >
                        <ExternalLink size={11} />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleDocumentAction(key, doc, triggerDocumentDownload, 'Unable to download document.')
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer disabled:opacity-50"
                        title="Download file"
                      >
                        <Download size={11} />
                        <span>{isBusy ? 'Loading...' : 'Download'}</span>
                      </button>
                    </div>
                  ) : status === 'checking' ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 shrink-0">
                      Verifying...
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 shrink-0"
                      title="Document content is not available in IndexedDB/local storage."
                    >
                      <AlertTriangle size={10} />
                      <span>Missing in storage</span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {docActionError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-medium text-rose-700">
              {docActionError}
            </div>
          )}
        </div>
      )}

      {!isCancelled && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          {!isTerminal && (
            <button
              type="button"
              onClick={() => onDispatchFieldTech?.(selectedOrder)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-bold text-navy hover:bg-indigo-100 transition cursor-pointer shadow-xs"
            >
              <Wrench size={13} className="text-brand-soft" />
              <span>Dispatch Tech</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onPrintReceipt?.(selectedOrder)}
            className={`${
              isTerminal ? 'col-span-2' : ''
            } inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs`}
          >
            <Printer size={13} className="text-slate-500" />
            <span>
              {isRefunded
                ? 'Print Refund Receipt'
                : depositSummary.isCollectedOrWaived
                ? 'Print Deposit Receipt'
                : 'Print Order Summary'}
            </span>
          </button>
          {!isTerminal && isNotFeasible && onRefundOrder && (
            <button
              type="button"
              onClick={() => onRefundOrder(selectedOrder)}
              className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer shadow-xs"
            >
              <RefreshCw size={13} className="text-purple-600" />
              <span>Process 100% Deposit Refund (${getOrderRefundAmountUSD(selectedOrder).toFixed(2)})</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

