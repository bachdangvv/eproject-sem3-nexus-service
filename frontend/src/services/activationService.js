import { ORDER_STATUS } from '../utils/orderStatus.js'
import { fetchOrders, findOrderById, updateOrder, getOrderRefundAmountUSD } from './orderService.js'
import {
  fetchAvailableInventoryForService,
  assignInventoryDeviceToOrder,
  findInventoryDeviceBySerialOrMac,
  subscribeInventoryUpdated,
} from './inventoryService.js'

const ACTIVATED_ACCOUNTS_STORAGE_KEY = 'nexus_activated_accounts'

export function fetchAvailableWarehouseDevices(serviceType = null) {
  return fetchAvailableInventoryForService(serviceType)
}

export { findInventoryDeviceBySerialOrMac, subscribeInventoryUpdated }

export function toActivationOrder(order) {
  if (!order) return null
  const resolvedId = order.orderId || order.id
  const rawType = String(order.serviceType || 'BROADBAND').toUpperCase()
  const serviceType = rawType === 'DIALUP' ? 'DIAL_UP' : rawType
  const cityCode = String(order.cityCode || order.branchCode || '101').padStart(3, '0')
  const defaultVlan =
    order.defaultVlan ?? (serviceType === 'LANDLINE' ? 200 : serviceType === 'DIAL_UP' ? 300 : 100)
  const defaultIpWan =
    order.defaultIpWan ||
    (serviceType === 'LANDLINE'
      ? '118.70.185.14/29'
      : serviceType === 'DIAL_UP'
        ? '118.70.186.42/30'
        : '118.70.184.22/29')
  const defaultGateway =
    order.defaultGateway ||
    (serviceType === 'LANDLINE'
      ? '118.70.185.13'
      : serviceType === 'DIAL_UP'
        ? '118.70.186.41'
        : '118.70.184.21')

  return {
    ...order,
    id: resolvedId,
    orderId: resolvedId,
    serviceType,
    serviceTitle: order.serviceTitle || order.planName || order.serviceName || serviceType,
    customerName: order.customerName || 'Enterprise Subscriber',
    installationAddress: order.installationAddress || order.address || '',
    cityCode,
    district: order.district || order.branchName || 'Metro Core',
    odfName: order.odfName || `ODF-CORE-${cityCode}`,
    reservedPort: order.reservedPort ?? 4,
    distanceMeters: Number(order.distanceMeters) || 200,
    conduitType: order.conduitType || 'Underground HDPE Fiber',
    surveyRxDbm: order.surveyRxDbm ?? -18.4,
    slaRemainingMinutes: order.slaRemainingMinutes ?? 120,
    monthlyFeeUSD: Number(order.monthlyFeeUSD ?? order.planPriceUSD ?? 50),
    depositPaidUSD: Number(order.depositPaidUSD ?? getOrderRefundAmountUSD(order)),
    defaultVlan,
    defaultIpWan,
    defaultGateway,
  }
}

export function getActivationQueue() {
  return fetchOrders()
    .filter((ord) => ord.status === ORDER_STATUS.FEASIBLE)
    .map(toActivationOrder)
}

export async function loadActivationQueue() {
  await new Promise((resolve) => setTimeout(resolve, 120))
  return getActivationQueue()
}

export function generateAccountId(servicePrefix, cityCode = '101', sequenceNum = 1) {
  const prefix = String(servicePrefix || 'B').charAt(0).toUpperCase()
  const city = String(cityCode || '101').padStart(3, '0')
  const seq = String(sequenceNum).padStart(12, '0')
  return `${prefix}${city}${seq}`
}

export function previewNextAccountId(servicePrefix, cityCode = '101') {
  const existingAccounts = getActivatedAccounts()
  let nextSeq = existingAccounts.length + 1
  let candidate = generateAccountId(servicePrefix, cityCode, nextSeq)
  while (existingAccounts.some((a) => a.accountId === candidate)) {
    nextSeq += 1
    candidate = generateAccountId(servicePrefix, cityCode, nextSeq)
  }
  return candidate
}

export async function commissionCircuit(orderId, provisioningPayload) {
  await new Promise((resolve) => setTimeout(resolve, 350))

  const order = findActivationOrderById(orderId)
  if (!order) {
    throw new Error(`Order not found: Order ID "${orderId}" does not exist in shared order store.`)
  }

  if (order.status === ORDER_STATUS.ACTIVATED) {
    throw new Error(
      `Order ${order.orderId} has already been activated (Account ${order.accountId || 'Assigned'}).`
    )
  }
  if (order.status !== ORDER_STATUS.FEASIBLE) {
    throw new Error(
      `Order ${order.orderId} is currently ${order.statusLabel || order.status}. Only FEASIBLE orders can be commissioned.`
    )
  }

  const servicePrefix = order.orderId.charAt(0)
  const existingAccounts = getActivatedAccounts()
  const accountId = previewNextAccountId(servicePrefix, order.cityCode)
  const commissionedAt = new Date().toISOString()

  const { device: assignedDevice } = assignInventoryDeviceToOrder({
    deviceId: provisioningPayload.deviceId || '',
    serialNumber: provisioningPayload.serialNumber || '',
    macAddress: provisioningPayload.macAddress || '',
    orderId: order.orderId,
    accountId,
    customerName: order.customerName,
  })

  const activatedAccount = {
    accountId,
    orderId: order.orderId,
    customerId: order.customerId || null,
    customerEmail: order.customerEmail || order.email || null,
    serviceType: order.serviceType,
    serviceTitle: order.serviceTitle,
    customerName: order.customerName,
    taxId: order.taxId,
    installationAddress: order.installationAddress,
    cityCode: order.cityCode,
    status: 'ACTIVE',
    commissionedAt,
    assignedHardware: {
      deviceId: assignedDevice.id,
      serialNumber: assignedDevice.serialNumber,
      macAddress: assignedDevice.macAddress,
      model: assignedDevice.model || provisioningPayload.model,
      vendor: assignedDevice.vendor || provisioningPayload.vendor,
    },
    networkConfig: {
      vlanId: provisioningPayload.vlanId,
      ipWan: provisioningPayload.ipWan,
      gateway: provisioningPayload.gateway,
      dns: '8.8.8.8, 1.1.1.1',
    },
    qualityMetrics: {
      rxPowerDbm: provisioningPayload.rxPowerDbm || -18.4,
      pingMs: provisioningPayload.pingMs || 1.8,
      throughput: provisioningPayload.throughput || '512 Mbps / 508 Mbps',
    },
    handoverSignatory: provisioningPayload.signatoryName,
    handoverNationalId: provisioningPayload.signatoryNationalId,
    dueAmountUSD: 0,
    monthlyChargeUSD: order.monthlyFeeUSD,
    depositBalanceUSD: order.depositPaidUSD,
  }

  try {
    const filtered = existingAccounts.filter((a) => a.accountId !== accountId)
    filtered.unshift(activatedAccount)
    localStorage.setItem(ACTIVATED_ACCOUNTS_STORAGE_KEY, JSON.stringify(filtered))
  } catch {
  }

  updateOrder(order.orderId, {
    status: ORDER_STATUS.ACTIVATED,
    currentStep: 5,
    accountId,
    allocatedDevice: assignedDevice.model || provisioningPayload.model || order.allocatedDevice,
    assignedDeviceId: assignedDevice.id,
    deviceSerial: `SN: ${assignedDevice.serialNumber}`,
    deviceMac: `MAC: ${assignedDevice.macAddress}`,
    signalLoss: `${provisioningPayload.rxPowerDbm ?? -18.4} dBm`,
    vlanId: provisioningPayload.vlanId,
    ipWan: provisioningPayload.ipWan,
    gateway: provisioningPayload.gateway,
    commissionedAt,
  })

  return activatedAccount
}

export const INITIAL_ACTIVATED_ACCOUNTS = [
  {
    accountId: 'B101000000000089',
    orderId: 'B0000001089',
    customerId: 'CUS-001',
    customerName: 'AlphaCorp Technology Solutions JSC',
    taxId: '0108881948',
    customerEmail: 'accounting@alphacorp.vn',
    serviceType: 'BROADBAND',
    serviceTitle: 'FTTH Dedicated 500Mbps Metro Core',
    installationAddress: '148 Ly Thuong Kiet, Ward 7, District 10, Ho Chi Minh City',
    cityCode: '101',
    status: 'ACTIVE',
    commissionedAt: '2026-02-14T08:30:00Z',
    assignedHardware: {
      serialNumber: 'NX8829104',
      macAddress: 'A4:6D:34:90:8C:11',
      model: 'Nokia ISAM ONT G-240W-C',
      vendor: 'Nokia Enterprise',
    },
    networkConfig: {
      vlanId: 402,
      ipWan: '118.70.124.89/29',
      gateway: '118.70.124.81',
      dns: '8.8.8.8, 1.1.1.1',
    },
    qualityMetrics: {
      rxPowerDbm: -18.2,
      pingMs: 1.6,
      throughput: '512 Mbps / 504 Mbps',
    },
    monthlyChargeUSD: 240.0,
  },
  {
    accountId: 'T101000000000102',
    orderId: 'T0000001092',
    customerName: 'An Binh Commercial Joint Stock Bank',
    taxId: '0101446758',
    serviceType: 'LANDLINE',
    serviceTitle: 'SIP Trunking 30 Channels PRI Backbone',
    installationAddress: '88 Hai Ba Trung, P. Cua Nam, Q. Hoan Kiem, Hanoi',
    cityCode: '101',
    status: 'ACTIVE',
    commissionedAt: '2026-02-18T10:15:00Z',
    assignedHardware: {
      serialNumber: 'GS-UCM-90214',
      macAddress: '00:24:32:8A:4F:8C',
      model: 'Grandstream GXW4232 SIP Gateway',
      vendor: 'Grandstream',
    },
    networkConfig: {
      vlanId: 508,
      ipWan: '118.70.185.14/29',
      gateway: '118.70.185.13',
      dns: '8.8.8.8, 1.1.1.1',
    },
    qualityMetrics: {
      rxPowerDbm: -19.0,
      pingMs: 2.1,
      throughput: '30 Concurrent Voice Trunks',
    },
    monthlyChargeUSD: 180.0,
  },
  {
    accountId: 'D101000000000045',
    orderId: 'D0000001094',
    customerName: 'VinMart+ Convenience Retail Chain',
    taxId: '0107891234',
    serviceType: 'DIAL_UP',
    serviceTitle: 'POS / ATM Dedicated V.92 Backup Network',
    installationAddress: '19 Pho Hue, P. Hang Bai, Q. Hoan Kiem, Hanoi',
    cityCode: '101',
    status: 'ACTIVE',
    commissionedAt: '2026-03-01T09:00:00Z',
    assignedHardware: {
      serialNumber: 'NX-MDM-2026-55109',
      macAddress: '00:08:54:12:34:56',
      model: 'MultiTech MultiModem II 56K Rackmount',
      vendor: 'MultiTech Systems',
    },
    networkConfig: {
      vlanId: 300,
      ipWan: '118.70.186.42/30',
      gateway: '118.70.186.41',
      dns: '8.8.8.8, 1.1.1.1',
    },
    qualityMetrics: {
      rxPowerDbm: -21.4,
      pingMs: 8.5,
      throughput: '56 Kbps V.92',
    },
    monthlyChargeUSD: 85.0,
  },
  {
    accountId: 'D201000000000412',
    orderId: 'D0000000412',
    customerId: 'CUS-004',
    customerName: 'PharmaCare Healthcare Group',
    taxId: '0304918274',
    customerEmail: 'procurement@pharmacare.vn',
    serviceType: 'DIAL_UP',
    serviceTitle: 'Leased Line 100M Dedicated',
    installationAddress: 'Landmark 81, Floor 22, Binh Thanh, HCMC',
    cityCode: '201',
    status: 'ACTIVE',
    commissionedAt: '2026-03-05T11:04:00Z',
    assignedHardware: {
      serialNumber: 'FOC2239V0AB',
      macAddress: '00:27:0D:F1:48:90',
      model: 'Edge Router Cisco ASR-920 + Modem v.90',
      vendor: 'Cisco Systems',
    },
    networkConfig: {
      vlanId: 310,
      ipWan: '118.70.190.10/29',
      gateway: '118.70.190.9',
      dns: '8.8.8.8, 1.1.1.1',
    },
    qualityMetrics: {
      rxPowerDbm: -14.1,
      pingMs: 1.5,
      throughput: '100 Mbps Dedicated',
    },
    monthlyChargeUSD: 450.0,
  },
  {
    accountId: 'T201000000000205',
    orderId: 'T0000000205',
    customerId: 'CUS-006',
    customerName: 'FastCall Teleservices Contact Center',
    taxId: '0309981273',
    customerEmail: 'it.director@fastcall.vn',
    serviceType: 'LANDLINE',
    serviceTitle: 'SIP Trunking 30 Channels',
    installationAddress: 'Parkson Cantavil, Thu Duc, HCMC',
    cityCode: '201',
    status: 'ACTIVE',
    commissionedAt: '2026-03-06T14:10:00Z',
    assignedHardware: {
      serialNumber: 'AC800-9941-X7',
      macAddress: '00:90:27:E4:11:80',
      model: 'AudioCodes Mediant 800 SBC Gateway',
      vendor: 'AudioCodes Telecom',
    },
    networkConfig: {
      vlanId: 205,
      ipWan: '118.70.191.22/29',
      gateway: '118.70.191.21',
      dns: '8.8.8.8, 1.1.1.1',
    },
    qualityMetrics: {
      rxPowerDbm: -16.0,
      pingMs: 1.2,
      throughput: '30 SIP Channels',
    },
    monthlyChargeUSD: 120.0,
  },
]

export function getActivatedAccounts() {
  try {
    const raw = localStorage.getItem(ACTIVATED_ACCOUNTS_STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
    localStorage.setItem(ACTIVATED_ACCOUNTS_STORAGE_KEY, JSON.stringify(INITIAL_ACTIVATED_ACCOUNTS))
    return INITIAL_ACTIVATED_ACCOUNTS
  } catch {
    return INITIAL_ACTIVATED_ACCOUNTS
  }
}

export function updateAccountConnectionStatus(accountId, newStatus = 'ACTIVE') {
  try {
    const raw = localStorage.getItem(ACTIVATED_ACCOUNTS_STORAGE_KEY)
    if (!raw) return
    const accounts = JSON.parse(raw)
    const updated = accounts.map((acc) => {
      if (acc.accountId === accountId) {
        return { ...acc, status: newStatus }
      }
      return acc
    })
    localStorage.setItem(ACTIVATED_ACCOUNTS_STORAGE_KEY, JSON.stringify(updated))
  } catch {
  }
}

export function findActivationOrderById(orderId) {
  const found = findOrderById(orderId)
  return toActivationOrder(found)
}

export async function loadActivationOrderById(orderId) {
  await new Promise((resolve) => setTimeout(resolve, 120))
  return findActivationOrderById(orderId)
}
