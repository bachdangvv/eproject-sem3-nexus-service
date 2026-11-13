import { DollarSign, ShieldCheck, Copy, Check, Send, Save, CircleAlert, AlertTriangle } from 'lucide-react'
import { STATUTORY_TAX_RATE_PERCENT } from '../../../services/taxConfig'

export default function OrderSummary({
  financialCalculations,
  generatedOrderId,
  bulkDiscountPercent,
  handleFinalSubmit,
  handleSaveDraft,
  copiedOrderId,
  handleCopyOrderId,
  canSubmit,
  canSaveDraft = false,
  isSubmitting = false,
  submitError = '',
  validationChecklist = [],
  onChecklistStepClick,
}) {
  const {
    monthlyBillingSubtotal,
    depositAmount,
    advancePaymentAmount,
    bulkDiscountAmount,
    telecomTax,
    netDepositAndAdvance,
    installationFee,
    grandTotal,
  } = financialCalculations

  return (
    <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
            ESTIMATED SETTLEMENT
          </span>
          <h3 className="text-base font-black text-slate-900 mt-0.5">Order Invoice Summary</h3>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
          <span className="font-mono text-xs font-bold text-indigo-600">{generatedOrderId}</span>
          <button
            type="button"
            onClick={handleCopyOrderId}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
            title="Copy Order ID"
          >
            {copiedOrderId ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Monthly Recurring Charge (MRC):</span>
          <span className="font-mono font-semibold text-slate-800">${monthlyBillingSubtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">{STATUTORY_TAX_RATE_PERCENT}% Statutory Telecom Tax:</span>
          <span className="font-mono font-semibold text-indigo-600">+${telecomTax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Initial Hardware Deposit:</span>
          <span className="font-mono font-semibold text-slate-800">${depositAmount.toFixed(2)}</span>
        </div>
        {advancePaymentAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">Advance Plan Payment:</span>
            <span className="font-mono font-semibold text-slate-800">${advancePaymentAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">One-time Installation Fee:</span>
          <span className="font-mono font-semibold text-slate-800">${installationFee.toFixed(2)}</span>
        </div>

        {bulkDiscountPercent > 0 && (
          <div className="flex justify-between text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-100">
            <span>Bulk Scheme ({bulkDiscountPercent}% on Deposit/Advance):</span>
            <span className="font-mono">-${bulkDiscountAmount.toFixed(2)}</span>
          </div>
        )}

        <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
          <span className="text-xs font-bold text-slate-900">Total First Payment:</span>
          <span className="text-xl font-black text-indigo-600 font-mono">${grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {validationChecklist.length > 0 && (
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Submission Requirements
          </div>
          {validationChecklist.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => item.stepNum && onChecklistStepClick?.(item.stepNum)}
              disabled={!item.stepNum || !onChecklistStepClick}
              className={`w-full text-left flex items-center gap-1.5 text-[11px] font-semibold ${
                item.done ? 'text-emerald-700' : 'text-slate-600 hover:text-indigo-700'
              } ${item.stepNum && onChecklistStepClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {item.done ? (
                <Check size={12} className="text-emerald-600 shrink-0" />
              ) : (
                <CircleAlert size={12} className="text-amber-500 shrink-0" />
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {submitError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-700 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-600" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          disabled={!canSubmit || isSubmitting}
          onClick={handleFinalSubmit}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
            canSubmit && !isSubmitting
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Send size={13} />
          <span>{isSubmitting ? 'Saving Files & Order...' : 'Create & Provision Order'}</span>
        </button>

        {handleSaveDraft && (
          <button
            type="button"
            disabled={!canSaveDraft || isSubmitting}
            onClick={handleSaveDraft}
            className={`w-full flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-bold transition ${
              canSaveDraft && !isSubmitting
                ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save size={13} />
            <span>{isSubmitting ? 'Saving...' : 'Save as Draft'}</span>
          </button>
        )}
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 space-y-1.5 text-[11px]">
        <div className="flex justify-between items-center text-slate-600">
          <span className="font-medium">Order ID (11-Char):</span>
          <span className="font-mono font-bold text-slate-900">{generatedOrderId}</span>
        </div>
        <div className="flex justify-between items-center text-slate-600">
          <span className="font-medium">16-Char Account ID:</span>
          <span className="font-mono text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
            Issued upon Technical Activation
          </span>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Order will route to Technical Survey &amp; ODN feasibility dispatch.
      </p>
    </div>
  )
}

