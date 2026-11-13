import { useState, useMemo, useEffect } from 'react'
import {
  HardDrive,
  Search,
  Download,
  Plus,
  RotateCw,
  X,
  ChevronRight,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import {
  fetchInventoryRecords,
  saveInventoryRecords,
  addInventoryDevice,
  toggleInventoryFaultyStatus,
  fetchDispatchOrders,
  saveDispatchOrders,
  WAREHOUSE_LOCATIONS,
  subscribeInventoryUpdated,
} from '../../services/inventoryService'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { useToast } from '../../hooks/useToast'

const isAssignedOrDeployed = (status) => status === 'ASSIGNED' || status === 'DEPLOYED'

export default function InventoryHardwarePage() {
  const {
    data: inventoryBundle,
    setData: setInventoryBundle,
    isLoading,
    error,
    reload: reloadInventory,
  } = useAsyncResource(
    () =>
      Promise.resolve({
        items: fetchInventoryRecords(),
        dispatchOrders: fetchDispatchOrders(),
      }),
    []
  )
  const items = inventoryBundle?.items || []
  const dispatchOrders = inventoryBundle?.dispatchOrders || []

  useEffect(() => {
    return subscribeInventoryUpdated(() => {
      setInventoryBundle({
        items: fetchInventoryRecords(),
        dispatchOrders: fetchDispatchOrders(),
      })
    })
  }, [setInventoryBundle])
  const [actionError, setActionError] = useState(null)
  const [activeTab, setActiveTab] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL')
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState(null)
  const { toast, showToast } = useToast()

  function updateInventoryState(nextItems, nextDispatches = dispatchOrders) {
    setInventoryBundle({
      items: nextItems,
      dispatchOrders: nextDispatches,
    })
  }

  const depotLocations = useMemo(
    () => WAREHOUSE_LOCATIONS.filter((w) => w.code !== 'ALL'),
    []
  )

  const [newDeviceForm, setNewDeviceForm] = useState({
    model: 'Nokia ISAM ONT G-240W-C',
    category: 'ONT',
    serialNumber: '',
    macAddress: '',
    warehouseCode: 'HUB-HN-01',
    batchPo: 'PO#2026-NK-01',
  })

  const [transferForm, setTransferForm] = useState({
    toWarehouse: 'STORE-DN0-001',
    notes: 'Urgent store inventory replenishment',
  })

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchTab =
        activeTab === 'ALL' ||
        (activeTab === 'ASSIGNED_DEPLOYED'
          ? isAssignedOrDeployed(item.status)
          : item.status === activeTab)
      const matchWarehouse = selectedWarehouse === 'ALL' || item.warehouseCode === selectedWarehouse
      const q = searchQuery.toLowerCase().trim()
      const serial = (item.serialNumber || item.id || '').toLowerCase()
      const mac = (item.macAddress || '').toLowerCase()
      const model = (item.model || '').toLowerCase()
      const orderRef = (item.assignedOrderId || '').toLowerCase()
      const accountRef = (item.contractAccount || '').toLowerCase()
      const matchSearch =
        !q ||
        serial.includes(q) ||
        mac.includes(q) ||
        model.includes(q) ||
        orderRef.includes(q) ||
        accountRef.includes(q) ||
        (item.assignedCustomer && item.assignedCustomer.toLowerCase().includes(q)) ||
        (item.customerName && item.customerName.toLowerCase().includes(q))
      return matchTab && matchWarehouse && matchSearch
    })
  }, [items, activeTab, selectedWarehouse, searchQuery])

  const stats = useMemo(() => {
    const total = items.length
    const inStock = items.filter((i) => i.status === 'IN_STOCK').length
    const assigned = items.filter((i) => isAssignedOrDeployed(i.status)).length
    const faulty = items.filter((i) => i.status === 'FAULTY').length
    return { total, inStock, assigned, faulty }
  }, [items])

  function handleRegisterDevice(e) {
    e.preventDefault()
    if (!newDeviceForm.serialNumber || !newDeviceForm.macAddress) return

    try {
      const { device, items: updated } = addInventoryDevice(newDeviceForm)
      updateInventoryState(updated)
      setIsRegisterModalOpen(false)
      setActionError(null)
      setNewDeviceForm({
        model: 'Nokia ISAM ONT G-240W-C',
        category: 'ONT',
        serialNumber: '',
        macAddress: '',
        warehouseCode: 'HUB-HN-01',
        batchPo: 'PO#2026-NK-01',
      })
      showToast(`Device ${device.serialNumber} registered into IN_STOCK warehouse catalog!`)
    } catch (err) {
      const msg = err?.message || 'Unable to register hardware device.'
      setActionError(msg)
      showToast(msg, 'error')
    }
  }

  function handleOpenTransfer(item) {
    setSelectedItemForTransfer(item)
    const otherWarehouse = depotLocations.find((w) => w.code !== item.warehouseCode)
    setTransferForm({
      toWarehouse: otherWarehouse ? otherWarehouse.code : 'STORE-HN-001',
      notes: `Transfer request for ${item.serialNumber || item.id}`,
    })
    setIsTransferModalOpen(true)
  }

  function handleExecuteTransfer(e) {
    e.preventDefault()
    if (!selectedItemForTransfer) return

    const fromWh = selectedItemForTransfer.warehouseCode
    const toWh = transferForm.toWarehouse

    const newDispatchOrder = {
      dispatchId: `DSP-2026-${String(dispatchOrders.length + 1).padStart(4, '0')}`,
      fromWarehouse: fromWh,
      toLocation: toWh,
      equipmentSerial: selectedItemForTransfer.serialNumber || selectedItemForTransfer.id,
      equipmentModel: selectedItemForTransfer.model,
      status: 'IN_TRANSIT',
      courier: 'ViettelPost Priority Secure Transport',
      dispatchedTime: '18/03/2026 14:10',
      eta: '19/03/2026 10:00',
    }

    try {
      const updatedItems = items.map((i) =>
        i.id === selectedItemForTransfer.id
          ? { ...i, warehouseCode: toWh, status: 'IN_TRANSIT' }
          : i
      )

      const updatedDispatches = [newDispatchOrder, ...dispatchOrders]

      updateInventoryState(updatedItems, updatedDispatches)
      saveInventoryRecords(updatedItems)
      saveDispatchOrders(updatedDispatches)

      setActionError(null)
      setIsTransferModalOpen(false)
      setSelectedItemForTransfer(null)
      showToast(`Dispatched ${selectedItemForTransfer.serialNumber || selectedItemForTransfer.id} to ${toWh}!`)
    } catch (err) {
      const msg = err?.message || 'Unable to issue inter-depot dispatch.'
      setActionError(msg)
      showToast(msg, 'error')
    }
  }

  function handleToggleStatus(item) {
    try {
      const { device, items: updated } = toggleInventoryFaultyStatus(item.id)
      updateInventoryState(updated)
      setActionError(null)
      showToast(`Updated ${device.serialNumber} status to ${device.status}.`)
    } catch (err) {
      const msg = err?.message || 'Unable to update hardware status.'
      setActionError(msg)
      showToast(msg, 'error')
    }
  }

  return (
    <AdminLayout activeNavId="inventory" toast={toast}>
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Register New Hardware</h3>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterDevice} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Equipment Model</label>
                <select
                  value={newDeviceForm.model}
                  onChange={(e) => {
                    const val = e.target.value
                    let cat = 'ONT'
                    if (val.includes('Cisco')) cat = 'ROUTER'
                    if (val.includes('Grandstream') || val.includes('AudioCodes')) cat = 'VOIP'
                    if (val.includes('Dial-Up') || val.includes('MultiTech')) cat = 'MODEM'
                    setNewDeviceForm({ ...newDeviceForm, model: val, category: cat })
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                >
                  <option value="Nokia ISAM ONT G-240W-C">Nokia ISAM ONT G-240W-C (Broadband GPON)</option>
                  <option value="Cisco Catalyst PON 800">Cisco Catalyst PON 800 (Leased Line Router)</option>
                  <option value="MultiTech MultiModem II 56K">MultiTech MultiModem II 56K (Dial-Up POS)</option>
                  <option value="Grandstream UCM6302">Grandstream UCM6302 (Landline / IP-PBX)</option>
                  <option value="AudioCodes Mediant 800 Enterprise SBC">AudioCodes Mediant 800 SBC (SIP Trunk)</option>
                  <option value="Modem Dial-Up POS V.92">Modem Dial-Up POS V.92 (Payment Engine)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Serial Number (S/N)</label>
                <input
                  type="text"
                  placeholder="e.g. NX8829255"
                  value={newDeviceForm.serialNumber}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, serialNumber: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-medium outline-none focus:bg-white focus:border-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">MAC Address (EUI-48)</label>
                <input
                  type="text"
                  placeholder="e.g. BC:24:11:8A:4F:9C"
                  value={newDeviceForm.macAddress}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, macAddress: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-medium outline-none focus:bg-white focus:border-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Intake Warehouse Depot</label>
                <select
                  value={newDeviceForm.warehouseCode}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, warehouseCode: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                >
                  {depotLocations.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 transition cursor-pointer shadow-xs"
                >
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTransferModalOpen && selectedItemForTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Issue Inter-Depot Dispatch</h3>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs border border-slate-200 space-y-1">
              <div className="font-bold text-slate-800">{selectedItemForTransfer.model}</div>
              <div className="font-mono text-slate-500">S/N: {selectedItemForTransfer.serialNumber || selectedItemForTransfer.id}</div>
              <div className="text-slate-400">Current Depot: <strong>{selectedItemForTransfer.warehouseCode}</strong></div>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Destination Warehouse / Hub</label>
                <select
                  value={transferForm.toWarehouse}
                  onChange={(e) => setTransferForm({ ...transferForm, toWarehouse: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                >
                  {depotLocations.filter((w) => w.code !== selectedItemForTransfer.warehouseCode).map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Transfer Purpose / Note</label>
                <input
                  type="text"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 transition cursor-pointer shadow-xs"
                >
                  Issue Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Admin Console</span>
              <ChevronRight size={12} />
              <span>CPE &amp; Terminal Management</span>
              <ChevronRight size={12} />
              <span>Depot Operations</span>
              <ChevronRight size={12} />
              <span className="font-bold text-navy">Hardware &amp; Inventory</span>
            </div>
            <h1 className="mt-1.5 text-xl font-extrabold text-navy md:text-2xl">
              Hardware Inventory &amp; Terminal Lifecycle Management
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-black text-sky-800">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> LOCAL_INVENTORY_STORE
              </span>
              <span className="text-slate-500">Repository: <strong>Central Warehouses &amp; Regional Store Depots</strong></span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-500">
                Active Devices: <strong className="text-emerald-600">{stats.total} Units Registered</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Register Hardware</span>
            </button>
            <button
              type="button"
              onClick={() => showToast('Inventory report exported as CSV.')}
              disabled={isLoading || items.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={reloadInventory}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <RotateCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {actionError && (
          <div className="mt-4">
            <AsyncStatePanel
              compact
              state="error"
              title="Inventory Action Error"
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
              title="Loading hardware inventory..."
              description="Synchronizing GPON ONT terminals, EUI-48 MAC registries, and warehouse transfer logs."
            />
          </div>
        ) : error ? (
          <div className="mt-5">
            <AsyncStatePanel
              state="error"
              title="Unable to load hardware inventory"
              description={error}
              onRetry={reloadInventory}
            />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-5">
            <AsyncStatePanel
              state="empty"
              icon={HardDrive}
              title="No Hardware Units Registered"
              description="Your warehouse catalog is empty. Register ONT modems, SIP gateways, or enterprise routers to track stock and transfers."
              actionLabel="Register Hardware"
              onAction={() => setIsRegisterModalOpen(true)}
            />
          </div>
        ) : (
        <>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Catalog Items</span>
            <div className="mt-1 text-2xl font-black text-navy">{stats.total} Units</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>All registered hardware</span>
              <span className="font-bold text-indigo-600">Assets</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Available in Stock</span>
            <div className="mt-1 text-2xl font-black text-emerald-600">{stats.inStock} Units</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>Ready for dispatch</span>
              <span className="font-bold text-emerald-700">Available</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Assigned / Deployed</span>
            <div className="mt-1 text-2xl font-black text-navy">{stats.assigned} Units</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>Assigned to subscriber orders</span>
              <span className="font-bold text-sky-700">Assigned</span>
            </div>
          </div>
          <div className="rounded-2xl p-4 bg-navy text-white shadow-lg shadow-navy/20 border-none">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">Faulty / RMA Queue</span>
            <div className="mt-1 text-2xl font-black text-rose-400">{stats.faulty} Units</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300 border-t border-white/10 pt-1.5">
              <span>Hardware RMA &bull; Diagnostics</span>
              <span className="font-bold text-rose-300">RMA</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 p-4 gap-3 bg-slate-50/50">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: `All Devices (${items.length})` },
                { id: 'IN_STOCK', label: `In Stock (${stats.inStock})` },
                { id: 'ASSIGNED_DEPLOYED', label: `Assigned / Deployed (${stats.assigned})` },
                { id: 'IN_TRANSIT', label: `In Transit (${items.filter((i) => i.status === 'IN_TRANSIT').length})` },
                { id: 'FAULTY', label: `Faulty / RMA (${stats.faulty})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="ALL">All Warehouses</option>
                {depotLocations.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.name}
                  </option>
                ))}
              </select>

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Serial, MAC, Model, Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-600"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                  <th className="py-3 px-4">Hardware Model &amp; Category</th>
                  <th className="py-3 px-4">Serial Number (S/N)</th>
                  <th className="py-3 px-4">MAC Address (EUI-48)</th>
                  <th className="py-3 px-4">Current Warehouse / Hub</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Subscriber Assignment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-4">
                      <AsyncStatePanel
                        compact
                        state="empty"
                        icon={Search}
                        title="No matching hardware units"
                        description="No terminals or warehouse records matched the selected tab, depot filter, or search text."
                        actionLabel="Reset Filters"
                        onAction={() => {
                          setActiveTab('ALL')
                          setSelectedWarehouse('ALL')
                          setSearchQuery('')
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{item.model}</div>
                        <div className="text-[10px] text-slate-400">{item.category} &bull; FW: {item.firmware || 'NX-FW-v4.8'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">{item.serialNumber || item.id}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{item.macAddress}</td>
                      <td className="py-3.5 px-4">
                        <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-700">
                          {item.warehouseCode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                            item.status === 'IN_STOCK'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isAssignedOrDeployed(item.status)
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : item.status === 'IN_TRANSIT'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.assignedCustomer || (item.customerName && item.customerName !== 'Unassigned (-)') ? (
                          <div>
                            <div className="font-bold text-slate-900 truncate max-w-xs">{item.assignedCustomer || item.customerName}</div>
                            {(item.assignedOrderId || item.contractAccount) && (
                              <div className="font-mono text-[10px] text-slate-400">
                                {item.assignedOrderId ? `Order #${item.assignedOrderId}` : ''}
                                {item.assignedOrderId && item.contractAccount ? ' • ' : ''}
                                {item.contractAccount ? `Acc ${item.contractAccount}` : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenTransfer(item)}
                            disabled={isAssignedOrDeployed(item.status)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Transfer
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                            disabled={isAssignedOrDeployed(item.status)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Toggle Faulty/In-Stock"
                          >
                            {item.status === 'FAULTY' ? 'Clear RMA' : 'RMA'}
                          </button>
                        </div>
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
    </AdminLayout>
  )
}
