import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  Receipt,
  CreditCard,
  CheckCircle2,
  Clock,
  ChevronRight,
  RotateCw,
  ShieldCheck,
} from 'lucide-react'
import AccountsLayout from '../../components/layout/AccountsLayout'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import { useToast } from '../../hooks/useToast'
import { fetchBillingApi, saveBillingApi } from '../../services/review1Api'

const STATUS_BADGES = {
  NotBilled: {
    label: 'Not Billed',
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  Unpaid: {
    label: 'Unpaid',
    classes: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  Paid: {
    label: 'Paid',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
}

/** Enterprise Account Billing & Manual Payment Desk connected to Review 1 `/api/billing/accounts/*`. */
export default function Review1BillingDesk() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlAccountParam = (searchParams.get('accountId') || searchParams.get('q') || '').trim().toUpperCase()
  const [accountIdInput, setAccountIdInput] = useState(urlAccountParam)
  const [record, setRecord] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { toast, showToast } = useToast()

  async function lookupAccount(targetId) {
    const cleaned = String(targetId || '').trim().toUpperCase()
    if (!cleaned) return
    setBusy(true)
    setError('')
    setRecord(null)
    try {
      const data = await fetchBillingApi(cleaned)
      setRecord(data)
      setSearchParams({ accountId: cleaned }, { replace: true })
    } catch (err) {
      setError(err.response?.status === 404 ? `Connected account ${cleaned} was not found.` : err.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (urlAccountParam) {
      setAccountIdInput(urlAccountParam)
      lookupAccount(urlAccountParam)
    }
  }, [urlAccountParam])

  async function handleAction(payment) {
    if (!record || busy) return
    setBusy(true)
    setError('')
    try {
      const updated = await saveBillingApi(record.accountId, payment)
      setRecord(updated)
      showToast(
        payment
          ? `Recorded full manual payment ($${Number(updated.amount).toFixed(2)}) for ${updated.accountId}.`
          : `Created billing record ($${Number(updated.amount).toFixed(2)}) for ${updated.accountId}.`
      )
    } catch (err) {
      const msg = err?.message || 'Unable to update billing record.'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  const statusMeta = STATUS_BADGES[record?.status] || STATUS_BADGES.NotBilled

  return (
    <AccountsLayout activeNavId="invoices" apiMode toast={toast}>
      <div className="card p-5 md:p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Finance &amp; Revenue</span>
              <ChevronRight size={12} />
              <span>Postpaid Billing Management</span>
              <ChevronRight size={12} />
              <span className="font-bold text-navy">Review 1 Account Billing</span>
            </div>
            <h1 className="mt-1.5 text-xl font-extrabold text-navy md:text-2xl">
              Account Billing &amp; Manual Payment Settlement
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Look up a connected 16-character Account ID, issue the billing record from the subscribed plan price, and record full manual settlement.
            </p>
          </div>

          {record && (
            <button
              type="button"
              disabled={busy}
              onClick={() => lookupAccount(record.accountId)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <RotateCw size={13} /> Refresh Account
            </button>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            lookupAccount(accountIdInput)
          }}
          className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[260px]">
            <label htmlFor="billing-account-id" className="block text-xs font-bold text-slate-700 mb-1">
              Connected Account ID (16-Char: B/D/T + 15 digits)
            </label>
            <div className="relative">
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                id="billing-account-id"
                type="text"
                required
                maxLength={16}
                pattern="[BbDdTt][0-9]{15}"
                disabled={busy}
                value={accountIdInput}
                onChange={(e) => setAccountIdInput(e.target.value.toUpperCase())}
                placeholder="e.g. B101000000000001"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3 pl-9 font-mono text-xs font-bold text-slate-900 outline-none focus:border-indigo-600"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary !min-h-[40px] !px-5 !py-2 !text-xs font-bold"
          >
            <Search size={14} />
            <span>{busy ? 'Looking up...' : 'Find Account'}</span>
          </button>
        </form>

        {error && (
          <AsyncStatePanel
            compact
            state="error"
            title="Account Billing Lookup Error"
            description={error}
            actionLabel="Dismiss"
            onAction={() => setError('')}
          />
        )}

        {!record && !error && !busy && (
          <AsyncStatePanel
            state="empty"
            icon={Receipt}
            title="Enter a Connected Account ID"
            description="Paste the 16-character Account ID issued by Technical Commissioning (e.g. B101000000000001) to view or create its billing record."
          />
        )}

        {record && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Subscriber Account ID
                </div>
                <div className="mt-1 font-mono text-lg font-black text-indigo-700">{record.accountId}</div>
                <div className="mt-1 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 truncate">
                  Customer: <strong className="text-slate-700">{record.customerName}</strong>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Linked Order Reference
                </div>
                <div className="mt-1 font-mono text-lg font-black text-navy">{record.orderId}</div>
                <div className="mt-1 text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                  Plan: <strong className="text-slate-700">{record.planName}</strong>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Billing Status
                </div>
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${statusMeta.classes}`}>
                    {record.status === 'Paid' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    <span>{statusMeta.label}</span>
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  {record.paidAt ? `Paid at ${new Date(record.paidAt).toLocaleString()}` : 'Awaiting settlement'}
                </div>
              </div>

              <div className="rounded-2xl bg-navy p-4 text-white shadow-lg shadow-navy/20">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Plan Charge Amount
                  </span>
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-black text-indigo-200">
                    USD
                  </span>
                </div>
                <div className="mt-1 font-mono text-2xl font-black text-white">
                  ${Number(record.amount).toFixed(2)} USD
                </div>
                <div className="mt-1 text-[11px] text-slate-300 border-t border-white/10 pt-1.5">
                  Full manual settlement cycle
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-extrabold text-navy">
                  <ShieldCheck size={16} className="text-indigo-600" />
                  <span>Billing &amp; Payment Lifecycle Actions</span>
                </div>
                <p className="text-xs text-slate-500">
                  Workflow: <strong>Not Billed</strong> &rarr; <strong>Create Billing Record (Unpaid)</strong> &rarr; <strong>Record Full Manual Payment (Paid)</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {record.status === 'NotBilled' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAction(false)}
                    className="btn-primary !min-h-[42px] !px-5 !py-2 !text-xs font-bold"
                  >
                    <Receipt size={14} />
                    <span>{busy ? 'Creating...' : 'Create Billing Record'}</span>
                  </button>
                )}

                {record.status === 'Unpaid' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAction(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                  >
                    <CreditCard size={14} />
                    <span>{busy ? 'Recording Payment...' : 'Record Full Manual Payment'}</span>
                  </button>
                )}

                {record.status === 'Paid' && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 size={15} />
                    <span>Settled in Full ({new Date(record.paidAt).toLocaleString()})</span>
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AccountsLayout>
  )
}

