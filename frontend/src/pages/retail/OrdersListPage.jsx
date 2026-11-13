import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Search,
  Filter,
  PlusCircle,
  Eye,
  Edit3,
  Ban,
  X,
  XCircle,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  ArrowUpDown,
  Download,
  Receipt,
  Radio,
  Bell,
  LogOut,
  RefreshCw,
  Sliders,
  DollarSign,
  Phone,
  PhoneCall,
  Printer,
  Check,
  Send,
  Wifi,
  Server,
  MapPin,
  User,
  Info,
  Lock
} from 'lucide-react'
import RetailLayout from '../../components/layout/RetailLayout'
import {
  fetchOrders,
  updateOrder,
  cancelOrder,
  refundOrder,
  getOrderRefundAmountUSD,
  DEPOSIT_COLLECTION_METHODS,
  DEPOSIT_STATUS,
  getOrderDepositSummary,
  recordOrderDepositCollection,
  buildDepositReceiptNumber,
} from '../../services/orderService'
import OrderDetailDrawer from './components/OrderDetailDrawer'
import { useToast } from '../../hooks/useToast'
import DispatchTechnicianModal from '../../components/common/DispatchTechnicianModal'
import PrintReceiptModal from '../../components/common/PrintReceiptModal'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import {
  fetchPlans,
  subscribePlansUpdated,
} from '../../services/planService'
import {
  ORDER_STATUS,
  ORDER_STATUS_LIST,
  canModifyOrCancelOrder,
  getOrderStatusMeta,
  getRetailEditableStatuses,
  normalizeOrderStatus,
} from '../../utils/orderStatus'

export default function OrdersListPage() {
  const {
    data: ordersData,
    setData: setOrders,
    isLoading,
    error,
    reload: reloadOrders,
  } = useAsyncResource(() => Promise.resolve(fetchOrders()), [])
  const orders = ordersData || []
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedService, setSelectedService] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [selectedBranch, setSelectedBranch] = useState('ALL')
  const { toast, showToast } = useToast()

  useEffect(() => {
    if (!ordersData) return
    if (ordersData.length === 0) {
      setSelectedOrder(null)
      return
    }
    setSelectedOrder((prev) => {
      if (prev) {
        const match = ordersData.find((o) => o.id === prev.id)
        if (match) return match
      }
      return ordersData[0]
    })
  }, [ordersData])

  const [editingOrder, setEditingOrder] = useState(null)
  const [editFormData, setEditFormData] = useState({
    customerName: '',
    taxId: '',
    contactPerson: '',
    phone: '',
    address: '',
    planName: '',
    planPriceUSD: 55,
    branchCode: '101',
    branchName: 'Hoan Kiem (HN)',
    paymentScheme: 'Monthly Postpaid',
    status: ORDER_STATUS.PENDING_SURVEY
  })
  const [catalogPlans, setCatalogPlans] = useState(() => fetchPlans({ activeOnly: true }))

  useEffect(() => {
    const refreshPlans = () => setCatalogPlans(fetchPlans({ activeOnly: true }))
    refreshPlans()
    return subscribePlansUpdated(refreshPlans)
  }, [])

  const [formErrors, setFormErrors] = useState({})

  const handleOpenEditModal = (order) => {
    if (!order || !canModifyOrCancelOrder(order.status)) {
      const normalized = normalizeOrderStatus(order?.status)
      showToast(
        normalized === ORDER_STATUS.ACTIVATED
          ? `Order #${order?.id} is already activated and cannot be edited.`
          : `Order #${order?.id} is closed and cannot be edited.`
      )
      return
    }
    const matchedPlan = catalogPlans.find(
      (p) =>
        (order.planId && p.id === order.planId) ||
        (order.planSku && p.sku === order.planSku) ||
        (order.planName && p.name === order.planName)
    )
    setEditingOrder(order)
    setEditFormData({
      customerName: order.customerName || '',
      taxId: order.taxId || '',
      contactPerson: order.contactPerson || '',
      phone: order.phone || '',
      address: order.address || '',
      planId: matchedPlan ? matchedPlan.id : '',
      planSku: matchedPlan ? matchedPlan.sku : '',
      planName: matchedPlan ? matchedPlan.name : (order.planName || ''),
      planPriceUSD: matchedPlan ? matchedPlan.priceUSD : (Number(order.planPriceUSD) || 0),
      branchCode: order.branchCode || '101',
      branchName: order.branchName || 'Hoan Kiem (HN)',
      paymentScheme: order.paymentScheme || 'Monthly Postpaid',
      status: normalizeOrderStatus(order.status)
    })
    setFormErrors({})
  }

  const handleCloseEditModal = () => {
    setEditingOrder(null)
    setFormErrors({})
  }

  const validateEditForm = () => {
    const errors = {}
    if (!editFormData.customerName.trim() || editFormData.customerName.trim().length < 3) {
      errors.customerName = 'Customer name must be at least 3 characters.'
    }
    const cleanTax = editFormData.taxId.replace(/[-\s]/g, '')
    if (!cleanTax || !/^\d{8,14}$/.test(cleanTax)) {
      errors.taxId = 'Tax ID (MST) must be 8-14 numeric digits.'
    }
    if (!editFormData.contactPerson.trim()) {
      errors.contactPerson = 'Contact person name is required.'
    }
    const cleanPhone = editFormData.phone.replace(/\D/g, '')
    if (!cleanPhone || cleanPhone.length < 8) {
      errors.phone = 'Valid phone number is required (min 8 digits).'
    }
    if (!editFormData.address.trim() || editFormData.address.trim().length < 5) {
      errors.address = 'Premise address must be at least 5 characters.'
    }
    if (isNaN(editFormData.planPriceUSD) || Number(editFormData.planPriceUSD) <= 0) {
      errors.planPriceUSD = 'Plan price must be a positive number.'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveEdit = (e) => {
    e.preventDefault()
    if (!editingOrder || !canModifyOrCancelOrder(editingOrder.status)) {
      showToast(`Order #${editingOrder?.id} cannot be edited after activation or closure.`)
      setEditingOrder(null)
      return
    }
    if (!validateEditForm()) return

    const BRANCH_NAMES = {
      '101': 'Hoan Kiem (HN)',
      '201': 'District 1 (HCMC)',
      '301': 'Hai Chau (DN)'
    }

    const currentStatus = normalizeOrderStatus(editingOrder.status)
    const retailAllowed = getRetailEditableStatuses(currentStatus)
    const requestedStatus = normalizeOrderStatus(editFormData.status)
    const nextStatus = retailAllowed.some((item) => item.code === requestedStatus)
      ? requestedStatus
      : currentStatus

    if (currentStatus === ORDER_STATUS.DRAFT && nextStatus !== ORDER_STATUS.DRAFT) {
      const depSummary = getOrderDepositSummary(editingOrder)
      if (!depSummary.isCollectedOrWaived && depSummary.expectedDepositDueUSD > 0) {
        showToast(
          `Confirm security deposit ($${depSummary.expectedDepositDueUSD.toFixed(2)}) before submitting Draft #${editingOrder.id} to ODN Survey.`
        )
        setEditingOrder(null)
        handleOpenCollectDeposit(editingOrder)
        return
      }
    }

    const updatedData = {
      customerName: editFormData.customerName.trim(),
      taxId: editFormData.taxId.trim(),
      contactPerson: editFormData.contactPerson.trim(),
      phone: editFormData.phone.trim(),
      address: editFormData.address.trim(),
      planId: editFormData.planId || editingOrder.planId || '',
      planSku: editFormData.planSku || editingOrder.planSku || '',
      planName: editFormData.planName.trim() || editingOrder.planName,
      planPriceUSD: Number(editFormData.planPriceUSD),
      branchCode: editFormData.branchCode,
      branchName: BRANCH_NAMES[editFormData.branchCode] || editFormData.branchName,
      paymentScheme: editFormData.paymentScheme,
      status: nextStatus,
      currentStep: nextStatus === currentStatus ? editingOrder.currentStep : getOrderStatusMeta(nextStatus).step,
    }

    try {
      const saved = updateOrder(editingOrder.id, updatedData)
      setOrders((prev) => prev.map((o) => (o.id === saved.id ? saved : o)))
      if (selectedOrder && selectedOrder.id === saved.id) {
        setSelectedOrder(saved)
      }
      showToast(`Order #${saved.id} updated successfully.`)
      setEditingOrder(null)
    } catch (err) {
      showToast(`Failed to update order: ${err.message}`)
    }
  }

  const [cancellingOrder, setCancellingOrder] = useState(null)
  const [cancelReasonPreset, setCancelReasonPreset] = useState('Customer Request / Changed Mind')
  const [customCancelReason, setCustomCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')

  const handleOpenCancelModal = (order) => {
    if (!order || !canModifyOrCancelOrder(order.status)) {
      const normalized = normalizeOrderStatus(order?.status)
      showToast(
        normalized === ORDER_STATUS.ACTIVATED
          ? `Order #${order?.id} is already activated and cannot be cancelled.`
          : `Order #${order?.id} is closed and cannot be cancelled.`
      )
      return
    }
    setCancellingOrder(order)
    setCancelReasonPreset('Customer Request / Changed Mind')
    setCustomCancelReason('')
    setCancelError('')
  }

  const handleCloseCancelModal = () => {
    setCancellingOrder(null)
    setCancelError('')
  }

  const handleConfirmCancelOrder = (e) => {
    e.preventDefault()
    if (!cancellingOrder) return
    if (!canModifyOrCancelOrder(cancellingOrder.status)) {
      setCancelError('Activated or closed orders cannot be cancelled from Retail.')
      return
    }

    let finalReason = cancelReasonPreset
    if (cancelReasonPreset === 'Other / Custom Reason') {
      if (!customCancelReason.trim() || customCancelReason.trim().length < 5) {
        setCancelError('Please provide a specific cancellation reason (minimum 5 characters).')
        return
      }
      finalReason = customCancelReason.trim()
    } else if (customCancelReason.trim()) {
      finalReason = `${cancelReasonPreset}: ${customCancelReason.trim()}`
    }

    try {
      const cancelled = cancelOrder(cancellingOrder.id, finalReason)
      setOrders((prev) => prev.map((o) => (o.id === cancelled.id ? cancelled : o)))
      if (selectedOrder && selectedOrder.id === cancelled.id) {
        setSelectedOrder(cancelled)
      }
      showToast(`Order #${cancelled.id} has been cancelled.`)
      setCancellingOrder(null)
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel order.')
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchSearch =
        order.id.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        order.contactPerson.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        order.phone.toLowerCase().includes(searchQuery.toLowerCase().trim())

      const matchService = selectedService === 'ALL' || order.serviceType === selectedService
      const matchStatus = selectedStatus === 'ALL' || normalizeOrderStatus(order.status) === selectedStatus
      const matchBranch = selectedBranch === 'ALL' || order.branchCode === selectedBranch

      return matchSearch && matchService && matchStatus && matchBranch
    })
  }, [orders, searchQuery, selectedService, selectedStatus, selectedBranch])

  const stats = useMemo(() => {
    const counts = orders.reduce(
      (acc, order) => {
        const code = normalizeOrderStatus(order.status)
        acc.total += 1
        if (code === ORDER_STATUS.DRAFT) acc.draft += 1
        else if (code === ORDER_STATUS.PENDING_SURVEY) acc.pending += 1
        else if (code === ORDER_STATUS.FEASIBLE) acc.feasible += 1
        else if (code === ORDER_STATUS.ACTIVATED) acc.activated += 1
        else if (code === ORDER_STATUS.NOT_FEASIBLE) acc.notFeasible += 1
        else if (code === ORDER_STATUS.CANCELLED) acc.cancelled += 1
        else if (code === ORDER_STATUS.REFUNDED) acc.refunded += 1
        return acc
      },
      { total: 0, draft: 0, pending: 0, feasible: 0, activated: 0, notFeasible: 0, cancelled: 0, refunded: 0 }
    )
    const pct = (value) => (counts.total > 0 ? ((value / counts.total) * 100).toFixed(1) : '0.0')
    return {
      ...counts,
      activatedRate: pct(counts.activated),
      notFeasibleRate: pct(counts.notFeasible),
      pendingRate: pct(counts.pending),
    }
  }, [orders])

  const triggerToast = (msg) => {
    showToast(msg)
  }

  const [dispatchingOrder, setDispatchingOrder] = useState(null)
  const [printingOrder, setPrintingOrder] = useState(null)
  const [refundingOrder, setRefundingOrder] = useState(null)
  const [refundReason, setRefundReason] = useState('100% Security Deposit Refund under Regulatory Rule CN16')
  const [refundError, setRefundError] = useState('')
  const [collectingOrder, setCollectingOrder] = useState(null)
  const [collectMethod, setCollectMethod] = useState('CASH')
  const [collectReference, setCollectReference] = useState('')
  const [collectCollector, setCollectCollector] = useState('Store Cashier (Demo)')
  const [collectError, setCollectError] = useState('')

  const handleOpenCollectDeposit = (order) => {
    if (!order) return
    setCollectingOrder(order)
    setCollectMethod('CASH')
    setCollectReference('')
    setCollectCollector('Store Cashier (Demo)')
    setCollectError('')
  }

  const handleCloseCollectDeposit = () => {
    setCollectingOrder(null)
    setCollectError('')
  }

  const handleConfirmDepositCollection = (e) => {
    e.preventDefault()
    if (!collectingOrder) return
    try {
      const updated = recordOrderDepositCollection(collectingOrder.id, {
        collectionMethod: collectMethod,
        referenceCode: collectReference.trim(),
        collectorName: collectCollector.trim() || 'Store Cashier (Demo)',
      })
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      if (selectedOrder && selectedOrder.id === updated.id) {
        setSelectedOrder(updated)
      }
      const dep = getOrderDepositSummary(updated)
      triggerToast(
        `Collected $${dep.collectedAmountUSD.toFixed(2)} (${dep.methodLabel}) — Receipt ${dep.receiptNumber} issued.`
      )
      setCollectingOrder(null)
    } catch (err) {
      setCollectError(err?.message || 'Unable to record deposit collection.')
    }
  }

  const handleDispatchFieldTech = (order) => {
    setDispatchingOrder(order)
  }

  const handlePrintReceipt = (order) => {
    setPrintingOrder(order)
  }

  const handleOpenRefundModal = (order) => {
    if (!order || normalizeOrderStatus(order.status) !== ORDER_STATUS.NOT_FEASIBLE) return
    setRefundingOrder(order)
    setRefundReason('100% Security Deposit Refund under Regulatory Rule CN16')
    setRefundError('')
  }

  const handleCloseRefundModal = () => {
    setRefundingOrder(null)
    setRefundError('')
  }

  const handleConfirmRefund = (e) => {
    e.preventDefault()
    if (!refundingOrder) return
    const trimmedReason = refundReason.trim()
    if (!trimmedReason) {
      setRefundError('Refund reference or justification is required.')
      return
    }
    const refundAmountUSD = getOrderRefundAmountUSD(refundingOrder)
    try {
      const refunded = refundOrder(refundingOrder.id, trimmedReason, refundAmountUSD)
      setOrders((prev) => prev.map((o) => (o.id === refunded.id ? refunded : o)))
      if (selectedOrder && selectedOrder.id === refunded.id) {
        setSelectedOrder(refunded)
      }
      triggerToast(`Executed 100% Deposit Refund ($${refundAmountUSD.toFixed(2)}) for Order #${refunded.id}.`)
      setRefundingOrder(null)
    } catch (err) {
      triggerToast(`Failed to refund order: ${err.message}`)
    }
  }

  return (
    <RetailLayout activeNavId="orders" toast={toast}>
      <div className="card p-5 md:p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Retail Operations</span>
              <span>/</span>
              <span className="font-semibold text-slate-700">Order Management</span>
              <span>/</span>
              <span className="font-mono text-brand-soft">Order Portfolio</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-navy">
                Order Portfolio &amp; Status Tracking
              </h1>
              <span className="rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-700">
                STORE #101 DEMO
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Query, verify ODN infrastructure feasibility, allocate GPON/SBC equipment from inventory, and activate 16-character Account IDs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => triggerToast('Exported active order portfolio to Excel report.')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              Export Excel Report
            </button>
            <button
              onClick={() => {
                reloadOrders()
                triggerToast('Refreshed local order pipeline state.')
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Queue
            </button>
            <Link
              to="/retail/orders/new"
              className="flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-md shadow-navy/20 transition cursor-pointer"
            >
              <PlusCircle size={14} />
              <span>Create New Order</span>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <AsyncStatePanel
            state="loading"
            title="Loading retail order portfolio..."
            description="Synchronizing customer orders, ODN feasibility statuses, and assigned hardware inventory."
          />
        ) : error ? (
          <AsyncStatePanel
            state="error"
            title="Unable to load retail orders"
            description={error}
            onRetry={reloadOrders}
            actionLabel="Create New Order"
            actionTo="/retail/orders/new"
          />
        ) : orders.length === 0 ? (
          <AsyncStatePanel
            state="empty"
            icon={FileText}
            title="No Retail Orders Found"
            description="There are currently no broadband, leased line, or voice service orders in the store portfolio."
            actionLabel="Create New Order"
            actionTo="/retail/orders/new"
          />
        ) : (
        <>
        <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-5">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm backdrop-blur-md transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Orders
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-900 tracking-tight">{stats.total}</span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                {stats.draft} Draft
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {stats.cancelled} Cancelled &bull; {stats.refunded} Refunded
            </p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500" />
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm backdrop-blur-md transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Awaiting ODN Survey
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-amber-900 tracking-tight">{stats.pending}</span>
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                {stats.pendingRate}% Total
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Field tech on-site dispatch</p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500" />
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm backdrop-blur-md transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Feasible / Assign ONT
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Server className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-emerald-900 tracking-tight">{stats.feasible}</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {stats.feasible > 0 ? 'Ready to Dispatch' : 'None Pending'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Awaiting Serial &amp; Account ID</p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500" />
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm backdrop-blur-md transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Active Commissioned
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-indigo-900 tracking-tight">{stats.activated}</span>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                {stats.activatedRate}% Total
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Account ID issued &amp; active traffic</p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-600" />
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm backdrop-blur-md transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Not Feasible (CN16)
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-rose-900 tracking-tight">{stats.notFeasible}</span>
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
                {stats.notFeasibleRate}% Total
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Eligible for 100% deposit refund</p>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-rose-500" />
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-xs backdrop-blur-md">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by 11-char Order ID (e.g. B0000001089), Account ID (16-char), Subscriber Name, Phone, Tax ID..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 sm:text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400">SERVICE:</span>
                  <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="bg-transparent font-semibold focus:outline-none"
                  >
                    <option value="ALL">All Services (B / D / T)</option>
                    <option value="BROADBAND">Broadband FTTx (B)</option>
                    <option value="DIALUP">Leased Line / Dial-up (D)</option>
                    <option value="LANDLINE">Telephone / SIP (T)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400">PROGRESS:</span>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="bg-transparent font-semibold focus:outline-none"
                  >
                    <option value="ALL">All Lifecycle Stages</option>
                    {ORDER_STATUS_LIST.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400">BRANCH:</span>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="bg-transparent font-semibold focus:outline-none"
                  >
                    <option value="ALL">All National Stores</option>
                    <option value="101">Hanoi Metro (101)</option>
                    <option value="201">Ho Chi Minh City (201)</option>
                    <option value="301">Da Nang (301)</option>
                  </select>
                </div>
              </div>

              {(searchQuery || selectedService !== 'ALL' || selectedStatus !== 'ALL' || selectedBranch !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedService('ALL')
                    setSelectedStatus('ALL')
                    setSelectedBranch('ALL')
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.75fr_1fr] 2xl:grid-cols-[1.85fr_1.1fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-xs backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  RETAIL ORDER PORTFOLIO
                </span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  {filteredOrders.length} of {orders.length}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Feasible/Active
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> ODN Survey
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Rejected
                </span>
              </div>
            </div>

            <div className="overflow-hidden">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-100 bg-slate-50/60 font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3.5 py-3 whitespace-nowrap">Order ID / Service</th>
                    <th className="px-3.5 py-3">Subscriber &amp; Contact</th>
                    <th className="px-3.5 py-3">Tariff &amp; Revenue</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Branch</th>
                    <th className="px-3.5 py-3 whitespace-nowrap">Progress</th>
                    <th className="px-3.5 py-3 text-right whitespace-nowrap">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-4">
                        <AsyncStatePanel
                          compact
                          state="empty"
                          icon={Search}
                          title="No matching orders"
                          description="No retail orders match the specified search query or selected filters."
                          actionLabel="Reset Filters"
                          onAction={() => {
                            setSearchQuery('')
                            setSelectedService('ALL')
                            setSelectedStatus('ALL')
                            setSelectedBranch('ALL')
                          }}
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const isSelected = selectedOrder?.id === order.id
                      return (
                        <tr
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-200' : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex items-start gap-2">
                              <span
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${getOrderStatusMeta(order.status).dotClass}`}
                              />
                              <div>
                                <span className="font-mono text-xs font-bold text-indigo-700">
                                  {order.id}
                                </span>
                                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                                  <span>{order.serviceName}</span>
                                  <span>•</span>
                                  <span className="font-mono">{order.registeredTime}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-3.5 py-3">
                            <div className="min-w-[170px] max-w-[240px]">
                              <span className="block font-semibold text-slate-900 truncate" title={order.customerName}>
                                {order.customerName}
                              </span>
                              <span className="block text-[11px] text-slate-500 truncate">
                                {order.contactPerson} ({order.phone})
                              </span>
                              <span className="block text-[10px] text-slate-400 truncate" title={order.address}>
                                {order.address}
                              </span>
                            </div>
                          </td>

                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div>
                              <span className="block font-semibold text-slate-900">{order.planName}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] font-bold text-indigo-600">
                                  ${order.planPriceUSD.toFixed(2)}/mo
                                </span>
                                <span className="text-[10px] text-slate-400 truncate max-w-[110px]">
                                  {order.paymentScheme}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <span className="block text-slate-800 font-medium">{order.branchName}</span>
                            <span className="font-mono text-[10px] text-slate-400">Store {order.branchCode}</span>
                          </td>

                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <OrderStatusBadge status={order.status} />
                          </td>

                          <td className="px-3.5 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {canModifyOrCancelOrder(order.status) ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenEditModal(order)
                                    }}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-indigo-600 transition"
                                    title="Edit Order"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenCancelModal(order)
                                    }}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                    title="Cancel Order"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400"
                                  title={
                                    normalizeOrderStatus(order.status) === ORDER_STATUS.ACTIVATED
                                      ? 'Activated orders cannot be edited or cancelled from Retail.'
                                      : `${getOrderStatusMeta(order.status).label} orders cannot be edited or cancelled.`
                                  }
                                >
                                  <Lock className="h-3 w-3" />
                                  <span>Locked</span>
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedOrder(order)
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-indigo-600 transition"
                                title="Inspect Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              <span>
                Showing {filteredOrders.length} of {orders.length} orders
              </span>
              <span className="font-mono text-[11px] font-semibold text-slate-400">
                Local Portfolio View
              </span>
            </div>
          </div>

          <aside className="space-y-6">
            {selectedOrder ? (
              <OrderDetailDrawer
                selectedOrder={selectedOrder}
                onActionToast={showToast}
                onEdit={handleOpenEditModal}
                onCancelOrder={handleOpenCancelModal}
                onRefundOrder={handleOpenRefundModal}
                onCollectDeposit={handleOpenCollectDeposit}
                onDispatchFieldTech={handleDispatchFieldTech}
                onPrintReceipt={handlePrintReceipt}
              />
            ) : (
              <AsyncStatePanel
                compact
                state="empty"
                icon={FileText}
                title="No order selected"
                description="Select an order from the table to inspect details, edit details, or dispatch a field technician."
              />
            )}
          </aside>
        </div>
        </>
        )}

        <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>
              <strong>16-Character Account ID Rule:</strong> Prefix B/D/T + Metro City Code (101/201/301) + 12-digit unique serial upon commissioning.
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Core Billing: Synchronized
            </span>
            <span>•</span>
            <span>NOC SLA: 4-Hour Response</span>
          </div>
        </div>

        {editingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7 space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold">
                    <Edit3 size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Edit Order Details</h3>
                    <p className="text-xs text-slate-500">
                      Order ID: <span className="font-mono font-bold text-indigo-600">{editingOrder.id}</span> • Registered: {editingOrder.registeredTime}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.customerName}
                      onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 ${
                        formErrors.customerName
                          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 text-rose-900'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100 text-slate-800'
                      }`}
                      placeholder="Company or Individual full name"
                    />
                    {formErrors.customerName && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">{formErrors.customerName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tax Identification Number (MST) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.taxId}
                      onChange={(e) => setEditFormData({ ...editFormData, taxId: e.target.value })}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                        formErrors.taxId
                          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 text-rose-900'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100 text-slate-800'
                      }`}
                      placeholder="e.g. 0108945621"
                    />
                    {formErrors.taxId && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">{formErrors.taxId}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Person <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.contactPerson}
                      onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 ${
                        formErrors.contactPerson
                          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 text-rose-900'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100 text-slate-800'
                      }`}
                      placeholder="Full representative name"
                    />
                    {formErrors.contactPerson && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">{formErrors.contactPerson}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                        formErrors.phone
                          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 text-rose-900'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100 text-slate-800'
                      }`}
                      placeholder="+84 912 345 678"
                    />
                    {formErrors.phone && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">{formErrors.phone}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Premise Installation Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 ${
                        formErrors.address
                          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 text-rose-900'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100 text-slate-800'
                      }`}
                      placeholder="Floor, building, street, district, province"
                    />
                    {formErrors.address && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">{formErrors.address}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Subscription Plan (Admin Master Catalog)
                    </label>
                    <select
                      value={editFormData.planId || '__LEGACY__'}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '__LEGACY__') {
                          setEditFormData({
                            ...editFormData,
                            planId: '',
                            planSku: '',
                            planName: editingOrder.planName || '',
                            planPriceUSD: Number(editingOrder.planPriceUSD) || 0,
                          })
                          return
                        }
                        const picked = catalogPlans.find((p) => p.id === val)
                        if (picked) {
                          setEditFormData({
                            ...editFormData,
                            planId: picked.id,
                            planSku: picked.sku,
                            planName: picked.name,
                            planPriceUSD: picked.priceUSD,
                          })
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-800 bg-white"
                    >
                      {!editFormData.planId && editingOrder.planName && (
                        <option value="__LEGACY__">
                          {editingOrder.planName} (Legacy / Custom — ${Number(editingOrder.planPriceUSD || 0).toLocaleString()}/mo)
                        </option>
                      )}
                      {catalogPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          [{plan.sku || plan.id}] {plan.name} — ${Number(plan.priceUSD).toLocaleString()}/mo
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Plan Price ($/mo) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      readOnly={Boolean(editFormData.planId)}
                      value={editFormData.planPriceUSD}
                      onChange={(e) => setEditFormData({ ...editFormData, planPriceUSD: e.target.value })}
                      className={`w-full rounded-xl border px-3 py-2 text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                        editFormData.planId
                          ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
                          : formErrors.planPriceUSD
                          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 text-rose-900'
                          : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100 text-slate-800'
                      }`}
                      placeholder="55.00"
                    />
                    {editFormData.planId && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Price is controlled by Admin Plans &amp; Tariffs catalog.
                      </p>
                    )}
                    {formErrors.planPriceUSD && (
                      <p className="mt-1 text-[11px] text-rose-600 font-medium">{formErrors.planPriceUSD}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Retail Branch
                    </label>
                    <select
                      value={editFormData.branchCode}
                      onChange={(e) => setEditFormData({ ...editFormData, branchCode: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-800 bg-white"
                    >
                      <option value="101">101 - Hoan Kiem (HN)</option>
                      <option value="201">201 - District 1 (HCMC)</option>
                      <option value="301">301 - Hai Chau (DN)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Scheme
                    </label>
                    <select
                      value={editFormData.paymentScheme}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentScheme: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-800 bg-white"
                    >
                      <option value="Monthly Postpaid">Monthly Postpaid</option>
                      <option value="Prepay 6M (-10% Discount)">Prepay 6M (-10% Discount)</option>
                      <option value="Prepay 12M (-20% Discount)">Prepay 12M (-20% Discount)</option>
                      <option value="Corporate Billing Postpaid">Corporate Billing Postpaid</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Order Lifecycle Status
                    </label>
                    {getRetailEditableStatuses(editingOrder.status).length > 0 ? (
                      <select
                        value={editFormData.status}
                        onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-800 bg-white"
                      >
                        {getRetailEditableStatuses(editingOrder.status).map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.label} ({s.code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <OrderStatusBadge status={editingOrder.status} />
                        <span className="text-[11px] text-slate-500">
                          Survey &amp; activation transitions are controlled by Technical Ops.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancel Order Confirmation Modal */}
        {cancellingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7 space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 font-bold">
                    <Ban size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Cancel Retail Order</h3>
                    <p className="text-xs text-slate-500">
                      Order ID: <span className="font-mono font-bold text-rose-600">{cancellingOrder.id}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseCancelModal}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-rose-900">
                  <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                  <span>Permanent Order Termination</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Are you sure you want to cancel order for{' '}
                  <strong className="text-rose-950 font-bold">{cancellingOrder.customerName}</strong> ({cancellingOrder.planName})?
                  This action will immediately freeze all field engineering dispatches and return reserved GPON hardware to warehouse inventory.
                </p>
              </div>

              <form onSubmit={handleConfirmCancelOrder} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cancellation Reason <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={cancelReasonPreset}
                    onChange={(e) => {
                      setCancelReasonPreset(e.target.value)
                      setCancelError('')
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-100 text-slate-800 bg-white"
                  >
                    <option value="Customer Request / Changed Mind">Customer Request / Changed Mind</option>
                    <option value="Customer Relocation / Address Unserviceable">Customer Relocation / Address Unserviceable</option>
                    <option value="Technical Infeasibility / High Attenuation">Technical Infeasibility / High Attenuation (&gt; -24 dBm)</option>
                    <option value="Competitor Migration / Price Objection">Competitor Migration / Price Objection</option>
                    <option value="Order Entry Duplication / Clerical Error">Order Entry Duplication / Clerical Error</option>
                    <option value="Documentation / Legal Verification Rejection">Documentation / Legal Verification Rejection</option>
                    <option value="Other / Custom Reason">Other / Custom Reason</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Detailed Notes / Reason Justification {cancelReasonPreset === 'Other / Custom Reason' && <span className="text-rose-500">*</span>}
                  </label>
                  <textarea
                    rows={3}
                    value={customCancelReason}
                    onChange={(e) => {
                      setCustomCancelReason(e.target.value)
                      if (cancelError) setCancelError('')
                    }}
                    placeholder={
                      cancelReasonPreset === 'Other / Custom Reason'
                        ? 'Enter specific justification for cancellation (required)...'
                        : 'Optional specific notes for internal order audit trail...'
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 ${
                      cancelError
                        ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 text-rose-900'
                        : 'border-slate-200 focus:border-rose-500 focus:ring-rose-100 text-slate-800'
                    }`}
                  />
                  {cancelError && (
                    <p className="mt-1 text-[11px] text-rose-600 font-medium">{cancelError}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseCancelModal}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Keep Order
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
                  >
                    Confirm Cancellation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {refundingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Confirm 100% Deposit Refund</h3>
                    <p className="text-xs text-slate-500">
                      Order ID: <span className="font-mono font-bold text-purple-700">{refundingOrder.id}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseRefundModal}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                  aria-label="Close refund modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-900">Subscriber</span>
                  <span className="font-bold text-slate-900 text-right">{refundingOrder.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-900">Service Plan</span>
                  <span className="font-medium text-slate-700 text-right">{refundingOrder.planName}</span>
                </div>
                <div className="flex items-center justify-between border-t border-purple-200/70 pt-2">
                  <span className="font-bold text-purple-950">Refundable Deposit (100%)</span>
                  <span className="font-mono text-base font-black text-purple-800">
                    ${getOrderRefundAmountUSD(refundingOrder).toFixed(2)}
                  </span>
                </div>
              </div>

              <form onSubmit={handleConfirmRefund} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Refund Reference / Notes <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={refundReason}
                    onChange={(e) => {
                      setRefundReason(e.target.value)
                      if (refundError) setRefundError('')
                    }}
                    placeholder="Enter CN16 authorization note or refund voucher reference..."
                    className={`w-full rounded-xl border px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 ${
                      refundError
                        ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 text-rose-900'
                        : 'border-slate-200 focus:border-purple-500 focus:ring-purple-100 text-slate-800'
                    }`}
                  />
                  {refundError && <p className="mt-1 text-[11px] font-medium text-rose-600">{refundError}</p>}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseRefundModal}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition cursor-pointer"
                  >
                    Confirm Refund (${getOrderRefundAmountUSD(refundingOrder).toFixed(2)})
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {dispatchingOrder && (
          <DispatchTechnicianModal
            order={dispatchingOrder}
            onClose={() => setDispatchingOrder(null)}
            onDispatched={(ticketId) => {
              showToast(`Field technician ticket #${ticketId} dispatched with work order download.`)
            }}
          />
        )}

        {collectingOrder && (() => {
          const depSummary = getOrderDepositSummary(collectingOrder)
          const previewReceiptNo = buildDepositReceiptNumber(
            collectingOrder.id,
            depSummary.expectedDepositDueUSD <= 0
          )
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
              <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 my-8">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold">
                      <Receipt size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Record Deposit Collection (CN16)</h3>
                      <p className="text-xs text-slate-500">
                        Order ID: <span className="font-mono font-bold text-indigo-700">{collectingOrder.id}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseCollectDeposit}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                    aria-label="Close deposit collection modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Subscriber</span>
                    <span className="font-bold text-slate-900 text-right">{collectingOrder.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Issued Receipt No.</span>
                    <span className="font-mono font-bold text-indigo-700">{previewReceiptNo}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-indigo-200/70 pt-2">
                    <span className="font-bold text-navy">Net Deposit &amp; Advance Due</span>
                    <span className="font-mono text-base font-black text-navy">
                      ${depSummary.expectedDepositDueUSD.toFixed(2)}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleConfirmDepositCollection} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Collection Method <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {DEPOSIT_COLLECTION_METHODS.map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setCollectMethod(method.id)}
                          className={`text-left rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                            collectMethod === method.id
                              ? 'border-indigo-500 bg-indigo-50/40 text-navy ring-2 ring-indigo-500/15'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Payment Ref / Slip
                      </label>
                      <input
                        type="text"
                        value={collectReference}
                        onChange={(e) => setCollectReference(e.target.value)}
                        placeholder="e.g. VQR-8891"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Collector / Counter
                      </label>
                      <input
                        type="text"
                        value={collectCollector}
                        onChange={(e) => setCollectCollector(e.target.value)}
                        placeholder="Store Cashier (Demo)"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {collectError && (
                    <p className="text-[11px] font-medium text-rose-600">{collectError}</p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleCloseCollectDeposit}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
                    >
                      Confirm Collected (${depSummary.expectedDepositDueUSD.toFixed(2)})
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        })()}

        {printingOrder && (() => {
          const depSummary = getOrderDepositSummary(printingOrder)
          const isRefundedOrder = normalizeOrderStatus(printingOrder.status) === ORDER_STATUS.REFUNDED
          return (
            <PrintReceiptModal
              receiptData={{
                receiptType: isRefundedOrder ? 'REFUND' : 'DEPOSIT',
                depositStatus: depSummary.depositStatus,
                receiptNumber: isRefundedOrder
                  ? depSummary.refundReceiptNumber
                  : depSummary.receiptNumber || buildDepositReceiptNumber(printingOrder.id, false),
                date: isRefundedOrder
                  ? depSummary.refundedAt || undefined
                  : depSummary.collectedAt || undefined,
                customerName: printingOrder.customerName,
                taxId: printingOrder.taxId,
                branchName: printingOrder.branchName,
                accountId: printingOrder.accountId || 'Issued upon commissioning',
                orderId: printingOrder.id,
                serviceTitle: printingOrder.planName,
                grossDepositUSD: depSummary.grossDepositUSD,
                advancePaymentUSD: depSummary.advancePaymentUSD,
                bulkDiscountUSD: depSummary.bulkDiscountUSD,
                amount: isRefundedOrder
                  ? depSummary.refundAmountUSD
                  : depSummary.isCollectedOrWaived
                  ? depSummary.collectedAmountUSD
                  : depSummary.expectedDepositDueUSD,
                paymentMethod: isRefundedOrder
                  ? printingOrder.refundMethod || 'Counter / Corporate Bank Refund'
                  : depSummary.methodLabel,
                referenceCode: depSummary.referenceCode,
                collectorName: depSummary.collectorName,
                originalDepositReceiptNumber: depSummary.receiptNumber,
                refundReason: depSummary.refundReason,
              }}
              onClose={() => setPrintingOrder(null)}
            />
          )
        })()}
      </div>
    </RetailLayout>
  )
}
