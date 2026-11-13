import { fetchOrders } from './orderService.js'
import { getStoredInvoices } from './billingService.js'
import { getActivatedAccounts } from './activationService.js'

const CUSTOMERS_STORAGE_KEY = 'nexus_customers'

const BRANCH_LABELS = {
  '101': 'Hoan Kiem (HN)',
  '201': 'District 1 (HCMC)',
  '301': 'Hai Chau (DN)',
}

export const INITIAL_CUSTOMERS = [
  {
    id: 'CUS-001',
    customerName: 'AlphaCorp Technology Solutions JSC',
    taxId: '0108881948',
    customerType: 'Corporate',
    contactPerson: 'Nguyen Van Hung',
    phone: '0912.839.201',
    email: 'accounting@alphacorp.vn',
    address: '45 Ly Thuong Kiet, Tran Hung Dao, Hoan Kiem, Hanoi',
    branchCode: '101',
    branchName: 'Hoan Kiem (HN)',
    status: 'ACTIVE',
    createdAt: '2026-01-12',
  },
  {
    id: 'CUS-002',
    customerName: 'TechNova Vietnam Joint Stock Co.',
    taxId: '0108945621',
    customerType: 'Corporate',
    contactPerson: 'Nguyen Hai Dang',
    phone: '+84 912 445 889',
    email: 'dang.nh@technova.vn',
    address: 'Floor 8, Diamond Flower Tower, 48 Le Van Luong, Cau Giay, Hanoi',
    branchCode: '101',
    branchName: 'Hoan Kiem (HN)',
    status: 'ACTIVE',
    createdAt: '2026-02-04',
  },
  {
    id: 'CUS-003',
    customerName: 'Phuc Thinh Legal Counsel & Partners',
    taxId: '0107882319',
    customerType: 'SME',
    contactPerson: 'Le Thi Thu',
    phone: '+84 983 112 909',
    email: 'ops@phucthinhlaw.vn',
    address: '14 Lane 68 Trung Kinh, Yen Hoa, Cau Giay, Hanoi',
    branchCode: '101',
    branchName: 'Hoan Kiem (HN)',
    status: 'ACTIVE',
    createdAt: '2026-02-19',
  },
  {
    id: 'CUS-004',
    customerName: 'PharmaCare Healthcare Group',
    taxId: '0304918274',
    customerType: 'Corporate',
    contactPerson: 'Ba Trang',
    phone: '+84 903 882 114',
    email: 'procurement@pharmacare.vn',
    address: 'Landmark 81, Floor 22, Binh Thanh, HCMC',
    branchCode: '201',
    branchName: 'District 1 (HCMC)',
    status: 'ACTIVE',
    createdAt: '2026-02-22',
  },
  {
    id: 'CUS-005',
    customerName: 'XNK Hai Ha Logistics Ltd.',
    taxId: '0400192834',
    customerType: 'SME',
    contactPerson: 'Hoang Van Minh',
    phone: '+84 935 210 879',
    email: 'minh.hv@haihalogistics.vn',
    address: 'Hoa Quy New Urban Area, Ngu Hanh Son, Da Nang',
    branchCode: '301',
    branchName: 'Hai Chau (DN)',
    status: 'SUSPENDED',
    createdAt: '2026-03-01',
  },
  {
    id: 'CUS-006',
    customerName: 'FastCall Teleservices Contact Center',
    taxId: '0309981273',
    customerType: 'Corporate',
    contactPerson: 'Thanh Phong',
    phone: '+84 28 7300 8899',
    email: 'it.director@fastcall.vn',
    address: 'Parkson Cantavil, Thu Duc, HCMC',
    branchCode: '201',
    branchName: 'District 1 (HCMC)',
    status: 'ACTIVE',
    createdAt: '2026-03-05',
  },
]

function saveCustomers(customers) {
  try {
    localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers))
  } catch {
  }
}

export function fetchCustomers() {
  try {
    const raw = localStorage.getItem(CUSTOMERS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
  }
  saveCustomers(INITIAL_CUSTOMERS)
  return INITIAL_CUSTOMERS
}

function validateCustomerPayload(payload, customers, ignoreId = null) {
  const customerName = String(payload.customerName || '').trim()
  const taxId = String(payload.taxId || '').trim()
  const contactPerson = String(payload.contactPerson || '').trim()
  const phone = String(payload.phone || '').trim()
  const email = String(payload.email || '').trim()
  const address = String(payload.address || '').trim()

  if (!customerName) throw new Error('Customer legal name is required.')
  if (!taxId || taxId.length < 5) throw new Error('Valid Tax Code / Enterprise ID is required.')
  if (!contactPerson) throw new Error('Contact representative name is required.')
  if (!phone) throw new Error('Contact phone number is required.')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid billing email is required.')
  if (!address) throw new Error('Subscriber installation address is required.')

  const duplicateTax = customers.find(
    (c) => c.id !== ignoreId && String(c.taxId || '').trim().toLowerCase() === taxId.toLowerCase()
  )
  if (duplicateTax) {
    throw new Error(`Tax Code "${taxId}" is already registered to ${duplicateTax.customerName}.`)
  }

  return { customerName, taxId, contactPerson, phone, email, address }
}

export function createCustomer(payload) {
  const customers = fetchCustomers()
  const validated = validateCustomerPayload(payload, customers)
  const maxNum = customers.reduce((max, item) => {
    const match = /^CUS-(\d+)$/i.exec(item.id || '')
    const num = match ? parseInt(match[1], 10) : 0
    return num > max ? num : max
  }, 0)
  const id = `CUS-${String(maxNum + 1).padStart(3, '0')}`
  const branchCode = payload.branchCode || '101'

  const newCustomer = {
    id,
    ...validated,
    customerType: payload.customerType || 'Corporate',
    branchCode,
    branchName: payload.branchName || BRANCH_LABELS[branchCode] || 'Hoan Kiem (HN)',
    status: payload.status || 'ACTIVE',
    createdAt: new Date().toISOString().slice(0, 10),
  }

  const updated = [newCustomer, ...customers]
  saveCustomers(updated)
  return newCustomer
}

export function updateCustomer(customerId, updatedFields) {
  const customers = fetchCustomers()
  const index = customers.findIndex((c) => c.id === customerId)
  if (index === -1) {
    throw new Error(`Customer ${customerId} not found.`)
  }

  const current = customers[index]
  const merged = { ...current, ...updatedFields }
  const validated = validateCustomerPayload(merged, customers, customerId)
  const branchCode = merged.branchCode || current.branchCode || '101'

  const updated = {
    ...current,
    ...merged,
    ...validated,
    id: current.id,
    branchCode,
    branchName: updatedFields.branchName || BRANCH_LABELS[branchCode] || current.branchName,
  }

  const next = customers.map((c) => (c.id === customerId ? updated : c))
  saveCustomers(next)
  return updated
}

export function deleteCustomer(customerId) {
  const customers = fetchCustomers()
  const exists = customers.some((c) => c.id === customerId)
  if (!exists) {
    throw new Error(`Customer ${customerId} not found.`)
  }
  const updated = customers.filter((c) => c.id !== customerId)
  saveCustomers(updated)
  return updated
}

const CUSTOMER_ID_FORMAT_RE = /^CUS-[A-Z0-9_-]+$/i
const ORDER_ID_FORMAT_RE = /^[DBT]\d{10}$/i
const ACCOUNT_ID_FORMAT_RE = /^[DBT]\d{15}$/i
const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TAX_ID_FORMAT_RE = /^\d{8,14}$/

export const DEMO_SUBSCRIBER_ALIASES = {
  B001000000000001: {
    customerId: 'CUS-001',
    accountId: 'B101000000000089',
    taxId: '0108881948',
  },
}

const normUpper = (value) => String(value || '').trim().toUpperCase()
const normLower = (value) => String(value || '').trim().toLowerCase()
const normTax = (value) => String(value || '').trim()

function getRecordEmail(record) {
  return normLower(record?.customerEmail || record?.email || '')
}

function getRecordOrderId(record) {
  const candidates = [record?.orderId, record?.id]
  for (const cand of candidates) {
    const upper = normUpper(cand)
    if (ORDER_ID_FORMAT_RE.test(upper)) return upper
  }
  return ''
}

function collectVerifiedKeys(user, customers) {
  const customerIds = new Set()
  const taxIds = new Set()
  const emails = new Set()
  const accountIds = new Set()
  const orderIds = new Set()
  const matchedBy = []

  const addCustomerId = (val, reason) => {
    const upper = normUpper(val)
    if (!upper) return
    customerIds.add(upper)
    if (reason && !matchedBy.includes(reason)) matchedBy.push(reason)
  }
  const addTaxId = (val, reason) => {
    const cleaned = normTax(val)
    if (!cleaned) return
    taxIds.add(cleaned)
    if (reason && !matchedBy.includes(reason)) matchedBy.push(reason)
  }
  const addEmail = (val, reason) => {
    const lower = normLower(val)
    if (!lower || !EMAIL_FORMAT_RE.test(lower)) return
    emails.add(lower)
    if (reason && !matchedBy.includes(reason)) matchedBy.push(reason)
  }
  const addAccountId = (val, reason) => {
    const upper = normUpper(val)
    if (!upper || !ACCOUNT_ID_FORMAT_RE.test(upper)) return
    accountIds.add(upper)
    if (reason && !matchedBy.includes(reason)) matchedBy.push(reason)
  }
  const addOrderId = (val, reason) => {
    const upper = normUpper(val)
    if (!upper || !ORDER_ID_FORMAT_RE.test(upper)) return
    orderIds.add(upper)
    if (reason && !matchedBy.includes(reason)) matchedBy.push(reason)
  }

  addCustomerId(user?.customerId, 'customerId')
  addTaxId(user?.taxId, 'taxId')
  addEmail(user?.email, 'email')
  addAccountId(user?.accountId || user?.verifiedAccountId, 'accountId')
  if (Array.isArray(user?.accountIds)) {
    user.accountIds.forEach((id) => addAccountId(id, 'accountId'))
  }
  addOrderId(user?.orderId || user?.verifiedOrderId, 'orderId')
  if (Array.isArray(user?.orderIds)) {
    user.orderIds.forEach((id) => addOrderId(id, 'orderId'))
  }

  const rawIdent = String(user?.identifier || '').trim()
  const upperIdent = normUpper(rawIdent)
  if (rawIdent) {
    const alias = DEMO_SUBSCRIBER_ALIASES[upperIdent]
    if (alias) {
      addCustomerId(alias.customerId, 'demoAlias')
      addAccountId(alias.accountId, 'demoAlias')
      addTaxId(alias.taxId, 'demoAlias')
    } else if (
      CUSTOMER_ID_FORMAT_RE.test(upperIdent) ||
      customers.some((c) => normUpper(c.id) === upperIdent)
    ) {
      addCustomerId(upperIdent, 'customerId')
    } else if (ACCOUNT_ID_FORMAT_RE.test(upperIdent)) {
      addAccountId(upperIdent, 'accountId')
    } else if (ORDER_ID_FORMAT_RE.test(upperIdent)) {
      addOrderId(upperIdent, 'orderId')
    } else if (TAX_ID_FORMAT_RE.test(rawIdent)) {
      addTaxId(rawIdent, 'taxId')
    } else if (EMAIL_FORMAT_RE.test(rawIdent)) {
      addEmail(rawIdent, 'email')
    }
  }

  const hasVerifiedKey =
    customerIds.size > 0 ||
    taxIds.size > 0 ||
    emails.size > 0 ||
    accountIds.size > 0 ||
    orderIds.size > 0

  return { customerIds, taxIds, emails, accountIds, orderIds, matchedBy, hasVerifiedKey }
}

function recordPassesTenantBoundary(record, scopeCustomerIds, scopeTaxIds) {
  const recCustomerId = normUpper(record?.customerId)
  const recTaxId = normTax(record?.taxId)

  if (scopeCustomerIds.size > 0 && recCustomerId && !scopeCustomerIds.has(recCustomerId)) {
    return false
  }
  if (scopeTaxIds.size > 0 && recTaxId && !scopeTaxIds.has(recTaxId)) {
    return false
  }
  return true
}

function recordMatchesScope(record, scope) {
  if (!record || !recordPassesTenantBoundary(record, scope.customerIds, scope.taxIds)) {
    return false
  }

  const recCustomerId = normUpper(record.customerId)
  const recTaxId = normTax(record.taxId)
  const recEmail = getRecordEmail(record)
  const recAccountId = normUpper(record.accountId)
  const recOrderId = getRecordOrderId(record)

  return (
    (recCustomerId && scope.customerIds.has(recCustomerId)) ||
    (recTaxId && scope.taxIds.has(recTaxId)) ||
    (recEmail && scope.emails.has(recEmail)) ||
    (recAccountId && scope.accountIds.has(recAccountId)) ||
    (recOrderId && scope.orderIds.has(recOrderId))
  )
}

function buildScopeAndMatchedCustomer(keys, { customers, orders, circuits, invoices }) {
  const findCustomerForRecord = (record) => {
    if (!record) return null
    const recCusId = normUpper(record.customerId)
    if (recCusId) {
      const byId = customers.find((c) => normUpper(c.id) === recCusId)
      if (byId) return byId
    }
    const recTaxId = normTax(record.taxId)
    if (recTaxId) {
      const byTax = customers.find((c) => normTax(c.taxId) === recTaxId)
      if (byTax) return byTax
    }
    const recEmail = getRecordEmail(record)
    if (recEmail) {
      const byEmail = customers.find((c) => normLower(c.email) === recEmail)
      if (byEmail) return byEmail
    }
    return null
  }

  let matchedCustomer =
    customers.find((c) => keys.customerIds.has(normUpper(c.id))) ||
    customers.find((c) => keys.taxIds.has(normTax(c.taxId))) ||
    customers.find((c) => keys.emails.has(normLower(c.email))) ||
    null

  const seededSeedMatches = []
  if (!matchedCustomer && (keys.accountIds.size > 0 || keys.orderIds.size > 0)) {
    for (const rec of [...circuits, ...orders, ...invoices]) {
      const recAcc = normUpper(rec.accountId)
      const recOrd = getRecordOrderId(rec)
      const isDirectSeedMatch =
        (recAcc && keys.accountIds.has(recAcc)) || (recOrd && keys.orderIds.has(recOrd))
      if (!isDirectSeedMatch) continue
      seededSeedMatches.push(rec)
      if (!matchedCustomer) {
        matchedCustomer = findCustomerForRecord(rec)
      }
    }
  }

  const scope = {
    customerIds: new Set(keys.customerIds),
    taxIds: new Set(keys.taxIds),
    emails: new Set(keys.emails),
    accountIds: new Set(keys.accountIds),
    orderIds: new Set(keys.orderIds),
  }

  if (matchedCustomer) {
    scope.customerIds.add(normUpper(matchedCustomer.id))
    if (matchedCustomer.taxId) scope.taxIds.add(normTax(matchedCustomer.taxId))
    if (matchedCustomer.email) scope.emails.add(normLower(matchedCustomer.email))
  } else {
    for (const rec of seededSeedMatches) {
      if (rec.customerId) scope.customerIds.add(normUpper(rec.customerId))
      if (rec.taxId) scope.taxIds.add(normTax(rec.taxId))
      const recEmail = getRecordEmail(rec)
      if (recEmail) scope.emails.add(recEmail)
    }
  }

  // Link safe accountId/orderId references from records that pass the tenant boundary
  for (const rec of [...circuits, ...orders, ...invoices]) {
    if (!recordMatchesScope(rec, scope)) continue
    const recAcc = normUpper(rec.accountId)
    if (ACCOUNT_ID_FORMAT_RE.test(recAcc) && (!rec.status || rec.status === 'ACTIVE' || rec.status === 'ACTIVATED' || rec.status === 'SUSPENDED' || rec.invoiceId)) {
      scope.accountIds.add(recAcc)
    }
    const recOrd = getRecordOrderId(rec)
    if (recOrd && !rec.invoiceId) {
      scope.orderIds.add(recOrd)
    }
    if (rec.taxId && scope.taxIds.size === 0) {
      scope.taxIds.add(normTax(rec.taxId))
    }
  }

  return { matchedCustomer, scope }
}

export function resolveVerifiedCustomerAccount(identifier, customInvoices = null) {
  const rawIdent = String(identifier || '').trim()
  if (!rawIdent) return null

  const customers = fetchCustomers()
  const orders = fetchOrders()
  const circuits = getActivatedAccounts()
  const invoices = Array.isArray(customInvoices) ? customInvoices : getStoredInvoices()

  const keys = collectVerifiedKeys({ identifier: rawIdent }, customers)
  if (!keys.hasVerifiedKey) return null

  const { matchedCustomer, scope } = buildScopeAndMatchedCustomer(keys, {
    customers,
    orders,
    circuits,
    invoices,
  })

  const matchedRecords = [...circuits, ...orders, ...invoices].filter((rec) =>
    recordMatchesScope(rec, scope)
  )

  if (!matchedCustomer && matchedRecords.length === 0) {
    return null
  }

  const representative = matchedRecords[0] || null
  const customerId = matchedCustomer?.id || Array.from(scope.customerIds)[0] || null
  const taxId = matchedCustomer?.taxId || Array.from(scope.taxIds)[0] || null
  const email =
    matchedCustomer?.email ||
    Array.from(scope.emails)[0] ||
    (EMAIL_FORMAT_RE.test(rawIdent) ? rawIdent : null)
  const customerName =
    matchedCustomer?.customerName ||
    representative?.customerName ||
    customerId ||
    taxId ||
    rawIdent

  return {
    customerId,
    customerName,
    taxId,
    email,
    status: matchedCustomer?.status || 'ACTIVE',
    accountIds: Array.from(scope.accountIds),
    orderIds: Array.from(scope.orderIds),
    matchedBy: keys.matchedBy[0] || 'identifier',
  }
}

export function filterCustomerData(user, customInvoices = null) {
  if (!user || (!user.customerId && !user.identifier && !user.taxId && !user.email && !user.accountId && !user.orderId)) {
    return {
      customerProfile: null,
      circuits: [],
      orders: [],
      invoices: [],
      isEmpty: true,
      hasUser: false,
    }
  }

  const allCustomers = fetchCustomers()
  const allOrders = fetchOrders()
  const allInvoices = Array.isArray(customInvoices) ? customInvoices : getStoredInvoices()
  const allCircuits = getActivatedAccounts()

  const keys = collectVerifiedKeys(user, allCustomers)
  if (!keys.hasVerifiedKey) {
    return {
      customerProfile: {
        customerId: null,
        customerName: user.fullName || user.displayName || user.identifier || 'Unverified Subscriber',
        taxId: null,
        email: null,
        identifier: user.identifier || null,
        matchedBy: null,
        isVerified: false,
      },
      circuits: [],
      orders: [],
      invoices: [],
      isEmpty: true,
      hasUser: true,
    }
  }

  const { matchedCustomer, scope } = buildScopeAndMatchedCustomer(keys, {
    customers: allCustomers,
    orders: allOrders,
    circuits: allCircuits,
    invoices: allInvoices,
  })

  const circuits = allCircuits.filter((c) => recordMatchesScope(c, scope))
  const orders = allOrders.filter((o) => recordMatchesScope(o, scope))
  const invoices = allInvoices.filter((inv) => recordMatchesScope(inv, scope))

  const firstMatchedName =
    matchedCustomer?.customerName ||
    circuits[0]?.customerName ||
    orders[0]?.customerName ||
    invoices[0]?.customerName ||
    null

  const customerId = matchedCustomer?.id || Array.from(scope.customerIds)[0] || null
  const taxId = matchedCustomer?.taxId || Array.from(scope.taxIds)[0] || null
  const email =
    matchedCustomer?.email ||
    Array.from(scope.emails)[0] ||
    (EMAIL_FORMAT_RE.test(user.email || '') ? user.email : EMAIL_FORMAT_RE.test(user.identifier || '') ? user.identifier : null)
  const customerName =
    firstMatchedName || user.fullName || user.displayName || customerId || user.identifier

  const isVerified = Boolean(
    matchedCustomer ||
      circuits.length > 0 ||
      orders.length > 0 ||
      invoices.length > 0 ||
      scope.customerIds.size > 0 ||
      scope.taxIds.size > 0
  )

  return {
    customerProfile: {
      customerId,
      customerName,
      taxId,
      email,
      identifier: user.identifier || customerId || taxId || null,
      matchedBy: keys.matchedBy[0] || null,
      isVerified,
    },
    circuits,
    orders,
    invoices,
    isEmpty: circuits.length === 0 && orders.length === 0 && invoices.length === 0,
    hasUser: true,
  }
}
