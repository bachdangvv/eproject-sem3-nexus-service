import { useState, useRef, useEffect } from 'react'
import { copyToClipboard } from '../../utils/clipboard'
import {
  Search,
  Hash,
  CircleCheck,
  CircleAlert,
  Loader2,
  X,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { trackById, getStatusLabel } from '../../services/trackingService'

const SAMPLES = [
  { label: 'Sample Dial-Up Order', id: 'D0000000001' },
  { label: 'Sample Broadband Order', id: 'B0000000001' },
  { label: 'Sample Active Account', id: 'B001000000000001' },
]

const TONE = {
  green: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
  amber: 'bg-amber-50 text-amber-700 border border-amber-200/60',
  red: 'bg-red-50 text-red-700 border border-red-200/60',
  slate: 'bg-slate-100 text-slate-700 border border-slate-200/80',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200/60',
  blue: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60',
}

export default function TrackingWidget() {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  async function handleSearch(searchId) {
    const target = searchId || value
    if (!target.trim() || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      setResult(await trackById(target))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    handleSearch()
  }

  function handleSelectSample(id) {
    setValue(id)
    handleSearch(id)
  }

  async function handleCopy() {
    if (!result?.id) return
    await copyToClipboard(result.id)
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  const status = result ? getStatusLabel(result.status) : null

  return (
    <div id="tracking" className="card p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-navy">
            <Search size={16} className="text-brand-accent" /> Track Order &amp; Account
          </h2>
          <span className="rounded-full bg-slate-100/80 px-3 py-1 text-[11px] font-bold text-slate-600 border border-slate-200/50">
            Public Lookup
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Enter 11-char Order ID or 16-char Account ID to check the 5-stage provisioning timeline. Subscriber names and street routes are masked for public privacy.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 pl-3.5 focus-within:border-brand-soft focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <Hash size={16} className="text-slate-400 shrink-0" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. B0000000001"
            aria-label="Order ID or Account ID"
            className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase outline-none text-slate-900 placeholder:normal-case placeholder:text-slate-400"
          />
          {value && (
            <button
              type="button"
              onClick={() => setValue('')}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
              aria-label="Clear input"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="btn-primary !min-h-[38px] !px-4 !py-1.5 !text-xs !rounded-xl"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span className="text-[11px] font-semibold text-slate-400">Quick samples:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectSample(s.id)}
              className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-2.5 py-1 text-[11px] font-bold text-brand-accent transition hover:bg-indigo-100 hover:border-indigo-200 cursor-pointer active:scale-95"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 min-h-[72px]" aria-live="polite">
        {error && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200/60">
            <CircleAlert size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {result && status && (
          <div className="rounded-2xl bg-slate-50/90 p-4 border border-slate-200/80 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-online border border-emerald-200/60 shrink-0">
                  <CircleCheck size={18} />
                </span>
                <div className="text-xs min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-800">
                    <span>Subscriber: {result.maskedCustomer}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      <ShieldCheck size={10} className="text-indigo-600" /> Masked
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-slate-600">
                    Region: {result.maskedRoute}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                    <span>{result.type === 'order' ? 'Order' : 'Account'} {result.id}</span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="text-slate-400 hover:text-brand-accent transition p-0.5 cursor-pointer"
                      title="Copy ID"
                    >
                      {copied ? <Check size={12} className="text-online" /> : <Copy size={12} />}
                    </button>
                    {result.serviceLabel && <span>&bull; {result.serviceLabel}</span>}
                    {result.bandwidth && <span>&bull; {result.bandwidth}</span>}
                    {result.type === 'order' && result.accountId && /^[DBT]\d{15}$/.test(result.accountId) && (
                      <span>&bull; Account {result.accountId}</span>
                    )}
                    {result.type === 'account' && result.orderId && (
                      <span>&bull; Order {result.orderId}</span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-wide shrink-0 ${TONE[status.tone] || TONE.blue}`}>
                {status.text}
              </span>
            </div>

            {result.timeline?.stages && (
              <div className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-extrabold uppercase tracking-wider text-slate-700">
                    5-Stage Provisioning Timeline
                  </span>
                  <span className={`font-semibold ${
                    result.timeline.isFailed
                      ? 'text-rose-600'
                      : result.timeline.isHalted
                        ? 'text-slate-600'
                        : 'text-indigo-700'
                  }`}>
                    {result.timeline.summaryLabel}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {result.timeline.stages.map((stage) => {
                    const isDone = stage.state === 'done'
                    const isActive = stage.state === 'active'
                    const isFailed = stage.state === 'failed'
                    const isWarning = stage.state === 'warning'
                    const isHalted = stage.state === 'halted'

                    const cardClass = isDone
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                      : isActive
                        ? 'border-indigo-300 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-200'
                        : isFailed
                          ? 'border-rose-200 bg-rose-50/70 text-rose-900'
                          : isWarning
                            ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                            : 'border-slate-200/80 bg-slate-50/60 text-slate-500'

                    const badgeClass = isDone
                      ? 'bg-emerald-600 text-white'
                      : isActive
                        ? 'bg-indigo-600 text-white'
                        : isFailed
                          ? 'bg-rose-600 text-white'
                          : isWarning
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 text-slate-600'

                    const stateText = isDone
                      ? 'Done'
                      : isActive
                        ? 'Current'
                        : isFailed
                          ? 'Halted'
                          : isWarning
                            ? 'Attention'
                            : isHalted
                              ? 'Stopped'
                              : 'Pending'

                    return (
                      <div
                        key={stage.key}
                        title={stage.title}
                        className={`rounded-lg border p-2 text-[11px] flex sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-1.5 ${cardClass}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${badgeClass}`}>
                            {isDone ? (
                              <Check size={11} />
                            ) : isFailed ? (
                              <X size={11} />
                            ) : isWarning ? (
                              <AlertTriangle size={11} />
                            ) : (
                              stage.step
                            )}
                          </span>
                          <span className="font-bold leading-tight">{stage.shortLabel}</span>
                        </div>
                        <span className="text-[10px] font-semibold opacity-80">{stateText}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="text-[10px] text-slate-400">
                  Privacy notice: full customer names, street addresses, ODN nodes, and CPE serials are hidden in public lookup.
                </div>
              </div>
            )}
          </div>
        )}
        {!result && !error && !loading && (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400 flex items-center justify-center">
            Search results with current circuit status will display here.
          </div>
        )}
      </div>
    </div>
  )
}
