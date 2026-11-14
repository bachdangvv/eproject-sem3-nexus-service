import { fetchEmployees } from './adminUserService.js'
import { fetchCustomers, resolveVerifiedCustomerAccount } from './customerService.js'
import {
  REVIEW1_API_MODE,
  fetchSessionApi,
  loginApi,
  logoutApi,
  toFrontendRole,
} from './review1Api.js'

export const DEMO_DEFAULT_PASSWORD = 'Nexus@2026'
export const DEMO_TOKEN_PREFIX = 'demo-session-'

export const ROLES_INFO = {
  customer: {
    id: 'customer',
    name: 'Customer / Enterprise',
    dashboard: '/customer',
    defaultIdentifier: 'CUS-001',
    defaultCustomerId: 'CUS-001',
    demoSummary: 'AlphaCorp (CUS-001) • B2B Subscriber Portal',
  },
  retail: {
    id: 'retail',
    name: 'Retail Outlet Staff',
    dashboard: '/retail/orders',
    defaultIdentifier: 'retail.hn01@nexus.vn',
    demoSummary: 'Hanoi Branch Sales Desk',
  },
  technical: {
    id: 'technical',
    name: 'Technical / NOC Engineer',
    dashboard: '/technical/surveys',
    defaultIdentifier: 'noc.engineer@nexus.vn',
    demoSummary: 'ODN Survey & Circuit Activation',
  },
  accounts: {
    id: 'accounts',
    name: 'Accounts & Billing Officer',
    dashboard: '/accounts/billing',
    defaultIdentifier: 'billing.officer@nexus.vn',
    demoSummary: 'Invoicing & 12.24% Tax Audit',
  },
  admin: {
    id: 'admin',
    name: 'System Administrator',
    dashboard: '/admin/plans',
    defaultIdentifier: 'admin@nexus.vn',
    demoSummary: 'Plans, Stock, Customers & Users',
  },
}

export const ROLE_DASHBOARDS = Object.fromEntries(
  Object.entries(ROLES_INFO).map(([k, v]) => [k, v.dashboard])
)

export function getDefaultDashboardForRole(role) {
  const normalized = (role || '').toLowerCase()
  return ROLE_DASHBOARDS[normalized] || '/login'
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('nexus_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return REVIEW1_API_MODE
    ? Boolean(getCurrentUser())
    : Boolean(localStorage.getItem('nexus_token') && getCurrentUser())
}

function persistServerSession(session) {
  const role = toFrontendRole(session?.role)
  if (!session?.username || !role) {
    localStorage.removeItem('nexus_user')
    localStorage.removeItem('nexus_token')
    return null
  }

  const user = {
    identifier: session.username,
    username: session.username,
    displayName: session.displayName || session.username,
    role,
    roleName: role === 'accounts' ? 'Accounts & Billing Officer' : ROLES_INFO[role]?.name || role,
    dashboardRoute: getDefaultDashboardForRole(role),
    authMode: 'SERVER_COOKIE_SESSION',
    isRealAuth: true,
    loggedInAt: new Date().toISOString(),
  }
  // This is only a UI cache. The server cookie remains the authority.
  localStorage.setItem('nexus_user', JSON.stringify(user))
  localStorage.removeItem('nexus_token')
  return user
}

export async function hydrateServerSession() {
  if (!REVIEW1_API_MODE) return getCurrentUser()
  try {
    const session = await fetchSessionApi()
    return persistServerSession(session)
  } catch {
    return null
  }
}

function persistDemoSession(sessionUser) {
  const demoToken = `${DEMO_TOKEN_PREFIX}${sessionUser.role}-${Date.now()}`
  localStorage.setItem('nexus_user', JSON.stringify(sessionUser))
  localStorage.setItem('nexus_token', demoToken)
  return sessionUser
}

export function enterDemoRole(role = 'customer', options = {}) {
  const normalizedRole = String(role || 'customer').trim().toLowerCase()
  const roleMeta = ROLES_INFO[normalizedRole] || ROLES_INFO.customer

  if (roleMeta.id === 'customer') {
    const requestedCustomerId = String(
      options.customerId || options.identifier || roleMeta.defaultCustomerId || 'CUS-001'
    ).trim()
    const resolved = resolveVerifiedCustomerAccount(requestedCustomerId)
    const fallbackCustomer = fetchCustomers().find(
      (c) => String(c.id || '').toUpperCase() === requestedCustomerId.toUpperCase()
    )
    const customerId = resolved?.customerId || fallbackCustomer?.id || 'CUS-001'
    const customerName =
      resolved?.customerName || fallbackCustomer?.customerName || 'AlphaCorp Technology Solutions JSC'
    const taxId = resolved?.taxId || fallbackCustomer?.taxId || '0108881948'
    const email = resolved?.email || fallbackCustomer?.email || 'accounting@alphacorp.vn'

    return persistDemoSession({
      identifier: customerId,
      customerId,
      taxId,
      email,
      fullName: customerName,
      displayName: customerName,
      verifiedAccountIds: resolved?.accountIds || [],
      verifiedOrderIds: resolved?.orderIds || [],
      role: roleMeta.id,
      roleName: roleMeta.name,
      dashboardRoute: roleMeta.dashboard,
      authMode: 'DEMO_ROLE_SWITCHER',
      isRealAuth: false,
      demoNotice: 'Demo role preview session — convenience role switcher only, not real authentication.',
      loggedInAt: new Date().toISOString(),
    })
  }

  const employees = fetchEmployees()
  const staffRecord =
    employees.find(
      (e) =>
        String(e.role || '').toLowerCase() === roleMeta.id &&
        String(e.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    ) ||
    employees.find((e) => String(e.email || '').toLowerCase() === roleMeta.defaultIdentifier.toLowerCase())

  const staffIdentifier = staffRecord?.email || roleMeta.defaultIdentifier
  const staffName = staffRecord?.fullName || roleMeta.name

  return persistDemoSession({
    identifier: staffIdentifier,
    employeeId: staffRecord?.id || null,
    email: staffRecord?.email || staffIdentifier,
    fullName: staffName,
    displayName: staffName,
    role: roleMeta.id,
    roleName: roleMeta.name,
    dashboardRoute: roleMeta.dashboard,
    authMode: 'DEMO_ROLE_SWITCHER',
    isRealAuth: false,
    demoNotice: 'Demo role preview session — convenience role switcher only, not real authentication.',
    loggedInAt: new Date().toISOString(),
  })
}

export async function login(identifier, password, expectedRole = null) {
  if (REVIEW1_API_MODE) {
    const session = await loginApi(String(identifier || '').trim(), String(password || '').trim())
    const user = persistServerSession(session)
    const normalizedExpectedRole = expectedRole === 'accounts' ? 'accounts' : String(expectedRole || '').toLowerCase()
    if (normalizedExpectedRole && normalizedExpectedRole !== user?.role) {
      await logoutApi().catch(() => {})
      persistServerSession({})
      throw new Error(`Role mismatch: this account belongs to ${user?.roleName || user?.role}.`)
    }
    return user
  }

  await new Promise((resolve) => setTimeout(resolve, 350))

  const cleanedIdent = String(identifier || '').trim()
  const cleanedPass = String(password || '').trim()

  if (!cleanedIdent || !cleanedPass) {
    throw new Error('Please provide both registered identifier and demo password.')
  }

  const normalizedExpectedRole = expectedRole ? String(expectedRole).trim().toLowerCase() : null
  if (normalizedExpectedRole && !ROLES_INFO[normalizedExpectedRole]) {
    throw new Error(`Unsupported portal role: ${expectedRole}`)
  }

  const lowerIdent = cleanedIdent.toLowerCase()
  const upperIdent = cleanedIdent.toUpperCase()
  const employees = fetchEmployees()
  const staffMatch = employees.find(
    (emp) =>
      String(emp.email || '').trim().toLowerCase() === lowerIdent ||
      String(emp.id || '').trim().toUpperCase() === upperIdent
  )

  if (staffMatch) {
    const empStatus = String(staffMatch.status || 'ACTIVE').toUpperCase()
    if (empStatus !== 'ACTIVE') {
      throw new Error(
        `Staff account ${staffMatch.email} (${staffMatch.id}) is currently ${empStatus}. Contact an administrator to unlock.`
      )
    }

    const expectedStaffPassword = staffMatch.tempPassword || DEMO_DEFAULT_PASSWORD
    if (cleanedPass !== expectedStaffPassword) {
      throw new Error(
        `Invalid password for ${staffMatch.email}. (Demo default: ${DEMO_DEFAULT_PASSWORD})`
      )
    }

    const assignedRole = String(staffMatch.role || '').trim().toLowerCase()
    const roleMeta = ROLES_INFO[assignedRole]
    if (!roleMeta) {
      throw new Error(`Staff account ${staffMatch.email} has unrecognized role "${staffMatch.role}".`)
    }

    if (normalizedExpectedRole && normalizedExpectedRole !== assignedRole) {
      throw new Error(
        `Role mismatch: ${staffMatch.email} is assigned to ${roleMeta.name}, not ${ROLES_INFO[normalizedExpectedRole].name}.`
      )
    }

    return persistDemoSession({
      identifier: staffMatch.email,
      employeeId: staffMatch.id,
      email: staffMatch.email,
      fullName: staffMatch.fullName,
      displayName: staffMatch.fullName || staffMatch.email.split('@')[0],
      role: roleMeta.id,
      roleName: roleMeta.name,
      dashboardRoute: roleMeta.dashboard,
      authMode: 'MOCK_DIRECTORY_LOGIN',
      isRealAuth: false,
      demoNotice: 'Mock directory verification only — client-side demo auth, not server-side JWT/IAM.',
      loggedInAt: new Date().toISOString(),
    })
  }

  const customerMatch = resolveVerifiedCustomerAccount(cleanedIdent)
  if (customerMatch) {
    const cusStatus = String(customerMatch.status || 'ACTIVE').toUpperCase()
    if (cusStatus !== 'ACTIVE') {
      throw new Error(
        `Subscriber account ${customerMatch.customerId || cleanedIdent} is currently ${cusStatus}.`
      )
    }

    if (cleanedPass !== DEMO_DEFAULT_PASSWORD) {
      throw new Error(
        `Invalid password for subscriber ${customerMatch.customerId || cleanedIdent}. (Demo default: ${DEMO_DEFAULT_PASSWORD})`
      )
    }

    if (normalizedExpectedRole && normalizedExpectedRole !== 'customer') {
      throw new Error(
        `Role mismatch: subscriber identifier "${cleanedIdent}" only grants access to Customer / Enterprise Portal, not ${ROLES_INFO[normalizedExpectedRole].name}.`
      )
    }

    const roleMeta = ROLES_INFO.customer
    return persistDemoSession({
      identifier: cleanedIdent,
      customerId: customerMatch.customerId,
      taxId: customerMatch.taxId,
      email: customerMatch.email,
      fullName: customerMatch.customerName,
      displayName: customerMatch.customerName,
      verifiedAccountIds: customerMatch.accountIds || [],
      verifiedOrderIds: customerMatch.orderIds || [],
      matchedBy: customerMatch.matchedBy,
      role: roleMeta.id,
      roleName: roleMeta.name,
      dashboardRoute: roleMeta.dashboard,
      authMode: 'MOCK_DIRECTORY_LOGIN',
      isRealAuth: false,
      demoNotice: 'Mock directory verification only — client-side demo auth, not server-side JWT/IAM.',
      loggedInAt: new Date().toISOString(),
    })
  }

  throw new Error(
    `Identifier "${cleanedIdent}" was not found in the mock directory. Enter a registered staff email/ID, a verified Customer ID (e.g. CUS-001), Tax ID, Account ID, or Order ID — or use the Quick Demo Role Switcher.`
  )
}

export function logout() {
  if (REVIEW1_API_MODE) {
    return logoutApi()
      .catch(() => undefined)
      .finally(() => {
        localStorage.removeItem('nexus_user')
        localStorage.removeItem('nexus_token')
      })
  }
  localStorage.removeItem('nexus_user')
  localStorage.removeItem('nexus_token')
}

export function getRoleDashboardRoute(role) {
  return ROLES_INFO[role]?.dashboard || '/'
}

