import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgePercent, Send, LogIn, CircleCheck, Loader2 } from 'lucide-react'
import surveyService from '../../services/surveyService'

const PHONE_REGEX = /^0\d{9,10}$/

export default function PromoSurveyBar() {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSent(false)
    const clean = phone.replace(/[\s.-]/g, '')
    if (!PHONE_REGEX.test(clean)) {
      setError('Please enter a valid phone number (e.g. 0912345678).')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await surveyService.requestSurveyCallback(clean)
      setSent(true)
      setPhone('')
    } catch {
      setError('Failed to transmit callback request. Please dial 1800 8098 directly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="survey" className="mx-auto mt-10 grid max-w-[1680px] gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-[1fr_1.4fr_auto]">
      <div id="pricing-promo" className="card flex items-center justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Project Offer</span>
            <span className="font-semibold text-slate-700">Nationwide Backbone</span>
          </div>
          <div className="mt-2 text-base font-extrabold text-navy">
            Volume Discount: <span className="text-brand-accent">Up to 50% Off</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Complimentary enterprise GPON terminal installation</div>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-brand-accent">
          <BadgePercent size={20} />
        </span>
      </div>

      <form onSubmit={handleSubmit} className="card p-5" noValidate>
        <label htmlFor="survey-phone" className="text-xs font-bold text-navy flex items-center justify-between">
          <span>Technical Feasibility Survey</span>
          <span className="text-[10px] font-semibold text-brand-soft bg-indigo-50 px-2 py-0.5 rounded-full">15-Min Response</span>
        </label>
        <div className="mt-3 flex items-center gap-2">
          <input
            id="survey-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="Enter engineer / IT manager phone number..."
            className="input-base min-w-0 flex-1"
          />
          <button type="submit" disabled={submitting} className="btn-primary !min-h-[44px] !px-5">
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Transmitting...
              </>
            ) : (
              <>
                Submit <Send size={14} />
              </>
            )}
          </button>
        </div>
        <div className="mt-2 min-h-[16px] text-[11px]" aria-live="polite">
          {error && <span className="font-semibold text-red-600">{error}</span>}
          {sent && (
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <CircleCheck size={13} /> Request received. Our network engineer will call within 15 minutes.
            </span>
          )}
        </div>
      </form>

      <Link to="/login" className="btn-ghost self-stretch !rounded-2xl !px-6">
        <LogIn size={15} /> NOC Portal Login
      </Link>
    </section>
  )
}

