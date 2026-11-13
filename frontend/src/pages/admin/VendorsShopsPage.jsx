import { useState, useMemo } from 'react'
import {
  Search,
  Download,
  Plus,
  Edit3,
  Trash2,
  X,
  ChevronRight,
  AlertTriangle,
  Store,
  Package,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import {
  fetchMetroPrefixes,
  fetchRetailStores,
  createRetailStore,
  updateRetailStore,
  deleteRetailStore,
  fetchHardwareVendors,
  createHardwareVendor,
  updateHardwareVendor,
  deleteHardwareVendor,
  generateTestAccountId,
} from '../../services/vendorShopService'
import { useToast } from '../../hooks/useToast'

const EMPTY_STORE_FORM = {
  storeCode: '',
  storeName: '',
  cityCode: '101',
  address: '',
  managerName: '',
  phone: '+84 24 3900 1000',
  staffCount: '6',
  cpeStock: '50',
  cpeCapacity: '120',
  counterNumber: '01',
  type: 'Direct Store',
  status: 'ACTIVE',
}

const EMPTY_VENDOR_FORM = {
  id: '',
  vendorName: '',
  headquarters: '',
  flagshipProduct: '',
  standard: '',
  specs: '',
  unitCostUSD: '50',
  monthlySupply: '1000',
  availableStock: '250',
  defectRate: '< 0.10%',
  warranty: '24 Months Replacement',
  status: 'APPROVED',
}

function downloadCsv(filename, headers, rows) {
  if (typeof document === 'undefined') return
  const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function VendorsShopsPage() {
  const [prefixes] = useState(() => fetchMetroPrefixes())
  const [stores, setStores] = useState(() => fetchRetailStores())
  const [vendors, setVendors] = useState(() => fetchHardwareVendors())

  const [activeTab, setActiveTab] = useState('STORES')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCityFilter, setSelectedCityFilter] = useState('ALL')
  const [storeStatusFilter, setStoreStatusFilter] = useState('ALL')
  const [vendorStatusFilter, setVendorStatusFilter] = useState('ALL')

  const [storeModalMode, setStoreModalMode] = useState(null)
  const [editingStoreCode, setEditingStoreCode] = useState(null)
  const [storeForm, setStoreForm] = useState(EMPTY_STORE_FORM)
  const [storeFormError, setStoreFormError] = useState('')
  const [deletingStore, setDeletingStore] = useState(null)

  const [vendorModalMode, setVendorModalMode] = useState(null)
  const [editingVendorId, setEditingVendorId] = useState(null)
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR_FORM)
  const [vendorFormError, setVendorFormError] = useState('')
  const [deletingVendor, setDeletingVendor] = useState(null)

  const { toast, showToast } = useToast()

  const [testPrefixType, setTestPrefixType] = useState('B')
  const [testCityCode, setTestCityCode] = useState('101')
  const [testSerial, setTestSerial] = useState(89)

  const simulatedAccountId = useMemo(() => {
    return generateTestAccountId(testPrefixType, testCityCode, testSerial)
  }, [testPrefixType, testCityCode, testSerial])

  const filteredStores = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return stores.filter((s) => {
      const matchCity = selectedCityFilter === 'ALL' || s.cityCode === selectedCityFilter
      const matchStatus = storeStatusFilter === 'ALL' || s.status === storeStatusFilter
      const matchSearch =
        !q ||
        (s.storeName || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q) ||
        (s.managerName || '').toLowerCase().includes(q) ||
        (s.storeCode || '').toLowerCase().includes(q) ||
        (s.cityName || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q)
      return matchCity && matchStatus && matchSearch
    })
  }, [stores, selectedCityFilter, storeStatusFilter, searchQuery])

  const filteredVendors = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return vendors.filter((v) => {
      const matchStatus = vendorStatusFilter === 'ALL' || v.status === vendorStatusFilter
      const matchSearch =
        !q ||
        (v.vendorName || '').toLowerCase().includes(q) ||
        (v.id || '').toLowerCase().includes(q) ||
        (v.flagshipProduct || '').toLowerCase().includes(q) ||
        (v.standard || '').toLowerCase().includes(q) ||
        (v.headquarters || '').toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [vendors, vendorStatusFilter, searchQuery])

  function openCreateStoreModal() {
    setStoreModalMode('create')
    setEditingStoreCode(null)
    setStoreForm(EMPTY_STORE_FORM)
    setStoreFormError('')
  }

  function openEditStoreModal(store) {
    setStoreModalMode('edit')
    setEditingStoreCode(store.storeCode)
    setStoreForm({
      storeCode: store.storeCode || '',
      storeName: store.storeName || '',
      cityCode: store.cityCode || '101',
      address: store.address || '',
      managerName: store.managerName || '',
      phone: store.phone || '+84 24 3900 1000',
      staffCount: String(store.staffCount ?? 6),
      cpeStock: String(store.cpeStock ?? 40),
      cpeCapacity: String(store.cpeCapacity ?? 100),
      counterNumber: String(store.counterNumber || '01'),
      type: store.type || 'Direct Store',
      status: store.status || 'ACTIVE',
    })
    setStoreFormError('')
  }

  function closeStoreModal() {
    setStoreModalMode(null)
    setEditingStoreCode(null)
    setStoreFormError('')
  }

  function handleSaveStore(e) {
    e.preventDefault()
    setStoreFormError('')
    try {
      if (storeModalMode === 'create') {
        const { store, stores: updated } = createRetailStore({
          ...storeForm,
          staffCount: Number(storeForm.staffCount),
          cpeStock: Number(storeForm.cpeStock),
          cpeCapacity: Number(storeForm.cpeCapacity),
        })
        setStores(updated)
        setActiveTab('STORES')
        closeStoreModal()
        showToast(`Store "${store.storeName}" (${store.storeCode}) created successfully.`)
      } else if (storeModalMode === 'edit' && editingStoreCode) {
        const { store, stores: updated } = updateRetailStore(editingStoreCode, {
          storeName: storeForm.storeName,
          cityCode: storeForm.cityCode,
          address: storeForm.address,
          managerName: storeForm.managerName,
          phone: storeForm.phone,
          staffCount: Number(storeForm.staffCount),
          cpeStock: Number(storeForm.cpeStock),
          cpeCapacity: Number(storeForm.cpeCapacity),
          counterNumber: storeForm.counterNumber,
          type: storeForm.type,
          status: storeForm.status,
        })
        setStores(updated)
        closeStoreModal()
        showToast(`Updated store "${store.storeName}" (${store.storeCode}).`)
      }
    } catch (err) {
      setStoreFormError(err.message || 'Unable to save retail store.')
    }
  }

  function handleQuickToggleStoreStatus(store) {
    const nextStatus = store.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE'
    try {
      const { store: updatedStore, stores: updated } = updateRetailStore(store.storeCode, {
        status: nextStatus,
      })
      setStores(updated)
      showToast(`Store ${updatedStore.storeCode} status changed to ${nextStatus}.`)
    } catch (err) {
      showToast(err.message || 'Failed to update store status.', 'error')
    }
  }

  function handleConfirmDeleteStore() {
    if (!deletingStore) return
    try {
      const { deleted, stores: updated } = deleteRetailStore(deletingStore.storeCode)
      setStores(updated)
      setDeletingStore(null)
      showToast(`Removed retail store ${deleted.storeCode} (${deleted.storeName}).`)
    } catch (err) {
      showToast(err.message || 'Unable to delete retail store.', 'error')
      setDeletingStore(null)
    }
  }

  function openCreateVendorModal() {
    setVendorModalMode('create')
    setEditingVendorId(null)
    setVendorForm(EMPTY_VENDOR_FORM)
    setVendorFormError('')
  }

  function openEditVendorModal(vendor) {
    setVendorModalMode('edit')
    setEditingVendorId(vendor.id)
    setVendorForm({
      id: vendor.id || '',
      vendorName: vendor.vendorName || '',
      headquarters: vendor.headquarters || '',
      flagshipProduct: vendor.flagshipProduct || '',
      standard: vendor.standard || '',
      specs: vendor.specs || '',
      unitCostUSD: String(vendor.unitCostUSD ?? 0),
      monthlySupply: String(vendor.monthlySupply ?? 0),
      availableStock: String(vendor.availableStock ?? 0),
      defectRate: vendor.defectRate || '< 0.10%',
      warranty: vendor.warranty || '24 Months Replacement',
      status: vendor.status || 'APPROVED',
    })
    setVendorFormError('')
  }

  function closeVendorModal() {
    setVendorModalMode(null)
    setEditingVendorId(null)
    setVendorFormError('')
  }

  function handleSaveVendor(e) {
    e.preventDefault()
    setVendorFormError('')
    try {
      if (vendorModalMode === 'create') {
        const { vendor, vendors: updated } = createHardwareVendor({
          ...vendorForm,
          unitCostUSD: Number(vendorForm.unitCostUSD),
          monthlySupply: Number(vendorForm.monthlySupply),
          availableStock: Number(vendorForm.availableStock),
        })
        setVendors(updated)
        setActiveTab('VENDORS')
        closeVendorModal()
        showToast(`Vendor "${vendor.vendorName}" (${vendor.id}) added successfully.`)
      } else if (vendorModalMode === 'edit' && editingVendorId) {
        const { vendor, vendors: updated } = updateHardwareVendor(editingVendorId, {
          vendorName: vendorForm.vendorName,
          headquarters: vendorForm.headquarters,
          flagshipProduct: vendorForm.flagshipProduct,
          standard: vendorForm.standard,
          specs: vendorForm.specs,
          unitCostUSD: Number(vendorForm.unitCostUSD),
          monthlySupply: Number(vendorForm.monthlySupply),
          availableStock: Number(vendorForm.availableStock),
          defectRate: vendorForm.defectRate,
          warranty: vendorForm.warranty,
          status: vendorForm.status,
        })
        setVendors(updated)
        closeVendorModal()
        showToast(`Updated hardware vendor "${vendor.vendorName}" (${vendor.id}).`)
      }
    } catch (err) {
      setVendorFormError(err.message || 'Unable to save hardware vendor.')
    }
  }

  function handleQuickToggleVendorStatus(vendor) {
    const nextStatus = vendor.status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED'
    try {
      const { vendor: updatedVendor, vendors: updated } = updateHardwareVendor(vendor.id, {
        status: nextStatus,
      })
      setVendors(updated)
      showToast(`Vendor ${updatedVendor.id} status changed to ${nextStatus}.`)
    } catch (err) {
      showToast(err.message || 'Failed to update vendor status.', 'error')
    }
  }

  function handleConfirmDeleteVendor() {
    if (!deletingVendor) return
    try {
      const { deleted, vendors: updated } = deleteHardwareVendor(deletingVendor.id)
      setVendors(updated)
      setDeletingVendor(null)
      showToast(`Removed vendor ${deleted.id} (${deleted.vendorName}).`)
    } catch (err) {
      showToast(err.message || 'Unable to delete hardware vendor.', 'error')
      setDeletingVendor(null)
    }
  }

  function handleExportCsv() {
    if (activeTab === 'VENDORS') {
      downloadCsv(
        'nexus-hardware-vendors.csv',
        ['Vendor ID', 'Vendor Name', 'Headquarters', 'Flagship Product', 'Standard', 'Unit Cost USD', 'Available Stock', 'Monthly Supply', 'Defect Rate', 'Warranty', 'Status'],
        filteredVendors.map((v) => [
          v.id,
          v.vendorName,
          v.headquarters,
          v.flagshipProduct,
          v.standard,
          v.unitCostUSD,
          v.availableStock,
          v.monthlySupply,
          v.defectRate,
          v.warranty,
          v.status,
        ])
      )
      showToast(`Exported ${filteredVendors.length} hardware vendors to CSV.`)
      return
    }
    if (activeTab === 'PREFIXES') {
      downloadCsv(
        'nexus-metro-prefixes.csv',
        ['City Code', 'City Name', 'Region', 'NOC Hub', 'Active Subscribers', 'Outlets', 'Status'],
        prefixes.map((p) => [
          p.cityCode,
          p.cityName,
          p.region,
          p.nocHub,
          p.activeSubscribers,
          p.storeCount,
          p.status,
        ])
      )
      showToast(`Exported ${prefixes.length} metro prefixes to CSV.`)
      return
    }
    downloadCsv(
      'nexus-retail-stores.csv',
      ['Store Code', 'Store Name', 'City Code', 'City Name', 'Address', 'Manager', 'Phone', 'Staff', 'CPE Stock', 'CPE Capacity', 'Status'],
      filteredStores.map((s) => [
        s.storeCode,
        s.storeName,
        s.cityCode,
        s.cityName,
        s.address,
        s.managerName,
        s.phone,
        s.staffCount,
        s.cpeStock,
        s.cpeCapacity,
        s.status,
      ])
    )
    showToast(`Exported ${filteredStores.length} retail stores to CSV.`)
  }

  const activeStoresCount = stores.filter((s) => s.status === 'ACTIVE').length
  const approvedVendorsCount = vendors.filter((v) => v.status === 'APPROVED').length

  return (
    <AdminLayout activeNavId="shops" toast={toast}>
      {storeModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Store size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {storeModalMode === 'edit'
                      ? `Edit Retail Store (${editingStoreCode})`
                      : 'Add New Retail Store'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Manage retail outlet location, counter staffing, CPE allocation &amp; operational state
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeStoreModal}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Close store modal"
              >
                <X size={18} />
              </button>
            </div>

            {storeFormError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{storeFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStore} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    Store Code {storeModalMode === 'create' && '(optional)'}
                  </label>
                  <input
                    type="text"
                    disabled={storeModalMode === 'edit'}
                    placeholder="Auto-generated if blank"
                    value={storeForm.storeCode}
                    onChange={(e) => setStoreForm({ ...storeForm, storeCode: e.target.value })}
                    className={`w-full rounded-xl border border-slate-200 px-3 py-2 font-mono font-semibold outline-none ${
                      storeModalMode === 'edit'
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-50 focus:bg-white focus:border-indigo-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Store Type</label>
                  <select
                    value={storeForm.type}
                    onChange={(e) => setStoreForm({ ...storeForm, type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  >
                    <option value="Direct Store">Direct Store</option>
                    <option value="Flagship Store">Flagship Store</option>
                    <option value="Partner Desk">Partner Desk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Store Name</label>
                <input
                  type="text"
                  placeholder="e.g. Cau Giay Flagship Store"
                  value={storeForm.storeName}
                  onChange={(e) => setStoreForm({ ...storeForm, storeName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Regional City / Metro Code</label>
                  <select
                    value={storeForm.cityCode}
                    onChange={(e) => setStoreForm({ ...storeForm, cityCode: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  >
                    {prefixes.map((p) => (
                      <option key={p.cityCode} value={p.cityCode}>
                        {p.cityCode} - {p.cityName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Status</label>
                  <select
                    value={storeForm.status}
                    onChange={(e) => setStoreForm({ ...storeForm, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Store Address</label>
                <input
                  type="text"
                  placeholder="e.g. 14 Lane 68 Trung Kinh, Cau Giay"
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Store Manager</label>
                  <input
                    type="text"
                    placeholder="e.g. Le Quoc Bao"
                    value={storeForm.managerName}
                    onChange={(e) => setStoreForm({ ...storeForm, managerName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+84 912 345 678"
                    value={storeForm.phone}
                    onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Staff</label>
                  <input
                    type="number"
                    min="0"
                    value={storeForm.staffCount}
                    onChange={(e) => setStoreForm({ ...storeForm, staffCount: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">CPE Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={storeForm.cpeStock}
                    onChange={(e) => setStoreForm({ ...storeForm, cpeStock: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={storeForm.cpeCapacity}
                    onChange={(e) => setStoreForm({ ...storeForm, cpeCapacity: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Counters</label>
                  <input
                    type="text"
                    value={storeForm.counterNumber}
                    onChange={(e) => setStoreForm({ ...storeForm, counterNumber: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeStoreModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-white font-bold hover:bg-indigo-700 shadow-sm cursor-pointer"
                >
                  {storeModalMode === 'edit' ? 'Save Store' : 'Create Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {vendorModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {vendorModalMode === 'edit'
                      ? `Edit Hardware Vendor (${editingVendorId})`
                      : 'Add Hardware Vendor'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure equipment partner profile, unit pricing, monthly supply capacity &amp; approval status
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeVendorModal}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Close vendor modal"
              >
                <X size={18} />
              </button>
            </div>

            {vendorFormError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{vendorFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveVendor} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    Vendor ID {vendorModalMode === 'create' && '(optional)'}
                  </label>
                  <input
                    type="text"
                    disabled={vendorModalMode === 'edit'}
                    placeholder="Auto-generated if blank"
                    value={vendorForm.id}
                    onChange={(e) => setVendorForm({ ...vendorForm, id: e.target.value })}
                    className={`w-full rounded-xl border border-slate-200 px-3 py-2 font-mono font-semibold outline-none ${
                      vendorModalMode === 'edit'
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-50 focus:bg-white focus:border-indigo-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Approval Status</label>
                  <select
                    value={vendorForm.status}
                    onChange={(e) => setVendorForm({ ...vendorForm, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  >
                    <option value="APPROVED">APPROVED</option>
                    <option value="PROBATION">PROBATION</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Vendor Partner Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ZTE Telecom Corp"
                    value={vendorForm.vendorName}
                    onChange={(e) => setVendorForm({ ...vendorForm, vendorName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Headquarters / Rep Office</label>
                  <input
                    type="text"
                    placeholder="e.g. Ho Chi Minh Rep SLA Tier-1"
                    value={vendorForm.headquarters}
                    onChange={(e) => setVendorForm({ ...vendorForm, headquarters: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Flagship Hardware Model</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ZXHN F670L ONT"
                    value={vendorForm.flagshipProduct}
                    onChange={(e) => setVendorForm({ ...vendorForm, flagshipProduct: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Hardware Standard</label>
                  <input
                    type="text"
                    placeholder="e.g. GPON Wi-Fi 6 Gateway"
                    value={vendorForm.standard}
                    onChange={(e) => setVendorForm({ ...vendorForm, standard: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Technical Specs Summary</label>
                <input
                  type="text"
                  placeholder="e.g. 4x GbE, Dual-band Wi-Fi 6, 1x FXS"
                  value={vendorForm.specs}
                  onChange={(e) => setVendorForm({ ...vendorForm, specs: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={vendorForm.unitCostUSD}
                    onChange={(e) => setVendorForm({ ...vendorForm, unitCostUSD: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Monthly Supply</label>
                  <input
                    type="number"
                    min="0"
                    value={vendorForm.monthlySupply}
                    onChange={(e) => setVendorForm({ ...vendorForm, monthlySupply: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Available Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={vendorForm.availableStock}
                    onChange={(e) => setVendorForm({ ...vendorForm, availableStock: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Reported Defect Rate</label>
                  <input
                    type="text"
                    value={vendorForm.defectRate}
                    onChange={(e) => setVendorForm({ ...vendorForm, defectRate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Warranty Terms</label>
                  <input
                    type="text"
                    value={vendorForm.warranty}
                    onChange={(e) => setVendorForm({ ...vendorForm, warranty: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeVendorModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-white font-bold hover:bg-emerald-700 shadow-sm cursor-pointer"
                >
                  {vendorModalMode === 'edit' ? 'Save Vendor' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(deletingStore || deletingVendor) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600 border border-rose-200">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {deletingStore ? 'Confirm Store Removal' : 'Confirm Vendor Removal'}
                </h3>
                <p className="text-xs text-slate-500">
                  {deletingStore
                    ? `${deletingStore.storeCode} (${deletingStore.storeName})`
                    : `${deletingVendor.id} (${deletingVendor.vendorName})`}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              {deletingStore
                ? 'Removing this retail outlet removes it from the demo store directory in LocalStorage.'
                : 'Removing this vendor deletes its supplier catalog entry from LocalStorage.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingStore(null)
                  setDeletingVendor(null)
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deletingStore ? handleConfirmDeleteStore : handleConfirmDeleteVendor}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Admin Console</span>
              <ChevronRight size={12} />
              <span>Territorial Distribution &amp; Logistics</span>
              <ChevronRight size={12} />
              <span className="font-bold text-navy">Retail Stores &amp; Hardware Vendors</span>
            </div>
            <h1 className="mt-1.5 text-xl font-extrabold text-navy md:text-2xl">
              Retail Store Network, Regional City Codes &amp; Hardware Vendors
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {prefixes.length}_METRO_HUBS_DEMO
              </span>
              <span className="text-slate-500">Account ID Format: <strong>B/D/T + Metro Code + 12 Digits</strong></span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-500">
                Vendors: <strong className="font-mono text-indigo-600">{approvedVendorsCount} Approved Partners</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateStoreModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Store</span>
            </button>
            <button
              type="button"
              onClick={openCreateVendorModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Vendor</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Metro City Codes</span>
            <div className="mt-1 text-2xl font-black text-navy">{prefixes.length} Core Hubs</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>101 HN, 201 HCM, 301 DN</span>
              <span className="font-bold text-indigo-600">Regional</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Retail Stores</span>
            <div className="mt-1 text-2xl font-black text-indigo-600">{stores.length} Outlets</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>{activeStoresCount} Active counters</span>
              <span className="font-bold text-sky-700">Local CRUD</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Hardware Vendors</span>
            <div className="mt-1 text-2xl font-black text-navy">{vendors.length} Partners</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>{approvedVendorsCount} Approved</span>
              <span className="font-bold text-emerald-600">Demo Catalog</span>
            </div>
          </div>
          <div className="rounded-2xl p-4 bg-navy text-white shadow-lg shadow-navy/20 border-none space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">Account ID Preview</span>
            <div className="font-mono text-sm font-black text-emerald-300 truncate">{simulatedAccountId}</div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-white/10 text-[10px]">
              <select
                value={testPrefixType}
                onChange={(e) => setTestPrefixType(e.target.value)}
                className="rounded bg-white/10 px-1.5 py-0.5 text-white font-mono outline-none"
                aria-label="Service prefix"
              >
                <option value="B" className="text-slate-900">B</option>
                <option value="D" className="text-slate-900">D</option>
                <option value="T" className="text-slate-900">T</option>
              </select>
              <select
                value={testCityCode}
                onChange={(e) => setTestCityCode(e.target.value)}
                className="rounded bg-white/10 px-1.5 py-0.5 text-white font-mono outline-none"
                aria-label="Metro city code"
              >
                {prefixes.map((p) => (
                  <option key={p.cityCode} value={p.cityCode} className="text-slate-900">
                    {p.cityCode}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={testSerial}
                onChange={(e) => setTestSerial(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 rounded bg-white/10 px-1.5 py-0.5 text-white font-mono outline-none"
                aria-label="Serial number"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 p-4 gap-3 bg-slate-50/50">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'STORES', label: `Retail Stores (${stores.length})` },
                { id: 'VENDORS', label: `Hardware Vendors (${vendors.length})` },
                { id: 'PREFIXES', label: `Metro Prefixes (${prefixes.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id)
                    setSearchQuery('')
                  }}
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

            {activeTab === 'STORES' && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedCityFilter}
                  onChange={(e) => setSelectedCityFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Cities</option>
                  {prefixes.map((p) => (
                    <option key={p.cityCode} value={p.cityCode}>
                      {p.cityName} ({p.cityCode})
                    </option>
                  ))}
                </select>
                <select
                  value={storeStatusFilter}
                  onChange={(e) => setStoreStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
                <div className="relative w-48 sm:w-60">
                  <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search stores, managers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            {activeTab === 'VENDORS' && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={vendorStatusFilter}
                  onChange={(e) => setVendorStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="PROBATION">PROBATION</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
                <div className="relative w-48 sm:w-60">
                  <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search vendors, models..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'STORES' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                    <th className="py-3 px-4">Store Code &amp; Name</th>
                    <th className="py-3 px-4">Metro Hub</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">Manager &amp; Phone</th>
                    <th className="py-3 px-4">Staff &amp; CPE</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {filteredStores.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-xs text-slate-400">
                        No retail stores match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStores.map((s) => (
                      <tr key={s.storeCode} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{s.storeName}</div>
                          <div className="font-mono text-[10px] text-indigo-600">
                            {s.storeCode} &bull; {s.type} (Ctr {s.counterNumber})
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-700">
                            {s.cityCode} &bull; {s.cityName}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">{s.address}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{s.managerName}</div>
                          <div className="text-[11px] text-slate-400">{s.phone}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{s.staffCount} Agents</div>
                          <div className="text-[10px] text-slate-400">
                            CPE {s.cpeStock}/{s.cpeCapacity}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                              s.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : s.status === 'MAINTENANCE'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditStoreModal(s)}
                            className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickToggleStoreStatus(s)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          >
                            {s.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingStore(s)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'VENDORS' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                    <th className="py-3 px-4">Vendor Partner</th>
                    <th className="py-3 px-4">Flagship Product &amp; Standard</th>
                    <th className="py-3 px-4">Unit Cost &amp; Supply</th>
                    <th className="py-3 px-4">Defect Rate &amp; Warranty</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {filteredVendors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 px-4 text-center text-xs text-slate-400">
                        No hardware vendors match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredVendors.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{v.vendorName}</div>
                          <div className="font-mono text-[10px] text-indigo-600">{v.id}</div>
                          <div className="text-[11px] text-slate-400">{v.headquarters}</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-slate-800">{v.flagshipProduct}</div>
                          <div className="text-[11px] text-indigo-600 font-semibold">{v.standard}</div>
                          <div className="text-[10px] text-slate-400 truncate">{v.specs}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">
                            ${Number(v.unitCostUSD || 0).toFixed(2)} / unit
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {Number(v.availableStock || 0).toLocaleString()} stock &bull; {Number(v.monthlySupply || 0).toLocaleString()}/mo
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-emerald-700">{v.defectRate} defect</div>
                          <div className="text-[11px] text-slate-500">{v.warranty}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                              v.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : v.status === 'PROBATION'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditVendorModal(v)}
                            className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickToggleVendorStatus(v)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          >
                            {v.status === 'APPROVED' ? 'Suspend' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingVendor(v)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'PREFIXES' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                    <th className="py-3 px-4">Metro Code</th>
                    <th className="py-3 px-4">Region / City Name</th>
                    <th className="py-3 px-4">NOC Backbone Hub</th>
                    <th className="py-3 px-4">Active Subscribers</th>
                    <th className="py-3 px-4">Retail Outlets</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {prefixes.map((p) => {
                    const directoryCount = stores.filter((s) => s.cityCode === p.cityCode).length
                    return (
                      <tr key={p.cityCode} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-mono text-sm font-bold text-indigo-600">{p.cityCode}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{p.cityName}</div>
                          <div className="text-[11px] text-slate-400">{p.region}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">{p.nocHub}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          {Number(p.activeSubscribers || 0).toLocaleString()} Subscribers
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {directoryCount} listed ({p.storeCount} regional target)
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
