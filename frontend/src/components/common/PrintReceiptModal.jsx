import { Printer, X, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react'

export default function PrintReceiptModal({ receiptData, onClose }) {
  if (!receiptData) return null

  const receiptType = String(receiptData.receiptType || 'PAYMENT').trim().toUpperCase()
  const isDepositReceipt = receiptType === 'DEPOSIT'
  const isRefundReceipt = receiptType === 'REFUND'
  const receiptNumber =
    receiptData.receiptNumber ||
    `${isRefundReceipt ? 'REF' : isDepositReceipt ? 'DEP' : 'REC'}-${Date.now().toString().slice(-6)}`
  const date = receiptData.date || new Date().toLocaleDateString('en-GB')
  const amount =
    receiptData.amount != null && !Number.isNaN(Number(receiptData.amount))
      ? Number(receiptData.amount)
      : 3388.25
  const isWaived = isDepositReceipt && (String(receiptData.depositStatus || '').toUpperCase() === 'WAIVED' || amount <= 0)

  const documentTitle = isRefundReceipt
    ? '100% SECURITY DEPOSIT REFUND VOUCHER (CN16)'
    : isDepositReceipt
    ? 'SECURITY DEPOSIT COLLECTION RECEIPT (CN16)'
    : 'TELECOM SERVICE PAYMENT RECEIPT'

  const documentSubtitle = isRefundReceipt
    ? 'SURVEY NOT FEASIBLE • DEPOSIT REFUND CONFIRMATION (DEMO LEDGER)'
    : isDepositReceipt
    ? 'RETAIL STOREFRONT DEPOSIT & ADVANCE CONFIRMATION (DEMO LEDGER)'
    : 'CUSTOMER PAYMENT CONFIRMATION COPY'

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7 space-y-5 my-8 print:border-none print:shadow-none print:m-0 print:p-0">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-navy">
              {isRefundReceipt
                ? 'Printable Deposit Refund Voucher'
                : isDepositReceipt
                ? 'Printable CN16 Deposit Receipt'
                : 'Printable Payment Receipt'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable Area */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 space-y-4 text-xs text-slate-700 print:bg-white print:border-slate-400">
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <div className="font-black text-sm text-navy uppercase tracking-tight">NEXUS TELECOM CORP</div>
              <div className="text-[10px] text-slate-500">54 Lieu Giai, Ba Dinh, Hanoi &bull; Hotline: 1800-8098</div>
              <div className="text-[10px] text-slate-500">Tax ID: 0102345678 &bull; Carrier License: 198/GP-BTTTT</div>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-indigo-700 text-sm">{receiptNumber}</span>
              <div className="text-[10px] text-slate-500">Date: {date}</div>
              {receiptData.branchName && (
                <div className="text-[10px] text-slate-500">{receiptData.branchName}</div>
              )}
            </div>
          </div>

          <div className="text-center py-1">
            <h2 className="text-sm font-black uppercase text-navy tracking-wider">
              {documentTitle}
            </h2>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              {documentSubtitle}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs border-y border-slate-200 py-3">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer / Client</span>
              <strong className="text-slate-900">{receiptData.customerName || 'AlphaCorp Technology Solutions JSC'}</strong>
              <div className="text-slate-500">MST: {receiptData.taxId || '0108881948'}</div>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Account / Contract Ref</span>
              <strong className="font-mono text-indigo-700">{receiptData.accountId || 'Issued upon commissioning'}</strong>
              <div className="text-slate-500">Order: {receiptData.orderId || 'B0000001089'}</div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between gap-4">
              <span>Service Plan:</span>
              <strong className="text-slate-900 text-right">{receiptData.serviceTitle || 'FTTH Dedicated 500Mbps Metro Core'}</strong>
            </div>

            {isDepositReceipt || isRefundReceipt ? (
              <>
                {receiptData.grossDepositUSD != null && (
                  <div className="flex justify-between">
                    <span>Gross Security Deposit:</span>
                    <span className="font-mono">${Number(receiptData.grossDepositUSD).toFixed(2)}</span>
                  </div>
                )}
                {Number(receiptData.advancePaymentUSD || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Advance Plan Payment:</span>
                    <span className="font-mono">${Number(receiptData.advancePaymentUSD).toFixed(2)}</span>
                  </div>
                )}
                {Number(receiptData.bulkDiscountUSD || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Bulk Deposit Waiver Applied:</span>
                    <span className="font-mono">-${Number(receiptData.bulkDiscountUSD).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{isRefundReceipt ? 'Refund Channel:' : 'Collection Method:'}</span>
                  <span className="font-semibold text-slate-800">
                    {receiptData.paymentMethod || 'Retail Counter Settlement'}
                  </span>
                </div>
                {receiptData.referenceCode && (
                  <div className="flex justify-between">
                    <span>Transaction / Voucher Ref:</span>
                    <span className="font-mono text-slate-800">{receiptData.referenceCode}</span>
                  </div>
                )}
                {receiptData.collectorName && (
                  <div className="flex justify-between">
                    <span>Handled By:</span>
                    <span className="text-slate-800">{receiptData.collectorName}</span>
                  </div>
                )}
                {isRefundReceipt && receiptData.originalDepositReceiptNumber && (
                  <div className="flex justify-between">
                    <span>Original Deposit Receipt:</span>
                    <span className="font-mono text-slate-800">{receiptData.originalDepositReceiptNumber}</span>
                  </div>
                )}
                {isRefundReceipt && receiptData.refundReason && (
                  <div className="flex justify-between gap-4">
                    <span>Refund Basis:</span>
                    <span className="text-right text-slate-800">{receiptData.refundReason}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-sm text-navy">
                  <span>
                    {isRefundReceipt
                      ? 'TOTAL REFUNDED (100%):'
                      : isWaived
                      ? 'NET DEPOSIT DUE (WAIVED):'
                      : 'TOTAL DEPOSIT COLLECTED:'}
                  </span>
                  <span className={`font-mono ${isRefundReceipt ? 'text-purple-700' : 'text-emerald-700'}`}>
                    ${amount.toFixed(2)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span>Billing Cycle:</span>
                  <span>{receiptData.billingCycle || 'Monthly Billing Cycle'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Channel:</span>
                  <span className="font-medium text-slate-800">{receiptData.paymentMethod || 'Counter Cash Desk'}</span>
                </div>
                {receiptData.collectorName && (
                  <div className="flex justify-between">
                    <span>Cashier / Processed By:</span>
                    <span className="text-slate-800">{receiptData.collectorName}</span>
                  </div>
                )}
                {receiptData.note && (
                  <div className="flex justify-between gap-4">
                    <span>Payment Reference / Note:</span>
                    <span className="text-right text-slate-700">{receiptData.note}</span>
                  </div>
                )}

                {Array.isArray(receiptData.allocations) && receiptData.allocations.length > 0 && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white/90 p-2.5">
                    <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      FIFO Invoice Allocation Breakdown (Oldest-First)
                    </div>
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] text-slate-500">
                          <th className="py-1 text-left">#</th>
                          <th className="py-1 text-left">Invoice ID</th>
                          <th className="py-1 text-left">Issued</th>
                          <th className="py-1 text-right">Allocated</th>
                          <th className="py-1 text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receiptData.allocations.map((alloc) => (
                          <tr key={alloc.invoiceId}>
                            <td className="py-1 font-mono text-slate-500">{alloc.fifoOrder}</td>
                            <td className="py-1 font-mono font-bold text-slate-800">{alloc.invoiceId}</td>
                            <td className="py-1 font-mono text-slate-500">{alloc.issuedDate || '-'}</td>
                            <td className="py-1 text-right font-mono font-bold text-emerald-700">
                              ${Number(alloc.allocatedAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-1 text-right font-mono text-slate-600">
                              ${Number(alloc.remainingAfter || 0).toFixed(2)} ({alloc.status || alloc.resultingStatus})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-between border-t border-slate-200 pt-2 font-black text-sm text-navy">
                  <span>TOTAL SETTLED AMOUNT:</span>
                  <span className="font-mono text-emerald-700">${amount.toFixed(2)}</span>
                </div>
                {receiptData.remainingAccountBalance !== undefined && (
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Remaining Account Balance After Settlement:</span>
                    <span className="font-mono font-bold text-slate-900">
                      ${Number(receiptData.remainingAccountBalance || 0).toFixed(2)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <div
            className={`mt-4 rounded-xl border p-3 flex items-center justify-between ${
              isRefundReceipt
                ? 'border-purple-200 bg-purple-50/80 text-purple-900'
                : 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {isRefundReceipt ? (
                <RefreshCw size={16} className="text-purple-600" />
              ) : (
                <ShieldCheck size={16} className="text-emerald-600" />
              )}
              <div>
                <div className="font-bold text-[11px]">
                  {isRefundReceipt
                    ? '100% SECURITY DEPOSIT REFUND RECORDED (DEMO LEDGER)'
                    : isWaived
                    ? '100% BULK DEPOSIT WAIVER CONFIRMED (DEMO LEDGER)'
                    : isDepositReceipt
                    ? 'SECURITY DEPOSIT RECEIPT RECORDED (DEMO LEDGER)'
                    : 'PAYMENT RECEIPT RECORDED (DEMO LEDGER)'}
                </div>
                <div className={`text-[9px] ${isRefundReceipt ? 'text-purple-700' : 'text-emerald-700'}`}>
                  {isDepositReceipt || isRefundReceipt
                    ? 'CN16 refundable upon unfeasible ODN survey; local retail demo record pending ERP accounting sync.'
                    : 'Statutory 12.24% telecom tax calculation applied in local billing state.'}
                </div>
              </div>
            </div>
            <div
              className={`flex items-center gap-1 font-mono text-[10px] font-bold ${
                isRefundReceipt ? 'text-purple-700' : 'text-emerald-700'
              }`}
            >
              <CheckCircle2 size={12} />{' '}
              {isRefundReceipt
                ? 'REFUNDED'
                : isWaived
                ? 'WAIVED'
                : isDepositReceipt
                ? 'COLLECTED'
                : 'PAID'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer shadow-md shadow-indigo-500/20"
          >
            <Printer size={14} />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  )
}
