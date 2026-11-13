import { useState, useMemo } from 'react'
import {
  Users,
  Search,
  Plus,
  Edit3,
  Trash2,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Ban,
  AlertTriangle,
  X,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import AsyncStatePanel from '../../components/common/AsyncStatePanel'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { useToast } from '../../hooks/useToast'
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../../services/customerService'

const EMPTY_FORM = {
  customerName: '',
  taxId: '',
  customerType: 'Corporate',
  contactPerson: '',
  phone: '',
  email: '',
  branchCode: '101',
  address: '',
  status: 'ACTIVE',
}

export default function AdminCustomersPage() {
  const {
    data: customersData,
    setData: setCustomers,
    isLoading,
    error,
    reload: reloadCustomers,
  } = useAsyncResource(() => Promise.resolve(fetchCustomers()), [])
  const customers = customersData || []

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [modalMode, setModalMode] = useState(null)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [deletingCustomer, setDeletingCustomer] = useState(null)
  const { toast, showToast } = useToast()

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return customers.filter((c) => {
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter
      const matchesBranch = branchFilter === 'ALL' || c.branchCode === branchFilter
      const matchesQuery =
        !query ||
        (c.id || '').toLowerCase().includes(query) ||
        (c.customerName || '').toLowerCase().includes(query) ||
        (c.taxId || '').toLowerCase().includes(query) ||
        (c.contactPerson || '').toLowerCase().includes(query) ||
        (c.email || '').toLowerCase().includes(query) ||
        (c.phone || '').toLowerCase().includes(query)
      return matchesStatus && matchesBranch && matchesQuery
    })
  }, [customers, searchQuery, statusFilter, branchFilter])

  const stats = useMemo(() => {
    const total = customers.length
    const active = customers.filter((c) => c.status === 'ACTIVE').length
    const suspended = customers.filter((c) => c.status !== 'ACTIVE').length
    const corporate = customers.filter((c) => c.customerType === 'Corporate').length
    return { total, active, suspended, corporate }
  }, [customers])

  function openCreateModal() {
    setModalMode('create')
    setEditingCustomer(null)
    setFormData(EMPTY_FORM)
    setFormError('')
  }

  function openEditModal(customer) {
    setModalMode('edit')
    setEditingCustomer(customer)
    setFormData({
      customerName: customer.customerName || '',
      taxId: customer.taxId || '',
      customerType: customer.customerType || 'Corporate',
      contactPerson: customer.contactPerson || '',
      phone: customer.phone || '',
      email: customer.email || '',
      branchCode: customer.branchCode || '101',
      address: customer.address || '',
      status: customer.status || 'ACTIVE',
    })
    setFormError('')
  }

  function closeModal() {
    setModalMode(null)
    setEditingCustomer(null)
    setFormError('')
  }

  function handleSaveCustomer(e) {
    e.preventDefault()
    setFormError('')
    try {
      if (modalMode === 'create') {
        const created = createCustomer(formData)
        setCustomers((prev) => [created, ...(prev || [])])
        showToast(`Customer "${created.customerName}" (${created.id}) created.`)
      } else if (modalMode === 'edit' && editingCustomer) {
        const updated = updateCustomer(editingCustomer.id, formData)
        setCustomers((prev) => (prev || []).map((c) => (c.id === updated.id ? updated : c)))
        showToast(`Updated customer record ${updated.id}.`)
      }
      closeModal()
    } catch (err) {
      setFormError(err.message || 'Unable to save customer record.')
    }
  }

  function handleToggleStatus(customer) {
    const nextStatus = customer.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    try {
      const updated = updateCustomer(customer.id, { status: nextStatus })
      setCustomers((prev) => (prev || []).map((c) => (c.id === updated.id ? updated : c)))
      showToast(`Customer ${updated.id} status changed to ${nextStatus}.`)
    } catch (err) {
      showToast(err.message || 'Failed to update status.', 'error')
    }
  }

  function handleConfirmDelete() {
    if (!deletingCustomer) return
    try {
      const nextList = deleteCustomer(deletingCustomer.id)
      setCustomers(nextList)
      showToast(`Deleted customer ${deletingCustomer.id} (${deletingCustomer.customerName}).`)
      setDeletingCustomer(null)
    } catch (err) {
      showToast(err.message || 'Failed to delete customer.', 'error')
    }
  }

  return (
    <AdminLayout activeNavId="customers" toast={toast}>
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {modalMode === 'create' ? 'Register New Customer' : `Edit Customer ${editingCustomer?.id}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manage corporate &amp; SME subscriber identity details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Legal Company / Subscriber Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="e.g. Saigon Fintech Services JSC"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tax ID / MST <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    placeholder="e.g. 0301234567"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subscriber Tier</label>
                  <select
                    value={formData.customerType}
                    onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  >
                    <option value="Corporate">Corporate</option>
                    <option value="SME">SME</option>
                    <option value="Government">Government / Public</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Authorized Contact <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="e.g. Nguyen Minh Quan"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +84 908 112 334"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Billing Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="billing@company.vn"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Metro Region</label>
                  <select
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  >
                    <option value="101">101 - Hanoi Metro (HN)</option>
                    <option value="201">201 - Ho Chi Minh City (HCMC)</option>
                    <option value="301">301 - Da Nang (DN)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registered Premise Address <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street, Building, District, City"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>

                {modalMode === 'edit' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Account Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
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
                  {modalMode === 'create' ? 'Create Customer' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600 border border-rose-200">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Customer Record</h3>
                <p className="text-xs text-slate-500">Customer ID: {deletingCustomer.id}</p>
              </div>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3 text-xs text-rose-900 space-y-1">
              <div className="font-bold">{deletingCustomer.customerName}</div>
              <div className="font-mono text-[11px] text-rose-700">Tax ID: {deletingCustomer.taxId}</div>
            </div>
            <p className="text-xs text-slate-600">
              Confirm permanent removal of this customer directory entry? Existing orders keep their archived snapshot.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer"
              >
                Delete Customer
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
              <span className="font-semibold text-slate-700">Subscriber Registry</span>
              <span>/</span>
              <span className="font-mono text-brand-soft">Customer Master CRUD</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-navy">
                Enterprise Customer Directory
              </h1>
              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-soft">
                {stats.total} ACCOUNTS
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Centralized subscriber profiles, tax identifiers, metro assignments, and account status governance
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-md shadow-navy/20 transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Customer</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Customers
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-slate-900">{stats.total}</span>
              <span className="text-[11px] font-semibold text-slate-400">registered</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Active Subscribers
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-emerald-700">{stats.active}</span>
              <span className="text-[11px] font-semibold text-emerald-600">good standing</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Suspended / Hold
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-rose-700">{stats.suspended}</span>
              <span className="text-[11px] font-semibold text-rose-500">restricted</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Corporate Accounts
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-indigo-700">{stats.corporate}</span>
              <span className="text-[11px] font-semibold text-indigo-500">enterprise B2B</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Customer ID, Name, Tax ID, Contact, Email..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-8 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Metro Regions</option>
            <option value="101">Hanoi Metro (101)</option>
            <option value="201">Ho Chi Minh City (201)</option>
            <option value="301">Da Nang (301)</option>
          </select>
        </div>

        {isLoading ? (
          <AsyncStatePanel
            state="loading"
            title="Loading Customer Directory..."
            description="Retrieving subscriber master records and regional account assignments."
          />
        ) : error ? (
          <AsyncStatePanel
            state="error"
            title="Failed to Load Customer Directory"
            description={error}
            actionLabel="Retry"
            onAction={reloadCustomers}
          />
        ) : customers.length === 0 ? (
          <AsyncStatePanel
            state="empty"
            icon={Users}
            title="No customers registered yet"
            description="Create a customer profile to manage enterprise subscriber records."
            actionLabel="Add First Customer"
            onAction={openCreateModal}
          />
        ) : filteredCustomers.length === 0 ? (
          <AsyncStatePanel
            state="empty"
            icon={Search}
            title="No matching customers"
            description="No customer record matches your search or filter criteria."
            actionLabel="Reset Filters"
            onAction={() => {
              setSearchQuery('')
              setStatusFilter('ALL')
              setBranchFilter('ALL')
            }}
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-100 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Customer ID</th>
                  <th className="px-4 py-3">Legal Subscriber &amp; Tax ID</th>
                  <th className="px-4 py-3">Contact &amp; Email</th>
                  <th className="px-4 py-3">Metro Region &amp; Address</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-indigo-700">{customer.id}</span>
                      <div className="text-[10px] text-slate-400 font-mono">{customer.createdAt}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{customer.customerName}</span>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                          {customer.customerType}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                        MST: {customer.taxId}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{customer.contactPerson}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                        <Phone size={11} className="text-slate-400" />
                        <span>{customer.phone}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Mail size={11} className="text-slate-400" />
                        <span>{customer.email}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 max-w-[260px]">
                      <div className="font-semibold text-slate-800">
                        {customer.branchName}{' '}
                        <span className="font-mono text-[10px] text-slate-400">({customer.branchCode})</span>
                      </div>
                      <div className="mt-0.5 flex items-start gap-1 text-[11px] text-slate-500">
                        <MapPin size={11} className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="line-clamp-2">{customer.address}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {customer.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} /> ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                          <Ban size={11} /> SUSPENDED
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(customer)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition cursor-pointer"
                          title="Edit Customer"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(customer)}
                          className={`rounded-lg px-2 py-1 text-[10px] font-bold border transition cursor-pointer ${
                            customer.status === 'ACTIVE'
                              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          title={customer.status === 'ACTIVE' ? 'Suspend Customer' : 'Reactivate Customer'}
                        >
                          {customer.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCustomer(customer)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                          title="Delete Customer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

