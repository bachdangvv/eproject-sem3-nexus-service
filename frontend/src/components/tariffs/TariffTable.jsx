import { useState, useMemo, useEffect } from 'react'
import {
  Search,
  Download,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Scale,
  AlertTriangle,
  RotateCcw,
  Lock,
  History,
  Eye,
  X,
  ArrowRight,
  GitBranch,
} from 'lucide-react'
import {
  PLAN_TYPE_OPTIONS,
  fetchPlans,
  addPlan,
  updatePlan,
  deletePlan,
  resetPlansToDefault,
  fetchTaxRate,
  normalizePlanConnectionType,
  subscribePlansUpdated,
  fetchPlanVersionHistory,
  getPlanCatalogVersionMeta,
  restoreCatalogVersion,
} from '../../services/planService'
import { STATUTORY_TAX_RATE_PERCENT, calculateStatutoryTax } from '../../services/taxConfig'
import { downloadCsvDocument } from '../../utils/telecomDocumentGenerator'
import { useToast } from '../../hooks/useToast'

const INITIAL_FORM_STATE = {
  sku: '',
  name: '',
  type: 'BROADBAND',
  cirMbps: 200,
  pirMbps: 500,
  monthlyNetUSD: 2500,
  cpeMonthlyUSD: 200,
  cpeModel: 'Nexus Wi-Fi 6 GPON Model NX-G820',
  domesticSpeed: '',
  ipStatic: '',
  status: 'ACTIVE',
  recommended: false,
  changeReason: '',
}

const ACTION_BADGE_STYLES = {
  INITIAL_SEED: 'bg-slate-100 text-slate-700 border-slate-200',
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
  RESTORE: 'bg-amber-50 text-amber-800 border-amber-200',
  RESET: 'bg-purple-50 text-purple-700 border-purple-200',
}

function getPlanTaxBreakdown(plan) {
  const subtotal = (Number(plan.monthlyNetUSD) || 0) + (Number(plan.cpeMonthlyUSD) || 0)
  const tax = calculateStatutoryTax(subtotal)
  const gross = Number((subtotal + tax).toFixed(2))
  return { subtotal, tax, gross }
}

function formatDiffValue(val, field) {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (field === 'monthlyNetUSD' || field === 'cpeMonthlyUSD') {
    const num = Number(val)
    return Number.isFinite(num) ? `$${num.toLocaleString()}` : String(val)
  }
  return String(val)
}

function formatRevisionTimestamp(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TariffTable({ readOnly = false }) {
  const [plans, setPlans] = useState(() => fetchPlans())
  const [versionHistory, setVersionHistory] = useState(() => fetchPlanVersionHistory())
  const [catalogMeta, setCatalogMeta] = useState(() => getPlanCatalogVersionMeta())
  const taxRate = STATUTORY_TAX_RATE_PERCENT

  const [viewSection, setViewSection] = useState('CATALOG')
  const [activeTab, setActiveTab] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [historyActionFilter, setHistoryActionFilter] = useState('ALL')
  const [historyPlanFilter, setHistoryPlanFilter] = useState('ALL')
  const [historySearch, setHistorySearch] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState(null)
  const [formError, setFormError] = useState('')
  const [deletingPlan, setDeletingPlan] = useState(null)
  const [inspectingVersion, setInspectingVersion] = useState(null)
  const [restoringEntry, setRestoringEntry] = useState(null)
  const { toast, showToast } = useToast()

  const [formData, setFormData] = useState(INITIAL_FORM_STATE)

  useEffect(() => {
    fetchTaxRate()
    const syncState = () => {
      setPlans(fetchPlans())
      setVersionHistory(fetchPlanVersionHistory())
      setCatalogMeta(getPlanCatalogVersionMeta())
    }
    syncState()
    return subscribePlansUpdated(syncState)
  }, [])

  const activePlansCount = useMemo(
    () => plans.filter((p) => p.status === 'ACTIVE').length,
    [plans]
  )

  const filteredPlans = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return plans.filter((p) => {
      const matchType =
        activeTab === 'ALL' ||
        normalizePlanConnectionType(p.type) === normalizePlanConnectionType(activeTab)
      const matchSearch =
        !query ||
        (p.name || '').toLowerCase().includes(query) ||
        (p.sku || p.id || '').toLowerCase().includes(query) ||
        (p.type || '').toLowerCase().includes(query)
      return matchType && matchSearch
    })
  }, [plans, activeTab, searchQuery])

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    return versionHistory.filter((entry) => {
      const matchAction =
        historyActionFilter === 'ALL' ||
        String(entry.action || '').toUpperCase() === historyActionFilter
      const matchPlan =
        historyPlanFilter === 'ALL' ||
        String(entry.planId || '').toUpperCase() === historyPlanFilter.toUpperCase() ||
        String(entry.sku || '').toUpperCase() === historyPlanFilter.toUpperCase()
      const matchSearch =
        !q ||
        (entry.versionTag || '').toLowerCase().includes(q) ||
        (entry.sku || '').toLowerCase().includes(q) ||
        (entry.planName || '').toLowerCase().includes(q) ||
        (entry.changedBy || '').toLowerCase().includes(q) ||
        (entry.note || '').toLowerCase().includes(q)
      return matchAction && matchPlan && matchSearch
    })
  }, [versionHistory, historyActionFilter, historyPlanFilter, historySearch])

  function openCreateModal() {
    setEditingPlanId(null)
    setFormData(INITIAL_FORM_STATE)
    setFormError('')
    setIsModalOpen(true)
  }

  function openEditModal(plan) {
    setEditingPlanId(plan.id)
    setFormData({
      sku: plan.sku || plan.id,
      name: plan.name || '',
      type: plan.type || 'BROADBAND',
      cirMbps: plan.cirMbps ?? 0,
      pirMbps: plan.pirMbps ?? 0,
      monthlyNetUSD: plan.monthlyNetUSD ?? 0,
      cpeMonthlyUSD: plan.cpeMonthlyUSD ?? 0,
      cpeModel: plan.cpeModel || 'Standard Carrier CPE',
      domesticSpeed: plan.domesticSpeed || '',
      ipStatic: plan.ipStatic || '',
      status: plan.status || 'ACTIVE',
      recommended: Boolean(plan.recommended),
      changeReason: '',
    })
    setFormError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingPlanId(null)
    setFormError('')
    setFormData(INITIAL_FORM_STATE)
  }

  function openPlanHistoryFilter(plan) {
    setHistoryPlanFilter(plan.sku || plan.id)
    setHistoryActionFilter('ALL')
    setViewSection('HISTORY')
  }

  function handleSavePlan(e) {
    e.preventDefault()
    if (readOnly) return
    setFormError('')

    const payload = {
      sku: formData.sku.trim().toUpperCase(),
      name: formData.name.trim(),
      type: formData.type,
      cirMbps: Number(formData.cirMbps) || 0,
      pirMbps: Number(formData.pirMbps) || 0,
      monthlyNetUSD: Number(formData.monthlyNetUSD) || 0,
      cpeMonthlyUSD: Number(formData.cpeMonthlyUSD) || 0,
      cpeModel: formData.cpeModel.trim(),
      domesticSpeed: formData.domesticSpeed.trim(),
      ipStatic: formData.ipStatic.trim(),
      status: formData.status,
      recommended: Boolean(formData.recommended),
    }

    const changeReason = formData.changeReason.trim()

    try {
      const updated = editingPlanId
        ? updatePlan(editingPlanId, payload, { changeReason })
        : addPlan(payload, { changeReason })
      setPlans(updated)
      setVersionHistory(fetchPlanVersionHistory())
      setCatalogMeta(getPlanCatalogVersionMeta())
      closeModal()
      showToast(
        editingPlanId
          ? `Tariff ${payload.name} updated and version history recorded.`
          : `Tariff ${payload.name} published and synced with Retail.`
      )
    } catch (err) {
      setFormError(err?.message || 'Unable to save tariff plan.')
    }
  }

  function handleConfirmDeletePlan() {
    if (readOnly || !deletingPlan) return
    const updated = deletePlan(deletingPlan.id)
    setPlans(updated)
    setVersionHistory(fetchPlanVersionHistory())
    setCatalogMeta(getPlanCatalogVersionMeta())
    showToast(`Plan ${deletingPlan.name} removed and logged in tariff history.`)
    setDeletingPlan(null)
  }

  function handleResetDefaults() {
    if (readOnly) return
    const defaults = resetPlansToDefault()
    setPlans(defaults)
    setVersionHistory(fetchPlanVersionHistory())
    setCatalogMeta(getPlanCatalogVersionMeta())
    showToast('Default tariff catalog restored and version logged.')
  }

  function handleConfirmRestoreVersion() {
    if (readOnly || !restoringEntry) return
    try {
      const { plans: restoredPlans } = restoreCatalogVersion(restoringEntry.entryId)
      setPlans(restoredPlans)
      setVersionHistory(fetchPlanVersionHistory())
      setCatalogMeta(getPlanCatalogVersionMeta())
      showToast(`Catalog rolled back to ${restoringEntry.versionTag} and synced with Retail.`)
      setRestoringEntry(null)
    } catch (err) {
      showToast(err?.message || 'Unable to restore catalog snapshot.', 'error')
      setRestoringEntry(null)
    }
  }

  function exportCSV() {
    if (viewSection === 'HISTORY') {
      const headers = ['Version', 'Action', 'SKU', 'Plan Name', 'Changed At', 'Actor', 'Summary Note', 'Diffs']
      const rows = filteredHistory.map((h) => [
        h.versionTag,
        h.action,
        h.sku,
        h.planName,
        h.changedAt,
        h.changedBy,
        h.note,
        (h.changes || [])
          .map((c) => `${c.label}: ${formatDiffValue(c.before, c.field)} -> ${formatDiffValue(c.after, c.field)}`)
          .join(' | '),
      ])
      downloadCsvDocument(headers, rows, `Tariff_Version_History_${Date.now()}.csv`)
      showToast('Tariff version history exported to CSV.')
      return
    }

    const headers = ['SKU', 'Plan Version', 'Plan Name', 'Type', 'Status', 'Net Monthly ($)', 'CPE Fee ($)', 'Tax Rate (%)', 'Tax Amount ($)', 'Gross Total ($)']
    const rows = filteredPlans.map((p) => {
      const { tax, gross } = getPlanTaxBreakdown(p)
      return [
        p.sku || p.id,
        `v${p.version || 1}`,
        p.name || '',
        p.type,
        p.status,
        p.monthlyNetUSD,
        p.cpeMonthlyUSD || 0,
        taxRate,
        tax,
        gross,
      ]
    })
    downloadCsvDocument(headers, rows, `Tariff_Catalogue_${catalogMeta.versionTag}_${Date.now()}.csv`)
    showToast('Tariff table exported to CSV.')
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toast.message}</span>
        </div>
      )}

      {isModalOpen && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingPlanId ? 'Edit Tariff Package & Pricing' : 'Provision New Tariff Package'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NX-FTTH-1G"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Network Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                  >
                    {PLAN_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Plan Commercial Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FTTH Enterprise Dedicated 1Gbps"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Net Fee ($)</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="1"
                    value={formData.monthlyNetUSD}
                    onChange={(e) => setFormData({ ...formData, monthlyNetUSD: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CPE Rental Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cpeMonthlyUSD}
                    onChange={(e) => setFormData({ ...formData, cpeMonthlyUSD: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Catalog Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                  >
                    <option value="ACTIVE">ACTIVE (Visible in Retail)</option>
                    <option value="INACTIVE">INACTIVE (Hidden in Retail)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Committed CIR (Mbps)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.cirMbps}
                    onChange={(e) => setFormData({ ...formData, cirMbps: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Peak PIR (Mbps)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.pirMbps}
                    onChange={(e) => setFormData({ ...formData, pirMbps: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Retail Speed Label (Optional)</label>
                  <input
                    type="text"
                    placeholder="Auto from CIR/PIR if blank"
                    value={formData.domesticSpeed}
                    onChange={(e) => setFormData({ ...formData, domesticSpeed: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">IP / VLAN Allocation</label>
                  <input
                    type="text"
                    placeholder="e.g. VLAN 402 • Static IPv4"
                    value={formData.ipStatic}
                    onChange={(e) => setFormData({ ...formData, ipStatic: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Managed CPE Hardware Model</label>
                <input
                  type="text"
                  value={formData.cpeModel}
                  onChange={(e) => setFormData({ ...formData, cpeModel: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Revision Note / Change Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q2 pricing adjustment or CPE upgrade"
                  value={formData.changeReason}
                  onChange={(e) => setFormData({ ...formData, changeReason: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={formData.recommended}
                  onChange={(e) => setFormData({ ...formData, recommended: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Highlight as Popular / Default selection in Retail Order Form</span>
              </label>

              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer"
                >
                  {editingPlanId ? 'Save Tariff Changes' : 'Publish Tariff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingPlan && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600 border border-rose-200">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Delete Tariff SKU?</h3>
                <p className="text-xs text-slate-500">{deletingPlan.sku} &bull; {deletingPlan.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              This removes the plan from Retail selection and records a permanent <span className="font-mono font-bold">DELETE</span> revision in CN03 version history.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPlan(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePlan}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
              >
                Delete Tariff
              </button>
            </div>
          </div>
        </div>
      )}

      {restoringEntry && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 border border-amber-200">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Restore Catalog Snapshot {restoringEntry.versionTag}?</h3>
                <p className="text-xs text-slate-500">
                  {restoringEntry.catalogSnapshot?.length || 0} SKUs &bull; Saved {formatRevisionTimestamp(restoringEntry.changedAt)}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Restoring replaces active tariff prices with snapshot <span className="font-mono font-bold">{restoringEntry.versionTag}</span>, syncs immediately to Retail, and appends a new <span className="font-mono font-bold">RESTORE</span> entry to history.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoringEntry(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreVersion}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {inspectingVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-xs font-black text-indigo-700">
                    {inspectingVersion.versionTag}
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    Tariff Catalog Snapshot ({inspectingVersion.catalogSnapshot?.length || 0} SKUs)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Captured {formatRevisionTimestamp(inspectingVersion.changedAt)} by {inspectingVersion.changedBy} &bull; {inspectingVersion.note}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingVersion(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Close snapshot preview"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-auto flex-1 rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Plan Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-center">Plan Rev</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Net ($)</th>
                    <th className="py-2.5 px-3 text-right">CPE ($)</th>
                    <th className="py-2.5 px-3 text-right">Gross (12.24%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(inspectingVersion.catalogSnapshot || []).map((item) => {
                    const { gross } = getPlanTaxBreakdown(item)
                    return (
                      <tr key={item.id || item.sku} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.sku}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{item.name}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{item.type}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-indigo-600">
                          v{item.version || 1}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              item.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ${Number(item.monthlyNetUSD || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          ${Number(item.cpeMonthlyUSD || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600">
                          ${gross.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
              {!readOnly && Array.isArray(inspectingVersion.catalogSnapshot) && (
                <button
                  type="button"
                  onClick={() => {
                    const target = inspectingVersion
                    setInspectingVersion(null)
                    setRestoringEntry(target)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"
                >
                  <RotateCcw size={13} /> Restore This Version
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectingVersion(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Active Tariffs</span>
          <div className="mt-2 text-2xl font-black text-slate-900">{activePlansCount}</div>
          <div className="mt-1 text-[11px] text-slate-400">{plans.length} total SKUs in master catalog</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Catalog Version (CN03)</span>
            <GitBranch size={14} className="text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-indigo-600">{catalogMeta.versionTag}</span>
            <button
              type="button"
              onClick={() => setViewSection('HISTORY')}
              className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              {versionHistory.length} revisions &rarr;
            </button>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 truncate">
            Last: {formatRevisionTimestamp(catalogMeta.lastUpdatedAt)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Statutory Tax (Fixed)</span>
          <div className="mt-2 text-2xl font-black text-emerald-600">{taxRate}%</div>
          <div className="mt-1 text-[11px] text-slate-400">Read-only across tariffs, billing &amp; reports</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Role Clearance</span>
          <div className="mt-2 text-2xl font-black text-slate-800">
            {readOnly ? 'Read-Only' : 'CRUD + History'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {readOnly ? 'Price lookup & version audit trail' : 'Synced to Retail with revision tracking'}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
            <Scale size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              Statutory Telecom Tax Formula: Total = (Net Plan + CPE) &times; (1 + {taxRate}%)
            </div>
            <div className="text-[11px] text-slate-500">
              Pre-tax prices are net. Fixed {taxRate}% statutory tax applies uniformly across tariffs, billing invoices, and version snapshots.
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 shrink-0">
          <Lock size={13} />
          <span>Fixed Rate: {taxRate}% (Read-Only)</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
          <button
            type="button"
            onClick={() => setViewSection('CATALOG')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              viewSection === 'CATALOG'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Tariff Matrix ({plans.length})
          </button>
          <button
            type="button"
            onClick={() => setViewSection('HISTORY')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              viewSection === 'HISTORY'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={13} />
            <span>Version History &amp; Change Log ({versionHistory.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            <Download size={14} />
            <span>{viewSection === 'HISTORY' ? 'Export History CSV' : 'Export Tariffs CSV'}</span>
          </button>

          {!readOnly && viewSection === 'CATALOG' && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer"
            >
              <Plus size={14} />
              <span>New Tariff</span>
            </button>
          )}
        </div>
      </div>

      {viewSection === 'CATALOG' ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 p-4 gap-3 bg-slate-50/50">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: 'All Tariffs' },
                { id: 'BROADBAND', label: 'Broadband FTTH' },
                { id: 'DIALUP', label: 'Leased Line / Dial-Up' },
                { id: 'LANDLINE', label: 'Landline / SIP' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search plan, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                  <th className="py-3 px-4">SKU &amp; Rev</th>
                  <th className="py-3 px-4">Commercial Plan Name</th>
                  <th className="py-3 px-4">Bandwidth Profile</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Net Monthly ($)</th>
                  <th className="py-3 px-4 text-right">Tax ({taxRate}%)</th>
                  <th className="py-3 px-4 text-right">Gross Total ($)</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 px-4 text-center">
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-600">
                          {plans.length === 0
                            ? 'No tariff plans in catalog.'
                            : 'No tariff plans match your current filter or search.'}
                        </p>
                        {!readOnly && plans.length === 0 && (
                          <button
                            type="button"
                            onClick={handleResetDefaults}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <RotateCcw size={12} /> Restore Default Tariffs
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan) => {
                    const { tax, gross } = getPlanTaxBreakdown(plan)

                    return (
                      <tr key={plan.id || plan.sku} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{plan.sku || plan.id}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                              v{plan.version || 1}
                            </span>
                          </div>
                          {plan.recommended && (
                            <span className="mt-1 inline-block rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
                              POPULAR
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{plan.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {plan.type} &bull; {plan.cpeModel}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px]">
                          <div>{plan.domesticSpeed}</div>
                          <div className="text-[10px] text-slate-400 font-sans">{plan.ipStatic}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              plan.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {plan.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          ${plan.monthlyNetUSD.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-semibold">
                          +${tax.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-indigo-600 text-sm">
                          ${gross.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openPlanHistoryFilter(plan)}
                              className="rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                              title="View SKU Revision History"
                            >
                              <History size={14} />
                            </button>
                            {!readOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(plan)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                  title="Edit Plan & Price"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingPlan(plan)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Delete Tariff"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 p-4 gap-3 bg-slate-50/50">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: 'All Events' },
                { id: 'UPDATE', label: 'Price / Spec Edits' },
                { id: 'CREATE', label: 'Created' },
                { id: 'DELETE', label: 'Removed' },
                { id: 'RESTORE', label: 'Restored' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryActionFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    historyActionFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {historyPlanFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setHistoryPlanFilter('ALL')}
                  className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                >
                  <span>SKU: {historyPlanFilter}</span>
                  <X size={12} />
                </button>
              )}
              <div className="relative w-56 sm:w-64">
                <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search version, SKU, actor, note..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredHistory.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-slate-400">
                No tariff version history entries match the active filters.
              </div>
            ) : (
              filteredHistory.map((entry) => (
                <div key={entry.entryId} className="p-4 sm:p-5 hover:bg-slate-50/60 transition space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-black text-white">
                          {entry.versionTag}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${
                            ACTION_BADGE_STYLES[entry.action] || ACTION_BADGE_STYLES.INITIAL_SEED
                          }`}
                        >
                          {entry.action}
                        </span>
                        <span className="font-mono text-xs font-bold text-indigo-600">
                          {entry.sku}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{entry.planName}</span>
                        {entry.planVersion && entry.action !== 'INITIAL_SEED' && (
                          <span className="text-[10px] font-mono text-slate-400">
                            (Plan rev v{entry.planVersion})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">{entry.note}</div>
                      <div className="text-[11px] text-slate-400">
                        {formatRevisionTimestamp(entry.changedAt)} &bull; Operator:{' '}
                        <strong className="text-slate-600">{entry.changedBy}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setInspectingVersion(entry)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <Eye size={12} /> Snapshot ({entry.catalogSnapshot?.length || 0})
                      </button>
                      {!readOnly && Array.isArray(entry.catalogSnapshot) && (
                        <button
                          type="button"
                          onClick={() => setRestoringEntry(entry)}
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
                        >
                          <RotateCcw size={12} /> Restore
                        </button>
                      )}
                    </div>
                  </div>

                  {Array.isArray(entry.changes) && entry.changes.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                      {entry.changes.map((diff, idx) => (
                        <div
                          key={`${entry.entryId}-${diff.field}-${idx}`}
                          className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-[11px]"
                        >
                          <span className="font-bold text-slate-500 block">{diff.label}</span>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono">
                            {diff.before !== null && diff.before !== undefined && (
                              <>
                                <span className="text-rose-600 line-through">
                                  {formatDiffValue(diff.before, diff.field)}
                                </span>
                                <ArrowRight size={11} className="text-slate-400 shrink-0" />
                              </>
                            )}
                            <span className="font-bold text-emerald-700">
                              {formatDiffValue(diff.after, diff.field)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
