import { Link } from 'react-router-dom'
import TechnicalLayout from '../../components/layout/TechnicalLayout'
import AccountsLayout from '../../components/layout/AccountsLayout'
import AdminLayout from '../../components/layout/AdminLayout'
import ReviewPanel from './ReviewPanel'

const SCOPE_CONFIG = {
  lifecycle: {
    Layout: TechnicalLayout,
    navId: 'lifecycle',
    title: 'Account lifecycle & plan change',
    summary: 'Post-activation status changes and mid-cycle plan proration are outside the Review 1 backend API scope.',
    actions: [
      { to: '/technical/surveys', label: 'Go to ODN Surveys', primary: true },
      { to: '/technical/activations', label: 'Go to Connections' },
    ],
  },
  cdr: {
    Layout: AccountsLayout,
    navId: 'cdr',
    title: 'CDR & traffic metering',
    summary: 'Usage metering and CDR batch adjustments are outside the Review 1 backend API scope.',
    actions: [{ to: '/accounts/billing', label: 'Go to Billing & Payment', primary: true }],
  },
  debts: {
    Layout: AccountsLayout,
    navId: 'debts',
    title: 'Debt & arrears management',
    summary: 'Dunning and arrears enforcement are outside the Review 1 backend API scope.',
    actions: [{ to: '/accounts/billing', label: 'Go to Billing & Payment', primary: true }],
  },
  'tax-reports': {
    Layout: AccountsLayout,
    navId: 'tax-reports',
    title: 'Tax & scheme audit reports',
    summary: 'Tax ledger exports and scheme audits are outside the Review 1 backend API scope.',
    actions: [{ to: '/accounts/billing', label: 'Go to Billing & Payment', primary: true }],
  },
  tariffs: {
    Layout: AccountsLayout,
    navId: 'tariffs',
    title: 'Master tariff lookup',
    summary: 'Read-only tariff ledger lookup for billing is outside the Review 1 backend API scope.',
    actions: [{ to: '/accounts/billing', label: 'Go to Billing & Payment', primary: true }],
  },
  shops: {
    Layout: AdminLayout,
    navId: 'shops',
    title: 'Stores & vendors',
    summary: 'Retail shop and hardware vendor directories are outside the Review 1 backend API scope.',
    actions: [
      { to: '/admin/plans', label: 'Go to Plans & Products', primary: true },
      { to: '/admin/customers', label: 'Go to Customers' },
    ],
  },
  inventory: {
    Layout: AdminLayout,
    navId: 'inventory',
    title: 'Hardware & inventory',
    summary: 'Warehouse serial/MAC tracking is outside the Review 1 backend API scope.',
    actions: [
      { to: '/admin/plans', label: 'Go to Plans & Products', primary: true },
      { to: '/admin/users', label: 'Go to Access Control' },
    ],
  },
  schemes: {
    Layout: AdminLayout,
    navId: 'schemes',
    title: 'Bulk schemes audit',
    summary: 'Bulk deposit/advance scheme audits are outside the Review 1 backend API scope.',
    actions: [
      { to: '/admin/plans', label: 'Go to Plans & Products', primary: true },
      { to: '/admin/users', label: 'Go to Access Control' },
    ],
  },
}

/** Unified Review 1 panel for portal tabs whose backend APIs belong to later milestones. */
export default function ReviewScopePage({ scope }) {
  const config = SCOPE_CONFIG[scope] || SCOPE_CONFIG.lifecycle
  const { Layout, navId, title, summary, actions } = config

  return (
    <Layout activeNavId={navId} apiMode>
      <ReviewPanel title={title}>
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
          <p>{summary}</p>
          <p>
            In <strong className="text-navy">Review 1 API mode</strong>, local mock storage is disabled here so you do not see simulated browser data alongside live backend records.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {actions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={action.primary ? 'btn-primary' : 'btn-ghost'}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </ReviewPanel>
    </Layout>
  )
}

