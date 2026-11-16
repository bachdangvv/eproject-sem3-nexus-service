import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, HelpCircle, X, Compass } from 'lucide-react'

const PORTAL_META = {
  admin: {
    placeholder: 'Search customers or jump to directory...',
    defaultRoute: '/admin/customers',
    badgeCount: 1,
    statusTitle: 'Admin Catalog & RBAC Session',
    statusNote: 'Connected to Review 1 catalog, customer, and staff endpoints. Real-time system alert streams are deferred post-Review 1.',
    guideTitle: 'Review 1 Admin Checklist',
    guideItems: [
      'Plans & Tariffs: check BB Basic ($225 USD) and create/edit plans with Description.',
      'Hardware & Product Catalog: add or edit products (e.g. Review 1 Router).',
      'Service Cities: inspect City 101 or add 3-digit metro city codes for Account IDs.',
      'Access Control: inspect or create Admin, Retail, Technical, and Billing staff.',
    ],
  },
  retail: {
    placeholder: 'Find Order ID (B...) or Customer (CUS-)...',
    defaultRoute: '/retail/orders',
    badgeCount: 2,
    statusTitle: 'Retail Sales & Order Desk',
    statusNote: 'Connected to Review 1 customers, requests, orders, and feedback APIs. Push notifications are deferred post-Review 1.',
    guideTitle: 'Review 1 Retail Checklist',
    guideItems: [
      'Customers: create new subscriber profile and search by returned Customer ID.',
      'Create New Subscription: Save request -> Confirm request to generate 11-char Order ID.',
      'Orders Ledger: track status transitions and submit 1-5 star feedback once Connected.',
    ],
  },
  technical: {
    placeholder: 'Filter Order ID in Survey / Activation...',
    defaultRoute: '/technical/surveys',
    badgeCount: 3,
    statusTitle: 'Technical ODN & Provisioning NOC',
    statusNote: 'Connected to Review 1 assessment and connection endpoints. Automated OLT alarm feeds are deferred post-Review 1.',
    guideTitle: 'Review 1 Technical Checklist',
    guideItems: [
      'ODN Feasibility Surveys: confirm Distance within limit & Server available (plus Landline check on Dial-up).',
      'Rejection flow: uncheck prerequisite, enter note, and verify Not Feasible stays out of Activation.',
      'Circuit Activation: commission Feasible orders to issue the 16-char Account ID.',
    ],
  },
  accounts: {
    placeholder: 'Lookup 16-char Account ID...',
    defaultRoute: '/accounts/billing',
    badgeCount: 2,
    statusTitle: 'Accounts & Billing Desk',
    statusNote: 'Connected to Review 1 billing account and manual full-payment endpoints. Recurring CDR & PDF VAT are deferred post-Review 1.',
    guideTitle: 'Review 1 Billing Checklist',
    guideItems: [
      'Paste the 16-character Account ID issued by Technical.',
      'Click Find account, then Create billing record (Plan.Price, e.g. $225 USD).',
      'Click Record full manual payment to transition Unpaid -> Paid and verify after reload.',
    ],
  },
}

/**
 * Shared portal topbar quick-search, session status popover, and Review 1 guide help menu.
 */
export default function PortalTopbarActions({
  portal = 'retail',
  isApiMode = true,
  defaultSearchValue = '',
}) {
  const navigate = useNavigate()
  const meta = PORTAL_META[portal] || PORTAL_META.retail
  const [query, setQuery] = useState(defaultSearchValue)
  const [openMenu, setOpenMenu] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleOutsideClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  function handleSearchSubmit(e) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) {
      navigate(meta.defaultRoute)
      return
    }
    if (portal === 'accounts') {
      navigate(`/accounts/billing?accountId=${encodeURIComponent(trimmed.toUpperCase())}`)
      return
    }
    if (portal === 'retail' && trimmed.toUpperCase().startsWith('CUS-')) {
      navigate(`/retail/customers?q=${encodeURIComponent(trimmed)}`)
      return
    }
    navigate(`${meta.defaultRoute}?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-3">
      <form onSubmit={handleSearchSubmit} className="relative hidden md:block w-72">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={meta.placeholder}
          aria-label="Portal Quick Search"
          className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-1.5 pr-8 pl-8 text-xs text-slate-700 outline-none transition focus:border-brand-soft focus:bg-white"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </form>

      <div className="flex items-center gap-1.5">
        {portal !== 'accounts' && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-black text-slate-700">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            {portal === 'admin'
              ? (isApiMode ? 'API SESSION' : 'DEMO ENV')
              : portal === 'retail'
              ? (isApiMode ? 'RETAIL API' : 'POS DEMO')
              : (isApiMode ? 'NOC API' : 'SIMULATED OLT')}
          </span>
        )}

        <button
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === 'status' ? null : 'status'))}
          aria-expanded={openMenu === 'status'}
          className={`relative flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
            openMenu === 'status'
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          aria-label="Environment & Notifications"
          title="Environment Status"
        >
          <Bell size={14} />
          {!isApiMode && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
              {meta.badgeCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === 'help' ? null : 'help'))}
          aria-expanded={openMenu === 'help'}
          className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer ${
            openMenu === 'help'
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          aria-label="Portal Guide"
          title="Review 1 Portal Checklist"
        >
          <HelpCircle size={14} />
        </button>
      </div>

      {openMenu === 'status' && (
        <div className="absolute top-11 right-0 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-extrabold text-navy">{meta.statusTitle}</span>
            <button
              type="button"
              onClick={() => setOpenMenu(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Close status popover"
            >
              <X size={14} />
            </button>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-800 border border-sky-200">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            {isApiMode ? 'Mode: Review 1 Backend API' : 'Mode: Local Demo Sandbox'}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">{meta.statusNote}</p>
        </div>
      )}

      {openMenu === 'help' && (
        <div className="absolute top-11 right-0 z-50 w-88 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <Compass size={14} className="text-indigo-600" />
              <span className="text-xs font-extrabold text-navy">{meta.guideTitle}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpenMenu(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Close help popover"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-600 list-disc pl-4">
            {meta.guideItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

