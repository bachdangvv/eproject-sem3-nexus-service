import { Link } from 'react-router-dom'
import { ChevronRight, Layers } from 'lucide-react'
import TechnicalLayout from '../../components/layout/TechnicalLayout'
import AccountsLayout from '../../components/layout/AccountsLayout'
import AdminLayout from '../../components/layout/AdminLayout'
import RetailLayout from '../../components/layout/RetailLayout'

const SCOPE_CONFIG = {
  quotes: {
    Layout: RetailLayout,
    navId: 'quotes',
    section: 'Retail Sales',
    title: 'Corporate Quotation Desk',
    summary: 'Formal B2B multi-site quotation generation belongs to later backend milestones beyond Review 1.',
    actions: [
      { to: '/retail/orders/new', label: 'Create New Subscription', primary: true },
      { to: '/retail/orders', label: 'Open Orders Ledger' },
    ],
  },
  pos: {
    Layout: RetailLayout,
    navId: 'pos',
    section: 'Retail Sales',
    title: 'Retail Counter Terminal',
    summary: 'POS drawer reconciliation and counter slip hardware belong to later backend milestones beyond Review 1.',
    actions: [
      { to: '/retail/customers', label: 'Open Customers Directory', primary: true },
      { to: '/retail/orders', label: 'Open Orders Ledger' },
    ],
  },
  lifecycle: {
    Layout: TechnicalLayout,
    navId: 'lifecycle',
    section: 'NOC Operations',
    title: 'Account Lifecycle & Plan Change',
    summary: 'Post-activation connection status transitions and mid-cycle plan proration belong to later backend milestones beyond Review 1.',
    actions: [
      { to: '/technical/surveys', label: 'Open ODN Feasibility Surveys', primary: true },
      { to: '/technical/activations', label: 'Open Circuit Activation' },
    ],
  },
  map: {
    Layout: TechnicalLayout,
    navId: 'map',
    section: 'NOC Operations',
    title: 'ODN Fiber Topology Map',
    summary: 'Interactive outside-plant GIS fiber routing and splitter port mapping belong to later backend milestones beyond Review 1.',
    actions: [
      { to: '/technical/surveys', label: 'Open ODN Feasibility Surveys', primary: true },
      { to: '/technical/activations', label: 'Open Circuit Activation' },
    ],
  },
  diagnostics: {
    Layout: TechnicalLayout,
    navId: 'diagnostics',
    section: 'NOC Operations',
    title: 'Optical Power Diagnostics',
    summary: 'Real-time OLT telemetry polling and Rx attenuation graphs belong to later backend milestones beyond Review 1.',
    actions: [
      { to: '/technical/activations', label: 'Open Circuit Activation', primary: true },
      { to: '/technical/surveys', label: 'Open ODN Feasibility Surveys' },
    ],
  },
  'overview-accounts': {
    Layout: AccountsLayout,
    navId: 'overview',
    section: 'Finance & Revenue',
    title: 'Billing Overview',
    summary: 'Executive billing analytics and aging dashboards belong to later backend milestones beyond Review 1.',
    actions: [{ to: '/accounts/billing', label: 'Open Billing & Payment', primary: true }],
  },
  'overview-admin': {
    Layout: AdminLayout,
    navId: 'overview',
    section: 'Carrier Administration',
    title: 'Network Overview',
    summary: 'Cross-city network capacity dashboards belong to later backend milestones beyond Review 1.',
    actions: [
      { to: '/admin/plans', label: 'Open Plans, Products & Cities', primary: true },
      { to: '/admin/customers', label: 'Open Customers Directory' },
    ],
  },
  cdr: {
    Layout: AccountsLayout,
    navId: 'cdr',
    section: 'Finance & Revenue',
    title: 'CDR & Traffic Metering',
    summary: 'Usage metering and CDR batch invoice adjustments belong to later backend milestones beyond Review 1.',
    actions: [{ to: '/accounts/billing', label: 'Open Billing & Payment', primary: true }],
  },
  debts: {
    Layout: AccountsLayout,
    navId: 'debts',
    section: 'Finance & Revenue',
    title: 'Debt & Arrears Management',
    summary: 'Dunning and arrears enforcement belong to later backend milestones beyond Review 1.',
    actions: [{ to: '/accounts/billing', label: 'Open Billing & Payment', primary: true }],
  },
  'tax-reports': {
    Layout: AccountsLayout,
    navId: 'tax-reports',
    section: 'Finance & Revenue',
    title: 'Tax & Scheme Audit Reports',
    summary: 'Tax ledger exports and scheme audits belong to later backend milestones beyond Review 1.',
    actions: [{ to: '/accounts/billing', label: 'Open Billing & Payment', primary: true }],
  },
  tariffs: {
    Layout: AccountsLayout,
    navId: 'tariffs',
    section: 'Finance & Revenue',
    title: 'Master Tariff Lookup',
    summary: 'Read-only tariff ledger lookup for billing belongs to later backend milestones beyond Review 1.',
    actions: [{ to: '/accounts/billing', label: 'Open Billing & Payment', primary: true }],
  },
  shops: {
    Layout: AdminLayout,
    navId: 'shops',
    section: 'Carrier Administration',
    title: 'Stores & Vendors',
    summary: 'Retail shop and hardware vendor directories belong to later backend milestones beyond Review 1.',
    actions: [
      { to: '/admin/plans', label: 'Open Plans & Products', primary: true },
      { to: '/admin/customers', label: 'Open Customers Directory' },
    ],
  },
  inventory: {
    Layout: AdminLayout,
    navId: 'inventory',
    section: 'Carrier Administration',
    title: 'Hardware & Inventory',
    summary: 'Warehouse serial/MAC inventory tracking belongs to later backend milestones beyond Review 1.',
    actions: [
      { to: '/admin/plans', label: 'Open Plans & Products', primary: true },
      { to: '/admin/users', label: 'Open Access Control' },
    ],
  },
  schemes: {
    Layout: AdminLayout,
    navId: 'schemes',
    section: 'Carrier Administration',
    title: 'Bulk Schemes Audit',
    summary: 'Bulk deposit and advance scheme audits belong to later backend milestones beyond Review 1.',
    actions: [
      { to: '/admin/plans', label: 'Open Plans & Products', primary: true },
      { to: '/admin/users', label: 'Open Access Control' },
    ],
  },
}

/** Unified enterprise panel for portal tabs whose backend APIs belong to later milestones. */
export default function ReviewScopePage({ scope }) {
  const config = SCOPE_CONFIG[scope] || SCOPE_CONFIG.lifecycle
  const { Layout, navId, section, title, summary, actions } = config

  return (
    <Layout activeNavId={navId} apiMode>
      <div className="card p-5 md:p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>{section}</span>
              <ChevronRight size={12} />
              <span className="font-bold text-navy">{title}</span>
            </div>
            <h1 className="mt-1.5 text-xl font-extrabold text-navy md:text-2xl">{title}</h1>
          </div>
          <span className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
            Scheduled Post-Review 1
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Layers size={18} />
            </div>
            <div className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
              <div className="text-sm font-bold text-slate-900">Module Reserved for Next Backend Milestone</div>
              <p>{summary}</p>
              <p>
                Local browser mock data is disabled while <strong className="text-navy">Review 1 API Mode</strong> is active so simulated records do not mix with live database records.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {actions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={action.primary ? 'btn-primary !min-h-[40px] !px-5 !py-2 !text-xs font-bold' : 'btn-ghost !min-h-[40px] !px-4 !py-2 !text-xs font-bold'}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
