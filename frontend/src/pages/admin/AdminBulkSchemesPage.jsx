import { useState, useMemo } from 'react'
import {
  Layers,
  Percent,
  CheckCircle2,
  Calculator,
  Search,
  Building2,
  AlertTriangle,
  Edit3,
  RotateCcw,
  X,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { useToast } from '../../hooks/useToast'
import { fetchOrders } from '../../services/orderService'
import {
  SERVICE_NAMES,
  SIMULATOR_MIN_ENDPOINTS,
  SIMULATOR_MAX_ENDPOINTS,
  fetchBulkSchemeTiers,
  updateBulkSchemeTier,
  resetBulkSchemeTiers,
  formatTierRange,
  clampSimulatorEndpoints,
  calcBulk,
  getTierInfo,
  auditOrderBulkScheme,
  formatUSD,
} from '../../services/bulkScheme'

const SIMULATOR_PRESETS = [5, 10, 20, 35, 60, 500]

export default function AdminBulkSchemesPage() {
  const {
    data: ordersData,
    isLoading,
    error,
    reload,
  } = useAsyncResource(() => Promise.resolve(fetchOrders()), [])
  const orders = ordersData || []
  const { toast, showToast } = useToast()

  const [tiers, setTiers] = useState(() => fetchBulkSchemeTiers())
  const [simService, setSimService] = useState('BROADBAND')
  const [simEndpointsInput, setSimEndpointsInput] = useState('20')
  const [simEndpoints, setSimEndpoints] = useState(20)
  const [simNotice, setSimNotice] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('ALL')

  const [editingTier, setEditingTier] = useState(null)
  const [editForm, setEditForm] = useState({
    tier: '',
    minEndpoints: 1,
    maxEndpoints: '',
    discountPercent: 0,
    freeGpon: false,
    benefit: '',
  })
  const [editError, setEditError] = useState('')
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)

  const simInputBlank = String(simEndpointsInput).trim() === ''

  const simulation = useMemo(() => {
    if (simInputBlank) return null
    const safeEndpoints = clampSimulatorEndpoints(simEndpoints)
    return {
      ...calcBulk(safeEndpoints, simService, tiers),
      tier: getTierInfo(safeEndpoints, tiers),
      endpoints: safeEndpoints,
    }
  }, [simInputBlank, simEndpoints, simService, tiers])

  function handleSimulatorEndpointsChange(rawValue) {
    if (rawValue === '') {
      setSimEndpointsInput('')
      setSimNotice('Enter an integer between 1 and 500 endpoints.')
      return
    }
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) return
    const truncated = Math.trunc(parsed)
    const clamped = clampSimulatorEndpoints(truncated)
    setSimEndpoints(clamped)
    setSimEndpointsInput(String(clamped))
    if (truncated < SIMULATOR_MIN_ENDPOINTS || truncated > SIMULATOR_MAX_ENDPOINTS) {
      setSimNotice(
        `Adjusted to allowed simulator range (${SIMULATOR_MIN_ENDPOINTS}–${SIMULATOR_MAX_ENDPOINTS} endpoints).`
      )
    } else if (parsed !== truncated) {
      setSimNotice('Decimal values are rounded down to whole endpoints.')
    } else {
      setSimNotice('')
    }
  }

  function handleSimulatorEndpointsBlur() {
    if (String(simEndpointsInput).trim() === '') {
      setSimEndpoints(SIMULATOR_MIN_ENDPOINTS)
      setSimEndpointsInput(String(SIMULATOR_MIN_ENDPOINTS))
      setSimNotice('')
    }
  }

  function handleSelectPreset(presetCount) {
    const clamped = clampSimulatorEndpoints(presetCount)
    setSimEndpoints(clamped)
    setSimEndpointsInput(String(clamped))
    setSimNotice('')
  }

  const auditedRecords = useMemo(() => {
    return orders.map((ord) => ({
      order: ord,
      audit: auditOrderBulkScheme(ord, tiers),
    }))
  }, [orders, tiers])

  const filteredAudits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return auditedRecords.filter(({ order, audit }) => {
      const matchesTier =
        tierFilter === 'ALL' ||
        (tierFilter === 'QUALIFIED' && audit.expectedPercent > 0) ||
        (tierFilter === 'STANDARD' && audit.expectedPercent === 0) ||
        (tierFilter === 'MISMATCH' && audit.auditStatus === 'MISMATCH') ||
        (tierFilter === 'UNRECORDED' && audit.auditStatus === 'UNRECORDED')

      const matchesQuery =
        !q ||
        (order.id || '').toLowerCase().includes(q) ||
        (order.customerName || '').toLowerCase().includes(q) ||
        (order.planName || '').toLowerCase().includes(q)

      return matchesTier && matchesQuery
    })
  }, [auditedRecords, searchQuery, tierFilter])

  const summary = useMemo(() => {
    const tierOrderCounts = {}
    for (const tier of tiers) {
      tierOrderCounts[tier.id] = 0
    }

    let bulkEligibleCount = 0
    let standardCount = 0
    let recordedSavedUSD = 0
    let expectedSavedUSD = 0
    let matchedCount = 0
    let mismatchCount = 0
    let unrecordedCount = 0

    for (const { audit } of auditedRecords) {
      const tierId = audit.expectedTier.id
      tierOrderCounts[tierId] = (tierOrderCounts[tierId] || 0) + 1

      if (audit.expectedPercent > 0) bulkEligibleCount += 1
      else standardCount += 1

      expectedSavedUSD += audit.expectedSavedUSD
      if (audit.actualSavedUSD != null) {
        recordedSavedUSD += audit.actualSavedUSD
      }

      if (audit.auditStatus === 'MATCHED') matchedCount += 1
      else if (audit.auditStatus === 'MISMATCH') mismatchCount += 1
      else unrecordedCount += 1
    }

    return {
      totalOrders: auditedRecords.length,
      bulkEligibleCount,
      standardCount,
      recordedSavedUSD: Number(recordedSavedUSD.toFixed(2)),
      expectedSavedUSD: Number(expectedSavedUSD.toFixed(2)),
      matchedCount,
      mismatchCount,
      unrecordedCount,
      tierOrderCounts,
    }
  }, [auditedRecords, tiers])

  function openEditTierModal(tier) {
    setEditingTier(tier)
    setEditForm({
      tier: tier.tier,
      minEndpoints: tier.minEndpoints,
      maxEndpoints: tier.maxEndpoints == null ? '' : String(tier.maxEndpoints),
      discountPercent: tier.discountPercent,
      freeGpon: Boolean(tier.freeGpon),
      benefit: tier.benefit,
    })
    setEditError('')
  }

  function closeEditTierModal() {
    setEditingTier(null)
    setEditError('')
  }

  function handleSaveTierEdit(e) {
    e.preventDefault()
    if (!editingTier) return
    setEditError('')

    const editingIndex = tiers.findIndex((t) => t.id === editingTier.id)
    const isLast = editingIndex === tiers.length - 1

    try {
      const updated = updateBulkSchemeTier(editingTier.id, {
        tier: editForm.tier,
        minEndpoints: Number(editForm.minEndpoints),
        maxEndpoints: isLast ? null : Number(editForm.maxEndpoints),
        discountPercent: Number(editForm.discountPercent),
        freeGpon: editForm.freeGpon,
        benefit: editForm.benefit,
      })
      setTiers(updated)
      closeEditTierModal()
      showToast(`Updated policy tier "${editForm.tier.trim()}".`, 'info')
    } catch (err) {
      setEditError(err?.message || 'Unable to update policy tier.')
    }
  }

  function handleConfirmResetDefaults() {
    const restored = resetBulkSchemeTiers()
    setTiers(restored)
    setIsResetModalOpen(false)
    showToast('Restored statutory default bulk policy tiers (0%, 25%, 50%, 75%, 100%).', 'info')
  }

  const editingIndex = editingTier ? tiers.findIndex((t) => t.id === editingTier.id) : -1
  const isEditingFirst = editingIndex === 0
  const isEditingLast = editingTier ? editingIndex === tiers.length - 1 : false
  const policyRatesLabel = tiers.map((t) => `${t.discountPercent}%`).join(', ')

  return (
    <AdminLayout activeNavId="schemes" toast={toast}>
      {editingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Edit Bulk Policy Tier</h3>
                <p className="text-xs text-slate-500">
                  Update endpoint thresholds, deposit waiver rate, and SLA benefits.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditTierModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {editError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTierEdit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Tier Name *</label>
                <input
                  type="text"
                  value={editForm.tier}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, tier: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Min Endpoints *</label>
                  <input
                    type="number"
                    min={1}
                    disabled={isEditingFirst}
                    value={editForm.minEndpoints}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, minEndpoints: e.target.value }))}
                    className={`w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs font-bold outline-none ${
                      isEditingFirst
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-50 text-slate-800 focus:bg-white focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Endpoints</label>
                  {isEditingLast ? (
                    <input
                      type="text"
                      disabled
                      value="Unlimited (+)"
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-xs font-bold text-slate-400 cursor-not-allowed"
                    />
                  ) : (
                    <input
                      type="number"
                      min={1}
                      value={editForm.maxEndpoints}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, maxEndpoints: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Deposit Waiver (%) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={editForm.discountPercent}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, discountPercent: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
                Endpoint boundaries stay contiguous automatically so adjacent tiers never overlap or leave
                coverage gaps.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hardware / SLA Benefit *
                </label>
                <input
                  type="text"
                  value={editForm.benefit}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, benefit: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.freeGpon}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, freeGpon: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Include Free GPON ONT / Priority Hardware Benefit</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEditTierModal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                >
                  Save Tier Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 border border-amber-200">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Reset Statutory Bulk Tiers?</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Restore all 5 tiers back to default thresholds (1–9: 0%, 10–15: 25%, 16–25: 50%, 26–50: 75%,
                  &gt;50: 100%).
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDefaults}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"
              >
                Restore Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5 md:p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Carrier Administration</span>
              <span>/</span>
              <span className="font-semibold text-slate-700">Enterprise Schemes</span>
              <span>/</span>
              <span className="font-mono text-brand-soft">Bulk Schemes Audit</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-navy">
                Enterprise Bulk Scheme Tiers &amp; Deposit Waiver Audit
              </h1>
              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-soft">
                {tiers.length} POLICY TIERS
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Volume threshold governance &amp; stored retail order audit ({policyRatesLabel} deposit waiver schedule)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Tracked Store Orders
            </span>
            <div className="mt-1.5 font-mono text-2xl font-black text-slate-900">
              {isLoading ? '...' : summary.totalOrders}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {summary.bulkEligibleCount} bulk-eligible · {summary.standardCount} standard tier
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Recorded Deposit Waiver Saved
            </span>
            <div className="mt-1.5 font-mono text-2xl font-black text-indigo-700">
              {isLoading ? '...' : formatUSD(summary.recordedSavedUSD)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Expected by active policy: {formatUSD(summary.expectedSavedUSD)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Policy Compliance Audit
            </span>
            <div className="mt-1.5 font-mono text-2xl font-black text-emerald-700">
              {isLoading ? '...' : `${summary.matchedCount} / ${summary.totalOrders}`}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {summary.mismatchCount} mismatch{summary.mismatchCount === 1 ? '' : 'es'} ·{' '}
              {summary.unrecordedCount} unrecorded
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-indigo-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Corporate Bulk Discount Policy Schedule ({tiers.length} Tiers)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset Defaults</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-100 bg-slate-50/40 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Tier</th>
                    <th className="px-4 py-2.5">Volume Range</th>
                    <th className="px-4 py-2.5">Deposit Waiver</th>
                    <th className="px-4 py-2.5">Hardware / SLA Benefit</th>
                    <th className="px-4 py-2.5 text-right">Orders</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {tiers.map((tier) => (
                    <tr key={tier.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-bold text-slate-900">{tier.tier}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-indigo-700 whitespace-nowrap">
                        {formatTierRange(tier)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                            tier.discountPercent === 0
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <Percent size={10} /> {tier.discountPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">{tier.benefit}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                        {summary.tierOrderCounts[tier.id] || 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEditTierModal(tier)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Edit3 size={11} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calculator size={16} className="text-indigo-600" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Policy Audit Simulator
                </h2>
                <p className="text-[11px] text-slate-500">
                  Verify waiver compliance by service &amp; endpoint count ({SIMULATOR_MIN_ENDPOINTS}–
                  {SIMULATOR_MAX_ENDPOINTS})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Service Category</label>
                <select
                  value={simService}
                  onChange={(e) => setSimService(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                >
                  {Object.entries(SERVICE_NAMES).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Endpoints Count ({SIMULATOR_MIN_ENDPOINTS}–{SIMULATOR_MAX_ENDPOINTS})
                </label>
                <input
                  type="number"
                  min={SIMULATOR_MIN_ENDPOINTS}
                  max={SIMULATOR_MAX_ENDPOINTS}
                  step={1}
                  value={simEndpointsInput}
                  onChange={(e) => handleSimulatorEndpointsChange(e.target.value)}
                  onBlur={handleSimulatorEndpointsBlur}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SIMULATOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`rounded-lg border px-2 py-1 font-mono text-[11px] font-bold cursor-pointer transition ${
                    !simInputBlank && simEndpoints === preset
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {preset} sites
                </button>
              ))}
            </div>

            {simNotice && (
              <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
                <AlertTriangle size={13} className="shrink-0" />
                <span>{simNotice}</span>
              </div>
            )}

            {simulation ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Simulated Endpoints</span>
                  <span className="font-mono font-bold text-slate-900">{simulation.endpoints} sites</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Qualified Tier</span>
                  <span className="font-bold text-indigo-800">{simulation.tier.tierName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Standard Deposit Gross</span>
                  <span className="font-mono font-bold text-slate-800">{formatUSD(simulation.gross)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">
                    Bulk Discount ({simulation.tier.percent}%)
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    -{formatUSD(simulation.saved)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-indigo-200/60 pt-2">
                  <span className="font-bold text-slate-900">Net Deposit Payable</span>
                  <span className="font-mono text-base font-black text-indigo-700">
                    {formatUSD(simulation.payable)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-1">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span>{simulation.tier.desc}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-semibold text-slate-500">
                Enter an endpoint count between {SIMULATOR_MIN_ENDPOINTS} and {SIMULATOR_MAX_ENDPOINTS} to
                simulate deposit waiver calculation.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-indigo-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Store Orders Bulk Audit Trail
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search order ID or customer..."
                  className="rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-700 outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Orders</option>
                <option value="QUALIFIED">Bulk Eligible (Expected &gt; 0%)</option>
                <option value="STANDARD">Standard Tier (Expected 0%)</option>
                <option value="MISMATCH">Discrepancy Only (Actual != Expected)</option>
                <option value="UNRECORDED">Unrecorded Discount Only</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <AsyncStatePanel
              state="loading"
              title="Loading Bulk Audit Records..."
              description="Reading enterprise order volumes and deposit waiver metrics."
            />
          ) : error ? (
            <AsyncStatePanel
              state="error"
              title="Failed to Load Audit Trail"
              description={error}
              actionLabel="Retry"
              onAction={reload}
            />
          ) : filteredAudits.length === 0 ? (
            <AsyncStatePanel
              state="empty"
              icon={Layers}
              title="No orders match this audit filter"
              description="Try switching filter criteria or clearing the search query."
              actionLabel="Reset Filter"
              onAction={() => {
                setSearchQuery('')
                setTierFilter('ALL')
              }}
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Subscriber</th>
                    <th className="px-4 py-3">Plan &amp; Endpoints</th>
                    <th className="px-4 py-3">Expected Policy</th>
                    <th className="px-4 py-3">Applied on Order</th>
                    <th className="px-4 py-3">Audit Check</th>
                    <th className="px-4 py-3">Order Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredAudits.map(({ order: ord, audit }) => (
                    <tr key={ord.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700">{ord.id}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{ord.customerName}</td>
                      <td className="px-4 py-3">
                        <span className="block font-semibold text-slate-800">{ord.planName}</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {audit.endpoints} {audit.endpoints === 1 ? 'endpoint' : 'endpoints'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-[11px] text-slate-700">
                          {audit.expectedTier.tierName}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-indigo-700">
                          Expected: {audit.expectedPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">
                        {audit.hasRecordedDiscount ? (
                          <span
                            className={
                              audit.auditStatus === 'MISMATCH'
                                ? 'text-rose-700'
                                : audit.actualPercent === 0
                                  ? 'text-slate-700'
                                  : 'text-emerald-700'
                            }
                          >
                            {audit.actualPercent}%
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">Unrecorded</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {audit.auditStatus === 'MATCHED' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 size={11} /> Matched
                          </span>
                        ) : audit.auditStatus === 'MISMATCH' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                            <AlertTriangle size={11} /> Mismatch ({audit.actualPercent}% vs{' '}
                            {audit.expectedPercent}%)
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                              audit.expectedPercent > 0
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {audit.expectedPercent > 0 ? 'Unrecorded (Review)' : 'Unrecorded'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={ord.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
