import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  CheckCircle2,
  Clock,
  DollarSign,
  Activity,
  Lock,
  ChevronRight,
  ShieldAlert,
  RotateCw,
  Receipt,
  Info,
} from 'lucide-react'
import AccountsLayout from '../../components/layout/AccountsLayout'
import { useToast } from '../../hooks/useToast'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import {
  fetchDebtAccounts,
  suspendCircuit,
  unsuspendCircuit,
  extendGracePeriod,
  reconcileDebtAccountWithBillingSummary,
  subscribeDebtAccountsUpdated,
} from '../../services/debtService'
import {
  fetchInvoices,
  getAccountUnpaidSummary,
  recordFifoAccountPayment,
  subscribeInvoicesUpdated,
  formatUSD,
} from '../../services/billingService'

export default function DebtManagementPage() {
  const loadLedger = useCallback(async () => {
    const [debtAccounts, invoices] = await Promise.all([
      Promise.resolve(fetchDebtAccounts()),
      fetchInvoices(),
    ])
    return { debtAccounts, invoices }
  }, [])

  const {
    data: ledgerData,
    setData: setLedgerData,
    isLoading,
    error,
    reload: reloadAccounts,
  } = useAsyncResource(loadLedger, [])

  const rawDebtAccounts = ledgerData?.debtAccounts || []
  const billingInvoices = ledgerData?.invoices || []

  const accounts = useMemo(() => {
    return rawDebtAccounts.map((acc) => {
      const billingSummary = getAccountUnpaidSummary(acc.accountId, billingInvoices)
      return reconcileDebtAccountWithBillingSummary(acc, billingSummary)
    })
  }, [rawDebtAccounts, billingInvoices])

  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionError, setActionError] = useState(null)
  const [isSettlingDebt, setIsSettlingDebt] = useState(false)
  const { toast, showToast } = useToast()

  useEffect(() => {
    const unsubInvoices = subscribeInvoicesUpdated(() => {
      reloadAccounts()
    })
    const unsubDebts = subscribeDebtAccountsUpdated(() => {
      reloadAccounts()
    })
    const handleFocus = () => reloadAccounts()
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus)
    }
    return () => {
      unsubInvoices()
      unsubDebts()
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus)
      }
    }
  }, [reloadAccounts])

  useEffect(() => {
    if (!ledgerData) return
    if (accounts.length === 0) {
      setSelectedAccountId('')
      return
    }
    setSelectedAccountId((prev) => {
      if (prev && accounts.some((a) => a.accountId === prev)) return prev
      return accounts[0].accountId
    })
  }, [ledgerData, accounts])

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.accountId === selectedAccountId) || accounts[0] || null
  }, [accounts, selectedAccountId])

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return accounts.filter((acc) => {
      const matchStatus =
        activeFilter === 'ALL' ||
        (activeFilter === 'ACTIVE' && acc.oltStatus === 'ACTIVE') ||
        (activeFilter === 'THROTTLED' && acc.oltStatus === 'THROTTLED') ||
        (activeFilter === 'SUSPENDED' && acc.oltStatus === 'SUSPENDED')

      const matchSearch =
        q === '' ||
        acc.accountId.toLowerCase().includes(q) ||
        acc.customerName.toLowerCase().includes(q) ||
        (acc.taxId && acc.taxId.toLowerCase().includes(q))

      return matchStatus && matchSearch
    })
  }, [accounts, activeFilter, searchQuery])

  const stats = useMemo(() => {
    const totalDebt = Number(accounts.reduce((sum, a) => sum + (a.balanceUSD || 0), 0).toFixed(2))
    const totalBillingOpen = Number(
      accounts.reduce((sum, a) => sum + (a.openInvoicesBalanceUSD || 0), 0).toFixed(2)
    )
    const totalHistoricalArrears = Number(
      accounts.reduce((sum, a) => sum + (a.historicalArrearsUSD || 0), 0).toFixed(2)
    )
    const suspended = accounts.filter((a) => a.oltStatus === 'SUSPENDED').length
    const throttled = accounts.filter((a) => a.oltStatus === 'THROTTLED').length
    return {
      totalDebt,
      totalBillingOpen,
      totalHistoricalArrears,
      count: accounts.length,
      suspended,
      throttled,
    }
  }, [accounts])

  async function handleMarkPaid() {
    if (!selectedAccount || isSettlingDebt) return
    setActionError(null)
    setIsSettlingDebt(true)
    try {
      let nextInvoices = billingInvoices
      if (selectedAccount.openInvoicesBalanceUSD > 0) {
        const fifoRes = await recordFifoAccountPayment(selectedAccount.accountId, {
          amount: selectedAccount.openInvoicesBalanceUSD,
          method: 'Accounts Debt Settlement',
          note: 'Full invoice & debt clearance from Debt Management Console',
        })
        if (Array.isArray(fifoRes?.updatedInvoices)) {
          nextInvoices = fifoRes.updatedInvoices
        } else {
          nextInvoices = await fetchInvoices()
        }
      }
      const updatedDebts = unsuspendCircuit(
        selectedAccount.accountId,
        'Paid in full via Accounts Reconciliation'
      )
      setLedgerData({ debtAccounts: updatedDebts, invoices: nextInvoices })
      showToast(
        `Account ${selectedAccount.accountId} Billing & debt balance cleared. Circuit ACTIVE.`,
        'success'
      )
    } catch (err) {
      const msg = err?.message || 'Unable to mark account as paid.'
      setActionError(msg)
      showToast(msg, 'error')
    } finally {
      setIsSettlingDebt(false)
    }
  }

  function handleSuspend() {
    if (!selectedAccount) return
    setActionError(null)
    try {
      const updated = suspendCircuit(selectedAccount.accountId, 'Overdue SLA payment exceeded')
      setLedgerData((prev) => ({
        debtAccounts: updated,
        invoices: prev?.invoices || billingInvoices,
      }))
      showToast(`Circuit ${selectedAccount.accountId} has been suspended.`, 'error')
    } catch (err) {
      const msg = err?.message || 'Unable to suspend circuit.'
      setActionError(msg)
      showToast(msg, 'error')
    }
  }

  function handleExtendGrace() {
    if (!selectedAccount) return
    setActionError(null)
    try {
      const updated = extendGracePeriod(selectedAccount.accountId, 3)
      setLedgerData((prev) => ({
        debtAccounts: updated,
        invoices: prev?.invoices || billingInvoices,
      }))
      showToast(`Grace period for ${selectedAccount.accountId} extended by +3 days.`, 'info')
    } catch (err) {
      const msg = err?.message || 'Unable to extend grace period.'
      setActionError(msg)
      showToast(msg, 'error')
    }
  }

  return (
    <AccountsLayout activeNavId="debts" toast={toast}>
      <div className="card p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Finance &amp; Revenue</span>
              <ChevronRight size={12} />
              <span>Accounts Receivable &amp; Arrears</span>
              <ChevronRight size={12} />
              <span>Dunning Cycle M03/2026</span>
              <ChevronRight size={12} />
              <span className="font-bold text-navy">Corporate Ledger</span>
            </div>
            <h1 className="mt-1.5 text-xl font-extrabold text-navy md:text-2xl">
              Debt &amp; Arrears Management, Dunning &amp; Circuit Enforcement
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-800">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> DUNNING_ACTIVE
              </span>
              <span className="text-slate-500">
                Grace Policy: <strong>7 Days Notice / Tiered Throttling</strong>
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-500">
                Total Overdue Exposure: <strong className="text-rose-600">{formatUSD(stats.totalDebt)}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700">
              Total Delinquent: {formatUSD(stats.totalDebt)}
            </span>
            <Link
              to="/accounts/billing"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-100 transition"
            >
              <Receipt size={13} /> Billing Ledger
            </Link>
            <button
              type="button"
              onClick={reloadAccounts}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <RotateCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {actionError && (
          <div className="mt-4">
            <AsyncStatePanel
              compact
              state="error"
              title="Dunning Enforcement Error"
              description={actionError}
              actionLabel="Dismiss"
              onAction={() => setActionError(null)}
            />
          </div>
        )}

        {isLoading ? (
          <div className="mt-5">
            <AsyncStatePanel
              state="loading"
              title="Loading debt & dunning ledger..."
              description="Fetching overdue enterprise accounts, grace periods, and OLT enforcement statuses."
            />
          </div>
        ) : error ? (
          <div className="mt-5">
            <AsyncStatePanel
              state="error"
              title="Unable to load debt accounts"
              description={error}
              onRetry={reloadAccounts}
            />
          </div>
        ) : accounts.length === 0 ? (
          <div className="mt-5">
            <AsyncStatePanel
              state="empty"
              icon={CheckCircle2}
              title="No Overdue Accounts"
              description="All subscriber billing balances are settled cleanly with zero arrears or pending dunning actions."
              actionLabel="Refresh Ledger"
              onAction={reloadAccounts}
            />
          </div>
        ) : (
        <>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Outstanding Debt</span>
              <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="mt-1 text-2xl font-black text-rose-600">{formatUSD(stats.totalDebt)}</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>Billing: {formatUSD(stats.totalBillingOpen)}</span>
              <span className="font-semibold text-amber-700">
                Hist: {formatUSD(stats.totalHistoricalArrears)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Overdue Accounts</span>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-1 text-2xl font-black text-navy">{stats.count}</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>Enterprise dunning cycle</span>
              <span className="font-bold text-amber-600">Active</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Suspended Circuits</span>
              <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                <Lock size={16} />
              </div>
            </div>
            <div className="mt-1 text-2xl font-black text-rose-600">{stats.suspended}</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>Optical port de-authorized</span>
              <span className="font-bold text-rose-600">Locked</span>
            </div>
          </div>

          <div className="rounded-2xl p-4 bg-navy text-white shadow-lg shadow-navy/20 border-none">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[11px] font-bold uppercase tracking-wider">Throttled Circuits</span>
              <div className="rounded-lg bg-white/10 p-2 text-indigo-400">
                <Activity size={16} />
              </div>
            </div>
            <div className="mt-1 text-2xl font-black text-white">{stats.throttled}</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300 border-t border-white/10 pt-1.5">
              <span>Speed reduced to 1Mbps</span>
              <span className="font-bold text-indigo-300">Throttled</span>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 flex items-start gap-2.5 text-xs text-amber-950">
          <Info size={16} className="shrink-0 mt-0.5 text-amber-700" />
          <div>
            <span className="font-bold">Billing Sync &amp; Historical Arrears Transparency:</span>{' '}
            Invoice balances recalculate directly from active Billing invoices (and update automatically after FIFO or single-invoice collections). Accounts carrying carried-forward balances predating the e-Invoice list display <strong>Billing Open Invoices</strong> and <strong>Historical Unbilled Arrears</strong> separately so both ledgers always reconcile.
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700">
          <div className="flex items-start gap-2.5">
            <Activity size={16} className="shrink-0 mt-0.5 text-indigo-600" />
            <div>
              <span className="font-bold text-navy">CN15 Lifecycle &amp; Plan Change Workflow:</span>{' '}
              Debt-dunning port suspension (&gt;7 days overdue) maps to{' '}
              <span className="font-semibold text-amber-800">Temporarily Inactive</span>. Full 3-state connection lifecycle (<span className="font-semibold">Active</span>, <span className="font-semibold">Temporarily Inactive</span>, <span className="font-semibold">Permanently Inactive</span>), tariff upgrades/downgrades, and daily proration fees are managed in the Technical Portal.
            </div>
          </div>
          <Link
            to="/technical/lifecycle"
            className="shrink-0 rounded-xl bg-navy px-3.5 py-2 text-xs font-bold text-white hover:bg-navy/90 transition text-center"
          >
            Open Account Lifecycle
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'ALL', label: 'All Accounts' },
                    { id: 'ACTIVE', label: 'Active (Grace)' },
                    { id: 'THROTTLED', label: 'Throttled' },
                    { id: 'SUSPENDED', label: 'Temp. Inactive (Suspended)' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setActiveFilter(f.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                        activeFilter === f.id
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search account, company, tax ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                      <th className="py-3 px-4">Account ID &amp; Customer</th>
                      <th className="py-3 px-4">Service Plan</th>
                      <th className="py-3 px-4 text-center">Overdue Days</th>
                      <th className="py-3 px-4 text-right">Balance Due Breakdown</th>
                      <th className="py-3 px-4 text-center">Port Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-4">
                          <AsyncStatePanel
                            compact
                            state="empty"
                            icon={Search}
                            title="No matching debt accounts"
                            description="No subscriber accounts matched the selected circuit status filter or search query."
                            actionLabel="Reset Filters"
                            onAction={() => {
                              setActiveFilter('ALL')
                              setSearchQuery('')
                            }}
                          />
                        </td>
                      </tr>
                    ) : (
                      filteredAccounts.map((acc) => {
                        const isSelected = acc.accountId === selectedAccountId
                        return (
                          <tr
                            key={acc.accountId}
                            onClick={() => setSelectedAccountId(acc.accountId)}
                            className={`cursor-pointer transition ${
                              isSelected ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{acc.customerName}</div>
                              <div className="font-mono text-[10px] text-indigo-600">{acc.accountId}</div>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-800">{acc.plan}</td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="font-bold text-rose-600">{acc.overdueDays}d</span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono">
                              <div className="font-black text-rose-600">{formatUSD(acc.balanceUSD)}</div>
                              {acc.hasHistoricalArrears ? (
                                <div className="text-[10px] text-amber-700 font-semibold">
                                  Billing {formatUSD(acc.openInvoicesBalanceUSD)} + Hist {formatUSD(acc.historicalArrearsUSD)}
                                </div>
                              ) : (
                                <div className="text-[10px] text-emerald-700 font-semibold">
                                  Billing Synced ({acc.billingOpenInvoiceCount} open inv)
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                                  acc.oltStatus === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : acc.oltStatus === 'THROTTLED'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {acc.oltStatus}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedAccountId(acc.accountId)
                                }}
                                className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {selectedAccount ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-indigo-600">{selectedAccount.accountId}</span>
                    <h3 className="text-sm font-black text-slate-900 mt-0.5">{selectedAccount.customerName}</h3>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                      selectedAccount.oltStatus === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {selectedAccount.oltStatus}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Open Billing Invoices ({selectedAccount.billingOpenInvoiceCount}):
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatUSD(selectedAccount.openInvoicesBalanceUSD)}
                    </span>
                  </div>
                  {selectedAccount.billingInvoiceIds.length > 0 && (
                    <div className="font-mono text-[10px] text-indigo-700 text-right">
                      {selectedAccount.billingInvoiceIds.map((id) => `#${id}`).join(', ')}
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Historical / Unbilled Arrears:</span>
                    <span
                      className={`font-mono font-bold ${
                        selectedAccount.hasHistoricalArrears ? 'text-amber-700' : 'text-slate-500'
                      }`}
                    >
                      {formatUSD(selectedAccount.historicalArrearsUSD)}
                    </span>
                  </div>
                  {selectedAccount.hasHistoricalArrears && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                      <strong>Unbilled History Note:</strong>{' '}
                      {selectedAccount.historicalArrearsNote ||
                        'Carried-forward arrears predating current Billing invoices.'}
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="font-bold text-slate-700">Total Balance Due:</span>
                    <span className="font-mono font-black text-rose-600 text-sm">
                      {formatUSD(selectedAccount.balanceUSD)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Overdue Days:</span>
                    <span className="font-bold text-slate-800">{selectedAccount.overdueDays} Days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tax ID (MST):</span>
                    <span className="font-mono text-slate-800">{selectedAccount.taxId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Virtual Account:</span>
                    <span className="font-mono font-bold text-indigo-600">{selectedAccount.virtualAccount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contact:</span>
                    <span className="text-slate-800">
                      {selectedAccount.contactPerson} &bull; {selectedAccount.contactPhone}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Immediate Operational Actions
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      disabled={isSettlingDebt}
                      onClick={handleMarkPaid}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 size={14} />
                      <span>
                        {isSettlingDebt ? 'Settling Invoices & Debt...' : 'Mark Paid & Clear Suspension'}
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleSuspend}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 px-3 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer shadow-xs"
                      >
                        <Lock size={14} />
                        <span>Suspend Circuit</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExtendGrace}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        <Clock size={14} />
                        <span>Extend +3 Days</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                    Audit Dunning Timeline
                  </span>
                  <div className="space-y-2">
                    {selectedAccount.auditLogs.slice(0, 3).map((log) => (
                      <div key={log.id} className="rounded-lg bg-slate-50 p-2 text-[11px] border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-400">{log.timestamp}</div>
                        <div className="text-slate-700 mt-0.5">{log.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <AsyncStatePanel
                compact
                state="empty"
                icon={ShieldAlert}
                title="No Account Selected"
                description="Select a subscriber account from the debt ledger to enforce suspension, grace period, or settlement actions."
              />
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </AccountsLayout>
  )
}
