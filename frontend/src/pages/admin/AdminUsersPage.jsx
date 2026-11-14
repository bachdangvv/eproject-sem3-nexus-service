import { useState, useEffect, useMemo } from 'react'
import {
  Search,
  Plus,
  Edit3,
  Lock,
  Unlock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  X,
} from 'lucide-react'
import AdminLayout from '../../components/layout/AdminLayout'
import { useToast } from '../../hooks/useToast'
import {
  fetchEmployees,
  unlockEmployee,
  addEmployee,
  updateEmployee,
  toggleEmployeeStatus,
  resetEmployeePassword,
} from '../../services/adminUserService'
import { fetchRetailStores } from '../../services/vendorShopService'
import { REVIEW1_API_MODE, fetchEmployeesApi, createEmployeeApi } from '../../services/review1Api'

const DEFAULT_HUB_OPTIONS = [
  { id: 'STORE-HN-001', label: 'Cau Giay Flagship Store (HN)', name: 'Hanoi Cau Giay Flagship Store' },
  { id: 'STORE-SG-001', label: 'District 1 Business Store (SG)', name: 'Saigon District 1 Business Store' },
  { id: 'HUB-NOC-HN', label: 'Hanoi Metro ODN Hub', name: 'Hanoi Metro ODN Operations' },
  { id: 'HUB-NOC-SG', label: 'Saigon Metro ODN Hub', name: 'Ho Chi Minh Metro ODN Operations' },
  { id: 'HUB-FIN-HN', label: 'Hanoi Central Revenue Center', name: 'Hanoi Central Revenue Center' },
  { id: 'CORE-NOC-ALL', label: 'National NOC Core (Global)', name: 'National NOC Core Infrastructure' },
]

const EMPTY_FORM = {
  fullName: '',
  email: '',
  title: '',
  role: 'RETAIL',
  hubId: 'STORE-HN-001',
  hubName: 'Hanoi Cau Giay Flagship Store',
  twoFactorEnabled: false,
  status: 'ACTIVE',
}

export default function AdminUsersPage() {
  const [employees, setEmployees] = useState([])
  const [retailStores, setRetailStores] = useState([])
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [modalMode, setModalMode] = useState(null)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [tempPassAlert, setTempPassAlert] = useState(null)
  const { toast, showToast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setEmployees(REVIEW1_API_MODE ? await fetchEmployeesApi() : fetchEmployees())
    setRetailStores(fetchRetailStores())
  }

  const hubOptions = useMemo(() => {
    const map = new Map()
    DEFAULT_HUB_OPTIONS.forEach((h) => map.set(h.id, h))
    retailStores.forEach((s) => {
      if (!s.storeCode || map.has(s.storeCode)) return
      map.set(s.storeCode, {
        id: s.storeCode,
        label: `${s.storeName} (${s.cityCode})`,
        name: s.storeName,
      })
    })
    if (editingEmployee?.hubId && !map.has(editingEmployee.hubId)) {
      map.set(editingEmployee.hubId, {
        id: editingEmployee.hubId,
        label: `${editingEmployee.hubName || editingEmployee.hubId} (${editingEmployee.hubId})`,
        name: editingEmployee.hubName || editingEmployee.hubId,
      })
    }
    return Array.from(map.values())
  }, [retailStores, editingEmployee])

  function resolveHubName(hubId) {
    const found = hubOptions.find((h) => h.id === hubId)
    return found ? found.name : hubId
  }

  function openCreateModal() {
    setRetailStores(fetchRetailStores())
    setModalMode('create')
    setEditingEmployee(null)
    setFormData(EMPTY_FORM)
    setFormError('')
  }

  function openEditModal(emp) {
    setRetailStores(fetchRetailStores())
    setModalMode('edit')
    setEditingEmployee(emp)
    setFormData({
      fullName: emp.fullName || '',
      email: emp.email || '',
      title: emp.title || '',
      role: emp.role || 'RETAIL',
      hubId: emp.hubId || 'STORE-HN-001',
      hubName: emp.hubName || resolveHubName(emp.hubId),
      twoFactorEnabled: Boolean(emp.twoFactorEnabled),
      status: emp.status || 'ACTIVE',
    })
    setFormError('')
  }

  function closeModal() {
    setModalMode(null)
    setEditingEmployee(null)
    setFormError('')
  }

  function handleUnlock(id, name) {
    if (REVIEW1_API_MODE) {
      showToast('Employee lock/unlock management is not part of the current Review 1 API.', 'error')
      return
    }
    const updated = unlockEmployee(id)
    setEmployees(updated)
    showToast(`Access credentials unlocked for ${name}. Failed counter reset to 0.`)
  }

  function handleToggleStatus(id, name) {
    if (REVIEW1_API_MODE) {
      showToast('Employee status management is not part of the current Review 1 API.', 'error')
      return
    }
    const updated = toggleEmployeeStatus(id)
    setEmployees(updated)
    showToast(`Operational account status toggled for ${name}.`)
  }

  function handleResetPassword(id, name) {
    if (REVIEW1_API_MODE) {
      showToast('Password reset is not part of the current Review 1 API.', 'error')
      return
    }
    const { employees: updated, tempPass } = resetEmployeePassword(id)
    setEmployees(updated)
    setTempPassAlert({ name, tempPass })
  }

  async function handleSaveEmployee(e) {
    e.preventDefault()
    setFormError('')
    const resolvedHubName = resolveHubName(formData.hubId)

    try {
      if (REVIEW1_API_MODE) {
        if (modalMode !== 'create') {
          throw new Error('Editing existing employee profiles is not part of the current Review 1 API.')
        }
        const created = await createEmployeeApi({
          ...formData,
          username: formData.email,
          displayName: formData.fullName,
        })
        setEmployees((current) => [created, ...current])
        closeModal()
        showToast(`Employee account "${created.fullName}" created in backend.`)
        return
      }
      if (modalMode === 'create') {
        const updated = addEmployee({
          ...formData,
          hubName: resolvedHubName,
        })
        setEmployees(updated)
        closeModal()
        showToast(`Employee account "${formData.fullName.trim()}" created successfully.`)
      } else if (modalMode === 'edit' && editingEmployee) {
        const { employee: savedEmp, employees: updatedList } = updateEmployee(
          editingEmployee.id,
          {
            fullName: formData.fullName,
            email: formData.email,
            title: formData.title,
            role: formData.role,
            hubId: formData.hubId,
            hubName: resolvedHubName,
            twoFactorEnabled: formData.twoFactorEnabled,
            status: formData.status,
          }
        )
        setEmployees(updatedList)
        closeModal()
        showToast(`Updated profile for ${savedEmp.fullName} (${savedEmp.id}).`)
      }
    } catch (err) {
      setFormError(err.message || 'Unable to save operator record.')
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    const matchRole = roleFilter === 'ALL' || emp.role === roleFilter
    const q = searchQuery.toLowerCase().trim()
    const matchSearch =
      !q ||
      (emp.fullName || '').toLowerCase().includes(q) ||
      (emp.email || '').toLowerCase().includes(q) ||
      (emp.id || '').toLowerCase().includes(q) ||
      (emp.hubName || '').toLowerCase().includes(q) ||
      (emp.title || '').toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  const totalPersonnel = employees.length
  const lockedCount = employees.filter((e) => e.status === 'LOCKED').length
  const adminCount = employees.filter((e) => e.role === 'ADMIN').length
  const accountsCount = employees.filter((e) => e.role === 'ACCOUNTS').length
  const technicalCount = employees.filter((e) => e.role === 'TECHNICAL').length
  const retailCount = employees.filter((e) => e.role === 'RETAIL').length

  return (
    <AdminLayout activeNavId="users" toast={toast}>
      {tempPassAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 border border-amber-200">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">One-Time Security Credential (Demo)</h3>
                <p className="text-xs text-slate-500">Generated for {tempPassAlert.name}</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-center">
              <span className="text-xs text-slate-500 block uppercase font-semibold mb-1">Temporary Password</span>
              <span className="font-mono text-lg font-bold text-indigo-600 tracking-wider">
                {tempPassAlert.tempPass}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              Use this temporary demo password to sign in as {tempPassAlert.name}.
            </p>
            <button
              type="button"
              onClick={() => setTempPassAlert(null)}
              className="w-full rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Acknowledge &amp; Close
            </button>
          </div>
        </div>
      )}

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  {modalMode === 'edit' ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {modalMode === 'edit'
                      ? `Edit Operator Profile (${editingEmployee?.id})`
                      : 'Provision Operator Account'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {modalMode === 'edit'
                      ? 'Update operator identity, role permissions, location hub, and 2FA policy'
                      : 'Create new carrier personnel profile with RBAC boundaries'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close operator modal"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Tran Minh Tuan"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Corporate Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="tuan.tm@nexus.vn"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Optical Fiber Field Service Technician"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  >
                    <option value="RETAIL">RETAIL &bull; Counter Sales &amp; Orders</option>
                    <option value="TECHNICAL">TECHNICAL &bull; ODN &amp; Provisioning</option>
                    <option value="ACCOUNTS">ACCOUNTS &bull; Billing &amp; Tax Audit</option>
                    <option value="ADMIN">ADMIN &bull; Security &amp; Tariffs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Hub / Shop</label>
                  <select
                    value={formData.hubId}
                    onChange={(e) => {
                      const nextId = e.target.value
                      setFormData({
                        ...formData,
                        hubId: nextId,
                        hubName: resolveHubName(nextId),
                      })
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                  >
                    {hubOptions.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {modalMode === 'edit' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Account Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                    >
                      <option value="ACTIVE">ACTIVE &bull; Normal Access</option>
                      <option value="SUSPENDED">SUSPENDED &bull; Disabled</option>
                      <option value="LOCKED">LOCKED &bull; Security Hold</option>
                    </select>
                  </div>
                )}

                <label
                  className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer ${
                    modalMode === 'edit' ? 'mt-4 sm:mt-5' : 'sm:col-span-2'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.twoFactorEnabled}
                    onChange={(e) =>
                      setFormData({ ...formData, twoFactorEnabled: e.target.checked })
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <ShieldCheck size={14} className="text-indigo-600 shrink-0" />
                  <span>Require 2FA Policy (Demo Flag)</span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
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
                  {modalMode === 'edit' ? 'Save Changes' : 'Create Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card p-5 md:p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span>Carrier Administration</span>
              <span>/</span>
              <span className="font-semibold text-slate-700">Access Governance</span>
              <span>/</span>
              <span className="font-mono text-brand-soft">RBAC &amp; Security</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-navy">
                Personnel Directory &amp; Security Credentials
              </h1>
              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-soft">
                4 STAFF ROLES + PORTAL
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Manage staff profiles, role assignments, hub placement, and credential lockout recovery (Demo State)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-md shadow-navy/20 transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Personnel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Staff</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900">{totalPersonnel}</span>
              <span className="text-[10px] font-bold text-slate-400">Operators</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Administrators</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-indigo-600">{adminCount}</span>
              <span className="text-[10px] font-bold text-indigo-500">Full Access</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Accounts Lead</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-cyan-600">{accountsCount}</span>
              <span className="text-[10px] font-bold text-cyan-500">Billing/Tax</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Technical / NOC</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-600">{technicalCount}</span>
              <span className="text-[10px] font-bold text-emerald-500">ODN Fiber</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Retail Outlets</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-blue-600">{retailCount}</span>
              <span className="text-[10px] font-bold text-blue-500">Sales Hubs</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Security Lockouts</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-rose-600">{lockedCount}</span>
              <span className={`text-[10px] font-bold ${lockedCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                {lockedCount > 0 ? 'Action Req.' : 'Nominal'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 p-4 gap-3 bg-slate-50/50">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: 'All Operators' },
                { id: 'ADMIN', label: 'Administrators' },
                { id: 'ACCOUNTS', label: 'Accounts & Billing' },
                { id: 'TECHNICAL', label: 'Technical NOC' },
                { id: 'RETAIL', label: 'Retail Outlets' },
              ].map((rf) => (
                <button
                  key={rf.id}
                  type="button"
                  onClick={() => setRoleFilter(rf.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    roleFilter === rf.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-56 sm:w-64">
                <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, email, ID, hub..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs font-medium text-slate-700 outline-none focus:border-indigo-600"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Showing <strong className="text-slate-800">{filteredEmployees.length}</strong> of {employees.length} personnel
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50">
                  <th className="py-3 px-4">Operator ID</th>
                  <th className="py-3 px-4">Full Name &amp; Title</th>
                  <th className="py-3 px-4">Role Access</th>
                  <th className="py-3 px-4">Assigned Location</th>
                  <th className="py-3 px-4">Security Status</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-xs text-slate-400">
                      No personnel match the active filter or search query.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{emp.id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{emp.fullName}</div>
                        <div className="text-[11px] text-slate-400">{emp.email} &bull; {emp.title}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                            emp.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : emp.role === 'ACCOUNTS'
                              ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                              : emp.role === 'TECHNICAL'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {emp.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{emp.hubName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{emp.hubId}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {emp.status === 'LOCKED' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                              <Lock size={11} /> Locked ({emp.failedAttempts || 5} Failed)
                            </span>
                          ) : emp.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={11} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                              Suspended
                            </span>
                          )}
                          {emp.twoFactorEnabled && (
                            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                              2FA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-700">{emp.lastLoginAt}</div>
                        <div className="font-mono text-[10px] text-slate-400">IP: {emp.lastLoginIp}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditModal(emp)}
                          className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Edit3 size={11} /> Edit
                        </button>
                        {emp.status === 'LOCKED' ? (
                          <button
                            type="button"
                            onClick={() => handleUnlock(emp.id, emp.fullName)}
                            className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            <Unlock size={11} /> Unlock
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(emp.id, emp.fullName)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          >
                            {emp.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleResetPassword(emp.id, emp.fullName)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                          Reset PW
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
