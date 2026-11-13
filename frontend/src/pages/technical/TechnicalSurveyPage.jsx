import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  Send,
  HardHat,
  Search,
  Radio,
  RotateCw,
  ArrowRight,
  AlertTriangle,
  FileText,
  Download,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import TechnicalLayout from '../../components/layout/TechnicalLayout'
import surveyService, {
  MAX_SURVEY_DISTANCE_METERS,
  MIN_OVERRIDE_REASON_LENGTH,
  SURVEY_INFEASIBILITY_REASONS,
} from '../../services/surveyService'
import {
  validateOrderDocumentsPresent,
  checkDocumentAvailability,
  openDocumentPreview,
  triggerDocumentDownload,
} from '../../services/documentStorageService'
import { useToast } from '../../hooks/useToast'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { ORDER_STATUS } from '../../utils/orderStatus'

function resolvePresetReasonState(rejectionReason, isOverDistance, isMissingDocs) {
  const trimmed = String(rejectionReason || '').trim()
  if (trimmed) {
    const exactMatch = SURVEY_INFEASIBILITY_REASONS.find(
      (item) => item.code !== 'OTHER' && trimmed === item.label
    )
    if (exactMatch) {
      return { code: exactMatch.code, notes: '' }
    }
    const prefixMatch = SURVEY_INFEASIBILITY_REASONS.find(
      (item) => item.code !== 'OTHER' && trimmed.startsWith(`${item.label} — `)
    )
    if (prefixMatch) {
      return {
        code: prefixMatch.code,
        notes: trimmed.slice(`${prefixMatch.label} — `.length),
      }
    }
    return { code: 'OTHER', notes: trimmed }
  }
  if (isMissingDocs) {
    return { code: 'MISSING_DOCUMENTS', notes: '' }
  }
  if (isOverDistance) {
    return { code: 'DISTANCE_EXCEEDS_500M', notes: '' }
  }
  return { code: SURVEY_INFEASIBILITY_REASONS[0].code, notes: '' }
}

function formatInfeasibilityReason(code, notes) {
  const cleanNotes = String(notes || '').trim()
  if (code === 'OTHER') {
    return cleanNotes
  }
  const preset = SURVEY_INFEASIBILITY_REASONS.find((item) => item.code === code)
  if (!preset) {
    return cleanNotes
  }
  return cleanNotes ? `${preset.label} — ${cleanNotes}` : preset.label
}

function formatDocBytes(size) {
  if (!Number.isFinite(Number(size)) || Number(size) <= 0) return ''
  const bytes = Number(size)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function TechnicalSurveyPage() {
  const navigate = useNavigate()
  const {
    data: ordersData,
    setData: setOrders,
    isLoading,
    error,
    reload: reloadSurveys,
  } = useAsyncResource(() => surveyService.fetchSurveyOrders(), [])
  const orders = ordersData || []
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const { toast, showToast } = useToast()

  useEffect(() => {
    if (!ordersData) return
    if (ordersData.length === 0) {
      setSelectedOrderId('')
      return
    }
    setSelectedOrderId((prev) => {
      if (prev && ordersData.some((o) => o.id === prev)) return prev
      return ordersData[0].id
    })
  }, [ordersData])

  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || orders[0] || null
  }, [orders, selectedOrderId])

  const [formDistance, setFormDistance] = useState(185)
  const [formPort, setFormPort] = useState(4)
  const [formConduit, setFormConduit] = useState('HDPE 110mm Duct')
  const [formResult, setFormResult] = useState('FEASIBLE')
  const [formReasonCode, setFormReasonCode] = useState(SURVEY_INFEASIBILITY_REASONS[0].code)
  const [formReasonNotes, setFormReasonNotes] = useState('')
  const [formAllowOverride, setFormAllowOverride] = useState(false)
  const [formOverrideReason, setFormOverrideReason] = useState('')
  const [docStorageState, setDocStorageState] = useState({
    checking: false,
    nationalIdAvailable: true,
    addressProofAvailable: true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const selectedDocVerification = useMemo(
    () => validateOrderDocumentsPresent(selectedOrder),
    [selectedOrder]
  )

  const syncFormFromOrder = useCallback((ord) => {
    if (!ord) return
    const docs = validateOrderDocumentsPresent(ord)
    const dist = ord.distanceMeters || 200
    const isOver = Number(dist) > MAX_SURVEY_DISTANCE_METERS
    const presetState = resolvePresetReasonState(
      ord.rejectionReason,
      isOver,
      !docs.isComplete
    )
    setFormDistance(dist)
    setFormPort(ord.reservedPort || 1)
    setFormConduit(ord.conduitType || 'HDPE 110mm Duct')
    setFormAllowOverride(Boolean(ord.distanceOverrideApproved))
    setFormOverrideReason(ord.distanceOverrideReason || '')
    setFormReasonCode(presetState.code)
    setFormReasonNotes(presetState.notes)
    setFormResult(
      !docs.isComplete || ord.status === ORDER_STATUS.NOT_FEASIBLE
        ? 'INFEASIBLE'
        : 'FEASIBLE'
    )
    setSubmitError(null)
  }, [])

  useEffect(() => {
    syncFormFromOrder(selectedOrder)
  }, [selectedOrder?.id, syncFormFromOrder])

  useEffect(() => {
    let cancelled = false
    if (!selectedOrder) {
      setDocStorageState({
        checking: false,
        nationalIdAvailable: false,
        addressProofAvailable: false,
      })
      return
    }

    const verifyStoredFiles = async () => {
      setDocStorageState({
        checking: true,
        nationalIdAvailable: selectedDocVerification.hasNationalId,
        addressProofAvailable: selectedDocVerification.hasAddressProof,
      })

      const [natAvailable, addrAvailable] = await Promise.all([
        selectedDocVerification.hasNationalId
          ? checkDocumentAvailability(selectedDocVerification.nationalId)
          : Promise.resolve(false),
        selectedDocVerification.hasAddressProof
          ? checkDocumentAvailability(selectedDocVerification.addressProof)
          : Promise.resolve(false),
      ])

      if (cancelled) return
      setDocStorageState({
        checking: false,
        nationalIdAvailable: natAvailable,
        addressProofAvailable: addrAvailable,
      })

      if (!natAvailable || !addrAvailable) {
        setFormResult('INFEASIBLE')
        setFormReasonCode((prev) =>
          prev === 'OTHER' || selectedOrder.rejectionReason ? prev : 'MISSING_DOCUMENTS'
        )
      }
    }

    verifyStoredFiles()
    return () => {
      cancelled = true
    }
  }, [
    selectedOrder?.id,
    selectedDocVerification.hasNationalId,
    selectedDocVerification.hasAddressProof,
  ])

  function handleSelectOrder(ord) {
    setSelectedOrderId(ord.id)
    if (ord.id === selectedOrder?.id) {
      syncFormFromOrder(ord)
    }
  }

  const parsedDistance = Number(formDistance)
  const isDistanceValid = Number.isFinite(parsedDistance) && parsedDistance > 0
  const isOverDistanceLimit = isDistanceValid && parsedDistance > MAX_SURVEY_DISTANCE_METERS
  const isOverrideReady =
    !isOverDistanceLimit ||
    (formAllowOverride && formOverrideReason.trim().length >= MIN_OVERRIDE_REASON_LENGTH)
  const isDocsVerified =
    selectedDocVerification.isComplete &&
    !docStorageState.checking &&
    docStorageState.nationalIdAvailable &&
    docStorageState.addressProofAvailable
  const isMissingOrUnavailableDocs =
    !selectedDocVerification.isComplete ||
    (!docStorageState.checking &&
      (!docStorageState.nationalIdAvailable || !docStorageState.addressProofAvailable))
  const isSubmitBlocked =
    formResult === 'FEASIBLE' &&
    (!isDistanceValid || docStorageState.checking || isMissingOrUnavailableDocs || !isOverrideReady)

  async function handleViewDocument(docMeta) {
    try {
      await openDocumentPreview(docMeta)
    } catch (err) {
      showToast(err?.message || 'Unable to preview document.', 'error')
    }
  }

  async function handleDownloadDocument(docMeta) {
    try {
      await triggerDocumentDownload(docMeta)
    } catch (err) {
      showToast(err?.message || 'Unable to download document.', 'error')
    }
  }

  async function handleSubmitSurvey(e) {
    e.preventDefault()
    if (!selectedOrder) return

    if (formResult === 'FEASIBLE') {
      if (isMissingOrUnavailableDocs || docStorageState.checking) {
        const msg =
          'Cannot mark FEASIBLE: both Citizen ID (CCCD) and Proof of Installation Address must be present and verified in storage.'
        setSubmitError(msg)
        showToast(msg, 'error')
        return
      }
      if (!isDistanceValid) {
        const msg = 'Optical span distance must be greater than 0 meters.'
        setSubmitError(msg)
        showToast(msg, 'error')
        return
      }
      if (isOverDistanceLimit && !isOverrideReady) {
        const msg = `Optical span ${parsedDistance}m exceeds ${MAX_SURVEY_DISTANCE_METERS}m limit. Authorize a Senior NOC override with justification or mark INFEASIBLE.`
        setSubmitError(msg)
        showToast(msg, 'error')
        return
      }
    }

    const compiledRejectionReason = formatInfeasibilityReason(formReasonCode, formReasonNotes)
    if (formResult === 'INFEASIBLE' && formReasonCode === 'OTHER' && compiledRejectionReason.length < 5) {
      const msg = 'Please enter technical details (at least 5 characters) when selecting Other.'
      setSubmitError(msg)
      showToast(msg, 'error')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      let response
      if (formResult === 'FEASIBLE') {
        response = await surveyService.approveSurveyFeasible(selectedOrder.id, {
          distanceMeters: parsedDistance,
          reservedPort: Number(formPort),
          conduitType: formConduit,
          odfName: selectedOrder.odfName,
          rxPowerDbm: -18.4,
          fieldEngineer: 'Do Manh Cuong (NOC)',
          allowDistanceOverride: isOverDistanceLimit && formAllowOverride,
          overrideReason: isOverDistanceLimit && formAllowOverride ? formOverrideReason.trim() : '',
        })
        showToast(`Survey for ${selectedOrder.id} marked FEASIBLE and saved.`)
      } else {
        response = await surveyService.rejectSurveyUnfeasible(
          selectedOrder.id,
          compiledRejectionReason || SURVEY_INFEASIBILITY_REASONS[0].label,
          { distanceMeters: isDistanceValid ? parsedDistance : undefined }
        )
        showToast(`Survey for ${selectedOrder.id} marked NOT FEASIBLE and saved.`)
      }

      if (response?.order) {
        setOrders((prev) =>
          (prev || []).map((o) => (o.id === response.order.id ? response.order : o))
        )
      } else {
        await reloadSurveys()
      }
    } catch (err) {
      const msg = err?.message || 'Error recording survey verdict.'
      setSubmitError(msg)
      showToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const surveyMetrics = useMemo(() => {
    const pendingCount = orders.filter((o) => o.status === ORDER_STATUS.PENDING_SURVEY).length
    const feasibleCount = orders.filter((o) => o.status === ORDER_STATUS.FEASIBLE).length
    const notFeasibleCount = orders.filter((o) => o.status === ORDER_STATUS.NOT_FEASIBLE).length
    const urgentPendingCount = orders.filter(
      (o) => o.status === ORDER_STATUS.PENDING_SURVEY && o.isUrgent
    ).length
    const decidedCount = feasibleCount + notFeasibleCount
    const feasibilityRate = decidedCount > 0 ? Math.round((feasibleCount / decidedCount) * 100) : 0
    return {
      pendingCount,
      feasibleCount,
      notFeasibleCount,
      urgentPendingCount,
      decidedCount,
      feasibilityRate,
    }
  }, [orders])

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return orders.filter((o) => {
      const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter
      const matchesQuery =
        !q ||
        (o.id || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.address || '').toLowerCase().includes(q)
      return matchesStatus && matchesQuery
    })
  }, [orders, statusFilter, searchQuery])

  return (
    <TechnicalLayout activeNavId="surveys" toast={toast}>
      <div className="card p-5 md:p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Outside Plant Engineering</span>
              <span>/</span>
              <span className="font-semibold text-slate-700">Feasibility Assessment</span>
              <span>/</span>
              <span className="font-mono text-brand-soft">ODN Survey</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-navy">
                ODN Optical Distribution Feasibility Survey
              </h1>
              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-soft">
                &le; 500M LIMIT
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Distance validation (&le; 500m), splitter port verification, conduit checks, and shared order sync
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/technical/activations"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
            >
              <span>Activation Queue</span>
              <ArrowRight size={13} />
            </Link>
            <button
              type="button"
              onClick={reloadSurveys}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <RotateCw size={13} /> Refresh Queue
            </button>
          </div>
        </div>

        {isLoading ? (
          <AsyncStatePanel
            state="loading"
            title="Loading ODN feasibility survey queue..."
            description="Synchronizing pending field inspections, splitter box assignments, and optical span estimates."
          />
        ) : error ? (
          <AsyncStatePanel
            state="error"
            title="Unable to load survey queue"
            description={error}
            onRetry={reloadSurveys}
          />
        ) : orders.length === 0 ? (
          <AsyncStatePanel
            state="empty"
            icon={HardHat}
            title="Survey Queue Empty"
            description="No pending or surveyed retail orders were found in the shared store."
            actionLabel="Refresh Queue"
            onAction={reloadSurveys}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Pending Review
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{surveyMetrics.pendingCount}</span>
                  <span className="text-xs font-bold text-brand">of {orders.length} Tracked</span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  SLA Priority
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-rose-600">{surveyMetrics.urgentPendingCount}</span>
                  <span className="text-xs font-bold text-rose-500">Urgent Pending</span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Feasibility Rate
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-600">
                    {surveyMetrics.decidedCount > 0 ? `${surveyMetrics.feasibilityRate}%` : '—'}
                  </span>
                  <span className="text-xs font-bold text-emerald-500">
                    {surveyMetrics.feasibleCount} Feasible / {surveyMetrics.notFeasibleCount} Rejected
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Max Distance Standard
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-indigo-600">500m</span>
                  <span className="text-xs font-bold text-slate-400">Optical Limit</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search order ID, enterprise customer, street address..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-brand"
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                      {filteredOrders.length} Orders
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'ALL', label: `All (${orders.length})` },
                      { id: ORDER_STATUS.PENDING_SURVEY, label: `Pending (${surveyMetrics.pendingCount})` },
                      { id: ORDER_STATUS.FEASIBLE, label: `Feasible (${surveyMetrics.feasibleCount})` },
                      { id: ORDER_STATUS.NOT_FEASIBLE, label: `Not Feasible (${surveyMetrics.notFeasibleCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusFilter(tab.id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                          statusFilter === tab.id
                            ? 'bg-navy text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredOrders.length === 0 ? (
                    <AsyncStatePanel
                      compact
                      state="empty"
                      icon={Search}
                      title="No matching survey orders"
                      description="No ODN survey orders matched your filter criteria."
                      actionLabel="Reset Filter"
                      onAction={() => {
                        setSearchQuery('')
                        setStatusFilter('ALL')
                      }}
                    />
                  ) : (
                    filteredOrders.map((ord) => {
                      const isSelected = ord.id === selectedOrderId
                      const cardDocStatus = validateOrderDocumentsPresent(ord)
                      const isCardOverLimit = Number(ord.distanceMeters) > MAX_SURVEY_DISTANCE_METERS
                      return (
                        <div
                          key={ord.id}
                          onClick={() => handleSelectOrder(ord)}
                          className={`rounded-2xl border p-4 transition cursor-pointer ${
                            isSelected
                              ? 'border-brand bg-brand/5 shadow-sm ring-1 ring-brand/30'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-navy">{ord.id}</span>
                              <OrderStatusBadge status={ord.status} />
                              {ord.status === ORDER_STATUS.PENDING_SURVEY && ord.isUrgent && (
                                <span className="rounded-full bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5">
                                  URGENT
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                  cardDocStatus.isComplete
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {cardDocStatus.isComplete ? '2/2 Docs' : 'Missing Docs'}
                              </span>
                              {isCardOverLimit && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                    ord.distanceOverrideApproved
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {ord.distanceOverrideApproved ? '>500m Override' : '>500m Limit'}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                              <Clock size={12} /> SLA: {ord.slaTimeRemaining}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-slate-900">{ord.customerName}</h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <MapPin size={12} className="text-slate-400" /> {ord.address}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-600 border-t border-slate-100 pt-2">
                            <div className="flex flex-wrap items-center gap-4">
                              <span>
                                Service: <strong className="text-slate-800">{ord.serviceTitle}</strong>
                              </span>
                              <span>
                                Target ODF: <strong className="text-slate-800">{ord.odfName}</strong>
                              </span>
                              <span>
                                Est. Span: <strong className="text-brand font-mono">{ord.distanceMeters}m</strong>
                              </span>
                            </div>
                            {ord.status === ORDER_STATUS.FEASIBLE && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/technical/activations/${encodeURIComponent(ord.id)}`)
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                              >
                                <span>Proceed to Activation</span>
                                <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="lg:col-span-5">
                {selectedOrder ? (
                  <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-black text-brand uppercase tracking-wider block">
                          ODN FEASIBILITY ASSESSMENT
                        </span>
                        <h2 className="text-base font-black text-slate-900 mt-0.5">{selectedOrder.id}</h2>
                        <p className="text-xs text-slate-500">{selectedOrder.customerName}</p>
                      </div>
                      <OrderStatusBadge status={selectedOrder.status} />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <FileText size={13} className="text-brand" />
                          <span>Verification Dossier (KYC)</span>
                        </span>
                        {docStorageState.checking ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            Verifying storage...
                          </span>
                        ) : isDocsVerified ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <ShieldCheck size={11} /> 2 / 2 Verified
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 flex items-center gap-1">
                            <ShieldAlert size={11} /> Blocked — Incomplete
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {[
                          {
                            key: 'nationalId',
                            label: 'Citizen ID / National ID (CCCD)',
                            doc: selectedDocVerification.nationalId,
                            hasMeta: selectedDocVerification.hasNationalId,
                            available: docStorageState.nationalIdAvailable,
                          },
                          {
                            key: 'addressProof',
                            label: 'Proof of Installation Address',
                            doc: selectedDocVerification.addressProof,
                            hasMeta: selectedDocVerification.hasAddressProof,
                            available: docStorageState.addressProofAvailable,
                          },
                        ].map((item) => {
                          const docReady =
                            item.hasMeta && !docStorageState.checking && item.available
                          const docMissingStorage =
                            item.hasMeta && !docStorageState.checking && !item.available
                          return (
                            <div
                              key={item.key}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${
                                docReady
                                  ? 'border-slate-200 bg-white'
                                  : 'border-rose-200 bg-rose-50/70'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 truncate">{item.label}</p>
                                {item.doc ? (
                                  <p className="text-[10px] text-slate-500 truncate">
                                    {item.doc.name || 'Attached file'}
                                    {formatDocBytes(item.doc.size)
                                      ? ` (${formatDocBytes(item.doc.size)})`
                                      : ''}
                                    {docMissingStorage ? ' — missing from storage' : ''}
                                  </p>
                                ) : (
                                  <p className="text-[10px] font-semibold text-rose-600">
                                    Not uploaded on order
                                  </p>
                                )}
                              </div>
                              {docReady ? (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleViewDocument(item.doc)}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                  >
                                    <ExternalLink size={10} /> View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadDocument(item.doc)}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                                  >
                                    <Download size={10} />
                                  </button>
                                </div>
                              ) : (
                                <span className="shrink-0 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                  {docMissingStorage ? 'File Lost' : 'Missing'}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {isMissingOrUnavailableDocs && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-semibold text-rose-700 flex items-start gap-2">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          <span>
                            FEASIBLE approval is blocked until both CCCD and Proof of Address are attached and verified in storage. Reject as INFEASIBLE or ask Retail to re-upload.
                          </span>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSubmitSurvey} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Distance to Nearest ODF (Meters) &bull; Limit &le; {MAX_SURVEY_DISTANCE_METERS}m
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="5000"
                          value={formDistance}
                          onChange={(e) => setFormDistance(e.target.value)}
                          className={`w-full rounded-xl border px-3 py-2 text-xs font-bold outline-none ${
                            isOverDistanceLimit
                              ? 'border-rose-300 bg-rose-50 text-rose-700'
                              : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-brand'
                          }`}
                        />
                        {isOverDistanceLimit && (
                          <div className="mt-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 flex items-start gap-2">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>
                              Optical span ({parsedDistance}m) exceeds the {MAX_SURVEY_DISTANCE_METERS}m ODN standard limit. FEASIBLE is blocked unless an authorized Senior NOC override is recorded below.
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Port</label>
                          <input
                            type="number"
                            min="1"
                            max="32"
                            value={formPort}
                            onChange={(e) => setFormPort(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Target ODF Box</label>
                          <input
                            type="text"
                            disabled
                            value={selectedOrder.odfName}
                            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Conduit Infrastructure
                        </label>
                        <input
                          type="text"
                          value={formConduit}
                          onChange={(e) => setFormConduit(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-brand outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Survey Decision</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={isMissingOrUnavailableDocs}
                            onClick={() => setFormResult('FEASIBLE')}
                            className={`rounded-xl py-2 px-3 text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                              isMissingOrUnavailableDocs
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-70'
                                : formResult === 'FEASIBLE'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs cursor-pointer'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            <CheckCircle2 size={14} />
                            <span>FEASIBLE (Pass)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormResult('INFEASIBLE')
                              if (isMissingOrUnavailableDocs) {
                                setFormReasonCode('MISSING_DOCUMENTS')
                              } else if (isOverDistanceLimit) {
                                setFormReasonCode('DISTANCE_EXCEEDS_500M')
                              }
                            }}
                            className={`rounded-xl py-2 px-3 text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              formResult === 'INFEASIBLE'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <XCircle size={14} />
                            <span>INFEASIBLE (Fail)</span>
                          </button>
                        </div>
                      </div>

                      {formResult === 'FEASIBLE' && isOverDistanceLimit && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3 space-y-2.5">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formAllowOverride}
                              onChange={(e) => setFormAllowOverride(e.target.checked)}
                              className="mt-0.5 rounded border-amber-400 text-amber-700 focus:ring-amber-500"
                            />
                            <span className="text-xs font-bold text-amber-900">
                              Authorize Senior NOC &gt;{MAX_SURVEY_DISTANCE_METERS}m Feasibility Override
                            </span>
                          </label>
                          {formAllowOverride && (
                            <div>
                              <label className="block text-[11px] font-bold text-amber-900 mb-1">
                                Technical Override Justification (min {MIN_OVERRIDE_REASON_LENGTH} characters)
                              </label>
                              <textarea
                                rows={2}
                                required
                                value={formOverrideReason}
                                onChange={(e) => setFormOverrideReason(e.target.value)}
                                placeholder="e.g. OTDR measured -19.2 dBm via auxiliary splitter splice; Senior NOC approved SLA exception."
                                className="w-full rounded-xl border border-amber-300 bg-white p-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                              />
                              <span className="mt-1 block text-[10px] font-medium text-amber-800">
                                {formOverrideReason.trim().length} / {MIN_OVERRIDE_REASON_LENGTH} characters minimum
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {formResult === 'INFEASIBLE' && (
                        <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Infeasibility Reason (Preset Standard)
                            </label>
                            <select
                              value={formReasonCode}
                              onChange={(e) => setFormReasonCode(e.target.value)}
                              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-rose-400"
                            >
                              {SURVEY_INFEASIBILITY_REASONS.map((reason) => (
                                <option key={reason.code} value={reason.code}>
                                  {reason.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              {formReasonCode === 'OTHER'
                                ? 'Technical Infeasibility Details (Required)'
                                : 'Additional Field Notes (Optional)'}
                            </label>
                            <textarea
                              rows={2}
                              required={formReasonCode === 'OTHER'}
                              value={formReasonNotes}
                              onChange={(e) => setFormReasonNotes(e.target.value)}
                              placeholder={
                                formReasonCode === 'OTHER'
                                  ? 'Describe the specific optical/civil obstacle (min 5 characters)...'
                                  : 'Optional OTDR dBm reading, manhole ID, or civil work notes...'
                              }
                              className="w-full rounded-xl border border-rose-200 bg-white p-2.5 text-xs text-slate-800 outline-none focus:border-rose-400"
                            />
                          </div>
                        </div>
                      )}

                      {submitError && (
                        <AsyncStatePanel
                          compact
                          state="error"
                          title="Survey Submission Failed"
                          description={submitError}
                          actionLabel="Dismiss"
                          onAction={() => setSubmitError(null)}
                        />
                      )}

                      <button
                        type="submit"
                        disabled={isSubmitting || isSubmitBlocked}
                        className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition shadow-sm ${
                          isSubmitting || isSubmitBlocked
                            ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                            : 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                        }`}
                      >
                        <Send size={13} />
                        <span>
                          {isSubmitting
                            ? 'Recording Decision...'
                            : formResult === 'FEASIBLE' && docStorageState.checking
                            ? 'Verifying Documents...'
                            : formResult === 'FEASIBLE' && isMissingOrUnavailableDocs
                            ? 'FEASIBLE Blocked — Missing Documents'
                            : formResult === 'FEASIBLE' && isOverDistanceLimit && !isOverrideReady
                            ? `FEASIBLE Blocked — >${MAX_SURVEY_DISTANCE_METERS}m Limit (Override Required)`
                            : 'Commit Survey Verdict'}
                        </span>
                      </button>

                      {selectedOrder.status === ORDER_STATUS.FEASIBLE && (
                        <Link
                          to={`/technical/activations/${encodeURIComponent(selectedOrder.id)}`}
                          className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                        >
                          <span>Proceed to Technical Activation</span>
                          <ArrowRight size={13} />
                        </Link>
                      )}
                    </form>
                  </div>
                ) : (
                  <AsyncStatePanel
                    compact
                    state="empty"
                    icon={Radio}
                    title="No Survey Order Selected"
                    description="Select an order from the ODN queue to assess optical span length and reserve a splitter port."
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </TechnicalLayout>
  )
}
