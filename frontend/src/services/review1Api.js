import apiClient from './api/apiClient.js'

const IS_BROWSER = typeof window !== 'undefined'
export const REVIEW1_API_MODE = IS_BROWSER && import.meta.env?.VITE_USE_MOCK !== 'true'

export const ROLE_MAP = {
  Admin: 'admin',
  Retail: 'retail',
  Technical: 'technical',
  Billing: 'accounts',
  Customer: 'customer',
}

export function toFrontendRole(role) {
  return ROLE_MAP[role] || String(role || '').trim().toLowerCase()
}

export function toBackendRole(role) {
  const normalized = String(role || 'RETAIL').trim().toUpperCase()
  if (normalized === 'ACCOUNTS' || normalized === 'BILLING') return 'Billing'
  if (normalized === 'ADMIN') return 'Admin'
  if (normalized === 'TECHNICAL') return 'Technical'
  return 'Retail'
}

export function toBackendPlanType(type) {
  const normalized = String(type || '').trim().toUpperCase()
  if (normalized === 'DIALUP' || normalized === 'DIAL_UP' || normalized === 'LEASED_LINE') return 'D'
  if (normalized === 'LANDLINE' || normalized === 'SIP_TRUNK') return 'T'
  if (normalized === 'D' || normalized === 'T' || normalized === 'B') return normalized
  return 'B'
}

export function toFrontendConnectionType(type) {
  const normalized = String(type || '').trim().toUpperCase()
  if (normalized === 'D' || normalized === 'DIALUP' || normalized === 'DIAL_UP') return 'DIALUP'
  if (normalized === 'T' || normalized === 'LANDLINE' || normalized === 'SIP_TRUNK') return 'LANDLINE'
  return 'BROADBAND'
}

export function toFrontendOrderStatus(status) {
  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'PENDING') return 'PENDING_SURVEY'
  if (normalized === 'NOTFEASIBLE' || normalized === 'NOT_FEASIBLE') return 'NOT_FEASIBLE'
  if (normalized === 'CONNECTED') return 'ACTIVATED'
  if (normalized === 'FEASIBLE') return 'FEASIBLE'
  return normalized || 'PENDING_SURVEY'
}

export function toBackendOrderStatus(status) {
  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'PENDING_SURVEY') return 'Pending'
  if (normalized === 'NOT_FEASIBLE') return 'NotFeasible'
  if (normalized === 'ACTIVATED' || normalized === 'CONNECTED') return 'Connected'
  if (normalized === 'FEASIBLE') return 'Feasible'
  return status
}

export function mapPlanFromApi(plan = {}) {
  const connectionType = toFrontendConnectionType(plan.type)
  const rawType = String(plan.type || '').trim().toUpperCase()
  const planType = rawType === 'D' ? 'DIAL_UP' : rawType === 'T' ? 'SIP_TRUNK' : 'BROADBAND'
  const id = String(plan.id ?? '')
  const priceUSD = Number(plan.price ?? plan.priceUSD ?? plan.monthlyNetUSD ?? 0)
  return {
    ...plan,
    id,
    backendId: Number(plan.id),
    sku: plan.sku || `${plan.type || 'B'}-${id}`,
    type: planType,
    connectionType,
    priceUSD,
    monthlyNetUSD: priceUSD,
    monthlyGrossUSD: Number((priceUSD * 1.1224).toFixed(2)),
    status: plan.active === false ? 'INACTIVE' : 'ACTIVE',
    active: plan.active !== false,
    recommended: false,
  }
}

export function mapCustomerFromApi(customer = {}) {
  const id = String(customer.id ?? '')
  return {
    ...customer,
    id,
    backendId: Number(customer.id),
    customerId: customer.code || `CUS-${String(customer.id || '').padStart(6, '0')}`,
    customerName: customer.name || '',
    name: customer.name || '',
    email: customer.email || '',
    taxId: customer.taxId || '',
    contactPerson: customer.contactPerson || '',
    branchCode: customer.cityCode || '',
    status: customer.status || 'ACTIVE',
  }
}

export function mapOrderFromApi(order = {}) {
  const request = order.request || {}
  const serviceType = toFrontendConnectionType(request.type)
  const code = order.code || order.id || ''
  return {
    ...order,
    id: code,
    orderId: code,
    code,
    status: toFrontendOrderStatus(order.status),
    statusLabel: toFrontendOrderStatus(order.status),
    requestId: String(order.requestId ?? request.id ?? ''),
    customerId: String(request.customerId ?? ''),
    customerName: request.customerName || request.name || '',
    customerEmail: request.customerEmail || '',
    customerPhone: request.phone || '',
    phone: request.phone || '',
    address: request.address || '',
    installationAddress: request.address || '',
    cityCode: request.cityCode || '',
    branchCode: request.cityCode || '',
    planId: String(request.planId ?? ''),
    planName: request.planName || '',
    planPriceUSD: Number(request.price ?? request.planPriceUSD ?? 0),
    serviceType,
    serviceName: request.planName || serviceType,
    hasNexusLandline: Boolean(request.hasNexusLandline),
    accountId: order.accountId || null,
    activatedAt: order.activatedAt || null,
    createdAt: order.createdAt,
    currentStep: toFrontendOrderStatus(order.status) === 'ACTIVATED' ? 5 :
      toFrontendOrderStatus(order.status) === 'FEASIBLE' ? 3 : 2,
  }
}

export function mapOrderDetailFromApi(detail = {}) {
  const mapped = mapOrderFromApi(detail.order || {})
  return {
    ...mapped,
    history: (detail.history || []).map((item) => ({
      ...item,
      status: toFrontendOrderStatus(item.status),
      at: item.at,
      actor: item.actor,
    })),
    feedback: detail.feedback || [],
  }
}

export async function fetchSessionApi() {
  const { data } = await apiClient.get('/session')
  return data
}

export async function loginApi(username, password) {
  await apiClient.get('/session')
  await apiClient.post('/login', { username, password })
  return fetchSessionApi()
}

export async function logoutApi() {
  await apiClient.post('/logout')
  return fetchSessionApi()
}

export async function fetchCitiesApi() {
  const { data } = await apiClient.get('/cities')
  return data
}

export async function fetchPlansApi(includeInactive = false) {
  const { data } = await apiClient.get('/plans')
  return data.filter((plan) => includeInactive || plan.active !== false).map(mapPlanFromApi)
}

export async function createPlanApi(payload) {
  const { data } = await apiClient.post('/plans', {
    name: payload.name,
    type: toBackendPlanType(payload.type),
    description: payload.description || '',
    price: Number(payload.price ?? payload.monthlyNetUSD ?? 0),
    active: payload.active !== false && payload.status !== 'INACTIVE',
  })
  return mapPlanFromApi(data)
}

export async function updatePlanApi(id, payload) {
  const { data } = await apiClient.put(`/plans/${Number(id)}`, {
    name: payload.name,
    type: toBackendPlanType(payload.type),
    description: payload.description || '',
    price: Number(payload.price ?? payload.monthlyNetUSD ?? 0),
    active: payload.active !== false && payload.status !== 'INACTIVE',
  })
  return mapPlanFromApi(data)
}

export async function archivePlanApi(id) {
  await apiClient.delete(`/plans/${Number(id)}`)
}

export async function fetchEmployeesApi() {
  const { data } = await apiClient.get('/employees')
  return data.map((employee) => ({
    ...employee,
    id: String(employee.id),
    email: employee.username,
    fullName: employee.displayName,
    role: String(employee.role || '').toUpperCase() === 'BILLING' ? 'ACCOUNTS' : String(employee.role || '').toUpperCase(),
    status: 'ACTIVE',
  }))
}

export async function createEmployeeApi(payload) {
  const username = String(payload.username || payload.email || '').trim().toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._-]/g, '.')
  const { data } = await apiClient.post('/employees', {
    username: username || 'employee.new',
    displayName: payload.displayName || payload.fullName,
    role: toBackendRole(payload.role),
    password: payload.password || 'Nexus-New-2026!',
  })
  return {
    ...data,
    id: String(data.id),
    email: data.username,
    fullName: data.displayName,
    role: String(data.role || '').toUpperCase() === 'BILLING' ? 'ACCOUNTS' : String(data.role || '').toUpperCase(),
    status: 'ACTIVE',
  }
}

export async function fetchCustomersApi(query = '') {
  const { data } = await apiClient.get('/customers', { params: query ? { q: query } : undefined })
  return data.map(mapCustomerFromApi)
}

export async function createCustomerApi(payload) {
  const { data } = await apiClient.post('/customers', {
    name: payload.name || payload.customerName,
    phone: String(payload.phone || payload.customerPhone || '').replace(/[^\d+]/g, ''),
    address: payload.address || payload.installationAddress,
    cityCode: payload.cityCode || payload.branchCode || '101',
    taxId: payload.taxId || null,
    email: payload.email || payload.customerEmail || null,
    contactPerson: payload.contactPerson || payload.representativeName || null,
    customerType: payload.customerType || 'Corporate',
    status: payload.status || 'ACTIVE',
  })
  return mapCustomerFromApi(data)
}

export async function updateCustomerApi(id, payload) {
  const { data } = await apiClient.put(`/customers/${Number(id)}`, {
    name: payload.name || payload.customerName,
    phone: String(payload.phone || payload.customerPhone || '').replace(/[^\d+]/g, ''),
    address: payload.address || payload.installationAddress,
    cityCode: payload.cityCode || payload.branchCode || '101',
    taxId: payload.taxId || null,
    email: payload.email || payload.customerEmail || null,
    contactPerson: payload.contactPerson || payload.representativeName || null,
    customerType: payload.customerType || 'Corporate',
    status: payload.status || 'ACTIVE',
  })
  return mapCustomerFromApi(data)
}

export async function createOrderApi(payload) {
  if (String(payload.status || '').toUpperCase() === 'DRAFT') {
    throw new Error('Draft orders are not part of the Review 1 backend flow yet.')
  }

  let customerId = Number(payload.customerId)
  if (!Number.isInteger(customerId) || customerId <= 0) {
    const customer = await createCustomerApi(payload)
    customerId = Number(customer.backendId)
  }

  const requestResponse = await apiClient.post('/requests', {
    customerId,
    planId: Number(payload.backendPlanId || payload.planId),
    hasNexusLandline: Boolean(payload.hasNexusLandline || payload.hasLandlineBundle),
  })
  const { data } = await apiClient.post(`/requests/${requestResponse.data.id}/confirm`)
  return mapOrderFromApi(data)
}

export async function fetchOrdersApi({ code = '', status = '' } = {}) {
  const params = {}
  if (code) params.code = code
  if (status) params.status = toBackendOrderStatus(status)
  const { data } = await apiClient.get('/orders', { params })
  return data.map(mapOrderFromApi)
}

export async function fetchOrderDetailApi(code) {
  const { data } = await apiClient.get(`/orders/${encodeURIComponent(code)}`)
  return mapOrderDetailFromApi(data)
}

export async function assessOrderApi(code, payload) {
  const { data } = await apiClient.post(`/orders/${encodeURIComponent(code)}/assessment`, {
    distanceOk: payload.distanceOk,
    serverAvailable: payload.serverAvailable,
    landlineFeasible: payload.landlineFeasible,
    note: payload.note || null,
  })
  return mapOrderFromApi(data)
}

export async function connectOrderApi(code) {
  const { data } = await apiClient.post(`/orders/${encodeURIComponent(code)}/connection`)
  const order = mapOrderFromApi(data)
  return {
    accountId: order.accountId,
    orderId: order.id,
    customerName: order.customerName,
    serviceTitle: order.serviceName,
    cityCode: order.cityCode,
    status: order.status,
    assignedHardware: {
      serialNumber: 'Managed by Review 1 backend',
      macAddress: 'Not captured in Review 1',
      model: 'Backend connection record',
      vendor: 'Nexus',
    },
    networkConfig: {},
    order,
  }
}

export async function recordFeedbackApi(code, payload) {
  const { data } = await apiClient.post(`/orders/${encodeURIComponent(code)}/feedback`, payload)
  return data
}

export async function fetchPublicTrackingApi(type, id) {
  const endpoint = type === 'order'
    ? `/public/track/order/${encodeURIComponent(id)}`
    : `/public/track/account/${encodeURIComponent(id)}`
  const { data } = await apiClient.get(endpoint)
  return { type, id, ...data }
}
