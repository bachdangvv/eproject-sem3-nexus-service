import { Receipt, Activity, ShieldAlert, FileSpreadsheet, Scale } from 'lucide-react'

export const ACCOUNTS_NAV_ITEMS = [
  { id: 'invoices', label: 'Invoices & Billing', icon: Receipt, path: '/accounts/billing' },
  { id: 'cdr', label: 'CDR & Traffic', icon: Activity, path: '/accounts/cdr' },
  { id: 'debts', label: 'Debt & Dunning', icon: ShieldAlert, path: '/accounts/debts' },
  { id: 'tax-reports', label: 'Tax & Scheme Audit', icon: FileSpreadsheet, path: '/accounts/tax-reports' },
  { id: 'tariffs', label: 'Tariff Lookup', icon: Scale, path: '/accounts/tariffs' },
]

