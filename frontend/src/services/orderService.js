import {
  ORDER_STATUS,
  getOrderStatusMeta,
  isOrderModificationLocked,
  normalizeOrderStatus,
  withNormalizedOrderStatus,
} from '../utils/orderStatus.js'
import { saveOrderDocuments, deleteOrderDocuments } from './documentStorageService.js'
import { STATUTORY_TAX_RATE_PERCENT, calculateStatutoryTax } from './taxConfig.js'

const ORDERS_STORAGE_KEY = 'nexus_orders'
const LEGACY_RETAIL_STORAGE_KEY = 'nexus_retail_orders'
const SEQUENCE_KEY_PREFIX = 'nexus_order_seq_'

export const ORDER_ID_REGEX = /^[DBT]\d{10}$/

export const DEPOSIT_STATUS = {
  PENDING: 'PENDING',
  COLLECTED: 'COLLECTED',
  WAIVED: 'WAIVED',
  REFUNDED: 'REFUNDED',
}

export const DEPOSIT_COLLECTION_METHODS = [
  { id: 'CASH', label: 'Cash at Retail Counter' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer / VietQR' },
  { id: 'POS_CARD', label: 'POS / Corporate Card' },
]

export const DEPOSIT_WAIVER_METHOD = {
  id: 'BULK_WAIVER',
  label: '100% Bulk Scheme Deposit Waiver',
}

export function resolveDepositCollectionMethodLabel(methodIdOrLabel) {
  const raw = String(methodIdOrLabel || '').trim()
  if (!raw) return ''
  const upper = raw.toUpperCase()
  if (upper === DEPOSIT_WAIVER_METHOD.id) return DEPOSIT_WAIVER_METHOD.label
  const matched = DEPOSIT_COLLECTION_METHODS.find(
    (m) => m.id === upper || m.label.toLowerCase() === raw.toLowerCase()
  )
  return matched ? matched.label : raw
}

export function buildDepositReceiptNumber(orderId, waived = false) {
  const cleanId = String(orderId || 'ORDER').trim().toUpperCase()
  return `DEP-${cleanId}${waived ? '-W' : ''}`
}

function getDefaultNetworkDefaults(serviceType = 'BROADBAND') {
  const type = String(serviceType || 'BROADBAND').toUpperCase()
  if (type === 'DIALUP' || type === 'DIAL_UP') {
    return { defaultVlan: 300, defaultIpWan: '118.70.186.42/30', defaultGateway: '118.70.186.41' }
  }
  if (type === 'LANDLINE') {
    return { defaultVlan: 200, defaultIpWan: '118.70.185.14/29', defaultGateway: '118.70.185.13' }
  }
  return { defaultVlan: 100, defaultIpWan: '118.70.184.22/29', defaultGateway: '118.70.184.21' }
}

const RAW_INITIAL_ORDERS = [
  {
    id: 'B0000001089',
    customerId: 'CUS-002',
    serviceType: 'BROADBAND',
    serviceName: 'Broadband FTTx',
    registeredTime: '09:14',
    customerName: 'TechNova Vietnam Joint Stock Co.',
    taxId: '0108945621',
    customerEmail: 'dang.nh@technova.vn',
    customerType: 'Corporate',
    contactPerson: 'Nguyen Hai Dang',
    role: 'Technical Director',
    phone: '+84 912 445 889',
    address: 'Floor 8, Diamond Flower Tower, 48 Le Van Luong, Cau Giay, Hanoi',
    planName: 'Fiber ENTERPRISE 500',
    planPriceUSD: 55,
    paymentScheme: 'Prepay 6M (-10% Discount)',
    schemeDiscountUSD: 5.5,
    installationFeeUSD: 50,
    branchName: 'Hoan Kiem (HN)',
    branchCode: '101',
    cityCode: '101',
    status: ORDER_STATUS.FEASIBLE,
    currentStep: 3,
    signalLoss: '-18.2 dBm',
    odnBox: 'ODN Box #HN101-FT09 dist 42m (Standard < -24 dBm)',
    odfName: 'ODF-SP-HK-04 [Pole H04]',
    reservedPort: 4,
    distanceMeters: 185,
    conduitType: 'HDPE 110mm Duct (2 sub-ducts spare)',
    surveyRxDbm: -18.2,
    slaTimeRemaining: '48m',
    slaRemainingMinutes: 48,
    isUrgent: true,
    defaultVlan: 100,
    defaultIpWan: '118.70.184.22/29',
    defaultGateway: '118.70.184.21',
    allocatedDevice: 'Modem GPON Dual-band Wi-Fi 6 Router (NX-GPON-9942A)',
    deviceSerial: 'SN: NX0942A00098418',
    deviceMac: 'MAC: 4A:2F:B0:01:9C:12',
    accountId: 'B101000000000089',
  },
  {
    id: 'B0000001090',
    customerId: 'CUS-003',
    serviceType: 'BROADBAND',
    serviceName: 'Broadband FTTx',
    registeredTime: '09:38',
    customerName: 'Phuc Thinh Legal Counsel & Partners',
    taxId: '0107882319',
    customerEmail: 'ops@phucthinhlaw.vn',
    customerType: 'Corporate',
    contactPerson: 'Le Thi Thu',
    role: 'Operations Head',
    phone: '+84 983 112 909',
    address: '14 Lane 68 Trung Kinh, Yen Hoa, Cau Giay, Hanoi',
    planName: 'Fiber BIZ 300',
    planPriceUSD: 35,
    paymentScheme: 'Monthly Postpaid',
    schemeDiscountUSD: 0,
    installationFeeUSD: 50,
    branchName: 'Cau Giay (HN)',
    branchCode: '101',
    cityCode: '101',
    status: ORDER_STATUS.PENDING_SURVEY,
    currentStep: 2,
    signalLoss: 'Pending on-site reading',
    odnBox: 'Dispatching field engineer to ODF junction #CG-04',
    odfName: 'ODF-SP-CG-04 [Pole C09]',
    reservedPort: 3,
    distanceMeters: 210,
    conduitType: 'HDPE 110mm Underground Duct',
    slaTimeRemaining: '45m',
    slaRemainingMinutes: 45,
    isUrgent: true,
    defaultVlan: 102,
    defaultIpWan: '118.70.184.30/29',
    defaultGateway: '118.70.184.29',
    allocatedDevice: 'Reserved Wi-Fi 6 GPON Gateway',
    deviceSerial: 'Pending Serial Assignment',
    deviceMac: 'Pending MAC Assignment',
    accountId: 'Issued upon Technical Activation (Target: B101000000000090)',
  },
  {
    id: 'T0000001092',
    serviceType: 'LANDLINE',
    serviceName: 'SIP Trunking 30 Channels PRI',
    registeredTime: '10:15',
    customerName: 'An Binh Commercial Joint Stock Bank',
    taxId: '0101446758',
    customerType: 'Corporate',
    contactPerson: 'Nguyen Minh Duc',
    role: 'IT Infrastructure Lead',
    phone: '+84 24 3944 8899',
    address: '88 Hai Ba Trung, P. Cua Nam, Q. Hoan Kiem, Hanoi',
    planName: 'SIP Trunking 30 Channels PRI',
    planPriceUSD: 180,
    paymentScheme: 'Monthly Postpaid',
    schemeDiscountUSD: 0,
    installationFeeUSD: 80,
    branchName: 'Hoan Kiem (HN)',
    branchCode: '101',
    cityCode: '101',
    status: ORDER_STATUS.FEASIBLE,
    currentStep: 3,
    signalLoss: '-15.8 dBm',
    odnBox: 'ODF-SP-HK-01 [Main Vault] (95m)',
    odfName: 'ODF-SP-HK-01 [Main Vault]',
    reservedPort: 2,
    distanceMeters: 95,
    conduitType: 'Armored direct optic line 24-core',
    surveyRxDbm: -15.8,
    slaTimeRemaining: '1h 15m',
    slaRemainingMinutes: 195,
    isUrgent: false,
    defaultVlan: 200,
    defaultIpWan: '118.70.185.14/29',
    defaultGateway: '118.70.185.13',
    allocatedDevice: 'AudioCodes Mediant 800 Enterprise SBC',
    deviceSerial: 'Pending Serial Assignment',
    deviceMac: 'Pending MAC Assignment',
    accountId: 'Pending Technical Activation',
  },
  {
    id: 'D0000001094',
    serviceType: 'DIALUP',
    serviceName: 'POS / ATM Dedicated V.92',
    registeredTime: '10:42',
    customerName: 'VinMart+ Convenience Retail Chain',
    taxId: '0107891234',
    customerType: 'Corporate',
    contactPerson: 'Tran Thi Mai',
    role: 'POS Network Coordinator',
    phone: '+84 24 7300 1234',
    address: '19 Pho Hue, P. Hang Bai, Q. Hoan Kiem, Hanoi',
    planName: 'POS / ATM Dedicated V.92 Network',
    planPriceUSD: 85,
    paymentScheme: 'Monthly Postpaid',
    schemeDiscountUSD: 0,
    installationFeeUSD: 50,
    branchName: 'Hoan Kiem (HN)',
    branchCode: '101',
    cityCode: '101',
    status: ORDER_STATUS.PENDING_SURVEY,
    currentStep: 2,
    signalLoss: 'Pending on-site reading',
    odnBox: 'ODF-SP-HK-05 [Pole H05]',
    odfName: 'ODF-SP-HK-05 [Pole H05]',
    reservedPort: 6,
    distanceMeters: 310,
    conduitType: 'Copper & optical hybrid duct (HG-14)',
    slaTimeRemaining: '3h 40m',
    slaRemainingMinutes: 220,
    isUrgent: false,
    defaultVlan: 300,
    defaultIpWan: '118.70.186.42/30',
    defaultGateway: '118.70.186.41',
    allocatedDevice: 'MultiTech MultiModem II 56K Rackmount',
    deviceSerial: 'Pending Serial Assignment',
    deviceMac: 'Pending MAC Assignment',
    accountId: 'Pending Technical Activation',
    hasLandlineBundle: false,
    landlineOption: 'EXISTING',
    existingLandlineNumber: '+84 24 7300 1234',
  },
  {
    id: 'D0000000412',
    customerId: 'CUS-004',
    serviceType: 'DIALUP',
    serviceName: 'Leased Line / Dial-up',
    registeredTime: '11:04',
    customerName: 'PharmaCare Healthcare Group',
    taxId: '0304918274',
    customerEmail: 'procurement@pharmacare.vn',
    customerType: 'Corporate',
    contactPerson: 'Ba Trang',
    role: 'Procurement Specialist',
    phone: '+84 903 882 114',
    address: 'Landmark 81, Floor 22, Binh Thanh, HCMC',
    planName: 'Leased Line 100M Dedicated',
    planPriceUSD: 450,
    paymentScheme: 'Postpaid Monthly Corporate Invoicing',
    schemeDiscountUSD: 0,
    installationFeeUSD: 100,
    branchName: 'District 1 (HCMC)',
    branchCode: '201',
    cityCode: '201',
    status: ORDER_STATUS.ACTIVATED,
    currentStep: 5,
    signalLoss: '-14.1 dBm',
    odnBox: 'Core Metro Ring DWDM-HCM-B8',
    odfName: 'ODF-HCM-B8',
    reservedPort: 8,
    distanceMeters: 140,
    conduitType: 'Core Metro Optical Ring',
    allocatedDevice: 'Edge Router Cisco ASR-920 + Modem v.90',
    deviceSerial: 'SN: FOC2239V0AB',
    deviceMac: 'MAC: 00:27:0D:F1:48:90',
    accountId: 'D201000000000412',
    hasLandlineBundle: true,
    landlineOption: 'BUNDLE',
    existingLandlineNumber: '',
  },
  {
    id: 'B0000001058',
    customerId: 'CUS-005',
    serviceType: 'BROADBAND',
    serviceName: 'Broadband FTTx',
    registeredTime: 'Yesterday',
    customerName: 'XNK Hai Ha Logistics Ltd.',
    taxId: '0400192834',
    customerEmail: 'minh.hv@haihalogistics.vn',
    customerType: 'Corporate',
    contactPerson: 'Hoang Van Minh',
    role: 'Depot Manager',
    phone: '+84 935 210 879',
    address: 'Hoa Quy New Urban Area, Ngu Hanh Son, Da Nang',
    planName: 'Fiber ENTERPRISE 500',
    planPriceUSD: 55,
    paymentScheme: 'Refund 100% Security Deposit (CN16)',
    schemeDiscountUSD: 0,
    installationFeeUSD: 50,
    branchName: 'Hai Chau (DN)',
    branchCode: '301',
    cityCode: '301',
    status: ORDER_STATUS.NOT_FEASIBLE,
    currentStep: 2,
    signalLoss: 'Attenuated > -31.5 dBm',
    odnBox: 'ODN closure 480m from premise (Exceeds SLA 300m limit)',
    odfName: 'ODF-DN-NHS-03',
    reservedPort: 5,
    distanceMeters: 480,
    conduitType: 'Overhead coastal span',
    rejectionReason: 'Exceeds SLA optical drop limit (480m > 300m coastal threshold)',
    allocatedDevice: 'None (Refund Initiated)',
    deviceSerial: 'N/A',
    deviceMac: 'N/A',
    accountId: 'Unassigned (Survey Not Feasible)',
  },
  {
    id: 'T0000000205',
    customerId: 'CUS-006',
    serviceType: 'LANDLINE',
    serviceName: 'Telephone / SIP',
    registeredTime: '14:10',
    customerName: 'FastCall Teleservices Contact Center',
    taxId: '0309981273',
    customerEmail: 'it.director@fastcall.vn',
    customerType: 'Corporate',
    contactPerson: 'Thanh Phong',
    role: 'IT Director',
    phone: '+84 28 7300 8899',
    address: 'Parkson Cantavil, Thu Duc, HCMC',
    planName: 'SIP Trunking 30 Channels',
    planPriceUSD: 120,
    paymentScheme: 'Corporate Billing Postpaid',
    schemeDiscountUSD: 12,
    installationFeeUSD: 80,
    branchName: 'District 1 (HCMC)',
    branchCode: '201',
    cityCode: '201',
    status: ORDER_STATUS.ACTIVATED,
    currentStep: 5,
    signalLoss: 'SIP Latency < 1.2ms',
    odnBox: 'IMS Voice Core Cluster HCM-01',
    odfName: 'ODF-HCM-TD-01',
    reservedPort: 1,
    distanceMeters: 110,
    conduitType: 'Metro Armored SIP Fiber',
    allocatedDevice: 'AudioCodes Mediant 800 SBC Gateway',
    deviceSerial: 'SN: AC800-9941-X7',
    deviceMac: 'MAC: 00:90:27:E4:11:80',
    accountId: 'T201000000000205',
  },
]

const SEED_DOC_DATA_URL = 'data:text/plain;base64,TmV4dXMgVGVsZWNvbSBWZXJpZmllZCBEb2N1bWVudA=='

function createSeedDocuments(prefix) {
  return {
    nationalId: {
      name: `${prefix}-cccd-id.txt`,
      size: 234500,
      type: 'text/plain',
      storageBackend: 'inline',
      dataUrl: SEED_DOC_DATA_URL,
      hasContent: true,
    },
    addressProof: {
      name: `${prefix}-address-proof.txt`,
      size: 198400,
      type: 'text/plain',
      storageBackend: 'inline',
      dataUrl: SEED_DOC_DATA_URL,
      hasContent: true,
    },
  }
}

const SEED_DEPOSIT_METHODS = ['BANK_TRANSFER', 'CASH', 'POS_CARD']

export const INITIAL_ORDERS = RAW_INITIAL_ORDERS.map((order, idx) => {
  const defaultDue = (() => {
    const type = String(order.serviceType || 'BROADBAND').toUpperCase()
    const baseDepositUnit = type === 'DIALUP' || type === 'DIAL_UP' ? 325 : type === 'LANDLINE' ? 250 : 500
    return Number((baseDepositUnit * (Number(order.endpoints) || 1)).toFixed(2))
  })()
  const seedMethod = SEED_DEPOSIT_METHODS[idx % SEED_DEPOSIT_METHODS.length]
  return withNormalizedOrderStatus({
    ...order,
    depositAmountUSD: order.depositAmountUSD ?? defaultDue,
    refundableAmountUSD: order.refundableAmountUSD ?? order.depositAmountUSD ?? defaultDue,
    depositStatus: order.depositStatus || DEPOSIT_STATUS.COLLECTED,
    depositPaymentMethod: order.depositPaymentMethod || seedMethod,
    depositPaymentMethodLabel:
      order.depositPaymentMethodLabel || resolveDepositCollectionMethodLabel(seedMethod),
    depositCollectedAmountUSD: order.depositCollectedAmountUSD ?? defaultDue,
    depositReceiptNumber: order.depositReceiptNumber || buildDepositReceiptNumber(order.id, false),
    depositCollectedAt: order.depositCollectedAt || '2026-03-01 09:00',
    depositCollector: order.depositCollector || 'Retail Counter (Demo)',
    documents: order.documents || createSeedDocuments(order.id.toLowerCase()),
  })
})

export function fetchOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(withNormalizedOrderStatus)
    }
    const legacyRaw = localStorage.getItem(LEGACY_RETAIL_STORAGE_KEY)
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw)
      if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
        const migrated = legacyParsed.map(withNormalizedOrderStatus)
        saveOrders(migrated)
        return migrated
      }
    }
  } catch {
  }
  saveOrders(INITIAL_ORDERS)
  return INITIAL_ORDERS
}

export function findOrderById(orderId) {
  const normalized = String(orderId || '').trim().toUpperCase()
  if (!normalized) return null
  const orders = fetchOrders()
  return (
    orders.find((o) => String(o.id || o.orderId || '').trim().toUpperCase() === normalized) || null
  )
}

function serializeDocumentEntry(doc) {
  if (!doc) return null
  if (!doc.storageKey && typeof Blob !== 'undefined' && (doc.file instanceof Blob || doc.blob instanceof Blob)) {
    throw new Error(
      `Binary file "${doc.name || 'document'}" must be persisted through commitOrderWithDocuments (IndexedDB/API) so its content is not lost.`
    )
  }
  const hasContent = Boolean(doc.storageKey || doc.dataUrl || doc.hasContent)
  if (!hasContent) {
    throw new Error(
      `Document "${doc.name || 'file'}" has no stored content or storage key and cannot be claimed as attached.`
    )
  }
  return {
    name: doc.name,
    size: doc.size,
    type: doc.type,
    lastModified: doc.lastModified || null,
    storageKey: doc.storageKey || null,
    storageBackend: doc.storageBackend || (doc.storageKey ? 'indexeddb' : doc.dataUrl ? 'inline' : null),
    persistedAt: doc.persistedAt || null,
    dataUrl: doc.storageKey ? null : doc.dataUrl || null,
    hasContent,
  }
}

export function saveOrders(orders) {
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders))
  } catch (err) {
    throw new Error(
      `Unable to save order data to browser storage (${err?.message || 'quota exceeded or storage blocked'}).`
    )
  }
}

export function getOrderRefundAmountUSD(order) {
  if (!order) return 0
  if (order.refundableAmountUSD != null && !Number.isNaN(Number(order.refundableAmountUSD))) {
    return Number(Number(order.refundableAmountUSD).toFixed(2))
  }
  if (order.depositAmountUSD != null && !Number.isNaN(Number(order.depositAmountUSD))) {
    return Number(Number(order.depositAmountUSD).toFixed(2))
  }
  const type = String(order.serviceType || 'BROADBAND').toUpperCase()
  const baseDepositUnit = type === 'DIALUP' || type === 'DIAL_UP' ? 325 : type === 'LANDLINE' ? 250 : 500
  const endpoints = Number(order.endpoints) || 1
  return Number((baseDepositUnit * endpoints).toFixed(2))
}

export function validateDepositCollectionInput(input = {}, requiredAmountUSD = 0) {
  const due = Number(Math.max(0, Number(requiredAmountUSD) || 0).toFixed(2))
  if (due <= 0) {
    return {
      valid: true,
      status: DEPOSIT_STATUS.WAIVED,
      methodId: DEPOSIT_WAIVER_METHOD.id,
      methodLabel: DEPOSIT_WAIVER_METHOD.label,
      collectedAmountUSD: 0,
      referenceCode: String(input?.referenceCode || input?.depositReference || '').trim(),
      collectorName: String(input?.collectorName || input?.depositCollector || 'Retail Counter (Demo)').trim(),
      receiptNumber: String(input?.receiptNumber || '').trim(),
      error: '',
    }
  }

  const confirmed = Boolean(input?.depositCollected ?? input?.confirmed)
  if (!confirmed) {
    return {
      valid: false,
      error: `Security deposit collection of $${due.toFixed(2)} must be confirmed before dispatching this order.`,
    }
  }

  const rawMethod = String(input?.collectionMethod ?? input?.depositPaymentMethod ?? '').trim()
  if (!rawMethod) {
    return {
      valid: false,
      error: 'Select a deposit collection method (Cash, Bank Transfer / QR, or POS Card).',
    }
  }

  const methodUpper = rawMethod.toUpperCase()
  const matchedMethod = DEPOSIT_COLLECTION_METHODS.find(
    (m) => m.id === methodUpper || m.label.toLowerCase() === rawMethod.toLowerCase()
  )
  const methodId = matchedMethod ? matchedMethod.id : rawMethod
  const methodLabel = resolveDepositCollectionMethodLabel(methodId)

  const parsedAmount =
    input?.collectedAmountUSD != null && input?.collectedAmountUSD !== ''
      ? Number(input.collectedAmountUSD)
      : due
  if (!Number.isFinite(parsedAmount) || parsedAmount < due) {
    return {
      valid: false,
      error: `Collected deposit ($${Number(parsedAmount || 0).toFixed(2)}) cannot be less than net deposit due ($${due.toFixed(2)}).`,
    }
  }

  return {
    valid: true,
    status: DEPOSIT_STATUS.COLLECTED,
    methodId,
    methodLabel,
    collectedAmountUSD: Number(parsedAmount.toFixed(2)),
    referenceCode: String(input?.referenceCode ?? input?.depositReference ?? '').trim(),
    collectorName:
      String(input?.collectorName ?? input?.depositCollector ?? 'Store Cashier (Demo)').trim() ||
      'Store Cashier (Demo)',
    receiptNumber: String(input?.receiptNumber ?? input?.depositReceiptNumber ?? '').trim(),
    error: '',
  }
}

export function getOrderDepositSummary(order) {
  if (!order) {
    return {
      depositStatus: DEPOSIT_STATUS.PENDING,
      statusLabel: 'Pending Collection',
      grossDepositUSD: 0,
      advancePaymentUSD: 0,
      bulkDiscountUSD: 0,
      expectedDepositDueUSD: 0,
      collectedAmountUSD: 0,
      methodId: '',
      methodLabel: 'Not Recorded',
      receiptNumber: '',
      collectedAt: '',
      referenceCode: '',
      collectorName: '',
      isCollectedOrWaived: false,
      refundAmountUSD: 0,
      refundReceiptNumber: '',
      refundedAt: '',
      refundReason: '',
    }
  }

  const normalizedOrderStatus = normalizeOrderStatus(order.status)
  const expectedDepositDueUSD = getOrderRefundAmountUSD(order)
  const grossDepositUSD =
    order.depositAmountUSD != null && !Number.isNaN(Number(order.depositAmountUSD))
      ? Number(Number(order.depositAmountUSD).toFixed(2))
      : expectedDepositDueUSD
  const advancePaymentUSD =
    order.advancePaymentUSD != null && !Number.isNaN(Number(order.advancePaymentUSD))
      ? Number(Number(order.advancePaymentUSD).toFixed(2))
      : 0
  const bulkDiscountUSD =
    order.bulkDiscountAmountUSD != null && !Number.isNaN(Number(order.bulkDiscountAmountUSD))
      ? Number(Number(order.bulkDiscountAmountUSD).toFixed(2))
      : 0

  let depositStatus = String(order.depositStatus || '').trim().toUpperCase()
  if (!depositStatus) {
    if (normalizedOrderStatus === ORDER_STATUS.REFUNDED) {
      depositStatus = DEPOSIT_STATUS.REFUNDED
    } else if (expectedDepositDueUSD <= 0 && normalizedOrderStatus !== ORDER_STATUS.DRAFT) {
      depositStatus = DEPOSIT_STATUS.WAIVED
    } else {
      depositStatus = DEPOSIT_STATUS.PENDING
    }
  } else if (normalizedOrderStatus === ORDER_STATUS.REFUNDED) {
    depositStatus = DEPOSIT_STATUS.REFUNDED
  }

  const statusLabel =
    depositStatus === DEPOSIT_STATUS.COLLECTED
      ? 'Collected'
      : depositStatus === DEPOSIT_STATUS.WAIVED
      ? 'Waived (100% Bulk)'
      : depositStatus === DEPOSIT_STATUS.REFUNDED
      ? 'Refunded (100%)'
      : 'Pending Collection'

  const collectedAmountUSD =
    order.depositCollectedAmountUSD != null && !Number.isNaN(Number(order.depositCollectedAmountUSD))
      ? Number(Number(order.depositCollectedAmountUSD).toFixed(2))
      : depositStatus === DEPOSIT_STATUS.COLLECTED || depositStatus === DEPOSIT_STATUS.REFUNDED
      ? expectedDepositDueUSD
      : 0

  const methodId = String(order.depositPaymentMethod || '').trim()
  const methodLabel =
    String(order.depositPaymentMethodLabel || '').trim() ||
    resolveDepositCollectionMethodLabel(methodId) ||
    (depositStatus === DEPOSIT_STATUS.WAIVED ? DEPOSIT_WAIVER_METHOD.label : 'Not Recorded')

  const receiptNumber =
    String(order.depositReceiptNumber || '').trim() ||
    (depositStatus === DEPOSIT_STATUS.COLLECTED || depositStatus === DEPOSIT_STATUS.REFUNDED
      ? buildDepositReceiptNumber(order.id, false)
      : depositStatus === DEPOSIT_STATUS.WAIVED
      ? buildDepositReceiptNumber(order.id, true)
      : '')

  return {
    depositStatus,
    statusLabel,
    grossDepositUSD,
    advancePaymentUSD,
    bulkDiscountUSD,
    expectedDepositDueUSD,
    collectedAmountUSD,
    methodId,
    methodLabel,
    receiptNumber,
    collectedAt: order.depositCollectedAt || '',
    referenceCode: order.depositReference || '',
    collectorName: order.depositCollector || '',
    isCollectedOrWaived:
      depositStatus === DEPOSIT_STATUS.COLLECTED ||
      depositStatus === DEPOSIT_STATUS.WAIVED ||
      depositStatus === DEPOSIT_STATUS.REFUNDED,
    refundAmountUSD:
      order.refundAmountUSD != null && !Number.isNaN(Number(order.refundAmountUSD))
        ? Number(Number(order.refundAmountUSD).toFixed(2))
        : expectedDepositDueUSD,
    refundReceiptNumber: order.refundReceiptNumber || (normalizedOrderStatus === ORDER_STATUS.REFUNDED ? `REF-${order.id}` : ''),
    refundedAt: order.refundedAt || '',
    refundReason: order.refundReason || '',
  }
}

export function getNextOrderId(servicePrefix = 'B') {
  const prefix = servicePrefix.charAt(0).toUpperCase()
  const seqKey = `${SEQUENCE_KEY_PREFIX}${prefix}`

  let maxSeq = 1089

  try {
    const savedSeq = localStorage.getItem(seqKey)
    if (savedSeq) {
      const parsedSeq = parseInt(savedSeq, 10)
      if (!isNaN(parsedSeq) && parsedSeq > maxSeq) {
        maxSeq = parsedSeq
      }
    }

    const orders = fetchOrders()
    for (const ord of orders) {
      const id = ord.id || ord.orderId || ''
      if (id.startsWith(prefix)) {
        const num = parseInt(id.slice(1), 10)
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num
        }
      }
    }
  } catch {
  }

  const nextSeq = maxSeq + 1
  return `${prefix}${String(nextSeq).padStart(10, '0')}`
}

function resolveCommitOrderId(orderPayload, orders) {
  const servicePrefix = (orderPayload.serviceType || 'B').charAt(0).toUpperCase()
  const prefix = ['D', 'B', 'T'].includes(servicePrefix) ? servicePrefix : 'B'

  let orderId = orderPayload.id || orderPayload.orderId
  if (!orderId || !ORDER_ID_REGEX.test(orderId)) {
    orderId = getNextOrderId(prefix)
  }

  const existing = orders.find((o) => o.id === orderId)
  if (existing) {
    assertOrderMutable(existing, 'modified')
  }

  return { orderId, prefix }
}

export function isDialupConnectionType(serviceType) {
  const normalized = String(serviceType || '').trim().toUpperCase()
  return normalized === 'DIALUP' || normalized === 'DIAL_UP'
}

export function isValidExistingLandlineIdentifier(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return false
  if (/^T\d{15}$/i.test(trimmed)) return true
  if (!/^[+\d()\s-]{8,24}$/.test(trimmed)) return false
  const digits = trimmed.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15
}

export function validateDialupLandlineRequirement(orderLike = {}) {
  const requiresLandline = isDialupConnectionType(
    orderLike.serviceType ?? orderLike.selectedConnectionType ?? orderLike.connectionType
  )
  if (!requiresLandline) {
    return {
      required: false,
      valid: true,
      mode: 'NOT_APPLICABLE',
      hasLandlineBundle: false,
      existingLandlineNumber: '',
      error: '',
    }
  }

  const wantsBundle = Boolean(orderLike.hasLandlineBundle)
  const rawExisting = String(orderLike.existingLandlineNumber || '').trim()
  const explicitMode = String(orderLike.landlineOption || '').trim().toUpperCase()

  if (explicitMode === 'BUNDLE' || (wantsBundle && explicitMode !== 'EXISTING')) {
    return {
      required: true,
      valid: true,
      mode: 'BUNDLE',
      hasLandlineBundle: true,
      existingLandlineNumber: '',
      error: '',
    }
  }

  if (explicitMode === 'EXISTING' || rawExisting) {
    if (!rawExisting) {
      return {
        required: true,
        valid: false,
        mode: 'EXISTING',
        hasLandlineBundle: false,
        existingLandlineNumber: '',
        error:
          'Dial-Up orders require an active Landline connection. Select or enter an existing Landline Account ID / PSTN number, or choose the PSTN Landline Bundle (+$15/mo).',
      }
    }
    if (!isValidExistingLandlineIdentifier(rawExisting)) {
      return {
        required: true,
        valid: false,
        mode: 'EXISTING',
        hasLandlineBundle: false,
        existingLandlineNumber: rawExisting,
        error:
          'Enter a valid active Landline Account ID (T + 15 digits, e.g. T101000000000102) or PSTN phone number (8–15 digits).',
      }
    }
    return {
      required: true,
      valid: true,
      mode: 'EXISTING',
      hasLandlineBundle: false,
      existingLandlineNumber: /^T\d{15}$/i.test(rawExisting) ? rawExisting.toUpperCase() : rawExisting,
      error: '',
    }
  }

  return {
    required: true,
    valid: false,
    mode: 'NONE',
    hasLandlineBundle: false,
    existingLandlineNumber: '',
    error:
      'Dial-Up orders cannot be submitted without a Landline connection. Link an existing active Landline number/Account ID or add the PSTN Landline Backup Bundle (+$15/mo).',
  }
}

function assertDialupLandlineIfSubmitting(orderPayload, targetStatus) {
  const normalizedTarget = normalizeOrderStatus(targetStatus)
  if (normalizedTarget === ORDER_STATUS.DRAFT || normalizedTarget === ORDER_STATUS.CANCELLED) {
    return validateDialupLandlineRequirement(orderPayload)
  }
  const check = validateDialupLandlineRequirement(orderPayload)
  if (!check.valid) {
    throw new Error(check.error)
  }
  return check
}

export function commitOrder(orderPayload) {
  const orders = fetchOrders()
  const { orderId, prefix } = resolveCommitOrderId(orderPayload, orders)
  const seqNum = parseInt(orderId.slice(1), 10)

  const targetStatus = orderPayload.status || ORDER_STATUS.PENDING_SURVEY
  const landlineCheck = assertDialupLandlineIfSubmitting(orderPayload, targetStatus)
  const normalizedDocuments = orderPayload.documents
    ? {
        nationalId: serializeDocumentEntry(
          orderPayload.documents.nationalId ?? orderPayload.documents.businessLicense
        ),
        addressProof: serializeDocumentEntry(
          orderPayload.documents.addressProof ?? orderPayload.documents.taxCertificate
        ),
      }
    : undefined

  const resolvedCityCode = orderPayload.cityCode || orderPayload.branchCode || '101'
  const networkDefaults = getDefaultNetworkDefaults(orderPayload.serviceType)
  const cableRoute = orderPayload.odnCheckResult?.cableRoute || `ODF-${resolvedCityCode}-01`
  const expectedDepositDueUSD = getOrderRefundAmountUSD({
    ...orderPayload,
    depositAmountUSD: orderPayload.depositAmountUSD,
    refundableAmountUSD: orderPayload.refundableAmountUSD,
  })
  const normalizedTargetStatus = normalizeOrderStatus(targetStatus)
  const requireDepositConfirmation =
    Boolean(orderPayload.requireDepositConfirmation) && normalizedTargetStatus !== ORDER_STATUS.DRAFT

  let depositFields = {
    depositStatus: orderPayload.depositStatus || DEPOSIT_STATUS.PENDING,
    depositPaymentMethod: orderPayload.depositPaymentMethod || '',
    depositPaymentMethodLabel: resolveDepositCollectionMethodLabel(orderPayload.depositPaymentMethod || ''),
    depositCollectedAmountUSD: Number(orderPayload.depositCollectedAmountUSD || 0),
    depositReceiptNumber: orderPayload.depositReceiptNumber || '',
    depositCollectedAt: orderPayload.depositCollectedAt || '',
    depositReference: orderPayload.depositReference || '',
    depositCollector: orderPayload.depositCollector || '',
  }

  if (requireDepositConfirmation) {
    const depositCheck = validateDepositCollectionInput(orderPayload, expectedDepositDueUSD)
    if (!depositCheck.valid) {
      throw new Error(depositCheck.error)
    }
    const isWaived = depositCheck.status === DEPOSIT_STATUS.WAIVED
    depositFields = {
      depositStatus: depositCheck.status,
      depositPaymentMethod: depositCheck.methodId,
      depositPaymentMethodLabel: depositCheck.methodLabel,
      depositCollectedAmountUSD: depositCheck.collectedAmountUSD,
      depositReceiptNumber: depositCheck.receiptNumber || buildDepositReceiptNumber(orderId, isWaived),
      depositCollectedAt: orderPayload.depositCollectedAt || formatActionTimestamp(),
      depositReference: depositCheck.referenceCode,
      depositCollector: depositCheck.collectorName,
    }
  } else if (
    orderPayload.depositCollected === true ||
    String(orderPayload.depositStatus || '').toUpperCase() === DEPOSIT_STATUS.COLLECTED
  ) {
    const check = validateDepositCollectionInput(
      {
        ...orderPayload,
        confirmed: true,
        collectionMethod: orderPayload.depositPaymentMethod || 'CASH',
      },
      expectedDepositDueUSD
    )
    if (check.valid) {
      const isWaived = check.status === DEPOSIT_STATUS.WAIVED
      depositFields = {
        depositStatus: check.status,
        depositPaymentMethod: check.methodId,
        depositPaymentMethodLabel: check.methodLabel,
        depositCollectedAmountUSD: check.collectedAmountUSD,
        depositReceiptNumber: check.receiptNumber || buildDepositReceiptNumber(orderId, isWaived),
        depositCollectedAt: orderPayload.depositCollectedAt || formatActionTimestamp(),
        depositReference: check.referenceCode,
        depositCollector: check.collectorName,
      }
    }
  } else if (expectedDepositDueUSD <= 0 && normalizedTargetStatus !== ORDER_STATUS.DRAFT) {
    depositFields = {
      depositStatus: DEPOSIT_STATUS.WAIVED,
      depositPaymentMethod: DEPOSIT_WAIVER_METHOD.id,
      depositPaymentMethodLabel: DEPOSIT_WAIVER_METHOD.label,
      depositCollectedAmountUSD: 0,
      depositReceiptNumber: buildDepositReceiptNumber(orderId, true),
      depositCollectedAt: formatActionTimestamp(),
      depositReference: '',
      depositCollector: 'System Bulk Waiver',
    }
  }

  const newOrder = withNormalizedOrderStatus({
    ...orderPayload,
    ...(orderPayload.customerId
      ? { customerId: String(orderPayload.customerId).trim().toUpperCase() }
      : {}),
    hasLandlineBundle: landlineCheck.hasLandlineBundle,
    landlineOption: landlineCheck.mode,
    existingLandlineNumber: landlineCheck.existingLandlineNumber,
    ...(normalizedDocuments ? { documents: normalizedDocuments } : {}),
    branchCode: orderPayload.branchCode || resolvedCityCode,
    cityCode: resolvedCityCode,
    odfName: orderPayload.odfName || cableRoute,
    reservedPort: orderPayload.reservedPort ?? 4,
    distanceMeters: orderPayload.distanceMeters ?? orderPayload.odnCheckResult?.distanceMeters ?? 180,
    conduitType: orderPayload.conduitType || 'HDPE 110mm Underground Duct',
    odnBox:
      orderPayload.odnBox ||
      (targetStatus === ORDER_STATUS.DRAFT
        ? 'Pending Draft Completion'
        : `Dispatching field engineer to ${cableRoute}`),
    signalLoss: orderPayload.signalLoss || 'Pending on-site reading',
    slaTimeRemaining: orderPayload.slaTimeRemaining || '2h 00m',
    slaRemainingMinutes: orderPayload.slaRemainingMinutes ?? 120,
    defaultVlan: orderPayload.defaultVlan ?? networkDefaults.defaultVlan,
    defaultIpWan: orderPayload.defaultIpWan || networkDefaults.defaultIpWan,
    defaultGateway: orderPayload.defaultGateway || networkDefaults.defaultGateway,
    depositAmountUSD: orderPayload.depositAmountUSD ?? getOrderRefundAmountUSD(orderPayload),
    refundableAmountUSD: orderPayload.refundableAmountUSD ?? expectedDepositDueUSD,
    ...depositFields,
    id: orderId,
    orderId,
    createdAt: orderPayload.createdAt || new Date().toISOString(),
    registeredTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    status: targetStatus,
    currentStep: orderPayload.currentStep ?? (targetStatus === ORDER_STATUS.DRAFT ? 1 : 2),
  })

  const updatedOrders = [newOrder, ...orders.filter((o) => o.id !== orderId)]
  saveOrders(updatedOrders)

  try {
    localStorage.setItem(`${SEQUENCE_KEY_PREFIX}${prefix}`, String(seqNum))
  } catch {
  }

  return newOrder
}

export async function commitOrderWithDocuments(orderPayload) {
  const orders = fetchOrders()
  const { orderId } = resolveCommitOrderId(orderPayload, orders)
  const targetStatus = orderPayload.status || ORDER_STATUS.PENDING_SURVEY
  assertDialupLandlineIfSubmitting(orderPayload, targetStatus)
  const persistedDocuments = await saveOrderDocuments(orderId, orderPayload.documents)

  try {
    return commitOrder({
      ...orderPayload,
      id: orderId,
      orderId,
      ...(persistedDocuments ? { documents: persistedDocuments } : {}),
    })
  } catch (err) {
    await deleteOrderDocuments(orderId, persistedDocuments)
    throw err
  }
}

function formatActionTimestamp() {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function assertOrderMutable(current, actionLabel = 'modified') {
  const status = normalizeOrderStatus(current?.status)
  if (isOrderModificationLocked(status)) {
    const meta = getOrderStatusMeta(status)
    throw new Error(
      status === ORDER_STATUS.ACTIVATED
        ? `Order ${current.id} is already ${meta.label} (${ORDER_STATUS.ACTIVATED}) and cannot be ${actionLabel} from Retail.`
        : `Order ${current.id} is ${meta.label} (${status}) and cannot be ${actionLabel}.`
    )
  }
}

function mutateOrder(orderId, buildUpdated, actionLabel = 'modified') {
  const orders = fetchOrders()
  const index = orders.findIndex((o) => o.id === orderId)
  if (index === -1) {
    throw new Error(`Order ${orderId} not found`)
  }

  const current = orders[index]
  assertOrderMutable(current, actionLabel)

  const updated = withNormalizedOrderStatus({
    ...current,
    ...buildUpdated(current),
    id: current.id,
  })

  const prevStatus = normalizeOrderStatus(current.status)
  const nextStatus = normalizeOrderStatus(updated.status)
  if (prevStatus === ORDER_STATUS.DRAFT && nextStatus !== ORDER_STATUS.DRAFT) {
    assertDialupLandlineIfSubmitting(updated, nextStatus)
  }

  orders[index] = updated
  saveOrders(orders)
  return updated
}

export function updateOrder(orderId, updatedFields) {
  return mutateOrder(orderId, () => updatedFields, 'edited')
}

export function cancelOrder(orderId, reason = 'Cancelled by store representative') {
  return mutateOrder(
    orderId,
    () => ({
      status: ORDER_STATUS.CANCELLED,
      cancellationReason: reason,
      cancelledAt: formatActionTimestamp(),
    }),
    'cancelled'
  )
}

export function recordOrderDepositCollection(orderId, collectionInput = {}) {
  const orders = fetchOrders()
  const index = orders.findIndex((o) => o.id === orderId)
  if (index === -1) {
    throw new Error(`Order ${orderId} not found`)
  }

  const current = orders[index]
  const currentStatus = normalizeOrderStatus(current.status)
  if (currentStatus === ORDER_STATUS.CANCELLED || currentStatus === ORDER_STATUS.REFUNDED) {
    throw new Error(`Cannot collect security deposit on ${currentStatus} order ${orderId}.`)
  }

  const summary = getOrderDepositSummary(current)
  if (summary.depositStatus === DEPOSIT_STATUS.COLLECTED) {
    throw new Error(
      `Security deposit for order ${orderId} has already been collected (Receipt ${summary.receiptNumber}).`
    )
  }

  const validation = validateDepositCollectionInput(
    {
      ...collectionInput,
      confirmed: true,
    },
    summary.expectedDepositDueUSD
  )
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const isWaived = validation.status === DEPOSIT_STATUS.WAIVED
  const updated = withNormalizedOrderStatus({
    ...current,
    depositStatus: validation.status,
    depositPaymentMethod: validation.methodId,
    depositPaymentMethodLabel: validation.methodLabel,
    depositCollectedAmountUSD: validation.collectedAmountUSD,
    depositReceiptNumber: validation.receiptNumber || buildDepositReceiptNumber(orderId, isWaived),
    depositCollectedAt: formatActionTimestamp(),
    depositReference: validation.referenceCode,
    depositCollector: validation.collectorName,
    depositNotes: String(collectionInput?.notes || '').trim(),
  })

  orders[index] = updated
  saveOrders(orders)
  return updated
}

export function refundOrder(
  orderId,
  reason = '100% Security Deposit Refunded',
  refundAmountUSD = null,
  refundMethod = 'Counter / Corporate Bank Refund'
) {
  return mutateOrder(
    orderId,
    (current) => {
      const existingSummary = getOrderDepositSummary(current)
      return {
        status: ORDER_STATUS.REFUNDED,
        depositStatus: DEPOSIT_STATUS.REFUNDED,
        depositReceiptNumber: existingSummary.receiptNumber || buildDepositReceiptNumber(orderId, false),
        refundReceiptNumber: `REF-${orderId}`,
        refundMethod: String(refundMethod || 'Counter / Corporate Bank Refund').trim(),
        refundReason: reason,
        refundAmountUSD: refundAmountUSD != null ? Number(refundAmountUSD) : getOrderRefundAmountUSD(current),
        refundedAt: formatActionTimestamp(),
      }
    },
    'refunded'
  )
}

export function calculateOrderFinancials({
  planPriceUSD = 50,
  endpoints = 1,
  includePoESwitch = false,
  selectedConnectionType = 'BROADBAND',
  hasLandlineBundle = false,
  monthsPrepaid = 0,
  bulkDiscountPercent = 0,
  installationFee = 50,
}) {
  const switchFee = includePoESwitch ? 25 : 0
  const landlineAddon = selectedConnectionType === 'DIALUP' && hasLandlineBundle ? 15 : 0
  const monthlyBillingSubtotal = planPriceUSD * endpoints + switchFee + landlineAddon

  const baseDepositUnit =
    selectedConnectionType === 'DIALUP' ? 325 : selectedConnectionType === 'LANDLINE' ? 250 : 500
  const depositAmount = baseDepositUnit * endpoints

  const advancePaymentAmount = monthlyBillingSubtotal * (monthsPrepaid || 0)
  const bulkDiscountAmount = Number(
    ((depositAmount + advancePaymentAmount) * (bulkDiscountPercent / 100)).toFixed(2)
  )
  const netDepositAndAdvance = depositAmount + advancePaymentAmount - bulkDiscountAmount

  const taxableMonthlyAmount = monthlyBillingSubtotal
  const telecomTax = calculateStatutoryTax(taxableMonthlyAmount)
  const grandTotal = Number(
    (monthlyBillingSubtotal + telecomTax + netDepositAndAdvance + installationFee).toFixed(2)
  )

  return {
    monthlyBillingSubtotal,
    depositAmount,
    advancePaymentAmount,
    bulkDiscountAmount,
    taxableMonthlyAmount,
    installationFee,
    taxRatePercent: STATUTORY_TAX_RATE_PERCENT,
    telecomTax,
    netDepositAndAdvance,
    grandTotal,
  }
}

