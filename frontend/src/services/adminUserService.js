const STORAGE_KEY = 'nexus_admin_employees_v1'

export const INITIAL_EMPLOYEES = [
  {
    id: 'EMP-NX-001',
    fullName: 'Le Quoc Bao',
    title: 'Senior Telecom Architect & Security Lead',
    email: 'admin@nexus.vn',
    role: 'ADMIN',
    hubId: 'CORE-NOC-ALL',
    hubName: 'National NOC Core Infrastructure',
    status: 'ACTIVE',
    failedAttempts: 0,
    twoFactorEnabled: true,
    lastLoginAt: '2026-04-06 09:12:44',
    lastLoginIp: '118.70.1.10',
    joinedDate: '2024-01-15',
  },
  {
    id: 'EMP-NX-002',
    fullName: 'Nguyen Tien Dung',
    title: 'Senior Systems Administrator',
    email: 'admin.sys@nexus.vn',
    role: 'ADMIN',
    hubId: 'CORE-NOC-ALL',
    hubName: 'National NOC Core Infrastructure',
    status: 'ACTIVE',
    failedAttempts: 0,
    twoFactorEnabled: true,
    lastLoginAt: '2026-04-05 18:30:11',
    lastLoginIp: '118.70.1.14',
    joinedDate: '2024-03-20',
  },
  {
    id: 'EMP-NX-003',
    fullName: 'Tran Thu Ha',
    title: 'Billing & Financial Operations Lead',
    email: 'billing.officer@nexus.vn',
    role: 'ACCOUNTS',
    hubId: 'HUB-FIN-HN',
    hubName: 'Hanoi Central Revenue Center',
    status: 'ACTIVE',
    failedAttempts: 0,
    twoFactorEnabled: true,
    lastLoginAt: '2026-04-06 08:45:02',
    lastLoginIp: '118.70.12.88',
    joinedDate: '2024-06-01',
  },
  {
    id: 'EMP-NX-004',
    fullName: 'Vuong Thi Thao',
    title: 'Corporate Tax & Audit Accountant',
    email: 'thao.vt@nexus.vn',
    role: 'ACCOUNTS',
    hubId: 'HUB-FIN-HN',
    hubName: 'Hanoi Central Revenue Center',
    status: 'ACTIVE',
    failedAttempts: 0,
    twoFactorEnabled: false,
    lastLoginAt: '2026-04-05 17:15:39',
    lastLoginIp: '118.70.12.92',
    joinedDate: '2025-02-10',
  },
  {
    id: 'EMP-NX-005',
    fullName: 'Do Manh Cuong',
    title: 'Optical Fiber NOC Specialist',
    email: 'noc.engineer@nexus.vn',
    role: 'TECHNICAL',
    hubId: 'HUB-NOC-HN',
    hubName: 'Hanoi Metro ODN Operations',
    status: 'ACTIVE',
    failedAttempts: 0,
    twoFactorEnabled: true,
    lastLoginAt: '2026-04-06 07:30:20',
    lastLoginIp: '118.70.45.19',
    joinedDate: '2024-09-15',
  },
  {
    id: 'EMP-NX-006',
    fullName: 'Le Hoang Long',
    title: 'Metro ODN Field Service Engineer',
    email: 'long.lh@nexus.vn',
    role: 'TECHNICAL',
    hubId: 'HUB-NOC-SG',
    hubName: 'Ho Chi Minh Metro ODN Operations',
    status: 'ACTIVE',
    failedAttempts: 0,
    twoFactorEnabled: false,
    lastLoginAt: '2026-04-04 16:00:15',
    lastLoginIp: '118.70.98.55',
    joinedDate: '2025-01-08',
  },
  {
    id: 'EMP-NX-007',
    fullName: 'Pham Minh Tuan',
    title: 'Retail Branch Sales Supervisor',
    email: 'retail.hn01@nexus.vn',
    role: 'RETAIL',
    hubId: 'STORE-HN-001',
    hubName: 'Hanoi Cau Giay Flagship Store',
    status: 'ACTIVE',
    failedAttempts: 0,
    twoFactorEnabled: false,
    lastLoginAt: '2026-04-06 10:05:40',
    lastLoginIp: '118.70.110.2',
    joinedDate: '2025-05-12',
  },
  {
    id: 'EMP-NX-008',
    fullName: 'Nguyen Thi Huong',
    title: 'Customer Service Representative',
    email: 'retail.sg01@nexus.vn',
    role: 'RETAIL',
    hubId: 'STORE-SG-001',
    hubName: 'Saigon District 1 Business Store',
    status: 'LOCKED',
    failedAttempts: 5,
    twoFactorEnabled: false,
    lastLoginAt: '2026-04-03 11:20:00',
    lastLoginIp: '118.70.210.4',
    joinedDate: '2025-08-01',
  },
]

export const VALID_EMPLOYEE_ROLES = ['ADMIN', 'ACCOUNTS', 'TECHNICAL', 'RETAIL']
export const VALID_EMPLOYEE_STATUSES = ['ACTIVE', 'SUSPENDED', 'LOCKED']

function getNextEmployeeId(employees) {
  const maxNum = employees.reduce((max, emp) => {
    const match = String(emp?.id || '').match(/(\d+)$/)
    const num = match ? Number(match[1]) : 0
    return Number.isFinite(num) && num > max ? num : max
  }, 0)
  return `EMP-NX-${String(Math.max(employees.length, maxNum) + 1).padStart(3, '0')}`
}

export function fetchEmployees() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
  }
  saveEmployees(INITIAL_EMPLOYEES)
  return INITIAL_EMPLOYEES
}

export function saveEmployees(employees) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employees))
  } catch {
  }
}

export function unlockEmployee(id) {
  const employees = fetchEmployees()
  const updated = employees.map((emp) => {
    if (emp.id === id) {
      return {
        ...emp,
        status: 'ACTIVE',
        failedAttempts: 0,
      }
    }
    return emp
  })
  saveEmployees(updated)
  return updated
}

export function addEmployee(newEmp = {}) {
  const employees = fetchEmployees()
  const fullName = String(newEmp.fullName || '').trim()
  const email = String(newEmp.email || '').trim().toLowerCase()
  const title = String(newEmp.title || '').trim()
  const role = String(newEmp.role || 'RETAIL').trim().toUpperCase()

  if (!fullName || !email) {
    throw new Error('Full name and corporate email are required.')
  }
  if (!title) {
    throw new Error('Job title is required.')
  }
  if (!VALID_EMPLOYEE_ROLES.includes(role)) {
    throw new Error(`Invalid employee role: ${role}`)
  }
  if (employees.some((emp) => String(emp.email || '').trim().toLowerCase() === email)) {
    throw new Error(`An operator with email ${email} already exists.`)
  }

  const created = {
    ...newEmp,
    fullName,
    email,
    title,
    role,
    hubId: String(newEmp.hubId || 'STORE-HN-001').trim(),
    hubName: String(newEmp.hubName || newEmp.hubId || 'Hanoi Cau Giay Flagship Store').trim(),
    twoFactorEnabled: Boolean(newEmp.twoFactorEnabled),
    id: getNextEmployeeId(employees),
    status: 'ACTIVE',
    failedAttempts: 0,
    lastLoginAt: 'Never',
    lastLoginIp: 'N/A',
    joinedDate: new Date().toISOString().split('T')[0],
  }
  const updated = [created, ...employees]
  saveEmployees(updated)
  return updated
}

export function updateEmployee(id, updates = {}) {
  const employees = fetchEmployees()
  const targetIndex = employees.findIndex((emp) => emp.id === id)
  if (targetIndex === -1) {
    throw new Error(`Operator ${id} was not found.`)
  }

  const existing = employees[targetIndex]
  const fullName =
    updates.fullName !== undefined ? String(updates.fullName).trim() : String(existing.fullName || '').trim()
  const email =
    updates.email !== undefined
      ? String(updates.email).trim().toLowerCase()
      : String(existing.email || '').trim().toLowerCase()
  const title =
    updates.title !== undefined ? String(updates.title).trim() : String(existing.title || '').trim()
  const role =
    updates.role !== undefined
      ? String(updates.role).trim().toUpperCase()
      : String(existing.role || 'RETAIL').trim().toUpperCase()
  const status =
    updates.status !== undefined
      ? String(updates.status).trim().toUpperCase()
      : String(existing.status || 'ACTIVE').trim().toUpperCase()
  const hubId =
    updates.hubId !== undefined ? String(updates.hubId).trim() : String(existing.hubId || '').trim()
  const hubName =
    updates.hubName !== undefined
      ? String(updates.hubName).trim()
      : String(existing.hubName || hubId).trim()

  if (!fullName || !email) {
    throw new Error('Full name and corporate email are required.')
  }
  if (!title) {
    throw new Error('Job title is required.')
  }
  if (!VALID_EMPLOYEE_ROLES.includes(role)) {
    throw new Error(`Invalid employee role: ${role}`)
  }
  if (!VALID_EMPLOYEE_STATUSES.includes(status)) {
    throw new Error(`Invalid employee status: ${status}`)
  }
  if (
    employees.some(
      (emp) => emp.id !== id && String(emp.email || '').trim().toLowerCase() === email
    )
  ) {
    throw new Error(`Another operator already uses email ${email}.`)
  }

  const updatedEmployee = {
    ...existing,
    fullName,
    email,
    title,
    role,
    hubId,
    hubName: hubName || hubId,
    status,
    failedAttempts: status === 'ACTIVE' ? 0 : existing.failedAttempts || 0,
    twoFactorEnabled:
      updates.twoFactorEnabled !== undefined
        ? Boolean(updates.twoFactorEnabled)
        : Boolean(existing.twoFactorEnabled),
    updatedAt: new Date().toISOString().split('T')[0],
  }

  const updatedList = employees.map((emp) => (emp.id === id ? updatedEmployee : emp))
  saveEmployees(updatedList)
  return { employee: updatedEmployee, employees: updatedList }
}

export function toggleEmployeeStatus(id) {
  const employees = fetchEmployees()
  const updated = employees.map((emp) => {
    if (emp.id === id) {
      const nextStatus = emp.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
      return {
        ...emp,
        status: nextStatus,
        failedAttempts: nextStatus === 'ACTIVE' ? 0 : emp.failedAttempts,
      }
    }
    return emp
  })
  saveEmployees(updated)
  return updated
}

export function resetEmployeePassword(id) {
  const employees = fetchEmployees()
  const tempPass = `Nexus@${Math.floor(100000 + Math.random() * 900000)}`
  const updated = employees.map((emp) =>
    emp.id === id ? { ...emp, tempPassword: tempPass } : emp
  )
  saveEmployees(updated)
  return { employees: updated, tempPass }
}

