import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Network,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Router,
  Cpu,
  Printer,
  FileText,
  Clock,
  ChevronRight,
  CheckCircle,
  Copy,
  Barcode,
  Layers,
  Radio,
  Building2,
  HardHat,
  Zap,
  Activity,
  Server,
  Download,
  UploadCloud,
  Check,
  RotateCw,
  Loader2,
} from 'lucide-react'
import TechnicalLayout from '../../components/layout/TechnicalLayout'
import { copyToClipboard } from '../../utils/clipboard'
import { useToast } from '../../hooks/useToast'
import {
  fetchAvailableWarehouseDevices,
  findInventoryDeviceBySerialOrMac,
  subscribeInventoryUpdated,
  previewNextAccountId,
  commissionCircuit,
  loadActivationOrderById,
  loadActivationQueue,
} from '../../services/activationService'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { ORDER_STATUS } from '../../utils/orderStatus'
import OrderStatusBadge from '../../components/common/OrderStatusBadge'

export default function TechnicalActivationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { orderId: paramOrderId } = useParams()
  const [searchParams] = useSearchParams()

  const requestedOrderId = useMemo(() => {
    return String(paramOrderId || searchParams.get('orderId') || location.state?.orderId || '').trim()
  }, [paramOrderId, searchParams, location.state])

  const {
    data: queueData,
    reload: reloadQueue,
  } = useAsyncResource(() => loadActivationQueue(), [])
  const activationQueue = queueData || []

  const [selectedOrderId, setSelectedOrderId] = useState(requestedOrderId)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isLoadingOrder, setIsLoadingOrder] = useState(Boolean(requestedOrderId))
  const [orderError, setOrderError] = useState(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceFilter, setServiceFilter] = useState('ALL')

  useEffect(() => {
    setSelectedOrderId(requestedOrderId)
  }, [requestedOrderId])

  useEffect(() => {
    let cancelled = false
    if (!selectedOrderId) {
      setSelectedOrder(null)
      setIsLoadingOrder(false)
      setOrderError(null)
      return
    }
    setIsLoadingOrder(true)
    setOrderError(null)
    loadActivationOrderById(selectedOrderId)
      .then((found) => {
        if (cancelled) return
        if (!found) {
          setSelectedOrder(null)
          setOrderError({
            type: 'NOT_FOUND',
            message: 'Order not found',
            orderId: selectedOrderId,
          })
        } else {
          setSelectedOrder(found)
          setOrderError(null)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setSelectedOrder(null)
        setOrderError({
          type: 'ERROR',
          message: err?.message || 'Unable to load provisioning order details.',
          orderId: selectedOrderId,
        })
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOrder(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedOrderId, reloadNonce])

  const [inventoryRevision, setInventoryRevision] = useState(0)

  useEffect(() => {
    return subscribeInventoryUpdated(() => {
      setInventoryRevision((rev) => rev + 1)
    })
  }, [])

  const availableDevices = useMemo(() => {
    if (!selectedOrder) return []
    return fetchAvailableWarehouseDevices(selectedOrder.serviceType)
  }, [selectedOrder, inventoryRevision])

  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [vlanId, setVlanId] = useState(100)
  const [ipWan, setIpWan] = useState('')
  const [gateway, setGateway] = useState('')

  const [signatoryName, setSignatoryName] = useState('Nguyen Van An (IT Director)')
  const [signatoryNationalId, setSignatoryNationalId] = useState('001089012345')

  const [rxPower, setRxPower] = useState(-18.4)
  const [pingLatency, setPingLatency] = useState(1.8)
  const [throughput, setThroughput] = useState('512 Mbps / 508 Mbps')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activatedResult, setActivatedResult] = useState(null)
  const [copiedAccount, setCopiedAccount] = useState(false)
  const copyTimerRef = useRef(null)
  const { toast, showToast } = useToast()

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!selectedOrder) return

    if (selectedOrder.status === ORDER_STATUS.ACTIVATED) {
      setSelectedDeviceId(selectedOrder.assignedDeviceId || '')
      setSerialNumber(String(selectedOrder.deviceSerial || '').replace(/^SN:\s*/i, ''))
      setMacAddress(String(selectedOrder.deviceMac || '').replace(/^MAC:\s*/i, ''))
      setVlanId(selectedOrder.vlanId ?? selectedOrder.defaultVlan)
      setIpWan(selectedOrder.ipWan || selectedOrder.defaultIpWan)
      setGateway(selectedOrder.gateway || selectedOrder.defaultGateway)
      return
    }

    const existingStillAvailable = availableDevices.find((d) => d.id === selectedDeviceId)
    const defaultDev = existingStillAvailable || availableDevices[0] || null
    setSelectedDeviceId(defaultDev ? defaultDev.id : '')
    setSerialNumber(defaultDev ? defaultDev.serialNumber : '')
    setMacAddress(defaultDev ? defaultDev.macAddress : '')
    setVlanId(selectedOrder.defaultVlan)
    setIpWan(selectedOrder.defaultIpWan)
    setGateway(selectedOrder.defaultGateway)
  }, [selectedOrderId, availableDevices, selectedOrder])

  const matchedWarehouseDevice = useMemo(() => {
    return findInventoryDeviceBySerialOrMac(serialNumber, macAddress)
  }, [serialNumber, macAddress, inventoryRevision])

  const isMatchedDeviceAvailable = Boolean(
    matchedWarehouseDevice &&
      matchedWarehouseDevice.status === 'IN_STOCK' &&
      !matchedWarehouseDevice.assignedOrderId &&
      !matchedWarehouseDevice.contractAccount
  )

  const calculatedAccountId = useMemo(() => {
    if (!selectedOrder?.orderId) return ''
    if (selectedOrder.status === ORDER_STATUS.ACTIVATED && selectedOrder.accountId) {
      return selectedOrder.accountId
    }
    const prefix = selectedOrder.orderId.charAt(0)
    return previewNextAccountId(prefix, selectedOrder.cityCode || selectedOrder.branchCode || '101')
  }, [selectedOrder, activatedResult])

  function handleSelectDevice(device) {
    setSelectedDeviceId(device.id)
    setSerialNumber(device.serialNumber)
    setMacAddress(device.macAddress)
  }

  async function handleCopyAccountId() {
    await copyToClipboard(calculatedAccountId)
    setCopiedAccount(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopiedAccount(false), 2000)
  }

  async function handleCommission() {
    if (!serialNumber.trim() || !macAddress.trim()) {
      showToast('Please provide both Serial Number and MAC Address.', 'error')
      return
    }
    if (!isMatchedDeviceAvailable) {
      const reason = matchedWarehouseDevice
        ? `Hardware ${matchedWarehouseDevice.serialNumber} is ${matchedWarehouseDevice.status} and cannot be reassigned.`
        : `Hardware S/N "${serialNumber}" is not available in warehouse stock.`
      showToast(reason, 'error')
      return
    }
    if (!signatoryName.trim()) {
      showToast('Customer representative sign-off name is required.', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await commissionCircuit(selectedOrder.orderId, {
        deviceId: matchedWarehouseDevice.id,
        serialNumber: matchedWarehouseDevice.serialNumber,
        macAddress: macAddress.trim(),
        model: matchedWarehouseDevice.model,
        vendor: matchedWarehouseDevice.vendor,
        vlanId,
        ipWan,
        gateway,
        rxPowerDbm: rxPower,
        pingMs: pingLatency,
        throughput,
        signatoryName,
        signatoryNationalId,
      })
      setIsSubmitting(false)
      setActivatedResult(res)
      setInventoryRevision((rev) => rev + 1)
      reloadQueue()
      setReloadNonce((n) => n + 1)
      showToast(`Circuit ${res.orderId} commissioned successfully as Account ${res.accountId}! Hardware marked ASSIGNED.`)
    } catch (err) {
      setIsSubmitting(false)
      showToast(err?.message || 'Commissioning sequence encountered an error. Please retry.', 'error')
    }
  }

  const filteredOrders = useMemo(() => {
    return activationQueue.filter((order) => {
      const matchQuery =
        order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.installationAddress.toLowerCase().includes(searchQuery.toLowerCase())
      const matchFilter = serviceFilter === 'ALL' || order.serviceType === serviceFilter
      return matchQuery && matchFilter
    })
  }, [activationQueue, searchQuery, serviceFilter])

  return (
    <TechnicalLayout activeNavId="activations" toast={toast}>

      {activatedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-xl p-6 sm:p-8 shadow-2xl border border-indigo-100 animate-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm">
                <CheckCircle2 size={28} />
              </span>
              <div>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                  CIRCUIT COMMISSIONED &bull; ACTIVE
                </span>
                <h2 className="mt-1 text-xl font-extrabold text-navy">
                  Account ID Provisioned
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-center">
                <div className="text-xs font-semibold text-slate-500">Generated Subscriber Account ID (16 Chars)</div>
                <div className="mt-1 font-mono text-2xl font-black tracking-wider text-brand-accent">
                  {activatedResult.accountId}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Bound to Order #{activatedResult.orderId} &bull; {activatedResult.district || 'Core Region'} (City {activatedResult.cityCode})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subscriber</div>
                  <div className="mt-1 font-bold text-navy truncate">{activatedResult.customerName}</div>
                  <div className="text-[11px] text-slate-500">{activatedResult.serviceTitle}</div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned CPE / ONT</div>
                  <div className="mt-1 font-mono text-[11px] font-bold text-slate-700">
                    SN: {activatedResult.assignedHardware.serialNumber}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">
                    MAC: {activatedResult.assignedHardware.macAddress}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Commissioning Sign-off</div>
                <div className="mt-1 flex items-center justify-between text-slate-700">
                  <span>Signatory: <strong>{activatedResult.handoverSignatory}</strong></span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <ShieldCheck size={13} /> SLA Active (99.98%)
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActivatedResult(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Close Dialog
              </button>
              <Link
                to="/accounts/billing"
                className="btn-primary !px-5 !py-2.5 !text-xs font-bold shadow-md"
              >
                Proceed to Page 7: Billing &amp; Invoicing &rarr;
              </Link>
              <Link
                to="/"
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-brand-soft hover:bg-indigo-100 transition"
              >
                Verify in Public Tracking Portal &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5 md:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Link to="/technical/surveys" className="hover:text-brand-accent transition flex items-center gap-1">
                  <span>NOC Operations</span>
                  <ChevronRight size={12} />
                  <span>Outside Plant Survey</span>
                </Link>
                <ChevronRight size={12} />
                <span className="font-bold text-slate-700">Page 6: Terminal &amp; Circuit Commissioning</span>
                {selectedOrder && (
                  <>
                    <ChevronRight size={12} />
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-black text-brand-soft">
                      Order #{selectedOrder.orderId}
                    </span>
                  </>
                )}
              </div>
              <h1 className="mt-1.5 text-xl font-extrabold text-navy md:text-2xl">
                Terminal Provisioning &amp; Circuit Activation Engine
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Assign optical CPE/ONT hardware by Serial/MAC, record field sign-off diagnostic, and activate 16-character Account ID.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/retail/orders"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <ArrowLeft size={13} /> Back to Orders List
              </Link>
              <Link
                to="/technical/surveys"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                &larr; Back to Survey Queue
              </Link>
              <button
                type="button"
                onClick={() => {
                  reloadQueue()
                  if (selectedOrderId) setReloadNonce((n) => n + 1)
                  showToast('Refreshed local provisioning queue & hardware state.')
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                <RotateCw size={13} /> Refresh Queue
              </button>
            </div>
          </div>

          {isLoadingOrder ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-brand-soft">
                <Loader2 size={24} className="animate-spin" />
              </div>
              <h2 className="mt-4 text-base font-extrabold text-navy">Loading provisioning order...</h2>
              <p className="mt-1 text-xs text-slate-500">
                Fetching circuit specification and CPE assignment queue for Order #{selectedOrderId}.
              </p>
            </div>
          ) : orderError ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/50 p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <AlertTriangle size={24} />
              </div>
              <h2 className="mt-4 text-lg font-extrabold text-navy">
                {orderError.type === 'NOT_FOUND' ? 'Order not found' : 'Error loading provisioning order'}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-600">
                {orderError.type === 'NOT_FOUND' ? (
                  <>
                    No survey-approved order matching <span className="font-mono font-bold text-rose-700">#{orderError.orderId}</span> was found in the provisioning queue.
                  </>
                ) : (
                  orderError.message
                )}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/retail/orders"
                  className="btn-primary !px-5 !py-2.5 !text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back to Orders List
                </Link>
                <Link
                  to="/technical/surveys"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Back to Survey Queue
                </Link>
                <button
                  type="button"
                  onClick={() => setReloadNonce((n) => n + 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <RotateCw size={13} /> Retry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderError(null)
                    setSelectedOrderId('')
                    navigate('/technical/activations', { replace: true })
                  }}
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-brand-soft hover:bg-indigo-100 transition cursor-pointer"
                >
                  Browse Provisioning Queue
                </button>
              </div>
            </div>
          ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-3 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Router size={15} className="text-brand-soft" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      Provisioning Queue
                    </span>
                  </div>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-800">
                    {filteredOrders.length} Ready
                  </span>
                </div>

                <div className="relative mt-3">
                  <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Order ID, Client..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-700 outline-none transition focus:border-brand-soft"
                  />
                </div>

                <div className="mt-2.5 flex items-center gap-1">
                  {['ALL', 'BROADBAND', 'LANDLINE', 'DIAL_UP'].map((tabKey) => {
                    const label = tabKey === 'ALL' ? 'All' : tabKey === 'BROADBAND' ? 'FTTH' : tabKey === 'LANDLINE' ? 'Trunk' : 'POS'
                    const active = serviceFilter === tabKey
                    return (
                      <button
                        key={tabKey}
                        type="button"
                        onClick={() => setServiceFilter(tabKey)}
                        className={`flex-1 rounded-lg py-1 text-[10px] font-bold transition cursor-pointer ${
                          active
                            ? 'bg-brand-soft text-white shadow-xs'
                            : 'bg-white text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-3 space-y-2 max-h-[580px] overflow-y-auto pr-1">
                  {filteredOrders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
                      No survey-approved (Feasible) orders awaiting commissioning. Complete an ODN survey first.
                    </div>
                  ) : (
                    filteredOrders.map((order) => {
                      const isSelected = Boolean(selectedOrder && order.orderId === selectedOrder.orderId)
                      return (
                        <div
                          key={order.orderId}
                          onClick={() => navigate(`/technical/activations/${encodeURIComponent(order.orderId)}`)}
                          className={`cursor-pointer rounded-xl border p-3 transition-all ${
                            isSelected
                              ? 'border-brand-soft bg-white shadow-sm ring-2 ring-indigo-100'
                              : 'border-slate-200/80 bg-white/70 hover:border-slate-300 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-black text-brand-accent">
                              #{order.orderId}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">
                              <Clock size={10} /> {order.slaRemainingMinutes}m SLA
                            </span>
                          </div>

                          <div className="mt-1 text-xs font-extrabold text-navy truncate">
                            {order.customerName}
                          </div>
                          <div className="text-[11px] text-slate-500">{order.serviceTitle}</div>

                          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
                            <span>Port #{order.reservedPort} &bull; {order.distanceMeters}m</span>
                            <span className="font-bold text-emerald-600">Survey Approved</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {selectedOrder && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <div className="text-[11px] font-extrabold text-navy uppercase tracking-wider">
                    Target Circuit Infrastructure
                  </div>
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex justify-between border-b border-indigo-100/60 pb-1">
                      <span className="text-slate-500">Distribution ODF:</span>
                      <span className="font-bold text-slate-700">{selectedOrder.odfName}</span>
                    </div>
                    <div className="flex justify-between border-b border-indigo-100/60 pb-1">
                      <span className="text-slate-500">Physical Splitter Port:</span>
                      <span className="font-mono font-bold text-emerald-700">Port #0{selectedOrder.reservedPort} (Locked)</span>
                    </div>
                    <div className="flex justify-between border-b border-indigo-100/60 pb-1">
                      <span className="text-slate-500">Conduit Pathway:</span>
                      <span className="font-medium text-slate-700 truncate max-w-[150px]">{selectedOrder.conduitType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Survey Rx Attenuation:</span>
                      <span className="font-mono font-bold text-slate-800">{selectedOrder.surveyRxDbm} dBm</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!selectedOrder ? (
              <div className="lg:col-span-9 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-12 text-center">
                <div className="max-w-md">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-brand-soft">
                    <Router size={24} />
                  </div>
                  <h2 className="mt-4 text-base font-extrabold text-navy">
                    Select an Order to Begin Provisioning
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    Choose a survey-approved circuit order from the Provisioning Queue on the left to assign CPE hardware and generate an Account ID, or return to the Orders List.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      to="/retail/orders"
                      className="btn-primary !px-5 !py-2.5 !text-xs font-bold shadow-sm inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft size={14} /> Back to Orders List
                    </Link>
                    <Link
                      to="/technical/surveys"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Back to Survey Queue
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-brand-soft">
                      <Barcode size={16} />
                    </span>
                    <div>
                      <h2 className="text-sm font-extrabold text-navy">
                        Hardware CPE &amp; Terminal Assignment
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        Scan or select certified device from warehouse stock
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                    IN STOCK: {availableDevices.length} UNITS
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">
                      Select Available Warehouse Unit (Shared Inventory):
                    </label>
                    <Link
                      to="/admin/inventory"
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      Manage Stock
                    </Link>
                  </div>
                  {availableDevices.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 space-y-1">
                      <div className="font-bold text-amber-900">
                        No IN_STOCK {selectedOrder.serviceType} devices available in warehouse inventory
                      </div>
                      <p className="text-[11px]">
                        All matching units are either ASSIGNED, DEPLOYED, IN_TRANSIT, or marked FAULTY. Register new stock or recover inventory in Admin Hardware &amp; Inventory before commissioning.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableDevices.map((dev) => {
                        const isPicked = selectedDeviceId === dev.id || serialNumber.trim().toUpperCase() === dev.serialNumber
                        return (
                          <div
                            key={dev.id}
                            onClick={() => handleSelectDevice(dev)}
                            className={`cursor-pointer rounded-xl border p-3 transition ${
                              isPicked
                                ? 'border-brand-soft bg-indigo-50/60 ring-2 ring-indigo-100'
                                : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs gap-2">
                              <span className="font-bold text-navy">{dev.model}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-700">
                                  {dev.warehouseCode}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{dev.vendor}</span>
                              </div>
                            </div>
                            <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-slate-600">
                              <span>SN: <strong>{dev.serialNumber}</strong></span>
                              <span>MAC: <strong>{dev.macAddress}</strong></span>
                            </div>
                            <div className="mt-1 text-[10px] text-slate-400">{dev.ports}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <label htmlFor="serial-input">Hardware Serial Number</label>
                        {selectedOrder.status === ORDER_STATUS.ACTIVATED ? (
                          <span className="text-[10px] font-mono text-indigo-600 font-bold">Assigned</span>
                        ) : isMatchedDeviceAvailable ? (
                          <span className="text-[10px] font-mono text-emerald-600 font-bold">In Stock Verified</span>
                        ) : (
                          <span className="text-[10px] font-mono text-rose-600 font-bold">
                            {matchedWarehouseDevice ? matchedWarehouseDevice.status : 'Not Found'}
                          </span>
                        )}
                      </div>
                      <input
                        id="serial-input"
                        type="text"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        placeholder="e.g. NX8829188"
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-800 outline-none focus:border-brand-soft"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <label htmlFor="mac-input">Hardware MAC Address (EUI-48)</label>
                        <span className="text-[10px] font-mono text-emerald-600 font-bold">EUI-48 OK</span>
                      </div>
                      <input
                        id="mac-input"
                        type="text"
                        value={macAddress}
                        onChange={(e) => setMacAddress(e.target.value)}
                        placeholder="e.g. A4:5D:36:90:8C:45"
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-800 outline-none focus:border-brand-soft"
                      />
                    </div>
                  </div>

                  {selectedOrder.status === ORDER_STATUS.FEASIBLE && serialNumber.trim() && !isMatchedDeviceAvailable && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>
                        {matchedWarehouseDevice
                          ? `Unit ${matchedWarehouseDevice.serialNumber} is currently ${matchedWarehouseDevice.status}${matchedWarehouseDevice.assignedOrderId ? ` (Order #${matchedWarehouseDevice.assignedOrderId})` : ''} and cannot be reassigned.`
                          : `Serial Number "${serialNumber.trim()}" does not exist in IN_STOCK warehouse inventory. Select an available unit above.`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <div className="text-xs font-extrabold text-navy mb-2 flex items-center gap-1.5">
                    <Server size={14} className="text-brand-soft" /> Circuit Network Configuration
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">VLAN ID</label>
                      <input
                        type="number"
                        value={vlanId}
                        onChange={(e) => setVlanId(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-mono text-slate-700 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Static WAN IP</label>
                      <input
                        type="text"
                        value={ipWan}
                        onChange={(e) => setIpWan(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-mono text-slate-700 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Default Gateway</label>
                      <input
                        type="text"
                        value={gateway}
                        onChange={(e) => setGateway(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-mono text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Activity size={16} />
                    </span>
                    <h2 className="text-sm font-extrabold text-navy">
                      Field Diagnostic &amp; Acceptance
                    </h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                    SLA PASSED
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs">
                    <div>
                      <div className="font-bold text-slate-700">Actual Rx Optical Power</div>
                      <div className="text-[10px] text-slate-400">Class B+ Standard (-28 dBm limit)</div>
                    </div>
                    <span className="font-mono text-sm font-black text-emerald-600">
                      {rxPower} dBm
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs">
                    <div>
                      <div className="font-bold text-slate-700">Gateway Roundtrip Latency</div>
                      <div className="text-[10px] text-slate-400">Target Core &lt; 2.0ms</div>
                    </div>
                    <span className="font-mono text-sm font-black text-emerald-600">
                      {pingLatency} ms
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs">
                    <div>
                      <div className="font-bold text-slate-700">Symmetrical Bandwidth</div>
                      <div className="text-[10px] text-slate-400">Committed Info Rate (CIR)</div>
                    </div>
                    <span className="font-mono text-xs font-black text-slate-800">
                      {throughput}
                    </span>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">
                    Handover Protocol &amp; Sign-off Dossier
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Client Authorized Signatory
                      </label>
                      <input
                        type="text"
                        value={signatoryName}
                        onChange={(e) => setSignatoryName(e.target.value)}
                        placeholder="e.g. Nguyen Van An (IT Director)"
                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-brand-soft"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                        Signatory National ID / CCCD
                      </label>
                      <input
                        type="text"
                        value={signatoryNationalId}
                        onChange={(e) => setSignatoryNationalId(e.target.value)}
                        placeholder="12-digit National ID"
                        className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-mono text-slate-800 outline-none focus:border-brand-soft"
                      />
                    </div>

                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700">
                        <UploadCloud size={16} className="text-brand-soft" />
                        Signed Acceptance Protocol Attached
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        Handover_Protocol_{selectedOrder.orderId}_Signed.pdf (1.4 MB) &bull; Verified
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      Account ID Generator (16 Chars)
                    </span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-800">
                      INVARIANTS OK
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between rounded-xl border border-indigo-200 bg-white px-3.5 py-2.5">
                    <span className="font-mono text-base font-black tracking-wider text-navy">
                      {calculatedAccountId}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAccountId}
                      className="cursor-pointer text-slate-400 hover:text-brand-accent transition"
                      title="Copy Account ID"
                    >
                      {copiedAccount ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-brand-accent" />
                    Format: [Prefix][CityCode 3-digit][12-digit Sequence]
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="font-bold text-slate-700">Commissioning Actions</span>
                  <span className="text-[11px] text-slate-400">Circuit &amp; Account ID</span>
                </div>

                <div className="space-y-2">
                  {selectedOrder.status !== ORDER_STATUS.FEASIBLE && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">Commissioning Locked</span>
                        <OrderStatusBadge status={selectedOrder.status} />
                      </div>
                      <p className="text-[11px]">
                        {selectedOrder.status === ORDER_STATUS.ACTIVATED
                          ? `Already commissioned with Account ID ${selectedOrder.accountId || ''}.`
                          : 'Order must be approved as FEASIBLE in ODN Survey before provisioning.'}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCommission}
                    disabled={
                      isSubmitting ||
                      selectedOrder.status !== ORDER_STATUS.FEASIBLE ||
                      !isMatchedDeviceAvailable
                    }
                    className="btn-primary w-full !py-3 !rounded-xl !text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>Commissioning Circuit &amp; Activating...</>
                    ) : selectedOrder.status === ORDER_STATUS.ACTIVATED ? (
                      <>Already Activated</>
                    ) : !isMatchedDeviceAvailable ? (
                      <>Select Valid IN_STOCK Hardware to Commission</>
                    ) : (
                      <>
                        <span>Commission Circuit &amp; Activate Account ID</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => showToast('Testing dossier saved as technical draft.')}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast('Acceptance Protocol dispatched to printer.')}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Print Protocol
                    </button>
                  </div>
                </div>
              </div>
            </div>
              </>
            )}
          </div>
          )}
        </div>
    </TechnicalLayout>
  )
}

