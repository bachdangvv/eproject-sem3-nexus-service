import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  History,
  Info,
  Lock,
  PauseCircle,
  PlayCircle,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import TechnicalLayout from '../../components/layout/TechnicalLayout'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import { useToast } from '../../hooks/useToast'
import { STATUTORY_TAX_RATE_PERCENT } from '../../services/taxConfig'
import { subscribePlansUpdated } from '../../services/planService'
import {
  ACCOUNT_LIFECYCLE_LIST,
  ACCOUNT_LIFECYCLE_META,
  ACCOUNT_LIFECYCLE_STATUS,
  calculateDailyProration,
  canTransitionAccountStatus,
  changeAccountLifecycleStatus,
  changeAccountPlanWithProration,
  fetchLifecycleAccounts,
  subscribeLifecycleUpdated,
} from '../../services/accountLifecycleService'

const REASON_PRESETS_BY_STATUS = {
  [ACCOUNT_LIFECYCLE_STATUS.ACTIVE]: [
    'Service resumed on customer confirmation',
    'Debt balance cleared — restoring active service (CN20)',
  ],
  [ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE]: [
    'Customer requested temporary seasonal hold',
    'Overdue debt exceeded 7-day grace window (CN20)',
  ],
  [ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE]: [
    'Subscriber contract terminated / permanent churn',
    'Site decommissioned and hardware reclaimed',
  ],
}

function getStatusBadgeClasses(status) {
  if (status === ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE) {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }
  if (status === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE) {
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }
  return 'bg-emerald-50 text-emerald-700 border-emerald-200'
}

export default function AccountLifecyclePage() {
  const { showToast } = useToast()

  const [accounts, setAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedAccountId, setSelectedAccountId] = useState('')

  // Status workflow state
  const [draftStatus, setDraftStatus] = useState(ACCOUNT_LIFECYCLE_STATUS.ACTIVE)
  const [statusReason, setStatusReason] = useState('')
  const [confirmPermanentLock, setConfirmPermanentLock] = useState(false)
  const [statusActionError, setStatusActionError] = useState(null)
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false)

  // Plan change & daily proration state
  const [targetPlanId, setTargetPlanId] = useState('')
  const [daysInCycle, setDaysInCycle] = useState(30)
  const [effectiveDay, setEffectiveDay] = useState(() => Math.min(30, Math.max(1, new Date().getDate())))
  const [issueAdjustmentInvoice, setIssueAdjustmentInvoice] = useState(true)
  const [planChangeReason, setPlanChangeReason] = useState('')
  const [planActionError, setPlanActionError] = useState(null)
  const [lastPlanResult, setLastPlanResult] = useState(null)
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false)

  const refreshData = () => {
    try {
      const list = fetchLifecycleAccounts()
      setAccounts(list)
      setLoadError(null)
      setSelectedAccountId((prev) => {
        if (prev && list.some((a) => a.accountId === prev)) return prev
        return list[0]?.accountId || ''
      })
    } catch (err) {
      setLoadError(err?.message || 'Unable to load activated subscriber accounts.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshData()
    const unsubLifecycle = subscribeLifecycleUpdated(refreshData)
    const unsubPlans = subscribePlansUpdated(refreshData)
    return () => {
      unsubLifecycle()
      unsubPlans()
    }
  }, [])

  const stats = useMemo(() => {
    return {
      total: accounts.length,
      active: accounts.filter((a) => a.lifecycleStatus === ACCOUNT_LIFECYCLE_STATUS.ACTIVE).length,
      tempInactive: accounts.filter(
        (a) => a.lifecycleStatus === ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE
      ).length,
      permInactive: accounts.filter(
        (a) => a.lifecycleStatus === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE
      ).length,
    }
  }, [accounts])

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return accounts.filter((acc) => {
      const matchesStatus = statusFilter === 'ALL' || acc.lifecycleStatus === statusFilter
      if (!matchesStatus) return false
      if (!q) return true
      return (
        String(acc.accountId || '').toLowerCase().includes(q) ||
        String(acc.customerName || '').toLowerCase().includes(q) ||
        String(acc.planName || '').toLowerCase().includes(q)
      )
    })
  }, [accounts, statusFilter, searchQuery])

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.accountId === selectedAccountId) || filteredAccounts[0] || null,
    [accounts, selectedAccountId, filteredAccounts]
  )

  useEffect(() => {
    if (!selectedAccount) return
    setDraftStatus(selectedAccount.lifecycleStatus)
    setStatusReason('')
    setConfirmPermanentLock(false)
    setStatusActionError(null)
    setPlanActionError(null)

    const compatibleOthers = (selectedAccount.availablePlans || []).filter(
      (p) => p.id !== selectedAccount.planId
    )
    setTargetPlanId((prev) => {
      if (prev && compatibleOthers.some((p) => p.id === prev)) return prev
      return compatibleOthers[0]?.id || ''
    })
  }, [selectedAccount?.accountId, selectedAccount?.lifecycleStatus, selectedAccount?.planId])

  const compatiblePlanChoices = useMemo(() => {
    if (!selectedAccount) return []
    return (selectedAccount.availablePlans || []).filter((p) => p.id !== selectedAccount.planId)
  }, [selectedAccount])

  const selectedTargetPlan = useMemo(
    () => compatiblePlanChoices.find((p) => p.id === targetPlanId) || null,
    [compatiblePlanChoices, targetPlanId]
  )

  const prorationPreview = useMemo(() => {
    if (!selectedAccount || !selectedTargetPlan) return null
    return calculateDailyProration({
      currentMonthlyUSD: selectedAccount.monthlyChargeUSD,
      newMonthlyUSD: selectedTargetPlan.monthlyNetUSD,
      effectiveDay,
      daysInCycle,
    })
  }, [selectedAccount, selectedTargetPlan, effectiveDay, daysInCycle])

  const transitionCheck = useMemo(() => {
    if (!selectedAccount) return { allowed: false, reason: 'No subscriber selected.' }
    return canTransitionAccountStatus(selectedAccount.lifecycleStatus, draftStatus)
  }, [selectedAccount, draftStatus])

  const handleApplyStatusChange = () => {
    if (!selectedAccount) return
    setStatusActionError(null)

    if (!transitionCheck.allowed) {
      setStatusActionError(transitionCheck.reason)
      return
    }
    if (
      draftStatus === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE &&
      !confirmPermanentLock
    ) {
      setStatusActionError('Confirm permanent disconnection lock before submitting.')
      return
    }

    setIsSubmittingStatus(true)
    try {
      const result = changeAccountLifecycleStatus({
        accountId: selectedAccount.accountId,
        nextStatus: draftStatus,
        reason: statusReason,
      })
      showToast(
        `${selectedAccount.accountId} transitioned to ${result.meta.label} (Demo state).`,
        'success'
      )
      setStatusReason('')
      setConfirmPermanentLock(false)
      refreshData()
    } catch (err) {
      setStatusActionError(err?.message || 'Unable to transition account lifecycle status.')
    } finally {
      setIsSubmittingStatus(false)
    }
  }

  const handleApplyPlanChange = async () => {
    if (!selectedAccount || !selectedTargetPlan) return
    setPlanActionError(null)
    setLastPlanResult(null)
    setIsSubmittingPlan(true)

    try {
      const result = await changeAccountPlanWithProration({
        accountId: selectedAccount.accountId,
        newPlanId: selectedTargetPlan.id,
        effectiveDay,
        daysInCycle,
        issueAdjustmentInvoice,
        reason: planChangeReason,
      })
      setLastPlanResult(result)
      setPlanChangeReason('')
      showToast(
        `Plan changed to ${result.newPlan.name} with daily proration (${result.proration.remainingDays}/${result.proration.daysInCycle} days).`,
        'success'
      )
      refreshData()
    } catch (err) {
      setPlanActionError(err?.message || 'Unable to apply subscriber plan change.')
    } finally {
      setIsSubmittingPlan(false)
    }
  }

  return (
    <TechnicalLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-2">
              <Activity size={13} />
              CN15 Subscriber Lifecycle &amp; Plan Management
            </div>
            <h1 className="text-2xl font-black tracking-tight text-navy">
              Account Connection Status &amp; Plan Change
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage canonical 3-state connection lifecycle, execute mid-cycle plan upgrades/downgrades from unified tariffs, and preview daily proration adjustments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/technical/activations"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Circuit Commissioning
            </Link>
            <Link
              to="/accounts/debts"
              className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy/90 transition"
            >
              View Debt &amp; Dunning Ledger
            </Link>
          </div>
        </div>

        {/* Honest Demo Simulation Notice */}
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
          <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
          <div>
            <span className="font-bold">Demo Lifecycle Sandbox:</span> State transitions (
            <span className="font-semibold">Active</span>,{' '}
            <span className="font-semibold">Temporarily Inactive</span>,{' '}
            <span className="font-semibold">Permanently Inactive</span>), daily proration fees, and adjustment invoices are simulated in browser storage (`localStorage`) to demonstrate the CN15 business flow. Authoritative OLT/RADIUS status and backend billing synchronization will be connected in production integration.
          </div>
        </div>

        {isLoading ? (
          <AsyncStatePanel
            state="loading"
            title="Loading activated subscriber circuits..."
            description="Retrieving subscriber lifecycle states, unified tariff plans, and billing balances."
          />
        ) : loadError ? (
          <AsyncStatePanel
            state="error"
            title="Failed to load lifecycle ledger"
            description={loadError}
            onRetry={refreshData}
          />
        ) : (
          <>
            {/* KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Managed Subscribers
                </span>
                <div className="mt-1 text-2xl font-black text-navy">{stats.total}</div>
                <p className="mt-1 text-[11px] text-slate-500">Commissioned 16-char accounts</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Active
                </span>
                <div className="mt-1 text-2xl font-black text-emerald-600">{stats.active}</div>
                <p className="mt-1 text-[11px] text-slate-500">Normal service &amp; billing</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Temporarily Inactive
                </span>
                <div className="mt-1 text-2xl font-black text-amber-600">{stats.tempInactive}</div>
                <p className="mt-1 text-[11px] text-slate-500">Reversible pause / CN20 debt hold</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Permanently Inactive
                </span>
                <div className="mt-1 text-2xl font-black text-rose-600">{stats.permInactive}</div>
                <p className="mt-1 text-[11px] text-slate-500">Terminal churn (locked)</p>
              </div>
            </div>

            {accounts.length === 0 ? (
              <AsyncStatePanel
                state="empty"
                icon={Activity}
                title="No Activated Subscriber Accounts"
                description="Commission a feasible customer order first in Circuit Activation to assign a 16-character Account ID."
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Account Directory */}
                <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-black text-navy uppercase tracking-wider">
                        Subscriber Accounts
                      </h2>
                      <span className="text-[11px] font-bold text-slate-400">
                        {filteredAccounts.length} shown
                      </span>
                    </div>

                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="Search account ID, customer, plan..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-indigo-500"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'ALL', label: 'All' },
                        { id: ACCOUNT_LIFECYCLE_STATUS.ACTIVE, label: 'Active' },
                        { id: ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE, label: 'Temp. Inactive' },
                        { id: ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE, label: 'Perm. Inactive' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setStatusFilter(tab.id)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                            statusFilter === tab.id
                              ? 'bg-navy text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
                    {filteredAccounts.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                        No subscriber matches your filter criteria.
                      </div>
                    ) : (
                      filteredAccounts.map((acc) => {
                        const isSelected = selectedAccount?.accountId === acc.accountId
                        return (
                          <button
                            key={acc.accountId}
                            type="button"
                            onClick={() => setSelectedAccountId(acc.accountId)}
                            className={`w-full text-left rounded-xl border p-3.5 transition cursor-pointer ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/15'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-black text-navy">
                                {acc.accountId}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${getStatusBadgeClasses(
                                  acc.lifecycleStatus
                                )}`}
                              >
                                {acc.statusMeta.shortLabel}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs font-bold text-slate-800 truncate">
                              {acc.customerName}
                            </p>
                            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 gap-2">
                              <span className="truncate">{acc.planName}</span>
                              <span className="font-bold text-slate-700 shrink-0">
                                ${Number(acc.monthlyChargeUSD || 0).toLocaleString()}/mo
                              </span>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Selected Account Operations */}
                {selectedAccount && (
                  <div className="lg:col-span-8 space-y-6">
                    {/* Account Snapshot */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-mono text-xs font-black text-indigo-700 border border-indigo-200">
                              {selectedAccount.accountId}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold ${getStatusBadgeClasses(
                                selectedAccount.lifecycleStatus
                              )}`}
                            >
                              {selectedAccount.lifecycleStatus ===
                                ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE && <Lock size={12} />}
                              {selectedAccount.statusMeta.label}
                            </span>
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                              {selectedAccount.connectionType}
                            </span>
                          </div>
                          <h2 className="mt-2 text-lg font-black text-navy">
                            {selectedAccount.customerName}
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Current Plan:{' '}
                            <span className="font-bold text-slate-800">{selectedAccount.planName}</span>
                            {' • '}Net Monthly:{' '}
                            <span className="font-bold text-slate-800">
                              ${Number(selectedAccount.monthlyChargeUSD || 0).toLocaleString()}/mo
                            </span>
                            {selectedAccount.orderId ? ` • Ref Order: ${selectedAccount.orderId}` : ''}
                          </p>
                        </div>

                        {selectedAccount.debtRecord && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Linked Debt Ledger
                            </div>
                            <div className="mt-0.5 font-black text-navy">
                              Balance: ${Number(selectedAccount.debtRecord.balanceUSD || 0).toLocaleString()}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Overdue: {selectedAccount.debtRecord.overdueDays || 0} days • Debt Port:{' '}
                              <span className="font-bold">{selectedAccount.debtRecord.oltStatus}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedAccount.lifecycleStatus ===
                        ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                          <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-600" />
                          <div>
                            <span className="font-bold">Terminal Account Locked:</span> This account is{' '}
                            <span className="font-bold">Permanently Inactive</span>. Reactivation to Active/Temporarily Inactive and plan upgrades/downgrades are blocked.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Panel A: 3-State Connection Lifecycle Transitions */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                            <PauseCircle size={16} className="text-indigo-600" />
                            1. Connection Lifecycle Status Control
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Switch between the 3 canonical CN15 states: Active, Temporarily Inactive, or Permanently Inactive.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {ACCOUNT_LIFECYCLE_LIST.map((stateKey) => {
                          const meta = ACCOUNT_LIFECYCLE_META[stateKey]
                          const isCurrent = selectedAccount.lifecycleStatus === stateKey
                          const isSelectedDraft = draftStatus === stateKey
                          const check = canTransitionAccountStatus(
                            selectedAccount.lifecycleStatus,
                            stateKey
                          )
                          const isLockedOut = !isCurrent && !check.allowed

                          const IconComp =
                            stateKey === ACCOUNT_LIFECYCLE_STATUS.ACTIVE
                              ? PlayCircle
                              : stateKey === ACCOUNT_LIFECYCLE_STATUS.TEMPORARILY_INACTIVE
                              ? PauseCircle
                              : XCircle

                          return (
                            <button
                              key={stateKey}
                              type="button"
                              disabled={isLockedOut}
                              onClick={() => {
                                setDraftStatus(stateKey)
                                setStatusActionError(null)
                                setConfirmPermanentLock(false)
                              }}
                              className={`text-left rounded-xl border p-3.5 transition ${
                                isLockedOut
                                  ? 'opacity-45 cursor-not-allowed border-slate-200 bg-slate-50'
                                  : isSelectedDraft
                                  ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/15 cursor-pointer'
                                  : 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-bold text-xs text-navy">
                                  <IconComp size={15} />
                                  {meta.label}
                                </div>
                                {isCurrent && (
                                  <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                                {meta.description}
                              </p>
                            </button>
                          )
                        })}
                      </div>

                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Transition Reason / Technical Note
                          </label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {(REASON_PRESETS_BY_STATUS[draftStatus] || []).map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setStatusReason(preset)}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={statusReason}
                            onChange={(e) => setStatusReason(e.target.value)}
                            disabled={
                              selectedAccount.lifecycleStatus ===
                              ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE
                            }
                            placeholder="Enter operational reason for status transition..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:bg-white focus:border-indigo-500 disabled:opacity-50"
                          />
                        </div>

                        {draftStatus === ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE &&
                          selectedAccount.lifecycleStatus !==
                            ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE && (
                            <label className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={confirmPermanentLock}
                                onChange={(e) => setConfirmPermanentLock(e.target.checked)}
                                className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                              />
                              <span>
                                I confirm setting{' '}
                                <span className="font-mono font-bold">
                                  {selectedAccount.accountId}
                                </span>{' '}
                                to <span className="font-bold">Permanently Inactive</span>. This terminal demo state locks future plan changes and reactivation.
                              </span>
                            </label>
                          )}

                        {statusActionError && (
                          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                            <AlertTriangle size={14} className="shrink-0" />
                            <span>{statusActionError}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            disabled={isSubmittingStatus || !transitionCheck.allowed}
                            onClick={handleApplyStatusChange}
                            className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-navy/90 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            <CheckCircle2 size={14} />
                            Apply Lifecycle Status
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Panel B: Plan Change & Daily Proration Calculator */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                            <ArrowRightLeft size={16} className="text-indigo-600" />
                            2. Plan Upgrade / Downgrade &amp; Daily Proration Fee
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Select a compatible plan from Admin tariff catalog (`{selectedAccount.connectionType}`) and compute prorated daily adjustment with fixed {STATUTORY_TAX_RATE_PERCENT}% statutory tax.
                          </p>
                        </div>
                      </div>

                      {selectedAccount.lifecycleStatus ===
                      ACCOUNT_LIFECYCLE_STATUS.PERMANENTLY_INACTIVE ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                          Plan change workflow is disabled because this account is Permanently Inactive.
                        </div>
                      ) : compatiblePlanChoices.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                          No other active plans are available under{' '}
                          <span className="font-bold">{selectedAccount.connectionType}</span> in{' '}
                          <Link to="/admin/plans" className="text-indigo-600 underline font-semibold">
                            Plans Management
                          </Link>
                          . Add another {selectedAccount.connectionType} plan to test upgrade/downgrade proration.
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                Target Tariff Plan ({selectedAccount.connectionType})
                              </label>
                              <select
                                value={targetPlanId}
                                onChange={(e) => {
                                  setTargetPlanId(e.target.value)
                                  setPlanActionError(null)
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                              >
                                {compatiblePlanChoices.map((plan) => (
                                  <option key={plan.id} value={plan.id}>
                                    {plan.name} — ${Number(plan.monthlyNetUSD).toLocaleString()}/mo net ({plan.domesticSpeed})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                  Cycle Days
                                </label>
                                <select
                                  value={daysInCycle}
                                  onChange={(e) => {
                                    const nextDays = Number(e.target.value)
                                    setDaysInCycle(nextDays)
                                    setEffectiveDay((prev) => Math.min(nextDays, prev))
                                  }}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                                >
                                  <option value={28}>28 Days</option>
                                  <option value={29}>29 Days</option>
                                  <option value={30}>30 Days</option>
                                  <option value={31}>31 Days</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                  Effective Day (1-{daysInCycle})
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={daysInCycle}
                                  value={effectiveDay}
                                  onChange={(e) => {
                                    const val = Math.max(
                                      1,
                                      Math.min(daysInCycle, Number(e.target.value) || 1)
                                    )
                                    setEffectiveDay(val)
                                  }}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Slider & Quick Day Presets */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                                <CalendarDays size={14} className="text-indigo-600" />
                                Mid-Cycle Effective Cutover: Day {effectiveDay} of {daysInCycle}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {[
                                  { label: 'Day 1 (Full)', day: 1 },
                                  { label: 'Mid (Day 16)', day: Math.min(daysInCycle, 16) },
                                  { label: 'Late (Day 25)', day: Math.min(daysInCycle, 25) },
                                ].map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => setEffectiveDay(preset.day)}
                                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <input
                              type="range"
                              min={1}
                              max={daysInCycle}
                              value={effectiveDay}
                              onChange={(e) => setEffectiveDay(Number(e.target.value))}
                              className="w-full accent-indigo-600 cursor-pointer"
                            />
                            {prorationPreview && (
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>Old plan used: {prorationPreview.usedDays} days</span>
                                <span className="font-bold text-indigo-700">
                                  Prorated window remaining: {prorationPreview.remainingDays} days ({prorationPreview.prorationRatioPercent}%)
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Live Daily Proration Summary */}
                          {prorationPreview && selectedTargetPlan && (
                            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-navy flex items-center gap-1.5">
                                  {prorationPreview.changeDirection === 'UPGRADE' ? (
                                    <TrendingUp size={15} className="text-emerald-600" />
                                  ) : prorationPreview.changeDirection === 'DOWNGRADE' ? (
                                    <TrendingDown size={15} className="text-amber-600" />
                                  ) : (
                                    <DollarSign size={15} className="text-slate-600" />
                                  )}
                                  Daily Proration Preview ({prorationPreview.changeDirection})
                                </span>
                                <span className="rounded-md bg-white border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                  {prorationPreview.remainingDays}/{prorationPreview.daysInCycle} Remaining Days
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div className="rounded-xl bg-white border border-slate-200 p-3">
                                  <div className="text-[10px] font-bold uppercase text-slate-400">
                                    Unused Old Plan Credit
                                  </div>
                                  <div className="mt-1 text-sm font-black text-slate-800">
                                    -${prorationPreview.unusedCreditNetUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    ${prorationPreview.oldDailyRateUSD.toFixed(2)}/day × {prorationPreview.remainingDays}d
                                  </div>
                                </div>

                                <div className="rounded-xl bg-white border border-slate-200 p-3">
                                  <div className="text-[10px] font-bold uppercase text-slate-400">
                                    Prorated New Plan Charge
                                  </div>
                                  <div className="mt-1 text-sm font-black text-slate-800">
                                    +${prorationPreview.newChargeNetUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    ${prorationPreview.newDailyRateUSD.toFixed(2)}/day × {prorationPreview.remainingDays}d
                                  </div>
                                </div>

                                <div className="rounded-xl bg-navy text-white p-3">
                                  <div className="text-[10px] font-bold uppercase text-indigo-200">
                                    Total Adjustment (incl. {prorationPreview.taxRatePercent}% Tax)
                                  </div>
                                  <div className="mt-1 text-base font-black">
                                    {prorationPreview.totalAdjustmentUSD >= 0 ? '+' : '-'}$
                                    {Math.abs(prorationPreview.totalAdjustmentUSD).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                  <div className="text-[11px] text-slate-300 mt-0.5">
                                    Net: {prorationPreview.proratedNetDeltaUSD >= 0 ? '+' : '-'}$
                                    {Math.abs(prorationPreview.proratedNetDeltaUSD).toFixed(2)} • Tax: $
                                    {Math.abs(prorationPreview.taxAmountUSD).toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2.5 pt-1">
                                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={issueAdjustmentInvoice}
                                    onChange={(e) => setIssueAdjustmentInvoice(e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span>
                                    Issue simulated adjustment invoice in{' '}
                                    <span className="font-semibold">Billing Ledger</span> when upgrade delta &gt; $0 (downgrade credits are logged as credit memos).
                                  </span>
                                </label>

                                <input
                                  type="text"
                                  value={planChangeReason}
                                  onChange={(e) => setPlanChangeReason(e.target.value)}
                                  placeholder="Optional plan change approval note / customer request ref..."
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-500"
                                />
                              </div>

                              {planActionError && (
                                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                                  <AlertTriangle size={14} className="shrink-0" />
                                  <span>{planActionError}</span>
                                </div>
                              )}

                              {lastPlanResult &&
                                lastPlanResult.account?.accountId === selectedAccount.accountId && (
                                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
                                    <FileText size={15} className="shrink-0 mt-0.5 text-emerald-600" />
                                    <div>
                                      <span className="font-bold">Plan Change Applied:</span> Switched to{' '}
                                      <span className="font-bold">{lastPlanResult.newPlan.name}</span>.{' '}
                                      {lastPlanResult.generatedInvoice ? (
                                        <span>
                                          Created adjustment invoice{' '}
                                          <Link
                                            to="/accounts/billing"
                                            className="font-mono font-bold underline"
                                          >
                                            {lastPlanResult.generatedInvoice.id}
                                          </Link>
                                          .
                                        </span>
                                      ) : lastPlanResult.creditMemo ? (
                                        <span>
                                          Recorded downgrade credit memo of $
                                          {lastPlanResult.creditMemo.totalCreditUSD.toFixed(2)}.
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                )}

                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  disabled={isSubmittingPlan}
                                  onClick={handleApplyPlanChange}
                                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
                                >
                                  <ArrowRightLeft size={14} />
                                  Confirm Plan Change &amp; Prorate Fee
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Panel C: Lifecycle & Plan Audit History */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                          <History size={16} className="text-indigo-600" />
                          3. Lifecycle &amp; Proration Audit Trail
                        </h3>
                        <span className="text-[11px] font-bold text-slate-400">
                          {selectedAccount.auditHistory?.length || 0} events
                        </span>
                      </div>

                      {!selectedAccount.auditHistory || selectedAccount.auditHistory.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">
                          No lifecycle transitions or plan changes logged for this account yet.
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                          {selectedAccount.auditHistory.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-navy">
                                  {entry.type === 'STATUS_CHANGE'
                                    ? `Status: ${entry.previousStatus} -> ${entry.nextStatusLabel}`
                                    : `Plan Change: ${entry.previousPlanName} -> ${entry.newPlanName}`}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                  <Clock size={11} />
                                  {new Date(entry.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-slate-600">{entry.reason}</p>
                              {entry.proration && (
                                <p className="text-[11px] font-medium text-indigo-700">
                                  Proration ({entry.proration.remainingDays}/{entry.proration.daysInCycle}d): Net{' '}
                                  {entry.proration.proratedNetDeltaUSD >= 0 ? '+' : '-'}$
                                  {Math.abs(entry.proration.proratedNetDeltaUSD).toFixed(2)} • Total adj.{' '}
                                  {entry.proration.totalAdjustmentUSD >= 0 ? '+' : '-'}$
                                  {Math.abs(entry.proration.totalAdjustmentUSD).toFixed(2)}
                                  {entry.generatedInvoiceId ? ` • Invoice: ${entry.generatedInvoiceId}` : ''}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </TechnicalLayout>
  )
}

