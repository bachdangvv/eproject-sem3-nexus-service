import { useState, useMemo } from 'react'
import {
  Receipt,
  Search,
  Download,
  ChevronRight,
  RotateCw,
  Plus,
  AlertTriangle,
  Layers,
  CheckCircle2,
} from 'lucide-react'
import AccountsLayout from '../../components/layout/AccountsLayout'
import { useToast } from '../../hooks/useToast'
import { getActivatedAccounts } from '../../services/activationService'
import { resolveAccountBillingProfile, formatUSD } from '../../services/billingService'
import {
  INITIAL_CDR_SESSIONS,
  DEFAULT_CN17_BILLING_CYCLE,
  CDR_UNIT_RATES,
  EQUIPMENT_DAMAGE_FEE_BY_CATEGORY,
  fetchCdrSessions,
  fetchDamagedEquipmentIncidents,
  addCdrSession,
  markCdrSessionsBilled,
  recordDamagedEquipmentFee,
  previewMonthlyBillingBatch,
  runMonthlyBillingBatch,
  syncCdrToInvoice,
} from '../../services/cdrBillingService'
import { STATUTORY_TAX_RATE_PERCENT } from '../../services/taxConfig'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import { useAsyncResource } from '../../hooks/useAsyncResource'

export { INITIAL_CDR_SESSIONS }

export default function CdrMeteringPage() {
  const [selectedAccountId, setSelectedAccountId] = useState('ALL')
  const [billingCycle, setBillingCycle] = useState(DEFAULT_CN17_BILLING_CYCLE)
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRunningBatch, setIsRunningBatch] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [batchResult, setBatchResult] = useState(null)
  const [showAddTools, setShowAddTools] = useState(false)

  const [newCdrForm, setNewCdrForm] = useState({
    accountId: '',
    chargeCategory: 'VOICE_LOCAL',
    quantity: '250',
    eventType: '',
  })

  const [damageForm, setDamageForm] = useState({
    accountId: '',
    category: 'ONT',
    deviceSerial: '',
    deviceModel: '',
    feeUSD: String(EQUIPMENT_DAMAGE_FEE_BY_CATEGORY.ONT),
    reason: 'Optical port / power board physical damage (Customer premise)',
  })

  const { toast, showToast } = useToast()

  const {
    data: meteringBundle,
    isLoading,
    error,
    reload: reloadMetering,
  } = useAsyncResource(async () => {
    const activated = getActivatedAccounts()
    const accounts = activated.map((acc) => ({
      ...acc,
      profile: resolveAccountBillingProfile(acc.accountId),
    }))
    const sessions = fetchCdrSessions('ALL')
    const damagedIncidents = fetchDamagedEquipmentIncidents('ALL', { includeBilled: true })
    const batchPreview = await previewMonthlyBillingBatch({ billingCycle })
    return {
      accounts,
      sessions,
      damagedIncidents,
      batchPreview,
    }
  }, [billingCycle])

  const accounts = useMemo(() => meteringBundle?.accounts || [], [meteringBundle])
  const sessions = useMemo(() => meteringBundle?.sessions || [], [meteringBundle])
  const damagedIncidents = useMemo(() => meteringBundle?.damagedIncidents || [], [meteringBundle])
  const batchPreview = meteringBundle?.batchPreview || null

  const activeProfile = useMemo(() => {
    if (selectedAccountId === 'ALL') return null
    const match = accounts.find((a) => a.accountId === selectedAccountId)
    return match?.profile || resolveAccountBillingProfile(selectedAccountId)
  }, [accounts, selectedAccountId])

  const defaultFormAccountId =
    (selectedAccountId !== 'ALL' ? selectedAccountId : accounts[0]?.accountId) || ''

  async function handleSyncCdr() {
    if (selectedAccountId === 'ALL') {
      const msg =
        'Select a specific subscriber Account ID before posting rated CDR, or run Full Multi-Account Monthly Billing.'
      setSyncError(msg)
      showToast(msg, 'error')
      return
    }
    setIsSyncing(true)
    setSyncError(null)
    try {
      const unbilledSessions = sessions.filter(
        (s) =>
          s.accountId === selectedAccountId &&
          !s.billedInvoiceId &&
          s.ratingStatus === 'BILLABLE' &&
          Number(s.chargeUSD) > 0
      )
      const inv = await syncCdrToInvoice(selectedAccountId, unbilledSessions, { billingCycle })
      markCdrSessionsBilled(
        unbilledSessions.map((s) => s.id),
        inv.invoiceId,
        inv.billingCycle || billingCycle
      )
      const isAdjustment =
        inv.billingSource === 'CN17_CDR_ADJUSTMENT' || inv.billingSource === 'CN17_CDR_SYNC'
      showToast(
        `${isAdjustment ? 'Created new CDR adjustment invoice' : 'Posted CDR usage to open invoice'} ${inv.invoiceId} for ${inv.customerName} (${inv.accountId}).`,
        'success'
      )
      await reloadMetering()
    } catch (err) {
      const msg = err?.message || 'CDR reconciliation encountered an error.'
      setSyncError(msg)
      showToast(msg, 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleRunMonthlyBatch(targetAccountIds = null) {
    setIsRunningBatch(true)
    setSyncError(null)
    try {
      const result = await runMonthlyBillingBatch({
        accountIds: targetAccountIds,
        billingCycle,
      })
      setBatchResult(result)
      if (result.generatedCount > 0) {
        showToast(
          `CN17 Monthly Billing generated ${result.generatedCount} invoice(s) totaling ${formatUSD(result.totalBilledUSD)} (incl. ${formatUSD(result.totalDamagedSurchargesUSD)} damaged CPE surcharges).`,
          'success'
        )
      } else {
        showToast(
          `No new invoices generated for ${billingCycle} (${result.skippedCount} account(s) already billed or inactive).`,
          'info'
        )
      }
      await reloadMetering()
    } catch (err) {
      const msg = err?.message || 'CN17 monthly billing batch encountered an error.'
      setSyncError(msg)
      showToast(msg, 'error')
    } finally {
      setIsRunningBatch(false)
    }
  }

  async function handleAddCdrEvent(e) {
    e.preventDefault()
    setSyncError(null)
    const targetAcc = newCdrForm.accountId || defaultFormAccountId
    try {
      const created = addCdrSession({
        accountId: targetAcc,
        chargeCategory: newCdrForm.chargeCategory,
        quantity: Number(newCdrForm.quantity),
        eventType: newCdrForm.eventType || undefined,
      })
      showToast(
        `Logged ${created.eventType} (${formatUSD(created.chargeUSD)}) for ${created.accountId}.`,
        'success'
      )
      setNewCdrForm((prev) => ({ ...prev, eventType: '' }))
      await reloadMetering()
    } catch (err) {
      const msg = err?.message || 'Unable to log CDR event.'
      setSyncError(msg)
      showToast(msg, 'error')
    }
  }

  async function handleRecordDamageSurcharge(e) {
    e.preventDefault()
    setSyncError(null)
    const targetAcc = damageForm.accountId || defaultFormAccountId
    try {
      const created = recordDamagedEquipmentFee(targetAcc, {
        category: damageForm.category,
        deviceSerial: damageForm.deviceSerial,
        deviceModel: damageForm.deviceModel,
        feeUSD: damageForm.feeUSD,
        reason: damageForm.reason,
      })
      showToast(
        `Recorded damaged hardware surcharge ${formatUSD(created.feeUSD)} (${created.deviceModel}) on ${created.accountId}.`,
        'success'
      )
      setDamageForm((prev) => ({ ...prev, deviceSerial: '', deviceModel: '' }))
      await reloadMetering()
    } catch (err) {
      const msg = err?.message || 'Unable to record damaged equipment surcharge.'
      setSyncError(msg)
      showToast(msg, 'error')
    }
  }

  function handleExportCsv() {
    if (filteredSessions.length === 0) return
    const headers = [
      'SessionId',
      'AccountId',
      'CustomerName',
      'TaxId',
      'Category',
      'Quantity',
      'Unit',
      'ChargeUSD',
      'RatingStatus',
      'BilledInvoiceId',
    ]
    const csvRows = [
      headers.join(','),
      ...filteredSessions.map((s) =>
        [
          s.id,
          s.accountId,
          `"${String(s.customerName || '').replace(/"/g, '""')}"`,
          s.taxId || '',
          s.chargeCategory || s.category,
          s.quantity ?? 1,
          s.unit || 'unit',
          Number(s.chargeUSD || 0).toFixed(2),
          s.ratingStatus,
          s.billedInvoiceId || 'UNBILLED',
        ].join(',')
      ),
    ]
    if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `CDR_Metering_${selectedAccountId}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
    showToast(`Exported ${filteredSessions.length} CDR record(s) for ${selectedAccountId}.`, 'info')
  }

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchAcc = selectedAccountId === 'ALL' || s.accountId === selectedAccountId
      const matchCat =
        selectedCategory === 'ALL' ||
        s.category === selectedCategory ||
        s.chargeCategory === selectedCategory
      const q = searchQuery.trim().toLowerCase()
      const matchSearch =
        q === '' ||
        s.id.toLowerCase().includes(q) ||
        String(s.accountId || '').toLowerCase().includes(q) ||
        String(s.customerName || '').toLowerCase().includes(q) ||
        String(s.service || '').toLowerCase().includes(q) ||
        String(s.sourceIp || '').includes(q)
      return matchAcc && matchCat && matchSearch
    })
  }, [sessions, selectedAccountId, selectedCategory, searchQuery])

  const filteredDamageIncidents = useMemo(() => {
    return damagedIncidents.filter(
      (d) => selectedAccountId === 'ALL' || d.accountId === selectedAccountId
    )
  }, [damagedIncidents, selectedAccountId])

  const totals = useMemo(() => {
    const totalCharge = filteredSessions.reduce((sum, s) => sum + (Number(s.chargeUSD) || 0), 0)
    const totalVolume = filteredSessions.reduce((sum, s) => sum + (Number(s.totalVolumeGB) || 0), 0)
    const unbilledDamageTotal = filteredDamageIncidents
      .filter((d) => !d.billedInvoiceId && d.status !== 'BILLED')
      .reduce((sum, d) => sum + (Number(d.feeUSD) || 0), 0)
    return {
      totalCharge,
      totalVolume,
      count: filteredSessions.length,
      unbilledDamageTotal,
    }
  }, [filteredSessions, filteredDamageIncidents])

  return (
    <AccountsLayout activeNavId="cdr" toast={toast}>
      <div className="card p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Finance &amp; Revenue</span>
              <ChevronRight size={12} />
              <span>CN17 Monthly Billing &amp; CDR Mediation</span>
              <ChevronRight size={12} />
              {activeProfile ? (
                <>
                  <span className="font-bold text-navy">{activeProfile.customerName}</span>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.2 font-mono text-[11px] font-bold text-brand-soft">
                    ID: {activeProfile.accountId}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold text-navy">All Activated Accounts</span>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.2 font-mono text-[11px] font-bold text-brand-soft">
                    {accounts.length} Accounts Scanned
                  </span>
                </>
              )}
            </div>
            <h1 className="mt-1.5 text-xl font-extrabold text-navy md:text-2xl">
              Call Detail Records (CDR) &amp; Multi-Account Monthly Billing (CN17)
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-black text-sky-800">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> LOCAL_DEMO_BILLING
              </span>
              <span className="text-slate-500">
                Cycle: <strong>{billingCycle}</strong>
              </span>
              <span className="text-slate-300">&bull;</span>
              {activeProfile ? (
                <>
                  <span className="text-slate-500">
                    MST: <strong className="font-mono">{activeProfile.taxId}</strong>
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-slate-500">
                    Service: <strong className="font-mono text-indigo-700">{activeProfile.serviceType}</strong> ({activeProfile.serviceTitle})
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-slate-500">
                    Order: <strong className="font-mono">#{activeProfile.orderId}</strong>
                  </span>
                </>
              ) : (
                <span className="text-slate-500">
                  Scope: <strong className="text-sky-700">Plan MRC + Local/STD Voice + SMS + Overtime + Damaged CPE Surcharges</strong>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isLoading || isRunningBatch || accounts.length === 0}
              onClick={() => handleRunMonthlyBatch(selectedAccountId === 'ALL' ? null : [selectedAccountId])}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
            >
              <Layers size={14} />
              <span>
                {isRunningBatch
                  ? 'Billing Batch...'
                  : selectedAccountId === 'ALL'
                  ? 'Run Full Multi-Account Monthly Billing'
                  : `Generate Monthly Bill (${selectedAccountId})`}
              </span>
            </button>
            <button
              type="button"
              disabled={isLoading || isSyncing || selectedAccountId === 'ALL'}
              onClick={handleSyncCdr}
              title={
                selectedAccountId === 'ALL'
                  ? 'Select a single Account ID to post CDR items only, or use Multi-Account Monthly Billing.'
                  : `Post rated CDR usage to ${selectedAccountId}`
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition cursor-pointer disabled:opacity-45"
            >
              <Receipt size={14} />
              <span>{isSyncing ? 'Posting...' : 'Post CDR Usage Only'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddTools((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
            >
              <Plus size={14} />
              <span>{showAddTools ? 'Hide Inputs' : 'Log CDR / Damaged CPE'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isLoading || filteredSessions.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={reloadMetering}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <RotateCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Subscriber Account Filter (Multi-Account Scan)
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value)
                setSyncError(null)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy focus:border-brand-soft focus:outline-none"
            >
              <option value="ALL">
                ALL — Scan All Activated Subscriber Accounts ({accounts.length} accounts)
              </option>
              {accounts.map((acc) => (
                <option key={acc.accountId} value={acc.accountId}>
                  {acc.accountId} &bull; {acc.profile.customerName} (MST: {acc.profile.taxId} &bull; {acc.profile.serviceType})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Target Billing Cycle
            </label>
            <select
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy focus:border-brand-soft focus:outline-none"
            >
              <option value="01/04/2026 – 30/04/2026">01/04/2026 – 30/04/2026 (Apr 2026)</option>
              <option value="01/05/2026 – 31/05/2026">01/05/2026 – 31/05/2026 (May 2026)</option>
              <option value="01/06/2026 – 30/06/2026">01/06/2026 – 30/06/2026 (Jun 2026)</option>
            </select>
          </div>
        </div>

        {syncError && (
          <div className="mt-4">
            <AsyncStatePanel
              compact
              state="error"
              title="CDR / Monthly Billing Notice"
              description={syncError}
              actionLabel="Dismiss"
              onAction={() => setSyncError(null)}
            />
          </div>
        )}

        {batchResult && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                CN17 Monthly Batch Completed &bull; Cycle {batchResult.billingCycle}
              </div>
              <span className="font-mono font-bold text-emerald-800">
                Generated: {batchResult.generatedCount} | Skipped: {batchResult.skippedCount} | Total: {formatUSD(batchResult.totalBilledUSD)}
              </span>
            </div>
            {batchResult.generatedInvoices.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {batchResult.generatedInvoices.map((inv) => (
                  <div
                    key={inv.invoiceId}
                    className="rounded-xl border border-emerald-200 bg-white px-3 py-2 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-mono font-bold text-navy truncate">{inv.invoiceId}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {inv.customerName} &bull; {inv.serviceType}
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-emerald-700">
                      {formatUSD(inv.remainingBalance)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showAddTools && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form
              onSubmit={handleAddCdrEvent}
              className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3 text-xs"
            >
              <div className="font-extrabold text-navy">
                Log Metered CDR Usage Event (Local / STD / SMS / Overtime)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Account ID</label>
                  <select
                    value={newCdrForm.accountId || defaultFormAccountId}
                    onChange={(e) => setNewCdrForm((p) => ({ ...p, accountId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.accountId} value={acc.accountId}>
                        {acc.accountId} ({acc.profile.customerName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Usage Type &amp; Rate</label>
                  <select
                    value={newCdrForm.chargeCategory}
                    onChange={(e) => setNewCdrForm((p) => ({ ...p, chargeCategory: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy"
                  >
                    {Object.values(CDR_UNIT_RATES).map((rate) => (
                      <option key={rate.code} value={rate.code}>
                        {rate.label} (${rate.rateUSD}/{rate.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Quantity ({CDR_UNIT_RATES[newCdrForm.chargeCategory]?.unit || 'unit'})
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    required
                    value={newCdrForm.quantity}
                    onChange={(e) => setNewCdrForm((p) => ({ ...p, quantity: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-navy"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Event Description</label>
                  <input
                    type="text"
                    placeholder="Auto from usage type if blank"
                    value={newCdrForm.eventType}
                    onChange={(e) => setNewCdrForm((p) => ({ ...p, eventType: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-[11px] font-bold text-indigo-700">
                  Rated Preview: {formatUSD((Number(newCdrForm.quantity) || 0) * (CDR_UNIT_RATES[newCdrForm.chargeCategory]?.rateUSD || 0))}
                </span>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  Add CDR Usage
                </button>
              </div>
            </form>

            <form
              onSubmit={handleRecordDamageSurcharge}
              className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 text-xs"
            >
              <div className="font-extrabold text-amber-950 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-600" />
                Record Damaged CPE Surcharge (CN17 Phụ phí thiết bị hỏng)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Subscriber Account</label>
                  <select
                    value={damageForm.accountId || defaultFormAccountId}
                    onChange={(e) => setDamageForm((p) => ({ ...p, accountId: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.accountId} value={acc.accountId}>
                        {acc.accountId} ({acc.profile.customerName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Equipment Category</label>
                  <select
                    value={damageForm.category}
                    onChange={(e) => {
                      const cat = e.target.value
                      setDamageForm((p) => ({
                        ...p,
                        category: cat,
                        feeUSD: String(EQUIPMENT_DAMAGE_FEE_BY_CATEGORY[cat] || 100),
                      }))
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-navy"
                  >
                    <option value="ONT">GPON ONT ($85.00 std)</option>
                    <option value="ROUTER">Managed Leased Router ($220.00 std)</option>
                    <option value="VOIP">SIP / IP-PBX Gateway ($180.00 std)</option>
                    <option value="MODEM">V.92 Dial-Up Modem ($65.00 std)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Serial / Model (optional)</label>
                  <input
                    type="text"
                    placeholder="Defaults to assigned hardware S/N"
                    value={damageForm.deviceSerial}
                    onChange={(e) => setDamageForm((p) => ({ ...p, deviceSerial: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Surcharge Fee (USD)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={damageForm.feeUSD}
                    onChange={(e) => setDamageForm((p) => ({ ...p, feeUSD: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-rose-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Damage Inspection Reason</label>
                <input
                  type="text"
                  required
                  value={damageForm.reason}
                  onChange={(e) => setDamageForm((p) => ({ ...p, reason: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"
                >
                  Add Damaged Hardware Surcharge
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="mt-5">
            <AsyncStatePanel
              state="loading"
              title="Loading multi-account CDR & CN17 billing ledger..."
              description="Scanning activated accounts, voice/SMS/overtime CDR sessions, and damaged hardware surcharges."
            />
          </div>
        ) : error ? (
          <div className="mt-5">
            <AsyncStatePanel
              state="error"
              title="Unable to load CDR records"
              description={error}
              onRetry={reloadMetering}
            />
          </div>
        ) : (
        <>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              FILTERED CDR SESSIONS
            </div>
            <div className="mt-1 text-2xl font-black text-navy">{totals.count}</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>Local / STD / SMS / Overtime</span>
              <span className="font-bold text-indigo-600">
                {selectedAccountId === 'ALL' ? `${accounts.length} Accounts` : selectedAccountId}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                FILTERED CDR CHARGES
              </span>
              <span className="rounded bg-sky-100 px-1.5 py-0.2 text-[10px] font-black text-sky-800">
                PRE-TAX
              </span>
            </div>
            <div className="mt-1 text-2xl font-black text-indigo-700">{formatUSD(totals.totalCharge)}</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>Excl. {STATUTORY_TAX_RATE_PERCENT}% Statutory VAT</span>
              <span className="font-bold text-sky-700">{totals.totalVolume.toFixed(1)} GB</span>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                UNBILLED DAMAGED CPE FEES
              </span>
              <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-black text-amber-900">
                SURCHARGE
              </span>
            </div>
            <div className="mt-1 text-2xl font-black text-amber-700">{formatUSD(totals.unbilledDamageTotal)}</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-amber-800/80 border-t border-amber-200/70 pt-1.5">
              <span>{filteredDamageIncidents.filter((d) => !d.billedInvoiceId && d.status !== 'BILLED').length} unbilled unit(s)</span>
              <span className="font-bold">Incl. in CN17 Batch</span>
            </div>
          </div>

          <div className="rounded-2xl p-4 bg-navy text-white shadow-lg shadow-navy/20 border-none">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                BATCH TOTAL ({batchPreview?.eligibleCount || 0} BILLABLE)
              </span>
              <span className="rounded bg-sky-500/20 px-1.5 py-0.2 text-[10px] font-black text-sky-300">
                CN17 SCAN
              </span>
            </div>
            <div className="mt-1 text-2xl font-black text-white">
              {formatUSD(batchPreview?.grandTotalPayableUSD || 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300 border-t border-white/10 pt-1.5">
              <span>Net: {formatUSD(batchPreview?.grandTotalNetUSD || 0)}</span>
              <span className="font-bold text-sky-300">+{STATUTORY_TAX_RATE_PERCENT}% VAT</span>
            </div>
          </div>
        </div>

        {batchPreview && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <div>
                <h2 className="text-sm font-extrabold text-navy">
                  Multi-Account Monthly Billing Scan Preview ({billingCycle})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Combines monthly plan MRC, Local/STD voice minutes, SMS gateway, overtime/excess usage, damaged CPE fees, and fixed {STATUTORY_TAX_RATE_PERCENT}% VAT.
                </p>
              </div>
              <span className="font-mono text-[11px] font-bold text-indigo-700">
                Eligible: {batchPreview.eligibleCount} &bull; Skipped: {batchPreview.skippedCount}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3">Account &amp; Customer (MST)</th>
                    <th className="py-2.5 px-3">Service</th>
                    <th className="py-2.5 px-3 text-right">Plan MRC</th>
                    <th className="py-2.5 px-3 text-right">Local / STD / SMS</th>
                    <th className="py-2.5 px-3 text-right">Overtime</th>
                    <th className="py-2.5 px-3 text-right">Damaged CPE</th>
                    <th className="py-2.5 px-3 text-right">Net + {STATUTORY_TAX_RATE_PERCENT}% VAT</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchPreview.statements
                    .filter((s) => selectedAccountId === 'ALL' || s.accountId === selectedAccountId)
                    .map((stmt) => (
                    <tr key={stmt.accountId} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-navy">{stmt.accountId}</div>
                        <div className="font-semibold text-slate-700">{stmt.profile.customerName}</div>
                        <div className="text-[10px] text-slate-400">MST: {stmt.profile.taxId}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                          {stmt.profile.serviceType}
                        </span>
                        <div className="mt-0.5 text-[11px] text-slate-500">{stmt.profile.serviceTitle}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                        {formatUSD(stmt.subscriptionFeeUSD)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        <div>{formatUSD(stmt.localVoiceUSD + stmt.stdVoiceUSD + stmt.smsFeeUSD)}</div>
                        <div className="text-[10px] text-slate-400">
                          {stmt.localMinutes}m / {stmt.stdMinutes}m / {stmt.smsCount}sms
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {formatUSD(stmt.overtimeBurstUSD)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {stmt.damagedEquipmentFeeUSD > 0 ? (
                          <span className="font-bold text-rose-600">
                            +{formatUSD(stmt.damagedEquipmentFeeUSD)} ({stmt.damagedEquipmentCount})
                          </span>
                        ) : (
                          <span className="text-slate-400">$0.00</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-black text-navy">{formatUSD(stmt.totalPayableUSD)}</div>
                        <div className="text-[10px] text-slate-400">
                          Net {formatUSD(stmt.subtotalUSD)} + Tax {formatUSD(stmt.taxUSD)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {stmt.billable ? (
                          <button
                            type="button"
                            disabled={isRunningBatch}
                            onClick={() => handleRunMonthlyBatch([stmt.accountId])}
                            className="rounded-lg bg-navy px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                          >
                            Bill Account
                          </button>
                        ) : (
                          <span className="inline-block rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                            {stmt.alreadyBilledInvoiceId ? `Billed (${stmt.alreadyBilledInvoiceId})` : 'Skipped'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredDamageIncidents.length > 0 && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-amber-100 bg-amber-50/60 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-extrabold text-amber-950">
                Hardware Damage Surcharges Registry ({filteredDamageIncidents.length})
              </span>
              <span className="text-[11px] text-amber-800">Automatically added to account monthly CN17 invoices</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {filteredDamageIncidents.map((dmg) => (
                <div key={dmg.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-navy">{dmg.accountId}</span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span className="font-bold text-slate-800">{dmg.deviceModel}</span>
                    <span className="ml-2 font-mono text-[11px] text-slate-500">SN: {dmg.deviceSerial}</span>
                    <div className="text-[11px] text-slate-500">{dmg.reason}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        dmg.billedInvoiceId || dmg.status === 'BILLED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {dmg.billedInvoiceId ? `BILLED (${dmg.billedInvoiceId})` : 'UNBILLED'}
                    </span>
                    <span className="font-mono font-black text-rose-700">{formatUSD(dmg.feeUSD)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 p-4 gap-3 bg-slate-50/50">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: 'All Categories' },
                { id: 'VOICE', label: 'Local & STD Voice' },
                { id: 'SMS', label: 'SMS Gateway' },
                { id: 'BURST', label: 'Overtime / Burst' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    selectedCategory === c.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search session, account, customer, IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                  <th className="py-3 px-4">Session ID / Timestamp</th>
                  <th className="py-3 px-4">Subscriber Account</th>
                  <th className="py-3 px-4">Service &amp; VLAN</th>
                  <th className="py-3 px-4">Event Classification</th>
                  <th className="py-3 px-4">Metered Qty / Duration</th>
                  <th className="py-3 px-4">Status / Billing</th>
                  <th className="py-3 px-4 text-right">Charge (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-4">
                      <AsyncStatePanel
                        compact
                        state="empty"
                        icon={Search}
                        title="No matching CDR sessions"
                        description="No call detail records match the active account, category tab, or search keyword."
                        actionLabel="Clear Filters"
                        onAction={() => {
                          setSelectedAccountId('ALL')
                          setSelectedCategory('ALL')
                          setSearchQuery('')
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{s.id}</div>
                        <div className="text-[10px] text-slate-400">{s.timestamp}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-brand-soft">{s.accountId}</div>
                        <div className="text-[11px] text-slate-600">{s.customerName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{s.service}</div>
                        <div className="font-mono text-[10px] text-indigo-600">{s.vlan}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-800">{s.eventType}</td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {s.duration}
                        {s.unitRateUSD > 0 ? ` (@ $${s.unitRateUSD}/${s.unit})` : ''}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            s.billedInvoiceId
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : s.ratingStatus === 'BILLABLE'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {s.billedInvoiceId ? `BILLED (${s.billedInvoiceId})` : s.ratingStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ${Number(s.chargeUSD || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>
    </AccountsLayout>
  )
}
